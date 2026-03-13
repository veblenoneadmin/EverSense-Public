import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from '../lib/auth-client';
import { useApiClient } from '../lib/api-client';
import { useOrganization } from '../contexts/OrganizationContext';

export interface TimerSession {
  id: string;
  taskId: string;
  taskTitle: string;
  description: string;
  category: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  status: 'running' | 'stopped';
}

export function useTimer() {
  const { data: session } = useSession();
  const { currentOrg } = useOrganization();
  const apiClient = useApiClient();
  const [activeTimer, setActiveTimer] = useState<TimerSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [, setPausedTime] = useState(0); // Track total paused time (for state sync)

  // Use ref to track the interval so it persists across renders
  const timerInterval = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<Date | null>(null);
  const pauseStartRef = useRef<Date | null>(null);
  const isPausedRef = useRef(false); // Ref for current pause state
  const pausedTimeRef = useRef(0); // Ref for current paused time

  // Clear the interval when component unmounts or timer stops
  const clearTimerInterval = useCallback(() => {
    if (timerInterval.current) {
      clearInterval(timerInterval.current);
      timerInterval.current = null;
    }
  }, []);

  // Update elapsed time every second for active timer
  const updateElapsedTime = useCallback(() => {
    if (startTimeRef.current && !isPausedRef.current) {
      const now = Date.now();
      const totalElapsed = Math.floor((now - startTimeRef.current.getTime()) / 1000);
      const activeElapsed = totalElapsed - pausedTimeRef.current;
      setElapsedTime(Math.max(0, activeElapsed));
      console.log('⏱️ Timer update:', {
        totalElapsed,
        pausedTime: pausedTimeRef.current,
        activeElapsed,
        isPaused: isPausedRef.current
      });
    } else if (isPausedRef.current) {
      console.log('⏸️ Timer paused - not updating elapsed time');
    }
  }, []); // No dependencies since we're using refs

  // Start the timer interval
  const startTimerInterval = useCallback(() => {
    clearTimerInterval(); // Clear any existing interval
    updateElapsedTime(); // Update immediately
    timerInterval.current = setInterval(updateElapsedTime, 1000);
  }, [clearTimerInterval, updateElapsedTime]);

  // Fetch active timer from API
  const fetchActiveTimer = useCallback(async () => {
    if (!session?.user?.id) {
      setLoading(false);
      return;
    }

    try {
      setError(null);
      // EMERGENCY FIX: Use hardcoded orgId if currentOrg is not available
      const orgId = currentOrg?.id || 'org_1757046595553';
      console.log('🔧 Fetching active timer with orgId:', orgId, 'from:', currentOrg?.id ? 'currentOrg' : 'hardcoded fallback');

      const data = await apiClient.fetch(`/api/timer/active?userId=${session.user.id}&orgId=${orgId}&limit=100`);
      
      if (data.timers && data.timers.length > 0) {
        const timer = data.timers[0]; // Get the first active timer
        
        // Only update if timer has actually changed to prevent unnecessary re-renders
        setActiveTimer(prev => {
          if (!prev || prev.id !== timer.id || prev.startTime !== timer.startTime) {
            startTimeRef.current = new Date(timer.startTime);
            startTimerInterval();
            return timer;
          }
          return prev;
        });
      } else {
        setActiveTimer(prev => {
          if (prev !== null) {
            startTimeRef.current = null;
            clearTimerInterval();
            setElapsedTime(0);
            return null;
          }
          return prev;
        });
      }
    } catch (err: any) {
      console.error('Error fetching active timer:', err);
      setError(err.message);
      setActiveTimer(null);
      clearTimerInterval();
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id, currentOrg?.id, startTimerInterval, clearTimerInterval]);

  // Start a new timer
  const startTimer = useCallback(async (taskId: string, description?: string, category: string = 'work') => {
    if (!session?.user?.id) {
      throw new Error('User not authenticated');
    }

    try {
      setError(null);

      // Start timer immediately in UI - don't wait for API response
      const now = new Date();
      startTimeRef.current = now;
      setElapsedTime(0);
      setIsPaused(false);
      isPausedRef.current = false; // Reset ref
      setPausedTime(0);
      pausedTimeRef.current = 0; // Reset ref
      pauseStartRef.current = null;
      startTimerInterval();

      // Create temporary timer object for immediate UI update
      const tempTimer = {
        id: 'temp-' + Date.now(),
        taskId,
        taskTitle: 'Starting...',
        description: description || '',
        category,
        startTime: now.toISOString(),
        status: 'running' as const
      };
      setActiveTimer(tempTimer);

      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      // EMERGENCY FIX: Use hardcoded orgId if currentOrg is not available
      const orgId = currentOrg?.id || 'org_1757046595553';
      console.log('🔧 Starting timer with orgId:', orgId, 'from:', currentOrg?.id ? 'currentOrg' : 'hardcoded fallback');

      const data = await apiClient.fetch('/api/timer/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: session.user.id,
          orgId,
          taskId,
          description,
          category,
          timezone
        })
      });

      if (data.timer) {
        // Update with real timer data from server
        setActiveTimer(data.timer);
        return data.timer;
      }
    } catch (err: any) {
      console.error('Error starting timer:', err);
      setError(err.message);
      throw err;
    }
  }, [session?.user?.id, currentOrg?.id, startTimerInterval]);

  // Stop the active timer
  const stopTimer = useCallback(async () => {
    if (!activeTimer || !session?.user?.id) {
      throw new Error('No active timer to stop');
    }

    try {
      setError(null);
      // EMERGENCY FIX: Use hardcoded orgId if currentOrg is not available
      const orgId = currentOrg?.id || 'org_1757046595553';

      const data = await apiClient.fetch(`/api/timer/stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: session.user.id,
          orgId
        })
      });

      if (data.timer) {
        setActiveTimer(null);
        startTimeRef.current = null;
        setIsPaused(false);
        isPausedRef.current = false; // Reset ref
        setPausedTime(0);
        pausedTimeRef.current = 0; // Reset ref
        pauseStartRef.current = null;
        clearTimerInterval();
        setElapsedTime(0);
        return data.timer;
      }
    } catch (err: any) {
      console.error('Error stopping timer:', err);
      setError(err.message);
      throw err;
    }
  }, [activeTimer, session?.user?.id, currentOrg?.id, clearTimerInterval]);

  // Update timer description or category
  const updateTimer = useCallback(async (updates: { description?: string; category?: string; taskId?: string }) => {
    if (!activeTimer || !session?.user?.id) {
      throw new Error('No active timer to update');
    }

    try {
      setError(null);
      // EMERGENCY FIX: Use hardcoded orgId if currentOrg is not available
      const orgId = currentOrg?.id || 'org_1757046595553';

      const data = await apiClient.fetch(`/api/timer/update/${activeTimer.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: session.user.id,
          orgId,
          ...updates
        })
      });

      if (data.timer) {
        setActiveTimer(data.timer);
        return data.timer;
      }
    } catch (err: any) {
      console.error('Error updating timer:', err);
      setError(err.message);
      throw err;
    }
  }, [activeTimer, session?.user?.id, currentOrg?.id]);

  // Pause the timer
  const pauseTimer = useCallback(() => {
    console.log('🔸 pauseTimer called, activeTimer:', !!activeTimer, 'isPaused:', isPaused);
    if (!activeTimer || isPaused) {
      console.log('🔸 pauseTimer early return');
      return;
    }

    console.log('🔸 Pausing timer at:', new Date().toLocaleTimeString());
    setIsPaused(true);
    isPausedRef.current = true; // Update ref immediately
    pauseStartRef.current = new Date();
    console.log('🔸 Set isPausedRef.current to:', isPausedRef.current);
  }, [activeTimer, isPaused]);

  // Resume the timer
  const resumeTimer = useCallback(() => {
    console.log('▶️ resumeTimer called, activeTimer:', !!activeTimer, 'isPaused:', isPaused, 'pauseStartRef:', !!pauseStartRef.current);
    if (!activeTimer || !isPaused || !pauseStartRef.current) {
      console.log('▶️ resumeTimer early return');
      return;
    }

    // Add the paused duration to total paused time
    const pauseDuration = Math.floor((Date.now() - pauseStartRef.current.getTime()) / 1000);
    console.log('▶️ Resuming timer at:', new Date().toLocaleTimeString(), `(was paused for ${pauseDuration}s)`);

    const newPausedTime = pausedTimeRef.current + pauseDuration;
    setPausedTime(newPausedTime);
    pausedTimeRef.current = newPausedTime; // Update ref immediately

    setIsPaused(false);
    isPausedRef.current = false; // Update ref immediately
    pauseStartRef.current = null;
    console.log('▶️ Set isPausedRef.current to:', isPausedRef.current);
  }, [activeTimer, isPaused]);

  // Format elapsed time as HH:MM:SS
  const formatElapsedTime = useCallback((seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }, []);

  // Auto-fetch active timer when session changes or on mount
  useEffect(() => {
    if (session?.user?.id) {
      fetchActiveTimer();
    }
  }, [session?.user?.id]);

  // Set up periodic refresh (separate effect to avoid re-creating interval)
  useEffect(() => {
    if (!session?.user?.id || !activeTimer) {
      return; // Don't sync if no user or no active timer
    }
    
    const syncInterval = setInterval(() => {
      fetchActiveTimer();
    }, 60000); // Reduced to 1 minute to reduce blinking
    
    return () => {
      clearInterval(syncInterval);
    };
  }, [session?.user?.id, activeTimer?.id]); // Only sync when there's an active timer

  // Handle page visibility change to sync timer when tab becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && activeTimer && session?.user?.id) {
        // Refresh timer when tab becomes visible, but only if we have an active timer
        fetchActiveTimer();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [activeTimer?.id, session?.user?.id]); // Stable dependencies

  // Handle beforeunload to warn user about active timer
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (activeTimer) {
        e.preventDefault();
        e.returnValue = 'You have an active timer running. Are you sure you want to leave?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [activeTimer]);

  return {
    activeTimer,
    loading,
    error,
    elapsedTime,
    formattedElapsedTime: formatElapsedTime(elapsedTime),
    startTimer,
    stopTimer,
    updateTimer,
    pauseTimer,
    resumeTimer,
    refreshTimer: fetchActiveTimer,
    clearError: () => setError(null),
    isRunning: !!activeTimer,
    isPaused
  };
}