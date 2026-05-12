import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);

  // Test 1: is_interested = true only
  const start1 = Date.now();
  const { data: d1, error: e1 } = await supabase
    .from('lead_replies')
    .select('id')
    .eq('is_interested', true)
    .gte('reply_date', cutoff.toISOString())
    .order('reply_date', { ascending: false })
    .limit(5000);
  const t1 = Date.now() - start1;

  // Test 2: all rows, 7 days, minimal fields
  const start2 = Date.now();
  const { data: d2 } = await supabase
    .from('lead_replies')
    .select('id')
    .gte('reply_date', cutoff.toISOString())
    .limit(5000);
  const t2 = Date.now() - start2;

  return new Response(JSON.stringify({ 
    interested_count: d1?.length, interested_ms: t1, interested_error: e1,
    all_count: d2?.length, all_ms: t2,
  }), { status: 200 });
});
