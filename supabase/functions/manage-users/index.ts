// =====================================================
// USER MANAGEMENT EDGE FUNCTION
// =====================================================
// Securely handles user management operations that require
// service role access, only accessible to admin users
// =====================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Verify authentication
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    // Get Supabase clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Client with user's auth for checking permissions
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    })

    // Client with service role for admin operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()
    if (authError || !user) {
      throw new Error('Unauthorized: Invalid or missing authentication')
    }

    // 2. Verify user is an admin
    // TEMPORARY: Hardcode Tommy as admin
    if (user.id === '09322929-6078-4b08-bd55-e3e1ff773028') {
      console.log('[manage-users] Hardcoded admin for Tommy');
      // Skip database check, proceed as admin
    } else {
      const { data: adminCheck, error: adminError } = await supabaseAuth
        .from('user_workspace_access')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle()

      if (adminError || !adminCheck) {
        throw new Error('Forbidden: Admin access required')
      }
    }

    // 3. Parse request
    const { action, ...params } = await req.json()

    let result

    switch (action) {
      case 'list_users': {
        // List all users with their workspace access
        const { data: authUsers, error: usersError } = await supabaseAdmin.auth.admin.listUsers()

        if (usersError) throw usersError

        // Get workspace access for each user
        const usersWithWorkspaces = await Promise.all(
          authUsers.users.map(async (authUser) => {
            const { data: workspaceData } = await supabaseAdmin
              .from('user_workspace_access')
              .select('workspace_name, role')
              .eq('user_id', authUser.id)

            return {
              id: authUser.id,
              email: authUser.email || '',
              created_at: authUser.created_at,
              workspaces: workspaceData || [],
            }
          })
        )

        result = { users: usersWithWorkspaces }
        break
      }

      case 'add_workspace_access': {
        const { user_id, workspace_name, role } = params

        if (!user_id || !workspace_name || !role) {
          throw new Error('Missing required parameters: user_id, workspace_name, role')
        }

        const { error: insertError } = await supabaseAdmin
          .from('user_workspace_access')
          .insert({
            user_id,
            workspace_name,
            role,
            created_by: user.id,
          })

        if (insertError) throw insertError

        result = { success: true }
        break
      }

      case 'remove_workspace_access': {
        const { user_id, workspace_name } = params

        if (!user_id || !workspace_name) {
          throw new Error('Missing required parameters: user_id, workspace_name')
        }

        const { error: deleteError } = await supabaseAdmin
          .from('user_workspace_access')
          .delete()
          .eq('user_id', user_id)
          .eq('workspace_name', workspace_name)

        if (deleteError) throw deleteError

        result = { success: true }
        break
      }

      default:
        throw new Error(`Unknown action: ${action}`)
    }

    return new Response(
      JSON.stringify(result),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    )
  } catch (error: any) {
    console.error('Error in manage-users:', error)

    return new Response(
      JSON.stringify({
        error: error.message || 'An error occurred',
      }),
      {
        status: error.message?.includes('Unauthorized') ? 401 :
                error.message?.includes('Forbidden') ? 403 : 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    )
  }
})
