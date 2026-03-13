import { useState, useRef, useEffect } from 'react';
import { useSession } from '../lib/auth-client';
import { WhisperRecorder, transcribeWithWhisper } from '../utils/whisperApi';
import {
  Brain, Mic, MicOff, Zap, Sparkles, Clock, Target, AlertCircle,
  CheckCircle2, Plus, Edit3, Check, X, Square, CheckSquare,
  Settings, Sun, Moon, Sunset, Save,
} from 'lucide-react';

import { VS } from '../lib/theme';

interface WorkSchedule {
  type: 'traditional' | 'night' | 'evening' | 'early' | 'custom';
  startTime: string;
  endTime: string;
  peakHours: string[];
  breakTime?: string;
  timezone?: string;
}

interface ProcessedTask {
  id: string;
  title: string;
  description: string;
  priority: 'Urgent' | 'High' | 'Medium' | 'Low';
  estimatedHours: number;
  category: string;
  tags: string[];
  microTasks: string[];
  optimalTimeSlot?: string;
  energyLevel?: 'High' | 'Medium' | 'Low';
  focusType?: 'Deep Work' | 'Collaboration' | 'Administrative';
  suggestedDay?: 'Today' | 'Tomorrow' | 'This Week';
  selected?: boolean;
  isEditing?: boolean;
}

interface DailySchedule {
  totalEstimatedHours: number;
  workloadAssessment: 'Optimal' | 'Heavy' | 'Light';
  recommendedOrder: string[];
  timeBlocks: { time: string; taskId: string; rationale: string }[];
}

interface BrainDumpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTasksImported?: () => void;
}

const scheduleTemplates: Record<string, WorkSchedule> = {
  traditional: { type: 'traditional', startTime: '9:00 AM', endTime: '5:00 PM', peakHours: ['9:00 AM - 11:00 AM', '2:00 PM - 4:00 PM'], breakTime: '12:00 PM - 1:00 PM' },
  night:       { type: 'night',       startTime: '9:00 PM', endTime: '5:00 AM', peakHours: ['10:00 PM - 12:00 AM', '2:00 AM - 4:00 AM'],  breakTime: '12:30 AM - 1:30 AM' },
  evening:     { type: 'evening',     startTime: '2:00 PM', endTime: '10:00 PM', peakHours: ['3:00 PM - 5:00 PM', '7:00 PM - 9:00 PM'],   breakTime: '5:30 PM - 6:30 PM'  },
  early:       { type: 'early',       startTime: '5:00 AM', endTime: '1:00 PM',  peakHours: ['6:00 AM - 8:00 AM', '10:00 AM - 12:00 PM'], breakTime: '8:30 AM - 9:30 AM'  },
};

function getScheduleIcon(type: string) {
  if (type === 'night') return Moon;
  if (type === 'evening') return Sunset;
  return Sun;
}

function getScheduleDisplayName(s: WorkSchedule) {
  const names: Record<string, string> = {
    traditional: 'Traditional (9 AM - 5 PM)',
    night: 'Night Shift (9 PM - 5 AM)',
    evening: 'Evening (2 PM - 10 PM)',
    early: 'Early Bird (5 AM - 1 PM)',
    custom: `Custom (${s.startTime} - ${s.endTime})`,
  };
  return names[s.type] || 'Custom Schedule';
}

function getPriorityStyle(priority: string): { color: string; bgColor: string; borderColor: string } {
  switch (priority) {
    case 'Urgent': return { color: VS.purple, bgColor: 'rgba(197,134,192,0.1)', borderColor: 'rgba(197,134,192,0.2)' };
    case 'High':   return { color: VS.red,    bgColor: 'rgba(244,71,71,0.1)',   borderColor: 'rgba(244,71,71,0.2)'   };
    case 'Medium': return { color: VS.yellow, bgColor: 'rgba(220,220,170,0.1)', borderColor: 'rgba(220,220,170,0.2)' };
    case 'Low':    return { color: VS.teal,   bgColor: 'rgba(78,201,176,0.1)',  borderColor: 'rgba(78,201,176,0.2)'  };
    default:       return { color: VS.text2,  bgColor: VS.bg3,                  borderColor: VS.border               };
  }
}

const inputCls = 'w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#007acc]/50 transition-all';
const inputStyle: React.CSSProperties = { background: VS.bg3, border: `1px solid ${VS.border2}`, color: VS.text0 };

export default function BrainDumpModal({ isOpen, onClose, onTasksImported }: BrainDumpModalProps) {
  const { data: session } = useSession();
  const [content, setContent] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedTasks, setProcessedTasks] = useState<ProcessedTask[]>([]);
  const [dailySchedule, setDailySchedule] = useState<DailySchedule | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [editingTask, setEditingTask] = useState<string | null>(null);
  const [showScheduleSettings, setShowScheduleSettings] = useState(false);
  const [workSchedule, setWorkSchedule] = useState<WorkSchedule | null>(null);
  const [recognition, setRecognition] = useState<any>(null);
  const [whisperRecorder, setWhisperRecorder] = useState<WhisperRecorder | null>(null);
  const [useWhisper, setUseWhisper] = useState(true);
  const [error, setError] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [content]);

  // Auto-save indicator
  useEffect(() => {
    if (content.trim()) {
      const t = setTimeout(() => setLastSaved(new Date()), 2000);
      return () => clearTimeout(t);
    }
  }, [content]);

  // Load work schedule
  useEffect(() => {
    const saved = localStorage.getItem('workSchedule');
    if (saved) {
      try { setWorkSchedule(JSON.parse(saved)); }
      catch { setWorkSchedule(scheduleTemplates.traditional); }
    } else {
      setWorkSchedule(scheduleTemplates.traditional);
    }
  }, []);

  // Init speech recognition
  useEffect(() => {
    const recorder = new WhisperRecorder();
    setWhisperRecorder(recorder);
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-US';
      let finalTranscript = '';
      rec.onresult = (event: any) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript;
        }
        if (finalTranscript) {
          setContent(prev => prev + (prev.endsWith(' ') || !prev ? '' : ' ') + finalTranscript);
          finalTranscript = '';
        }
      };
      rec.onerror = () => { setError('Voice recognition error. Please try again.'); setIsRecording(false); };
      rec.onend = () => setIsRecording(false);
      setRecognition(rec);
    }
  }, []);

  const saveWorkSchedule = (schedule: WorkSchedule) => {
    setWorkSchedule(schedule);
    localStorage.setItem('workSchedule', JSON.stringify(schedule));
  };

  const startRecording = async () => {
    try {
      setError('');
      setIsRecording(true);
      if (useWhisper && whisperRecorder) {
        await whisperRecorder.startRecording();
      } else if (recognition) {
        recognition.start();
      } else {
        throw new Error('No voice recognition available');
      }
    } catch {
      setError('Failed to start voice recording. Please check microphone permissions.');
      setIsRecording(false);
      if (useWhisper && recognition) {
        setUseWhisper(false);
        try { recognition.start(); setIsRecording(true); } catch { /* ignore */ }
      }
    }
  };

  const stopRecording = async () => {
    try {
      if (useWhisper && whisperRecorder?.isCurrentlyRecording()) {
        const audioBlob = await whisperRecorder.stopRecording();
        setError('Processing audio...');
        try {
          const result = await transcribeWithWhisper(audioBlob, {
            language: 'auto',
            onFallback: () => { setUseWhisper(false); setError('Whisper unavailable, switched to browser recognition'); },
          });
          setContent(prev => prev + (prev.endsWith(' ') || !prev ? '' : ' ') + result.transcription);
          setError('');
        } catch {
          setError('Transcription failed. Please try again.');
        }
      } else if (recognition) {
        recognition.stop();
      }
    } catch {
      setError('Failed to stop recording.');
    } finally {
      setIsRecording(false);
    }
  };

  const handleVoiceToggle = () => isRecording ? stopRecording() : startRecording();

  const handleProcessDump = async () => {
    if (!content.trim()) return;
    setIsProcessing(true);
    setError('');
    try {
      const response = await fetch('/api/ai/process-brain-dump', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: content.trim(),
          timestamp: new Date().toISOString(),
          preferences: {
            workingHours: { start: workSchedule?.startTime || '9:00 AM', end: workSchedule?.endTime || '5:00 PM' },
            focusHours: workSchedule?.peakHours || ['9:00 AM - 11:00 AM', '2:00 PM - 4:00 PM'],
            breakInterval: 90,
            maxTasksPerDay: 6,
            prioritizeUrgent: true,
            scheduleType: workSchedule?.type || 'traditional',
            breakTime: workSchedule?.breakTime,
            timezone: workSchedule?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
        }),
      });
      if (!response.ok) throw new Error('Failed to process brain dump');
      const data = await response.json();
      const tasks: ProcessedTask[] = (data.extractedTasks || []).map((t: any) => ({
        id: t.id, title: t.title, description: t.description, priority: t.priority,
        estimatedHours: t.estimatedHours, category: t.category, tags: t.tags || [],
        microTasks: t.microTasks || [], optimalTimeSlot: t.optimalTimeSlot,
        energyLevel: t.energyLevel, focusType: t.focusType, suggestedDay: t.suggestedDay,
      }));
      setProcessedTasks(tasks);
      setDailySchedule(data.dailySchedule || null);
      setSelectedTasks(new Set(tasks.map(t => t.id)));
      if (!tasks.length) setError('No tasks could be extracted. Try being more specific.');
    } catch {
      setError('Processing failed. Please try again.');
      setProcessedTasks([]);
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleTaskSelection = (taskId: string) => {
    setSelectedTasks(prev => {
      const s = new Set(prev);
      s.has(taskId) ? s.delete(taskId) : s.add(taskId);
      return s;
    });
  };

  const toggleSelectAll = () => {
    setSelectedTasks(selectedTasks.size === processedTasks.length ? new Set() : new Set(processedTasks.map(t => t.id)));
  };

  const updateTaskField = (taskId: string, field: keyof ProcessedTask, value: any) => {
    setProcessedTasks(prev => prev.map(t => t.id === taskId ? { ...t, [field]: value } : t));
  };

  const handleSaveTasks = async () => {
    const selected = processedTasks.filter(t => selectedTasks.has(t.id));
    if (!selected.length || !session?.user?.id) {
      setError('Please select at least one task to import.');
      return;
    }
    setIsSaving(true);
    setError('');
    try {
      const response = await fetch('/api/brain-dump/save-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extractedTasks: selected, dailySchedule, userId: session.user.id, originalContent: content }),
      });
      if (!response.ok) throw new Error('Failed to save tasks');
      setLastSaved(new Date());
      setError(`Successfully imported ${selected.length} tasks!`);
      onTasksImported?.();
      setTimeout(() => {
        setProcessedTasks([]);
        setSelectedTasks(new Set());
        setDailySchedule(null);
        setContent('');
        setError('');
        onClose();
      }, 2000);
    } catch {
      setError('Failed to save tasks. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full flex flex-col rounded-2xl overflow-hidden"
        style={{
          maxWidth: 1100,
          maxHeight: '90vh',
          background: VS.bg0,
          border: `1px solid ${VS.border}`,
          boxShadow: '0 32px 80px rgba(0,0,0,0.8)',
        }}
      >
        {/* ── Modal header ── */}
        <div
          className="flex items-center justify-between px-6 py-4 shrink-0"
          style={{ background: VS.bg1, borderBottom: `1px solid ${VS.border}` }}
        >
          <div className="flex items-center gap-3">
            <div
              className="h-9 w-9 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#007acc,#569cd6)' }}
            >
              <Brain className="h-4.5 w-4.5 text-white" style={{ width: 18, height: 18 }} />
            </div>
            <div>
              <h2 className="text-sm font-bold" style={{ color: VS.text0 }}>Brain Dump</h2>
              <p className="text-[11px]" style={{ color: VS.text2 }}>Transform thoughts into actionable tasks with AI</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Work schedule */}
            {workSchedule && (
              <div className="flex items-center gap-2">
                <span className="text-[11px]" style={{ color: VS.text2 }}>
                  {getScheduleDisplayName(workSchedule).split('(')[0].trim()}
                </span>
                <button
                  onClick={() => setShowScheduleSettings(v => !v)}
                  className="h-7 w-7 rounded-lg flex items-center justify-center transition-colors hover:bg-white/5"
                  style={{ background: VS.bg3, border: `1px solid ${VS.border}`, color: VS.text2 }}
                  title="Schedule settings"
                >
                  <Settings className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* Last saved */}
            {lastSaved && (
              <div className="flex items-center gap-1.5 text-[11px]" style={{ color: VS.text2 }}>
                <Save className="h-3 w-3" />
                {lastSaved.toLocaleTimeString()}
              </div>
            )}

            {/* Close */}
            <button
              onClick={onClose}
              className="h-7 w-7 rounded-lg flex items-center justify-center transition-colors hover:bg-white/5"
              style={{ color: VS.text1 }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ── Schedule settings panel ── */}
        {showScheduleSettings && (
          <div
            className="px-6 py-4 shrink-0"
            style={{ background: VS.bg1, borderBottom: `1px solid ${VS.border}` }}
          >
            <p className="text-[11px] uppercase tracking-widest mb-3" style={{ color: VS.text2 }}>
              Work Schedule
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {Object.entries(scheduleTemplates).map(([key, tmpl]) => {
                const Icon = getScheduleIcon(tmpl.type);
                const isSelected = workSchedule?.type === tmpl.type;
                return (
                  <button
                    key={key}
                    onClick={() => { saveWorkSchedule(tmpl); setShowScheduleSettings(false); }}
                    className="flex flex-col items-center gap-1.5 py-3 px-3 rounded-xl text-[11px] font-medium transition-all"
                    style={{
                      background: isSelected ? `${VS.accent}22` : VS.bg3,
                      border: `1px solid ${isSelected ? VS.accent + '88' : VS.border}`,
                      color: isSelected ? VS.accent : VS.text1,
                    }}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{getScheduleDisplayName(tmpl).split('(')[0].trim()}</span>
                    <span style={{ color: VS.text2, fontSize: 10 }}>{tmpl.startTime} – {tmpl.endTime}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Body: two independently-scrolling columns ── */}
        <div className="flex-1 flex min-h-0 overflow-hidden">

            {/* ── LEFT: Input area ── */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4" style={{ borderRight: `1px solid ${VS.border}` }}>
              {/* Section header */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[13px] font-bold" style={{ color: VS.text0 }}>Daily Thoughts</h3>
                  <p className="text-[11px] mt-0.5" style={{ color: VS.text2 }}>Dump everything on your mind</p>
                </div>
                <div className="flex items-center gap-2">
                  {useWhisper && (
                    <span
                      className="text-[10px] px-2 py-1 rounded-md"
                      style={{ background: `${VS.accent}18`, color: VS.accent, border: `1px solid ${VS.accent}44` }}
                    >
                      GPT-4o Whisper
                    </span>
                  )}
                  <button
                    onClick={handleVoiceToggle}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all"
                    style={
                      isRecording
                        ? { background: `${VS.red}22`, color: VS.red, border: `1px solid ${VS.red}55` }
                        : { background: VS.bg3, color: VS.text1, border: `1px solid ${VS.border}` }
                    }
                  >
                    {isRecording ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                    {isRecording ? 'Stop' : 'Voice'}
                  </button>
                </div>
              </div>

              {/* Textarea */}
              <textarea
                ref={textareaRef}
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder={`Start typing or speaking your thoughts...

The AI will:
• Extract actionable tasks from your notes
• Assign priority and estimated time
• Organize by energy level and focus type
• Suggest optimal time slots

Example:
"Need to finish the quarterly reports by Friday – complex analysis. Call John about the marketing campaign, urgent. Research new CRM tools for better productivity."`}
                className="w-full rounded-xl text-sm resize-none focus:outline-none focus:ring-1 focus:ring-[#007acc]/50 placeholder-gray-600"
                style={{
                  background: VS.bg2,
                  border: `1px solid ${VS.border}`,
                  color: VS.text0,
                  minHeight: 280,
                  padding: '14px 16px',
                  lineHeight: 1.7,
                }}
              />

              {/* Word count + process button */}
              <div className="flex items-center justify-between">
                <span className="text-[11px]" style={{ color: VS.text2 }}>
                  {content.length} chars · {content.split(' ').filter(w => w).length} words
                </span>
                <button
                  onClick={handleProcessDump}
                  disabled={!content.trim() || isProcessing}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold text-white transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: 'linear-gradient(135deg,#007acc,#569cd6)' }}
                >
                  {isProcessing ? (
                    <><Sparkles className="h-3.5 w-3.5 animate-spin" /> Processing...</>
                  ) : (
                    <><Zap className="h-3.5 w-3.5" /> Organize with AI</>
                  )}
                </button>
              </div>

              {/* Error */}
              {error && (
                <div
                  className="px-4 py-3 rounded-xl text-[12px]"
                  style={{
                    background: error.startsWith('Successfully')
                      ? `${VS.teal}14` : `${VS.red}14`,
                    border: `1px solid ${error.startsWith('Successfully') ? VS.teal + '44' : VS.red + '44'}`,
                    color: error.startsWith('Successfully') ? VS.teal : VS.red,
                  }}
                >
                  {error}
                </div>
              )}

              {/* Processing animation */}
              {isProcessing && (
                <div
                  className="flex items-center gap-4 px-4 py-4 rounded-xl"
                  style={{ background: VS.bg2, border: `1px solid ${VS.border}` }}
                >
                  <div
                    className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 animate-pulse"
                    style={{ background: 'linear-gradient(135deg,#007acc,#569cd6)' }}
                  >
                    <Sparkles className="h-5 w-5 text-white animate-spin" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[13px] font-semibold" style={{ color: VS.text0 }}>AI is analyzing your thoughts…</p>
                    <p className="text-[11px] mt-0.5" style={{ color: VS.text2 }}>Extracting tasks, estimating time, organizing priorities</p>
                    <div className="h-1 rounded-full mt-3 overflow-hidden" style={{ background: VS.bg3 }}>
                      <div
                        className="h-full rounded-full animate-pulse"
                        style={{ width: '70%', background: 'linear-gradient(90deg,#007acc,#4ec9b0)' }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Tips (when no tasks yet) */}
              {!processedTasks.length && !isProcessing && (
                <div
                  className="rounded-xl p-4 space-y-2"
                  style={{ background: VS.bg2, border: `1px solid ${VS.border}` }}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: VS.text2 }}>Tips for better results</p>
                  {[
                    ['Be Specific', 'Include deadlines, context, and constraints'],
                    ['Include All Details', 'Mention projects, clients, and priority'],
                    ['Think Out Loud', 'Include thoughts, concerns, and ideas'],
                  ].map(([t, d]) => (
                    <div key={t} className="flex items-start gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0" style={{ color: VS.teal }} />
                      <div>
                        <span className="text-[12px] font-medium" style={{ color: VS.text1 }}>{t}</span>
                        <span className="text-[11px] ml-1.5" style={{ color: VS.text2 }}>{d}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── RIGHT: Processed tasks ── */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {processedTasks.length > 0 ? (
                <>
                  {/* Tasks header */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-[13px] font-bold" style={{ color: VS.text0 }}>Review & Import</h3>
                      <p className="text-[11px] mt-0.5" style={{ color: VS.text2 }}>
                        {processedTasks.length} tasks found · {selectedTasks.size} selected
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={toggleSelectAll}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] transition-colors"
                        style={{ background: VS.bg3, border: `1px solid ${VS.border}`, color: VS.text1 }}
                      >
                        {selectedTasks.size === processedTasks.length
                          ? <CheckSquare className="h-3.5 w-3.5" />
                          : <Square className="h-3.5 w-3.5" />
                        }
                        {selectedTasks.size === processedTasks.length ? 'Deselect All' : 'Select All'}
                      </button>
                      <button
                        onClick={handleSaveTasks}
                        disabled={isSaving || selectedTasks.size === 0}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white transition-all hover:opacity-90 disabled:opacity-40"
                        style={{ background: 'linear-gradient(135deg,#4ec9b0,#007acc)' }}
                      >
                        {isSaving
                          ? <><Sparkles className="h-3.5 w-3.5 animate-spin" /> Importing…</>
                          : <><Plus className="h-3.5 w-3.5" /> Import ({selectedTasks.size})</>
                        }
                      </button>
                    </div>
                  </div>

                  {/* Task cards */}
                  <div className="space-y-3">
                    {processedTasks.map((task, index) => {
                      const pStyle = getPriorityStyle(task.priority);
                      const isSelected = selectedTasks.has(task.id);
                      const isEditing = editingTask === task.id;

                      return (
                        <div
                          key={task.id || index}
                          className="rounded-xl p-4 transition-all"
                          style={{
                            background: VS.bg2,
                            border: `1px solid ${isSelected ? pStyle.borderColor : VS.border}`,
                            opacity: isSelected ? 1 : 0.55,
                          }}
                        >
                          <div className="flex items-start gap-3">
                            {/* Checkbox */}
                            <button
                              onClick={() => toggleTaskSelection(task.id)}
                              className="mt-0.5 shrink-0 h-5 w-5 rounded flex items-center justify-center transition-all"
                              style={{
                                background: isSelected ? `${pStyle.color}22` : VS.bg3,
                                border: `1px solid ${isSelected ? pStyle.color + '88' : VS.border}`,
                                color: pStyle.color,
                              }}
                            >
                              {isSelected
                                ? <Check className="h-3 w-3" style={{ strokeWidth: 3 }} />
                                : null
                              }
                            </button>

                            <div className="flex-1 min-w-0">
                              {/* Priority + meta row */}
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <span
                                  className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
                                  style={{ background: pStyle.bgColor, color: pStyle.color, border: `1px solid ${pStyle.borderColor}` }}
                                >
                                  {task.priority}
                                </span>
                                {task.suggestedDay && (
                                  <span
                                    className="text-[10px] px-2 py-0.5 rounded-full"
                                    style={{ background: `${VS.blue}18`, color: VS.blue }}
                                  >
                                    {task.suggestedDay}
                                  </span>
                                )}
                                <span className="ml-auto flex items-center gap-1 text-[11px]" style={{ color: VS.text2 }}>
                                  <Clock className="h-3 w-3" /> {task.estimatedHours}h
                                </span>
                              </div>

                              {/* Title / edit */}
                              {isEditing ? (
                                <div className="space-y-2">
                                  <input
                                    type="text"
                                    value={task.title}
                                    onChange={e => updateTaskField(task.id, 'title', e.target.value)}
                                    className={inputCls}
                                    style={{ ...inputStyle, fontWeight: 600 }}
                                    autoFocus
                                  />
                                  <textarea
                                    value={task.description}
                                    onChange={e => updateTaskField(task.id, 'description', e.target.value)}
                                    className={inputCls + ' resize-none'}
                                    style={{ ...inputStyle, fontSize: 12 }}
                                    rows={2}
                                  />
                                  <div className="flex items-center gap-2">
                                    <select
                                      value={task.priority}
                                      onChange={e => updateTaskField(task.id, 'priority', e.target.value)}
                                      className={inputCls}
                                      style={{ ...inputStyle, fontSize: 12 }}
                                    >
                                      {['Low','Medium','High','Urgent'].map(p => <option key={p}>{p}</option>)}
                                    </select>
                                    <input
                                      type="number"
                                      value={task.estimatedHours}
                                      onChange={e => updateTaskField(task.id, 'estimatedHours', parseFloat(e.target.value) || 0)}
                                      className={inputCls}
                                      style={{ ...inputStyle, width: 80, fontSize: 12 }}
                                      step="0.5" min="0"
                                    />
                                    <span className="text-[11px]" style={{ color: VS.text2 }}>hrs</span>
                                  </div>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => setEditingTask(null)}
                                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white"
                                      style={{ background: 'linear-gradient(135deg,#4ec9b0,#007acc)' }}
                                    >
                                      <Check className="h-3 w-3" /> Save
                                    </button>
                                    <button
                                      onClick={() => setEditingTask(null)}
                                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px]"
                                      style={{ background: VS.bg3, border: `1px solid ${VS.border}`, color: VS.text1 }}
                                    >
                                      <X className="h-3 w-3" /> Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[13px] font-bold leading-snug" style={{ color: VS.text0 }}>{task.title}</p>
                                    <p className="text-[12px] mt-0.5 line-clamp-2 leading-relaxed" style={{ color: VS.text2 }}>{task.description}</p>
                                  </div>
                                  <button
                                    onClick={() => setEditingTask(task.id)}
                                    className="shrink-0 h-6 w-6 rounded-lg flex items-center justify-center transition-colors hover:bg-white/5"
                                    style={{ color: VS.text2 }}
                                  >
                                    <Edit3 className="h-3 w-3" />
                                  </button>
                                </div>
                              )}

                              {/* Optimal time slot */}
                              {!isEditing && task.optimalTimeSlot && (
                                <div
                                  className="mt-2 px-3 py-2 rounded-lg flex items-center justify-between"
                                  style={{ background: `${VS.accent}12`, border: `1px solid ${VS.accent}30` }}
                                >
                                  <div className="flex items-center gap-1.5 text-[11px]">
                                    <Clock className="h-3 w-3" style={{ color: VS.accent }} />
                                    <span style={{ color: VS.accent }}>Optimal:</span>
                                    <span style={{ color: VS.text1 }}>{task.optimalTimeSlot}</span>
                                  </div>
                                  {task.energyLevel && (
                                    <span
                                      className="text-[10px] px-2 py-0.5 rounded-full"
                                      style={{
                                        background: task.energyLevel === 'High' ? `${VS.teal}18` : task.energyLevel === 'Medium' ? `${VS.yellow}18` : `${VS.blue}18`,
                                        color: task.energyLevel === 'High' ? VS.teal : task.energyLevel === 'Medium' ? VS.yellow : VS.blue,
                                      }}
                                    >
                                      {task.energyLevel} Energy
                                    </span>
                                  )}
                                </div>
                              )}

                              {/* Micro tasks */}
                              {!isEditing && task.microTasks.length > 0 && (
                                <div className="mt-2 space-y-1">
                                  <p className="text-[10px] uppercase tracking-wider flex items-center gap-1" style={{ color: VS.text2 }}>
                                    <Target className="h-3 w-3" /> Breakdown ({task.microTasks.length} steps)
                                  </p>
                                  {task.microTasks.map((mt, i) => (
                                    <div key={i} className="flex items-center gap-2 text-[11px]" style={{ color: VS.text1 }}>
                                      <CheckCircle2 className="h-3 w-3 shrink-0" style={{ color: VS.border2 }} />
                                      {mt}
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Tags */}
                              {!isEditing && task.tags.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1">
                                  {task.tags.map((tag, i) => (
                                    <span
                                      key={i}
                                      className="text-[10px] px-2 py-0.5 rounded-full"
                                      style={{ background: `${VS.accent}14`, color: VS.accent }}
                                    >
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              )}

                              {/* Category */}
                              {!isEditing && (
                                <div className="mt-2 pt-2" style={{ borderTop: `1px solid ${VS.border}` }}>
                                  <span className="text-[10px] px-2 py-0.5 rounded" style={{ background: VS.bg3, color: VS.text2, border: `1px solid ${VS.border}` }}>
                                    {task.category}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Daily Schedule */}
                  {dailySchedule && (
                    <div
                      className="rounded-xl p-4 space-y-3"
                      style={{ background: VS.bg2, border: `1px solid ${VS.border}` }}
                    >
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" style={{ color: VS.blue }} />
                        <h4 className="text-[13px] font-bold" style={{ color: VS.text0 }}>Daily Schedule</h4>
                        <span
                          className="ml-auto text-[11px] px-2 py-0.5 rounded-full"
                          style={{
                            background: dailySchedule.workloadAssessment === 'Optimal' ? `${VS.teal}18` : dailySchedule.workloadAssessment === 'Heavy' ? `${VS.yellow}18` : `${VS.blue}18`,
                            color: dailySchedule.workloadAssessment === 'Optimal' ? VS.teal : dailySchedule.workloadAssessment === 'Heavy' ? VS.yellow : VS.blue,
                          }}
                        >
                          {dailySchedule.workloadAssessment} · {dailySchedule.totalEstimatedHours}h
                        </span>
                      </div>
                      <div className="space-y-2">
                        {dailySchedule.timeBlocks.map((block, i) => {
                          const task = processedTasks.find(t => t.id === block.taskId);
                          const pStyle = getPriorityStyle(task?.priority || 'Medium');
                          return (
                            <div
                              key={i}
                              className="flex items-start gap-3 px-3 py-2.5 rounded-lg"
                              style={{ background: VS.bg3, border: `1px solid ${VS.border}` }}
                            >
                              <span className="text-[11px] font-mono whitespace-nowrap mt-0.5" style={{ color: VS.accent }}>{block.time}</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-[12px] font-semibold truncate" style={{ color: VS.text0 }}>{task?.title || 'Task'}</p>
                                <p className="text-[11px] mt-0.5" style={{ color: VS.text2 }}>{block.rationale}</p>
                              </div>
                              <span
                                className="text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap"
                                style={{ background: pStyle.bgColor, color: pStyle.color }}
                              >
                                {task?.priority}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                /* Empty state */
                <div className="flex flex-col items-center justify-center h-full py-16 text-center">
                  <div
                    className="h-16 w-16 rounded-2xl flex items-center justify-center mb-4"
                    style={{ background: `${VS.accent}14`, border: `1px solid ${VS.accent}30` }}
                  >
                    <AlertCircle className="h-8 w-8" style={{ color: VS.accent }} />
                  </div>
                  <p className="text-[13px] font-semibold" style={{ color: VS.text1 }}>No tasks extracted yet</p>
                  <p className="text-[12px] mt-1.5 max-w-xs leading-relaxed" style={{ color: VS.text2 }}>
                    Type or speak your thoughts on the left, then click "Organize with AI" to extract tasks.
                  </p>
                </div>
              )}
            </div>
        </div>
      </div>
    </div>
  );
}
