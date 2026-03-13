import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AuthSecurity } from '@/lib/auth-security';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, firstName?: string, lastName?: string) => Promise<void>;
  signOut: () => Promise<void>;
  
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const cleanEmail = email.toLowerCase().trim();
    
    // Input validation
    if (!email || !password) {
      toast.error('Email and password are required');
      throw new Error('Email and password are required');
    }

    // Email format validation
    const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
    if (!emailRegex.test(email)) {
      toast.error('Please enter a valid email address');
      throw new Error('Invalid email format');
    }

    // Check account lockout status
    const lockoutStatus = await AuthSecurity.checkAccountLockout(cleanEmail);
    
    if (lockoutStatus.is_locked) {
      const timeRemaining = AuthSecurity.formatLockoutTime(lockoutStatus.locked_until!);
      toast.error(`Account temporarily locked due to multiple failed attempts. Try again in ${timeRemaining}.`);
      throw new Error('Account locked');
    }

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) {
        // Record failed login attempt
        const isLocked = await AuthSecurity.recordFailedLogin(cleanEmail);
        
        // Log security event
        await AuthSecurity.logSecurityEvent('failed_login', cleanEmail, {
          error: error.message,
          attempts: lockoutStatus.attempts + 1
        });
        
        if (isLocked) {
          toast.error('Too many failed attempts. Account locked for 15 minutes.');
        } else {
          const remainingAttempts = 5 - (lockoutStatus.attempts + 1);
          toast.error(`Invalid credentials. ${remainingAttempts} attempts remaining.`);
        }
        
        throw error;
      }

      // Clear failed attempts on successful login
      await AuthSecurity.clearFailedAttempts(cleanEmail);
      
      // Log successful login
      await AuthSecurity.logSecurityEvent('successful_login', cleanEmail);
      
      toast.success('Welcome back!');
    } catch (error) {
      throw error;
    }
  };

  const signUp = async (email: string, password: string, firstName?: string, lastName?: string) => {
    // Input validation
    if (!email || !password) {
      toast.error('Email and password are required');
      throw new Error('Email and password are required');
    }

    // Email format validation
    const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
    if (!emailRegex.test(email)) {
      toast.error('Please enter a valid email address');
      throw new Error('Invalid email format');
    }

    // Password strength validation
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters long');
      throw new Error('Password too weak');
    }

    // Sanitize names
    const sanitizedFirstName = firstName?.replace(/[<>]/g, '').trim() || '';
    const sanitizedLastName = lastName?.replace(/[<>]/g, '').trim() || '';

    const { error } = await supabase.auth.signUp({
      email: email.toLowerCase().trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: {
          first_name: sanitizedFirstName,
          last_name: sanitizedLastName,
        },
      },
    });

    if (error) {
      toast.error(error.message);
      throw error;
    }

    toast.success('Check your email to confirm your account!');
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      toast.error(error.message);
      throw error;
    }

    toast.success('Signed out successfully');
  };


  const value = {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}