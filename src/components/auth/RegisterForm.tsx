import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card } from '../ui/card';
import { useAuth } from '../../hooks/useAuth';
import { fetchRTOsFromSupabase, type RTO } from '../../types/rto';

// Direct signups get no RTO — admins assign users to RTOs after registration

export function RegisterForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const rtoCode = searchParams.get('rto') || '';

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [selectedRtoCode, setSelectedRtoCode] = useState(rtoCode || '');
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
        <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto">
          <svg className="w-8 h-8 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3a9 9 0 100 18 9 9 0 000-18z" />
          </svg>
        </div>
        <div>
          <h3 className="text-xl font-bold text-white mb-2">Account Already Exists</h3>
          <p className="text-slate-400">
            An account with <strong className="text-white">{email}</strong> already exists.
          </p>
        </div>
        <a
          href="/validate"
          className="inline-block bg-gradient-to-r from-teal-400 to-teal-500 hover:from-teal-500 hover:to-teal-600 text-nytro-dark font-bold py-2 px-6 rounded-md transition-all"
        >
          Sign In &amp; Upload Documents
        </a>
      </div>
    );
  }

  if (registrationComplete) {
    return (
      <div className="text-center space-y-6 py-4">
        <div className="w-16 h-16 bg-teal-500/20 rounded-full flex items-center justify-center mx-auto">
          <svg className="w-8 h-8 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <h3 className="text-xl font-bold text-white mb-2">Account Created!</h3>
          <p className="text-slate-400">
            We've sent a verification email to <strong className="text-white">{email}</strong>.
            Please check your inbox and click the link to activate your account.
          </p>
        </div>
        <p className="text-sm text-slate-400">
          Once verified, you can{' '}
          <a href="/" className="text-teal-400 hover:text-teal-300 font-semibold transition-colors">sign in</a>{' '}
          to access the full Nytro platform.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleRegister} className="space-y-6">
      <div>
        <Label htmlFor="fullName" className="text-slate-300 font-semibold">
          Full Name
        </Label>
        <Input
          id="fullName"
          type="text"
          placeholder="John Doe"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="mt-2 bg-slate-700/50 border-slate-600 text-white placeholder-slate-500 focus:border-teal-400 focus:ring-teal-400"
          required
        />
      </div>

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

      <div>
        <Label htmlFor="password" className="text-slate-300 font-semibold">
          Password
        </Label>
        <Input
          id="password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-2 bg-slate-700/50 border-slate-600 text-white placeholder-slate-500 focus:border-teal-400 focus:ring-teal-400"
          required
          minLength={8}
        />
        <p className="text-xs text-slate-500 mt-1">
          Must be at least 8 characters
        </p>
      </div>

      <div>
        <Label htmlFor="confirmPassword" className="text-slate-300 font-semibold">
          Confirm Password
        </Label>
        <Input
          id="confirmPassword"
          type="password"
          placeholder="••••••••"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="mt-2 bg-slate-700/50 border-slate-600 text-white placeholder-slate-500 focus:border-teal-400 focus:ring-teal-400"
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
          className="mt-1 w-4 h-4 rounded border-slate-600 bg-slate-700 accent-teal-400"
          required
        />
        <Label htmlFor="terms" className="text-sm text-slate-400 cursor-pointer">
          I agree to the Terms of Service and Privacy Policy
        </Label>
      </div>

      <Button
        type="submit"
        className="w-full bg-gradient-to-r from-teal-400 to-teal-500 hover:from-teal-500 hover:to-teal-600 text-nytro-dark font-bold py-2 h-auto uppercase tracking-wide"
        disabled={isLoading || rtosLoading}
      >
        {isLoading ? 'Creating account...' : 'Create Account'}
      </Button>

      <p className="text-sm text-center text-slate-400">
        Already have an account?{' '}
        <a href="/login" className="text-teal-400 hover:text-teal-300 font-semibold transition-colors">
          Sign in
        </a>
      </p>
    </form>
  );
}
