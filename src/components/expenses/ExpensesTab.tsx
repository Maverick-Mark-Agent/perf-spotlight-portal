import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import {
  Plus,
  Receipt,
  AlertCircle,
  DollarSign,
  TrendingDown,
  Building2,
  User,
  RefreshCw,
  Store,
} from "lucide-react";
import { useExpenses } from "@/hooks/useExpenses";
import { supabase } from "@/integrations/supabase/client";
import ExpenseForm from "./ExpenseForm";
import ExpenseList from "./ExpenseList";
import VendorForm from "./VendorForm";
import { ExpenseAssistantFAB, ExpenseAssistantSheet } from "./assistant";
import type { Expense, ExpenseFormData, VendorFormData, Vendor } from "@/types/expenses";

interface Client {
  workspace_name: string;
  display_name?: string;
}

export default function ExpensesTab() {
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
  } = useExpenses();

  // Modal states
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showVendorForm, setShowVendorForm] = useState(false);
  const [showAssistant, setShowAssistant] = useState(false);
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

  // Pie chart data
  const pieChartData = totals.mtd_by_category.map((cat) => ({
    name: cat.category_name,
    value: cat.amount,
    color: cat.category_color,
  }));

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
                <p className="text-xs text-muted-foreground font-medium">MTD Total Expenses</p>
                <p className="text-2xl font-bold">
                  ${totals.mtd_total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {expenses.length} expense{expenses.length !== 1 ? "s" : ""}
                </p>
              </div>
              <DollarSign className="h-6 w-6 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Approved</p>
                <p className="text-2xl font-bold text-green-600">
                  ${totals.mtd_approved.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Included in P&L
                </p>
              </div>
              <Receipt className="h-6 w-6 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Overhead</p>
                <p className="text-2xl font-bold text-blue-600">
                  ${totals.mtd_overhead.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Split across clients
                </p>
              </div>
              <Building2 className="h-6 w-6 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Client-Specific</p>
                <p className="text-2xl font-bold text-purple-600">
                  ${totals.mtd_client_allocated.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Direct costs
                </p>
              </div>
              <User className="h-6 w-6 text-purple-600" />
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
        <Button variant="outline" onClick={refresh}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Chart and List Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pie Chart */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Expenses by Category</CardTitle>
          </CardHeader>
          <CardContent>
            {pieChartData.length === 0 ? (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                No expense data
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) =>
                      percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ""
                    }
                    labelLine={false}
                  >
                    {pieChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) =>
                      `$${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                    }
                  />
                  <Legend
                    layout="vertical"
                    align="right"
                    verticalAlign="middle"
                    wrapperStyle={{ fontSize: "12px" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Expense List */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Recent Expenses</CardTitle>
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
      </div>

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

      {/* AI Assistant */}
      <ExpenseAssistantFAB onClick={() => setShowAssistant(true)} />
      <ExpenseAssistantSheet
        open={showAssistant}
        onClose={() => setShowAssistant(false)}
        onExpensesChanged={refresh}
      />
    </div>
  );
}
