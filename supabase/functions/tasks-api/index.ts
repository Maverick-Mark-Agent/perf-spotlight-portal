import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
}

const TASKS_API_KEY = Deno.env.get('TASKS_API_KEY')

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Verify API key
  const apiKey = req.headers.get('x-api-key')
  if (apiKey !== TASKS_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const url = new URL(req.url)
  const method = req.method

  try {
    // GET /tasks-api - List tasks
    if (method === 'GET') {
      const status = url.searchParams.get('status')
      const assignee = url.searchParams.get('assignee')
      const dueBefore = url.searchParams.get('due_before')
      const visibility = url.searchParams.get('visibility')

      let query = supabase.from('tasks').select('*')

      if (status) query = query.eq('status', status)
      if (assignee) query = query.eq('assignee_name', assignee)
      if (dueBefore) query = query.lte('due_date', dueBefore)
      if (visibility) query = query.eq('visibility', visibility)

      // IMPORTANT: By default, exclude private tasks for privacy protection
      // Only show team and internal tasks unless visibility filter is explicitly set
      if (!visibility) {
        query = query.in('visibility', ['team', 'internal'])
      }

      const { data, error } = await query.order('created_at', { ascending: false })

      if (error) throw error
      return new Response(
        JSON.stringify({ tasks: data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // POST /tasks-api - Create task
    if (method === 'POST') {
      const body = await req.json()

      // PRIVACY PROTECTION: Prevent creating private tasks via API
      if (body.visibility === 'private') {
        return new Response(
          JSON.stringify({ error: 'Cannot create private tasks via API. Use the dashboard for private tasks.' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Set default visibility to 'team' if not specified
      if (!body.visibility) {
        body.visibility = 'team'
      }

      // Set default source if not provided
      if (!body.source) {
        body.source = {
          type: 'kit',
          date: new Date().toISOString().split('T')[0]
        }
      }

      const { data, error } = await supabase
        .from('tasks')
        .insert(body)
        .select()
        .single()

      if (error) throw error
      return new Response(
        JSON.stringify({ task: data }),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // PATCH /tasks-api?id=xxx - Update task
    if (method === 'PATCH') {
      const id = url.searchParams.get('id')
      if (!id) throw new Error('Task ID required')

      const body = await req.json()

      // PRIVACY PROTECTION: Prevent changing visibility to private via API
      if (body.visibility === 'private') {
        return new Response(
          JSON.stringify({ error: 'Cannot set tasks to private via API. Use the dashboard for private tasks.' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Handle task completion
      if (body.status === 'done' && !body.completed_at) {
        body.completed_at = new Date().toISOString()

        // For recurring tasks, update last_completed
        const { data: task } = await supabase
          .from('tasks')
          .select('is_recurring')
          .eq('id', id)
          .single()

        if (task?.is_recurring) {
          body.last_completed = new Date().toISOString().split('T')[0]
        }
      } else if (body.status && body.status !== 'done') {
        body.completed_at = null
      }

      const { data, error } = await supabase
        .from('tasks')
        .update(body)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return new Response(
        JSON.stringify({ task: data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // DELETE /tasks-api?id=xxx - Delete task
    if (method === 'DELETE') {
      const id = url.searchParams.get('id')
      if (!id) throw new Error('Task ID required')

      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', id)

      if (error) throw error
      return new Response(
        JSON.stringify({ ok: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
