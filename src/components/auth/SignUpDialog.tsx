import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { useAuth } from '../../hooks/useAuth';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';

interface SignUpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSwitchToLogin: () => void;
}

// Default RTO code for all new signups
const DEFAULT_RTO_CODE = '71480000';

export function SignUpDialog({ open, onOpenChange, onSwitchToLogin }: SignUpDialogProps) {
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const { register, isLoading } = useAuth();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!fullName.trim()) {
      toast.error('Full name is required');
      return;
    }

    if (!email.trim()) {
      toast.error('Email is required');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error('Please provide a valid email address');
      return;
    }

    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (!agreedToTerms) {
      toast.error('You must agree to the terms and conditions');
      return;
    }

    const result = await register(email, password, fullName, DEFAULT_RTO_CODE);

    if (result.success) {
      toast.success('Registration successful! Please check your email to verify your account.');
      onOpenChange(false); // Close dialog
      onSwitchToLogin(); // Switch to login dialog
    } else {
      // Display user-friendly error message
      const errorMessage = result.error || 'Registration failed';
      console.error('[SignUpDialog] Registration error:', errorMessage);
      toast.error(errorMessage);
    }
  };

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setFullName('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setAgreedToTerms(false);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto bg-white">
        <DialogHeader>
          <DialogTitle>Create Account</DialogTitle>
          <DialogDescription>
            Join Nytro and streamline your assessment validation
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleRegister} className="space-y-6">
          <div>
            <Label htmlFor="fullName" className="text-[#1e293b] font-semibold">
              Full Name
            </Label>
            <Input
              id="fullName"
              type="text"
              placeholder="John Doe"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-2 border-[#dbeafe] focus:border-[#3b82f6]"
              required
            />
          </div>

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
              minLength={8}
            />
            <p className="text-xs text-[#64748b] mt-1">
              Must be at least 8 characters
            </p>
          </div>

          <div>
            <Label htmlFor="confirmPassword" className="text-[#1e293b] font-semibold">
              Confirm Password
            </Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-2 border-[#dbeafe] focus:border-[#3b82f6]"
              required
              minLength={8}
            />
          </div>

          <div className="flex items-start gap-2">
            <input
              id="terms"
              type="checkbox"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-[#dbeafe] accent-[#3b82f6]"
              required
            />
            <Label htmlFor="terms" className="text-sm text-[#64748b] cursor-pointer">
              I agree to the Terms of Service and Privacy Policy
            </Label>
          </div>

          <Button
            type="submit"
            className="w-full bg-[#3b82f6] hover:bg-[#2563eb] text-white font-semibold py-2 h-auto"
            disabled={isLoading}
          >
            {isLoading ? 'Creating account...' : 'Create Account'}
          </Button>

          <p className="text-sm text-center text-[#64748b]">
            Already have an account?{' '}
            <button 
              type="button"
              onClick={onSwitchToLogin}
              className="text-[#3b82f6] hover:underline font-semibold"
            >
              Sign in
            </button>
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}
