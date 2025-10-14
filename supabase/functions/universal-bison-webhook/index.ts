import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const startTime = Date.now()
  let webhookLogId: string | null = null

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Parse webhook payload
    const payload = await req.json()
    const eventType = payload.event?.type?.toLowerCase() // Normalize to lowercase for consistent handling
    const workspaceName = payload.event?.workspace_name || 'Unknown'

    console.log(`📨 Webhook received: ${eventType} for ${workspaceName}`)

    // Log webhook delivery
    const { data: logData } = await supabase
      .from('webhook_delivery_log')
      .insert({
        event_type: eventType,
        workspace_name: workspaceName,
        payload: payload,
        success: false, // Will update to true if processing succeeds
      })
      .select('id')
      .single()

    webhookLogId = logData?.id

    // Route to appropriate handler based on event type
    let result
    switch (eventType) {
      // ========================================
      // KPI EVENTS (5 events)
      // ========================================

      case 'email_sent':
        result = await handleEmailSent(supabase, payload)
        break

      case 'lead_replied':
        result = await handleLeadReplied(supabase, payload)
        break

      case 'lead_interested':
        result = await handleLeadInterested(supabase, payload)
        break

      case 'email_bounced':
        result = await handleEmailBounced(supabase, payload)
        break

      case 'lead_unsubscribed':
        result = await handleLeadUnsubscribed(supabase, payload)
        break

      // ========================================
      // INFRASTRUCTURE EVENTS (3 events)
      // ========================================

      case 'email_account_added':
        result = await handleAccountAdded(supabase, payload)
        break

      case 'email_account_disconnected':
        result = await handleAccountDisconnected(supabase, payload)
        break

      case 'email_account_reconnected':
        result = await handleAccountReconnected(supabase, payload)
        break

      default:
        console.warn(`⚠️ Unknown event type: ${eventType}`)
        return new Response(
          JSON.stringify({ error: 'Unknown event type', received: eventType }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    const processingTime = Date.now() - startTime

    // Update webhook log as successful
    if (webhookLogId) {
      await supabase
        .from('webhook_delivery_log')
        .update({
          success: true,
          processing_time_ms: processingTime,
        })
        .eq('id', webhookLogId)
    }

    // Update workspace webhook health
    await updateWebhookHealth(supabase, workspaceName, true, null)

    console.log(`✅ Webhook processed successfully in ${processingTime}ms`)

    return new Response(
      JSON.stringify({ success: true, ...result, processing_time_ms: processingTime }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    const processingTime = Date.now() - startTime
    console.error('❌ Webhook processing error:', error)

    // Update webhook log with error
    if (webhookLogId) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      const supabase = createClient(supabaseUrl, supabaseKey)

      await supabase
        .from('webhook_delivery_log')
        .update({
          success: false,
          processing_time_ms: processingTime,
          error_message: error.message,
        })
        .eq('id', webhookLogId)

      // Update webhook health with error
      const workspaceName = await getWorkspaceNameFromLog(supabase, webhookLogId)
      await updateWebhookHealth(supabase, workspaceName, false, error.message)
    }

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// ========================================
// KPI EVENT HANDLERS
// ========================================

async function handleEmailSent(supabase: any, payload: any) {
  const workspaceName = payload.event?.workspace_name

  // Increment emails_sent_mtd counter
  await supabase.rpc('increment_metric', {
    p_workspace_name: workspaceName,
    p_metric_name: 'emails_sent_mtd',
    p_increment_by: 1
  })

  console.log(`📧 Email sent recorded for ${workspaceName}`)
  return { message: 'Email sent count incremented' }
}

async function handleLeadReplied(supabase: any, payload: any) {
  const workspaceName = payload.event?.workspace_name
  const lead = payload.data?.lead
  const reply = payload.data?.reply

  // Increment replies_mtd counter
  await supabase.rpc('increment_metric', {
    p_workspace_name: workspaceName,
    p_metric_name: 'replies_mtd',
    p_increment_by: 1
  })

  // Update or create lead with replied status
  if (lead && lead.email) {
    const conversationUrl = payload.event?.instance_url
      ? `${payload.event.instance_url}/workspaces/${payload.event.workspace_id}/leads/${lead.id}`
      : null

    await supabase
      .from('client_leads')
      .upsert({
        workspace_name: workspaceName,
        lead_email: lead.email,
        first_name: lead.first_name,
        last_name: lead.last_name,
        company: lead.company,
        title: lead.title,
        pipeline_stage: 'replied',
        bison_conversation_url: conversationUrl,
        date_received: reply?.date_received || new Date().toISOString(),
      }, {
        onConflict: 'workspace_name,lead_email',
        ignoreDuplicates: false
      })
  }

  console.log(`💬 Reply recorded for ${workspaceName}`)
  return { message: 'Reply count incremented and lead updated' }
}

async function handleLeadInterested(supabase: any, payload: any) {
  const workspaceName = payload.event?.workspace_name
  const lead = payload.data?.lead
  const reply = payload.data?.reply

  if (!lead || !lead.email) {
    throw new Error('Missing lead data in interested webhook')
  }

  // Increment interested_mtd counter
  await supabase.rpc('increment_metric', {
    p_workspace_name: workspaceName,
    p_metric_name: 'interested_mtd',
    p_increment_by: 1
  })

  // Build conversation URL using reply UUID (same format as n8n workflow)
  const conversationUrl = reply?.uuid
    ? `https://send.maverickmarketingllc.com/inbox?reply_uuid=${reply.uuid}`
    : (payload.event?.instance_url
      ? `${payload.event.instance_url}/workspaces/${payload.event.workspace_id}/leads/${lead.id}`
      : null)

  // Extract phone from custom variables
  const phoneVariable = lead.custom_variables?.find((v: any) =>
    v.name?.toLowerCase() === 'phone' || v.name?.toLowerCase() === 'phone_number'
  )

  // Upsert lead with interested status
  const { error } = await supabase
    .from('client_leads')
    .upsert({
      workspace_name: workspaceName,
      first_name: lead.first_name,
      last_name: lead.last_name,
      lead_email: lead.email,
      phone: phoneVariable?.value || null,
      title: lead.title,
      company: lead.company,
      custom_variables: lead.custom_variables,
      bison_conversation_url: conversationUrl,
      pipeline_stage: 'interested',
      date_received: reply?.date_received ?? new Date().toISOString(),
      lead_value: 0,
      tags: null,
      interested: true,
    }, {
      onConflict: 'workspace_name,lead_email',
      ignoreDuplicates: false
    })

  if (error) throw error

  console.log(`⭐ Interested lead recorded for ${workspaceName}: ${lead.email}`)

  // Send Slack notification if webhook URL is configured
  await sendSlackNotification(supabase, workspaceName, lead, reply)

  return { message: 'Interested lead recorded', lead_email: lead.email }
}

async function handleEmailBounced(supabase: any, payload: any) {
  const workspaceName = payload.event?.workspace_name
  const lead = payload.data?.lead

  // Increment bounces_mtd counter
  await supabase.rpc('increment_metric', {
    p_workspace_name: workspaceName,
    p_metric_name: 'bounces_mtd',
    p_increment_by: 1
  })

  // Update lead status if we have the email
  if (lead && lead.email) {
    await supabase
      .from('client_leads')
      .update({ pipeline_stage: 'bounced' })
      .eq('workspace_name', workspaceName)
      .eq('lead_email', lead.email)
  }

  console.log(`🔙 Bounce recorded for ${workspaceName}`)
  return { message: 'Bounce count incremented' }
}

async function handleLeadUnsubscribed(supabase: any, payload: any) {
  const workspaceName = payload.event?.workspace_name
  const lead = payload.data?.lead

  // Increment unsubscribes_mtd counter
  await supabase.rpc('increment_metric', {
    p_workspace_name: workspaceName,
    p_metric_name: 'unsubscribes_mtd',
    p_increment_by: 1
  })

  // Update lead status if we have the email
  if (lead && lead.email) {
    await supabase
      .from('client_leads')
      .update({ pipeline_stage: 'unsubscribed' })
      .eq('workspace_name', workspaceName)
      .eq('lead_email', lead.email)
  }

  console.log(`🚫 Unsubscribe recorded for ${workspaceName}`)
  return { message: 'Unsubscribe count incremented' }
}

// ========================================
// INFRASTRUCTURE EVENT HANDLERS
// ========================================

async function handleAccountAdded(supabase: any, payload: any) {
  const workspaceName = payload.event?.workspace_name
  const account = payload.data?.sender_email

  if (!account) {
    throw new Error('Missing sender_email data in account_added webhook')
  }

  console.log(`✨ New account added: ${account.email} for ${workspaceName}`)

  // Log the event (will be fetched during next polling cycle)
  return { message: 'Account added event logged', email: account.email }
}

async function handleAccountDisconnected(supabase: any, payload: any) {
  const workspaceName = payload.event?.workspace_name
  const account = payload.data?.sender_email

  if (!account) {
    throw new Error('Missing sender_email data in account_disconnected webhook')
  }

  // Update account status in cache if it exists
  await supabase
    .from('sender_emails_cache')
    .update({
      status: 'Disconnected',
      updated_at: new Date().toISOString()
    })
    .eq('workspace_name', workspaceName)
    .eq('email_address', account.email)

  console.log(`🚨 Account disconnected: ${account.email} for ${workspaceName}`)

  // TODO: Send Slack alert for critical disconnections
  // await sendSlackAlert(`🚨 Account disconnected: ${account.email} (${workspaceName})`)

  return { message: 'Account marked as disconnected', email: account.email }
}

async function handleAccountReconnected(supabase: any, payload: any) {
  const workspaceName = payload.event?.workspace_name
  const account = payload.data?.sender_email

  if (!account) {
    throw new Error('Missing sender_email data in account_reconnected webhook')
  }

  // Update account status in cache if it exists
  await supabase
    .from('sender_emails_cache')
    .update({
      status: 'Connected',
      updated_at: new Date().toISOString()
    })
    .eq('workspace_name', workspaceName)
    .eq('email_address', account.email)

  console.log(`✅ Account reconnected: ${account.email} for ${workspaceName}`)

  return { message: 'Account marked as connected', email: account.email }
}

// ========================================
// HELPER FUNCTIONS
// ========================================

async function updateWebhookHealth(supabase: any, workspaceName: string, success: boolean, errorMessage: string | null) {
  const now = new Date().toISOString()

  // Get current health record
  const { data: current } = await supabase
    .from('webhook_health')
    .select('*')
    .eq('workspace_name', workspaceName)
    .single()

  if (current) {
    // Calculate new success rate (rolling 24h window)
    const successRate = success
      ? Math.min(100, current.success_rate_24h + 1)
      : Math.max(0, current.success_rate_24h - 5) // Penalize failures more

    const isHealthy = successRate >= 95

    await supabase
      .from('webhook_health')
      .update({
        last_webhook_at: now,
        webhook_count_24h: current.webhook_count_24h + 1,
        success_rate_24h: successRate,
        is_healthy: isHealthy,
        last_error_message: success ? null : errorMessage,
        updated_at: now
      })
      .eq('workspace_name', workspaceName)
  } else {
    // Create new health record
    await supabase
      .from('webhook_health')
      .insert({
        workspace_name: workspaceName,
        last_webhook_at: now,
        webhook_count_24h: 1,
        success_rate_24h: success ? 100 : 80,
        is_healthy: success,
        last_error_message: success ? null : errorMessage
      })
  }
}

async function getWorkspaceNameFromLog(supabase: any, logId: string): Promise<string> {
  const { data } = await supabase
    .from('webhook_delivery_log')
    .select('workspace_name')
    .eq('id', logId)
    .single()

  return data?.workspace_name || 'Unknown'
}

async function sendSlackNotification(supabase: any, workspaceName: string, lead: any, reply: any) {
  try {
    // Get the Slack webhook URL for this workspace
    const { data: client } = await supabase
      .from('client_registry')
      .select('slack_webhook_url')
      .eq('workspace_name', workspaceName)
      .single()

    const slackWebhookUrl = client?.slack_webhook_url

    if (!slackWebhookUrl) {
      console.log(`No Slack webhook configured for ${workspaceName}`)
      return
    }

    // Extract custom variables
    const getCustomVar = (name: string) => {
      const variable = lead.custom_variables?.find((v: any) =>
        v.name?.toLowerCase() === name.toLowerCase()
      )
      return variable?.value || 'N/A'
    }

    // Clean the reply text using OpenAI
    const replyPreview = await cleanReplyWithAI(reply?.text_body || reply?.body_plain || 'No reply text available')

    // Build the conversation URL (reply URL)
    const replyUrl = reply?.uuid
      ? `https://send.maverickmarketingllc.com/inbox?reply_uuid=${reply.uuid}`
      : null

    // Build the Slack message matching your format
    const slackMessage = {
      text: ':fire: New Lead!',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `:fire: *New Lead!*\n*Name:* ${lead.first_name || ''} ${lead.last_name || ''}\n*Email:* ${lead.email}\n*Birthday:* ${getCustomVar('birthday')}\n*Address:* ${getCustomVar('address')}\n*City:* ${getCustomVar('city')}\n*State:* ${getCustomVar('state')}\n*ZIP:* ${getCustomVar('zip')}\n*Renewal Date:* ${getCustomVar('renewal_date')}\n*Phone:* ${getCustomVar('phone')}\n\n*Reply Preview:*\n${replyPreview}`
          }
        },
        ...(replyUrl ? [
          {
            type: 'divider'
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: 'Respond',
                  emoji: true
                },
                url: replyUrl,
                action_id: 'respond_button'
              }
            ]
          }
        ] : [])
      ]
    }

    // Send to Slack
    const slackResponse = await fetch(slackWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(slackMessage)
    })

    if (!slackResponse.ok) {
      console.error(`Failed to send Slack notification: ${slackResponse.status} ${slackResponse.statusText}`)
    } else {
      console.log(`✅ Slack notification sent for ${workspaceName}: ${lead.email}`)
    }
  } catch (error) {
    console.error(`Error sending Slack notification for ${workspaceName}:`, error)
    // Don't throw - we don't want Slack failures to break webhook processing
  }
}

async function cleanReplyWithAI(emailBody: string): Promise<string> {
  try {
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')

    if (!openaiApiKey) {
      console.warn('OpenAI API key not configured, using raw reply text')
      return emailBody.substring(0, 200) + (emailBody.length > 200 ? '...' : '')
    }

    const prompt = `You are an email content extraction specialist. Your task is to extract ONLY the main message content from email replies, removing all metadata, signatures, formatting, and special characters.

EXTRACTION RULES:
1. Extract only the actual message the sender intended to communicate
2. Remove ALL of the following:
   - Email signatures (names, titles, company info)
   - Contact information (emails, phone numbers, addresses)
   - Unsubscribe links and text
   - Email headers (From, To, Date, Subject lines)
   - Quoted/previous email threads (anything after phrases like "On [date]", "wrote:", "--Original Message--")
   - Auto-generated footers
   - Legal disclaimers
   - Social media links
   - Website URLs (unless specifically mentioned as part of the actual message)
   - Greeting lines if they're just "Hi [Name]" or similar
   - Sign-offs (Thanks, Best regards, Sincerely, etc.)
   - Marketing taglines
   - Special characters like \\n, \\t, \\r, <, >, /, \\, quotation marks, etc.
   - HTML tags or markup
   - Line breaks and extra whitespace

3. TEXT CLEANING:
   - Convert any remaining text to plain ASCII where possible
   - Replace multiple spaces with single spaces
   - Remove leading/trailing whitespace
   - Keep only standard punctuation (. , ! ? : ;)
   - Preserve numbers and basic letters

4. Output format:
   - Plain text only
   - NO explanations, headers, or meta-commentary
   - NO phrases like "Here is the extracted content:" or "The message says:"
   - Return ONLY the cleaned message text
   - If there's no meaningful content after extraction, return only: "No content"

CRITICAL: Return ONLY the extracted message. No additional text, formatting, or explanation.

Email to extract:
${emailBody}`

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 500
      })
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    const cleanedText = data.choices?.[0]?.message?.content?.trim() || emailBody

    // Limit to 200 characters for Slack
    return cleanedText.length > 200 ? cleanedText.substring(0, 200) + '...' : cleanedText
  } catch (error) {
    console.error('Error cleaning reply with AI:', error)
    // Fallback to simple truncation
    return emailBody.substring(0, 200) + (emailBody.length > 200 ? '...' : '')
  }
}
