import { useState, useMemo } from "react";
import { format, parseISO, startOfMonth, endOfMonth, subMonths } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Receipt,
  MoreHorizontal,
  Edit,
  Trash2,
  Upload,
  CheckCircle,
  AlertCircle,
  Building2,
  User,
  Search,
  X,
  ExternalLink,
} from "lucide-react";
import type { Expense, ExpenseCategory, Vendor } from "@/types/expenses";

interface ExpenseListProps {
  expenses: Expense[];
  categories: ExpenseCategory[];
  vendors: Vendor[];
  onEdit: (expense: Expense) => void;
  onDelete: (id: string) => Promise<boolean>;
  onUploadReceipt: (expense: Expense) => void;
  onViewReceipt: (expense: Expense) => void;
}

export default function ExpenseList({
  expenses,
  categories,
  vendors,
  onEdit,
  onDelete,
  onUploadReceipt,
  onViewReceipt,
}: ExpenseListProps) {
  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [vendorFilter, setVendorFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [monthFilter, setMonthFilter] = useState<string>("all");

  // Generate month options for the last 12 months
  const monthOptions = useMemo(() => {
    const months = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const date = subMonths(now, i);
      const value = format(date, "yyyy-MM");
      const label = format(date, "MMMM yyyy");
      months.push({ value, label });
    }
    return months;
  }, []);

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Filtered expenses
  const filteredExpenses = useMemo(() => {
    return expenses.filter((expense) => {
      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchesDescription = expense.description.toLowerCase().includes(search);
        const matchesVendor = expense.vendor?.name.toLowerCase().includes(search);
        const matchesCategory = expense.category?.name.toLowerCase().includes(search);
        if (!matchesDescription && !matchesVendor && !matchesCategory) {
          return false;
        }
      }

      // Category filter
      if (categoryFilter !== "all" && expense.category_id !== categoryFilter) {
        return false;
      }

      // Vendor filter
      if (vendorFilter !== "all") {
        if (vendorFilter === "none" && expense.vendor_id) return false;
        if (vendorFilter !== "none" && expense.vendor_id !== vendorFilter) return false;
      }

      // Status filter
      if (statusFilter !== "all" && expense.status !== statusFilter) {
        return false;
      }

      // Month filter
      if (monthFilter !== "all") {
        const expenseMonth = expense.expense_date.substring(0, 7); // YYYY-MM
        if (expenseMonth !== monthFilter) {
          return false;
        }
      }

      return true;
    });
  }, [expenses, searchTerm, categoryFilter, vendorFilter, statusFilter, monthFilter]);

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await onDelete(deleteId);
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    setCategoryFilter("all");
    setVendorFilter("all");
    setStatusFilter("all");
    setMonthFilter("all");
  };

  const hasActiveFilters = searchTerm || categoryFilter !== "all" || vendorFilter !== "all" || statusFilter !== "all" || monthFilter !== "all";

  const getAllocationDisplay = (expense: Expense) => {
    if (!expense.allocations || expense.allocations.length === 0) {
      return <span className="text-muted-foreground">Not allocated</span>;
    }

    const firstAlloc = expense.allocations[0];

    if (firstAlloc.is_overhead) {
      return (
        <div className="flex items-center gap-1">
          <Building2 className="h-3 w-3 text-muted-foreground" />
          <span className="text-sm">Overhead</span>
        </div>
      );
    }

    if (expense.allocations.length === 1) {
      return (
        <div className="flex items-center gap-1">
          <User className="h-3 w-3 text-muted-foreground" />
          <span className="text-sm">{firstAlloc.workspace_name}</span>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-1">
        <User className="h-3 w-3 text-muted-foreground" />
        <span className="text-sm">{expense.allocations.length} clients</span>
      </div>
    );
  };

  const getStatusBadge = (expense: Expense) => {
    switch (expense.status) {
      case "approved":
        return (
          <Badge variant="default" className="bg-green-600">
            <CheckCircle className="h-3 w-3 mr-1" />
            Approved
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="secondary" className="bg-amber-100 text-amber-800">
            <AlertCircle className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="destructive">
            Rejected
          </Badge>
        );
      default:
        return <Badge variant="outline">{expense.status}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search transactions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                  {cat.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={vendorFilter} onValueChange={setVendorFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Vendor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Vendors</SelectItem>
            <SelectItem value="none">No Vendor</SelectItem>
            {vendors.map((vendor) => (
              <SelectItem key={vendor.id} value={vendor.id}>
                {vendor.display_name || vendor.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>

        <Select value={monthFilter} onValueChange={setMonthFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Month" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Months</SelectItem>
            {monthOptions.map((month) => (
              <SelectItem key={month.value} value={month.value}>
                {month.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        )}
      </div>

      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        Showing {filteredExpenses.length} of {expenses.length} transactions
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Allocation</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Receipt</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredExpenses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  {expenses.length === 0
                    ? "No transactions recorded yet"
                    : "No transactions match your filters"}
                </TableCell>
              </TableRow>
            ) : (
              filteredExpenses.map((expense) => (
                <TableRow key={expense.id}>
                  <TableCell className="whitespace-nowrap">
                    {format(new Date(expense.expense_date), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell>
                    <div className="max-w-[200px] truncate" title={expense.description}>
                      {expense.description}
                    </div>
                    {expense.notes && (
                      <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                        {expense.notes}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    {expense.category && (
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: expense.category.color }}
                        />
                        <span className="text-sm">{expense.category.name}</span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {expense.vendor ? (
                      <span className="text-sm">
                        {expense.vendor.display_name || expense.vendor.name}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell className={`text-right font-medium ${expense.category?.slug === 'income' ? 'text-green-600' : ''}`}>
                    {expense.category?.slug === 'income' ? '+' : ''}${expense.amount.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </TableCell>
                  <TableCell>{getAllocationDisplay(expense)}</TableCell>
                  <TableCell>{getStatusBadge(expense)}</TableCell>
                  <TableCell>
                    {expense.has_receipt && expense.receipts && expense.receipts.length > 0 ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onViewReceipt(expense)}
                        className="text-green-600 hover:text-green-700"
                      >
                        <Receipt className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onUploadReceipt(expense)}
                        className="text-amber-600 hover:text-amber-700"
                        title="Upload receipt"
                      >
                        <Upload className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onEdit(expense)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        {!expense.has_receipt && (
                          <DropdownMenuItem onClick={() => onUploadReceipt(expense)}>
                            <Upload className="h-4 w-4 mr-2" />
                            Upload Receipt
                          </DropdownMenuItem>
                        )}
                        {expense.has_receipt && expense.receipts && expense.receipts.length > 0 && (
                          <DropdownMenuItem onClick={() => onViewReceipt(expense)}>
                            <ExternalLink className="h-4 w-4 mr-2" />
                            View Receipt
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => setDeleteId(expense.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Expense?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this expense and any associated receipts.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
