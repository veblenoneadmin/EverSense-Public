interface LogContext {
  userId?: string;
  sessionId?: string;
  component?: string;
  action?: string;
  [key: string]: unknown;
}

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private isDevelopment = import.meta.env.DEV;
  private logLevel: LogLevel = this.isDevelopment ? 'debug' : 'info';

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevel = levels.indexOf(level);
    return messageLevel >= currentLevelIndex;
  }

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` ${JSON.stringify(context)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
  }

  private log(level: LogLevel, message: string, context?: LogContext, error?: Error) {
    if (!this.shouldLog(level)) return;

    const formattedMessage = this.formatMessage(level, message, context);
    
    // In development, use console methods
    if (this.isDevelopment) {
      switch (level) {
        case 'debug':
          console.debug(formattedMessage, error || '');
          break;
        case 'info':
          console.info(formattedMessage, error || '');
          break;
        case 'warn':
          console.warn(formattedMessage, error || '');
          break;
        case 'error':
          console.error(formattedMessage, error || '');
          break;
      }
    } else {
      // In production, only log errors and warnings to console
      if (level === 'error' || level === 'warn') {
        console[level](formattedMessage, error || '');
      }
    }
  }

  debug(message: string, context?: LogContext) {
    this.log('debug', message, context);
  }

  info(message: string, context?: LogContext) {
    this.log('info', message, context);
  }

  warn(message: string, context?: LogContext, error?: Error) {
    this.log('warn', message, context, error);
  }

  error(message: string, context?: LogContext, error?: Error) {
    this.log('error', message, context, error);
  }

  // Timer-specific logging helpers
  timerStart(taskId: string, userId: string) {
    this.info('Timer started', { component: 'Timer', action: 'start', taskId, userId });
  }

  timerStop(taskId: string, userId: string, duration: number) {
    this.info('Timer stopped', { component: 'Timer', action: 'stop', taskId, userId, duration });
  }

  authEvent(event: string, userId?: string, success: boolean = true) {
    const level = success ? 'info' : 'warn';
    this.log(level, `Auth event: ${event}`, { component: 'Auth', userId, success });
  }

  apiRequest(method: string, path: string, statusCode?: number, userId?: string) {
    const level = statusCode && statusCode >= 400 ? 'warn' : 'info';
    this.log(level, `API ${method} ${path}`, { component: 'API', statusCode, userId });
  }
}

export const logger = new Logger();