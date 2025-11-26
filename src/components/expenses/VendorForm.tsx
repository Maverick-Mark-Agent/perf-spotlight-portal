import { useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import type {
  Vendor,
  VendorFormData,
  ExpenseCategory,
  PaymentMethod,
  BillingCycle,
} from "@/types/expenses";

interface VendorFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: VendorFormData) => Promise<Vendor | null>;
  categories: ExpenseCategory[];
  vendor?: Vendor; // For edit mode
}

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'check', label: 'Check' },
  { value: 'paypal', label: 'PayPal' },
  { value: 'cash', label: 'Cash' },
  { value: 'other', label: 'Other' },
];

const BILLING_CYCLES: { value: BillingCycle; label: string }[] = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'annual', label: 'Annual' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'one_time', label: 'One-Time' },
  { value: 'variable', label: 'Variable' },
];

export default function VendorForm({
  open,
  onClose,
  onSubmit,
  categories,
  vendor,
}: VendorFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  // Form state
  const [name, setName] = useState(vendor?.name || "");
  const [displayName, setDisplayName] = useState(vendor?.display_name || "");
  const [website, setWebsite] = useState(vendor?.website || "");
  const [email, setEmail] = useState(vendor?.email || "");
  const [phone, setPhone] = useState(vendor?.phone || "");
  const [categoryId, setCategoryId] = useState(vendor?.category_id || "");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">(
    vendor?.default_payment_method || ""
  );
  const [billingCycle, setBillingCycle] = useState<BillingCycle | "">(
    vendor?.billing_cycle || ""
  );
  const [typicalAmount, setTypicalAmount] = useState(
    vendor?.typical_amount ? String(vendor.typical_amount) : ""
  );
  const [notes, setNotes] = useState(vendor?.notes || "");

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a vendor name.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const formData: VendorFormData = {
        name: name.trim(),
        display_name: displayName.trim() || undefined,
        website: website.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        category_id: categoryId || undefined,
        default_payment_method: paymentMethod || undefined,
        billing_cycle: billingCycle || undefined,
        typical_amount: typicalAmount ? parseFloat(typicalAmount) : undefined,
        notes: notes.trim() || undefined,
      };

      const result = await onSubmit(formData);

      if (result) {
        toast({
          title: "Success",
          description: vendor ? "Vendor updated successfully!" : "Vendor created successfully!",
        });
        onClose();
        // Reset form
        if (!vendor) {
          setName("");
          setDisplayName("");
          setWebsite("");
          setEmail("");
          setPhone("");
          setCategoryId("");
          setPaymentMethod("");
          setBillingCycle("");
          setTypicalAmount("");
          setNotes("");
        }
      }
    } catch (error: any) {
      console.error("Failed to save vendor:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save vendor.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{vendor ? "Edit Vendor" : "Add New Vendor"}</DialogTitle>
          <DialogDescription>
            {vendor
              ? "Update the vendor details below."
              : "Enter the vendor details. You can select this vendor when adding expenses."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="vendor-name">Vendor Name *</Label>
            <Input
              id="vendor-name"
              placeholder="e.g., Clay"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Display Name */}
          <div className="space-y-2">
            <Label htmlFor="display-name">Display Name</Label>
            <Input
              id="display-name"
              placeholder="e.g., Clay.com"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Optional friendly name shown in the UI
            </p>
          </div>

          {/* Website */}
          <div className="space-y-2">
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              type="url"
              placeholder="https://..."
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </div>

          {/* Contact Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vendor-email">Email</Label>
              <Input
                id="vendor-email"
                type="email"
                placeholder="billing@..."
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vendor-phone">Phone</Label>
              <Input
                id="vendor-phone"
                type="tel"
                placeholder="555-..."
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>

          {/* Default Category */}
          <div className="space-y-2">
            <Label>Default Category</Label>
            <Select value={categoryId || "none"} onValueChange={(v) => setCategoryId(v === "none" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select category (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: cat.color }}
                      />
                      {cat.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Payment & Billing */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select value={paymentMethod || "none"} onValueChange={(v) => setPaymentMethod(v === "none" ? "" : v as PaymentMethod)}>
                <SelectTrigger>
                  <SelectValue placeholder="Default" />
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
              <Label>Billing Cycle</Label>
              <Select value={billingCycle || "none"} onValueChange={(v) => setBillingCycle(v === "none" ? "" : v as BillingCycle)}>
                <SelectTrigger>
                  <SelectValue placeholder="Frequency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {BILLING_CYCLES.map((cycle) => (
                    <SelectItem key={cycle.value} value={cycle.value}>
                      {cycle.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Typical Amount */}
          <div className="space-y-2">
            <Label htmlFor="typical-amount">Typical Amount ($)</Label>
            <Input
              id="typical-amount"
              type="number"
              step="0.01"
              min="0"
              placeholder="e.g., 99.00"
              value={typicalAmount}
              onChange={(e) => setTypicalAmount(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Used as a default when adding new expenses
            </p>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="vendor-notes">Notes</Label>
            <Textarea
              id="vendor-notes"
              placeholder="Additional details..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Saving..." : vendor ? "Update Vendor" : "Add Vendor"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
