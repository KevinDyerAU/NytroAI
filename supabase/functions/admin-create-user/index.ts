import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { handleCors, createErrorResponse, createSuccessResponse } from '../_shared/cors.ts';

interface CreateUserRequest {
  email: string;
  fullName: string;
  rtoId?: number | null;
  rtoCode?: string | null;
  isAdmin?: boolean;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    if (req.method !== 'POST') {
      return createErrorResponse('Method not allowed', 405);
    }

    // Get the calling user's JWT to verify they are an admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return createErrorResponse('Missing authorization header', 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Use service role client for all operations
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Extract the JWT token and verify the caller's identity via the admin client
    const token = authHeader.replace('Bearer ', '');
    const { data: { user: callerUser }, error: callerError } = await adminClient.auth.getUser(token);
    if (callerError || !callerUser) {
      console.error('[admin-create-user] Token verification failed:', callerError?.message);
      return createErrorResponse('Unauthorized', 401);
    }

    console.log('[admin-create-user] Caller verified:', callerUser.email);

    // Check if caller is admin (use adminClient to bypass RLS)
    const { data: callerProfile, error: profileError } = await adminClient
      .from('user_profiles')
      .select('is_admin')
      .eq('id', callerUser.id)
      .single();

    if (profileError || !callerProfile?.is_admin) {
      console.error('[admin-create-user] Not admin:', profileError?.message || 'is_admin=false');
      return createErrorResponse('Only admins can create users', 403);
    }

    // Parse request body
    const body: CreateUserRequest = await req.json();
    const { email, fullName, rtoId, rtoCode, isAdmin } = body;

    if (!email || !fullName) {
      return createErrorResponse('Email and full name are required', 400);
    }

    // Create the auth user with a random password — they'll set their own via invite email
    // Using inviteUserByEmail sends a magic link / invite email automatically
    const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: {
        full_name: fullName,
        rto_code: rtoCode || null,
      },
      redirectTo: `${req.headers.get('origin') || supabaseUrl}/reset-password`,
    });

    if (inviteError) {
      console.error('[admin-create-user] Invite error:', inviteError.message);

      if (inviteError.message.includes('already been registered') || inviteError.message.includes('already exists')) {
        return createErrorResponse('A user with this email already exists', 409);
      }

      return createErrorResponse(inviteError.message, 400);
    }

    if (!inviteData?.user) {
      return createErrorResponse('Failed to create user — no user data returned', 500);
    }

    const newUserId = inviteData.user.id;
    console.log('[admin-create-user] Auth user created:', newUserId);

    // Create user_profile record
    const { error: insertError } = await adminClient
      .from('user_profiles')
      .insert({
        id: newUserId,
        email: email,
        full_name: fullName,
        rto_id: rtoId || null,
        rto_code: rtoCode || null,
        role: 'editor',
        is_admin: isAdmin || false,
        credits: 0,
      });

    if (insertError) {
      console.error('[admin-create-user] Profile insert error:', insertError.message);
      // User was created in auth but profile failed — try to clean up
      // Don't fail the whole request — the profile can be created later
      return createSuccessResponse({
        userId: newUserId,
        email: email,
        profileCreated: false,
        warning: `Auth user created but profile failed: ${insertError.message}`,
      });
    }

    console.log('[admin-create-user] User profile created successfully');

    return createSuccessResponse({
      userId: newUserId,
      email: email,
      fullName: fullName,
      rtoId: rtoId || null,
      isAdmin: isAdmin || false,
      profileCreated: true,
    });

  } catch (err) {
    console.error('[admin-create-user] Unexpected error:', err);
    return createErrorResponse(
      err instanceof Error ? err.message : 'Internal server error',
      500
    );
  }
});
