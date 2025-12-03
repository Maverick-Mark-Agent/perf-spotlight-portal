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
import { useToast } from "@/hooks/use-toast";
import type { ExpenseCategory, CategoryFormData } from "@/types/expenses";

interface CategoryFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CategoryFormData) => Promise<ExpenseCategory | null>;
  category?: ExpenseCategory; // For edit mode
}

const CATEGORY_COLORS = [
  { value: "#ef4444", label: "Red" },
  { value: "#f97316", label: "Orange" },
  { value: "#f59e0b", label: "Amber" },
  { value: "#eab308", label: "Yellow" },
  { value: "#84cc16", label: "Lime" },
  { value: "#22c55e", label: "Green" },
  { value: "#14b8a6", label: "Teal" },
  { value: "#06b6d4", label: "Cyan" },
  { value: "#0ea5e9", label: "Sky" },
  { value: "#3b82f6", label: "Blue" },
  { value: "#6366f1", label: "Indigo" },
  { value: "#8b5cf6", label: "Violet" },
  { value: "#a855f7", label: "Purple" },
  { value: "#d946ef", label: "Fuchsia" },
  { value: "#ec4899", label: "Pink" },
  { value: "#64748b", label: "Slate" },
];

const TAX_CATEGORIES = [
  { value: "office_supplies", label: "Office Supplies" },
  { value: "software", label: "Software & Subscriptions" },
  { value: "professional_services", label: "Professional Services" },
  { value: "marketing", label: "Marketing & Advertising" },
  { value: "travel", label: "Travel & Meals" },
  { value: "utilities", label: "Utilities" },
  { value: "equipment", label: "Equipment" },
  { value: "insurance", label: "Insurance" },
  { value: "rent", label: "Rent & Lease" },
  { value: "payroll", label: "Payroll & Contractors" },
  { value: "other", label: "Other Deductible" },
];

const CATEGORY_ICONS = [
  { value: "folder", label: "Folder" },
  { value: "credit-card", label: "Credit Card" },
  { value: "briefcase", label: "Briefcase" },
  { value: "building", label: "Building" },
  { value: "code", label: "Code" },
  { value: "cloud", label: "Cloud" },
  { value: "globe", label: "Globe" },
  { value: "mail", label: "Mail" },
  { value: "megaphone", label: "Megaphone" },
  { value: "phone", label: "Phone" },
  { value: "printer", label: "Printer" },
  { value: "server", label: "Server" },
  { value: "shield", label: "Shield" },
  { value: "tool", label: "Tool" },
  { value: "truck", label: "Truck" },
  { value: "users", label: "Users" },
  { value: "zap", label: "Zap" },
];

export default function CategoryForm({
  open,
  onClose,
  onSubmit,
  category,
}: CategoryFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("");
  const [color, setColor] = useState("#3b82f6");
  const [sortOrder, setSortOrder] = useState("");
  const [isTaxDeductible, setIsTaxDeductible] = useState(true);
  const [taxCategory, setTaxCategory] = useState("");

  // Reset form when modal opens/closes or category changes
  useEffect(() => {
    if (open) {
      if (category) {
        // Edit mode - populate form
        setName(category.name);
        setDescription(category.description || "");
        setIcon(category.icon || "");
        setColor(category.color);
        setSortOrder(String(category.sort_order));
        setIsTaxDeductible(category.is_tax_deductible);
        setTaxCategory(category.tax_category || "");
      } else {
        // New category - reset form
        setName("");
        setDescription("");
        setIcon("");
        setColor("#3b82f6");
        setSortOrder("");
        setIsTaxDeductible(true);
        setTaxCategory("");
      }
    }
  }, [open, category]);

  const handleSubmit = async () => {
    // Validation
    if (!name.trim()) {
      toast({ title: "Error", description: "Please enter a category name.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const formData: CategoryFormData = {
        name: name.trim(),
        description: description.trim() || undefined,
        icon: icon || undefined,
        color,
        sort_order: sortOrder ? parseInt(sortOrder) : undefined,
        is_tax_deductible: isTaxDeductible,
        tax_category: isTaxDeductible ? taxCategory || undefined : undefined,
      };

      const result = await onSubmit(formData);

      if (result) {
        toast({
          title: "Success",
          description: category ? "Category updated successfully!" : "Category created successfully!",
        });
        onClose();
      }
    } catch (error: any) {
      console.error("Failed to save category:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save category.",
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
          <DialogTitle>{category ? "Edit Category" : "Add New Category"}</DialogTitle>
          <DialogDescription>
            {category
              ? "Update the category details below."
              : "Create a new expense category."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              placeholder="e.g., Software & Subscriptions"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="What kinds of expenses belong in this category?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          {/* Color and Icon Row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Color *</Label>
              <Select value={color} onValueChange={setColor}>
                <SelectTrigger>
                  <SelectValue>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      {CATEGORY_COLORS.find(c => c.value === color)?.label || "Custom"}
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_COLORS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: c.value }}
                        />
                        {c.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Icon</Label>
              <Select value={icon || "none"} onValueChange={(v) => setIcon(v === "none" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select icon" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {CATEGORY_ICONS.map((i) => (
                    <SelectItem key={i.value} value={i.value}>
                      {i.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Sort Order */}
          <div className="space-y-2">
            <Label htmlFor="sort-order">Sort Order</Label>
            <Input
              id="sort-order"
              type="number"
              min="0"
              placeholder="Auto (leave empty)"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Lower numbers appear first. Leave empty to add at the end.
            </p>
          </div>

          {/* Tax Deductible */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="tax-deductible"
                checked={isTaxDeductible}
                onCheckedChange={(checked) => setIsTaxDeductible(checked === true)}
              />
              <Label htmlFor="tax-deductible" className="text-sm font-normal">
                Expenses in this category are tax deductible
              </Label>
            </div>

            {isTaxDeductible && (
              <div className="space-y-2 pl-6">
                <Label>Tax Category</Label>
                <Select value={taxCategory || "none"} onValueChange={(v) => setTaxCategory(v === "none" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select tax category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not specified</SelectItem>
                    {TAX_CATEGORIES.map((tc) => (
                      <SelectItem key={tc.value} value={tc.value}>
                        {tc.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Optional: Group for tax reporting purposes
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Saving..." : category ? "Update Category" : "Add Category"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
