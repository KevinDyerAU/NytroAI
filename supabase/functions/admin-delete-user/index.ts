import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { handleCors, createErrorResponse, createSuccessResponse } from '../_shared/cors.ts';

interface DeleteUserRequest {
  userId: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    if (req.method !== 'POST') {
      return createErrorResponse('Method not allowed', 405);
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return createErrorResponse('Missing authorization header', 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Verify caller identity
    const token = authHeader.replace('Bearer ', '');
    const { data: { user: callerUser }, error: callerError } = await adminClient.auth.getUser(token);
    if (callerError || !callerUser) {
      console.error('[admin-delete-user] Token verification failed:', callerError?.message);
      return createErrorResponse('Unauthorized', 401);
    }

    // Verify caller is admin
    const { data: callerProfile, error: profileError } = await adminClient
      .from('user_profiles')
      .select('is_admin')
      .eq('id', callerUser.id)
      .single();

    if (profileError || !callerProfile?.is_admin) {
      return createErrorResponse('Only admins can delete users', 403);
    }

    const body: DeleteUserRequest = await req.json();
    const { userId } = body;

    if (!userId) {
      return createErrorResponse('userId is required', 400);
    }

    // Prevent self-deletion
    if (userId === callerUser.id) {
      return createErrorResponse('You cannot delete your own account', 400);
    }

    console.log('[admin-delete-user] Deleting user:', userId, 'by:', callerUser.email);

    // 1. Delete user_profile record first
    const { error: profileDeleteError } = await adminClient
      .from('user_profiles')
      .delete()
      .eq('id', userId);

    if (profileDeleteError) {
      console.error('[admin-delete-user] Profile delete error:', profileDeleteError.message);
      // Continue — still try to delete auth user
    }

    // 2. Delete the auth user
    const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(userId);

    if (authDeleteError) {
      console.error('[admin-delete-user] Auth delete error:', authDeleteError.message);
      return createErrorResponse(`Failed to delete auth user: ${authDeleteError.message}`, 500);
    }

    console.log('[admin-delete-user] User deleted successfully:', userId);

    return createSuccessResponse({
      deleted: true,
      userId,
    });

  } catch (err) {
    console.error('[admin-delete-user] Unexpected error:', err);
    return createErrorResponse(
      err instanceof Error ? err.message : 'Internal server error',
      500
    );
  }
});
