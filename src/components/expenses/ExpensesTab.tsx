import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import {
  Plus,
  Receipt,
  AlertCircle,
  DollarSign,
  RefreshCw,
  Store,
  Tags,
  TrendingUp,
} from "lucide-react";
import { useExpenses } from "@/hooks/useExpenses";
import { supabase } from "@/integrations/supabase/client";
import ExpenseForm from "./ExpenseForm";
import ExpenseList from "./ExpenseList";
import VendorForm from "./VendorForm";
import CategoryManager from "./CategoryManager";
import { ExpenseAssistantPanel } from "./assistant";
import type { Expense, ExpenseFormData, VendorFormData, Vendor } from "@/types/expenses";

interface Client {
  workspace_name: string;
  display_name?: string;
}

interface ExpensesTabProps {
  monthYear?: string;
}

export default function ExpensesTab({ monthYear }: ExpensesTabProps) {
  const {
    expenses,
    categories,
    vendors,
    totals,
    loading,
    error,
    createExpense,
    updateExpense,
    deleteExpense,
    createVendor,
    uploadReceipt,
    refresh,
  } = useExpenses(monthYear);

  // Modal states
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showVendorForm, setShowVendorForm] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [uploadingReceiptFor, setUploadingReceiptFor] = useState<Expense | null>(null);

  // Clients for allocation
  const [clients, setClients] = useState<Client[]>([]);

  // Fetch clients
  useEffect(() => {
    const fetchClients = async () => {
      const { data } = await supabase
        .from("client_registry")
        .select("workspace_name, display_name")
        .eq("is_active", true)
        .order("workspace_name");
      if (data) {
        setClients(data);
      }
    };
    fetchClients();
  }, []);

  // Calculate pending expenses count
  const pendingCount = expenses.filter((e) => e.status === "pending").length;
  const missingReceiptsCount = expenses.filter((e) => !e.has_receipt).length;

  // Bar chart data - sorted by amount descending, all categories
  const barChartData = totals.mtd_by_category
    .map((cat) => ({
      name: cat.category_name,
      value: cat.amount,
      color: cat.category_color,
    }))
    .sort((a, b) => b.value - a.value);

  // Top vendors by spend (expenses only, not income)
  const topVendors = expenses
    .filter(e => e.category?.slug !== 'income') // Exclude income
    .reduce((acc, e) => {
      // Use actual vendor name, or "Uncategorized" as fallback
      const vendorName = e.vendor?.display_name || e.vendor?.name || 'Uncategorized';
      if (!acc[vendorName]) {
        acc[vendorName] = { name: vendorName, amount: 0, count: 0 };
      }
      acc[vendorName].amount += Number(e.amount);
      acc[vendorName].count += 1;
      return acc;
    }, {} as Record<string, { name: string; amount: number; count: number }>);

  // Show all vendors (scrollable)
  const topVendorsList = Object.values(topVendors)
    .sort((a, b) => b.amount - a.amount);

  const handleExpenseSubmit = async (data: ExpenseFormData): Promise<Expense | null> => {
    if (editingExpense) {
      const success = await updateExpense(editingExpense.id, data);
      return success ? editingExpense : null;
    }
    return createExpense(data);
  };

  const handleVendorSubmit = async (data: VendorFormData): Promise<Vendor | null> => {
    return createVendor(data);
  };

  const handleEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setShowExpenseForm(true);
  };

  const handleCloseExpenseForm = () => {
    setShowExpenseForm(false);
    setEditingExpense(null);
  };

  const handleUploadReceipt = (expense: Expense) => {
    setUploadingReceiptFor(expense);
    // Open a file input programmatically
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg,image/png,image/gif,application/pdf";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        await uploadReceipt(expense.id, file);
        setUploadingReceiptFor(null);
      }
    };
    input.click();
  };

  const handleViewReceipt = async (expense: Expense) => {
    if (expense.receipts && expense.receipts.length > 0) {
      const receipt = expense.receipts[0];
      const { data } = await supabase.storage
        .from(receipt.storage_bucket)
        .createSignedUrl(receipt.storage_path, 60 * 5); // 5 minute URL

      if (data?.signedUrl) {
        window.open(data.signedUrl, "_blank");
      }
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
        {/* Pending Expenses Alert */}
        {pendingCount > 0 && (
          <Alert className="bg-amber-50 border-amber-200">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-800">
              {pendingCount} Expense{pendingCount > 1 ? "s" : ""} Pending Approval
            </AlertTitle>
            <AlertDescription className="text-amber-700">
              {missingReceiptsCount > 0
                ? `${missingReceiptsCount} expense${missingReceiptsCount > 1 ? "s" : ""} missing receipt${missingReceiptsCount > 1 ? "s" : ""}. Upload receipts to auto-approve.`
                : "Review and approve pending expenses."}
            </AlertDescription>
          </Alert>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">MTD Income</p>
                  <p className="text-2xl font-bold text-emerald-600">
                    ${totals.mtd_income.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Revenue received
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">MTD Expenses</p>
                  <p className="text-2xl font-bold text-rose-600">
                    ${totals.mtd_expenses_only.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {expenses.filter(e => e.category?.slug !== 'income').length} transactions
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-rose-100 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-rose-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Net Profit</p>
                  <p className={`text-2xl font-bold ${totals.mtd_net >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                    {totals.mtd_net >= 0 ? "" : "-"}${Math.abs(totals.mtd_net).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {totals.mtd_net >= 0 ? "Positive cash flow" : "Negative cash flow"}
                  </p>
                </div>
                <div className={`h-10 w-10 rounded-full flex items-center justify-center ${totals.mtd_net >= 0 ? "bg-emerald-100" : "bg-rose-100"}`}>
                  <TrendingUp className={`h-5 w-5 ${totals.mtd_net >= 0 ? "text-emerald-600" : "text-rose-600"}`} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={missingReceiptsCount > 0 ? "border-amber-200 bg-amber-50/50" : ""}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Missing Receipts</p>
                  <p className={`text-2xl font-bold ${missingReceiptsCount > 0 ? "text-amber-600" : "text-green-600"}`}>
                    {missingReceiptsCount}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {missingReceiptsCount > 0 ? "Upload to auto-approve" : "All receipts uploaded"}
                  </p>
                </div>
                <Receipt className={`h-6 w-6 ${missingReceiptsCount > 0 ? "text-amber-600" : "text-green-600"}`} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions Row */}
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => setShowExpenseForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Expense
          </Button>
          <Button variant="outline" onClick={() => setShowVendorForm(true)}>
            <Store className="h-4 w-4 mr-2" />
            Manage Vendors
          </Button>
          <Button variant="outline" onClick={() => setShowCategoryManager(true)}>
            <Tags className="h-4 w-4 mr-2" />
            Manage Categories
          </Button>
          <Button variant="outline" onClick={refresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Category Bar Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Top Categories
              </CardTitle>
            </CardHeader>
            <CardContent>
              {barChartData.length === 0 ? (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                  No expense data
                </div>
              ) : (
                <div className="max-h-[300px] overflow-y-auto pr-2">
                  <ResponsiveContainer width="100%" height={Math.max(200, barChartData.length * 32)}>
                    <BarChart
                      data={barChartData}
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
                    >
                      <XAxis
                        type="number"
                        tickFormatter={(value) => `$${value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value}`}
                        fontSize={11}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={90}
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip
                        formatter={(value: number) => [
                          `$${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
                          "Amount"
                        ]}
                        contentStyle={{ fontSize: "12px" }}
                      />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {barChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Vendors */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Store className="h-4 w-4" />
                Top Vendors
              </CardTitle>
            </CardHeader>
            <CardContent>
              {topVendorsList.length === 0 ? (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                  No vendor data
                </div>
              ) : (
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                  {topVendorsList.map((vendor, i) => (
                    <div key={vendor.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-4">{i + 1}.</span>
                        <span className="text-sm font-medium truncate max-w-[150px]">{vendor.name}</span>
                        <Badge variant="secondary" className="text-xs">
                          {vendor.count} txn{vendor.count !== 1 ? 's' : ''}
                        </Badge>
                      </div>
                      <span className="text-sm font-semibold">
                        ${vendor.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Expense List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <ExpenseList
              expenses={expenses}
              categories={categories}
              vendors={vendors}
              onEdit={handleEdit}
              onDelete={deleteExpense}
              onUploadReceipt={handleUploadReceipt}
              onViewReceipt={handleViewReceipt}
            />
          </CardContent>
        </Card>

        {/* Expense Form Modal */}
        <ExpenseForm
          open={showExpenseForm}
          onClose={handleCloseExpenseForm}
          onSubmit={handleExpenseSubmit}
          categories={categories}
          vendors={vendors}
          clients={clients}
          expense={editingExpense || undefined}
          onCreateVendor={() => {
            setShowExpenseForm(false);
            setShowVendorForm(true);
          }}
        />

        {/* Vendor Form Modal */}
        <VendorForm
          open={showVendorForm}
          onClose={() => setShowVendorForm(false)}
          onSubmit={handleVendorSubmit}
          categories={categories}
        />

      {/* Category Manager Modal */}
      <CategoryManager
        open={showCategoryManager}
        onClose={() => setShowCategoryManager(false)}
      />

      {/* AI Assistant - Floating Button */}
      <ExpenseAssistantPanel onExpensesChanged={refresh} />
    </div>
  );
}
