import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { CalendarIcon, Plus, Upload, X, Building2, ChevronsUpDown, Check } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import type {
  Expense,
  ExpenseCategory,
  Vendor,
  ExpenseFormData,
  PaymentMethod,
  AllocationType,
  AllocationFormData,
} from "@/types/expenses";

interface ExpenseFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: ExpenseFormData) => Promise<Expense | null>;
  categories: ExpenseCategory[];
  vendors: Vendor[];
  clients: { workspace_name: string; display_name?: string }[];
  expense?: Expense; // For edit mode
  onCreateVendor?: () => void;
}

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'check', label: 'Check' },
  { value: 'paypal', label: 'PayPal' },
  { value: 'cash', label: 'Cash' },
  { value: 'other', label: 'Other' },
];

export default function ExpenseForm({
  open,
  onClose,
  onSubmit,
  categories,
  vendors,
  clients,
  expense,
  onCreateVendor,
}: ExpenseFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [vendorPopoverOpen, setVendorPopoverOpen] = useState(false);

  // Form state
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState<Date>(new Date());
  const [categoryId, setCategoryId] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">("");
  const [paymentReference, setPaymentReference] = useState("");
  const [isTaxDeductible, setIsTaxDeductible] = useState(true);
  const [notes, setNotes] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  // Allocation state
  const [allocationType, setAllocationType] = useState<AllocationType>("overhead");
  const [selectedClient, setSelectedClient] = useState("");
  const [splitAllocations, setSplitAllocations] = useState<{ workspace_name: string; percentage: number }[]>([]);

  // Reset form when modal opens/closes or expense changes
  useEffect(() => {
    if (open) {
      if (expense) {
        // Edit mode - populate form
        setDescription(expense.description);
        setAmount(String(expense.amount));
        setExpenseDate(new Date(expense.expense_date));
        setCategoryId(expense.category_id);
        setVendorId(expense.vendor_id || "");
        setPaymentMethod(expense.payment_method || "");
        setPaymentReference(expense.payment_reference || "");
        setIsTaxDeductible(expense.is_tax_deductible);
        setNotes(expense.notes || "");

        // Set allocation type based on existing allocations
        if (expense.allocations && expense.allocations.length > 0) {
          const firstAlloc = expense.allocations[0];
          if (firstAlloc.is_overhead) {
            setAllocationType("overhead");
          } else if (expense.allocations.length === 1) {
            setAllocationType("client");
            setSelectedClient(firstAlloc.workspace_name || "");
          } else {
            setAllocationType("split");
            setSplitAllocations(
              expense.allocations
                .filter(a => !a.is_overhead)
                .map(a => ({
                  workspace_name: a.workspace_name || "",
                  percentage: a.allocation_percentage,
                }))
            );
          }
        }
      } else {
        // New expense - reset form
        setDescription("");
        setAmount("");
        setExpenseDate(new Date());
        setCategoryId("");
        setVendorId("");
        setPaymentMethod("");
        setPaymentReference("");
        setIsTaxDeductible(true);
        setNotes("");
        setReceiptFile(null);
        setAllocationType("overhead");
        setSelectedClient("");
        setSplitAllocations([]);
      }
    }
  }, [open, expense]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "Invalid File Type",
          description: "Please upload a JPG, PNG, GIF, or PDF file.",
          variant: "destructive",
        });
        return;
      }
      // Validate file size (10MB max)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: "Please upload a file smaller than 10MB.",
          variant: "destructive",
        });
        return;
      }
      setReceiptFile(file);
    }
  };

  const buildAllocations = (): AllocationFormData[] => {
    const amountNum = parseFloat(amount) || 0;

    switch (allocationType) {
      case "overhead":
        return [{ is_overhead: true, allocation_percentage: 100 }];

      case "client":
        if (!selectedClient) return [];
        return [{ workspace_name: selectedClient, is_overhead: false, allocation_percentage: 100 }];

      case "split":
        return splitAllocations
          .filter(a => a.workspace_name && a.percentage > 0)
          .map(a => ({
            workspace_name: a.workspace_name,
            is_overhead: false,
            allocation_percentage: a.percentage,
          }));

      default:
        return [];
    }
  };

  const handleSubmit = async () => {
    // Validation
    if (!description.trim()) {
      toast({ title: "Error", description: "Please enter a description.", variant: "destructive" });
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      toast({ title: "Error", description: "Please enter a valid amount.", variant: "destructive" });
      return;
    }
    if (!categoryId) {
      toast({ title: "Error", description: "Please select a category.", variant: "destructive" });
      return;
    }

    const allocations = buildAllocations();
    if (allocations.length === 0) {
      toast({ title: "Error", description: "Please configure expense allocation.", variant: "destructive" });
      return;
    }

    // Validate split allocations total to 100%
    if (allocationType === "split") {
      const totalPercentage = allocations.reduce((sum, a) => sum + a.allocation_percentage, 0);
      if (Math.abs(totalPercentage - 100) > 0.01) {
        toast({ title: "Error", description: "Split allocations must total 100%.", variant: "destructive" });
        return;
      }
    }

    setLoading(true);
    try {
      const formData: ExpenseFormData = {
        description: description.trim(),
        amount: parseFloat(amount),
        expense_date: expenseDate,
        category_id: categoryId,
        vendor_id: vendorId || undefined,
        payment_method: paymentMethod || undefined,
        payment_reference: paymentReference || undefined,
        is_recurring: false,
        is_tax_deductible: isTaxDeductible,
        notes: notes || undefined,
        allocation_type: allocationType,
        allocations,
        receipt_file: receiptFile || undefined,
      };

      const result = await onSubmit(formData);

      if (result) {
        toast({
          title: "Success",
          description: expense ? "Expense updated successfully!" : "Expense created successfully!",
        });
        onClose();
      }
    } catch (error: any) {
      console.error("Failed to save expense:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save expense.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addSplitAllocation = () => {
    setSplitAllocations([...splitAllocations, { workspace_name: "", percentage: 0 }]);
  };

  const removeSplitAllocation = (index: number) => {
    setSplitAllocations(splitAllocations.filter((_, i) => i !== index));
  };

  const updateSplitAllocation = (index: number, field: 'workspace_name' | 'percentage', value: string | number) => {
    const updated = [...splitAllocations];
    if (field === 'percentage') {
      updated[index].percentage = Number(value);
    } else {
      updated[index].workspace_name = value as string;
    }
    setSplitAllocations(updated);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{expense ? "Edit Expense" : "Add New Expense"}</DialogTitle>
          <DialogDescription>
            {expense
              ? "Update the expense details below."
              : "Enter the expense details. A receipt is required for approval."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Input
              id="description"
              placeholder="e.g., Clay monthly subscription"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Amount and Date Row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount ($) *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Expense Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !expenseDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {expenseDate ? format(expenseDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={expenseDate}
                    onSelect={(date) => date && setExpenseDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Category and Vendor Row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Category *</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: cat.color }}
                        />
                        {cat.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Vendor</Label>
              <div className="flex gap-2">
                <Popover open={vendorPopoverOpen} onOpenChange={setVendorPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={vendorPopoverOpen}
                      className="flex-1 justify-between font-normal"
                    >
                      {vendorId
                        ? vendors.find((v) => v.id === vendorId)?.display_name ||
                          vendors.find((v) => v.id === vendorId)?.name
                        : "Select vendor (optional)"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search vendors..." />
                      <CommandList>
                        <CommandEmpty>No vendor found.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="none"
                            onSelect={() => {
                              setVendorId("");
                              setVendorPopoverOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                !vendorId ? "opacity-100" : "opacity-0"
                              )}
                            />
                            None
                          </CommandItem>
                          {vendors.map((vendor) => (
                            <CommandItem
                              key={vendor.id}
                              value={vendor.display_name || vendor.name}
                              onSelect={() => {
                                setVendorId(vendor.id);
                                setVendorPopoverOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  vendorId === vendor.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {vendor.display_name || vendor.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {onCreateVendor && (
                  <Button variant="outline" size="icon" onClick={onCreateVendor} title="Add New Vendor">
                    <Plus className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Payment Method and Reference */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select value={paymentMethod || "none"} onValueChange={(v) => setPaymentMethod(v === "none" ? "" : v as PaymentMethod)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {PAYMENT_METHODS.map((method) => (
                    <SelectItem key={method.value} value={method.value}>
                      {method.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment-ref">Reference / Check #</Label>
              <Input
                id="payment-ref"
                placeholder="e.g., #1234"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
              />
            </div>
          </div>

          {/* Allocation Section */}
          <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
            <Label className="text-base font-semibold">Cost Allocation *</Label>
            <p className="text-sm text-muted-foreground">
              How should this expense be allocated for profitability tracking?
            </p>

            <div className="space-y-3">
              {/* Overhead Option */}
              <div
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                  allocationType === "overhead" ? "border-primary bg-primary/5" : "hover:bg-muted"
                )}
                onClick={() => setAllocationType("overhead")}
              >
                <Building2 className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="font-medium">Business Overhead</p>
                  <p className="text-sm text-muted-foreground">
                    Split equally across all active clients
                  </p>
                </div>
                <input
                  type="radio"
                  checked={allocationType === "overhead"}
                  onChange={() => setAllocationType("overhead")}
                  className="h-4 w-4"
                />
              </div>

              {/* Single Client Option */}
              <div
                className={cn(
                  "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                  allocationType === "client" ? "border-primary bg-primary/5" : "hover:bg-muted"
                )}
                onClick={() => setAllocationType("client")}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">Single Client</p>
                    <input
                      type="radio"
                      checked={allocationType === "client"}
                      onChange={() => setAllocationType("client")}
                      className="h-4 w-4 ml-auto"
                    />
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    100% allocated to one specific client
                  </p>
                  {allocationType === "client" && (
                    <Select value={selectedClient} onValueChange={setSelectedClient}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select client" />
                      </SelectTrigger>
                      <SelectContent>
                        {clients.map((client) => (
                          <SelectItem key={client.workspace_name} value={client.workspace_name}>
                            {client.display_name || client.workspace_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>

              {/* Split Option */}
              <div
                className={cn(
                  "flex flex-col gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                  allocationType === "split" ? "border-primary bg-primary/5" : "hover:bg-muted"
                )}
                onClick={() => allocationType !== "split" && setAllocationType("split")}
              >
                <div className="flex items-center gap-2">
                  <p className="font-medium">Split Between Clients</p>
                  <input
                    type="radio"
                    checked={allocationType === "split"}
                    onChange={() => setAllocationType("split")}
                    className="h-4 w-4 ml-auto"
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  Allocate percentages to multiple clients (must total 100%)
                </p>

                {allocationType === "split" && (
                  <div className="space-y-2 mt-2" onClick={(e) => e.stopPropagation()}>
                    {splitAllocations.map((alloc, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Select
                          value={alloc.workspace_name}
                          onValueChange={(v) => updateSplitAllocation(index, 'workspace_name', v)}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Select client" />
                          </SelectTrigger>
                          <SelectContent>
                            {clients.map((client) => (
                              <SelectItem key={client.workspace_name} value={client.workspace_name}>
                                {client.display_name || client.workspace_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          className="w-24"
                          placeholder="%"
                          value={alloc.percentage || ""}
                          onChange={(e) => updateSplitAllocation(index, 'percentage', e.target.value)}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeSplitAllocation(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addSplitAllocation}
                      className="w-full"
                    >
                      <Plus className="h-4 w-4 mr-2" /> Add Client
                    </Button>
                    {splitAllocations.length > 0 && (
                      <p className="text-sm text-muted-foreground text-right">
                        Total: {splitAllocations.reduce((sum, a) => sum + (a.percentage || 0), 0)}%
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Receipt Upload */}
          <div className="space-y-2">
            <Label>Receipt</Label>
            <div className="border-2 border-dashed rounded-lg p-4 text-center">
              {receiptFile ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Upload className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{receiptFile.name}</span>
                    <span className="text-xs text-muted-foreground">
                      ({(receiptFile.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setReceiptFile(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mb-2">
                    Drop a file here or click to upload
                  </p>
                  <Input
                    type="file"
                    accept="image/jpeg,image/png,image/gif,application/pdf"
                    onChange={handleFileChange}
                    className="max-w-xs mx-auto"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    JPG, PNG, GIF, or PDF up to 10MB
                  </p>
                </>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Expenses remain "pending" until a receipt is uploaded
            </p>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Additional details..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          {/* Tax Deductible */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="tax-deductible"
              checked={isTaxDeductible}
              onCheckedChange={(checked) => setIsTaxDeductible(checked === true)}
            />
            <Label htmlFor="tax-deductible" className="text-sm font-normal">
              This expense is tax deductible
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Saving..." : expense ? "Update Expense" : "Add Expense"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
