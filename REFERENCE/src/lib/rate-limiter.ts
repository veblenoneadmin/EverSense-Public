// Enhanced rate limiting with server-side validation
export class EnhancedRateLimiter {
  private attempts: Map<string, { count: number; resetTime: number; blocked: boolean }> = new Map();
  private suspiciousActivity: Map<string, number> = new Map();

  isAllowed(
    key: string, 
    maxAttempts: number = 5, 
    windowMs: number = 300000,
    blockDurationMs: number = 900000 // 15 minutes
  ): { allowed: boolean; reason?: string; retryAfter?: number } {
    const now = Date.now();
    const attempt = this.attempts.get(key);

    // Check if user is currently blocked
    if (attempt?.blocked && now < attempt.resetTime) {
      return {
        allowed: false,
        reason: 'Rate limit exceeded. Account temporarily blocked.',
        retryAfter: Math.ceil((attempt.resetTime - now) / 1000)
      };
    }

    // Reset if window has expired
    if (!attempt || (now > attempt.resetTime && !attempt.blocked)) {
      this.attempts.set(key, { count: 1, resetTime: now + windowMs, blocked: false });
      return { allowed: true };
    }

    // Increment attempt count
    if (attempt.count >= maxAttempts) {
      // Block the user
      this.attempts.set(key, {
        count: attempt.count + 1,
        resetTime: now + blockDurationMs,
        blocked: true
      });

      // Track suspicious activity
      const suspiciousCount = this.suspiciousActivity.get(key) || 0;
      this.suspiciousActivity.set(key, suspiciousCount + 1);

      return {
        allowed: false,
        reason: 'Too many attempts. Account blocked.',
        retryAfter: Math.ceil(blockDurationMs / 1000)
      };
    }

    // Increment count
    attempt.count++;
    return { allowed: true };
  }

  reset(key: string): void {
    this.attempts.delete(key);
    this.suspiciousActivity.delete(key);
  }

  getSuspiciousActivity(key: string): number {
    return this.suspiciousActivity.get(key) || 0;
  }

  // Clean up old entries periodically
  cleanup(): void {
    const now = Date.now();
    for (const [key, attempt] of this.attempts.entries()) {
      if (now > attempt.resetTime && !attempt.blocked) {
        this.attempts.delete(key);
      }
    }
  }
}

export const globalRateLimiter = new EnhancedRateLimiter();

// Cleanup every 5 minutes
setInterval(() => globalRateLimiter.cleanup(), 300000);