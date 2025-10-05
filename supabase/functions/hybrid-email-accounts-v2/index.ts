import "https://deno.land/x/xhr@0.1.0/mod.ts";
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
    const emailBisonApiKey = Deno.env.get('EMAIL_BISON_API_KEY');
    const longRunBisonApiKey = Deno.env.get('LONG_RUN_BISON_API_KEY');
    const longRunBisonBaseUrl = Deno.env.get('LONG_RUN_BISON_BASE_URL');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!emailBisonApiKey) {
      throw new Error('EMAIL_BISON_API_KEY not found');
    }

    // Define Email Bison instances to fetch from
    const bisonInstances = [
      {
        name: 'Maverick',
        baseUrl: 'https://send.maverickmarketingllc.com/api',
        apiKey: emailBisonApiKey
      }
    ];

    // Add Long Run Bison if credentials are available
    if (longRunBisonApiKey && longRunBisonBaseUrl) {
      bisonInstances.push({
        name: 'Long Run',
        baseUrl: longRunBisonBaseUrl,
        apiKey: longRunBisonApiKey
      });
    }

    let allSenderEmails: any[] = [];

    // Fetch from all Email Bison instances
    for (const instance of bisonInstances) {
      console.log(`Fetching workspaces from ${instance.name} Email Bison...`);

      // Step 1: Fetch all workspaces for this instance
      const workspacesResponse = await fetch(`${instance.baseUrl}/workspaces/v1.1`, {
        headers: {
          'Authorization': `Bearer ${instance.apiKey}`,
          'Accept': 'application/json',
        },
      });

      if (!workspacesResponse.ok) {
        console.error(`${instance.name} Email Bison API error: ${workspacesResponse.status}`);
        continue;
      }

      const workspacesData = await workspacesResponse.json();
      const workspaces = workspacesData.data || [];

      console.log(`Fetched ${workspaces.length} workspaces from ${instance.name}`);

      // Step 2: Fetch sender emails from each workspace by switching context
      for (const workspace of workspaces) {
        try {
          console.log(`[${instance.name}] Switching to workspace: ${workspace.name} (ID: ${workspace.id})`);

          // Switch to the workspace
          const switchResponse = await fetch(
            `${instance.baseUrl}/workspaces/v1.1/switch-workspace`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${instance.apiKey}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ team_id: workspace.id }),
            }
          );

          if (!switchResponse.ok) {
            console.error(`Failed to switch to workspace ${workspace.name}: ${switchResponse.status}`);
            continue;
          }

          // Fetch ALL sender emails for this workspace with pagination
          let workspaceSenderEmails: any[] = [];
          let nextUrl: string | null = `${instance.baseUrl}/sender-emails?per_page=100`;

          // Loop through all pages
          while (nextUrl) {
            const bisonResponse = await fetch(nextUrl, {
              headers: {
                'Authorization': `Bearer ${instance.apiKey}`,
                'Accept': 'application/json',
              },
            });

            if (!bisonResponse.ok) {
              console.error(`Failed to fetch sender emails for workspace ${workspace.name}: ${bisonResponse.status}`);
              break;
            }

            const bisonData = await bisonResponse.json();
            const pageEmails = bisonData.data || [];

            // Add workspace context to each sender email
            pageEmails.forEach((email: any) => {
              email.workspace_id = workspace.id;
              email.workspace_name = workspace.name;
              email.bison_instance = instance.name;
            });

            workspaceSenderEmails = workspaceSenderEmails.concat(pageEmails);

            // Check for next page
            nextUrl = bisonData.links?.next || null;

            console.log(`Fetched ${pageEmails.length} sender emails from ${workspace.name} (page ${bisonData.meta?.current_page || 1}/${bisonData.meta?.last_page || 1})`);
          }

          allSenderEmails = allSenderEmails.concat(workspaceSenderEmails);
          console.log(`Total fetched from ${workspace.name}: ${workspaceSenderEmails.length} sender emails`);

        } catch (error) {
          console.error(`Error fetching sender emails for workspace ${workspace.name}:`, error);
        }
      }
    }

    const senderEmails = allSenderEmails;
    console.log(`Total sender emails fetched across all instances: ${senderEmails.length}`);

    // Step 3: Fetch metadata from Supabase (for manual price overrides only)
    console.log('Fetching email account metadata from Supabase...');

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: metadataRecords, error: supabaseError } = await supabase
      .from('email_account_metadata')
      .select('*');

    if (supabaseError) {
      console.error('Supabase error:', supabaseError);
      // Continue without metadata if Supabase fails (graceful degradation)
    }

    console.log(`Fetched ${metadataRecords?.length || 0} metadata records from Supabase`);

    // Create a map of Supabase metadata by email address for quick lookup
    const metadataMap = new Map();
    (metadataRecords || []).forEach(record => {
      metadataMap.set(record.email_address.toLowerCase(), record);
    });

    // Step 4: Pre-calculate domain counts for pricing and sending limits
    const scaledMailDomainCounts = new Map();
    const mailrDomainCounts = new Map();

    senderEmails.forEach((email: any) => {
      const reseller = extractResellerFromTags(email.tags);
      const domain = email.email.split('@')[1] || '';

      if (reseller.toLowerCase() === 'scaledmail') {
        scaledMailDomainCounts.set(domain, (scaledMailDomainCounts.get(domain) || 0) + 1);
      }

      if (reseller.toLowerCase() === 'mailr') {
        mailrDomainCounts.set(domain, (mailrDomainCounts.get(domain) || 0) + 1);
      }
    });

    console.log(`ScaledMail: ${scaledMailDomainCounts.size} domains`);
    console.log(`Mailr: ${mailrDomainCounts.size} domains`);

    // Step 5: Merge Email Bison data with calculated pricing
    const mergedRecords = senderEmails.map((bisonEmail: any) => {
      const metadata = metadataMap.get(bisonEmail.email.toLowerCase()) || {};

      // Extract provider and account type from Email Bison tags
      // Note: Must extract reseller first, as provider logic depends on it
      const reseller = extractResellerFromTags(bisonEmail.tags);
      const emailProvider = extractProviderFromTags(bisonEmail.tags, reseller);
      const domain = bisonEmail.email.split('@')[1] || '';

      // Calculate price dynamically based on provider + account type + domain counts
      const calculatedPrice = calculatePrice(reseller, emailProvider, domain, scaledMailDomainCounts);

      // Use Supabase price if manually set, otherwise use calculated price
      const finalPrice = metadata.price !== undefined && metadata.price !== null && metadata.price !== 0
        ? metadata.price
        : calculatedPrice.price;

      // Calculate daily sending limit based on provider rules
      const calculatedSendingLimit = calculateDailySendingLimit(
        emailProvider,
        reseller,
        domain,
        scaledMailDomainCounts,
        mailrDomainCounts
      );

      // Use Supabase sending limit if manually set, otherwise use calculated limit
      const finalSendingLimit = metadata.daily_sending_limit !== undefined && metadata.daily_sending_limit !== null
        ? metadata.daily_sending_limit
        : calculatedSendingLimit.limit;

      return {
        id: bisonEmail.id,
        fields: {
          // Email Bison data (real-time metrics)
          'Email Account': bisonEmail.email,
          'Name': bisonEmail.name,
          'Status': bisonEmail.status,
          'Daily Limit': bisonEmail.daily_limit,
          'Total Sent': bisonEmail.emails_sent_count,
          'Total Replied': bisonEmail.total_replied_count,
          'Total Bounced': bisonEmail.bounced_count,
          'Total Opened': bisonEmail.total_opened_count,
          'Unique Replied': bisonEmail.unique_replied_count,
          'Unique Opened': bisonEmail.unique_opened_count,
          'Total Leads Contacted': bisonEmail.total_leads_contacted_count,
          'Interested Leads': bisonEmail.interested_leads_count,
          'Unsubscribed': bisonEmail.unsubscribed_count,
          'Account Type': bisonEmail.type,

          // Calculate reply rate
          'Reply Rate Per Account %': bisonEmail.emails_sent_count > 0
            ? (bisonEmail.unique_replied_count / bisonEmail.emails_sent_count) * 100
            : 0,

          // Workspace info from Email Bison
          'Workspace': bisonEmail.workspace_name,
          'Workspace ID': bisonEmail.workspace_id,
          'Bison Instance': bisonEmail.bison_instance,

          // Extracted from Email Bison (no external source needed)
          'Tag - Email Provider': emailProvider,
          'Tag - Reseller': reseller,
          'Client': [bisonEmail.workspace_name], // Use workspace name as client (array for compatibility)
          'Client Name (from Client)': [bisonEmail.workspace_name],
          'Domain': domain,
          'Volume Per Account': finalSendingLimit, // Calculated or manual override sending limit
          'Clients Daily Volume Target': 0, // Not available in Email Bison

          // Pricing (calculated dynamically or from Supabase override)
          'Price': finalPrice,
          'Price Source': metadata.price !== undefined && metadata.price !== null && metadata.price !== 0 ? 'manual' : 'calculated',
          'Pricing Needs Review': calculatedPrice.needsReview,
          'Sending Limit Source': metadata.daily_sending_limit !== undefined && metadata.daily_sending_limit !== null ? 'manual' : 'calculated',
          'Sending Limit Needs Review': calculatedSendingLimit.needsReview,
          'Notes': metadata.notes || null,

          // Tags from Email Bison (both array of names and full tag objects)
          'Tags': bisonEmail.tags.map((tag: any) => tag.name),
          'Tag Objects': bisonEmail.tags, // Full tag objects with id, name, default

          // Timestamps
          'Created At': bisonEmail.created_at,
          'Updated At': bisonEmail.updated_at,
        }
      };
    });

    console.log(`Merged ${mergedRecords.length} email accounts (Email Bison + Calculated Pricing)`);

    return new Response(JSON.stringify({ records: mergedRecords }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in hybrid-email-accounts-v2 function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

// Helper function to extract email provider from tags
function extractProviderFromTags(tags: any[], reseller: string): string {
  if (!tags || tags.length === 0) return 'Unknown';

  // Special rule: ScaledMail and Mailr accounts always go to Outlook
  // (regardless of whether they have Microsoft or Outlook tag)
  const resellerLower = reseller.toLowerCase();
  if (resellerLower === 'scaledmail' || resellerLower === 'mailr') {
    return 'Outlook';
  }

  // For other accounts, check provider tags normally
  const providerTags = ['Gmail', 'Microsoft', 'Outlook', 'Google', 'Yahoo', 'Custom'];
  for (const tag of tags) {
    if (providerTags.includes(tag.name)) {
      return tag.name;
    }
  }

  return 'Unknown';
}

// Helper function to extract reseller/provider from tags
function extractResellerFromTags(tags: any[]): string {
  if (!tags || tags.length === 0) return 'Unknown';

  // Provider tags to check (in priority order)
  const providerTags = ['CheapInboxes', 'Zapmail', 'Mailr', 'ScaledMail'];
  for (const tag of tags) {
    if (providerTags.includes(tag.name)) {
      return tag.name;
    }
  }

  // If no provider found, check for other common reseller tags
  const otherResellers = ['Instantly', 'Smartlead', 'Apollo', 'Saleshandy', 'Lemlist', 'Woodpecker'];
  for (const tag of tags) {
    if (otherResellers.includes(tag.name)) {
      return tag.name;
    }
  }

  // Return first non-standard tag as reseller
  const standardTags = ['Gmail', 'Microsoft', 'Outlook', 'Google', 'Yahoo', 'Custom', 'Healthy', 'Damaged', 'Warming', 'Warmup', 'Active', 'Ramping', 'Recovery'];
  for (const tag of tags) {
    if (!standardTags.includes(tag.name) && !tag.name.match(/^\d+\/\d+$/)) {
      return tag.name;
    }
  }

  return 'Unknown';
}

// Helper function to calculate price based on provider + account type + domain
function calculatePrice(
  provider: string,
  accountType: string,
  domain: string,
  scaledMailDomainCounts: Map<string, number>
): { price: number; needsReview: boolean } {
  const providerLower = provider.toLowerCase();
  const accountTypeLower = accountType.toLowerCase();

  // CheapInboxes: All types = $3.00 (including "cheapinboxes - 1", "cheapinboxes - 2", etc.)
  if (providerLower.includes('cheapinboxes')) {
    return { price: 3.00, needsReview: false };
  }

  // Zapmail: All types = $3.00
  if (providerLower === 'zapmail') {
    return { price: 3.00, needsReview: false };
  }

  // Mailr: All types = $180 total / 198 accounts = ~$0.91 per account
  if (providerLower === 'mailr') {
    return { price: 0.91, needsReview: false };
  }

  // ScaledMail: $50 per domain ÷ number of mailboxes on that domain
  if (providerLower === 'scaledmail') {
    const mailboxesOnDomain = scaledMailDomainCounts.get(domain) || 0;
    if (mailboxesOnDomain > 0) {
      const pricePerMailbox = 50 / mailboxesOnDomain;
      return { price: pricePerMailbox, needsReview: false };
    }
    // If we can't find domain count, flag for review
    return { price: 0, needsReview: true };
  }

  // Google Healthy / Other health status tags: Default to $3.00 for Google accounts
  if (providerLower.includes('healthy') || providerLower.includes('warming') ||
      providerLower.includes('warmup') || providerLower.includes('warmy')) {
    if (accountTypeLower === 'google') {
      return { price: 3.00, needsReview: false };
    }
  }

  // Unknown provider - needs review
  return { price: 0, needsReview: true };
}

// Helper function to calculate daily sending limit based on provider rules
function calculateDailySendingLimit(
  emailProvider: string,
  reseller: string,
  domain: string,
  scaledMailDomainCounts: Map<string, number>,
  mailrDomainCounts: Map<string, number>
): { limit: number; needsReview: boolean } {
  const providerLower = emailProvider.toLowerCase();
  const resellerLower = reseller.toLowerCase();

  // Check reseller-specific rules FIRST (these override generic provider rules)

  // Mailr: 495 emails/day per domain ÷ number of mailboxes on that domain
  if (resellerLower === 'mailr') {
    const mailboxesOnDomain = mailrDomainCounts.get(domain) || 0;
    if (mailboxesOnDomain > 0) {
      const limitPerMailbox = Math.floor(495 / mailboxesOnDomain);
      return { limit: limitPerMailbox, needsReview: false };
    }
    // If we can't find domain count, flag for review
    return { limit: 0, needsReview: true };
  }

  // ScaledMail: Domain-based tiered limits
  // - Domains with 49-50 mailboxes: 5 emails/day per mailbox
  // - Domains with ~25 mailboxes: 8 emails/day per mailbox
  // - Smaller domains: 5 emails/day default
  if (resellerLower === 'scaledmail') {
    const mailboxesOnDomain = scaledMailDomainCounts.get(domain) || 0;
    if (mailboxesOnDomain >= 49) {
      return { limit: 5, needsReview: false }; // Large domains
    } else if (mailboxesOnDomain >= 25) {
      return { limit: 8, needsReview: false }; // Medium domains
    } else if (mailboxesOnDomain > 0) {
      return { limit: 5, needsReview: false }; // Small domains default
    }
    // If we can't find domain count, flag for review
    return { limit: 0, needsReview: true };
  }

  // Then check generic provider rules (for accounts not covered by reseller rules)

  // Google/Gmail accounts: 20 emails/day
  if (providerLower === 'google' || providerLower === 'gmail') {
    return { limit: 20, needsReview: false };
  }

  // Microsoft accounts: 20 emails/day
  if (providerLower === 'microsoft') {
    return { limit: 20, needsReview: false };
  }

  // Outlook accounts: 20 emails/day
  if (providerLower === 'outlook') {
    return { limit: 20, needsReview: false };
  }

  // Unknown provider - needs review
  return { limit: 0, needsReview: true };
}
