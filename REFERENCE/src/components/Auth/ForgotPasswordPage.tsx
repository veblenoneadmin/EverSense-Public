import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { 
  Mail, 
  ArrowLeft,
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import veblenLogo from '@/assets/veblen-logo.png';
import { logger } from '@/lib/logger';
import { sanitizeInput, validationSchemas } from '@/lib/security';

const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Enhanced input validation and sanitization
    const sanitizedEmail = sanitizeInput.email(email);
    
    try {
      validationSchemas.email.parse(sanitizedEmail);
    } catch {
      toast.error('Please enter a valid email address');
      return;
    }
    
    setIsLoading(true);
    
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(sanitizedEmail, {
        redirectTo: `${window.location.origin}/reset-password`
      });

      if (error) {
        if (error.message.includes('Email rate limit exceeded')) {
          toast.error('Please wait before requesting another password reset');
        } else {
          throw error;
        }
      } else {
        setEmailSent(true);
        logger.info('Password reset email sent', { email: sanitizeInput.email(sanitizedEmail) });
        toast.success('Password reset email sent!');
      }
    } catch (error) {
      logger.security.authFailure(sanitizedEmail, 'Password reset failed');
      toast.error('Unable to send password reset email. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (emailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-accent/10" />
        <div className="absolute top-20 left-20 w-64 h-64 bg-primary/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-accent/20 rounded-full blur-3xl animate-pulse" />
        
        <Card className="glass w-full max-w-md p-8 relative z-10">
          {/* Logo & Header */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center space-x-3 mb-4">
              <div className="h-12 w-12 flex items-center justify-center">
                <img src={veblenLogo} alt="VebTask Logo" className="h-12 w-12 object-contain" />
              </div>
              <div>
                <h1 className="text-2xl font-bold gradient-text">VebTask</h1>
                <p className="text-xs text-muted-foreground">AI-Powered Task Management</p>
              </div>
            </div>
          </div>

          {/* Success Message */}
          <div className="text-center">
            <div className="h-16 w-16 rounded-full bg-gradient-success flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="h-8 w-8 text-white" />
            </div>
            
            <h2 className="text-xl font-semibold text-foreground mb-3">Check your email!</h2>
            <p className="text-muted-foreground text-sm mb-6">
              We've sent a password reset link to <span className="font-medium text-foreground">{email}</span>
            </p>
            
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Can't find the email? Check your spam folder or try again with a different email address.
              </p>
              
              <Button 
                onClick={() => setEmailSent(false)}
                variant="outline" 
                className="w-full border-border"
              >
                Try different email
              </Button>
              
              <Link to="/login">
                <Button variant="outline" className="w-full border-border">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Sign In
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-accent/10" />
      <div className="absolute top-20 left-20 w-64 h-64 bg-primary/20 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-20 right-20 w-96 h-96 bg-accent/20 rounded-full blur-3xl animate-pulse" />
      
      <Card className="glass w-full max-w-md p-8 relative z-10">
        {/* Logo & Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <div className="h-12 w-12 flex items-center justify-center">
              <img src={veblenLogo} alt="VebTask Logo" className="h-12 w-12 object-contain" />
            </div>
            <div>
              <h1 className="text-2xl font-bold gradient-text">VebTask</h1>
              <p className="text-xs text-muted-foreground">AI-Powered Task Management</p>
            </div>
          </div>
          <h2 className="text-xl font-semibold text-foreground">Forgot your password?</h2>
          <p className="text-muted-foreground text-sm mt-2">
            No worries! Enter your email and we'll send you reset instructions.
          </p>
        </div>

        {/* Forgot Password Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="john@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10 bg-surface-elevated border-border focus:border-primary"
                required
              />
            </div>
          </div>

          <Button 
            type="submit" 
            className="w-full bg-gradient-primary hover:shadow-lg text-white font-medium py-3"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Sparkles className="h-4 w-4 mr-2 animate-spin" />
                Sending reset link...
              </>
            ) : (
              <>
                <Mail className="h-4 w-4 mr-2" />
                Send reset link
              </>
            )}
          </Button>
        </form>

        {/* Back to Login */}
        <div className="text-center mt-6">
          <Link 
            to="/login" 
            className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Sign In
          </Link>
        </div>

        {/* Help Text */}
        <div className="mt-8 p-4 bg-info/10 border border-info/20 rounded-lg">
          <div className="flex items-center space-x-2 mb-2">
            <Sparkles className="h-4 w-4 text-info" />
            <span className="text-sm font-medium text-info">Need Help?</span>
          </div>
          <p className="text-xs text-muted-foreground">
            If you're still having trouble accessing your account, please contact our support team.
          </p>
        </div>
      </Card>
    </div>
  );
};

export default ForgotPasswordPage;