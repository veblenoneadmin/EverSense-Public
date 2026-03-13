import { useState, useRef, useEffect } from 'react';
// import { useNavigate } from 'react-router-dom';
import { useSession } from '../lib/auth-client';
import { useOrganization } from '../contexts/OrganizationContext';
import { WhisperRecorder, transcribeWithWhisper } from '../utils/whisperApi';
import {
  Brain,
  Mic,
  MicOff,
  Zap,
  Save,
  Sparkles,
  Clock,
  Target,
  AlertCircle,
  CheckCircle2,
  Plus,
  Edit3,
  Check,
  X,
  Square,
  CheckSquare,
  Settings,
  Sun,
  Moon,
  Sunset
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
  timeBlocks: {
    time: string;
    taskId: string;
    rationale: string;
  }[];
}

const inputStyle: React.CSSProperties = {
  background: VS.bg3,
  border: `1px solid ${VS.border}`,
  borderRadius: 4,
  color: VS.text0,
  padding: '6px 10px',
  fontSize: 13,
  outline: 'none',
  width: '100%',
};

const getPriorityColors = (priority: string) => {
  switch (priority) {
    case 'Urgent':
    case 'High': return { color: VS.red, bg: `${VS.red}18`, border: `${VS.red}40` };
    case 'Medium': return { color: VS.yellow, bg: `${VS.yellow}18`, border: `${VS.yellow}40` };
    case 'Low': return { color: VS.blue, bg: `${VS.blue}18`, border: `${VS.blue}40` };
    default: return { color: VS.text2, bg: `${VS.bg3}`, border: VS.border };
  }
};

export function BrainDump() {
  // const navigate = useNavigate();
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
  const { data: session } = useSession();
  const { currentOrg } = useOrganization();
  console.log('Session:', session); // Keep session for future use

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [content]);

  // Auto-save functionality
  useEffect(() => {
    if (content.trim()) {
      const timer = setTimeout(() => {
        setLastSaved(new Date());
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [content]);

  // Initialize speech recognition systems
  useEffect(() => {
    const recorder = new WhisperRecorder();
    setWhisperRecorder(recorder);

    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();

      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      let finalTranscript = '';

      recognition.onresult = (event: any) => {
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        if (finalTranscript) {
          setContent(prev => {
            const newContent = prev + (prev.endsWith(' ') || !prev ? '' : ' ') + finalTranscript;
            finalTranscript = '';
            return newContent;
          });
        }
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setError('Voice recognition error. Please try again.');
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      setRecognition(recognition);
    }
  }, []);

  const scheduleTemplates: Record<string, WorkSchedule> = {
    traditional: {
      type: 'traditional',
      startTime: '9:00 AM',
      endTime: '5:00 PM',
      peakHours: ['9:00 AM - 11:00 AM', '2:00 PM - 4:00 PM'],
      breakTime: '12:00 PM - 1:00 PM'
    },
    night: {
      type: 'night',
      startTime: '9:00 PM',
      endTime: '5:00 AM',
      peakHours: ['10:00 PM - 12:00 AM', '2:00 AM - 4:00 AM'],
      breakTime: '12:30 AM - 1:30 AM'
    },
    evening: {
      type: 'evening',
      startTime: '2:00 PM',
      endTime: '10:00 PM',
      peakHours: ['3:00 PM - 5:00 PM', '7:00 PM - 9:00 PM'],
      breakTime: '5:30 PM - 6:30 PM'
    },
    early: {
      type: 'early',
      startTime: '5:00 AM',
      endTime: '1:00 PM',
      peakHours: ['6:00 AM - 8:00 AM', '10:00 AM - 12:00 PM'],
      breakTime: '8:30 AM - 9:30 AM'
    }
  };

  useEffect(() => {
    const savedSchedule = localStorage.getItem('workSchedule');
    if (savedSchedule) {
      try {
        setWorkSchedule(JSON.parse(savedSchedule));
      } catch (error) {
        console.error('Failed to load work schedule:', error);
        setWorkSchedule(scheduleTemplates.traditional);
      }
    } else {
      setWorkSchedule(scheduleTemplates.traditional);
    }
  }, []);

  const saveWorkSchedule = (schedule: WorkSchedule) => {
    setWorkSchedule(schedule);
    localStorage.setItem('workSchedule', JSON.stringify(schedule));
  };

  const getScheduleIcon = (type: string) => {
    switch (type) {
      case 'traditional': return Sun;
      case 'night': return Moon;
      case 'evening': return Sunset;
      case 'early': return Sun;
      default: return Clock;
    }
  };

  const getScheduleDisplayName = (schedule: WorkSchedule) => {
    const typeNames = {
      traditional: 'Traditional (9 AM - 5 PM)',
      night: 'Night Shift (9 PM - 5 AM)',
      evening: 'Evening (2 PM - 10 PM)',
      early: 'Early Bird (5 AM - 1 PM)',
      custom: `Custom (${schedule.startTime} - ${schedule.endTime})`
    };
    return typeNames[schedule.type] || 'Custom Schedule';
  };

  const handleVoiceToggle = async () => {
    if (isRecording) {
      await stopRecording();
    } else {
      await startRecording();
    }
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
    } catch (error) {
      console.error('Failed to start recording:', error);
      setError('Failed to start voice recording. Please check microphone permissions.');
      setIsRecording(false);

      if (useWhisper && recognition) {
        setUseWhisper(false);
        try {
          recognition.start();
          setIsRecording(true);
        } catch (fallbackError) {
          console.error('Fallback recording failed:', fallbackError);
        }
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
            onFallback: () => {
              setUseWhisper(false);
              setError('Whisper unavailable, switched to browser recognition');
            }
          });

          setContent(prev => {
            const newContent = prev + (prev.endsWith(' ') || !prev ? '' : ' ') + result.transcription;
            return newContent;
          });

          setError('');
        } catch (transcribeError) {
          console.warn('Whisper transcription failed:', transcribeError);
          setError('Transcription failed. Please try again or switch to browser recognition.');
        }
      } else if (recognition) {
        recognition.stop();
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
      setError('Failed to stop recording.');
    } finally {
      setIsRecording(false);
    }
  };

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
            workingHours: {
              start: workSchedule?.startTime || '9:00 AM',
              end: workSchedule?.endTime || '5:00 PM'
            },
            focusHours: workSchedule?.peakHours || ['9:00 AM - 11:00 AM', '2:00 PM - 4:00 PM'],
            breakInterval: 90,
            maxTasksPerDay: 6,
            prioritizeUrgent: true,
            scheduleType: workSchedule?.type || 'traditional',
            breakTime: workSchedule?.breakTime,
            timezone: workSchedule?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
          }
        }),
      });

      if (!response.ok) throw new Error('Failed to process brain dump');

      const data = await response.json();
      const tasks = data.extractedTasks || [];
      const schedule = data.dailySchedule || null;

      const formattedTasks: ProcessedTask[] = tasks.map((task: any) => ({
        id: task.id,
        title: task.title,
        description: task.description,
        priority: task.priority,
        estimatedHours: task.estimatedHours,
        category: task.category,
        tags: task.tags || [],
        microTasks: task.microTasks || [],
        optimalTimeSlot: task.optimalTimeSlot,
        energyLevel: task.energyLevel,
        focusType: task.focusType,
        suggestedDay: task.suggestedDay
      }));

      setProcessedTasks(formattedTasks);
      setDailySchedule(schedule);
      setSelectedTasks(new Set(formattedTasks.map(task => task.id)));

      if (formattedTasks.length > 0) {
        setError('');
      } else {
        setError('No tasks could be extracted from your input. Try being more specific about what needs to be done.');
      }

    } catch (error) {
      console.error('Brain dump processing failed:', error);
      setError('Processing failed. Please try again.');
      setProcessedTasks([]);
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleTaskSelection = (taskId: string) => {
    setSelectedTasks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedTasks.size === processedTasks.length) {
      setSelectedTasks(new Set());
    } else {
      setSelectedTasks(new Set(processedTasks.map(task => task.id)));
    }
  };

  const updateTaskField = (taskId: string, field: keyof ProcessedTask, value: any) => {
    setProcessedTasks(prev => prev.map(task =>
      task.id === taskId ? { ...task, [field]: value } : task
    ));
  };

  const startEditing = (taskId: string) => setEditingTask(taskId);
  const stopEditing = () => setEditingTask(null);

  const handleSaveTasks = async () => {
    const selectedTasksList = processedTasks.filter(task => selectedTasks.has(task.id));
    if (!selectedTasksList.length || !session?.user?.id || !currentOrg?.id) {
      setError('Please select at least one task to import.');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      const response = await fetch('/api/brain-dump/save-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          extractedTasks: selectedTasksList,
          dailySchedule: dailySchedule,
          userId: session.user.id,
          orgId: currentOrg.id,
          originalContent: content
        }),
      });

      if (!response.ok) throw new Error('Failed to save tasks');

      await response.json();

      setLastSaved(new Date());
      setError(`Successfully imported ${selectedTasksList.length} tasks to your active task list!`);

      setTimeout(() => {
        setProcessedTasks([]);
        setSelectedTasks(new Set());
        setDailySchedule(null);
        setError('');
      }, 3000);

    } catch (error) {
      console.error('Save tasks failed:', error);
      setError('Failed to save tasks. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{ color: VS.text0, fontFamily: 'inherit' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: VS.text0, margin: 0 }}>Brain Dump</h1>
          <p style={{ color: VS.text2, marginTop: 4, fontSize: 13 }}>Transform your thoughts into organized, actionable tasks</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {workSchedule && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: VS.text2 }}>
                {(() => { const Icon = getScheduleIcon(workSchedule.type); return <Icon size={14} />; })()}
                <span>{getScheduleDisplayName(workSchedule)}</span>
              </div>
              <button
                onClick={() => setShowScheduleSettings(!showScheduleSettings)}
                style={{ background: VS.bg3, border: `1px solid ${VS.border}`, borderRadius: 4, color: VS.text1, padding: '3px 6px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              >
                <Settings size={12} />
              </button>
            </div>
          )}
          {lastSaved && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: VS.text2 }}>
              <Save size={13} />
              <span>Saved {lastSaved.toLocaleTimeString()}</span>
            </div>
          )}
        </div>
      </div>

      {/* Schedule Settings Panel */}
      {showScheduleSettings && (
        <div style={{ background: VS.bg1, border: `1px solid ${VS.border}`, borderRadius: 6, padding: 20, marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ width: 36, height: 36, borderRadius: 6, background: VS.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Settings size={18} color="#fff" />
            </div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: VS.text0, margin: 0 }}>Work Schedule Preferences</h2>
              <p style={{ fontSize: 12, color: VS.text2, margin: 0 }}>Configure your work hours for personalized task scheduling</p>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            {Object.entries(scheduleTemplates).map(([key, template]) => {
              const Icon = getScheduleIcon(template.type);
              const isSelected = workSchedule?.type === template.type;
              return (
                <button
                  key={key}
                  onClick={() => saveWorkSchedule(template)}
                  style={{
                    background: isSelected ? `${VS.accent}22` : VS.bg2,
                    border: `1px solid ${isSelected ? VS.accent : VS.border}`,
                    borderRadius: 6,
                    color: isSelected ? VS.accent : VS.text1,
                    padding: '12px 10px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 12,
                  }}
                >
                  <Icon size={20} />
                  <div style={{ fontWeight: 600 }}>{getScheduleDisplayName(template).split('(')[0].trim()}</div>
                  <div style={{ opacity: 0.75 }}>{template.startTime} - {template.endTime}</div>
                  <div style={{ opacity: 0.6, fontSize: 11 }}>Peak: {template.peakHours[0]}</div>
                </button>
              );
            })}
          </div>
          {workSchedule && (
            <div style={{ marginTop: 16, padding: 14, background: VS.bg2, borderRadius: 6 }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: VS.text0, marginBottom: 10 }}>Current Schedule Details</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, fontSize: 12 }}>
                <div><span style={{ color: VS.text2 }}>Work Hours:</span><div style={{ fontWeight: 600, marginTop: 2 }}>{workSchedule.startTime} - {workSchedule.endTime}</div></div>
                <div><span style={{ color: VS.text2 }}>Peak Focus:</span><div style={{ fontWeight: 600, marginTop: 2 }}>{workSchedule.peakHours.join(', ')}</div></div>
                <div><span style={{ color: VS.text2 }}>Break Time:</span><div style={{ fontWeight: 600, marginTop: 2 }}>{workSchedule.breakTime || 'Flexible'}</div></div>
              </div>
              <div style={{ marginTop: 12, padding: '8px 12px', background: `${VS.blue}12`, border: `1px solid ${VS.blue}30`, borderRadius: 4, fontSize: 12, color: VS.blue }}>
                <strong>AI Scheduling:</strong> Tasks will be optimized for your {getScheduleDisplayName(workSchedule).toLowerCase()} with peak focus periods during {workSchedule.peakHours.join(' and ')}.
              </div>
            </div>
          )}
          <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={() => setShowScheduleSettings(false)}
              style={{ background: VS.bg3, border: `1px solid ${VS.border}`, borderRadius: 4, color: VS.text1, padding: '6px 14px', cursor: 'pointer', fontSize: 13 }}
            >
              Close Settings
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Left: Brain Dump Input */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Input Card */}
          <div style={{ background: VS.bg1, border: `1px solid ${VS.border}`, borderRadius: 6, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 6, background: VS.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Brain size={18} color="#fff" />
                </div>
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 600, color: VS.text0, margin: 0 }}>Daily Thoughts</h2>
                  <p style={{ fontSize: 12, color: VS.text2, margin: 0 }}>Dump everything on your mind</p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={handleVoiceToggle}
                  style={{
                    background: isRecording ? `${VS.red}20` : VS.bg3,
                    border: `1px solid ${isRecording ? VS.red : VS.border}`,
                    borderRadius: 4,
                    color: isRecording ? VS.red : VS.text1,
                    padding: '5px 12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 13,
                  }}
                >
                  {isRecording ? <MicOff size={14} /> : <Mic size={14} />}
                  {isRecording ? 'Stop' : 'Voice'}
                </button>
                {useWhisper && (
                  <span style={{ fontSize: 11, color: VS.teal, background: `${VS.teal}15`, padding: '3px 8px', borderRadius: 4 }}>
                    GPT-4o Whisper
                  </span>
                )}
              </div>
            </div>

            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={`Start typing or speaking your thoughts...

The AI will create optimal daily schedules by:
• Analyzing task complexity and priority
• Scheduling high-focus work during peak energy hours
• Grouping similar tasks to reduce context switching
• Creating realistic time blocks with proper buffers
• Automatically adding tasks and events to your calendar

Examples:
• Need to finish the quarterly reports by Friday - complex analysis work
• Call John about the marketing campaign - urgent follow-up needed
• Review the budget proposal from finance team - detailed review required
• Schedule team meeting for project planning - coordination needed
• Research new CRM tools for better productivity - exploration task`}
              style={{
                width: '100%',
                minHeight: 300,
                background: VS.bg2,
                border: `1px solid ${VS.border}`,
                borderRadius: 4,
                color: VS.text0,
                padding: 14,
                fontSize: 13,
                resize: 'none',
                outline: 'none',
                fontFamily: 'inherit',
                lineHeight: 1.6,
                boxSizing: 'border-box',
              }}
            />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
              <span style={{ fontSize: 12, color: VS.text2 }}>
                {content.length} characters • {content.split(' ').filter(w => w.length > 0).length} words
              </span>
              <button
                onClick={handleProcessDump}
                disabled={!content.trim() || isProcessing}
                style={{
                  background: (!content.trim() || isProcessing) ? VS.bg3 : VS.accent,
                  border: 'none',
                  borderRadius: 4,
                  color: (!content.trim() || isProcessing) ? VS.text2 : '#fff',
                  padding: '7px 16px',
                  cursor: (!content.trim() || isProcessing) ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {isProcessing ? (
                  <><Sparkles size={14} style={{ animation: 'spin 1s linear infinite' }} />Processing with AI...</>
                ) : (
                  <><Zap size={14} />Organize with AI</>
                )}
              </button>
            </div>

            {error && (
              <div style={{
                marginTop: 12,
                padding: '10px 14px',
                background: error.startsWith('Successfully') ? `${VS.teal}15` : `${VS.red}15`,
                border: `1px solid ${error.startsWith('Successfully') ? VS.teal : VS.red}40`,
                borderRadius: 4,
                color: error.startsWith('Successfully') ? VS.teal : VS.red,
                fontSize: 13,
              }}>
                {error}
              </div>
            )}
          </div>

          {/* AI Processing Status */}
          {isProcessing && (
            <div style={{ background: VS.bg1, border: `1px solid ${VS.border}`, borderRadius: 6, padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 44, height: 44, borderRadius: 8, background: VS.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Sparkles size={22} color="#fff" style={{ animation: 'spin 1s linear infinite' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: VS.text0 }}>AI is analyzing your thoughts...</div>
                  <div style={{ fontSize: 13, color: VS.text2, marginTop: 4 }}>Extracting tasks, estimating time, and organizing priorities</div>
                  <div style={{ width: 240, height: 4, background: VS.bg3, borderRadius: 2, marginTop: 10 }}>
                    <div style={{ height: '100%', width: '75%', background: VS.accent, borderRadius: 2 }} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Processed Tasks */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {processedTasks.length > 0 && (
            <div style={{ background: VS.bg1, border: `1px solid ${VS.border}`, borderRadius: 6, padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 6, background: VS.teal, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CheckCircle2 size={18} color="#fff" />
                  </div>
                  <div>
                    <h2 style={{ fontSize: 16, fontWeight: 600, color: VS.text0, margin: 0 }}>Review & Import Tasks</h2>
                    <p style={{ fontSize: 12, color: VS.text2, margin: 0 }}>{processedTasks.length} tasks found • {selectedTasks.size} selected</p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    onClick={toggleSelectAll}
                    style={{ background: VS.bg3, border: `1px solid ${VS.border}`, borderRadius: 4, color: VS.text1, padding: '5px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
                  >
                    {selectedTasks.size === processedTasks.length ? <CheckSquare size={14} /> : <Square size={14} />}
                    {selectedTasks.size === processedTasks.length ? 'Deselect All' : 'Select All'}
                  </button>
                  <button
                    onClick={handleSaveTasks}
                    disabled={isSaving || selectedTasks.size === 0}
                    style={{
                      background: (isSaving || selectedTasks.size === 0) ? VS.bg3 : VS.teal,
                      border: 'none',
                      borderRadius: 4,
                      color: (isSaving || selectedTasks.size === 0) ? VS.text2 : '#fff',
                      padding: '5px 12px',
                      cursor: (isSaving || selectedTasks.size === 0) ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    {isSaving ? (
                      <><Sparkles size={13} />Importing...</>
                    ) : (
                      <><Plus size={13} />Import Selected ({selectedTasks.size})</>
                    )}
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {processedTasks.map((task, index) => {
                  const pc = getPriorityColors(task.priority);
                  const isSelected = selectedTasks.has(task.id);
                  return (
                    <div
                      key={task.id || index}
                      style={{
                        padding: 14,
                        borderRadius: 6,
                        background: pc.bg,
                        border: `1px solid ${isSelected ? pc.border : VS.border}`,
                        opacity: isSelected ? 1 : 0.6,
                        transition: 'all 0.15s',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                        <button
                          onClick={() => toggleTaskSelection(task.id)}
                          style={{ background: 'none', border: `1px solid ${VS.border}`, borderRadius: 3, color: VS.text1, padding: 3, cursor: 'pointer', flexShrink: 0 }}
                        >
                          {isSelected ? <CheckSquare size={14} /> : <Square size={14} />}
                        </button>

                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <AlertCircle size={13} color={pc.color} />
                            <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: pc.color }}>{task.priority} Priority</span>
                            {task.suggestedDay && (
                              <span style={{ fontSize: 11, background: `${VS.blue}15`, color: VS.blue, padding: '2px 8px', borderRadius: 4 }}>{task.suggestedDay}</span>
                            )}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto', fontSize: 12, color: VS.text2 }}>
                              <Clock size={12} /><span>{task.estimatedHours}h</span>
                            </div>
                          </div>

                          {editingTask === task.id ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              <input
                                type="text"
                                value={task.title}
                                onChange={(e) => updateTaskField(task.id, 'title', e.target.value)}
                                style={{ ...inputStyle, fontWeight: 600 }}
                                autoFocus
                              />
                              <textarea
                                value={task.description}
                                onChange={(e) => updateTaskField(task.id, 'description', e.target.value)}
                                style={{ ...inputStyle, resize: 'none', minHeight: 56 }}
                                rows={2}
                              />
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <select
                                  value={task.priority}
                                  onChange={(e) => updateTaskField(task.id, 'priority', e.target.value)}
                                  style={{ ...inputStyle, width: 'auto' }}
                                >
                                  <option value="Low">Low</option>
                                  <option value="Medium">Medium</option>
                                  <option value="High">High</option>
                                  <option value="Urgent">Urgent</option>
                                </select>
                                <input
                                  type="number"
                                  value={task.estimatedHours}
                                  onChange={(e) => updateTaskField(task.id, 'estimatedHours', parseFloat(e.target.value) || 0)}
                                  style={{ ...inputStyle, width: 70 }}
                                  step="0.5"
                                  min="0"
                                />
                                <span style={{ fontSize: 12, color: VS.text2 }}>hours</span>
                              </div>
                              <div style={{ display: 'flex', gap: 8 }}>
                                <button
                                  onClick={stopEditing}
                                  style={{ background: VS.teal, border: 'none', borderRadius: 4, color: '#fff', padding: '5px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}
                                >
                                  <Check size={13} />Save
                                </button>
                                <button
                                  onClick={stopEditing}
                                  style={{ background: VS.bg3, border: `1px solid ${VS.border}`, borderRadius: 4, color: VS.text1, padding: '5px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}
                                >
                                  <X size={13} />Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                                <div style={{ flex: 1 }}>
                                  <h3 style={{ fontWeight: 600, color: VS.text0, margin: 0, fontSize: 14 }}>{task.title}</h3>
                                  <p style={{ fontSize: 12, color: VS.text2, marginTop: 4 }}>{task.description}</p>
                                </div>
                                <button
                                  onClick={() => startEditing(task.id)}
                                  style={{ background: VS.bg3, border: `1px solid ${VS.border}`, borderRadius: 4, color: VS.text1, padding: '3px 7px', cursor: 'pointer', marginLeft: 8, flexShrink: 0 }}
                                >
                                  <Edit3 size={13} />
                                </button>
                              </div>
                            </div>
                          )}

                          {task.optimalTimeSlot && (
                            <div style={{ marginTop: 10, padding: '8px 10px', background: `${VS.accent}12`, border: `1px solid ${VS.accent}30`, borderRadius: 4 }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <Clock size={12} color={VS.accent} />
                                  <span style={{ fontWeight: 600, color: VS.accent }}>Optimal Time:</span>
                                  <span style={{ color: VS.text0 }}>{task.optimalTimeSlot}</span>
                                </div>
                                {task.energyLevel && (
                                  <span style={{
                                    fontSize: 11,
                                    padding: '2px 8px',
                                    borderRadius: 4,
                                    background: task.energyLevel === 'High' ? `${VS.teal}15` : task.energyLevel === 'Medium' ? `${VS.yellow}15` : `${VS.blue}15`,
                                    color: task.energyLevel === 'High' ? VS.teal : task.energyLevel === 'Medium' ? VS.yellow : VS.blue,
                                  }}>
                                    {task.energyLevel} Energy
                                  </span>
                                )}
                              </div>
                              {task.focusType && (
                                <p style={{ fontSize: 11, color: VS.text2, marginTop: 4 }}>Best for: {task.focusType}</p>
                              )}
                            </div>
                          )}

                          {task.microTasks && task.microTasks.length > 0 && (
                            <div style={{ marginTop: 10 }}>
                              <h4 style={{ fontSize: 12, fontWeight: 600, color: VS.text0, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                                <Target size={12} />Breakdown ({task.microTasks.length} steps)
                              </h4>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                {task.microTasks.map((microTask, mi) => (
                                  <div key={mi} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', background: VS.bg2, borderRadius: 4 }}>
                                    <CheckCircle2 size={11} color={VS.text2} />
                                    <span style={{ fontSize: 12, color: VS.text0 }}>{microTask}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {task.tags && task.tags.length > 0 && (
                            <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                              {task.tags.map((tag, ti) => (
                                <span key={ti} style={{ fontSize: 11, background: `${VS.accent}15`, color: VS.accent, padding: '2px 8px', borderRadius: 12 }}>{tag}</span>
                              ))}
                            </div>
                          )}

                          <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${VS.border}` }}>
                            <span style={{ fontSize: 11, color: VS.text2, background: VS.bg2, padding: '2px 8px', borderRadius: 4 }}>{task.category}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Daily Schedule Summary */}
          {dailySchedule && processedTasks.length > 0 && (
            <div style={{ background: VS.bg1, border: `1px solid ${VS.border}`, borderRadius: 6, padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{ width: 36, height: 36, borderRadius: 6, background: VS.blue, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Clock size={18} color="#fff" />
                </div>
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 600, color: VS.text0, margin: 0 }}>Daily Schedule</h2>
                  <p style={{ fontSize: 12, color: VS.text2, margin: 0 }}>AI-optimized time blocks</p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div style={{ padding: 12, background: VS.bg2, borderRadius: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <Clock size={13} color={VS.accent} />
                    <span style={{ fontSize: 12, fontWeight: 600 }}>Total Time</span>
                  </div>
                  <p style={{ fontSize: 20, fontWeight: 700, color: VS.text0 }}>{dailySchedule.totalEstimatedHours}h</p>
                </div>
                <div style={{ padding: 12, background: VS.bg2, borderRadius: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <Target size={13} color={VS.accent} />
                    <span style={{ fontSize: 12, fontWeight: 600 }}>Workload</span>
                  </div>
                  <p style={{ fontSize: 20, fontWeight: 700, color: dailySchedule.workloadAssessment === 'Optimal' ? VS.teal : dailySchedule.workloadAssessment === 'Heavy' ? VS.yellow : VS.blue }}>
                    {dailySchedule.workloadAssessment}
                  </p>
                </div>
              </div>

              <div>
                <h4 style={{ fontSize: 13, fontWeight: 600, color: VS.text0, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Clock size={13} />Recommended Schedule
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {dailySchedule.timeBlocks.map((block, bi) => {
                    const task = processedTasks.find(t => t.id === block.taskId);
                    const pc = getPriorityColors(task?.priority || 'Low');
                    return (
                      <div key={bi} style={{ padding: '10px 14px', background: VS.bg2, borderRadius: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontWeight: 600, color: VS.accent, fontSize: 13 }}>{block.time}</span>
                          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: pc.bg, color: pc.color }}>{task?.priority} Priority</span>
                        </div>
                        <p style={{ fontWeight: 600, color: VS.text0, fontSize: 13, margin: 0 }}>{task?.title || 'Task'}</p>
                        <p style={{ fontSize: 11, color: VS.text2, marginTop: 4 }}>{block.rationale}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Tips Card */}
          {processedTasks.length === 0 && !isProcessing && (
            <div style={{ background: VS.bg1, border: `1px solid ${VS.border}`, borderRadius: 6, padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{ width: 36, height: 36, borderRadius: 6, background: VS.purple, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Sparkles size={18} color="#fff" />
                </div>
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 600, color: VS.text0, margin: 0 }}>AI Tips</h2>
                  <p style={{ fontSize: 12, color: VS.text2, margin: 0 }}>Get better results</p>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { title: 'Be Specific', desc: 'Include deadlines, context, and any constraints' },
                  { title: 'Include All Details', desc: 'Mention projects, clients, and priority levels' },
                  { title: 'Think Out Loud', desc: 'Include your thoughts, concerns, and ideas' },
                ].map((tip, i) => (
                  <div key={i} style={{ padding: '10px 14px', background: VS.bg2, borderRadius: 6 }}>
                    <h3 style={{ fontWeight: 600, fontSize: 13, color: VS.text0, margin: 0 }}>{tip.title}</h3>
                    <p style={{ fontSize: 12, color: VS.text2, marginTop: 4 }}>{tip.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
