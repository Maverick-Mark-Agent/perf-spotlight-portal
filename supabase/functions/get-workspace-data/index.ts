// =====================================================
// SECURE WORKSPACE DATA EDGE FUNCTION
// =====================================================
// This Edge Function handles all Email Bison API calls
// securely on the server-side, keeping API keys hidden
// from client-side code.
// =====================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Email Bison API Configuration
// TODO: Move these to Supabase Secrets (encrypted environment variables)
const BISON_API_KEY = "77|AqozJcNT8l2m52CRyvQyEEmLKa49ofuZRjK98aio8a3feb5d";
const BISON_BASE_URL = "https://send.maverickmarketingllc.com/api";

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

    // Get Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    })

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      throw new Error('Unauthorized: Invalid or missing authentication')
    }

    // 2. Parse request body
    const { action, workspace_name } = await req.json()

    // 3. Verify user has access to requested workspace (if workspace specified)
    if (workspace_name) {
      const { data: accessData, error: accessError } = await supabase
        .from('user_workspace_access')
        .select('*')
        .eq('user_id', user.id)
        .eq('workspace_name', workspace_name)
        .single()

      if (accessError || !accessData) {
        throw new Error(`Access denied: You don't have permission to access workspace "${workspace_name}"`)
      }
    }

    // 4. Handle different actions
    let result

    switch (action) {
      case 'list_workspaces': {
        // Get all workspaces from Email Bison
        const response = await fetch(`${BISON_BASE_URL}/workspaces`, {
          headers: {
            'Authorization': `Bearer ${BISON_API_KEY}`,
            'Accept': 'application/json',
          },
        })

        if (!response.ok) {
          throw new Error('Failed to fetch workspaces from Email Bison')
        }

        const data = await response.json()

        // Get user's accessible workspaces from database
        const { data: userWorkspaces, error: workspaceError } = await supabase
          .from('user_workspace_access')
          .select('workspace_name')
          .eq('user_id', user.id)

        if (workspaceError) throw workspaceError

        const allowedWorkspaces = new Set(
          userWorkspaces.map((w: any) => w.workspace_name)
        )

        // Filter to only show workspaces user has access to
        const filteredWorkspaces = data.data.filter((w: any) =>
          allowedWorkspaces.has(w.name)
        )

        result = { data: filteredWorkspaces }
        break
      }

      case 'get_workspace_details': {
        if (!workspace_name) {
          throw new Error('workspace_name is required for get_workspace_details')
        }

        // Get workspace details from Email Bison
        const response = await fetch(`${BISON_BASE_URL}/workspaces`, {
          headers: {
            'Authorization': `Bearer ${BISON_API_KEY}`,
            'Accept': 'application/json',
          },
        })

        if (!response.ok) {
          throw new Error('Failed to fetch workspace details from Email Bison')
        }

        const data = await response.json()
        const workspace = data.data.find((w: any) => w.name === workspace_name)

        if (!workspace) {
          throw new Error(`Workspace "${workspace_name}" not found`)
        }

        result = { data: workspace }
        break
      }

      case 'get_user_workspaces': {
        // Get user's workspaces with lead counts
        const { data: workspaces, error } = await supabase.rpc('get_user_workspaces', {
          p_user_id: user.id
        })

        if (error) throw error

        result = { data: workspaces }
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
    console.error('Error in get-workspace-data:', error)

    return new Response(
      JSON.stringify({
        error: error.message || 'An error occurred',
      }),
      {
        status: error.message?.includes('Unauthorized') ? 401 :
                error.message?.includes('Access denied') ? 403 : 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    )
  }
})
