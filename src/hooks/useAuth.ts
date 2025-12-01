import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/auth.store';

export function useAuth() {
  const { user, isLoading, isAuthenticated, logout } = useAuthStore();
  const [error, setError] = useState<string | null>(null);

  const login = async (email: string, password: string) => {
    console.log('[Auth] Login attempt for:', email);
    setError(null);
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        console.error('[Auth] Login error:', authError.message);
        throw authError;
      }

      if (!data.user) {
        console.error('[Auth] No user returned from login');
        throw new Error('Login failed - no user data returned');
      }

      console.log('[Auth] Login successful - auth state listener will update store');
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      console.error('[Auth] Login failed:', message);
      setError(message);
      return { success: false, error: message };
    }
  };

  const register = async (
    email: string,
    password: string,
    fullName: string,
    rtoCode: string
  ) => {
    setError(null);
    try {
      console.log('[Auth] Starting registration for email:', email);

      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            rto_code: rtoCode,
          },
        },
      });

      if (authError) {
        console.error('[Auth] Signup error:', authError.message);
        let userMessage = authError.message;

        if (authError.message.includes('invalid') && authError.message.includes('[email')) {
          userMessage = 'Please provide a valid email address';
        } else if (authError.message.includes('already registered')) {
          userMessage = 'This email address is already registered';
        } else if (authError.message.includes('password')) {
          userMessage = 'Password does not meet security requirements';
        }

        const error = new Error(userMessage);
        (error as any).originalError = authError;
        throw error;
      }

      if (!data.user) {
        console.error('[Auth] No user returned from signup');
        throw new Error('Signup failed - no user data returned');
      }

      console.log('[Auth] User signed up successfully:', data.user.id);

      let rtoId: number | null = null;
      if (rtoCode) {
        console.log('[Auth] Looking up RTO ID for code:', rtoCode);
        const { data: rtoData, error: rtoError } = await supabase
          .from('RTO')
          .select('id, code')
          .eq('code', rtoCode)
          .single();

        if (rtoError) {
          console.error('[Auth] RTO lookup failed:', rtoError.message);
        } else if (rtoData) {
          console.log('[Auth] RTO lookup successful:', rtoData.code);
          rtoId = rtoData.id;
        }
      }

      const { error: profileError } = await supabase
        .from('user_profiles')
        .insert({
          id: data.user.id,
          email: email,
          full_name: fullName,
          rto_id: rtoId,
          rto_code: rtoCode,
          role: 'editor',
          credits: 0,
        });

      if (profileError) {
        console.error('[Auth] Profile creation error:', profileError.message);
        throw new Error(`Failed to create user profile: ${profileError.message}`);
      }

      console.log('[Auth] User profile created successfully');
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed';
      console.error('[Auth] Registration failed:', message);
      setError(message);
      return { success: false, error: message };
    }
  };

  const resetPassword = async (email: string) => {
    setError(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Password reset failed';
      setError(message);
      return { success: false, error: message };
    }
  };

  const updatePassword = async (newPassword: string) => {
    setError(null);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Password update failed';
      setError(message);
      return { success: false, error: message };
    }
  };

  const logoutUser = async () => {
    setError(null);
    try {
      console.log('[Auth] Logging out...');
      
      // Add timeout to prevent hanging on network issues
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Logout timeout')), 5000)
      );
      
      const signOutPromise = supabase.auth.signOut();
      
      try {
        const { error } = await Promise.race([signOutPromise, timeoutPromise]) as any;
        if (error) {
          console.error('[Auth] Supabase signOut error:', error);
          // Don't throw - still do local logout
        } else {
          console.log('[Auth] Supabase signOut successful');
        }
      } catch (timeoutError) {
        console.warn('[Auth] Logout request timed out, forcing local logout');
      }
      
      // Always clear local state, even if remote signout failed
      console.log('[Auth] Clearing local state');
      logout();
      console.log('[Auth] Logout complete');
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Logout failed';
      console.error('[Auth] Logout failed:', message);
      // Still try to clear local state
      logout();
      setError(message);
      return { success: false, error: message };
    }
  };

  return {
    user,
    isLoading,
    isAuthenticated,
    error,
    login,
    register,
    resetPassword,
    updatePassword,
    logout: logoutUser,
  };
}
