import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const stuckIds = [3577, 3578, 3597, 3683, 3723, 3729, 3737];
  const results = [];

  for (const sentReplyId of stuckIds) {
    try {
      // Get sent_reply details
      const { data: sr } = await supabase
        .from('sent_replies')
        .select('id, reply_uuid, workspace_name, lead_email, generated_reply_text, cc_emails')
        .eq('id', sentReplyId)
        .single();

      if (!sr) { results.push({ id: sentReplyId, status: 'not found' }); continue; }

      // Get lead_replies details
      const { data: lr } = await supabase
        .from('lead_replies')
        .select('bison_reply_numeric_id, original_sender_email_id')
        .eq('id', sr.reply_uuid)
        .single();

      if (!lr) { results.push({ id: sentReplyId, status: 'lead reply not found' }); continue; }
      if (!lr.bison_reply_numeric_id) { results.push({ id: sentReplyId, status: 'no bison_reply_numeric_id' }); continue; }

      // Get workspace API key
      const { data: reg } = await supabase
        .from('client_registry')
        .select('bison_api_key, bison_workspace_id')
        .eq('workspace_name', sr.workspace_name)
        .single();

      if (!reg?.bison_api_key) { results.push({ id: sentReplyId, status: 'no api key' }); continue; }

      // Get sender email ID — use original or fallback to most recent
      let senderEmailId = lr.original_sender_email_id;
      if (!senderEmailId) {
        const { data: recent } = await supabase
          .from('lead_replies')
          .select('original_sender_email_id')
          .eq('workspace_name', sr.workspace_name)
          .not('original_sender_email_id', 'is', null)
          .order('reply_date', { ascending: false })
          .limit(1)
          .maybeSingle();
        senderEmailId = recent?.original_sender_email_id;
      }

      if (!senderEmailId) { results.push({ id: sentReplyId, status: 'no sender email id' }); continue; }

      // Convert plain text to HTML
      const htmlBody = '<p>' + (sr.generated_reply_text || '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .split('\n\n').join('</p><p>')
        .split('\n').join('<br>') + '</p>';

      // Send via Bison
      const bisonBody: any = {
        body: htmlBody,
        email_account_id: senderEmailId,
      };
      if (sr.cc_emails?.length) bisonBody.cc = sr.cc_emails;

      const bisonRes = await fetch(
        `https://send.maverickmarketingllc.com/api/workspaces/v1.1/${reg.bison_workspace_id}/replies/${lr.bison_reply_numeric_id}/reply`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${reg.bison_api_key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(bisonBody),
        }
      );

      const bisonData = await bisonRes.json();
      const success = bisonData?.data?.success === true;

      if (success) {
        // Mark as verified
        await supabase.from('sent_replies').update({
          verified_at: new Date().toISOString(),
          error_message: 'Manually resent after silent failure'
        }).eq('id', sentReplyId);
        results.push({ id: sentReplyId, workspace: sr.workspace_name, lead: sr.lead_email, status: 'resent ✓' });
      } else {
        results.push({ id: sentReplyId, workspace: sr.workspace_name, lead: sr.lead_email, status: 'bison error', detail: JSON.stringify(bisonData) });
      }
    } catch (err) {
      results.push({ id: sentReplyId, status: 'exception', detail: String(err) });
    }
  }

  return new Response(JSON.stringify(results, null, 2), { status: 200, headers: { 'Content-Type': 'application/json' } });
});
