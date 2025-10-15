import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MAVERICK_BISON_API_KEY = Deno.env.get('MAVERICK_BISON_API_KEY')!
const LONG_RUN_BISON_API_KEY = Deno.env.get('LONG_RUN_BISON_API_KEY')!
const MAVERICK_BASE_URL = 'https://send.maverickmarketingllc.com/api'
const LONGRUN_BASE_URL = 'https://send.longrun.agency/api'

async function checkInstance(instanceName: string, baseUrl: string, apiKey: string) {
  console.log(`\n=== Checking ${instanceName} Instance ===`)

  const results: any[] = []

  try {
    // Get all workspaces
    const workspacesResponse = await fetch(`${baseUrl}/workspaces`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json'
      }
    })

    if (!workspacesResponse.ok) {
      const errorText = await workspacesResponse.text()
      console.log(`Failed to fetch workspaces: ${workspacesResponse.status}`)
      return { instance: instanceName, error: errorText, workspaces: [] }
    }

    const workspacesData = await workspacesResponse.json()
    const workspaces = workspacesData.data || []

    console.log(`Found ${workspaces.length} workspaces in ${instanceName}`)
    workspaces.forEach((ws: any) => {
      console.log(`  - ${ws.name} (ID: ${ws.id})`)
    })

    // Specifically try workspace 14 if this is Long Run
    if (instanceName === 'Long Run') {
      console.log('\nSpecifically checking workspace 14...')
      const switchResponse = await fetch(`${baseUrl}/workspaces/v1.1/switch-workspace`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ team_id: 14 })
      })

      if (switchResponse.ok) {
        console.log('✓ Successfully switched to workspace 14')

        const emailsResponse = await fetch(`${baseUrl}/sender-emails?per_page=100`, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Accept': 'application/json'
          }
        })

        if (emailsResponse.ok) {
          const emailsData = await emailsResponse.json()
          const accounts = emailsData.data || []
          console.log(`Workspace 14 has ${accounts.length} accounts`)
          console.log('Sample emails:', accounts.slice(0, 3).map((a: any) => a.email).join(', '))

          const empowerEmails = accounts.filter((acc: any) =>
            acc.email?.includes('empowerworkspark') || acc.email?.includes('lesley.redman')
          )

          if (empowerEmails.length > 0) {
            console.log(`✅ FOUND ${empowerEmails.length} empowerworkspark emails in workspace 14!`)
          }
        }
      } else {
        console.log('✗ Could not switch to workspace 14')
      }
    }

    // Check all visible workspaces
    for (const workspace of workspaces) {
      const switchResponse = await fetch(`${baseUrl}/workspaces/v1.1/switch-workspace`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ team_id: workspace.id })
      })

      if (!switchResponse.ok) continue

      const emailsResponse = await fetch(`${baseUrl}/sender-emails?per_page=100`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json'
        }
      })

      if (!emailsResponse.ok) continue

      const emailsData = await emailsResponse.json()
      const accounts = emailsData.data || []

      const empowerEmails = accounts.filter((acc: any) =>
        acc.email?.includes('empowerworkspark') || acc.email?.includes('lesley.redman')
      )

      if (empowerEmails.length > 0) {
        console.log(`\n✅ FOUND in ${workspace.name} (ID: ${workspace.id})!`)
        console.log(`   Empowerworkspark emails: ${empowerEmails.length}`)
        empowerEmails.slice(0, 5).forEach((acc: any) => {
          console.log(`   - ${acc.email}`)
        })

        results.push({
          found: true,
          instance: instanceName,
          workspaceName: workspace.name,
          workspaceId: workspace.id,
          empowerEmailCount: empowerEmails.length,
          sampleEmails: empowerEmails.slice(0, 5).map((a: any) => a.email)
        })
      }
    }

    return { instance: instanceName, workspaces: workspaces.map((w: any) => ({ name: w.name, id: w.id })), results }

  } catch (error) {
    console.error(`Error checking ${instanceName}:`, error)
    return { instance: instanceName, error: error.message, workspaces: [] }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('=== Comprehensive Workspark Search ===')

    // Check both instances
    const longRunResults = await checkInstance('Long Run', LONGRUN_BASE_URL, LONG_RUN_BISON_API_KEY)
    const maverickResults = await checkInstance('Maverick', MAVERICK_BASE_URL, MAVERICK_BISON_API_KEY)

    const allResults = [
      ...(longRunResults.results || []),
      ...(maverickResults.results || [])
    ]

    if (allResults.length > 0) {
      return new Response(
        JSON.stringify({
          found: true,
          results: allResults
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        found: false,
        message: 'No empowerworkspark.com emails found in any workspace',
        longRun: longRunResults,
        maverick: maverickResults
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
