import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const LONG_RUN_BISON_API_KEY = Deno.env.get('LONG_RUN_BISON_API_KEY')!
const LONGRUN_BASE_URL = 'https://send.longrun.agency/api'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('=== Finding Correct Workspark Workspace ===')

    // First, get all workspaces
    console.log('1. Fetching all available workspaces...')
    const workspacesResponse = await fetch(`${LONGRUN_BASE_URL}/workspaces`, {
      headers: {
        'Authorization': `Bearer ${LONG_RUN_BISON_API_KEY}`,
        'Accept': 'application/json'
      }
    })

    if (!workspacesResponse.ok) {
      const errorText = await workspacesResponse.text()
      throw new Error(`Failed to fetch workspaces: ${workspacesResponse.status} - ${errorText}`)
    }

    const workspacesData = await workspacesResponse.json()
    const workspaces = workspacesData.data || []

    console.log(`Found ${workspaces.length} workspaces`)

    const results = []

    // Check each workspace for empowerworkspark.com emails
    for (const workspace of workspaces) {
      console.log(`Checking workspace: ${workspace.name} (ID: ${workspace.id})...`)

      // Switch to this workspace
      const switchResponse = await fetch(`${LONGRUN_BASE_URL}/workspaces/v1.1/switch-workspace`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LONG_RUN_BISON_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ team_id: workspace.id })
      })

      if (!switchResponse.ok) {
        console.log(`Could not switch to workspace ${workspace.id}`)
        continue
      }

      // Fetch sender emails (first page only for speed)
      const emailsResponse = await fetch(`${LONGRUN_BASE_URL}/sender-emails?per_page=100`, {
        headers: {
          'Authorization': `Bearer ${LONG_RUN_BISON_API_KEY}`,
          'Accept': 'application/json'
        }
      })

      if (!emailsResponse.ok) {
        console.log(`Could not fetch emails from workspace ${workspace.id}`)
        continue
      }

      const emailsData = await emailsResponse.json()
      const accounts = emailsData.data || []

      // Check for empowerworkspark.com or lesley.redman
      const empowerEmails = accounts.filter((acc: any) =>
        acc.email?.includes('empowerworkspark.com') || acc.email?.includes('lesley.redman')
      )

      if (empowerEmails.length > 0) {
        console.log(`✅ FOUND WORKSPARK WORKSPACE!`)
        console.log(`Workspace Name: ${workspace.name}`)
        console.log(`Workspace ID: ${workspace.id}`)

        const result = {
          found: true,
          workspaceName: workspace.name,
          workspaceId: workspace.id,
          totalAccounts: emailsData.total || accounts.length,
          empowerEmailCount: empowerEmails.length,
          sampleEmails: empowerEmails.slice(0, 5).map((acc: any) => acc.email)
        }

        results.push(result)

        return new Response(
          JSON.stringify(result),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      results.push({
        workspaceName: workspace.name,
        workspaceId: workspace.id,
        totalAccounts: accounts.length,
        empowerEmailCount: 0
      })
    }

    // If we get here, we didn't find it
    return new Response(
      JSON.stringify({
        found: false,
        message: 'Could not find empowerworkspark.com emails in any workspace',
        workspacesChecked: results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
