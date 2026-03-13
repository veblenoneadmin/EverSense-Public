import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle, XCircle, ArrowRight, Sparkles } from 'lucide-react';
import { EverSenseLogo } from '../components/EverSenseLogo';
import { Card, CardContent, CardHeader } from '../components/ui/card';
import { Button } from '../components/ui/button';

export function EmailVerified() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  
  useEffect(() => {
    const token = searchParams.get('token');
    
    if (!token) {
      setStatus('error');
      setMessage('Invalid verification link. No token provided.');
      return;
    }

    // Verify the email
    const verifyEmail = async () => {
      try {
        const response = await fetch(`/api/auth/verify-email?token=${token}`);
        const result = await response.json();
        
        if (response.ok && result.status) {
          setStatus('success');
          setMessage('Your email has been successfully verified! You can now sign in to your account.');
        } else {
          setStatus('error');
          setMessage(result.message || 'Email verification failed. The link may have expired or is invalid.');
        }
      } catch (error) {
        setStatus('error');
        setMessage('An error occurred during email verification. Please try again.');
        console.error('Email verification error:', error);
      }
    };

    verifyEmail();
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-success/5"></div>
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-success/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>
      
      {/* Main Content */}
      <div className="w-full max-w-md relative z-10">
        {/* Logo & Brand */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-6">
            <EverSenseLogo height={56} width={328} />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold gradient-text">EverSense Ai</h1>
            <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
              <Sparkles className="h-4 w-4" />
              AI-Powered Task Management
            </p>
          </div>
        </div>

        {/* Verification Result Card */}
        <Card className="glass shadow-elevation">
          <CardHeader className="space-y-1 pb-4">
            <div className="flex items-center justify-center mb-4">
              <div className={`p-4 rounded-full ${
                status === 'loading' ? 'bg-primary/10' :
                status === 'success' ? 'bg-success/10' : 'bg-error/10'
              }`}>
                {status === 'loading' && (
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                )}
                {status === 'success' && <CheckCircle className="h-8 w-8 text-success" />}
                {status === 'error' && <XCircle className="h-8 w-8 text-error" />}
              </div>
            </div>
            <h2 className="text-2xl font-semibold text-center">
              {status === 'loading' && 'Verifying Email...'}
              {status === 'success' && 'Email Verified! ✅'}
              {status === 'error' && 'Verification Failed'}
            </h2>
            <p className="text-sm text-muted-foreground text-center">
              {status === 'loading' && 'Please wait while we verify your email address...'}
              {status === 'success' && 'Your account is now active and ready to use'}
              {status === 'error' && 'We encountered an issue verifying your email'}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Status Message */}
            <div className={`p-4 rounded-lg border ${
              status === 'success' 
                ? 'bg-success/10 border-success/20 text-success' 
                : status === 'error'
                ? 'bg-error/10 border-error/20 text-error'
                : 'bg-muted/50 border-muted text-muted-foreground'
            }`}>
              <p className="text-sm">{message}</p>
            </div>

            {/* Action Buttons */}
            {status !== 'loading' && (
              <div className="space-y-3">
                {status === 'success' && (
                  <Link to="/onboarding" className="block">
                    <Button className="w-full bg-gradient-success hover:bg-gradient-success/90 text-white shadow-glow transition-all duration-300">
                      Continue to Setup
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                )}
                
                {status === 'error' && (
                  <div className="space-y-2">
                    <Link to="/register" className="block">
                      <Button className="w-full bg-gradient-primary hover:bg-gradient-primary/90 text-white shadow-glow transition-all duration-300">
                        Try Registering Again
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                    <Link to="/login" className="block">
                      <Button variant="outline" className="w-full">
                        Back to Sign In
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            )}

            {/* Additional Help */}
            {status === 'error' && (
              <div className="pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground text-center">
                  Need help? Contact support at{' '}
                  <a href="mailto:support@veblengroup.com.au" className="text-primary hover:text-primary/80 transition-colors">
                    support@veblengroup.com.au
                  </a>
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-xs text-muted-foreground">
            © 2024 EverSense Ai. Secure authentication powered by better-auth.
          </p>
        </div>
      </div>
    </div>
  );
}