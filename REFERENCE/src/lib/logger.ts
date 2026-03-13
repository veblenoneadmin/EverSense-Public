import { sanitizeError } from './security';

type LogLevel = 'error' | 'warn' | 'info' | 'debug';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, any>;
}

class Logger {
  private isDevelopment = import.meta.env.DEV;

  private log(level: LogLevel, message: string, context?: Record<string, any>) {
    const entry: LogEntry = {
      level,
      message: sanitizeError(message),
      timestamp: new Date().toISOString(),
      context: context ? this.sanitizeContext(context) : undefined
    };

    // Only log to console in development
    if (this.isDevelopment) {
      const logMethod = level === 'error' ? console.error : 
                       level === 'warn' ? console.warn : 
                       level === 'info' ? console.info : console.log;
      
      logMethod(`[${entry.level.toUpperCase()}] ${entry.message}`, entry.context || '');
    }

    // In production, you could send logs to a service like Sentry, LogRocket, etc.
    if (!this.isDevelopment && level === 'error') {
      this.sendToErrorService(entry);
    }
  }

  private sanitizeContext(context: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(context)) {
      // Skip sensitive fields
      if (['password', 'token', 'secret', 'key', 'auth'].some(sensitive => 
          key.toLowerCase().includes(sensitive))) {
        sanitized[key] = '[REDACTED]';
        continue;
      }

      // Sanitize string values
      if (typeof value === 'string') {
        sanitized[key] = sanitizeError(value);
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeContext(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  private sendToErrorService(entry: LogEntry) {
    // In a real application, send to error tracking service
    // Example: Sentry.captureException(new Error(entry.message), { extra: entry.context });
    
    // For now, store in sessionStorage for debugging
    try {
      const errors = JSON.parse(sessionStorage.getItem('app_errors') || '[]');
      errors.push(entry);
      // Keep only last 10 errors
      sessionStorage.setItem('app_errors', JSON.stringify(errors.slice(-10)));
    } catch {
      // Ignore storage errors
    }
  }

  error(message: string, context?: Record<string, any>) {
    this.log('error', message, context);
  }

  warn(message: string, context?: Record<string, any>) {
    this.log('warn', message, context);
  }

  info(message: string, context?: Record<string, any>) {
    this.log('info', message, context);
  }

  debug(message: string, context?: Record<string, any>) {
    this.log('debug', message, context);
  }

  // Security-specific logging
  security = {
    authFailure: (email: string, reason: string) => {
      this.error('Authentication failed', { 
        email: email.replace(/(.{2}).*@/, '$1***@'), 
        reason 
      });
    },

    rateLimitExceeded: (action: string, identifier: string) => {
      this.warn('Rate limit exceeded', { action, identifier: identifier.slice(0, 4) + '***' });
    },

    suspiciousActivity: (activity: string, context?: Record<string, any>) => {
      this.error('Suspicious activity detected', { activity, ...context });
    }
  };
}

export const logger = new Logger();
