import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card } from '../ui/card';
import { useAuth } from '../../hooks/useAuth';
import { fetchRTOsFromSupabase, type RTO } from '../../types/rto';

// Default RTO code for new signups (matches SignUpDialog)
const DEFAULT_RTO_CODE = '71480000';

export function RegisterForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const rtoCode = searchParams.get('rto') || '';

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [selectedRtoCode, setSelectedRtoCode] = useState(rtoCode || DEFAULT_RTO_CODE);
  const [rtosLoading, setRtosLoading] = useState(true);
  const [rtos, setRtos] = useState<RTO[]>([]);
  const [registrationComplete, setRegistrationComplete] = useState(false);
  const [alreadyExists, setAlreadyExists] = useState(false);

  const { register, isLoading } = useAuth();

  // Fetch RTOs on component mount
  useEffect(() => {
    const loadRtos = async () => {
      try {
        console.log('[RegisterForm] Loading RTOs from Supabase...');
        const fetchedRtos = await fetchRTOsFromSupabase();
        console.log('[RegisterForm] RTOs loaded successfully:', fetchedRtos.length);
        setRtos(fetchedRtos);

        // If RTO is provided in URL, use it; otherwise select the first one
        if (rtoCode) {
          setSelectedRtoCode(rtoCode);
        } else if (fetchedRtos.length > 0) {
          setSelectedRtoCode(fetchedRtos[0].code);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error('[RegisterForm] Failed to load RTOs:', errorMsg);
        toast.error('Failed to load RTOs. Please check your connection to Supabase.');
      } finally {
        setRtosLoading(false);
      }
    };

    loadRtos();
  }, [rtoCode]);

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

    if (!selectedRtoCode) {
      toast.error('Please select an RTO');
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

    const result = await register(email, password, fullName, selectedRtoCode);

    if (result.success) {
      toast.success('Registration successful! Please check your email to verify your account.');
      setRegistrationComplete(true);
    } else {
      // Display user-friendly error message
      const errorMessage = result.error || 'Registration failed';
      console.error('[RegisterForm] Registration error:', errorMessage);
      
      if (errorMessage.toLowerCase().includes('already registered') || errorMessage.toLowerCase().includes('already exists')) {
        toast.error(
          'An account with this email already exists. Please sign in instead.',
          { duration: 6000 }
        );
        setAlreadyExists(true);
      } else {
        toast.error(errorMessage);
      }
    }
  };

  if (alreadyExists) {
    return (
      <div className="text-center space-y-6 py-4">
        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
          <svg className="w-8 h-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3a9 9 0 100 18 9 9 0 000-18z" />
          </svg>
        </div>
        <div>
          <h3 className="text-xl font-bold text-[#1e293b] mb-2">Account Already Exists</h3>
          <p className="text-[#64748b]">
            An account with <strong className="text-[#1e293b]">{email}</strong> already exists.
          </p>
        </div>
        <a
          href="/"
          className="inline-block bg-[#3b82f6] hover:bg-[#2563eb] text-white font-semibold py-2 px-6 rounded-md transition-colors"
        >
          Sign In
        </a>
      </div>
    );
  }

  if (registrationComplete) {
    return (
      <div className="text-center space-y-6 py-4">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
          <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <h3 className="text-xl font-bold text-[#1e293b] mb-2">Account Created!</h3>
          <p className="text-[#64748b]">
            We've sent a verification email to <strong className="text-[#1e293b]">{email}</strong>.
            Please check your inbox and click the link to activate your account.
          </p>
        </div>
        <p className="text-sm text-[#64748b]">
          Once verified, you can{' '}
          <a href="/" className="text-[#3b82f6] hover:underline font-semibold">sign in</a>{' '}
          to access the full Nytro platform.
        </p>
      </div>
    );
  }

  return (
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
        <Label htmlFor="rto" className="text-[#1e293b] font-semibold">
          RTO Assignment
        </Label>
        <select
          id="rto"
          value={selectedRtoCode}
          onChange={(e) => setSelectedRtoCode(e.target.value)}
          disabled={true}
          className="w-full px-3 py-2 mt-2 border border-[#dbeafe] rounded-md bg-[#f8f9fb] text-[#64748b] cursor-not-allowed"
          required
        >
          <option value="">
            {rtosLoading ? 'Loading RTO assignment...' : 'Select an RTO'}
          </option>
          {rtos.map((rto) => (
            <option key={rto.id} value={rto.code}>
              {rto.name} ({rto.code})
            </option>
          ))}
        </select>
        <p className="text-xs text-[#64748b] mt-1">
          {rtosLoading ? 'Loading...' : 'RTO automatically assigned during registration'}
        </p>
        {rtos.length === 0 && !rtosLoading && (
          <p className="text-xs text-red-500 mt-1">
            No RTOs available. Please contact support.
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="password" className="text-[#1e293b] font-semibold">
          Password
        </Label>
        <Input
          id="password"
          type="password"
          placeholder="••���•••••"
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

      {selectedRtoCode && !rtosLoading && (
        <Card className="border border-[#dbeafe] bg-[#eff6ff] p-4">
          <p className="text-sm text-[#1e293b]">
            <span className="font-semibold">Assigned RTO:</span> {rtos.find(r => r.code === selectedRtoCode)?.name || selectedRtoCode}
          </p>
          <p className="text-xs text-[#64748b] mt-1">
            Your account will be automatically associated with this RTO
          </p>
        </Card>
      )}

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
        disabled={isLoading || rtosLoading}
      >
        {isLoading ? 'Creating account...' : 'Create Account'}
      </Button>

      <p className="text-sm text-center text-[#64748b]">
        Already have an account?{' '}
        <a href="/login" className="text-[#3b82f6] hover:underline font-semibold">
          Sign in
        </a>
      </p>
    </form>
  );
}
