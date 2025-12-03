import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ============================================================================
// OpenAI Email Cleaning Utility
// ============================================================================

export async function cleanEmailWithAI(emailBody: string): Promise<string> {
  if (!emailBody || emailBody.trim() === '') {
    return 'No content'
  }

  const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
  if (!openaiApiKey) {
    console.warn('⚠️  OpenAI API key not found, returning raw email body')
    return emailBody
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{
          role: 'user',
          content: `Extract the actual message content from this email, removing signatures, headers, quoted replies, special characters, HTML tags, and any metadata. Return only the meaningful message text. If there is no meaningful content, return 'No content'.\n\nEmail:\n${emailBody}`
        }],
        temperature: 0.3,
        max_tokens: 500
      })
    })

    if (!response.ok) {
      console.error(`OpenAI API error: ${response.status}`)
      return emailBody
    }

    const data = await response.json()
    const cleanedText = data.choices?.[0]?.message?.content?.trim()

    return cleanedText || emailBody
  } catch (error) {
    console.error('Error cleaning email with AI:', error)
    return emailBody
  }
}

// ============================================================================
// Case-Insensitive Custom Variable Extractor
// ============================================================================

export function extractCustomVariable(
  customVars: Array<{ name: string; value: string }>,
  fieldNames: string[]
): string | null {
  if (!customVars || customVars.length === 0) {
    return null
  }

  // Try each field name variation
  for (const fieldName of fieldNames) {
    const normalizedFieldName = fieldName.toLowerCase().trim()

    // Find matching custom variable (case-insensitive)
    const match = customVars.find(cv =>
      cv.name.toLowerCase().trim() === normalizedFieldName
    )

    if (match && match.value) {
      return match.value.trim()
    }
  }

  return null
}

// ============================================================================
// Bison API Client
// ============================================================================

export async function fetchLeadDetails(leadId: string, apiToken: string): Promise<any> {
  try {
    const response = await fetch(`https://send.maverickmarketingllc.com/api/leads/${leadId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Accept': 'application/json'
      }
    })

    if (!response.ok) {
      console.error(`Bison API error fetching lead ${leadId}: ${response.status}`)
      return null
    }

    const data = await response.json()
    return data.data || data
  } catch (error) {
    console.error(`Error fetching lead details for ${leadId}:`, error)
    return null
  }
}

export async function fetchSentEmails(leadId: string, apiToken: string): Promise<any[]> {
  try {
    const response = await fetch(`https://send.maverickmarketingllc.com/api/leads/${leadId}/sent-emails`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Accept': 'application/json'
      }
    })

    if (!response.ok) {
      console.error(`Bison API error fetching sent emails for lead ${leadId}: ${response.status}`)
      return []
    }

    const data = await response.json()
    return data.data || []
  } catch (error) {
    console.error(`Error fetching sent emails for ${leadId}:`, error)
    return []
  }
}

// ============================================================================
// Supabase Client Leads UPSERT
// ============================================================================

export async function upsertLeadToSupabase(leadData: any): Promise<void> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    const { data, error } = await supabase
      .from('client_leads')
      .upsert(
        leadData,
        {
          onConflict: 'lead_email,workspace_name',
          ignoreDuplicates: false
        }
      )
      .select()

    if (error) {
      console.error('Error upserting lead to Supabase:', error)
      throw error
    }

    console.log(`✅ Lead upserted successfully: ${leadData.lead_email}`)
  } catch (error) {
    console.error('Failed to upsert lead:', error)
    throw error
  }
}

// ============================================================================
// Slack Notification Sender
// ============================================================================

export async function sendSlackNotification(
  channel: string,
  leadData: any,
  replyUrl: string
): Promise<void> {
  // Check for Slack webhook URL (preferred method)
  const slackWebhookUrl = Deno.env.get(`SLACK_WEBHOOK_${channel.toUpperCase()}`)

  if (!slackWebhookUrl) {
    console.warn(`⚠️  Slack webhook not configured for channel ${channel}, skipping notification`)
    return
  }

  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*New Interested Lead: ${leadData.first_name} ${leadData.last_name}*\n${leadData.workspace_name}`
      }
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Email:*\n${leadData.lead_email || 'N/A'}`
        },
        {
          type: 'mrkdwn',
          text: `*Phone:*\n${leadData.phone || 'N/A'}`
        },
        {
          type: 'mrkdwn',
          text: `*Company:*\n${leadData.company || 'N/A'}`
        },
        {
          type: 'mrkdwn',
          text: `*City:*\n${leadData.city || 'N/A'}`
        }
      ]
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Reply:*\n${leadData.reply_received?.substring(0, 200) || 'N/A'}`
      }
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'View in Bison'
          },
          url: replyUrl,
          style: 'primary'
        }
      ]
    }
  ]

  try {
    const response = await fetch(slackWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ blocks })
    })

    if (!response.ok) {
      console.error(`Slack notification failed: ${response.status}`)
    } else {
      console.log(`✅ Slack notification sent to channel ${channel}`)
    }
  } catch (error) {
    console.error('Error sending Slack notification:', error)
    // Don't throw - we don't want to fail the entire webhook for a Slack notification failure
  }
}

// ============================================================================
// Format for Zapier (Nested Email Bison Structure)
// ============================================================================

export function formatForZapier(webhookData: any, leadDetails: any): object {
  return {
    event: {
      type: webhookData.event?.type || 'LEAD_INTERESTED',
      workspace_name: webhookData.event?.workspace_name || '',
      workspace_id: webhookData.event?.workspace_id || null
    },
    data: {
      lead: {
        id: leadDetails.id,
        first_name: leadDetails.first_name || '',
        last_name: leadDetails.last_name || '',
        email: leadDetails.email || '',
        company: leadDetails.company || '',
        title: leadDetails.title || '',
        custom_variables: leadDetails.custom_variables || []
      },
      reply: {
        uuid: webhookData.data?.reply?.uuid || '',
        date_received: webhookData.data?.reply?.date_received || new Date().toISOString(),
        text_body: webhookData.data?.reply?.text_body || webhookData.data?.reply?.body_plain || '',
        email_subject: webhookData.data?.reply?.email_subject || ''
      },
      campaign: {
        id: webhookData.data?.campaign?.id || leadDetails.campaign_id || null,
        name: webhookData.data?.campaign?.name || leadDetails.campaign_name || ''
      },
      sender_email: {
        email: webhookData.data?.sender_email?.email || ''
      }
    }
  }
}

// ============================================================================
// Global Slack Notification (All Replies)
// ============================================================================

export async function sendGlobalSlackNotification(workspaceName: string, lead: any, reply: any) {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Check for duplicate using database (replaces in-memory cache)
    const replyId = reply?.uuid || reply?.id?.toString()

    if (!replyId) {
      console.log(`⚠️ No reply ID found, skipping global Slack notification for ${workspaceName}: ${lead?.email || 'unknown'}`)
      return
    }

    // Check if we already sent a global notification for this reply
    const { data: existingNotification } = await supabase
      .from('slack_notifications_sent')
      .select('id, sent_at')
      .eq('reply_id', replyId)
      .eq('notification_type', 'global')
      .single()

    if (existingNotification) {
      console.log(`⏭️ Skipping duplicate global Slack notification for reply ${replyId} (${workspaceName}: ${lead?.email || 'unknown'}) - already sent at ${existingNotification.sent_at}`)
      return
    }

    // Global "Replies Received All" webhook URL
    const WEBHOOK_PATH = 'T06R9MD2U2W/B09MTHQNBNF/haXZM09b6DP6DyY9YqoSwFtt'
    const GLOBAL_SLACK_WEBHOOK = Deno.env.get('GLOBAL_SLACK_WEBHOOK_URL') ||
      `https://hooks.slack.com/services/${WEBHOOK_PATH}`

    // Clean the reply text using OpenAI
    const replyPreview = await cleanEmailWithAI(reply?.text_body || reply?.body_plain || 'No reply text available')

    // Build the conversation URL
    const replyUrl = reply?.uuid
      ? `https://send.maverickmarketingllc.com/inbox?reply_uuid=${reply.uuid}`
      : null

    // Build simplified Slack message for global channel
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

      // Record notification in database to prevent future duplicates
      const { error: insertError } = await supabase
        .from('slack_notifications_sent')
        .insert({
          reply_id: replyId,
          workspace_name: workspaceName,
          notification_type: 'global'
        })

      if (insertError) {
        // Log but don't fail - duplicate key errors are expected in race conditions
        if (insertError.code !== '23505') { // 23505 = unique_violation
          console.error(`⚠️ Error recording global Slack notification:`, insertError)
        }
      } else {
        console.log(`📝 Recorded global notification for reply ${replyId}`)
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

// ============================================================================
// Live Reply Dashboard Insert
// ============================================================================

async function analyzeSentiment(replyText: string): Promise<{
  sentiment: string
  is_interested: boolean
  confidence: number
  reasoning: string
}> {
  const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!anthropicApiKey) {
    return {
      sentiment: 'neutral',
      is_interested: false,
      confidence: 0,
      reasoning: 'No AI key configured'
    }
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 200,
        messages: [{
          role: 'user',
          content: `Analyze this insurance lead reply and return ONLY valid JSON:

Reply: "${replyText}"

Return this exact format:
{
  "sentiment": "positive|negative|neutral",
  "is_interested": true|false,
  "confidence": 0-100,
  "reasoning": "Brief explanation"
}`
        }]
      })
    })

    if (!response.ok) {
      throw new Error(`AI API error: ${response.status}`)
    }

    const data = await response.json()
    const aiResponse = data.content[0].text
    return JSON.parse(aiResponse)
  } catch (error) {
    console.error('AI sentiment analysis failed:', error)
    return {
      sentiment: 'neutral',
      is_interested: false,
      confidence: 50,
      reasoning: 'Fallback - AI analysis failed'
    }
  }
}

export async function insertToLiveReplyDashboard(
  workspaceName: string,
  workspaceId: number | null,
  lead: any,
  reply: any,
  cleanedReply: string
): Promise<void> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    // Extract phone from custom variables
    const phoneValue = lead.custom_variables?.find((cv: any) =>
      ['phone', 'phone number', 'cell phone'].includes(cv.name?.toLowerCase())
    )?.value || lead.phone || null

    // AI Sentiment Analysis (using Claude Haiku for speed + cost)
    const sentiment = await analyzeSentiment(cleanedReply)

    // Insert into lead_replies table (Realtime enabled)
    const { error } = await supabase
      .from('lead_replies')
      .upsert({
        workspace_name: workspaceName,
        bison_workspace_id: workspaceId,
        lead_email: lead.email,
        first_name: lead.first_name || '',
        last_name: lead.last_name || '',
        company: lead.company || null,
        title: lead.title || null,
        phone: phoneValue,
        reply_text: cleanedReply,
        reply_date: reply.date_received || new Date().toISOString(),
        sentiment: sentiment.sentiment,
        is_interested: sentiment.is_interested,
        confidence_score: sentiment.confidence,
        ai_reasoning: sentiment.reasoning,
        sentiment_source: 'ai',
        bison_lead_id: lead.id?.toString() || null,
        bison_reply_id: reply.uuid || reply.id?.toString(),
        bison_reply_numeric_id: reply.id || null,
        bison_conversation_url: reply.uuid
          ? `https://send.maverickmarketingllc.com/inbox?reply_uuid=${reply.uuid}`
          : null,
        is_handled: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'bison_reply_id',
        ignoreDuplicates: false
      })

    if (error) {
      console.error('Error inserting to Live Reply Dashboard:', error)
    } else {
      console.log(`✅ Inserted to Live Reply Dashboard: ${lead.email}`)
    }
  } catch (error) {
    console.error('Failed to insert to Live Reply Dashboard:', error)
    // Don't throw - we don't want dashboard failures to break webhook processing
  }
}
