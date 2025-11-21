import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
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

    if (!email.trim()) {
      toast.error('Email is required');
      return;
    }

    if (!password.trim()) {
      toast.error('Password is required');
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
      toast.error(result.error || 'Login failed');
    }
  };

  return (
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
          onChange={(e) => setEmail(e.target.value)}
          className="mt-2 border-[#dbeafe] focus:border-[#3b82f6]"
          required
        />
      </div>

      <div>
        <Label htmlFor="password" className="text-[#1e293b] font-semibold">
          Password
        </Label>
        <Input
          id="password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-2 border-[#dbeafe] focus:border-[#3b82f6]"
          required
        />
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
  );
}
