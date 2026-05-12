const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://gjqbbgrfhijescaouqkx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0'
);

async function checkReplyTemplates() {
  // 1. Get all active clients from client_registry
  const { data: clients, error: clientErr } = await supabase
    .from('client_registry')
    .select('workspace_name, display_name, is_active, client_type, bison_webhook_enabled, bison_webhook_last_received_at, bison_instance')
    .order('workspace_name');

  if (clientErr) { console.error('Error fetching clients:', clientErr.message); return; }

  // 2. Get all reply templates
  const { data: templates, error: tmplErr } = await supabase
    .from('reply_templates')
    .select('*')
    .order('workspace_name');

  if (tmplErr) { console.error('Error fetching templates:', tmplErr.message); return; }

  // 3. Get recent reply counts per workspace (activity indicator)
  const { data: replyActivity } = await supabase
    .from('lead_replies')
    .select('workspace_name')
    .gte('reply_date', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());

  const replyCounts = {};
  (replyActivity || []).forEach(r => {
    replyCounts[r.workspace_name] = (replyCounts[r.workspace_name] || 0) + 1;
  });

  // 4. Build template map
  const templateMap = {};
  (templates || []).forEach(t => { templateMap[t.workspace_name] = t; });

  // 5. Determine active clients (has webhook enabled OR has recent replies OR has emails sent)
  const activeClients = (clients || []).filter(c => {
    const hasRecentReplies = (replyCounts[c.workspace_name] || 0) > 0;
    const hasWebhook = c.bison_webhook_enabled;
    const hasRecentWebhookActivity = c.bison_webhook_last_received_at &&
      new Date(c.bison_webhook_last_received_at) > new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    return c.is_active && (hasRecentReplies || hasRecentWebhookActivity || hasWebhook);
  });

  console.log(`\n${'='.repeat(100)}`);
  console.log('REPLY TEMPLATES AUDIT — Active Clients Only');
  console.log(`${'='.repeat(100)}\n`);
  console.log(`Total clients in registry: ${(clients || []).length}`);
  console.log(`Active clients (webhook/replies/emails): ${activeClients.length}`);
  console.log(`Total reply templates in DB: ${(templates || []).length}\n`);

  const issues = [];
  const ok = [];

  for (const client of activeClients) {
    const ws = client.workspace_name;
    const tmpl = templateMap[ws];
    const recentReplies = replyCounts[ws] || 0;

    const clientIssues = [];

    if (!tmpl) {
      clientIssues.push('❌ NO TEMPLATE EXISTS');
    } else {
      // Check template_text_with_phone
      if (!tmpl.template_text_with_phone || tmpl.template_text_with_phone.trim().length < 20) {
        clientIssues.push('❌ template_text_with_phone is empty or too short');
      } else {
        // Check for placeholder usage
        const withPhone = tmpl.template_text_with_phone;
        if (!withPhone.includes('{first_name}') && !withPhone.includes('{full_name}')) {
          clientIssues.push('⚠️  template_with_phone: no name placeholder ({first_name} or {full_name})');
        }
        if (!withPhone.includes('{phone_number}')) {
          clientIssues.push('⚠️  template_with_phone: missing {phone_number} placeholder (this template is for leads WITH phone)');
        }
      }

      // Check template_text_no_phone
      if (!tmpl.template_text_no_phone || tmpl.template_text_no_phone.trim().length < 20) {
        clientIssues.push('❌ template_text_no_phone is empty or too short');
      } else {
        const noPhone = tmpl.template_text_no_phone;
        if (!noPhone.includes('{first_name}') && !noPhone.includes('{full_name}')) {
          clientIssues.push('⚠️  template_no_phone: no name placeholder ({first_name} or {full_name})');
        }
        if (noPhone.includes('{phone_number}')) {
          clientIssues.push('⚠️  template_no_phone: contains {phone_number} but this template is for leads WITHOUT phone');
        }
      }

      // Check if both templates are identical (likely copy-paste mistake)
      if (
        tmpl.template_text_with_phone && tmpl.template_text_no_phone &&
        tmpl.template_text_with_phone.trim() === tmpl.template_text_no_phone.trim()
      ) {
        clientIssues.push('⚠️  Both templates are IDENTICAL — with_phone should reference {phone_number}');
      }

      // Check CC emails
      if (!tmpl.cc_emails || tmpl.cc_emails.length === 0) {
        clientIssues.push('⚠️  No CC emails configured');
      }

      // Check last updated (warn if never updated — likely default template)
      const created = new Date(tmpl.created_at);
      const updated = new Date(tmpl.updated_at || tmpl.created_at);
      const diffMs = updated - created;
      const neverUpdated = diffMs < 5000; // less than 5 seconds means it was never saved after creation
      if (neverUpdated) {
        clientIssues.push('⚠️  Template has never been updated — may be a default/blank template');
      }
    }

    const status = {
      workspace: ws,
      display: client.display_name || ws,
      recentReplies,
      webhookEnabled: client.bison_webhook_enabled,
      bisonInstance: client.bison_instance,
      hasTemplate: !!tmpl,
      ccEmails: tmpl?.cc_emails || [],
      withPhoneLen: tmpl?.template_text_with_phone?.length || 0,
      noPhoneLen: tmpl?.template_text_no_phone?.length || 0,
      lastUpdated: tmpl?.updated_at ? new Date(tmpl.updated_at).toLocaleDateString() : 'N/A',
      issues: clientIssues,
    };

    if (clientIssues.length > 0) {
      issues.push(status);
    } else {
      ok.push(status);
    }
  }

  // Print issues first
  if (issues.length > 0) {
    console.log(`${'─'.repeat(100)}`);
    console.log(`CLIENTS WITH ISSUES (${issues.length})`);
    console.log(`${'─'.repeat(100)}\n`);

    for (const c of issues) {
      console.log(`📋 ${c.workspace} ${c.recentReplies > 0 ? `[${c.recentReplies} replies/90d]` : ''}`);
      console.log(`   Instance: ${c.bisonInstance || 'unknown'} | CC Emails: ${c.ccEmails.length > 0 ? c.ccEmails.join(', ') : '(none)'}`);
      console.log(`   Templates: with_phone=${c.withPhoneLen} chars | no_phone=${c.noPhoneLen} chars | last updated: ${c.lastUpdated}`);
      c.issues.forEach(i => console.log(`   ${i}`));
      console.log();
    }
  }

  // Print OK clients
  if (ok.length > 0) {
    console.log(`${'─'.repeat(100)}`);
    console.log(`CLIENTS LOOKING GOOD (${ok.length})`);
    console.log(`${'─'.repeat(100)}\n`);

    for (const c of ok) {
      console.log(`✅ ${c.workspace.padEnd(40)} CC: ${String(c.ccEmails.length).padEnd(3)} emails | with_phone: ${String(c.withPhoneLen).padEnd(5)} chars | no_phone: ${String(c.noPhoneLen).padEnd(5)} chars | updated: ${c.lastUpdated}`);
    }
  }

  // Summary
  console.log(`\n${'='.repeat(100)}`);
  console.log('SUMMARY');
  console.log(`${'='.repeat(100)}`);
  console.log(`✅ Clean:  ${ok.length} clients`);
  console.log(`⚠️  Issues: ${issues.length} clients`);

  // Check for templates in DB that don't match any client
  const activeNames = new Set(activeClients.map(c => c.workspace_name));
  const orphanTemplates = (templates || []).filter(t => !activeNames.has(t.workspace_name));
  if (orphanTemplates.length > 0) {
    console.log(`\n🔍 Templates with no matching active client (${orphanTemplates.length}):`);
    orphanTemplates.forEach(t => console.log(`   - ${t.workspace_name}`));
  }

  console.log();
}

checkReplyTemplates().catch(console.error);
