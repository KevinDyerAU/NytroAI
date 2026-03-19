import React, { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { useAuth } from '../../hooks/useAuth';

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const { resetPassword, isLoading } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      toast.error('Email is required');
      return;
    }

    const result = await resetPassword(email);

    if (result.success) {
      setIsSubmitted(true);
      toast.success('Password reset link sent to your email');
    } else {
      toast.error(result.error || 'Failed to send reset link');
    }
  };

  if (isSubmitted) {
    return (
      <div className="space-y-6 text-center">
        <div className="bg-teal-500/10 border border-teal-500/30 rounded-lg p-6">
          <p className="text-teal-400 font-semibold mb-2">Check your email</p>
          <p className="text-sm text-slate-400">
            We've sent a password reset link to <strong className="text-white">{email}</strong>
          </p>
        </div>
        <p className="text-sm text-slate-400">
          Follow the link in the email to reset your password. The link will expire in 24 hours.
        </p>
        <Button 
          onClick={() => {
            setIsSubmitted(false);
            setEmail('');
          }}
          variant="outline"
          className="w-full border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
        >
          Send another link
        </Button>
        <p className="text-sm text-center text-slate-400">
          Remember your password?{' '}
          <a href="/login" className="text-teal-400 hover:text-teal-300 font-semibold transition-colors">
            Sign in
          </a>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <p className="text-sm text-slate-400">
        Enter your email address and we'll send you a link to reset your password.
      </p>

      <div>
        <Label htmlFor="email" className="text-slate-300 font-semibold">
          Email
        </Label>
        <Input
          id="email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-2 bg-slate-700/50 border-slate-600 text-white placeholder-slate-500 focus:border-teal-400 focus:ring-teal-400"
          required
        />
      </div>

      <Button 
        type="submit" 
        className="w-full bg-gradient-to-r from-teal-400 to-teal-500 hover:from-teal-500 hover:to-teal-600 text-nytro-dark font-bold py-2 h-auto uppercase tracking-wide"
        disabled={isLoading}
      >
        {isLoading ? 'Sending link...' : 'Send Reset Link'}
      </Button>

      <p className="text-sm text-center text-slate-400">
        Remember your password?{' '}
        <a href="/login" className="text-teal-400 hover:text-teal-300 font-semibold transition-colors">
          Sign in
        </a>
      </p>
    </form>
  );
}
