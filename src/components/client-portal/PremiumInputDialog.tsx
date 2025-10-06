import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { DollarSign, Award } from "lucide-react";

interface PremiumInputDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (premiumAmount: number, policyType: string) => void;
  leadName: string;
  currentPremium?: number | null;
  currentPolicyType?: string | null;
}

export const PremiumInputDialog = ({
  isOpen,
  onClose,
  onSave,
  leadName,
  currentPremium,
  currentPolicyType,
}: PremiumInputDialogProps) => {
  const [premiumAmount, setPremiumAmount] = useState("");
  const [policyType, setPolicyType] = useState("");

  useEffect(() => {
    if (isOpen) {
      setPremiumAmount(currentPremium?.toString() || "");
      setPolicyType(currentPolicyType || "");
    }
  }, [isOpen, currentPremium, currentPolicyType]);

  const handleSave = () => {
    const premium = parseFloat(premiumAmount);
    if (isNaN(premium) || premium <= 0) {
      return;
    }
    if (!policyType) {
      return;
    }
    onSave(premium, policyType);
    onClose();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && premiumAmount && policyType) {
      handleSave();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-gradient-to-br from-slate-900 to-slate-800 border-purple-500/20 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Award className="h-6 w-6 text-green-400" />
            Mark as Won!
          </DialogTitle>
          <DialogDescription className="text-white/70">
            Enter the premium amount and policy type for <span className="font-semibold text-white">{leadName}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Premium Amount */}
          <div className="space-y-3">
            <Label htmlFor="premium" className="text-white flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-400" />
              Premium Amount
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60">$</span>
              <Input
                id="premium"
                type="number"
                placeholder="5000"
                value={premiumAmount}
                onChange={(e) => setPremiumAmount(e.target.value)}
                onKeyPress={handleKeyPress}
                className="pl-7 bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-green-400"
                autoFocus
              />
            </div>
            <p className="text-white/50 text-xs">Annual premium amount for this policy</p>
          </div>

          {/* Policy Type */}
          <div className="space-y-3">
            <Label htmlFor="policy-type" className="text-white">
              Policy Type
            </Label>
            <Select value={policyType} onValueChange={setPolicyType}>
              <SelectTrigger
                id="policy-type"
                className="bg-white/10 border-white/20 text-white focus:border-green-400"
              >
                <SelectValue placeholder="Select policy type..." />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-white/20">
                <SelectItem value="Auto" className="text-white hover:bg-white/10">Auto Insurance</SelectItem>
                <SelectItem value="Home" className="text-white hover:bg-white/10">Home Insurance</SelectItem>
                <SelectItem value="Life" className="text-white hover:bg-white/10">Life Insurance</SelectItem>
                <SelectItem value="Commercial" className="text-white hover:bg-white/10">Commercial Insurance</SelectItem>
                <SelectItem value="Health" className="text-white hover:bg-white/10">Health Insurance</SelectItem>
                <SelectItem value="Umbrella" className="text-white hover:bg-white/10">Umbrella Insurance</SelectItem>
                <SelectItem value="Other" className="text-white hover:bg-white/10">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Visual Indicator */}
          {premiumAmount && !isNaN(parseFloat(premiumAmount)) && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
              <p className="text-green-400 text-sm font-medium">
                Great! You're adding ${parseFloat(premiumAmount).toLocaleString()} to your won deals 🎉
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="ghost"
            onClick={onClose}
            className="text-white/70 hover:text-white hover:bg-white/10"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!premiumAmount || isNaN(parseFloat(premiumAmount)) || parseFloat(premiumAmount) <= 0 || !policyType}
            className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white"
          >
            <Award className="h-4 w-4 mr-2" />
            Mark as Won
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
