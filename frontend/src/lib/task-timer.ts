// Shared task-timer utilities — operate directly on localStorage so they work
// even when the Tasks component is not mounted. After updating localStorage,
// a window event is dispatched so Tasks can sync its React state if it IS open.

function safeParse<T>(key: string): T | null {
  try { return JSON.parse(localStorage.getItem(key) || 'null') as T; } catch { return null; }
}

function clearBackendTimer() {
  fetch('/api/tasks/timer/stop', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: '{}' }).catch(() => {});
}

function notifyBackendTimerStart(taskId: string, startedAt: number) {
  fetch('/api/tasks/timer/start', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ taskId, startedAt }) }).catch(() => {});
}

export function pauseTaskTimer() {
  const active = safeParse<{ taskId: string; startTime: number }>('task_timer_active');
  if (!active?.taskId || localStorage.getItem('task_timer_paused')) return;

  const storedStart = Number(localStorage.getItem('task_timer_start') || 0);
  const elapsed = storedStart ? Math.floor((Date.now() - storedStart) / 1000) : 0;
  const accum = safeParse<Record<string, number>>('task_timers') || {};
  accum[active.taskId] = (accum[active.taskId] || 0) + elapsed;
  localStorage.setItem('task_timers', JSON.stringify(accum));
  localStorage.removeItem('task_timer_start');
  localStorage.setItem('task_timer_paused', active.taskId);

  clearBackendTimer();
  window.dispatchEvent(new CustomEvent('task-timer-pause'));
}

export function resumeTaskTimer() {
  const pausedTaskId = localStorage.getItem('task_timer_paused');
  if (!pausedTaskId) return;

  const startTime = Date.now();
  localStorage.setItem('task_timer_active', JSON.stringify({ taskId: pausedTaskId, startTime }));
  localStorage.setItem('task_timer_start', String(startTime));
  localStorage.removeItem('task_timer_paused');

  notifyBackendTimerStart(pausedTaskId, startTime);
  window.dispatchEvent(new CustomEvent('task-timer-resume'));
}

export function stopTaskTimer() {
  const active = safeParse<{ taskId: string; startTime: number }>('task_timer_active');
  const pausedTaskId = localStorage.getItem('task_timer_paused');
  const taskId = active?.taskId || pausedTaskId;
  if (!taskId) return;

  const storedStart = Number(localStorage.getItem('task_timer_start') || 0);
  const elapsed = storedStart ? Math.floor((Date.now() - storedStart) / 1000) : 0;
  if (elapsed > 0) {
    const accum = safeParse<Record<string, number>>('task_timers') || {};
    accum[taskId] = (accum[taskId] || 0) + elapsed;
    localStorage.setItem('task_timers', JSON.stringify(accum));
  }
  localStorage.removeItem('task_timer_active');
  localStorage.removeItem('task_timer_start');
  localStorage.removeItem('task_timer_paused');

  clearBackendTimer();
  window.dispatchEvent(new CustomEvent('task-timer-stop'));
}
