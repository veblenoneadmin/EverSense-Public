import { supabase } from '@/integrations/supabase/client';

interface LockoutStatus {
  is_locked: boolean;
  attempts: number;
  locked_until: string | null;
}

export class AuthSecurity {
  // Check if account is locked before attempting login
  static async checkAccountLockout(email: string): Promise<LockoutStatus> {
    try {
      const { data, error } = await supabase.rpc('check_account_lockout', {
        email_input: email
      });

      if (error) {
        console.error('Error checking account lockout:', error);
        return { is_locked: false, attempts: 0, locked_until: null };
      }

      return data[0] || { is_locked: false, attempts: 0, locked_until: null };
    } catch (error) {
      console.error('Error in checkAccountLockout:', error);
      return { is_locked: false, attempts: 0, locked_until: null };
    }
  }

  // Record failed login attempt and check if account should be locked
  static async recordFailedLogin(email: string): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('record_failed_login', {
        email_input: email
      });

      if (error) {
        console.error('Error recording failed login:', error);
        return false;
      }

      return data; // Returns true if account is now locked
    } catch (error) {
      console.error('Error in recordFailedLogin:', error);
      return false;
    }
  }

  // Clear failed attempts on successful login
  static async clearFailedAttempts(email: string): Promise<void> {
    try {
      const { error } = await supabase.rpc('clear_failed_attempts', {
        email_input: email
      });

      if (error) {
        console.error('Error clearing failed attempts:', error);
      }
    } catch (error) {
      console.error('Error in clearFailedAttempts:', error);
    }
  }

  // Enhanced security audit logging
  static async logSecurityEvent(eventType: string, email: string, details: any = {}): Promise<void> {
    try {
      // Only log if user is admin (security audit logs are admin-only)
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      // Check if user is admin
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', user.user.id)
        .single();

      if (profile?.role !== 'admin') return;

      await supabase.from('security_audit_log').insert({
        event_type: eventType,
        user_id: user.user.id,
        details: {
          email,
          timestamp: new Date().toISOString(),
          user_agent: navigator.userAgent,
          ...details
        }
      });
    } catch (error) {
      console.error('Error logging security event:', error);
    }
  }

  // Format lockout time remaining
  static formatLockoutTime(lockedUntil: string): string {
    const lockoutEnd = new Date(lockedUntil);
    const now = new Date();
    const diffMs = lockoutEnd.getTime() - now.getTime();
    
    if (diffMs <= 0) return 'Lockout expired';
    
    const minutes = Math.ceil(diffMs / 60000);
    return `${minutes} minute${minutes > 1 ? 's' : ''}`;
  }
}