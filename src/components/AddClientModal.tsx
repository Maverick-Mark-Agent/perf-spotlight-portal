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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

type AddClientModalProps = {
  open: boolean;
  onClose: () => void;
  onAddClient: (clientData: ClientFormData) => Promise<void>;
};

export interface ClientFormData {
  clientName: string;
  workspaceName: string;
  clientType: 'home_insurance' | 'other';
  billingType: 'per_lead' | 'retainer';
  pricePerLead?: number;
  retainerAmount?: number;
  monthlyKPITarget?: number;
  monthlySendingTarget?: number;
  zipColor?: string;
}

const PRESET_COLORS = [
  "#3B82F6", // blue
  "#10B981", // green
  "#F59E0B", // amber
  "#EF4444", // red
  "#8B5CF6", // violet
  "#EC4899", // pink
  "#14B8A6", // teal
  "#F97316", // orange
  "#6366F1", // indigo
  "#84CC16", // lime
];

export default function AddClientModal({
  open,
  onClose,
  onAddClient,
}: AddClientModalProps) {
  const { toast } = useToast();
  const [clientName, setClientName] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [clientType, setClientType] = useState<'home_insurance' | 'other'>('other');
  const [billingType, setBillingType] = useState<'per_lead' | 'retainer'>('retainer');
  const [pricePerLead, setPricePerLead] = useState("");
  const [retainerAmount, setRetainerAmount] = useState("");
  const [monthlyKPITarget, setMonthlyKPITarget] = useState("");
  const [monthlySendingTarget, setMonthlySendingTarget] = useState("");
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0]);
  const [loading, setLoading] = useState(false);

  const handleAdd = async () => {
    if (!clientName.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a client name.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      await onAddClient({
        clientName: clientName.trim(),
        workspaceName: workspaceName.trim() || clientName.trim(),
        clientType,
        billingType,
        pricePerLead: pricePerLead ? parseFloat(pricePerLead) : undefined,
        retainerAmount: retainerAmount ? parseFloat(retainerAmount) : undefined,
        monthlyKPITarget: monthlyKPITarget ? parseInt(monthlyKPITarget) : undefined,
        monthlySendingTarget: monthlySendingTarget ? parseInt(monthlySendingTarget) : undefined,
        zipColor: clientType === 'home_insurance' ? selectedColor : undefined,
      });

      toast({
        title: "Success",
        description: `Client "${clientName}" added successfully! Available in all dashboards.`,
      });

      onClose();
      // Reset form
      setClientName("");
      setWorkspaceName("");
      setClientType('other');
      setBillingType('retainer');
      setPricePerLead("");
      setRetainerAmount("");
      setMonthlyKPITarget("");
      setMonthlySendingTarget("");
      setSelectedColor(PRESET_COLORS[0]);
    } catch (error: any) {
      console.error("Failed to add client:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to add client. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Client</DialogTitle>
          <DialogDescription>
            Add a new client to the system. This client will be available in all dashboards (ZIP, Contact Pipeline, KPI, etc.)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Basic Info */}
          <div className="space-y-2">
            <Label htmlFor="client-name">Client Display Name *</Label>
            <Input
              id="client-name"
              placeholder="e.g., John Smith Insurance"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="workspace-name">Workspace Name (optional)</Label>
            <Input
              id="workspace-name"
              placeholder="Leave blank to use client name"
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              This will be used as the unique identifier in Email Bison and databases
            </p>
          </div>

          {/* Client Type */}
          <div className="space-y-2">
            <Label htmlFor="client-type">Client Type *</Label>
            <Select value={clientType} onValueChange={(value: 'home_insurance' | 'other') => setClientType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="other">Standard Client</SelectItem>
                <SelectItem value="home_insurance">Home Insurance (ZIP + Contact Pipeline)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Home insurance clients will have access to ZIP Dashboard and Contact Pipeline features
            </p>
          </div>

          {/* Billing Configuration */}
          <div className="space-y-2">
            <Label htmlFor="billing-type">Billing Type *</Label>
            <Select value={billingType} onValueChange={(value: 'per_lead' | 'retainer') => setBillingType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="retainer">Retainer</SelectItem>
                <SelectItem value="per_lead">Per Lead</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {billingType === 'per_lead' && (
            <div className="space-y-2">
              <Label htmlFor="price-per-lead">Price Per Lead ($)</Label>
              <Input
                id="price-per-lead"
                type="number"
                step="0.01"
                placeholder="e.g., 25.00"
                value={pricePerLead}
                onChange={(e) => setPricePerLead(e.target.value)}
              />
            </div>
          )}

          {billingType === 'retainer' && (
            <div className="space-y-2">
              <Label htmlFor="retainer-amount">Monthly Retainer Amount ($)</Label>
              <Input
                id="retainer-amount"
                type="number"
                step="0.01"
                placeholder="e.g., 5000.00"
                value={retainerAmount}
                onChange={(e) => setRetainerAmount(e.target.value)}
              />
            </div>
          )}

          {/* Targets */}
          <div className="space-y-2">
            <Label htmlFor="monthly-kpi-target">Monthly KPI Target (Leads)</Label>
            <Input
              id="monthly-kpi-target"
              type="number"
              placeholder="e.g., 50"
              value={monthlyKPITarget}
              onChange={(e) => setMonthlyKPITarget(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="monthly-sending-target">Monthly Sending Target (Emails)</Label>
            <Input
              id="monthly-sending-target"
              type="number"
              placeholder="e.g., 45000"
              value={monthlySendingTarget}
              onChange={(e) => setMonthlySendingTarget(e.target.value)}
            />
          </div>

          {/* ZIP Dashboard Color - Only for home insurance clients */}
          {clientType === 'home_insurance' && (
            <div className="space-y-2">
              <Label>ZIP Dashboard Color</Label>
              <p className="text-xs text-muted-foreground mb-2">
                This color will be used to identify this client on the ZIP Dashboard map
              </p>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setSelectedColor(color)}
                  className={`w-8 h-8 rounded border-2 transition-all ${
                    selectedColor === color
                      ? "border-white scale-110"
                      : "border-gray-400 hover:border-gray-200"
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Label htmlFor="custom-color" className="text-sm">Custom:</Label>
              <input
                id="custom-color"
                type="color"
                value={selectedColor}
                onChange={(e) => setSelectedColor(e.target.value)}
                className="w-20 h-8 rounded border border-gray-400 cursor-pointer"
              />
              <span className="text-sm text-gray-500 font-mono">{selectedColor}</span>
            </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleAdd} disabled={!clientName.trim() || loading}>
            {loading ? "Adding Client..." : "Add Client"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
