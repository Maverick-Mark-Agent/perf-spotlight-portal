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
import { DollarSign, Award, Plus, Trash2, TrendingUp } from "lucide-react";
import { SMAPolicyFormData, POLICY_TYPES } from "@/types/sma";
import { Card, CardContent } from "@/components/ui/card";

interface SMAPoliciesInputDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (policies: SMAPolicyFormData[]) => void;
  leadName: string;
}

export const SMAPoliciesInputDialog = ({
  isOpen,
  onClose,
  onSave,
  leadName,
}: SMAPoliciesInputDialogProps) => {
  const [policies, setPolicies] = useState<SMAPolicyFormData[]>([
    {
      tempId: crypto.randomUUID(),
      policy_type: "",
      premium_amount: 0,
      agency_commission: 0,
    },
  ]);
  const [customPolicyTypes, setCustomPolicyTypes] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      // Reset to single empty policy when dialog opens
      setPolicies([
        {
          tempId: crypto.randomUUID(),
          policy_type: "",
          premium_amount: 0,
          agency_commission: 0,
        },
      ]);
      setCustomPolicyTypes({});
    }
  }, [isOpen]);

  const handleAddPolicy = () => {
    setPolicies([
      ...policies,
      {
        tempId: crypto.randomUUID(),
        policy_type: "",
        premium_amount: 0,
        agency_commission: 0,
      },
    ]);
  };

  const handleRemovePolicy = (tempId: string) => {
    if (policies.length > 1) {
      setPolicies(policies.filter((p) => p.tempId !== tempId));
    }
  };

  const handlePolicyChange = (
    tempId: string,
    field: keyof SMAPolicyFormData,
    value: string | number
  ) => {
    setPolicies(
      policies.map((p) =>
        p.tempId === tempId
          ? { ...p, [field]: field === "policy_type" ? value : parseFloat(value.toString()) || 0 }
          : p
      )
    );
  };

  const calculateTotals = () => {
    return policies.reduce(
      (acc, policy) => ({
        totalPremium: acc.totalPremium + (policy.premium_amount || 0),
        totalAgencyCommission: acc.totalAgencyCommission + (policy.agency_commission || 0),
        totalMaverickCommission: acc.totalMaverickCommission + (policy.agency_commission || 0) * 0.2,
      }),
      { totalPremium: 0, totalAgencyCommission: 0, totalMaverickCommission: 0 }
    );
  };

  const isValidPolicy = (policy: SMAPolicyFormData) => {
    // Check if "Other" is selected and custom type is required
    if (policy.policy_type === 'Other') {
      const customType = customPolicyTypes[policy.tempId!];
      return (
        customType &&
        customType.trim().length > 0 &&
        policy.premium_amount > 0 &&
        policy.agency_commission >= 0
      );
    }

    return (
      policy.policy_type &&
      policy.premium_amount > 0 &&
      policy.agency_commission >= 0
    );
  };

  const canSave = policies.length > 0 && policies.every(isValidPolicy);

  const handleSave = () => {
    if (!canSave) return;

    // Replace "Other" with custom policy type if provided
    const finalPolicies = policies.map(policy => ({
      ...policy,
      policy_type: policy.policy_type === 'Other' && customPolicyTypes[policy.tempId!]
        ? customPolicyTypes[policy.tempId!]
        : policy.policy_type
    }));

    onSave(finalPolicies);
    onClose();
  };

  const totals = calculateTotals();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-gradient-to-br from-slate-900 to-slate-800 border-purple-500/20 text-white sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Award className="h-6 w-6 text-green-400" />
            Mark as Won - SMA Insurance
          </DialogTitle>
          <DialogDescription className="text-white/70">
            Add one or more policies for{" "}
            <span className="font-semibold text-white">{leadName}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Policy Cards */}
          {policies.map((policy, index) => (
            <Card
              key={policy.tempId}
              className="bg-white/5 border-white/10"
            >
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-white font-semibold flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-green-400" />
                    Policy #{index + 1}
                  </h3>
                  {policies.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemovePolicy(policy.tempId!)}
                      className="text-red-400 hover:text-red-300 hover:bg-red-400/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Policy Type */}
                    <div className="space-y-2">
                      <Label htmlFor={`policy-type-${policy.tempId}`} className="text-white text-sm">
                        Policy Type
                      </Label>
                      <Select
                        value={policy.policy_type}
                        onValueChange={(value) =>
                          handlePolicyChange(policy.tempId!, "policy_type", value)
                        }
                      >
                        <SelectTrigger
                          id={`policy-type-${policy.tempId}`}
                          className="bg-white/10 border-white/20 text-white"
                        >
                          <SelectValue placeholder="Select type..." />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-white/20">
                          {POLICY_TYPES.map((type) => (
                            <SelectItem
                              key={type}
                              value={type}
                              className="text-white hover:bg-white/10"
                            >
                              {type} Insurance
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Premium Amount */}
                    <div className="space-y-2">
                      <Label htmlFor={`premium-${policy.tempId}`} className="text-white text-sm">
                        Premium Amount
                      </Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60">
                          $
                        </span>
                        <Input
                          id={`premium-${policy.tempId}`}
                          type="number"
                          placeholder="5000"
                          value={policy.premium_amount || ""}
                          onChange={(e) =>
                            handlePolicyChange(
                              policy.tempId!,
                              "premium_amount",
                              e.target.value
                            )
                          }
                          className="pl-7 bg-white/10 border-white/20 text-white placeholder:text-white/40"
                        />
                      </div>
                    </div>

                    {/* Agency Commission */}
                    <div className="space-y-2">
                      <Label htmlFor={`commission-${policy.tempId}`} className="text-white text-sm">
                        Agency Commission
                      </Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60">
                          $
                        </span>
                        <Input
                          id={`commission-${policy.tempId}`}
                          type="number"
                          placeholder="750"
                          value={policy.agency_commission || ""}
                          onChange={(e) =>
                            handlePolicyChange(
                              policy.tempId!,
                              "agency_commission",
                              e.target.value
                            )
                          }
                          className="pl-7 bg-white/10 border-white/20 text-white placeholder:text-white/40"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Custom Policy Type Input - Show when "Other" is selected */}
                  {policy.policy_type === 'Other' && (
                    <div className="space-y-2">
                      <Label htmlFor={`custom-type-${policy.tempId}`} className="text-white text-sm">
                        Custom Policy Type
                      </Label>
                      <Input
                        id={`custom-type-${policy.tempId}`}
                        type="text"
                        placeholder="e.g., Flood Insurance, Pet Insurance"
                        value={customPolicyTypes[policy.tempId!] || ""}
                        onChange={(e) => {
                          setCustomPolicyTypes({
                            ...customPolicyTypes,
                            [policy.tempId!]: e.target.value
                          });
                        }}
                        className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                      />
                      <p className="text-white/50 text-xs">
                        Enter the specific type of insurance policy
                      </p>
                    </div>
                  )}

                  {/* Maverick Commission Preview */}
                  {policy.agency_commission > 0 && (
                    <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3">
                      <p className="text-purple-300 text-sm">
                        <TrendingUp className="h-3 w-3 inline mr-1" />
                        Maverick Commission (20%):{" "}
                        <span className="font-semibold">
                          ${(policy.agency_commission * 0.2).toFixed(2)}
                        </span>
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Add Policy Button */}
          <Button
            variant="outline"
            onClick={handleAddPolicy}
            className="w-full border-dashed border-white/30 text-white hover:bg-white/10 hover:border-white/50"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Another Policy
          </Button>

          {/* Totals Summary */}
          {policies.length > 0 && totals.totalPremium > 0 && (
            <Card className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 border-green-500/30">
              <CardContent className="pt-6">
                <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                  <Award className="h-5 w-5 text-green-400" />
                  Deal Summary
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-white/60 mb-1">Total Premium</p>
                    <p className="text-white text-xl font-bold">
                      ${totals.totalPremium.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-white/60 mb-1">Total SMA Commission</p>
                    <p className="text-green-400 text-xl font-bold">
                      ${totals.totalAgencyCommission.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-white/60 mb-1">Total Maverick Commission</p>
                    <p className="text-purple-400 text-xl font-bold">
                      ${totals.totalMaverickCommission.toFixed(2)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
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
            disabled={!canSave}
            className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white"
          >
            <Award className="h-4 w-4 mr-2" />
            Save {policies.length} {policies.length === 1 ? "Policy" : "Policies"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
