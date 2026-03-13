import { useState, useEffect } from 'react';
import { useSession } from '../lib/auth-client';
import { useApiTasks } from '../hooks/useApiTasks';
import { useTimer } from '../hooks/useTimer';
import {
  Play,
  Pause,
  Square,
  Clock,
  Target,
  DollarSign,
  AlertCircle
} from 'lucide-react';
import { logger } from '../lib/logger';

import { VS } from '../lib/theme';

function priorityColor(priority: string): string {
  switch (priority) {
    case 'Urgent': return VS.red;
    case 'High':   return VS.orange;
    case 'Medium': return VS.yellow;
    default:       return VS.text2;
  }
}

export function Timer() {
  const { data: session } = useSession();
  const { activeTasks, loading: tasksLoading, error: tasksError } = useApiTasks();
  const {
    activeTimer,
    loading: timerLoading,
    error: timerError,
    formattedElapsedTime,
    startTimer,
    stopTimer,
    updateTimer,
    pauseTimer,
    resumeTimer,
    isRunning,
    isPaused
  } = useTimer();

  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [sessionNotes, setSessionNotes] = useState<string>('');

  logger.debug('Timer component initialized', {
    userId: session?.user?.id,
    activeTimer: activeTimer?.id,
    isRunning
  });

  // Set initial task when tasks load or when no task is selected
  useEffect(() => {
    if (activeTasks.length > 0 && !selectedTaskId && !activeTimer) {
      setSelectedTaskId(activeTasks[0].id);
    }
    // If there's an active timer, set the selected task to match
    if (activeTimer && activeTimer.taskId) {
      setSelectedTaskId(activeTimer.taskId);
    }
  }, [activeTasks, selectedTaskId, activeTimer]);

  const handleStartTimer = async () => {
    try {
      let taskId = selectedTaskId;
      let description = sessionNotes;

      // If no tasks available, allow timer without a specific task
      if (activeTasks.length === 0) {
        taskId = 'general-work';
        description = sessionNotes || 'General work session';
      } else if (!selectedTaskId) {
        alert('Please select a task first');
        return;
      } else {
        const selectedTask = activeTasks.find(t => t.id === selectedTaskId);
        description = sessionNotes || `Working on ${selectedTask?.title || 'task'}`;
      }

      await startTimer(taskId, description, 'work');
      logger.info('Timer started', { taskId, description });
    } catch (error) {
      logger.error('Failed to start timer', { taskId: selectedTaskId }, error as Error);
      alert('Failed to start timer. Please try again.');
    }
  };

  const handleStopTimer = async () => {
    try {
      await stopTimer();
      logger.info('Timer stopped', { timerId: activeTimer?.id });
      setSessionNotes(''); // Clear notes after stopping
    } catch (error) {
      logger.error('Failed to stop timer', { timerId: activeTimer?.id }, error as Error);
      alert('Failed to stop timer. Please try again.');
    }
  };

  const handleUpdateNotes = async () => {
    if (!activeTimer || !sessionNotes.trim()) return;

    try {
      await updateTimer({ description: sessionNotes });
      logger.info('Timer notes updated', { timerId: activeTimer.id });
    } catch (error) {
      logger.error('Failed to update timer notes', { timerId: activeTimer.id }, error as Error);
    }
  };

  // Update notes when they change (debounced)
  useEffect(() => {
    if (!activeTimer || !sessionNotes.trim()) return;

    const timeoutId = setTimeout(() => {
      handleUpdateNotes();
    }, 2000); // 2 second debounce

    return () => clearTimeout(timeoutId);
  }, [sessionNotes, activeTimer]);

  const currentTask = activeTasks.find(t => t.id === selectedTaskId) || activeTasks[0];
  const showLoading = tasksLoading || timerLoading;
  const showError = tasksError || timerError;

  // DEBUG: Log the current state to help diagnose issues
  console.log('🔍 Timer Debug:', {
    session: !!session,
    tasksLoading,
    timerLoading,
    showLoading,
    tasksError,
    timerError,
    showError,
    activeTasks: activeTasks.length,
    activeTimer: !!activeTimer
  });

  // Derived status
  const statusLabel = isRunning && !isPaused ? 'Running' : isPaused ? 'Paused' : 'Stopped';
  const statusColor = isRunning && !isPaused ? VS.teal : isPaused ? VS.yellow : VS.text2;

  const timerColor = isRunning && !isPaused ? VS.teal : isPaused ? VS.yellow : VS.bg3;

  const progressPct = currentTask
    ? Math.min(100, ((currentTask.actualHours || 0) / (currentTask.estimatedHours || 1)) * 100)
    : 0;

  // Show login required message if no session
  if (!session) {
    return (
      <div style={{ padding: '24px' }}>
        <div
          style={{
            background: `${VS.red}10`,
            border: `1px solid ${VS.red}33`,
            color: VS.red,
            borderRadius: 12,
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <AlertCircle size={16} />
          <span>Please log in to use the timer feature.</span>
        </div>
      </div>
    );
  }

  if (showLoading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: 256,
          gap: 10,
          color: VS.text1,
        }}
      >
        <Clock
          size={32}
          color={VS.accent}
          style={{ animation: 'spin 1s linear infinite' }}
        />
        <span style={{ color: VS.text1, fontSize: 15 }}>Loading timer...</span>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: VS.text0, margin: 0 }}>
          Time Tracker
        </h1>
        {/* Status badge */}
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: statusColor,
            background: `${statusColor}18`,
            border: `1px solid ${statusColor}55`,
            borderRadius: 999,
            padding: '3px 10px',
            letterSpacing: '0.03em',
          }}
        >
          {statusLabel}
        </span>
      </div>

      {/* Error banner */}
      {showError && (
        <div
          style={{
            background: `${VS.red}10`,
            border: `1px solid ${VS.red}33`,
            color: VS.red,
            borderRadius: 12,
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 14,
          }}
        >
          <AlertCircle size={15} />
          <span>{tasksError || timerError}</span>
        </div>
      )}

      {/* Two-column grid: timer + task selection */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Timer card */}
        <div
          className="rounded-xl p-5"
          style={{ background: VS.bg1, border: `1px solid ${VS.border}` }}
        >
          {/* Card header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Clock size={18} color={VS.accent} />
              <span style={{ fontSize: 15, fontWeight: 600, color: VS.text0 }}>Active Session</span>
            </div>
            {activeTimer && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  color: VS.text2,
                  background: VS.bg2,
                  border: `1px solid ${VS.border}`,
                  borderRadius: 6,
                  padding: '2px 8px',
                  textTransform: 'capitalize',
                }}
              >
                {activeTimer.category}
              </span>
            )}
          </div>

          {/* Big timer display */}
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div
              style={{
                fontSize: 56,
                fontWeight: 800,
                fontFamily: 'monospace',
                letterSpacing: '-2px',
                color: timerColor,
                transition: 'color 0.3s',
                lineHeight: 1.1,
              }}
            >
              {formattedElapsedTime}
            </div>
            {activeTimer && (
              <div style={{ marginTop: 8 }}>
                <p style={{ fontSize: 13, color: VS.text2 }}>{activeTimer.taskTitle}</p>
                {isPaused && (
                  <p
                    style={{
                      fontSize: 11,
                      color: VS.yellow,
                      marginTop: 4,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                    }}
                  >
                    <Pause size={11} />
                    Timer Paused
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Control buttons */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 24 }}>
            {!isRunning ? (
              <button
                onClick={handleStartTimer}
                disabled={activeTasks.length > 0 && !selectedTaskId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: VS.teal,
                  color: VS.bg0,
                  border: 'none',
                  borderRadius: 8,
                  padding: '10px 24px',
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: activeTasks.length > 0 && !selectedTaskId ? 'not-allowed' : 'pointer',
                  opacity: activeTasks.length > 0 && !selectedTaskId ? 0.5 : 1,
                  transition: 'opacity 0.2s',
                }}
              >
                <Play size={18} />
                <span>Start Timer</span>
              </button>
            ) : (
              <>
                <button
                  onClick={() => {
                    console.log('🔘 Button clicked, isPaused:', isPaused);
                    if (isPaused) {
                      console.log('📞 Calling resumeTimer');
                      resumeTimer();
                    } else {
                      console.log('📞 Calling pauseTimer');
                      pauseTimer();
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    background: isPaused ? VS.teal : VS.yellow,
                    color: VS.bg0,
                    border: 'none',
                    borderRadius: 8,
                    padding: '10px 24px',
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {isPaused ? (
                    <>
                      <Play size={18} />
                      <span>Resume</span>
                    </>
                  ) : (
                    <>
                      <Pause size={18} />
                      <span>Pause</span>
                    </>
                  )}
                </button>
                <button
                  onClick={handleStopTimer}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    background: VS.red,
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    padding: '10px 24px',
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <Square size={18} />
                  <span>Stop</span>
                </button>
              </>
            )}
          </div>

          {/* Session notes */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: VS.text1 }}>
              Session Notes
            </label>
            <textarea
              value={sessionNotes}
              onChange={(e) => setSessionNotes(e.target.value)}
              placeholder="What are you working on? (auto-saves)"
              disabled={!isRunning && !activeTimer}
              style={{
                width: '100%',
                height: 80,
                padding: '10px 12px',
                background: VS.bg2,
                border: `1px solid ${VS.border}`,
                borderRadius: 8,
                color: VS.text0,
                fontSize: 13,
                resize: 'none',
                outline: 'none',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
                opacity: !isRunning && !activeTimer ? 0.5 : 1,
              }}
            />
          </div>
        </div>

        {/* Task selection card */}
        <div
          className="rounded-xl p-5"
          style={{ background: VS.bg1, border: `1px solid ${VS.border}` }}
        >
          {/* Card header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Target size={18} color={VS.accent} />
            <span style={{ fontSize: 15, fontWeight: 600, color: VS.text0 }}>Select Task</span>
            <span style={{ fontSize: 13, color: VS.text2 }}>Choose what to work on</span>
          </div>

          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {activeTasks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: VS.text2 }}>
                <Target size={44} color={VS.bg3} style={{ margin: '0 auto 16px' }} />
                <p style={{ fontSize: 14, marginBottom: 4 }}>No active tasks available</p>
                <p style={{ fontSize: 13 }}>You can still start a general work timer</p>
                <p style={{ fontSize: 11, marginTop: 6 }}>Create tasks later to organize your time better</p>
              </div>
            ) : (
              activeTasks.map((task) => {
                const isSelected = selectedTaskId === task.id;
                return (
                  <button
                    key={task.id}
                    onClick={() => setSelectedTaskId(task.id)}
                    disabled={isRunning}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      background: isSelected ? `${VS.accent}10` : VS.bg2,
                      border: isSelected ? `1px solid ${VS.accent}` : `1px solid ${VS.border}`,
                      borderRadius: 8,
                      padding: '10px 12px',
                      cursor: isRunning ? 'not-allowed' : 'pointer',
                      opacity: isRunning ? 0.5 : 1,
                      transition: 'border-color 0.15s, background 0.15s',
                    }}
                  >
                    <h3
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: VS.text0,
                        margin: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {task.title}
                    </h3>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginTop: 4,
                      }}
                    >
                      <span style={{ fontSize: 11, color: VS.text2 }}>
                        {task.actualHours || 0}h / {task.estimatedHours || 0}h
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          color: priorityColor(task.priority),
                          background: `${priorityColor(task.priority)}18`,
                          border: `1px solid ${priorityColor(task.priority)}44`,
                          borderRadius: 4,
                          padding: '1px 6px',
                        }}
                      >
                        {task.priority}
                      </span>
                    </div>
                    {task.description && (
                      <p
                        style={{
                          fontSize: 11,
                          color: VS.text2,
                          marginTop: 3,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {task.description}
                      </p>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Current Task Details */}
      {currentTask && (
        <div
          className="rounded-xl p-5"
          style={{ background: VS.bg1, border: `1px solid ${VS.border}` }}
        >
          <h3 style={{ fontSize: 15, fontWeight: 600, color: VS.text0, margin: '0 0 16px' }}>
            Current Task Details
          </h3>
          <div className="grid md:grid-cols-3 gap-4">
            {/* Task info */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Target size={14} color={VS.accent} />
                <span style={{ fontSize: 13, fontWeight: 500, color: VS.text1 }}>Task</span>
              </div>
              <p style={{ fontSize: 13, color: VS.text0, margin: 0 }}>{currentTask.title}</p>
              {currentTask.description && (
                <p style={{ fontSize: 11, color: VS.text2, margin: 0 }}>{currentTask.description}</p>
              )}
            </div>

            {/* Time progress */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Clock size={14} color={VS.accent} />
                <span style={{ fontSize: 13, fontWeight: 500, color: VS.text1 }}>Time Progress</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: VS.text1 }}>
                  <span>Logged: {currentTask.actualHours || 0}h</span>
                  <span>Est: {currentTask.estimatedHours || 0}h</span>
                </div>
                {/* Progress bar */}
                <div
                  style={{
                    width: '100%',
                    height: 6,
                    background: VS.bg2,
                    borderRadius: 999,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${progressPct}%`,
                      height: '100%',
                      background: VS.accent,
                      borderRadius: 999,
                      transition: 'width 0.3s',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Priority */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <DollarSign size={14} color={VS.accent} />
                <span style={{ fontSize: 13, fontWeight: 500, color: VS.text1 }}>Priority</span>
              </div>
              <span
                style={{
                  display: 'inline-block',
                  fontSize: 12,
                  fontWeight: 600,
                  color: priorityColor(currentTask.priority),
                  background: `${priorityColor(currentTask.priority)}18`,
                  border: `1px solid ${priorityColor(currentTask.priority)}44`,
                  borderRadius: 6,
                  padding: '3px 10px',
                  alignSelf: 'flex-start',
                }}
              >
                {currentTask.priority}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
