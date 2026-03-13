import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { sanitizeInput } from '@/lib/security';
import { globalRateLimiter } from '@/lib/rate-limiter';
import { useBrainDumps, useCreateBrainDump } from '@/hooks/useDatabase';
import { useCalendarIntegration } from '@/hooks/useCalendarIntegration';
import { extractTimesFromText } from '@/utils/timeExtraction';
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
  CheckCircle2
} from 'lucide-react';
import BrainDumpList from './BrainDumpList';

const BrainDumpInterface: React.FC = () => {
  const navigate = useNavigate();
  const [content, setContent] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedTasks, setProcessedTasks] = useState<any[]>([]);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [recognition, setRecognition] = useState<any>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { user, session } = useAuth();
  const { addBrainDumpToCalendar } = useCalendarIntegration();

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

  useEffect(() => {
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
        
        // Only add final results to content, avoid duplicates
        if (finalTranscript) {
          setContent(prev => {
            const newContent = prev + (prev.endsWith(' ') || !prev ? '' : ' ') + finalTranscript;
            finalTranscript = ''; // Reset to prevent duplication
            return newContent;
          });
        }
      };
      
      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        toast.error('Voice recognition error. Please try again.');
        setIsRecording(false);
      };
      
      recognition.onend = () => {
        setIsRecording(false);
      };
      
      setRecognition(recognition);
    }
  }, []);

  const handleVoiceToggle = () => {
    if (!recognition) {
      toast.error('Voice recognition not supported in this browser');
      return;
    }
    
    if (isRecording) {
      recognition.stop();
      setIsRecording(false);
    } else {
      recognition.start();
      setIsRecording(true);
      toast.success('Voice recording started. Speak now...');
    }
  };

  const handleProcessDump = async () => {
    if (!content.trim()) return;
    
    // Enhanced input validation and sanitization
    const sanitizedContent = sanitizeInput.content(content);
    
    if (!sanitizedContent) {
      toast.error('Please enter some valid content to process');
      return;
    }
    
    if (sanitizedContent.length < 10) {
      toast.error('Content is too short. Please provide more details.');
      return;
    }
    
    if (sanitizedContent.length > 50000) {
      toast.error('Content is too long. Please limit to 50,000 characters.');
      return;
    }

    // Enhanced rate limiting
    const userKey = user?.id || 'anonymous';
    const rateCheck = globalRateLimiter.isAllowed(userKey, 3, 60000); // 3 requests per minute
    
    if (!rateCheck.allowed) {
      logger.security.rateLimitExceeded('brain-dump-process', userKey);
      toast.error(rateCheck.reason || 'Please wait before submitting again');
      return;
    }
    
    setIsProcessing(true);
    
    try {
      // Save to database first
      const { data: brainDumpData, error: insertError } = await supabase
        .from('brain_dumps')
        .insert({
          raw_content: sanitizedContent,
          user_id: user?.id,
          dump_date: new Date().toISOString().split('T')[0]
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Process with AI
      if (!session?.access_token) {
        throw new Error('No valid session found. Please log in again.');
      }

      const response = await fetch(`https://azzyyzympmwrwrjburer.supabase.co/functions/v1/process-brain-dump`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ content: sanitizedContent }),
      });

      if (!response.ok) {
        throw new Error('Failed to process brain dump');
      }

      const data = await response.json();
      
      if (data.tasks && data.tasks.length > 0) {
        // Save tasks to database
        const tasksToInsert = data.tasks.map((task: any) => ({
          title: task.title,
          description: task.description,
          priority: task.priority,
          estimated_hours: task.estimatedHours,
          user_id: user?.id,
          brain_dump_id: brainDumpData.id,
          status: 'not_started',
          is_billable: true
        }));

        const { error: tasksError } = await supabase
          .from('macro_tasks')
          .insert(tasksToInsert);

        if (tasksError) throw tasksError;

        // Update brain dump as processed
        await supabase
          .from('brain_dumps')
          .update({ 
            processed: true,
            ai_analysis_complete: true 
          })
          .eq('id', brainDumpData.id);
      }

      setProcessedTasks(data.tasks || []);

      // Extract times from content and add to calendar
      const extractedTimes = extractTimesFromText(sanitizedContent);
      if (extractedTimes.length > 0) {
        await addBrainDumpToCalendar.mutateAsync({
          content: sanitizedContent,
          extractedTimes
        });
      }
    } catch (error) {
      logger.error('Brain dump processing failed', { userId: user?.id });
      toast.error('Processing failed. Please try again.');
      setProcessedTasks([]);
    } finally {
      setIsProcessing(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-error';
      case 'medium': return 'text-warning';
      case 'low': return 'text-info';
      default: return 'text-muted-foreground';
    }
  };

  const getPriorityBg = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-error/10 border-error/20';
      case 'medium': return 'bg-warning/10 border-warning/20';
      case 'low': return 'bg-info/10 border-info/20';
      default: return 'bg-muted/10 border-border';
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Brain Dump</h1>
          <p className="text-muted-foreground mt-2">Transform your thoughts into organized, actionable tasks</p>
        </div>
        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
          {lastSaved && (
            <>
              <Save className="h-4 w-4" />
              <span>Last saved {lastSaved.toLocaleTimeString()}</span>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Brain Dump Input */}
        <div className="space-y-6">
          <Card className="glass p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-primary flex items-center justify-center">
                  <Brain className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">Daily Thoughts</h2>
                  <p className="text-sm text-muted-foreground">Dump everything on your mind</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleVoiceToggle}
                className={isRecording ? 'timer-active' : ''}
              >
                {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                {isRecording ? 'Stop' : 'Voice'}
              </Button>
            </div>

            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Start typing or speaking your thoughts...

Examples:
• Need to finish the quarterly reports by Friday
• Call John about the marketing campaign 
• Review the budget proposal from finance team
• Schedule team meeting for project planning
• Research new CRM tools for better productivity"
              className="w-full min-h-[300px] p-4 bg-surface-elevated border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary text-foreground placeholder-muted-foreground"
            />

            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                {content.length} characters • {content.split(' ').filter(word => word.length > 0).length} words
              </div>
              <Button 
                onClick={handleProcessDump}
                disabled={!content.trim() || isProcessing}
                className="bg-gradient-primary hover:shadow-lg"
              >
                {isProcessing ? (
                  <>
                    <Sparkles className="h-4 w-4 mr-2 animate-spin" />
                    Processing with AI...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 mr-2" />
                    Organize with AI
                  </>
                )}
              </Button>
            </div>
          </Card>

          {/* AI Processing Status */}
          {isProcessing && (
            <Card className="glass p-6">
              <div className="flex items-center space-x-4">
                <div className="h-12 w-12 rounded-xl bg-gradient-primary flex items-center justify-center animate-pulse-glow">
                  <Sparkles className="h-6 w-6 text-white animate-spin" />
                </div>
                <div>
                  <h3 className="font-semibold">AI is analyzing your thoughts...</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Extracting tasks, estimating time, and organizing priorities
                  </p>
                  <div className="w-64 h-2 bg-surface-elevated rounded-full mt-3">
                    <div className="h-full bg-gradient-primary rounded-full animate-pulse" style={{ width: '60%' }} />
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* Processed Tasks */}
        <div className="space-y-6">
          {processedTasks.length > 0 && (
            <Card className="glass p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="h-10 w-10 rounded-xl bg-gradient-success flex items-center justify-center">
                    <CheckCircle2 className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">Organized Tasks</h2>
                    <p className="text-sm text-muted-foreground">{processedTasks.length} tasks identified</p>
                  </div>
                </div>
                <Button 
                  size="sm" 
                  className="bg-gradient-primary"
                  onClick={() => navigate('/calendar')}
                >
                  Add to Calendar
                </Button>
              </div>

              <div className="space-y-4">
                {processedTasks.map((task) => (
                  <div key={task.id} className={`p-4 rounded-lg border ${getPriorityBg(task.priority)}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <AlertCircle className={`h-4 w-4 ${getPriorityColor(task.priority)}`} />
                          <span className={`text-xs font-medium uppercase ${getPriorityColor(task.priority)}`}>
                            {task.priority} Priority
                          </span>
                        </div>
                        <h3 className="font-semibold text-foreground">{task.title}</h3>
                        <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
                      </div>
                      <div className="flex items-center space-x-2 text-sm text-muted-foreground ml-4">
                        <Clock className="h-4 w-4" />
                        <span>{task.estimatedHours}h</span>
                      </div>
                    </div>

                    {/* Micro Tasks */}
                    <div className="mt-4">
                      <h4 className="text-sm font-medium text-foreground mb-2 flex items-center">
                        <Target className="h-4 w-4 mr-2" />
                        Breakdown ({task.microTasks.length} steps)
                      </h4>
                      <div className="space-y-2">
                        {task.microTasks.map((microTask: any, index: number) => (
                          <div key={index} className="flex items-center justify-between p-2 bg-surface-elevated rounded">
                            <span className="text-sm text-foreground">{microTask.title}</span>
                            <span className="text-xs text-muted-foreground">{microTask.estimatedMinutes}min</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
                      <span className="text-xs text-muted-foreground bg-surface-elevated px-2 py-1 rounded">
                        {task.category}
                      </span>
                      <div className="flex space-x-2">
                        <Button size="sm" variant="outline" onClick={() => navigate('/tasks')}>Edit</Button>
                        <Button 
                          size="sm" 
                          className="bg-gradient-primary"
                          onClick={() => navigate('/timer')}
                        >
                          Start Timer
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Tips Card */}
          {processedTasks.length === 0 && (
            <Card className="glass p-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="h-10 w-10 rounded-xl bg-gradient-primary flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">AI Tips</h2>
                  <p className="text-sm text-muted-foreground">Get better results</p>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="p-3 bg-surface-elevated rounded-lg">
                  <h3 className="font-medium text-sm">Be Specific</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Include deadlines, context, and any constraints
                  </p>
                </div>
                <div className="p-3 bg-surface-elevated rounded-lg">
                  <h3 className="font-medium text-sm">Include All Details</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Mention projects, clients, and priority levels
                  </p>
                </div>
                <div className="p-3 bg-surface-elevated rounded-lg">
                  <h3 className="font-medium text-sm">Think Out Loud</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Include your thoughts, concerns, and ideas
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* Previous Brain Dumps */}
          <div className="mt-8">
            <BrainDumpList />
          </div>
        </div>
      </div>
    </div>
  );
};

export default BrainDumpInterface;