import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useSession as useBetterAuthSession } from '../lib/auth-client';

interface SessionContextType {
  session: any;
  isLoading: boolean;
  error: any;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

interface SessionProviderProps {
  children: ReactNode;
}

export function SessionProvider({ children }: SessionProviderProps) {
  const { data: session, isPending: isLoading, error } = useBetterAuthSession();
  const [stableSession, setStableSession] = useState(session);

  // Only update session when it actually changes to prevent unnecessary re-renders
  useEffect(() => {
    if (session !== stableSession) {
      setStableSession(session);
    }
  }, [session?.user?.id, session?.user?.email]);

  const contextValue = {
    session: stableSession,
    isLoading,
    error,
  };

  return (
    <SessionContext.Provider value={contextValue}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSessionContext(): SessionContextType {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSessionContext must be used within a SessionProvider');
  }
  return context;
}

// Export a compatible hook that matches the better-auth API
export function useSession() {
  const { session, isLoading, error } = useSessionContext();
  return {
    data:      session,
    isPending: isLoading,
    error,
  };
}
