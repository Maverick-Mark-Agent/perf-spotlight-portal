// Diagnostic: dump the raw Bison /campaigns/sending-schedules response
// for a single workspace so we can verify what `emails_being_sent`
// actually represents. Read-only — does not write to client_metrics.
//
// Usage:
//   curl ".../debug-bison-schedule?workspace=Gaudio%20Insurance%20Group&day=tomorrow"

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const workspaceName = url.searchParams.get('workspace');
    const day = url.searchParams.get('day') ?? 'tomorrow';

    if (!workspaceName) {
      throw new Error('Missing ?workspace= query param');
    }
    if (!['today', 'tomorrow'].includes(day)) {
      throw new Error(`Invalid day "${day}" — must be today or tomorrow`);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: client, error } = await supabase
      .from('client_registry')
      .select('workspace_name, bison_workspace_id, bison_instance, bison_api_key, daily_sending_target')
      .eq('workspace_name', workspaceName)
      .single();

    if (error || !client) {
      throw new Error(`Workspace "${workspaceName}" not found: ${error?.message}`);
    }
    if (!client.bison_api_key) {
      throw new Error(`Workspace "${workspaceName}" has no bison_api_key`);
    }

    const baseUrl = client.bison_instance === 'longrun'
      ? 'https://send.longrun.agency/api'
      : 'https://send.maverickmarketingllc.com/api';

    const bisonRes = await fetch(
      `${baseUrl}/campaigns/sending-schedules?day=${day}`,
      {
        headers: {
          'Authorization': `Bearer ${client.bison_api_key}`,
          'Accept': 'application/json',
        },
      },
    );

    const bisonBody = await bisonRes.text();
    let parsed: any = null;
    try {
      parsed = JSON.parse(bisonBody);
    } catch {
      // leave parsed null, return raw body
    }

    // Compute the same aggregation our sync function does so we can
    // compare it to what each individual campaign reports.
    let totalEmailsBeingSent = 0;
    const perCampaign: any[] = [];
    if (parsed?.data && Array.isArray(parsed.data)) {
      for (const c of parsed.data) {
        const ebs = Number(c?.emails_being_sent ?? 0);
        totalEmailsBeingSent += ebs;
        perCampaign.push({
          id: c?.id,
          name: c?.name,
          status: c?.status,
          emails_being_sent: ebs,
          daily_limit: c?.daily_limit,
          // include a few likely-interesting fields if present
          total_emails: c?.total_emails,
          remaining_emails: c?.remaining_emails,
          scheduled_emails: c?.scheduled_emails,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        workspace_name: client.workspace_name,
        bison_workspace_id: client.bison_workspace_id,
        daily_sending_target: client.daily_sending_target,
        bison_endpoint: `${baseUrl}/campaigns/sending-schedules?day=${day}`,
        bison_http_status: bisonRes.status,
        sum_emails_being_sent: totalEmailsBeingSent,
        campaign_count: perCampaign.length,
        per_campaign: perCampaign,
        raw_response_keys: parsed ? Object.keys(parsed) : null,
      }, null, 2),
      { headers: corsHeaders },
    );
  } catch (err: any) {
    console.error('debug-bison-schedule error:', err);
    return new Response(
      JSON.stringify({ success: false, error: err?.message ?? String(err) }),
      { status: 500, headers: corsHeaders },
    );
  }
});
