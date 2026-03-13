import { useState } from 'react';
import type { FormEvent } from 'react';
import { signUp, signIn } from '../lib/auth-client';
import { Link, useNavigate } from 'react-router-dom';
import { User, Mail, Lock, Eye, EyeOff, ArrowRight, Sparkles, MailCheck, AlertCircle } from 'lucide-react';
import { EverSenseLogo } from '../components/EverSenseLogo';
import { FcGoogle } from 'react-icons/fc';
import { Card, CardContent, CardHeader } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { useAuthConfig } from '../hooks/useAuthConfig';

export function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const navigate = useNavigate();
  const { config } = useAuthConfig();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    try {
      const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
      const result = await signUp.email({
        email,
        password,
        name: fullName,
      });

      console.log('🔍 Registration result:', result);

      if (result.error) {
        console.error('❌ Registration error:', result.error);
        setError(result.error.message || 'Registration failed');
      } else if (result.data) {
        console.log('✅ Registration successful:', result.data);
        // Check if user needs email verification
        if (!result.data.user?.emailVerified) {
          console.log('📧 Email verification required');
          setUserEmail(email);
          setEmailSent(true);
        } else {
          console.log('🚀 User already verified, redirecting to dashboard');
          navigate('/dashboard');
        }
      } else {
        console.log('📧 No result data, assuming email verification needed');
        // Fallback: assume email verification is required
        setUserEmail(email);
        setEmailSent(true);
      }
    } catch (err) {
      console.error('❌ Caught registration error:', err);
      console.error('Error details:', {
        message: (err as Error).message || 'Unknown error',
        stack: (err as Error).stack,
        name: (err as Error).name
      });
      setError('An error occurred during registration');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');
    
    try {
      // Better Auth social sign-in automatically redirects to Google
      // No result is returned - it redirects the browser
      await signIn.social({
        provider: 'google',
      });
    } catch (err) {
      setLoading(false);
      setError('An error occurred during Google sign in');
      console.error('Google sign in error:', err);
    }
    // Note: Don't set loading to false here - the page will redirect
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-success/5 via-background to-primary/5"></div>
      <div className="absolute inset-0">
        <div className="absolute top-1/3 left-1/3 w-80 h-80 bg-success/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/3 right-1/3 w-80 h-80 bg-primary/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
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

        {/* Register Card */}
        <Card className="glass shadow-elevation">
          {!emailSent ? (
            <>
              <CardHeader className="space-y-1 pb-4">
                <h2 className="text-2xl font-semibold text-center">Create your account ✨</h2>
                <p className="text-sm text-muted-foreground text-center">
                  Join thousands of productive professionals
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name Inputs */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="firstName" className="text-sm font-medium text-foreground">
                    First Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-white/80 z-10" />
                    <Input
                      type="text"
                      id="firstName"
                      placeholder="John"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="pl-10 glass-surface"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label htmlFor="lastName" className="text-sm font-medium text-foreground">
                    Last Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-white/80 z-10" />
                    <Input
                      type="text"
                      id="lastName"
                      placeholder="Doe"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="pl-10 glass-surface"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Email Input */}
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-foreground">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-white/80 z-10" />
                  <Input
                    type="email"
                    id="email"
                    placeholder="john@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 glass-surface"
                    required
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium text-foreground">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-white/80 z-10" />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    placeholder="Create a strong password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10 glass-surface"
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-3 text-white/80 hover:text-white z-10 transition-colors"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password Input */}
              <div className="space-y-2">
                <label htmlFor="confirmPassword" className="text-sm font-medium text-foreground">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-white/80 z-10" />
                  <Input
                    type={showConfirmPassword ? 'text' : 'password'}
                    id="confirmPassword"
                    placeholder="Confirm your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10 pr-10 glass-surface"
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-3 text-white/80 hover:text-white z-10 transition-colors"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {password.length > 0 && confirmPassword.length > 0 && password !== confirmPassword ? (
                    <span className="text-red-400">❌ Passwords do not match</span>
                  ) : password.length > 0 && confirmPassword.length > 0 && password === confirmPassword ? (
                    <span className="text-green-400">✅ Passwords match</span>
                  ) : (
                    'Password must be at least 6 characters long'
                  )}
                </p>
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-3 rounded-lg bg-error/10 border border-error/20 text-error text-sm">
                  {error}
                </div>
              )}

              {/* Submit Button */}
              <Button 
                type="submit" 
                disabled={loading}
                className="w-full bg-gradient-success hover:bg-gradient-success/90 text-white shadow-glow transition-all duration-300"
              >
                {loading ? 'Creating account...' : 'Create Account'}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </form>

            {/* Google OAuth Section - Only show if enabled */}
            {config.googleOAuthEnabled && (
              <>
                {/* Divider */}
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
                  </div>
                </div>

                {/* Google Sign In Button */}
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                  className="w-full border-border hover:bg-muted/50 transition-all duration-300"
                >
                  <FcGoogle className="w-5 h-5 mr-2" />
                  Continue with Google
                </Button>
              </>
            )}

            {/* Terms & Privacy */}
            <div className="text-center">
              <p className="text-xs text-muted-foreground">
                By creating an account, you agree to our{' '}
                <a href="#" className="text-primary hover:text-primary/80 transition-colors">
                  Terms of Service
                </a>{' '}
                and{' '}
                <a href="#" className="text-primary hover:text-primary/80 transition-colors">
                  Privacy Policy
                </a>
              </p>
            </div>

            {/* Sign In Link */}
            <div className="text-center pt-4 border-t border-border">
              <p className="text-sm text-muted-foreground">
                Already have an account?{' '}
                <Link 
                  to="/login" 
                  className="font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  Sign in here
                </Link>
              </p>
            </div>
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader className="space-y-1 pb-4">
                <div className="flex items-center justify-center mb-4">
                  <div className="p-4 bg-success/10 rounded-full">
                    <MailCheck className="h-8 w-8 text-success" />
                  </div>
                </div>
                <h2 className="text-2xl font-semibold text-center">Check Your Email! 📧</h2>
                <p className="text-sm text-muted-foreground text-center">
                  We've sent a verification link to your email
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center space-y-4">
                  <div className="p-4 rounded-lg bg-success/10 border border-success/20">
                    <p className="text-sm text-foreground mb-2">
                      <strong>Verification email sent to:</strong>
                    </p>
                    <p className="text-success font-medium">{userEmail}</p>
                  </div>
                  
                  <div className="space-y-3 text-sm text-muted-foreground">
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                      <AlertCircle className="h-4 w-4 mt-0.5 text-amber-500 flex-shrink-0" />
                      <div className="text-left">
                        <p className="font-medium text-foreground mb-1">Didn't receive the email?</p>
                        <ul className="space-y-1 text-xs">
                          <li>• Check your spam/junk folder</li>
                          <li>• Wait up to 5 minutes for delivery</li>
                          <li>• Make sure {userEmail} is correct</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 space-y-3">
                    <p className="text-sm text-muted-foreground">
                      <strong>What's next?</strong>
                    </p>
                    <ol className="text-xs text-muted-foreground space-y-1 text-left bg-muted/30 p-4 rounded-lg">
                      <li>1. Open the email from EverSense Ai</li>
                      <li>2. Click the "Verify Email Address" button</li>
                      <li>3. Return here and sign in with your credentials</li>
                    </ol>
                  </div>
                </div>

                {/* Back to Login */}
                <div className="text-center pt-4 border-t border-border">
                  <Link 
                    to="/login" 
                    className="inline-flex items-center gap-2 text-primary hover:text-primary/80 transition-colors font-medium"
                  >
                    <ArrowRight className="h-4 w-4 rotate-180" />
                    Back to Sign In
                  </Link>
                </div>
              </CardContent>
            </>
          )}
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