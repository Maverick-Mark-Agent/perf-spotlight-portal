import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Mail, Phone, MapPin, Building, ExternalLink, DollarSign } from "lucide-react";

const PIPELINE_STAGES = [
  { key: 'new', label: 'New Lead', color: 'bg-blue-500/20 border-blue-500/40' },
  { key: 'quoting', label: 'Quoting', color: 'bg-purple-500/20 border-purple-500/40' },
  { key: 'follow-up', label: 'Follow Up', color: 'bg-yellow-500/20 border-yellow-500/40' },
  { key: 'won', label: 'Won', color: 'bg-green-500/20 border-green-500/40' },
  { key: 'lost', label: 'Lost', color: 'bg-red-500/20 border-red-500/40' },
];

interface ClientLead {
  id: string;
  workspace_name: string;
  first_name: string | null;
  last_name: string | null;
  lead_email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  title: string | null;
  company: string | null;
  renewal_date: string | null;
  birthday: string | null;
  notes: string | null;
  premium_amount: number | null;
  policy_type: string | null;
  pipeline_stage: string;
  tags: Array<{id: number; name: string}> | null;
  custom_variables: Array<{name: string; value: string}> | null;
  bison_conversation_url: string | null;
  lead_value: number;
  date_received: string | null;
}

interface LeadDetailModalProps {
  lead: ClientLead | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

export const LeadDetailModal = ({ lead, isOpen, onClose, onUpdate }: LeadDetailModalProps) => {
  const { toast } = useToast();
  const [notes, setNotes] = useState("");
  const [premiumAmount, setPremiumAmount] = useState("");
  const [policyType, setPolicyType] = useState("");
  const [pipelineStage, setPipelineStage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (lead) {
      setNotes(lead.notes || "");
      setPremiumAmount(lead.premium_amount?.toString() || "");
      setPolicyType(lead.policy_type || "");
      setPipelineStage(lead.pipeline_stage || "new");
    }
  }, [lead]);

  if (!lead) return null;

  const handleClose = async () => {
    if (!lead) {
      onClose();
      return;
    }

    // Check what changed
    const originalNotes = lead.notes || "";
    const originalPremium = lead.premium_amount?.toString() || "";
    const originalPolicy = lead.policy_type || "";
    const originalStage = lead.pipeline_stage || "new";

    const notesChanged = notes !== originalNotes;
    const premiumChanged = premiumAmount !== originalPremium;
    const policyChanged = policyType !== originalPolicy;
    const stageChanged = pipelineStage !== originalStage;

    // If nothing changed, just close
    if (!notesChanged && !premiumChanged && !policyChanged && !stageChanged) {
      onClose();
      return;
    }

    // Validate Won stage requirements
    if (pipelineStage === 'won') {
      if (!premiumAmount || !policyType) {
        toast({
          title: "Missing information",
          description: "Premium amount and policy type are required for Won stage",
          variant: "destructive",
        });
        return; // Don't close modal
      }
    }

    // Save all changes together
    try {
      setSaving(true);

      const updates: any = {
        notes,
        pipeline_stage: pipelineStage, // Always include pipeline_stage
        premium_amount: premiumAmount ? parseFloat(premiumAmount) : null,
        policy_type: policyType || null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('client_leads')
        .update(updates)
        .eq('id', lead.id);

      if (error) throw error;

      if (stageChanged) {
        toast({
          title: "Lead updated",
          description: `Moved to ${PIPELINE_STAGES.find(s => s.key === pipelineStage)?.label}`,
        });
      }

      onUpdate(); // Refresh the kanban board
      onClose();
    } catch (error) {
      console.error('Error saving lead:', error);
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Failed to save changes",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-dashboard-darkBlue via-dashboard-mediumBlue to-dashboard-darkBlue border-white/20">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-white">
            {lead.first_name} {lead.last_name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Pipeline Stage Selector */}
          <div className="space-y-3">
            <h3 className="text-white/90 font-semibold">Pipeline Stage</h3>
            <Select value={pipelineStage} onValueChange={setPipelineStage}>
              <SelectTrigger className="bg-white/10 border-white/20 text-white">
                <SelectValue placeholder="Select stage" />
              </SelectTrigger>
              <SelectContent>
                {PIPELINE_STAGES.map((stage) => (
                  <SelectItem key={stage.key} value={stage.key}>
                    {stage.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Contact Information */}
          <div className="space-y-3">
            <h3 className="text-white/90 font-semibold flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Contact Information
            </h3>
            <div className="bg-white/5 rounded-lg p-4 space-y-2">
              {lead.lead_email && (
                <div className="flex items-center gap-2 text-white/70">
                  <Mail className="w-4 h-4 text-white/50" />
                  <a href={`mailto:${lead.lead_email}`} className="hover:text-dashboard-accent">
                    {lead.lead_email}
                  </a>
                </div>
              )}
              {lead.phone && (
                <div className="flex items-center gap-2 text-white/70">
                  <Phone className="w-4 h-4 text-white/50" />
                  <a href={`tel:${lead.phone}`} className="hover:text-dashboard-accent">
                    {lead.phone}
                  </a>
                </div>
              )}
              {(lead.address || lead.city || lead.state || lead.zip) && (
                <div className="flex items-start gap-2 text-white/70">
                  <MapPin className="w-4 h-4 text-white/50 mt-1" />
                  <div>
                    {lead.address && <div>{lead.address}</div>}
                    {(lead.city || lead.state || lead.zip) && (
                      <div>
                        {lead.city}{lead.city && (lead.state || lead.zip) && ', '}
                        {lead.state} {lead.zip}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Professional Information */}
          {(lead.title || lead.company) && (
            <div className="space-y-3">
              <h3 className="text-white/90 font-semibold flex items-center gap-2">
                <Building className="w-4 h-4" />
                Professional Information
              </h3>
              <div className="bg-white/5 rounded-lg p-4 space-y-2">
                {lead.title && (
                  <div className="text-blue-300 font-medium">{lead.title}</div>
                )}
                {lead.company && (
                  <div className="text-white/70">{lead.company}</div>
                )}
              </div>
            </div>
          )}

          {/* Important Dates */}
          {(lead.renewal_date || lead.birthday || lead.date_received) && (
            <div className="space-y-3">
              <h3 className="text-white/90 font-semibold flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Important Dates
              </h3>
              <div className="bg-white/5 rounded-lg p-4 space-y-2">
                {lead.renewal_date && (
                  <div className="flex justify-between items-center">
                    <span className="text-white/50">Renewal Date:</span>
                    <span className="text-white/90 font-medium">{lead.renewal_date}</span>
                  </div>
                )}
                {lead.birthday && (
                  <div className="flex justify-between items-center">
                    <span className="text-white/50">Birthday:</span>
                    <span className="text-white/90">{lead.birthday}</span>
                  </div>
                )}
                {lead.date_received && (
                  <div className="flex justify-between items-center">
                    <span className="text-white/50">Date Received:</span>
                    <span className="text-white/90">{new Date(lead.date_received).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tags */}
          {lead.tags && lead.tags.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-white/90 font-semibold">Tags</h3>
              <div className="flex gap-2 flex-wrap">
                {lead.tags.map((tag) => (
                  <Badge key={tag.id} variant="outline" className="bg-purple-500/20 text-purple-300 border-purple-500/40">
                    {tag.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Custom Variables */}
          {lead.custom_variables && lead.custom_variables.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-white/90 font-semibold">Additional Information</h3>
              <div className="bg-white/5 rounded-lg p-4 space-y-2">
                {lead.custom_variables.map((cv, idx) => (
                  <div key={idx} className="flex justify-between items-center">
                    <span className="text-white/50">{cv.name}:</span>
                    <span className="text-white/90">{cv.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Premium Information */}
          <div className="space-y-3">
            <h3 className="text-white/90 font-semibold flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Deal Information
            </h3>
            <div className={`border rounded-lg p-4 space-y-4 ${
              pipelineStage === 'won'
                ? 'bg-green-500/10 border-green-500/30'
                : 'bg-white/5 border-white/10'
            }`}>
              <div className="space-y-2">
                <Label htmlFor="premiumAmount" className="text-white/90">
                  Total Premium Amount {pipelineStage === 'won' && '*'}
                </Label>
                <Input
                  id="premiumAmount"
                  type="number"
                  step="0.01"
                  placeholder="Enter premium amount"
                  value={premiumAmount}
                  onChange={(e) => setPremiumAmount(e.target.value)}
                  className="bg-white/10 border-white/20 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="policyType" className="text-white/90">
                  Policy Type {pipelineStage === 'won' && '*'}
                </Label>
                <Input
                  id="policyType"
                  type="text"
                  placeholder="e.g., Home Insurance, Auto, Life"
                  value={policyType}
                  onChange={(e) => setPolicyType(e.target.value)}
                  className="bg-white/10 border-white/20 text-white"
                />
              </div>
              {pipelineStage === 'won' && (
                <div className="text-white/60 text-sm">
                  * Required fields for won deals
                </div>
              )}
            </div>
          </div>

          {/* Notes Section */}
          <div className="space-y-3">
            <h3 className="text-white/90 font-semibold">Notes</h3>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes about this lead..."
              className="min-h-[120px] bg-white/10 border-white/20 text-white placeholder:text-white/40 resize-y"
            />
          </div>

          {/* Bison Conversation Link */}
          {lead.bison_conversation_url && (
            <div>
              <a
                href={lead.bison_conversation_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-dashboard-accent hover:text-dashboard-accent/80"
              >
                <ExternalLink className="w-4 h-4" />
                View in Email Bison
              </a>
            </div>
          )}

          {/* Close Button */}
          <div className="flex gap-3 justify-end items-center pt-4">
            <Button
              onClick={handleClose}
              disabled={saving}
              className="bg-dashboard-accent hover:bg-dashboard-accent/90 text-white"
            >
              {saving ? 'Saving...' : 'Close'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
