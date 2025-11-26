import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExpenseSummary {
  month_year: string;
  total_expenses: number;
  approved_expenses: number;
  pending_expenses: number;
  expense_count: number;
  pending_count: number;
  missing_receipts_count: number;
  by_category: {
    category_name: string;
    category_color: string;
    amount: number;
    count: number;
  }[];
  overhead_total: number;
  client_allocated_total: number;
}

interface ClientExpenseData {
  workspace_name: string;
  direct_costs: number;
  allocated_overhead: number;
  total_costs: number;
  expense_count: number;
}

interface ProfitLossData {
  month_year: string;
  total_revenue: number;
  total_expenses: number;
  gross_profit: number;
  profit_margin: number;
  revenue_breakdown: {
    per_lead_revenue: number;
    retainer_revenue: number;
  };
  expense_breakdown: {
    category_name: string;
    amount: number;
  }[];
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const pathname = url.pathname.replace('/expense-analytics', '');
    const monthYear = url.searchParams.get('month_year') || getCurrentMonthYear();

    // Route handling
    if (pathname === '' || pathname === '/') {
      // GET / - Monthly expense summary
      const summary = await getExpenseSummary(supabase, monthYear);
      return new Response(JSON.stringify(summary), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (pathname.startsWith('/client/')) {
      // GET /client/:workspace - Client expense breakdown
      const workspaceName = decodeURIComponent(pathname.replace('/client/', ''));
      const clientData = await getClientExpenses(supabase, workspaceName, monthYear);
      return new Response(JSON.stringify(clientData), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (pathname === '/pnl') {
      // GET /pnl - P&L calculation
      const pnl = await getProfitLoss(supabase, monthYear);
      return new Response(JSON.stringify(pnl), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (pathname === '/budget-status') {
      // GET /budget-status - Budget vs actual
      const budgetStatus = await getBudgetStatus(supabase, monthYear);
      return new Response(JSON.stringify(budgetStatus), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (pathname === '/all-clients') {
      // GET /all-clients - All clients with expense data
      const allClients = await getAllClientExpenses(supabase, monthYear);
      return new Response(JSON.stringify(allClients), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in expense-analytics:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function getCurrentMonthYear(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

async function getExpenseSummary(supabase: any, monthYear: string): Promise<ExpenseSummary> {
  // Fetch all expenses for the month with their allocations and categories
  const { data: expenses, error: expensesError } = await supabase
    .from('expenses')
    .select(`
      *,
      expense_categories(*),
      expense_allocations(*)
    `)
    .eq('month_year', monthYear);

  if (expensesError) throw expensesError;

  const expensesList = expenses || [];

  // Calculate totals
  const totalExpenses = expensesList.reduce((sum: number, e: any) => sum + Number(e.amount), 0);
  const approvedExpenses = expensesList
    .filter((e: any) => e.status === 'approved')
    .reduce((sum: number, e: any) => sum + Number(e.amount), 0);
  const pendingExpenses = expensesList
    .filter((e: any) => e.status === 'pending')
    .reduce((sum: number, e: any) => sum + Number(e.amount), 0);
  const pendingCount = expensesList.filter((e: any) => e.status === 'pending').length;
  const missingReceiptsCount = expensesList.filter((e: any) => !e.has_receipt).length;

  // Group by category
  const categoryMap = new Map<string, { name: string; color: string; amount: number; count: number }>();
  expensesList.forEach((e: any) => {
    const catName = e.expense_categories?.name || 'Uncategorized';
    const catColor = e.expense_categories?.color || '#64748b';
    const existing = categoryMap.get(catName) || { name: catName, color: catColor, amount: 0, count: 0 };
    existing.amount += Number(e.amount);
    existing.count += 1;
    categoryMap.set(catName, existing);
  });

  // Calculate overhead vs client allocated (from approved expenses only)
  let overheadTotal = 0;
  let clientAllocatedTotal = 0;

  expensesList
    .filter((e: any) => e.status === 'approved')
    .forEach((e: any) => {
      const allocations = e.expense_allocations || [];
      allocations.forEach((a: any) => {
        if (a.is_overhead) {
          overheadTotal += Number(a.allocated_amount);
        } else {
          clientAllocatedTotal += Number(a.allocated_amount);
        }
      });
    });

  return {
    month_year: monthYear,
    total_expenses: totalExpenses,
    approved_expenses: approvedExpenses,
    pending_expenses: pendingExpenses,
    expense_count: expensesList.length,
    pending_count: pendingCount,
    missing_receipts_count: missingReceiptsCount,
    by_category: Array.from(categoryMap.values()).sort((a, b) => b.amount - a.amount),
    overhead_total: overheadTotal,
    client_allocated_total: clientAllocatedTotal,
  };
}

async function getClientExpenses(
  supabase: any,
  workspaceName: string,
  monthYear: string
): Promise<ClientExpenseData> {
  // Get direct costs for this client
  const { data: directExpenses } = await supabase
    .from('expense_allocations')
    .select(`
      allocated_amount,
      expenses!inner(id, status, month_year)
    `)
    .eq('workspace_name', workspaceName)
    .eq('is_overhead', false)
    .eq('expenses.status', 'approved')
    .eq('expenses.month_year', monthYear);

  const directCosts = (directExpenses || []).reduce(
    (sum: number, a: any) => sum + Number(a.allocated_amount),
    0
  );
  const expenseCount = (directExpenses || []).length;

  // Get total overhead for the month
  const { data: overheadExpenses } = await supabase
    .from('expense_allocations')
    .select(`
      allocated_amount,
      expenses!inner(id, status, month_year)
    `)
    .eq('is_overhead', true)
    .eq('expenses.status', 'approved')
    .eq('expenses.month_year', monthYear);

  const totalOverhead = (overheadExpenses || []).reduce(
    (sum: number, a: any) => sum + Number(a.allocated_amount),
    0
  );

  // Get active client count for equal split
  const { data: activeClients } = await supabase
    .from('client_registry')
    .select('workspace_name')
    .eq('is_active', true);

  const clientCount = (activeClients || []).length;
  const allocatedOverhead = clientCount > 0 ? totalOverhead / clientCount : 0;

  return {
    workspace_name: workspaceName,
    direct_costs: directCosts,
    allocated_overhead: allocatedOverhead,
    total_costs: directCosts + allocatedOverhead,
    expense_count: expenseCount,
  };
}

async function getAllClientExpenses(
  supabase: any,
  monthYear: string
): Promise<ClientExpenseData[]> {
  // Get all active clients
  const { data: clients } = await supabase
    .from('client_registry')
    .select('workspace_name')
    .eq('is_active', true)
    .order('workspace_name');

  if (!clients || clients.length === 0) return [];

  // Get total overhead for the month
  const { data: overheadExpenses } = await supabase
    .from('expense_allocations')
    .select(`
      allocated_amount,
      expenses!inner(id, status, month_year)
    `)
    .eq('is_overhead', true)
    .eq('expenses.status', 'approved')
    .eq('expenses.month_year', monthYear);

  const totalOverhead = (overheadExpenses || []).reduce(
    (sum: number, a: any) => sum + Number(a.allocated_amount),
    0
  );
  const allocatedOverheadPerClient = clients.length > 0 ? totalOverhead / clients.length : 0;

  // Get direct costs per client
  const { data: directExpenses } = await supabase
    .from('expense_allocations')
    .select(`
      workspace_name,
      allocated_amount,
      expenses!inner(id, status, month_year)
    `)
    .eq('is_overhead', false)
    .eq('expenses.status', 'approved')
    .eq('expenses.month_year', monthYear);

  // Group direct costs by client
  const directCostsByClient = new Map<string, { amount: number; count: number }>();
  (directExpenses || []).forEach((a: any) => {
    const existing = directCostsByClient.get(a.workspace_name) || { amount: 0, count: 0 };
    existing.amount += Number(a.allocated_amount);
    existing.count += 1;
    directCostsByClient.set(a.workspace_name, existing);
  });

  return clients.map((client: any) => {
    const directData = directCostsByClient.get(client.workspace_name) || { amount: 0, count: 0 };
    return {
      workspace_name: client.workspace_name,
      direct_costs: directData.amount,
      allocated_overhead: allocatedOverheadPerClient,
      total_costs: directData.amount + allocatedOverheadPerClient,
      expense_count: directData.count,
    };
  });
}

async function getProfitLoss(supabase: any, monthYear: string): Promise<ProfitLossData> {
  // Get revenue data from client_registry and client_metrics
  const { data: clients } = await supabase
    .from('client_registry')
    .select('workspace_name, billing_type, price_per_lead, retainer_amount, monthly_kpi_target')
    .eq('is_active', true);

  const { data: metrics } = await supabase
    .from('client_metrics')
    .select('workspace_name, positive_replies_mtd')
    .eq('metric_date', `${monthYear}-01`);

  // Calculate revenue
  let perLeadRevenue = 0;
  let retainerRevenue = 0;

  (clients || []).forEach((client: any) => {
    if (client.billing_type === 'retainer') {
      retainerRevenue += Number(client.retainer_amount || 0);
    } else {
      const metric = (metrics || []).find((m: any) => m.workspace_name === client.workspace_name);
      const leads = metric?.positive_replies_mtd || 0;
      perLeadRevenue += leads * Number(client.price_per_lead || 0);
    }
  });

  const totalRevenue = perLeadRevenue + retainerRevenue;

  // Get expense summary
  const expenseSummary = await getExpenseSummary(supabase, monthYear);
  const totalExpenses = expenseSummary.approved_expenses;

  const grossProfit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

  return {
    month_year: monthYear,
    total_revenue: totalRevenue,
    total_expenses: totalExpenses,
    gross_profit: grossProfit,
    profit_margin: profitMargin,
    revenue_breakdown: {
      per_lead_revenue: perLeadRevenue,
      retainer_revenue: retainerRevenue,
    },
    expense_breakdown: expenseSummary.by_category.map((c) => ({
      category_name: c.category_name,
      amount: c.amount,
    })),
  };
}

async function getBudgetStatus(supabase: any, monthYear: string): Promise<any[]> {
  // Get budget targets
  const { data: budgets } = await supabase
    .from('budget_targets')
    .select(`
      *,
      expense_categories(name, color)
    `)
    .eq('month_year', monthYear);

  // Get actual expenses by category
  const { data: expenses } = await supabase
    .from('expenses')
    .select(`
      amount,
      category_id,
      status
    `)
    .eq('month_year', monthYear)
    .eq('status', 'approved');

  // Calculate actual by category
  const actualByCategory = new Map<string, number>();
  (expenses || []).forEach((e: any) => {
    const current = actualByCategory.get(e.category_id) || 0;
    actualByCategory.set(e.category_id, current + Number(e.amount));
  });

  return (budgets || []).map((budget: any) => {
    const actual = actualByCategory.get(budget.category_id) || 0;
    const remaining = budget.budget_amount - actual;
    const percentageUsed = budget.budget_amount > 0 ? (actual / budget.budget_amount) * 100 : 0;

    let status: 'under' | 'warning' | 'over' = 'under';
    if (percentageUsed >= 100) {
      status = 'over';
    } else if (percentageUsed >= budget.warning_threshold) {
      status = 'warning';
    }

    return {
      month_year: monthYear,
      category_id: budget.category_id,
      category_name: budget.expense_categories?.name || 'Unknown',
      category_color: budget.expense_categories?.color || '#64748b',
      budget_amount: budget.budget_amount,
      actual_amount: actual,
      remaining,
      percentage_used: percentageUsed,
      status,
    };
  });
}
