import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { AuthLayout } from '../components/auth/AuthLayout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useAuth } from '../hooks/useAuth';

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  const { updatePassword } = useAuth();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newPassword) {
      toast.error('Password is required');
      return;
    }

    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setIsResetting(true);
    const result = await updatePassword(newPassword);

    if (result.success) {
      toast.success('Password reset successfully!');
      navigate('/dashboard');
    } else {
      toast.error(result.error || 'Failed to reset password');
    }
    setIsResetting(false);
  };

  return (
    <AuthLayout
      title="Reset Password"
      subtitle="Enter your new password"
    >
      <form onSubmit={handleReset} className="space-y-6">
        <div>
          <Label htmlFor="newPassword" className="text-slate-300 font-semibold">
            New Password
          </Label>
          <Input
            id="newPassword"
            type="password"
            placeholder="••••••••"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
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

        <Button 
          type="submit" 
          className="w-full bg-gradient-to-r from-teal-400 to-teal-500 hover:from-teal-500 hover:to-teal-600 text-nytro-dark font-bold py-2 h-auto uppercase tracking-wide"
          disabled={isResetting}
        >
          {isResetting ? 'Resetting password...' : 'Reset Password'}
        </Button>
      </form>
    </AuthLayout>
  );
}
