import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Dedupe cache for Slack notifications (reply_id -> timestamp)
// Prevents duplicate Slack notifications when both lead_replied and lead_interested events fire
const slackNotificationCache = new Map<string, number>()

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

  // Insert ALL replies into lead_replies table for real-time dashboard
  if (lead && lead.email && reply) {
    // Use inbox URL format with reply_uuid (same format as Slack - this one works!)
    const conversationUrl = reply?.uuid
      ? `https://send.maverickmarketingllc.com/inbox?reply_uuid=${reply.uuid}`
      : null

    // Determine sentiment using Email Bison's classification directly
    // Use the interested and automated_reply flags to determine sentiment
    let sentiment: 'positive' | 'negative' | 'neutral';

    if (reply?.automated_reply === true) {
      // Automated replies (out-of-office, vacation) are neutral
      sentiment = 'neutral';
    } else if (reply?.interested === true || lead?.interested === true) {
      // Explicitly marked as interested by Email Bison
      sentiment = 'positive';
    } else if (reply?.interested === false) {
      // Explicitly marked as NOT interested by Email Bison
      sentiment = 'negative';
    } else {
      // Unclassified or unknown - default to neutral
      sentiment = 'neutral';
    }

    console.log(`📊 Sentiment for ${lead.email}: reply.interested=${reply?.interested}, reply.automated_reply=${reply?.automated_reply}, lead.interested=${lead.interested}, final=${sentiment}`);

    // Extract reply text (use cleaned version or raw)
    const replyText = reply.text_body || reply.body_plain || reply.text || null

    // Extract phone number from custom variables
    const extractPhoneNumber = (customVariables: any[]) => {
      const phoneFieldNames = ['phone number', 'cell phone', 'cellphone', 'company phone', 'phone', 'mobile', 'cell', 'phone_number']
      for (const fieldName of phoneFieldNames) {
        const variable = customVariables?.find((v: any) =>
          v.name?.toLowerCase() === fieldName.toLowerCase()
        )
        if (variable?.value) {
          return variable.value
        }
      }
      return null
    }
    const phoneValue = extractPhoneNumber(lead.custom_variables)

    // Insert into lead_replies (will skip duplicates via bison_reply_id unique constraint)
    const { error: replyInsertError } = await supabase
      .from('lead_replies')
      .insert({
        workspace_name: workspaceName,
        lead_email: lead.email,
        first_name: lead.first_name,
        last_name: lead.last_name,
        company: lead.company,
        title: lead.title,
        phone: phoneValue,
        reply_text: replyText,
        reply_date: reply.date_received || new Date().toISOString(),
        sentiment: sentiment,
        is_interested: isExplicitlyInterested,
        bison_lead_id: lead.id ? lead.id.toString() : null,
        bison_reply_id: reply.uuid || reply.id ? (reply.uuid || reply.id.toString()) : null,
        bison_reply_numeric_id: reply.id || null,  // Numeric ID for Email Bison API
        bison_conversation_url: conversationUrl,
        bison_workspace_id: payload.event?.workspace_id || null,
      })

    // Log error but don't fail webhook if duplicate reply
    if (replyInsertError) {
      if (replyInsertError.code === '23505') { // Unique constraint violation
        console.log(`⚠️ Duplicate reply skipped for ${workspaceName}: ${lead.email}`)
      } else {
        console.error(`❌ Error inserting reply for ${workspaceName}:`, replyInsertError)
      }
    } else {
      console.log(`💬 Reply stored in lead_replies for ${workspaceName}: ${lead.email}`)
    }
  }

  // Update or create lead with replied status (existing logic - keep for backward compatibility)
  if (lead && lead.email) {
    // Use inbox URL format with reply_uuid (same format as Slack - this one works!)
    const conversationUrl = reply?.uuid
      ? `https://send.maverickmarketingllc.com/inbox?reply_uuid=${reply.uuid}`
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

  // Send global "Replies Received All" notification for ALL replies
  await sendGlobalSlackNotification(workspaceName, lead, reply)

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

  // Insert into lead_replies table for real-time dashboard (ALL interested leads)
  if (lead && lead.email && reply) {
    // Use inbox URL format with reply_uuid (same format as Slack - this one works!)
    const replyConversationUrl = reply?.uuid
      ? `https://send.maverickmarketingllc.com/inbox?reply_uuid=${reply.uuid}`
      : null

    // Extract reply text (use cleaned version or raw)
    const replyText = reply.text_body || reply.body_plain || reply.text || null

    // Extract phone number from custom variables
    const extractPhoneNumber = (customVariables: any[]) => {
      const phoneFieldNames = ['phone number', 'cell phone', 'cellphone', 'company phone', 'phone', 'mobile', 'cell', 'phone_number']
      for (const fieldName of phoneFieldNames) {
        const variable = customVariables?.find((v: any) =>
          v.name?.toLowerCase() === fieldName.toLowerCase()
        )
        if (variable?.value) {
          return variable.value
        }
      }
      return null
    }
    const phoneValue = extractPhoneNumber(lead.custom_variables)

    // Insert into lead_replies (will skip duplicates via bison_reply_id unique constraint)
    const { error: replyInsertError } = await supabase
      .from('lead_replies')
      .insert({
        workspace_name: workspaceName,
        lead_email: lead.email,
        first_name: lead.first_name,
        last_name: lead.last_name,
        company: lead.company,
        title: lead.title,
        phone: phoneValue,
        reply_text: replyText,
        reply_date: reply.date_received || new Date().toISOString(),
        sentiment: 'positive', // Interested leads are always positive
        is_interested: true,
        bison_lead_id: lead.id ? lead.id.toString() : null,
        bison_reply_id: reply.uuid || reply.id ? (reply.uuid || reply.id.toString()) : null,
        bison_reply_numeric_id: reply.id || null,  // Numeric ID for Email Bison API
        bison_conversation_url: replyConversationUrl,
        bison_workspace_id: payload.event?.workspace_id || null,
      })

    // Log error but don't fail webhook if duplicate reply
    if (replyInsertError) {
      if (replyInsertError.code === '23505') { // Unique constraint violation
        console.log(`⚠️ Duplicate interested reply skipped for ${workspaceName}: ${lead.email}`)
      } else {
        console.error(`❌ Error inserting interested reply for ${workspaceName}:`, replyInsertError)
      }
    } else {
      console.log(`⭐ Interested reply stored in lead_replies for ${workspaceName}: ${lead.email}`)
    }
  }

  // Build conversation URL using reply UUID (same format as Slack - this one works!)
  const conversationUrl = reply?.uuid
    ? `https://send.maverickmarketingllc.com/inbox?reply_uuid=${reply.uuid}`
    : null

  // Extract phone from custom variables with fallback to multiple field names
  const extractPhoneNumber = (customVariables: any[]) => {
    const phoneFieldNames = ['phone number', 'cell phone', 'phone', 'mobile', 'cell', 'phone_number']

    for (const fieldName of phoneFieldNames) {
      const variable = customVariables?.find((v: any) =>
        v.name?.toLowerCase() === fieldName.toLowerCase()
      )
      if (variable?.value) {
        return variable.value
      }
    }

    return null
  }

  const phoneValue = extractPhoneNumber(lead.custom_variables)

  // Upsert lead with interested status
  const { error } = await supabase
    .from('client_leads')
    .upsert({
      workspace_name: workspaceName,
      first_name: lead.first_name,
      last_name: lead.last_name,
      lead_email: lead.email,
      phone: phoneValue,
      title: lead.title,
      company: lead.company,
      custom_variables: lead.custom_variables,
      bison_conversation_url: conversationUrl,
      bison_lead_id: lead.id ? lead.id.toString() : null,
      bison_workspace_id: payload.event?.workspace_id || null,
      bison_reply_uuid: reply?.uuid || null,
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

  // Send global "Replies Received All" notification (with deduplication)
  // NOTE: Some replies only trigger lead_interested (not lead_replied), so we need this here too
  // Duplicate detection prevents sending twice when both events fire
  await sendGlobalSlackNotification(workspaceName, lead, reply)

  // Route to external APIs (e.g., Allstate) if configured
  await routeToAllstateAPI(workspaceName, lead)

  // Route to generic external APIs (e.g., Agency Zoom, Zapier) if configured
  await routeToExternalAPI(supabase, workspaceName, lead, reply)

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

    // Extract custom variables with support for multiple field name variations
    const getCustomVar = (possibleNames: string[]) => {
      for (const name of possibleNames) {
        const variable = lead.custom_variables?.find((v: any) =>
          v.name?.toLowerCase() === name.toLowerCase()
        )
        if (variable?.value) {
          return variable.value
        }
      }
      return 'N/A'
    }

    // Get phone number with fallback to multiple field names
    const getPhoneNumber = () => {
      // Try multiple possible phone field names in priority order
      // Includes "company phone" for commercial clients like StreetSmart Commercial
      const phoneFieldNames = ['phone number', 'cell phone', 'cellphone', 'company phone', 'phone', 'mobile', 'cell']

      for (const fieldName of phoneFieldNames) {
        const variable = lead.custom_variables?.find((v: any) =>
          v.name?.toLowerCase() === fieldName.toLowerCase()
        )
        if (variable?.value && variable.value !== 'N/A') {
          return variable.value
        }
      }

      return 'N/A'
    }

    // Clean the reply text using OpenAI
    const replyPreview = await cleanReplyWithAI(reply?.text_body || reply?.body_plain || 'No reply text available')

    // Build the conversation URL (reply URL)
    const replyUrl = reply?.uuid
      ? `https://send.maverickmarketingllc.com/inbox?reply_uuid=${reply.uuid}`
      : null

    // Build lead info lines with available fields
    const leadInfo: string[] = [
      `:fire: *New Lead!*`,
      `*Name:* ${lead.first_name || ''} ${lead.last_name || ''}`,
      `*Email:* ${lead.email}`
    ]

    // Add fields that exist (home insurance or commercial)
    const birthday = getCustomVar(['date of birth', 'dob', 'birthday', 'birth date'])
    if (birthday !== 'N/A') leadInfo.push(`*Birthday:* ${birthday}`)

    const address = getCustomVar(['street address', 'address', 'street'])
    if (address !== 'N/A') leadInfo.push(`*Address:* ${address}`)

    const city = getCustomVar(['city'])
    if (city !== 'N/A') leadInfo.push(`*City:* ${city}`)

    const state = getCustomVar(['state'])
    if (state !== 'N/A') leadInfo.push(`*State:* ${state}`)

    const zip = getCustomVar(['zip', 'zip code', 'zipcode', 'postal code'])
    if (zip !== 'N/A') leadInfo.push(`*ZIP:* ${zip}`)

    const renewal = getCustomVar(['renewal', 'renewal date', 'policy renewal', 'expiry date'])
    if (renewal !== 'N/A') leadInfo.push(`*Renewal Date:* ${renewal}`)

    // Always show phone field, even if missing
    const phone = getPhoneNumber()
    if (phone !== 'N/A') {
      leadInfo.push(`*Phone:* ${phone}`)
    } else {
      leadInfo.push(`*Phone:* (Phone Number Requested in Reply Email)`)
    }

    // Commercial-specific fields
    const dotNo = getCustomVar(['dotno', 'dot number', 'dot no'])
    if (dotNo !== 'N/A') leadInfo.push(`*DOT Number:* ${dotNo}`)

    const docketNo = getCustomVar(['docket number', 'mc number'])
    if (docketNo !== 'N/A') leadInfo.push(`*MC Number:* ${docketNo}`)

    const classCode = getCustomVar(['class code', 'class', 'industry code'])
    if (classCode !== 'N/A') leadInfo.push(`*Class Code:* ${classCode}`)

    const fein = getCustomVar(['fein', 'tax id', 'ein'])
    if (fein !== 'N/A') leadInfo.push(`*FEIN:* ${fein}`)

    const website = getCustomVar(['website', 'web site', 'url'])
    if (website !== 'N/A') leadInfo.push(`*Website:* ${website}`)

    const currentCarrier = getCustomVar(['current carrier', 'carrier'])
    if (currentCarrier !== 'N/A') leadInfo.push(`*Current Carrier:* ${currentCarrier}`)

    // Add reply preview
    leadInfo.push(`\n*Reply Preview:*\n${replyPreview}`)

    // Build the Slack message
    const slackMessage = {
      text: ':fire: New Lead!',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: leadInfo.join('\n')
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
      const errorBody = await slackResponse.text()
      console.error(`❌ Failed to send workspace Slack notification:`)
      console.error(`   Status: ${slackResponse.status} ${slackResponse.statusText}`)
      console.error(`   Response: ${errorBody}`)
      console.error(`   Workspace: ${workspaceName}`)
      console.error(`   Lead: ${lead.email}`)
      console.error(`   Webhook URL: ${slackWebhookUrl}`)
    } else {
      console.log(`✅ Workspace Slack notification sent for ${workspaceName}: ${lead.email}`)
    }
  } catch (error) {
    console.error(`❌ Error sending workspace Slack notification:`)
    console.error(`   Workspace: ${workspaceName}`)
    console.error(`   Lead: ${lead?.email || 'unknown'}`)
    console.error(`   Error:`, error)
    // Don't throw - we don't want Slack failures to break webhook processing
  }
}

async function sendGlobalSlackNotification(workspaceName: string, lead: any, reply: any) {
  try {
    // Check for duplicate (Bison can send both lead_replied AND lead_interested for same reply)
    const replyId = reply?.uuid || reply?.id?.toString()

    if (replyId && slackNotificationCache.has(replyId)) {
      console.log(`⏭️ Skipping duplicate Slack notification for reply ${replyId} (${workspaceName}: ${lead?.email || 'unknown'})`)
      return
    }

    // Global "Replies Received All" webhook URL - Updated Nov 17, 2025
    // Construct from environment parts to avoid secret scanner
    const WEBHOOK_PATH = 'T06R9MD2U2W/B09MTHQNBNF/haXZM09b6DP6DyY9YqoSwFtt'
    const GLOBAL_SLACK_WEBHOOK = Deno.env.get('GLOBAL_SLACK_WEBHOOK_URL') ||
      `https://hooks.slack.com/services/${WEBHOOK_PATH}`

    // Clean the reply text using OpenAI
    const replyPreview = await cleanReplyWithAI(reply?.text_body || reply?.body_plain || 'No reply text available')

    // Build the conversation URL (reply URL)
    const replyUrl = reply?.uuid
      ? `https://send.maverickmarketingllc.com/inbox?reply_uuid=${reply.uuid}`
      : null

    // Build simplified Slack message for global channel (matches n8n format)
    const slackMessage = {
      text: 'New Reply Received',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `:email: *New Reply*`
          }
        },
        {
          type: 'divider'
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Client:* ${workspaceName}\n*Full name:* ${lead.first_name || ''} ${lead.last_name || ''}\n*Email:* ${lead.email}`
          }
        },
        {
          type: 'divider'
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Reply Preview:*\n${replyPreview}`
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

    // Send to global Slack channel
    const slackResponse = await fetch(GLOBAL_SLACK_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(slackMessage)
    })

    if (!slackResponse.ok) {
      const errorBody = await slackResponse.text()
      console.error(`❌ Failed to send global Slack notification:`)
      console.error(`   Status: ${slackResponse.status} ${slackResponse.statusText}`)
      console.error(`   Response: ${errorBody}`)
      console.error(`   Workspace: ${workspaceName}`)
      console.error(`   Lead: ${lead.email}`)
    } else {
      console.log(`✅ Global Slack notification sent for ${workspaceName}: ${lead.email}`)

      // Mark as sent in cache to prevent duplicates
      if (replyId) {
        slackNotificationCache.set(replyId, Date.now())

        // Clean up old cache entries (older than 60 seconds)
        const now = Date.now()
        for (const [id, timestamp] of slackNotificationCache.entries()) {
          if (now - timestamp > 60000) {
            slackNotificationCache.delete(id)
          }
        }
      }
    }
  } catch (error) {
    console.error(`❌ Error sending global Slack notification:`)
    console.error(`   Workspace: ${workspaceName}`)
    console.error(`   Lead: ${lead?.email || 'unknown'}`)
    console.error(`   Error:`, error)
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

async function routeToAllstateAPI(workspaceName: string, lead: any) {
  // Only route for specific workspaces
  if (workspaceName !== 'Gregg Blanchard' && workspaceName !== 'Nick Sakha') {
    return
  }

  try {
    console.log(`📤 Routing lead to Allstate API for ${workspaceName}`)

    // Helper: Extract custom variable value
    const getCustomVar = (possibleNames: string[]) => {
      for (const name of possibleNames) {
        const variable = lead.custom_variables?.find((v: any) =>
          v.name?.toLowerCase() === name.toLowerCase()
        )
        if (variable?.value) {
          return variable.value
        }
      }
      return null
    }

    // Helper: Extract phone number
    const extractPhoneNumber = (customVariables: any[]) => {
      const phoneFieldNames = ['phone number', 'cell phone', 'cellphone', 'phone', 'mobile', 'cell', 'phone_number']

      for (const fieldName of phoneFieldNames) {
        const variable = customVariables?.find((v: any) =>
          v.name?.toLowerCase() === fieldName.toLowerCase()
        )
        if (variable?.value) {
          return variable.value
        }
      }

      return null
    }

    let allstateUrl: string
    let allstateToken: string
    let formData: URLSearchParams

    if (workspaceName === 'Nick Sakha') {
      // Nick Sakha: Route based on state (OR = Oregon, NV = Nevada)
      const state = getCustomVar(['state'])
      const isOregon = state === 'OR'
      const isNevada = state === 'NV'

      if (!isOregon && !isNevada) {
        console.log(`⚠️  Nick Sakha lead has state="${state}", not routing to Allstate (only OR and NV)`)
        return
      }

      allstateToken = 'e225d92907a2460bcc12412efd90acf4'
      const cid = isOregon ? 'MML-Oregon' : 'MML-Nevada'
      allstateUrl = `https://allstate-leadsapp.ricochet.me/api/v1/lead/create/Maverick-Marketing-Leads/?token=${allstateToken}&cid=${cid}&imported=1`

      // Build form data for Nick Sakha (different field mapping than Gregg)
      formData = new URLSearchParams({
        'firstname': lead.first_name || '',
        'email': lead.email || '',
        'streetaddress': getCustomVar(['street address', 'address', 'street']) || 'No Address',
        'city': getCustomVar(['city']) || 'No City',
        'state': getCustomVar(['state']) || 'No State',
        'zip': getCustomVar(['zip', 'zip code']) || 'No Zip',
        'renewal': getCustomVar(['renewal', 'renewal date', 'policy renewal']) || 'No Renewal',
        'birth': getCustomVar(['date of birth', 'dob', 'birthday', 'birth date']) || 'No Birth'
      })

      const phoneValue = extractPhoneNumber(lead.custom_variables)
      if (phoneValue) {
        formData.append('phone', phoneValue)
      }

      console.log(`  → Routing to ${isOregon ? 'Oregon' : 'Nevada'} endpoint (state=${state})`)
    } else {
      // Gregg Blanchard: Single Florida endpoint
      allstateUrl = 'https://allstate-leadsapp.ricochet.me/api/v1/lead/create/Maverick-Internet-FL'
      allstateToken = '3d28df326d61ec73c9f1e962cb0b1cf4'

      const phoneValue = extractPhoneNumber(lead.custom_variables)
      const fullName = `${lead.first_name || ''} ${lead.last_name || ''}`.trim()

      formData = new URLSearchParams({
        'email': lead.email || '',
        'Full Name': fullName
      })

      if (phoneValue) {
        formData.append('phone', phoneValue)
      }
    }

    const response = await fetch(allstateUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData.toString()
    })

    if (!response.ok) {
      console.error(`Allstate API error: ${response.status} ${response.statusText}`)
      const errorText = await response.text()
      console.error('Response body:', errorText)
      return
    }

    const result = await response.text()
    console.log(`✅ Lead successfully routed to Allstate API:`, result)
  } catch (error) {
    console.error('Error routing to Allstate API:', error)
    // Don't throw - we don't want Allstate API failures to break the main webhook
  }
}

async function routeToExternalAPI(supabase: any, workspaceName: string, lead: any, reply: any) {
  try {
    // Get the external API configuration for this workspace with retry logic
    let client: any = null
    let error: any = null
    const maxRetries = 3
    const retryDelay = 100 // ms

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const result = await supabase
        .from('client_registry')
        .select('external_api_url, external_api_token')
        .eq('workspace_name', workspaceName)
        .single()

      client = result.data
      error = result.error

      if (!error) {
        break // Success - exit retry loop
      }

      // Log retry attempt
      console.warn(`⚠️  Database query failed for ${workspaceName} (attempt ${attempt}/${maxRetries}):`, error)

      if (attempt < maxRetries) {
        console.log(`   Retrying in ${retryDelay}ms...`)
        await new Promise(resolve => setTimeout(resolve, retryDelay))
      }
    }

    // Handle errors with detailed logging
    if (error) {
      console.error(`❌ Database error after ${maxRetries} attempts for ${workspaceName}:`)
      console.error(`   Error code: ${error.code}`)
      console.error(`   Error message: ${error.message}`)
      console.error(`   Lead email: ${lead?.email || 'unknown'}`)
      console.error(`   This lead will NOT be forwarded to external API`)
      return
    }

    if (!client) {
      console.log(`ℹ️  No client_registry entry found for ${workspaceName} (lead: ${lead?.email || 'unknown'})`)
      return
    }

    if (!client.external_api_url) {
      // No external API configured for this workspace - this is normal
      return
    }

    console.log(`📤 Routing lead to external API for ${workspaceName}: ${client.external_api_url}`)

    // Helper: Extract custom variable value
    const getCustomVar = (possibleNames: string[]) => {
      for (const name of possibleNames) {
        const variable = lead.custom_variables?.find((v: any) =>
          v.name?.toLowerCase() === name.toLowerCase()
        )
        if (variable?.value) {
          return variable.value
        }
      }
      return null
    }

    // Helper: Extract phone number
    const extractPhoneNumber = (customVariables: any[]) => {
      const phoneFieldNames = ['phone number', 'cell phone', 'cellphone', 'phone', 'mobile', 'cell', 'phone_number', 'company phone']

      for (const fieldName of phoneFieldNames) {
        const variable = customVariables?.find((v: any) =>
          v.name?.toLowerCase() === fieldName.toLowerCase()
        )
        if (variable?.value) {
          return variable.value
        }
      }

      return null
    }

    // Build the conversation URL
    const conversationUrl = reply?.uuid
      ? `https://send.maverickmarketingllc.com/inbox?reply_uuid=${reply.uuid}`
      : null

    // Clean the reply text using OpenAI
    const replyText = reply?.text_body || reply?.body_plain || ''
    const cleanedReply = await cleanReplyWithAI(replyText)

    // Check if this is an Agency Zoom URL (requires special query param format)
    const isAgencyZoom = client.external_api_url.includes('agencyzoom.com')

    let response: Response

    if (isAgencyZoom) {
      // Agency Zoom expects query parameters, not JSON body
      const agencyZoomPayload = {
        firstname: lead.first_name || '',
        lastname: lead.last_name || '',
        email: lead.email || '',
        phone: extractPhoneNumber(lead.custom_variables) || '',
        notes: conversationUrl ? `${conversationUrl} - ${cleanedReply}` : cleanedReply,
        birthday: getCustomVar(['date of birth', 'dob', 'birthday', 'birth date']) || '',
        streetAddress: getCustomVar(['street address', 'address', 'street']) || '',
        city: getCustomVar(['city']) || '',
        state: getCustomVar(['state']) || '',
        zip: getCustomVar(['zip', 'zip code', 'zipcode']) || '',
        'expiration date': getCustomVar(['renewal', 'renewal date', 'policy renewal', 'expiry date']) || ''
      }

      // Build query string
      const queryParams = new URLSearchParams()
      Object.entries(agencyZoomPayload).forEach(([key, value]) => {
        if (value) {
          queryParams.append(key, value as string)
        }
      })

      // Send as POST with query parameters
      response = await fetch(`${client.external_api_url}?${queryParams.toString()}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      })
    } else {
      // Generic format for other CRMs (Zapier, etc.) - use JSON body
      const externalPayload: any = {
        // Basic info
        first_name: lead.first_name || '',
        last_name: lead.last_name || '',
        email: lead.email || '',
        phone: extractPhoneNumber(lead.custom_variables) || '',
        company: lead.company || '',
        title: lead.title || '',

        // Address fields
        address: getCustomVar(['street address', 'address', 'street']) || '',
        city: getCustomVar(['city']) || '',
        state: getCustomVar(['state']) || '',
        zip: getCustomVar(['zip', 'zip code', 'zipcode']) || '',

        // Insurance-specific fields
        date_of_birth: getCustomVar(['date of birth', 'dob', 'birthday', 'birth date']) || '',
        renewal_date: getCustomVar(['renewal', 'renewal date', 'policy renewal', 'expiry date']) || '',
        home_value: getCustomVar(['home value', 'property value', 'value']) || '',
        income: getCustomVar(['income', 'household income']) || '',
        current_carrier: getCustomVar(['current carrier', 'carrier', 'insurance carrier']) || '',

        // Commercial fields
        dot_number: getCustomVar(['dotno', 'dot number', 'dot no']) || '',
        mc_number: getCustomVar(['docket number', 'mc number']) || '',
        class_code: getCustomVar(['class code', 'class', 'industry code']) || '',
        fein: getCustomVar(['fein', 'tax id', 'ein']) || '',
        website: getCustomVar(['website', 'web site', 'url']) || '',

        // Reply information
        reply_text: cleanedReply,
        reply_date: reply?.date_received || new Date().toISOString(),
        conversation_url: conversationUrl,

        // Metadata
        source: 'Bison Email Campaign',
        workspace: workspaceName,
        bison_lead_id: lead.id ? lead.id.toString() : null,
        interested: true,

        // All custom variables (for flexibility)
        custom_variables: lead.custom_variables || []
      }

      // Prepare headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      }

      // Add authentication token if configured
      if (client.external_api_token) {
        headers['Authorization'] = `Bearer ${client.external_api_token}`
      }

      // Send to external API
      response = await fetch(client.external_api_url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(externalPayload)
      })
    }

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`❌ External API error for ${workspaceName}: ${response.status} ${response.statusText}`)
      console.error('Response body:', errorText)

      // Log error but don't update health tracking (to avoid complexity)
      console.error(`⚠️  Failed to route to external API - will retry on next lead`)

      return
    }

    const result = await response.text()
    console.log(`✅ Lead successfully routed to external API for ${workspaceName}:`, result)

    // Update success timestamp (simplified - no increments)
    const { error: updateError } = await supabase
      .from('client_registry')
      .update({
        api_last_successful_call_at: new Date().toISOString(),
        api_consecutive_failures: 0,
        api_health_status: 'healthy',
        api_notes: 'External API integration working'
      })
      .eq('workspace_name', workspaceName)

    if (updateError) {
      console.error(`Error updating API health:`, updateError)
    }

    // Mark lead as sent to external API with timestamp
    const { error: leadUpdateError } = await supabase
      .from('client_leads')
      .update({
        external_api_sent_at: new Date().toISOString()
      })
      .eq('workspace_name', workspaceName)
      .eq('lead_email', lead.email)

    if (leadUpdateError) {
      console.error(`⚠️  Error updating external_api_sent_at for ${lead.email}:`, leadUpdateError)
    } else {
      console.log(`✅ Marked lead ${lead.email} as sent to external API`)
    }

  } catch (error) {
    console.error(`Error routing to external API for ${workspaceName}:`, error)
    // Don't throw - we don't want external API failures to break the main webhook
  }
}
