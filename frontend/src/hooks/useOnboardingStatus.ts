import { useState, useEffect } from 'react';
import { useSession } from '../lib/auth-client';

interface OnboardingStatus {
  needsOnboarding: boolean;
  loading: boolean;
  error: string | null;
  progress?: number;
  currentStep?: string | null;
  completedSteps?: string[];
}

export function useOnboardingStatus(): OnboardingStatus {
  const { data: session } = useSession();
  const [status, setStatus] = useState<OnboardingStatus>({
    needsOnboarding: false,
    loading: true,
    error: null
  });

  useEffect(() => {
    if (!session?.user) {
      setStatus({ needsOnboarding: false, loading: false, error: null });
      return;
    }

    checkOnboardingStatus();
  }, [session]);

  const checkOnboardingStatus = async () => {
    try {
      setStatus(prev => ({ ...prev, loading: true, error: null }));

      const response = await fetch('/api/wizard/status', {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch wizard status');
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to get wizard status');
      }

      const { needsOnboarding, progress, nextStep, completedSteps } = result.data;
      
      setStatus({
        needsOnboarding,
        loading: false,
        error: null,
        progress,
        currentStep: nextStep,
        completedSteps
      });

    } catch (error) {
      console.error('Error checking onboarding status:', error);
      setStatus({
        needsOnboarding: false,
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  return status;
}