/**
 * Backfill Reply Templates for Clients Without Templates
 *
 * This script identifies clients in the client_registry that don't have
 * reply templates and creates default templates for them.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const DEFAULT_TEMPLATE_WITH_PHONE = `Great! I'd be happy to help you with that.

Is {phone_number} a good number to reach you?

Thanks!`;

const DEFAULT_TEMPLATE_NO_PHONE = `Great! I'd be happy to help you with that.

What's the best number to reach you?

Thanks!`;

async function backfillMissingTemplates() {
  console.log('🔍 Finding clients without reply templates...\n');

  try {
    // Get all active clients from client_registry
    const { data: clients, error: clientsError } = await supabase
      .from('client_registry')
      .select('workspace_id, workspace_name, display_name, billing_contact_email')
      .eq('is_active', true)
      .order('workspace_name');

    if (clientsError) {
      console.error('❌ Error fetching clients:', clientsError);
      return;
    }

    console.log(`Found ${clients.length} active clients\n`);

    // Get all existing templates
    const { data: existingTemplates, error: templatesError } = await supabase
      .from('reply_templates')
      .select('workspace_name');

    if (templatesError) {
      console.error('❌ Error fetching templates:', templatesError);
      return;
    }

    const templatesSet = new Set(existingTemplates?.map(t => t.workspace_name) || []);
    console.log(`Found ${templatesSet.size} existing templates\n`);

    // Find clients without templates
    const clientsWithoutTemplates = clients.filter(
      client => !templatesSet.has(client.workspace_name)
    );

    if (clientsWithoutTemplates.length === 0) {
      console.log('✅ All clients already have templates!');
      return;
    }

    console.log(`📋 Clients needing templates: ${clientsWithoutTemplates.length}\n`);
    console.log('Clients:');
    clientsWithoutTemplates.forEach((client, i) => {
      console.log(`  ${i + 1}. ${client.workspace_name} (${client.display_name || 'No display name'})`);
    });
    console.log('');

    // Create templates for each client
    const templatesToInsert = clientsWithoutTemplates.map(client => ({
      workspace_name: client.workspace_name,
      template_text_with_phone: DEFAULT_TEMPLATE_WITH_PHONE,
      template_text_no_phone: DEFAULT_TEMPLATE_NO_PHONE,
      cc_emails: client.billing_contact_email ? [client.billing_contact_email] : [],
      special_instructions: '⚠️ DEFAULT TEMPLATE - Please customize this template for the client',
    }));

    console.log('💾 Creating default templates...\n');

    const { data: insertedTemplates, error: insertError } = await supabase
      .from('reply_templates')
      .insert(templatesToInsert)
      .select();

    if (insertError) {
      console.error('❌ Error creating templates:', insertError);
      return;
    }

    console.log(`✅ Successfully created ${insertedTemplates.length} templates!\n`);

    // Summary
    console.log('📊 Summary:');
    console.log(`   Total active clients: ${clients.length}`);
    console.log(`   Previously had templates: ${templatesSet.size}`);
    console.log(`   Templates created: ${insertedTemplates.length}`);
    console.log(`   Total templates now: ${templatesSet.size + insertedTemplates.length}\n`);

    console.log('⚠️ Important: These are DEFAULT templates. Please customize them in the Client Profile page.');
    console.log('   Navigate to: Client Management → Select Client → Reply Templates tab\n');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

backfillMissingTemplates();
