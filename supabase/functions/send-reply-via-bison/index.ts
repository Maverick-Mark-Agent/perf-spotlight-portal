// Send Reply via Email Bison Edge Function
// Sends AI-generated reply through Email Bison API with CC support

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const BISON_BASE_URL = 'https://send.maverickmarketingllc.com/api';

interface SendReplyRequest {
  reply_uuid: string;
  workspace_name: string;
  generated_reply_text: string;
  cc_emails: string[];
  sender_email_id?: number; // Optional - will use default if not provided
}

interface SendReplyResponse {
  success: boolean;
  bison_reply_id?: number;
  error?: string;
}

serve(async (req) => {
  // CORS headers - define once and reuse everywhere
  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  // Handle OPTIONS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Parse request body
    const requestData: SendReplyRequest = await req.json();
    const {
      reply_uuid,
      workspace_name,
      generated_reply_text,
      cc_emails,
      sender_email_id
    } = requestData;

    console.log(`📧 Sending reply via Email Bison for ${workspace_name} - ${reply_uuid}`);

    // Step 1: Get workspace API key and bison reply ID from lead_replies table
    const { data: replyData, error: replyError } = await supabase
      .from('lead_replies')
      .select('bison_reply_numeric_id, bison_reply_id, lead_email, first_name, last_name, workspace_name')
      .eq('id', reply_uuid)
      .single();

    if (replyError || !replyData) {
      console.error('Reply not found:', replyError);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Reply not found: ${reply_uuid}`
        }),
        {
          status: 404,
          headers: corsHeaders
        }
      );
    }

    const leadName = [replyData.first_name, replyData.last_name].filter(Boolean).join(' ') || 'Lead';
    console.log(`✅ Found reply record: ${leadName} <${replyData.lead_email}>`);

    // Step 2: Get workspace API key
    const { data: workspace, error: workspaceError } = await supabase
      .from('client_registry')
      .select('bison_api_key, workspace_name')
      .eq('workspace_name', workspace_name)
      .single();

    if (workspaceError || !workspace || !workspace.bison_api_key) {
      console.error('Workspace or API key not found:', workspaceError);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Workspace not found or missing API key: ${workspace_name}`
        }),
        {
          status: 404,
          headers: corsHeaders
        }
      );
    }

    console.log(`✅ Found workspace API key for ${workspace_name}`);

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

      return new Response(
        JSON.stringify({
          success: false,
          error: 'This reply cannot be responded to because it\'s missing the required Email Bison reply ID. This happens for replies received before November 20, 2025. Please ask the lead to reply again, and the new reply will be compatible with our AI reply system.'
        }),
        {
          status: 400,
          headers: corsHeaders
        }
      );
    }

    console.log(`📨 Bison Reply ID (numeric): ${bisonReplyId}`);

    // Step 3.5: Get sender email account ID from email_accounts_raw
    // If not provided as parameter, query from database
    let senderEmailIdToUse = sender_email_id;

    if (!senderEmailIdToUse) {
      console.log(`🔍 Fetching sender_email_id from email_accounts_raw for workspace: ${workspace_name}`);
      const { data: emailAccount, error: emailAccountError } = await supabase
        .from('email_accounts_raw')
        .select('bison_account_id, email_address')
        .eq('workspace_name', workspace_name)
        .eq('status', 'Connected')
        .order('bison_account_id', { ascending: true })
        .limit(1)
        .single();

      if (emailAccountError || !emailAccount) {
        console.error('No connected email account found for workspace:', emailAccountError);
        return new Response(
          JSON.stringify({
            success: false,
            error: `No connected email account found for workspace: ${workspace_name}. Please ensure at least one email account is connected in Email Bison.`
          }),
          {
            status: 400,
            headers: corsHeaders
          }
        );
      }

      senderEmailIdToUse = emailAccount.bison_account_id;
      console.log(`✅ Using email account: ${emailAccount.email_address} (ID: ${senderEmailIdToUse})`);
    }

    // Step 4: Convert plain text reply to HTML with proper formatting
    // Claude generates plain text with \n line breaks, but Email Bison expects HTML
    const convertToHtml = (text: string): string => {
      // Escape HTML special characters first
      let html = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      // Split by double line breaks to identify paragraphs
      const paragraphs = html.split(/\n\n+/);

      // Convert each paragraph
      const formattedParagraphs = paragraphs.map(para => {
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
    const ccEmailsFormatted = cc_emails.map(email => ({
      name: email.split('@')[0], // Use email username as name
      email_address: email
    }));

    // Step 6: Send reply via Email Bison API
    console.log(`🚀 Sending reply to Email Bison API...`);

    const bisonResponse = await fetch(`${BISON_BASE_URL}/replies/${bisonReplyId}/reply`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${workspace.bison_api_key}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        message: htmlMessage,
        content_type: 'html', // Send as HTML for better formatting
        inject_previous_email_body: true, // Include previous email in thread
        use_dedicated_ips: true,
        sender_email_id: Number(senderEmailIdToUse), // Use fetched email account ID
        to_emails: [
          {
            name: leadName,
            email_address: replyData.lead_email
          }
        ],
        ...(ccEmailsFormatted.length > 0 ? { cc_emails: ccEmailsFormatted } : {}) // Only include if not empty
      })
    });

    if (!bisonResponse.ok) {
      const errorText = await bisonResponse.text();
      console.error('Email Bison API error:', errorText);

      // Upsert sent_replies with failure
      await supabase
        .from('sent_replies')
        .upsert({
          reply_uuid: reply_uuid,
          workspace_name: workspace_name,
          status: 'failed',
          sent_by: null,
          error_message: `Email Bison API error: ${errorText}`
        }, {
          onConflict: 'reply_uuid'
        });

      return new Response(
        JSON.stringify({
          success: false,
          error: `Email Bison API error: ${bisonResponse.status}`
        }),
        {
          status: 500,
          headers: corsHeaders
        }
      );
    }

    const bisonData = await bisonResponse.json();
    console.log(`✅ Reply sent successfully via Email Bison`);

    // Step 7: Upsert sent_replies table with success
    // Use upsert to create record if it doesn't exist
    const { error: upsertError } = await supabase
      .from('sent_replies')
      .upsert({
        reply_uuid: reply_uuid,
        workspace_name: workspace_name,
        status: 'sent',
        sent_at: new Date().toISOString(),
        sent_by: null, // Will be populated from RLS/auth context
        bison_reply_id: bisonReplyId
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
        sent_at: new Date().toISOString(),
      }));
      // Don't fail the request since email was sent successfully
    } else {
      console.log(`✅ SUCCESS - Upserted sent_replies table (reply_uuid: ${reply_uuid})`);
      console.log(`Record created/updated for workspace: ${workspace_name}`);
    }

    // Step 8: Return success response
    const response: SendReplyResponse = {
      success: true,
      bison_reply_id: bisonReplyId
    };

    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: corsHeaders
      }
    );

  } catch (error: any) {
    console.error('Error sending reply via Bison:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Unknown error'
      }),
      {
        status: 500,
        headers: corsHeaders
      }
    );
  }
});
