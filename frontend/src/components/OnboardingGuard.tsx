import { Navigate, useLocation } from 'react-router-dom';
import { EverSenseLogo } from './EverSenseLogo';
import { useOnboardingStatus } from '../hooks/useOnboardingStatus';
import { useSession } from '../lib/auth-client';

interface OnboardingGuardProps {
  children: React.ReactNode;
}

export function OnboardingGuard({ children }: OnboardingGuardProps) {
  const { data: session } = useSession();
  const { needsOnboarding, loading } = useOnboardingStatus();
  const location = useLocation();

  // Don't guard auth pages or onboarding itself
  const excludedPaths = ['/login', '/register', '/onboarding', '/email-verified'];
  if (excludedPaths.includes(location.pathname)) {
    return <>{children}</>;
  }

  // Show loading while checking status
  if (loading && session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-surface to-surface-elevated">
        <div className="flex flex-col items-center space-y-6 animate-fade-in">
          <div className="relative">
            <EverSenseLogo width={280} height={55} />
          </div>
          <div className="flex flex-col items-center space-y-2">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
            <div className="text-lg font-medium text-muted-foreground">Checking setup...</div>
          </div>
        </div>
      </div>
    );
  }

  // Redirect to onboarding if needed
  if (needsOnboarding && session) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}