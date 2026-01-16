import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  rto_id?: number;
  rto_code?: string;
  role: 'admin' | 'editor' | 'viewer';
  credits: number;
  is_admin: boolean;
}

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  initialized: boolean;
  setUser: (user: AuthUser | null) => void;
  setLoading: (loading: boolean) => void;
  setInitialized: (initialized: boolean) => void;
  logout: () => void;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  initialized: false,
  setUser: (user) => {
    console.log('[AuthStore] setUser called:', user ? user.email : 'null');
    set({
      user,
      isAuthenticated: !!user,
    });
  },
  setLoading: (isLoading) => {
    console.log('[AuthStore] setLoading:', isLoading);
    set({ isLoading });
  },
  setInitialized: (initialized) => set({ initialized }),
  logout: () =>
    set({
      user: null,
      isAuthenticated: false,
    }),
  initialize: async () => {
    const state = get();
    if (state.initialized) {
      console.log('[AuthStore] Already initialized, skipping');
      return;
    }

    console.log('[AuthStore] Starting initialization...');
    set({ isLoading: true, initialized: true });

    try {
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

      if (authError) {
        // "Auth session missing" is a normal state when user is not logged in
        // Only log it as a warning, not an error
        if (authError.message === 'Auth session missing!' || authError.message.includes('session_not_found')) {
          console.log('[AuthStore] No active session - user not logged in');
          set({ isLoading: false, user: null, isAuthenticated: false });
          return;
        }

        // Log actual errors (corrupted sessions, refresh token failures, etc.)
        console.error('[AuthStore] Auth check error:', authError.message);

        // Clear corrupted sessions
        if (authError.message.includes('refresh token') || authError.message.includes('Refresh Token') || authError.message.includes('invalid')) {
          console.log('[AuthStore] Clearing corrupted session:', authError.message);
          // Sign out to clear any corrupted state
          await supabase.auth.signOut();
        }
        set({ isLoading: false });
        return;
      }

      console.log('[AuthStore] Auth check completed. User:', authUser ? authUser.email : 'Not authenticated');

      if (authUser) {
        try {
          console.log('[AuthStore] Fetching user profile...');
          const { data: profile, error: profileError } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', authUser.id)
            .single();

          if (profileError) {
            console.error('[AuthStore] Profile fetch error:', profileError.message);
          } else if (profile) {
            console.log('[AuthStore] Profile loaded:', profile.full_name);
            set({
              user: {
                id: authUser.id,
                email: authUser.email!,
                full_name: profile.full_name,
                rto_id: profile.rto_id,
                rto_code: profile.rto_code,
                role: profile.role,
                credits: profile.credits,
                is_admin: profile.is_admin ?? false,
              },
              isAuthenticated: true,
              isLoading: false,
            });
          }
        } catch (err) {
          console.error('[AuthStore] Error fetching profile:', err);
        }
      } else {
        set({ isLoading: false });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);

      // Only log as error if it's not a normal "no session" state
      if (errorMessage === 'Auth session missing!' || errorMessage.includes('session_not_found')) {
        console.log('[AuthStore] No active session - user not logged in');
      } else {
        console.error('[AuthStore] Unexpected error during auth check:', errorMessage);
      }

      set({ isLoading: false, user: null, isAuthenticated: false });
    }
  },
}));

// Set up Supabase session listener to keep auth state in sync
// Use a singleton pattern to prevent duplicate subscriptions
let authSubscription: { unsubscribe: () => void } | null = null;

if (typeof window !== 'undefined') {
  const initializeAuth = async () => {
    // Prevent duplicate initialization
    if (authSubscription) {
      console.log('[AuthStore] Already initialized, skipping');
      return;
    }

    const { initialize } = useAuthStore.getState();
    await initialize();

    // Subscribe to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Skip initial session event - initialization already handles it
        if (event === 'INITIAL_SESSION') {
          console.log('[AuthStore] Skipping INITIAL_SESSION - already initialized');
          return;
        }

        console.log('[AuthStore] ===== AUTH STATE CHANGE EVENT =====');
        console.log('[AuthStore] Event:', event);
        console.log('[AuthStore] Session:', session ? `${session.user.email}` : 'NO SESSION');
        console.log('[AuthStore] Current store state - isAuthenticated:', useAuthStore.getState().isAuthenticated);

        // Handle explicit sign out (token refresh failures are handled by session === null check below)
        if (event === 'SIGNED_OUT') {
          console.log('[AuthStore] SIGNED_OUT event - clearing auth state');
          useAuthStore.setState({
            user: null,
            isAuthenticated: false,
          });
          console.log('[AuthStore] ===== END AUTH STATE CHANGE (SIGNED OUT) =====');
          return;
        }

        // Handle sign in events with valid session
        if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.user) {
          const currentState = useAuthStore.getState();

          // Skip profile fetch if user is already authenticated with the same ID
          // This prevents unnecessary re-renders and state resets
          if (currentState.isAuthenticated && currentState.user?.id === session.user.id) {
            console.log('[AuthStore] User already authenticated, skipping profile refetch');
            console.log('[AuthStore] ===== END AUTH STATE CHANGE (NO ACTION) =====');
            return;
          }

          console.log('[AuthStore] Sign in event with valid session, fetching profile...');
          try {
            const { data: profile, error: profileError } = await supabase
              .from('user_profiles')
              .select('*')
              .eq('id', session.user.id)
              .single();

            if (!profileError && profile) {
              console.log('[AuthStore] Profile fetched, updating store state');
              const newState = {
                user: {
                  id: session.user.id,
                  email: session.user.email!,
                  full_name: profile.full_name,
                  rto_id: profile.rto_id,
                  rto_code: profile.rto_code,
                  role: profile.role,
                  credits: profile.credits,
                  is_admin: profile.is_admin ?? false,
                },
                isAuthenticated: true,
              };
              useAuthStore.setState(newState);
              console.log('[AuthStore] Store updated - isAuthenticated:', useAuthStore.getState().isAuthenticated);
            } else {
              console.error('[AuthStore] Profile fetch error:', profileError);
            }
          } catch (err) {
            console.error('[AuthStore] Error fetching profile:', err);
          }
        } else if (!session) {
          console.log('[AuthStore] No session in event, clearing auth state');
          useAuthStore.setState({
            user: null,
            isAuthenticated: false,
          });
        }
        console.log('[AuthStore] ===== END AUTH STATE CHANGE =====');
      }
    );

    // Store subscription for cleanup
    authSubscription = subscription;
  };

  initializeAuth();

  // Optional: Clean up on page unload (for Single Page Apps, this rarely happens)
  window.addEventListener('beforeunload', () => {
    if (authSubscription) {
      authSubscription.unsubscribe();
      authSubscription = null;
    }
  });
}
