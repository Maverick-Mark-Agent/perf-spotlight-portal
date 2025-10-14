import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const EMAIL_BISON_BASE_URL = 'https://send.maverickmarketingllc.com/api'

interface ClientRegistryRecord {
  workspace_name: string
  bison_workspace_id: number
  bison_api_key: string
  billing_type: 'per-lead' | 'retainer'
  price_per_lead: number | null
  retainer_amount: number | null
  monthly_kpi_target: number | null
  is_active: boolean
}

interface ClientCosts {
  workspace_name: string
  total_costs: number
  month_year: string
}

interface BisonStats {
  interested: number
  total_replied: number
  total_unsubscribes: number
  total_email_sent: number
  total_bounced: number
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Calculate date ranges for MTD
    const now = new Date()
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    const formatDate = (date: Date) => date.toISOString().split('T')[0]
    const monthStart = formatDate(currentMonthStart)
    const todayStr = formatDate(today)

    console.log(`📊 Fetching unified revenue & billing data for ${monthStart} to ${todayStr}`)

    // 1. Fetch all active clients from client_registry
    const { data: clients, error: clientsError } = await supabase
      .from('client_registry')
      .select('workspace_name, bison_workspace_id, bison_api_key, billing_type, price_per_lead, retainer_amount, monthly_kpi_target, is_active')
      .eq('is_active', true)
      .not('bison_api_key', 'is', null)

    if (clientsError) throw clientsError

    console.log(`Found ${clients.length} active clients with API keys`)

    // 2. Fetch all client costs MTD for current month
    const currentMonthYear = now.toISOString().slice(0, 7) // YYYY-MM
    const { data: costs, error: costsError } = await supabase
      .from('client_costs')
      .select('workspace_name, total_costs')
      .eq('month_year', currentMonthYear)

    if (costsError && costsError.code !== 'PGRST116') {
      console.warn(`⚠️ Error fetching costs: ${costsError.message}`)
    }

    const costsMap = new Map<string, number>()
    costs?.forEach((c) => {
      costsMap.set(c.workspace_name, parseFloat(c.total_costs as any) || 0)
    })

    // 3. Fetch real-time stats from Email Bison for each client
    const clientData = await Promise.all(
      clients.map(async (client: ClientRegistryRecord) => {
        try {
          // Fetch MTD stats from Email Bison
          const statsResponse = await fetch(
            `${EMAIL_BISON_BASE_URL}/workspaces/v1.1/stats?start_date=${monthStart}&end_date=${todayStr}`,
            {
              headers: {
                'Authorization': `Bearer ${client.bison_api_key}`,
                'Accept': 'application/json',
              },
            }
          )

          if (!statsResponse.ok) {
            console.error(`Failed to fetch stats for ${client.workspace_name}: ${statsResponse.status}`)
            throw new Error(`Stats API returned ${statsResponse.status}`)
          }

          const statsData = await statsResponse.json()
          const stats: BisonStats = statsData.data || {
            interested: 0,
            total_replied: 0,
            total_unsubscribes: 0,
            total_email_sent: 0,
            total_bounced: 0,
          }

          // Calculate MTD leads (interested)
          const mtdLeads = stats.interested || 0

          // Calculate MTD revenue based on billing type
          let mtdRevenue = 0
          if (client.billing_type === 'per-lead' || client.billing_type === 'per_lead') {
            mtdRevenue = mtdLeads * (client.price_per_lead || 0)
          } else if (client.billing_type === 'retainer') {
            mtdRevenue = client.retainer_amount || 0
          }

          // Get MTD costs
          const mtdCosts = costsMap.get(client.workspace_name) || 0

          // Calculate MTD profit
          const mtdProfit = mtdRevenue - mtdCosts

          // Calculate profit margin
          const profitMargin = mtdRevenue > 0 ? (mtdProfit / mtdRevenue) * 100 : 0

          // Calculate KPI progress
          const monthlyKpi = client.monthly_kpi_target || 0
          const kpiProgress = monthlyKpi > 0 ? (mtdLeads / monthlyKpi) * 100 : 0
          const leadsRemaining = Math.max(0, monthlyKpi - mtdLeads)

          // Calculate reply rate
          const replyRate = stats.total_email_sent > 0
            ? (stats.total_replied / stats.total_email_sent) * 100
            : 0

          // Calculate interested rate
          const interestedRate = stats.total_replied > 0
            ? (stats.interested / stats.total_replied) * 100
            : 0

          return {
            workspace_name: client.workspace_name,
            bison_workspace_id: client.bison_workspace_id,
            billing_type: client.billing_type,

            // Revenue metrics
            current_month_revenue: mtdRevenue,
            current_month_costs: mtdCosts,
            current_month_profit: mtdProfit,
            profit_margin: profitMargin,
            price_per_lead: client.price_per_lead,
            retainer_amount: client.retainer_amount,

            // KPI metrics
            current_month_leads: mtdLeads,
            monthly_kpi: monthlyKpi,
            kpi_progress: kpiProgress,
            leads_remaining: leadsRemaining,

            // Email metrics
            emails_sent_mtd: stats.total_email_sent || 0,
            replies_mtd: stats.total_replied || 0,
            interested_mtd: stats.interested || 0,
            bounces_mtd: stats.total_bounced || 0,
            unsubscribes_mtd: stats.total_unsubscribes || 0,
            reply_rate: replyRate,
            interested_rate: interestedRate,
          }
        } catch (error) {
          console.error(`Error fetching data for ${client.workspace_name}:`, error)

          // Return zero data for failed clients
          return {
            workspace_name: client.workspace_name,
            bison_workspace_id: client.bison_workspace_id,
            billing_type: client.billing_type,
            current_month_revenue: 0,
            current_month_costs: costsMap.get(client.workspace_name) || 0,
            current_month_profit: 0 - (costsMap.get(client.workspace_name) || 0),
            profit_margin: 0,
            price_per_lead: client.price_per_lead,
            retainer_amount: client.retainer_amount,
            current_month_leads: 0,
            monthly_kpi: client.monthly_kpi_target || 0,
            kpi_progress: 0,
            leads_remaining: client.monthly_kpi_target || 0,
            emails_sent_mtd: 0,
            replies_mtd: 0,
            interested_mtd: 0,
            bounces_mtd: 0,
            unsubscribes_mtd: 0,
            reply_rate: 0,
            interested_rate: 0,
            error: error.message,
          }
        }
      })
    )

    // 4. Sort by profit and add rank
    const sortedByProfit = clientData.sort((a, b) => b.current_month_profit - a.current_month_profit)
    const rankedClients = sortedByProfit.map((client, index) => ({
      ...client,
      rank: index + 1,
    }))

    // 5. Calculate totals
    const totals = rankedClients.reduce(
      (acc, client) => {
        acc.total_mtd_revenue += client.current_month_revenue
        acc.total_mtd_costs += client.current_month_costs
        acc.total_mtd_profit += client.current_month_profit
        acc.total_mtd_leads += client.current_month_leads

        if (client.billing_type === 'per-lead' || client.billing_type === 'per_lead') {
          acc.total_per_lead_revenue += client.current_month_revenue
          acc.per_lead_count++
        } else if (client.billing_type === 'retainer') {
          acc.total_retainer_revenue += client.current_month_revenue
          acc.retainer_count++
        }

        acc.total_emails_sent += client.emails_sent_mtd || 0
        acc.total_replies += client.replies_mtd || 0
        acc.total_interested += client.interested_mtd || 0
        acc.total_bounces += client.bounces_mtd || 0
        acc.total_unsubscribes += client.unsubscribes_mtd || 0

        return acc
      },
      {
        total_mtd_revenue: 0,
        total_mtd_costs: 0,
        total_mtd_profit: 0,
        total_mtd_leads: 0,
        total_per_lead_revenue: 0,
        total_retainer_revenue: 0,
        per_lead_count: 0,
        retainer_count: 0,
        total_emails_sent: 0,
        total_replies: 0,
        total_interested: 0,
        total_bounces: 0,
        total_unsubscribes: 0,
      }
    )

    // Calculate overall metrics
    const overallProfitMargin = totals.total_mtd_revenue > 0
      ? (totals.total_mtd_profit / totals.total_mtd_revenue) * 100
      : 0

    const overallReplyRate = totals.total_emails_sent > 0
      ? (totals.total_replies / totals.total_emails_sent) * 100
      : 0

    const overallInterestedRate = totals.total_replies > 0
      ? (totals.total_interested / totals.total_replies) * 100
      : 0

    // ============= BILLABLE LEADS ONLY METRICS =============
    const perLeadClients = rankedClients.filter(c => c.billing_type === 'per-lead' || c.billing_type === 'per_lead')

    // Total possible billable revenue (per-lead clients only, 100% KPI)
    const totalPossibleBillableRevenue = perLeadClients.reduce((sum, client) =>
      sum + (client.monthly_kpi * (client.price_per_lead || 0)), 0
    )

    // Days in month calculations
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const currentDay = now.getDate()

    // Daily billable revenue target (what we SHOULD generate per day)
    const dailyBillableRevenueTarget = daysInMonth > 0
      ? totalPossibleBillableRevenue / daysInMonth
      : 0

    // Total MTD billable revenue (per-lead clients only)
    const totalMtdBillableRevenue = perLeadClients.reduce((sum, client) =>
      sum + client.current_month_revenue, 0
    )

    // Query daily billable lead data from client_leads table
    console.log('📊 Fetching daily billable revenue data from client_leads...')

    const { data: leadData, error: leadError } = await supabase
      .from('client_leads')
      .select('date_received, workspace_name, lead_value')
      .gte('date_received', `${currentMonthYear}-01`)
      .lte('date_received', `${currentMonthYear}-31`)
      .order('date_received', { ascending: true })

    if (leadError) {
      console.error('⚠️ Error fetching lead data:', leadError)
    }

    // Filter to per-lead clients only and group by date
    const dailyRevenueMap = new Map<string, { revenue: number; leads: number }>()

    if (leadData) {
      leadData.forEach(lead => {
      // Check if this lead belongs to a per-lead client
      const client = clients.find(c =>
        c.workspace_name === lead.workspace_name && (c.billing_type === 'per-lead' || c.billing_type === 'per_lead')
      )

      if (!client) return // Skip non-per-lead clients

      const date = lead.date_received.split('T')[0]
      const pricePerLead = parseFloat(client.price_per_lead as any) || 0

      if (!dailyRevenueMap.has(date)) {
        dailyRevenueMap.set(date, { revenue: 0, leads: 0 })
      }

      const dayData = dailyRevenueMap.get(date)!
      dayData.revenue += pricePerLead
      dayData.leads += 1
      })
    }

    // Build daily billable revenue array for time-series chart
    const dailyBillableRevenue: Array<{
      day: number
      date: string
      daily_revenue: number
      cumulative_revenue: number
      lead_count: number
    }> = []
    let cumulativeRevenue = 0

    for (let day = 1; day <= currentDay; day++) {
      const dateStr = `${currentMonthYear}-${day.toString().padStart(2, '0')}`
      const dayData = dailyRevenueMap.get(dateStr) || { revenue: 0, leads: 0 }

      cumulativeRevenue += dayData.revenue

      dailyBillableRevenue.push({
        day,
        date: dateStr,
        daily_revenue: dayData.revenue,
        cumulative_revenue: cumulativeRevenue,
        lead_count: dayData.leads,
      })
    }

    // ============= BILLABLE LEADS ONLY FORECAST =============
    const avgBillableKPIProgress = perLeadClients.length > 0
      ? perLeadClients.reduce((sum, c) => sum + c.kpi_progress, 0) / perLeadClients.length
      : 0

    const dailyBillableAverage = currentDay > 0 ? totalMtdBillableRevenue / currentDay : 0

    const billableForecast = {
      conservative: Math.min(
        totalMtdBillableRevenue + (dailyBillableAverage * (daysInMonth - currentDay)),
        totalPossibleBillableRevenue
      ),
      linear: dailyBillableAverage * daysInMonth,
      optimistic: totalMtdBillableRevenue + (dailyBillableRevenueTarget * (daysInMonth - currentDay)),
      confidence: (avgBillableKPIProgress >= 80 ? 'high' : avgBillableKPIProgress >= 60 ? 'medium' : 'low') as 'high' | 'medium' | 'low',
      avg_kpi_progress: avgBillableKPIProgress,
      daily_average: dailyBillableAverage,
      days_elapsed: currentDay,
      days_remaining: daysInMonth - currentDay,
    }

    console.log(`✅ Successfully fetched data for ${rankedClients.length} clients`)
    console.log(`📈 Total MTD Revenue: $${totals.total_mtd_revenue}`)
    console.log(`💰 Total MTD Profit: $${totals.total_mtd_profit}`)
    console.log(`📊 Total MTD Leads: ${totals.total_mtd_leads}`)
    console.log(`💵 Total MTD Billable Revenue: $${totalMtdBillableRevenue}`)
    console.log(`🎯 Daily Billable Revenue Target: $${dailyBillableRevenueTarget}`)
    console.log(`📊 Daily billable revenue data: ${dailyBillableRevenue.length} days`)

    return new Response(
      JSON.stringify({
        clients: rankedClients,
        totals: {
          ...totals,
          overall_profit_margin: overallProfitMargin,
          overall_reply_rate: overallReplyRate,
          overall_interested_rate: overallInterestedRate,
          // Billable-only metrics
          total_possible_billable_revenue: totalPossibleBillableRevenue,
          daily_billable_revenue_target: dailyBillableRevenueTarget,
          total_mtd_billable_revenue: totalMtdBillableRevenue,
          daily_billable_revenue: dailyBillableRevenue,
          billable_forecast: billableForecast,
        },
        date_range: {
          start: monthStart,
          end: todayStr,
        },
        last_updated: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('❌ Error in revenue-billing-unified function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
