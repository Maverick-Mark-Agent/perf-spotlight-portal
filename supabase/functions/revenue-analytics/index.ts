import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Normalize client names for matching (handles case, spacing, special chars)
const normalizeClientName = (name: string): string => {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
};

// NOTE: Pricing data now comes from client_registry table in Supabase
// No more hardcoded pricing or name mapping!

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    // Get authorization from incoming request
    const authHeader = req.headers.get('Authorization');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase credentials');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Fetching revenue analytics...');

    // Step 1: Get client pricing from client_registry
    console.log('📥 Fetching client pricing from client_registry...');
    const { data: registryClients, error: registryError } = await supabase
      .from('client_registry')
      .select('*')
      .eq('is_active', true);

    if (registryError) {
      throw new Error(`Error fetching client_registry: ${registryError.message}`);
    }

    console.log(`  Found ${registryClients.length} active clients in registry`);

    // Build pricing lookup by workspace name
    const pricingLookup: Record<string, any> = {};
    registryClients.forEach(client => {
      pricingLookup[client.workspace_name] = {
        billing_type: client.billing_type,
        price_per_lead: parseFloat(client.price_per_lead) || 0,
        retainer_amount: parseFloat(client.retainer_amount) || 0,
        workspace_id: client.workspace_id,
        display_name: client.display_name, // Add display_name from registry
      };
    });

    // Step 2: Get KPI data from hybrid-workspace-analytics using HTTP fetch (forward auth)
    console.log('📥 Fetching KPI data from hybrid-workspace-analytics...');
    const kpiResponse = await fetch(`${supabaseUrl}/functions/v1/hybrid-workspace-analytics`, {
      headers: {
        'Authorization': authHeader || '',
        'Content-Type': 'application/json',
      },
    });

    if (!kpiResponse.ok) {
      throw new Error(`Error fetching KPI data: ${kpiResponse.status} ${kpiResponse.statusText}`);
    }

    const kpiData = await kpiResponse.json();
    const kpiClients = kpiData?.clients || [];
    console.log(`  Found ${kpiClients.length} clients from KPI dashboard`);

    // Calculate days remaining in month for projections
    const now = new Date();
    const currentDay = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysRemaining = daysInMonth - currentDay;
    const monthProgress = currentDay / daysInMonth;

    // Process each client with revenue calculations
    const revenueClients = kpiClients.map(client => {
      // Look up pricing from registry (exact workspace name match)
      const pricing = pricingLookup[client.name];

      if (!pricing) {
        console.log(`⚠️ No pricing found in client_registry for "${client.name}"`);
        return null;
      }

      console.log(`✅ Matched "${client.name}" → ${pricing.billing_type} → $${pricing.price_per_lead || pricing.retainer_amount}`);

      // Current month billable leads (from KPI dashboard - these are interested leads)
      const currentMonthLeads = client.leadsGenerated || 0;

      // Calculate revenue based on billing type
      let currentMonthRevenue = 0;
      if (pricing.billing_type === 'retainer') {
        currentMonthRevenue = pricing.retainer_amount;
      } else {
        // Per-lead billing
        currentMonthRevenue = currentMonthLeads * pricing.price_per_lead;
      }

      // Project end-of-month values
      let projectedLeads = currentMonthLeads;
      let projectedRevenue = currentMonthRevenue;

      if (pricing.billing_type === 'per_lead' && monthProgress > 0) {
        // Project based on current pace
        projectedLeads = Math.round(currentMonthLeads / monthProgress);
        projectedRevenue = projectedLeads * pricing.price_per_lead;
      }

      // TODO: Fetch costs from client_costs table (placeholder for now)
      const currentMonthCosts = 0; // Will be from database
      const projectedCosts = 0;

      // Calculate profit
      const currentMonthProfit = currentMonthRevenue - currentMonthCosts;
      const projectedProfit = projectedRevenue - projectedCosts;

      // Profit margin (avoid division by zero)
      const profitMargin = currentMonthRevenue > 0
        ? (currentMonthProfit / currentMonthRevenue) * 100
        : 0;

      // TODO: Fetch last month data from monthly_revenue_snapshots (placeholder)
      const lastMonthRevenue = 0;
      const lastMonthProfit = 0;
      const lastMonthLeads = 0;

      // MoM comparisons
      const momRevenueChange = lastMonthRevenue > 0
        ? ((currentMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
        : 0;

      const momProfitChange = lastMonthProfit > 0
        ? ((currentMonthProfit - lastMonthProfit) / lastMonthProfit) * 100
        : 0;

      return {
        workspace_name: pricing.display_name || client.name, // Use display_name if available
        billing_type: pricing.billing_type,

        // Current Month (MTD)
        current_month_leads: currentMonthLeads,
        current_month_revenue: currentMonthRevenue,
        current_month_costs: currentMonthCosts,
        current_month_profit: currentMonthProfit,

        // Projections (EOM)
        projected_leads: projectedLeads,
        projected_revenue: projectedRevenue,
        projected_profit: projectedProfit,

        // Last Month
        last_month_leads: lastMonthLeads,
        last_month_revenue: lastMonthRevenue,
        last_month_profit: lastMonthProfit,

        // Comparisons
        mom_revenue_change: momRevenueChange,
        mom_profit_change: momProfitChange,

        // Profitability
        profit_margin: profitMargin,
        price_per_lead: pricing.price_per_lead,
        retainer_amount: pricing.retainer_amount,
      };
    }).filter(client => client !== null);

    // Sort by profitability (descending)
    revenueClients.sort((a, b) => b.current_month_profit - a.current_month_profit);

    // Add rank
    revenueClients.forEach((client, index) => {
      client.rank = index + 1;
    });

    // Calculate totals
    const totals = revenueClients.reduce((acc, client) => ({
      total_mtd_revenue: acc.total_mtd_revenue + client.current_month_revenue,
      total_mtd_costs: acc.total_mtd_costs + client.current_month_costs,
      total_mtd_profit: acc.total_mtd_profit + client.current_month_profit,
      total_projected_revenue: acc.total_projected_revenue + client.projected_revenue,
      total_per_lead_revenue: acc.total_per_lead_revenue + (client.billing_type === 'per_lead' ? client.current_month_revenue : 0),
      total_retainer_revenue: acc.total_retainer_revenue + (client.billing_type === 'retainer' ? client.current_month_revenue : 0),
    }), {
      total_mtd_revenue: 0,
      total_mtd_costs: 0,
      total_mtd_profit: 0,
      total_projected_revenue: 0,
      total_per_lead_revenue: 0,
      total_retainer_revenue: 0,
    });

    console.log(`✅ Processed ${revenueClients.length} clients with revenue data`);
    console.log(`💰 Total MTD Revenue: $${totals.total_mtd_revenue.toFixed(2)}`);

    return new Response(
      JSON.stringify({
        clients: revenueClients,
        totals,
        meta: {
          current_day: currentDay,
          days_in_month: daysInMonth,
          days_remaining: daysRemaining,
          month_progress: Math.round(monthProgress * 100),
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Revenue analytics error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
