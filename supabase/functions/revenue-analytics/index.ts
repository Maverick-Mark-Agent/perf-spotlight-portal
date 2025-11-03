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

// ============= Cost Calculation Functions =============

/**
 * Estimate labor costs based on account count and MTD leads
 * NOTE: Labor costs should only come from manual client_costs table entries
 */
function estimateLaborCosts(accountCount: number, mtdLeads: number): number {
  return 0; // No estimated labor - only use manual costs from client_costs table
}

/**
 * Calculate email account costs from sender_emails_cache
 */
function calculateEmailAccountCosts(emailAccounts: any[], workspaceName: string): number {
  return emailAccounts
    .filter(acc => acc.workspace_name === workspaceName && acc.status === 'Connected')
    .reduce((sum, acc) => sum + (parseFloat(acc.price) || 0), 0);
}

/**
 * Calculate other fixed costs per client
 * NOTE: Overhead costs should only come from manual client_costs table entries
 */
function calculateOtherCosts(): number {
  return 0; // No automatic overhead - only manual costs
}

/**
 * Get client costs (manual override OR calculated from infrastructure)
 */
async function getClientCosts(
  supabase: any,
  workspaceName: string,
  monthYear: string,
  mtdLeads: number
): Promise<any> {
  // First, check for manual override in client_costs table
  const { data: manualCosts } = await supabase
    .from('client_costs')
    .select('*')
    .eq('workspace_name', workspaceName)
    .eq('month_year', monthYear)
    .single();

  if (manualCosts && manualCosts.total_costs > 0) {
    return {
      ...manualCosts,
      cost_source: 'manual',
    };
  }

  // Otherwise, calculate from infrastructure (sender_emails_cache)
  const { data: emailAccounts } = await supabase
    .from('sender_emails_cache')
    .select('workspace_name, status, price')
    .eq('workspace_name', workspaceName);

  if (!emailAccounts || emailAccounts.length === 0) {
    // No infrastructure data, return zero costs
    return {
      workspace_name: workspaceName,
      month_year: monthYear,
      email_account_costs: 0,
      labor_costs: 0,
      other_costs: 0,
      total_costs: 0,
      cost_source: 'calculated',
      notes: 'No infrastructure data available',
    };
  }

  const emailCosts = calculateEmailAccountCosts(emailAccounts, workspaceName);
  const accountCount = emailAccounts.length;
  const laborCosts = 0; // No estimated labor - only from manual client_costs
  const otherCosts = 0;  // No automatic overhead - only from manual client_costs
  const totalCosts = emailCosts; // Only infrastructure costs when calculated

  return {
    workspace_name: workspaceName,
    month_year: monthYear,
    email_account_costs: emailCosts,
    labor_costs: laborCosts,
    other_costs: otherCosts,
    total_costs: totalCosts,
    cost_source: 'calculated',
    account_count: accountCount,
  };
}

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

    console.log('Fetching MTD revenue analytics...');

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
        monthly_kpi_target: parseInt(client.monthly_kpi_target) || 0,
        workspace_id: client.workspace_id,
        display_name: client.display_name,
      };
    });

    // Step 2: Get MTD KPI data from client_metrics (real-time database query)
    console.log('📥 Fetching MTD KPI data from client_metrics...');
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    const { data: metricsData, error: metricsError } = await supabase
      .from('client_metrics')
      .select('workspace_name, positive_replies_mtd')
      .eq('metric_date', today)
      .eq('metric_type', 'mtd');

    if (metricsError) {
      throw new Error(`Error fetching client_metrics: ${metricsError.message}`);
    }

    console.log(`  Found ${metricsData?.length || 0} client metric records for today`);

    // Step 3: Get current month costs (will calculate from infrastructure OR use manual)
    const currentMonthYear = new Date().toISOString().slice(0, 7); // YYYY-MM
    console.log(`📥 Calculating costs for ${currentMonthYear} (infrastructure + manual overrides)...`);

    // Process each client with MTD revenue calculations
    const revenueClients = await Promise.all(
      (metricsData || []).map(async (metric) => {
        const workspaceName = metric.workspace_name;

        // Look up pricing from registry
        const pricing = pricingLookup[workspaceName];

        if (!pricing) {
          console.log(`⚠️ No pricing found in client_registry for "${workspaceName}"`);
          return null;
        }

        console.log(`✅ Processing "${workspaceName}" → ${pricing.billing_type} → $${pricing.price_per_lead || pricing.retainer_amount}`);

        // MTD billable leads (positive/interested replies)
        const currentMonthLeads = metric.positive_replies_mtd || 0;

        // Calculate MTD revenue based on billing type
        let currentMonthRevenue = 0;
        if (pricing.billing_type === 'retainer') {
          // Retainer: fixed monthly amount
          currentMonthRevenue = pricing.retainer_amount;
        } else {
          // Per-lead: price per lead * MTD interested leads
          currentMonthRevenue = currentMonthLeads * pricing.price_per_lead;
        }

        // Get MTD costs (calculate from infrastructure OR use manual override)
        const costData = await getClientCosts(supabase, workspaceName, currentMonthYear, currentMonthLeads);
        const currentMonthCosts = costData.total_costs || 0;

        // Calculate MTD profit
        const currentMonthProfit = currentMonthRevenue - currentMonthCosts;

        // Profit margin (avoid division by zero)
        const profitMargin = currentMonthRevenue > 0
          ? (currentMonthProfit / currentMonthRevenue) * 100
          : 0;

        // KPI metrics (get from client_registry)
        const monthlyKPI = pricing.monthly_kpi_target || 0;
        const kpiProgress = monthlyKPI > 0 ? (currentMonthLeads / monthlyKPI) * 100 : 0;
        const leadsRemaining = Math.max(0, monthlyKPI - currentMonthLeads);

        return {
          workspace_name: pricing.display_name || workspaceName,
          billing_type: pricing.billing_type,

          // MTD Metrics
          current_month_leads: currentMonthLeads,
          current_month_revenue: currentMonthRevenue,
          current_month_costs: currentMonthCosts,
          current_month_profit: currentMonthProfit,

          // Profitability
          profit_margin: profitMargin,
          price_per_lead: pricing.price_per_lead,
          retainer_amount: pricing.retainer_amount,

          // KPI Metrics
          monthly_kpi: monthlyKPI,
          kpi_progress: kpiProgress,
          leads_remaining: leadsRemaining,

          // Cost details
          cost_source: costData.cost_source,
          email_account_costs: costData.email_account_costs || 0,
          labor_costs: costData.labor_costs || 0,
          other_costs: costData.other_costs || 0,
        };
      })
    );

    // Filter out null entries
    const validClients = revenueClients.filter(client => client !== null);

    // Sort by revenue (descending) - highest revenue first
    validClients.sort((a, b) => b.current_month_revenue - a.current_month_revenue);

    // Add rank
    validClients.forEach((client, index) => {
      client.rank = index + 1;
    });

    // Calculate totals
    const totals = validClients.reduce((acc, client) => ({
      total_mtd_revenue: acc.total_mtd_revenue + client.current_month_revenue,
      total_mtd_costs: acc.total_mtd_costs + client.current_month_costs,
      total_mtd_profit: acc.total_mtd_profit + client.current_month_profit,
      total_mtd_leads: acc.total_mtd_leads + client.current_month_leads,
      total_per_lead_revenue: acc.total_per_lead_revenue + (client.billing_type === 'per_lead' ? client.current_month_revenue : 0),
      total_retainer_revenue: acc.total_retainer_revenue + (client.billing_type === 'retainer' ? client.current_month_revenue : 0),
      per_lead_count: acc.per_lead_count + (client.billing_type === 'per_lead' ? 1 : 0),
      retainer_count: acc.retainer_count + (client.billing_type === 'retainer' ? 1 : 0),
      total_kpi_target: acc.total_kpi_target + (client.monthly_kpi || 0),
    }), {
      total_mtd_revenue: 0,
      total_mtd_costs: 0,
      total_mtd_profit: 0,
      total_mtd_leads: 0,
      total_per_lead_revenue: 0,
      total_retainer_revenue: 0,
      per_lead_count: 0,
      retainer_count: 0,
      total_kpi_target: 0,
    });

    // Calculate overall profit margin
    totals.overall_profit_margin = totals.total_mtd_revenue > 0
      ? (totals.total_mtd_profit / totals.total_mtd_revenue) * 100
      : 0;

    // ============= NEW: Daily Average & Total Possible Revenue =============
    const todayDate = new Date();
    const currentDay = todayDate.getDate();
    const daysInMonth = new Date(todayDate.getFullYear(), todayDate.getMonth() + 1, 0).getDate();

    // Daily average revenue (total MTD / days elapsed)
    totals.daily_average_revenue = currentDay > 0 ? totals.total_mtd_revenue / currentDay : 0;

    // Projected end-of-month revenue (linear projection)
    totals.projected_eom_revenue = totals.daily_average_revenue * daysInMonth;

    // Total possible revenue (100% KPI achievement for all per-lead + all retainers)
    totals.total_possible_revenue = validClients.reduce((sum, client) => {
      if (client.billing_type === 'per_lead') {
        return sum + (client.monthly_kpi * client.price_per_lead);
      } else {
        return sum + client.retainer_amount;
      }
    }, 0);

    // Revenue gap to reach 100% KPI
    totals.revenue_gap = totals.total_possible_revenue - totals.total_mtd_revenue;

    // ============= BILLABLE LEADS ONLY METRICS =============
    const perLeadClients = validClients.filter(c => c.billing_type === 'per_lead');

    // Total possible billable revenue (per-lead clients only, 100% KPI)
    totals.total_possible_billable_revenue = perLeadClients.reduce((sum, client) =>
      sum + (client.monthly_kpi * client.price_per_lead), 0
    );

    // Daily billable revenue target (what we SHOULD generate per day)
    totals.daily_billable_revenue_target = daysInMonth > 0
      ? totals.total_possible_billable_revenue / daysInMonth
      : 0;

    // Total MTD billable revenue (per-lead clients only)
    totals.total_mtd_billable_revenue = perLeadClients.reduce((sum, client) =>
      sum + client.current_month_revenue, 0
    );

    // Query daily billable lead data from client_leads table
    console.log('📊 Fetching daily billable revenue data from client_leads...');
    const { data: leadData, error: leadError } = await supabase
      .from('client_leads')
      .select(`
        date_received,
        workspace_name,
        lead_value
      `)
      .gte('date_received', `${currentMonthYear}-01`)
      .lte('date_received', `${currentMonthYear}-31`)
      .order('date_received', { ascending: true });

    if (leadError) {
      console.error('⚠️ Error fetching lead data:', leadError);
    }

    // Filter to per-lead clients only and group by date
    const perLeadWorkspaces = new Set(perLeadClients.map(c => c.workspace_name));
    const dailyRevenueMap = new Map<string, { revenue: number; leads: number }>();

    (leadData || []).forEach(lead => {
      // Check if this lead belongs to a per-lead client
      const registryClient = registryClients.find(rc =>
        rc.display_name === lead.workspace_name || rc.workspace_name === lead.workspace_name
      );

      if (!registryClient || registryClient.billing_type !== 'per_lead') {
        return; // Skip non-per-lead clients
      }

      const date = lead.date_received.split('T')[0]; // Extract YYYY-MM-DD
      const pricePerLead = parseFloat(registryClient.price_per_lead) || 0;

      if (!dailyRevenueMap.has(date)) {
        dailyRevenueMap.set(date, { revenue: 0, leads: 0 });
      }

      const dayData = dailyRevenueMap.get(date)!;
      dayData.revenue += pricePerLead; // Use actual price_per_lead, not lead_value
      dayData.leads += 1;
    });

    // Build daily billable revenue array for time-series chart
    const dailyBillableRevenue = [];
    let cumulativeRevenue = 0;

    for (let day = 1; day <= currentDay; day++) {
      const dateStr = `${currentMonthYear}-${day.toString().padStart(2, '0')}`;
      const dayData = dailyRevenueMap.get(dateStr) || { revenue: 0, leads: 0 };

      cumulativeRevenue += dayData.revenue;

      dailyBillableRevenue.push({
        day,
        date: dateStr,
        daily_revenue: dayData.revenue,
        cumulative_revenue: cumulativeRevenue,
        lead_count: dayData.leads,
      });
    }

    totals.daily_billable_revenue = dailyBillableRevenue;

    console.log(`💰 Total Possible Billable Revenue: $${totals.total_possible_billable_revenue.toFixed(2)}`);
    console.log(`🎯 Daily Billable Revenue Target: $${totals.daily_billable_revenue_target.toFixed(2)}`);
    console.log(`💵 Total MTD Billable Revenue: $${totals.total_mtd_billable_revenue.toFixed(2)}`);
    console.log(`📊 Daily billable revenue data: ${dailyBillableRevenue.length} days`);

    // ============= NEW: Revenue Forecasting =============
    // Calculate average KPI progress for velocity adjustment
    const avgKPIProgress = validClients.length > 0
      ? validClients.reduce((sum, c) => sum + c.kpi_progress, 0) / validClients.length
      : 0;

    // Forecast scenarios (ALL REVENUE - including retainers)
    const forecast = {
      // Linear: Simple projection based on current daily average
      linear: totals.daily_average_revenue * daysInMonth,

      // Velocity-adjusted: Adjusted by KPI progress rate
      velocity_adjusted: (totals.daily_average_revenue * daysInMonth) * (avgKPIProgress / 100),

      // Conservative: Use the lower of linear projection and total possible
      conservative: Math.min(totals.daily_average_revenue * daysInMonth, totals.total_possible_revenue),

      // Optimistic: Assumes current pace continues + slight improvement
      optimistic: (totals.daily_average_revenue * daysInMonth) * 1.1,

      // Confidence level
      confidence: avgKPIProgress >= 80 ? 'high' : avgKPIProgress >= 60 ? 'medium' : 'low',

      // Metadata
      avg_kpi_progress: avgKPIProgress,
      days_elapsed: currentDay,
      days_remaining: daysInMonth - currentDay,
    };

    totals.forecast = forecast;

    // ============= BILLABLE LEADS ONLY FORECAST =============
    const avgBillableKPIProgress = perLeadClients.length > 0
      ? perLeadClients.reduce((sum, c) => sum + c.kpi_progress, 0) / perLeadClients.length
      : 0;

    const dailyBillableAverage = currentDay > 0 ? totals.total_mtd_billable_revenue / currentDay : 0;

    const billableForecast = {
      // Conservative: Current daily average * remaining days, capped at total possible
      conservative: Math.min(
        totals.total_mtd_billable_revenue + (dailyBillableAverage * (daysInMonth - currentDay)),
        totals.total_possible_billable_revenue
      ),

      // Linear: Simple projection based on current daily average
      linear: dailyBillableAverage * daysInMonth,

      // Optimistic: Assumes we'll hit daily target pace for remaining days
      optimistic: totals.total_mtd_billable_revenue + (totals.daily_billable_revenue_target * (daysInMonth - currentDay)),

      // Confidence level based on billable KPI progress
      confidence: avgBillableKPIProgress >= 80 ? 'high' : avgBillableKPIProgress >= 60 ? 'medium' : 'low',

      // Metadata
      avg_kpi_progress: avgBillableKPIProgress,
      daily_average: dailyBillableAverage,
      days_elapsed: currentDay,
      days_remaining: daysInMonth - currentDay,
    };

    totals.billable_forecast = billableForecast;

    console.log(`📈 Billable Revenue Forecast - Conservative: $${billableForecast.conservative.toFixed(2)} | Linear: $${billableForecast.linear.toFixed(2)} | Optimistic: $${billableForecast.optimistic.toFixed(2)}`);

    console.log(`✅ Processed ${validClients.length} clients with MTD revenue data`);
    console.log(`💰 Total MTD Revenue: $${totals.total_mtd_revenue.toFixed(2)}`);
    console.log(`💵 Per-Lead Revenue: $${totals.total_per_lead_revenue.toFixed(2)} (${totals.per_lead_count} clients)`);
    console.log(`💵 Retainer Revenue: $${totals.total_retainer_revenue.toFixed(2)} (${totals.retainer_count} clients)`);
    console.log(`📈 Total MTD Profit: $${totals.total_mtd_profit.toFixed(2)} (${totals.overall_profit_margin.toFixed(1)}% margin)`);
    console.log(`📊 Daily Avg Revenue: $${totals.daily_average_revenue.toFixed(2)}`);
    console.log(`🎯 Total Possible Revenue: $${totals.total_possible_revenue.toFixed(2)}`);
    console.log(`📈 Revenue Forecast (Linear): $${forecast.linear.toFixed(2)}`);

    return new Response(
      JSON.stringify({
        clients: validClients,
        totals,
        meta: {
          month_year: currentMonthYear,
          snapshot_date: today,
          days_in_month: daysInMonth,
          current_day: currentDay,
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
