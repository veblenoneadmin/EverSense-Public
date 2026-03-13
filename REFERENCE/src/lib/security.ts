import { z } from 'zod';

// Input sanitization utilities
export const sanitizeInput = {
  // Remove dangerous characters and normalize whitespace
  text: (input: string): string => {
    return input
      .replace(/[<>]/g, '') // Remove potential XSS characters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
      .slice(0, 10000); // Limit length
  },

  // Sanitize email input
  email: (input: string): string => {
    return input
      .toLowerCase()
      .trim()
      .slice(0, 254); // RFC 5321 limit
  },

  // Sanitize name fields
  name: (input: string): string => {
    return input
      .replace(/[<>]/g, '')
      .replace(/[^\w\s\-\.]/g, '') // Only allow word chars, spaces, hyphens, dots
      .trim()
      .slice(0, 100);
  },

  // Sanitize content for brain dumps
  content: (input: string): string => {
    return input
      .replace(/[<>]/g, '') // Remove XSS potential
      .trim()
      .slice(0, 50000); // Limit to 50k chars
  }
};

// Validation schemas
export const validationSchemas = {
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(100).regex(/^[\w\s\-\.]+$/),
  content: z.string().max(50000),
  uuid: z.string().uuid(),
};

// Rate limiting utility (client-side basic protection)
export class RateLimiter {
  private attempts: Map<string, { count: number; resetTime: number }> = new Map();

  isAllowed(key: string, maxAttempts: number = 5, windowMs: number = 300000): boolean {
    const now = Date.now();
    const attempt = this.attempts.get(key);

    if (!attempt || now > attempt.resetTime) {
      this.attempts.set(key, { count: 1, resetTime: now + windowMs });
      return true;
    }

    if (attempt.count >= maxAttempts) {
      return false;
    }

    attempt.count++;
    return true;
  }

  reset(key: string): void {
    this.attempts.delete(key);
  }
}

// Secure data helpers
export const secureData = {
  // Mask sensitive data for logging
  maskEmail: (email: string): string => {
    const [name, domain] = email.split('@');
    return `${name.charAt(0)}***@${domain}`;
  },

  // Mask phone numbers
  maskPhone: (phone: string): string => {
    return phone.replace(/\d(?=\d{4})/g, '*');
  },

  // Generate secure random string
  randomString: (length: number = 32): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
};

// Error sanitization - remove sensitive data from error messages
export const sanitizeError = (error: any): string => {
  if (typeof error === 'string') {
    return error.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]')
                .replace(/\b\d{3}[\-\.]\d{3}[\-\.]\d{4}\b/g, '[PHONE]')
                .replace(/password/gi, '[PASSWORD]')
                .replace(/token/gi, '[TOKEN]');
  }
  
  if (error?.message) {
    return sanitizeError(error.message);
  }
  
  return 'An error occurred';
};