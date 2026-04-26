// Send Reply via Email Bison Edge Function
// Sends AI-generated reply through Email Bison API with CC support.
// Auto-retries once on failure; if both attempts fail, marks failed + posts Slack alert.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const MAVERICK_BISON_API_KEY = Deno.env.get('MAVERICK_BISON_API_KEY');
const LONG_RUN_BISON_API_KEY = Deno.env.get('LONG_RUN_BISON_API_KEY');
const SLACK_ALERT_URL = Deno.env.get('AI_REPLY_ALERTS_SLACK_WEBHOOK_URL');
const MAVERICK_BASE_URL = 'https://send.maverickmarketingllc.com/api';
const LONGRUN_BASE_URL = 'https://send.longrun.agency/api';

async function sendSlackAlert(
  workspaceName: string,
  leadName: string,
  leadEmail: string,
  replyUuid: string,
  errorDetail: string,
  retryAttempted: boolean
) {
  if (!SLACK_ALERT_URL) {
    console.warn('AI_REPLY_ALERTS_SLACK_WEBHOOK_URL not set — skipping Slack alert');
    return;
  }
  const truncatedError = errorDetail.length > 1500 ? errorDetail.slice(0, 1500) + '…' : errorDetail;
  const body = {
    text: `:rotating_light: *AI Reply send failed* — ${workspaceName}`,
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: '🚨 AI Reply Send Failed' }
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Workspace:*\n${workspaceName}` },
          { type: 'mrkdwn', text: `*Lead:*\n${leadName}` },
          { type: 'mrkdwn', text: `*Email:*\n${leadEmail}` },
          { type: 'mrkdwn', text: `*Retry attempted:*\n${retryAttempted ? 'Yes (both failed)' : 'No'}` }
        ]
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*Error:*\n\`\`\`${truncatedError}\`\`\`` }
      },
      {
        type: 'context',
        elements: [
          { type: 'mrkdwn', text: `reply_uuid: \`${replyUuid}\`` }
        ]
      }
    ]
  };
  const resp = await fetch(SLACK_ALERT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!resp.ok) {
    console.error(`Slack alert returned ${resp.status}: ${await resp.text()}`);
  } else {
    console.log(`📣 Slack alert posted for failed reply ${replyUuid}`);
  }
}
serve(async (req)=>{
  // CORS headers - define once and reuse everywhere
  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };
  // Handle OPTIONS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      status: 200,
      headers: corsHeaders
    });
  }
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    // Parse request body
    const requestData = await req.json();
    const { reply_uuid, workspace_name, generated_reply_text, cc_emails, sender_email_id } = requestData;
    console.log(`📧 Sending reply via Email Bison for ${workspace_name} - ${reply_uuid}`);
    // === Idempotency + duplicate-send pre-check ===
    // If this reply is already sent (or is actively being sent by another request),
    // bail out here BEFORE spending time on lookups and Bison API calls.
    // Tolerates stale 'sending' markers older than 2 min (treated as retry-able).
    const { data: existingSent } = await supabase.from('sent_replies').select('status, bison_reply_id, created_at').eq('reply_uuid', reply_uuid).maybeSingle();
    if (existingSent?.status === 'sent') {
      console.log(`♻️  Reply already sent — returning idempotent success (bison_reply_id=${existingSent.bison_reply_id})`);
      return new Response(JSON.stringify({
        success: true,
        bison_reply_id: existingSent.bison_reply_id,
        already_sent: true
      }), {
        status: 200,
        headers: corsHeaders
      });
    }
    const STALE_SENDING_MS = 2 * 60 * 1000;
    if (existingSent?.status === 'sending') {
      const ageMs = Date.now() - new Date(existingSent.created_at).getTime();
      if (ageMs < STALE_SENDING_MS) {
        console.warn(`🚫 Duplicate send blocked — in-flight for ${Math.floor(ageMs / 1000)}s`);
        return new Response(JSON.stringify({
          success: false,
          error: 'This reply is already being sent. Please wait a moment.',
          in_flight: true
        }), {
          status: 409,
          headers: corsHeaders
        });
      }
      console.warn(`⏰ Stale 'sending' marker (${Math.floor(ageMs / 1000)}s old) — allowing retry`);
    }
    // Step 1: Get workspace API key and bison reply ID from lead_replies table
    const { data: replyData, error: replyError } = await supabase.from('lead_replies').select('bison_reply_numeric_id, bison_reply_id, lead_email, first_name, last_name, workspace_name, original_sender_email_id').eq('id', reply_uuid).single();
    if (replyError || !replyData) {
      console.error('Reply not found:', replyError);
      return new Response(JSON.stringify({
        success: false,
        error: `Reply not found: ${reply_uuid}`
      }), {
        status: 404,
        headers: corsHeaders
      });
    }
    const leadName = [
      replyData.first_name,
      replyData.last_name
    ].filter(Boolean).join(' ') || 'Lead';
    console.log(`✅ Found reply record: ${leadName} <${replyData.lead_email}>`);
    // Step 2: Get workspace configuration (including API key and instance)
    const { data: workspace, error: workspaceError } = await supabase.from('client_registry').select('bison_api_key, workspace_name, bison_instance, bison_workspace_id').eq('workspace_name', workspace_name).single();
    if (workspaceError || !workspace) {
      console.error('Workspace not found:', workspaceError);
      return new Response(JSON.stringify({
        success: false,
        error: `Workspace not found: ${workspace_name}`
      }), {
        status: 404,
        headers: corsHeaders
      });
    }
    // Determine which API key and base URL to use
    const isLongRun = workspace.bison_instance === 'Long Run';
    const baseUrl = isLongRun ? LONGRUN_BASE_URL : MAVERICK_BASE_URL;
    // Use workspace-specific API key if available, otherwise fall back to global key
    const apiKeyToUse = workspace.bison_api_key || (isLongRun ? LONG_RUN_BISON_API_KEY : MAVERICK_BISON_API_KEY);
    if (!apiKeyToUse) {
      console.error('No API key available (neither workspace-specific nor global)');
      return new Response(JSON.stringify({
        success: false,
        error: `No API key configured for workspace: ${workspace_name}. Please configure a workspace-specific API key or ensure global API keys are set in environment variables.`
      }), {
        status: 500,
        headers: corsHeaders
      });
    }
    const usingWorkspaceKey = !!workspace.bison_api_key;
    console.log(`✅ Using ${usingWorkspaceKey ? 'workspace-specific' : 'global'} API key for ${workspace_name}`);
    // If using global key, we may need to switch workspace context
    // However, for reply sending, the reply ID is already workspace-scoped, so switching may not be necessary
    // But we'll do it to be safe
    if (!usingWorkspaceKey && workspace.bison_workspace_id) {
      console.log(`🔄 Switching to workspace ${workspace.bison_workspace_id} (using global key)...`);
      try {
        const switchResponse = await fetch(`${baseUrl}/workspaces/v1.1/switch-workspace`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKeyToUse}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            team_id: workspace.bison_workspace_id
          })
        });
        if (!switchResponse.ok) {
          console.warn(`⚠️  Failed to switch workspace (may not be necessary for replies): ${switchResponse.status}`);
        // Don't fail - reply IDs are workspace-scoped, so this might not be needed
        } else {
          console.log(`✅ Switched to workspace ${workspace.bison_workspace_id}`);
        }
      } catch (switchError) {
        console.warn(`⚠️  Workspace switch error (continuing anyway):`, switchError);
      // Continue - reply IDs are workspace-scoped
      }
    }
    // Step 3: Get the bison reply numeric ID (required for Email Bison API)
    // Email Bison API requires INTEGER reply_id, not UUID
    const bisonReplyId = replyData.bison_reply_numeric_id;
    console.log(`🔍 Checking bison_reply_numeric_id...`);
    console.log(`   Value: ${bisonReplyId}`);
    console.log(`   Type: ${typeof bisonReplyId}`);
    console.log(`   Is null: ${bisonReplyId === null}`);
    console.log(`   Is undefined: ${bisonReplyId === undefined}`);
    if (!bisonReplyId || bisonReplyId === null || bisonReplyId === undefined) {
      console.error('❌ VALIDATION FAILED: No bison_reply_numeric_id found');
      console.error('  Reply UUID:', reply_uuid);
      console.error('  Lead Email:', replyData.lead_email);
      console.error('  Workspace:', workspace_name);
      console.error('  This reply was created before numeric ID tracking was enabled (Nov 20, 2025)');
      console.error('  Cannot send reply - Email Bison API requires numeric reply ID');
      return new Response(JSON.stringify({
        success: false,
        error: 'This reply cannot be responded to because it\'s missing the required Email Bison reply ID. This happens for replies received before November 20, 2025. Please ask the lead to reply again, and the new reply will be compatible with our AI reply system.'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }
    console.log(`📨 Bison Reply ID (numeric): ${bisonReplyId}`);
    // Step 3.5: Get sender email account ID
    // Priority: 1) explicit param, 2) original_sender_email_id from reply record, 3) Bison API lookup, 4) most recent from workspace
    let senderEmailIdToUse = sender_email_id || replyData.original_sender_email_id || null;
    if (senderEmailIdToUse) {
      console.log(`✅ Using original sender email ID from reply record: ${senderEmailIdToUse}`);
    }
    if (!senderEmailIdToUse) {
      console.log(`⚠️ No original_sender_email_id on reply, fetching from Bison API for reply ${bisonReplyId}...`);
      try {
        const replyDetailResponse = await fetch(`${baseUrl}/replies/${bisonReplyId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKeyToUse}`,
            'Accept': 'application/json'
          }
        });
        if (replyDetailResponse.ok) {
          const replyDetail = await replyDetailResponse.json();
          const bisonSenderEmailId = replyDetail.data?.sender_email_id;
          if (bisonSenderEmailId) {
            senderEmailIdToUse = bisonSenderEmailId;
            console.log(`✅ Got sender_email_id from Bison API: ${senderEmailIdToUse}`);
            // Backfill original_sender_email_id so we don't need to look this up again
            await supabase.from('lead_replies').update({
              original_sender_email_id: senderEmailIdToUse
            }).eq('id', reply_uuid);
            console.log(`✅ Backfilled original_sender_email_id for reply ${reply_uuid}`);
          }
        } else {
          console.warn(`⚠️ Bison API reply detail returned ${replyDetailResponse.status}`);
        }
      } catch (lookupError) {
        console.warn(`⚠️ Failed to fetch reply details from Bison:`, lookupError);
      }
    }
    // Final fallback: find the most recent reply in this workspace that has a sender ID
    if (!senderEmailIdToUse) {
      console.log(`🔍 No sender_email_id from Bison API — looking up most recent one for workspace: ${workspace_name}`);
      const { data: recentReply } = await supabase.from('lead_replies').select('original_sender_email_id').eq('workspace_name', workspace_name).not('original_sender_email_id', 'is', null).order('reply_date', {
        ascending: false
      }).limit(1).maybeSingle();
      if (recentReply?.original_sender_email_id) {
        senderEmailIdToUse = recentReply.original_sender_email_id;
        console.log(`✅ Using sender_email_id from recent reply in same workspace: ${senderEmailIdToUse}`);
      }
    }
    if (!senderEmailIdToUse) {
      console.error('❌ No sender email available from any source');
      return new Response(JSON.stringify({
        success: false,
        error: `No sender email available for this reply. Could not determine the original sender email for workspace: ${workspace_name}.`
      }), {
        status: 400,
        headers: corsHeaders
      });
    }
    // Step 4: Convert plain text reply to HTML with proper formatting
    // Claude generates plain text with \n line breaks, but Email Bison expects HTML
    const convertToHtml = (text)=>{
      // Escape HTML special characters first
      let html = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      // Split by double line breaks to identify paragraphs
      const paragraphs = html.split(/\n\n+/);
      // Convert each paragraph
      const formattedParagraphs = paragraphs.map((para)=>{
        // Within each paragraph, convert single line breaks to <br>
        const withBreaks = para.trim().replace(/\n/g, '<br>');
        // Wrap in paragraph tag
        return `<p style="margin: 0 0 1em 0;">${withBreaks}</p>`;
      });
      return formattedParagraphs.join('');
    };
    const htmlMessage = convertToHtml(generated_reply_text);
    console.log(`📝 Converted plain text reply to HTML format`);
    // Step 5: Prepare CC emails in Email Bison format
    const ccEmailsFormatted = cc_emails.map((email)=>({
        name: email.split('@')[0],
        email_address: email
      }));
    // === CAS claim: mark this reply as 'sending' atomically before calling Bison ===
    // Uses compare-and-swap to guard against a second concurrent request that passed
    // the pre-check but hadn't yet claimed. Losing the CAS means another request won.
    const claimPayload = {
      reply_uuid,
      workspace_name,
      lead_name: leadName,
      lead_email: replyData.lead_email,
      generated_reply_text,
      cc_emails: cc_emails || [],
      status: 'sending'
    };
    let claimed = false;
    if (!existingSent) {
      const { error: insertErr } = await supabase.from('sent_replies').insert(claimPayload);
      claimed = !insertErr;
      if (insertErr) {
        console.warn(`🚫 CAS claim lost (insert conflict): ${insertErr.message}`);
      }
    } else {
      const { data: updRows } = await supabase.from('sent_replies').update(claimPayload).eq('reply_uuid', reply_uuid).eq('status', existingSent.status).select('id');
      claimed = !!updRows && updRows.length > 0;
      if (!claimed) {
        console.warn(`🚫 CAS claim lost (status changed from "${existingSent.status}" since pre-check)`);
      }
    }
    if (!claimed) {
      return new Response(JSON.stringify({
        success: false,
        error: 'This reply is already being sent by another request.',
        in_flight: true
      }), {
        status: 409,
        headers: corsHeaders
      });
    }
    console.log(`🔒 Claimed send lock for reply_uuid=${reply_uuid}`);
    // Step 6: Send reply via Email Bison API (with one auto-retry on failure)
    console.log(`🚀 Sending reply to Email Bison API...`);

    // Build the Bison send request body once — used for both initial attempt and retry
    const bisonRequestBody = JSON.stringify({
      message: htmlMessage,
      content_type: 'html',
      inject_previous_email_body: true,
      use_dedicated_ips: true,
      sender_email_id: Number(senderEmailIdToUse),
      to_emails: [{ name: leadName, email_address: replyData.lead_email }],
      ...ccEmailsFormatted.length > 0 ? { cc_emails: ccEmailsFormatted } : {}
    });
    const bisonRequestInit = {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKeyToUse}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: bisonRequestBody
    };

    async function attemptBisonSend(attempt) {
      console.log(`📨 Bison send attempt ${attempt}...`);
      const resp = await fetch(`${baseUrl}/replies/${bisonReplyId}/reply`, bisonRequestInit);
      if (resp.ok) return { ok: true, resp };
      const errorText = await resp.text();
      console.error(`Bison attempt ${attempt} failed (status=${resp.status}):`, errorText);
      return { ok: false, status: resp.status, errorText };
    }

    let bisonResponse;
    let attemptResult = await attemptBisonSend(1);
    let retryAttempted = false;
    let lastError = null;

    if (!attemptResult.ok) {
      // First attempt failed — auto-retry once after a brief backoff.
      lastError = `attempt 1: status=${attemptResult.status} body=${attemptResult.errorText}`;
      retryAttempted = true;
      await new Promise((r) => setTimeout(r, 2000));
      // Bump retry_count + last_retry_at on the in-flight row so observability is accurate
      await supabase
        .from('sent_replies')
        .update({
          retry_count: 1,
          last_retry_at: new Date().toISOString()
        })
        .eq('reply_uuid', reply_uuid);
      attemptResult = await attemptBisonSend(2);
    }

    if (!attemptResult.ok) {
      // Both attempts failed — mark as failed and alert.
      const finalError = retryAttempted
        ? `${lastError} | attempt 2: status=${attemptResult.status} body=${attemptResult.errorText}`
        : `attempt 1: status=${attemptResult.status} body=${attemptResult.errorText}`;

      await supabase.from('sent_replies').upsert({
        reply_uuid: reply_uuid,
        workspace_name: workspace_name,
        lead_name: leadName,
        lead_email: replyData.lead_email,
        generated_reply_text: generated_reply_text,
        cc_emails: cc_emails || [],
        status: 'failed',
        sent_by: null,
        error_message: `Email Bison API error: ${finalError}`,
        retry_count: retryAttempted ? 1 : 0,
        last_retry_at: retryAttempted ? new Date().toISOString() : null
      }, {
        onConflict: 'reply_uuid'
      });

      // Slack alert: post to Failed Automations channel.
      // Don't await failure — best-effort notification, don't block the response.
      sendSlackAlert(workspace_name, leadName, replyData.lead_email, reply_uuid, finalError, retryAttempted)
        .catch((e) => console.error('Slack alert failed:', e));

      return new Response(JSON.stringify({
        success: false,
        error: `Email Bison API error after ${retryAttempted ? 2 : 1} attempt${retryAttempted ? 's' : ''}: ${attemptResult.status}`,
        retry_attempted: retryAttempted
      }), {
        status: 500,
        headers: corsHeaders
      });
    }

    bisonResponse = attemptResult.resp;
    const bisonData = await bisonResponse.json();
    // Extract outbound reply identifiers — these are what manual_email_sent webhook
    // will reference, so we save them for verification matching.
    const outboundReplyId = bisonData?.data?.reply?.id ?? null;
    const outboundReplyUuid = bisonData?.data?.reply?.uuid ?? null;
    console.log(`✅ Reply sent successfully via Email Bison (outbound reply id=${outboundReplyId}, uuid=${outboundReplyUuid})`);
    // Step 7: Upsert sent_replies table with success
    // Use upsert to create record if it doesn't exist
    const { error: upsertError } = await supabase.from('sent_replies').upsert({
      reply_uuid: reply_uuid,
      workspace_name: workspace_name,
      lead_name: leadName,
      lead_email: replyData.lead_email,
      generated_reply_text: generated_reply_text,
      cc_emails: cc_emails || [],
      status: 'sent',
      sent_at: new Date().toISOString(),
      sent_by: null,
      bison_reply_id: bisonReplyId,
      bison_outbound_reply_id: outboundReplyId,
      bison_outbound_reply_uuid: outboundReplyUuid
    }, {
      onConflict: 'reply_uuid' // Update if record already exists
    });
    if (upsertError) {
      console.error('❌ UPSERT FAILED - Error upserting sent_replies:', upsertError);
      console.error('Error code:', upsertError.code);
      console.error('Error message:', upsertError.message);
      console.error('Error details:', upsertError.details);
      console.error('Error hint:', upsertError.hint);
      console.error('Data attempted:', JSON.stringify({
        reply_uuid,
        workspace_name,
        status: 'sent',
        sent_at: new Date().toISOString()
      }));
    // Don't fail the request since email was sent successfully
    } else {
      console.log(`✅ SUCCESS - Upserted sent_replies table (reply_uuid: ${reply_uuid})`);
      console.log(`Record created/updated for workspace: ${workspace_name}`);
    }
    // Step 8: Return success response
    const response = {
      success: true,
      bison_reply_id: bisonReplyId
    };
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: corsHeaders
    });
  } catch (error) {
    console.error('Error sending reply via Bison:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Unknown error'
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
});
