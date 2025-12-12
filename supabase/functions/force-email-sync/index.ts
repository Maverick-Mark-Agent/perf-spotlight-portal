import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 Force Email Sync - Starting...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const bisonApiKey = Deno.env.get('EMAIL_BISON_API_KEY');

    if (!bisonApiKey) {
      throw new Error('EMAIL_BISON_API_KEY not configured in Edge Function secrets');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch from Email Bison
    console.log('📥 Fetching accounts from Email Bison...');
    const bisonResponse = await fetch('https://send.maverickmarketingllc.com/api/workspaces/v1.1', {
      headers: {
        'Authorization': `Bearer ${bisonApiKey}`,
        'Accept': 'application/json',
      },
    });

    if (!bisonResponse.ok) {
      throw new Error(`Email Bison API error: ${bisonResponse.status}`);
    }

    const workspacesData = await bisonResponse.json();
    const workspaces = workspacesData.data || [];

    console.log(`✅ Fetched ${workspaces.length} workspaces`);

    let allAccounts: any[] = [];
    let processedWorkspaces = 0;

    // Fetch sender emails from each workspace
    for (const workspace of workspaces) {
      try {
        console.log(`Processing workspace: ${workspace.name} (${++processedWorkspaces}/${workspaces.length})`);

        // Switch to workspace
        const switchResponse = await fetch(
          'https://send.maverickmarketingllc.com/api/workspaces/v1.1/switch-workspace',
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${bisonApiKey}`,
              'Accept': 'application/json',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ workspace_id: workspace.id }),
          }
        );

        if (!switchResponse.ok) {
          console.error(`Failed to switch to workspace ${workspace.name}`);
          continue;
        }

        // Fetch sender emails
        const emailsResponse = await fetch(
          'https://send.maverickmarketingllc.com/api/sender-emails/v1.1?per_page=1000',
          {
            headers: {
              'Authorization': `Bearer ${bisonApiKey}`,
              'Accept': 'application/json',
            },
          }
        );

        if (!emailsResponse.ok) {
          console.error(`Failed to fetch emails for workspace ${workspace.name}`);
          continue;
        }

        const emailsData = await emailsResponse.json();
        const emails = emailsData.data || [];

        // Add workspace name to each account
        emails.forEach((email: any) => {
          email.workspace_name = workspace.name;
        });

        allAccounts = allAccounts.concat(emails);
        console.log(`  ✓ Added ${emails.length} accounts (total: ${allAccounts.length})`);

      } catch (err) {
        console.error(`Error processing workspace ${workspace.name}:`, err);
        continue;
      }
    }

    console.log(`\n📊 Total accounts fetched: ${allAccounts.length}`);
    console.log('💾 Updating database...');

    // Batch upsert to database
    const batchSize = 100;
    let updated = 0;
    const now = new Date().toISOString();

    for (let i = 0; i < allAccounts.length; i += batchSize) {
      const batch = allAccounts.slice(i, i + batchSize);

      const upsertData = batch.map(account => ({
        email_address: account.email_address,
        workspace_name: account.workspace_name || 'Unknown',
        emails_sent_count: parseInt(account.emails_sent_count) || 0,
        total_replied_count: parseInt(account.total_replied_count) || 0,
        total_connected_count: parseInt(account.total_connected_count) || 0,
        total_interested_count: parseInt(account.total_interested_count) || 0,
        total_not_interested_count: parseInt(account.total_not_interested_count) || 0,
        total_do_not_contact_count: parseInt(account.total_do_not_contact_count) || 0,
        total_unsubscribed_count: parseInt(account.total_unsubscribed_count) || 0,
        total_email_bounced_count: parseInt(account.total_email_bounced_count) || 0,
        total_wrong_person_count: parseInt(account.total_wrong_person_count) || 0,
        disconnected_count: parseInt(account.disconnected_count) || 0,
        is_disconnected: account.is_disconnected === 1,
        last_synced_at: now
      }));

      const { error } = await supabase
        .from('sender_emails_cache')
        .upsert(upsertData, {
          onConflict: 'email_address',
          ignoreDuplicates: false
        });

      if (error) {
        console.error(`Batch ${Math.floor(i/batchSize) + 1} error:`, error.message);
      } else {
        updated += batch.length;
        console.log(`  ✓ Progress: ${updated}/${allAccounts.length} (${Math.round(updated/allAccounts.length*100)}%)`);
      }
    }

    console.log(`\n✅ Sync complete! Updated ${updated} accounts`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully synced ${updated} email accounts`,
        workspaces: workspaces.length,
        accounts: updated,
        timestamp: now
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('❌ Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
