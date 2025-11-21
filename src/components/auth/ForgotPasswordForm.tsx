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
        <div className="bg-[#dcfce7] border border-[#86efac] rounded-lg p-6">
          <p className="text-[#166534] font-semibold mb-2">Check your email</p>
          <p className="text-sm text-[#4b5563]">
            We've sent a password reset link to <strong>{email}</strong>
          </p>
        </div>
        <p className="text-sm text-[#64748b]">
          Follow the link in the email to reset your password. The link will expire in 24 hours.
        </p>
        <Button 
          onClick={() => {
            setIsSubmitted(false);
            setEmail('');
          }}
          variant="outline"
          className="w-full"
        >
          Send another link
        </Button>
        <p className="text-sm text-center text-[#64748b]">
          Remember your password?{' '}
          <a href="/login" className="text-[#3b82f6] hover:underline font-semibold">
            Sign in
          </a>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <p className="text-sm text-[#64748b]">
        Enter your email address and we'll send you a link to reset your password.
      </p>

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

      <Button 
        type="submit" 
        className="w-full bg-[#3b82f6] hover:bg-[#2563eb] text-white font-semibold py-2 h-auto"
        disabled={isLoading}
      >
        {isLoading ? 'Sending link...' : 'Send Reset Link'}
      </Button>

      <p className="text-sm text-center text-[#64748b]">
        Remember your password?{' '}
        <a href="/login" className="text-[#3b82f6] hover:underline font-semibold">
          Sign in
        </a>
      </p>
    </form>
  );
}
