import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { useAuth } from '../../hooks/useAuth';

export function LoginForm() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const hasNavigated = useRef(false);

  const { login, isLoading, isAuthenticated } = useAuth();

  // Navigate when authentication state changes to true after login attempt
  useEffect(() => {
    if (loggingIn && isAuthenticated && !hasNavigated.current) {
      console.log('[LoginForm] Auth state changed to authenticated, navigating to dashboard');
      hasNavigated.current = true;
      setLoggingIn(false);
      navigate('/dashboard');
    }
  }, [loggingIn, isAuthenticated, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(''); // Clear any previous error

    if (!email.trim()) {
      setErrorMessage('Email is required');
      return;
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setErrorMessage('Please enter a valid email address');
      return;
    }

    if (!password.trim()) {
      setErrorMessage('Password is required');
      return;
    }

    console.log('[LoginForm] Starting login...');
    hasNavigated.current = false;
    setLoggingIn(true);

    const result = await login(email, password);

    if (result.success) {
      console.log('[LoginForm] Login successful, auth state will trigger navigation');
      toast.success('Welcome back!');
      // Navigation will happen via useEffect when isAuthenticated becomes true
    } else {
      console.log('[LoginForm] Login failed:', result.error);
      setLoggingIn(false);
      // Display user-friendly error message
      const errorMsg = result.error?.toLowerCase().includes('invalid') ||
        result.error?.toLowerCase().includes('credentials')
        ? 'Invalid email or password. Please check your credentials and try again.'
        : result.error || 'Login failed. Please try again.';
      setErrorMessage(errorMsg);
    }
  };

  return (
    <>
      {/* Error Message Display */}
      {errorMessage && (
        <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-red-50 border border-red-200">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-600">{errorMessage}</p>
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-6">
        <div>
          <Label htmlFor="email" className="text-[#1e293b] font-semibold">
            Email
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setErrorMessage(''); // Clear error when user types
            }}
            className="mt-2 border-[#dbeafe] focus:border-[#3b82f6]"
            required
          />
        </div>

        <div>
          <Label htmlFor="password" className="text-[#1e293b] font-semibold">
            Password
          </Label>
          <div className="relative mt-2">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setErrorMessage(''); // Clear error when user types
              }}
              className="border-[#dbeafe] focus:border-[#3b82f6] pr-10"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748b] hover:text-[#3b82f6] transition-colors"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <EyeOff className="h-5 w-5" />
              ) : (
                <Eye className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <input
              id="remember"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded border-[#dbeafe] accent-[#3b82f6]"
            />
            <Label htmlFor="remember" className="text-sm text-[#64748b] cursor-pointer">
              Remember me
            </Label>
          </div>
          <a href="/forgot-password" className="text-sm text-[#3b82f6] hover:underline">
            Forgot password?
          </a>
        </div>

        <Button
          type="submit"
          className="w-full bg-[#3b82f6] hover:bg-[#2563eb] text-white font-semibold py-2 h-auto"
          disabled={isLoading}
        >
          {isLoading ? 'Signing in...' : 'Sign In'}
        </Button>

        <p className="text-sm text-center text-[#64748b]">
          Don't have an account?{' '}
          <a href="/register" className="text-[#3b82f6] hover:underline font-semibold">
            Create account
          </a>
        </p>
      </form>
    </>
  );
}
