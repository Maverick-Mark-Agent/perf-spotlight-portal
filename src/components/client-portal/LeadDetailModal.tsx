import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
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
import { Calendar, Mail, Phone, MapPin, Building, ExternalLink, DollarSign, Edit2, X, Plus, User, Trash2, RotateCcw, AlertTriangle } from "lucide-react";
import { SMAPoliciesList } from "@/components/sma/SMAPoliciesList";
import { useWorkspaceProducers, Producer } from "@/hooks/useWorkspaceProducers";

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
  // Producer assignment fields
  assigned_to_user_id: string | null;
  assigned_to_name: string | null;
  assigned_at: string | null;
  assigned_by_user_id: string | null;
  // Soft-delete fields
  deleted_at: string | null;
  deleted_by_user_id: string | null;
  deletion_reason: string | null;
}

interface LeadDetailModalProps {
  lead: ClientLead | null;
  isOpen: boolean;
  onClose: (shouldRefresh?: boolean) => void;
  onUpdate: () => void;
  onOptimisticUpdate?: (leadId: string, updates: Partial<ClientLead>) => void;
  onDelete?: (leadId: string) => Promise<void>;
}

export const LeadDetailModal = ({ lead, isOpen, onClose, onUpdate, onOptimisticUpdate, onDelete }: LeadDetailModalProps) => {
  const { toast } = useToast();
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fullEditMade, setFullEditMade] = useState(false);

  // Editable fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [renewalDate, setRenewalDate] = useState("");
  const [birthday, setBirthday] = useState("");
  const [notes, setNotes] = useState("");
  const [premiumAmount, setPremiumAmount] = useState("");
  const [policyType, setPolicyType] = useState("");
  const [pipelineStage, setPipelineStage] = useState("");
  const [customVariables, setCustomVariables] = useState<Array<{name: string; value: string}>>([]);
  const [assignedToUserId, setAssignedToUserId] = useState<string>("");
  const [assignedToName, setAssignedToName] = useState<string>("");
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch producers for the workspace
  const { producers, loading: producersLoading } = useWorkspaceProducers(lead?.workspace_name || null);

  useEffect(() => {
    if (lead) {
      setFirstName(lead.first_name || "");
      setLastName(lead.last_name || "");
      setEmail(lead.lead_email || "");
      setPhone(lead.phone || "");
      setAddress(lead.address || "");
      setCity(lead.city || "");
      setState(lead.state || "");
      setZip(lead.zip || "");
      setTitle(lead.title || "");
      setCompany(lead.company || "");
      setRenewalDate(lead.renewal_date || "");
      setBirthday(lead.birthday || "");
      setNotes(lead.notes || "");
      setPremiumAmount(lead.premium_amount?.toString() || "");
      setPolicyType(lead.policy_type || "");
      setPipelineStage(lead.pipeline_stage || "new");
      // Filter out null/empty custom variables on load to prevent null.trim() errors
      const validCustomVariables = (lead.custom_variables || [])
        .filter(cv => cv && cv.name && cv.value)
        .map(cv => ({ name: cv.name, value: cv.value }));
      setCustomVariables(validCustomVariables);
      setAssignedToUserId(lead.assigned_to_user_id || "");
      setAssignedToName(lead.assigned_to_name || "");
      setEditMode(false); // Reset edit mode when lead changes
      setFullEditMade(false); // Reset full edit flag when lead changes
    }
  }, [lead]);

  if (!lead) return null;

  const addCustomVariable = () => {
    setCustomVariables([...customVariables, { name: "", value: "" }]);
  };

  const removeCustomVariable = (index: number) => {
    setCustomVariables(customVariables.filter((_, i) => i !== index));
  };

  const updateCustomVariable = (index: number, field: 'name' | 'value', value: string) => {
    const updated = [...customVariables];
    updated[index][field] = value;
    setCustomVariables(updated);
  };

  // Quick save for pipeline stage and notes (without requiring Edit mode)
  const handleQuickSave = async (field: 'pipeline_stage' | 'notes', value: string) => {
    if (!lead) return;

    try {
      const updates: any = {
        [field]: value?.trim() || null,
        updated_at: new Date().toISOString(),
      };

      // Optimistic update - update UI immediately for instant feedback
      if (onOptimisticUpdate) {
        onOptimisticUpdate(lead.id, updates);
      }

      // Save to database in background
      const { error } = await supabase
        .from('client_leads')
        .update(updates)
        .eq('id', lead.id);

      if (error) throw error;

      toast({
        title: "Updated",
        description: field === 'pipeline_stage' ? "Pipeline stage updated" : "Notes saved",
      });

      // No need to call onUpdate() - optimistic update already handled it!
      // Full refresh will happen when modal closes
    } catch (error) {
      console.error('Error in quick save:', error);
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Failed to save changes",
        variant: "destructive",
      });
      // If save failed, refresh to revert optimistic update
      onUpdate();
    }
  };

  // Quick save for producer assignment
  const handleProducerAssignment = async (producerId: string) => {
    if (!lead) return;

    try {
      // Find the selected producer
      const selectedProducer = producers.find(p => p.user_id === producerId);
      const producerName = selectedProducer?.full_name || null;

      // Get current user for assignment tracking
      const { data: { session } } = await supabase.auth.getSession();
      const currentUserId = session?.user?.id || null;

      const updates: any = {
        assigned_to_user_id: producerId || null,
        assigned_to_name: producerName,
        assigned_at: producerId ? new Date().toISOString() : null,
        assigned_by_user_id: producerId ? currentUserId : null,
        updated_at: new Date().toISOString(),
      };

      // Update local state immediately
      setAssignedToUserId(producerId);
      setAssignedToName(producerName || "");

      // Optimistic update - update UI immediately for instant feedback
      if (onOptimisticUpdate) {
        onOptimisticUpdate(lead.id, updates);
      }

      // Save to database in background
      const { error } = await supabase
        .from('client_leads')
        .update(updates)
        .eq('id', lead.id);

      if (error) throw error;

      toast({
        title: "Producer assigned",
        description: producerName ? `Lead assigned to ${producerName}` : "Assignment removed",
      });
    } catch (error) {
      console.error('Error assigning producer:', error);
      toast({
        title: "Assignment failed",
        description: error instanceof Error ? error.message : "Failed to assign producer",
        variant: "destructive",
      });
      // If save failed, refresh to revert optimistic update
      onUpdate();
    }
  };

  const handleSave = async () => {
    if (!lead) return;

    // Validate required fields
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      toast({
        title: "Missing required fields",
        description: "First Name, Last Name, and Email are required",
        variant: "destructive",
      });
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    // Validate Won stage requirements
    if (pipelineStage === 'won' && lead.workspace_name !== "SMA Insurance") {
      if (!premiumAmount || !policyType) {
        toast({
          title: "Missing information",
          description: "Premium amount and policy type are required for Won stage",
          variant: "destructive",
        });
        return;
      }
    }

    try {
      setSaving(true);

      // Filter out empty custom variables with null safety
      const filteredCustomVariables = customVariables
        .filter(cv => cv?.name?.trim() && cv?.value?.trim())
        .map(cv => ({ name: cv.name.trim(), value: cv.value.trim() }));

      const updates: any = {
        first_name: firstName?.trim() || null,
        last_name: lastName?.trim() || null,
        lead_email: email?.toLowerCase()?.trim() || null,
        phone: phone?.trim() || null,
        address: address?.trim() || null,
        city: city?.trim() || null,
        state: state?.trim() || null,
        zip: zip?.trim() || null,
        title: title?.trim() || null,
        company: company?.trim() || null,
        renewal_date: renewalDate?.trim() || null,
        birthday: birthday?.trim() || null,
        notes: notes?.trim() || null,
        pipeline_stage: pipelineStage,
        premium_amount: premiumAmount ? parseFloat(premiumAmount) : null,
        policy_type: policyType?.trim() || null,
        custom_variables: filteredCustomVariables.length > 0 ? filteredCustomVariables : null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('client_leads')
        .update(updates)
        .eq('id', lead.id);

      if (error) throw error;

      toast({
        title: "Lead updated",
        description: `${firstName} ${lastName} has been updated successfully`,
      });

      setEditMode(false);
      setFullEditMade(true); // Mark that a full edit was made
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

  const handleClose = () => {
    if (editMode) {
      // If in edit mode, ask for confirmation if there are unsaved changes
      const hasChanges =
        firstName !== (lead.first_name || "") ||
        lastName !== (lead.last_name || "") ||
        email !== (lead.lead_email || "") ||
        phone !== (lead.phone || "") ||
        address !== (lead.address || "") ||
        city !== (lead.city || "") ||
        state !== (lead.state || "") ||
        zip !== (lead.zip || "") ||
        title !== (lead.title || "") ||
        company !== (lead.company || "") ||
        renewalDate !== (lead.renewal_date || "") ||
        birthday !== (lead.birthday || "") ||
        notes !== (lead.notes || "") ||
        pipelineStage !== (lead.pipeline_stage || "new") ||
        premiumAmount !== (lead.premium_amount?.toString() || "") ||
        policyType !== (lead.policy_type || "");

      if (hasChanges && !window.confirm("You have unsaved changes. Are you sure you want to close?")) {
        return;
      }
      setEditMode(false);
    }
    // Pass fullEditMade flag to parent so it knows whether to refresh
    onClose(fullEditMade);
  };

  const handleDelete = async () => {
    if (!lead || !onDelete) return;

    const confirmDelete = window.confirm(
      `Are you sure you want to delete ${lead.first_name} ${lead.last_name}?\n\nThis lead will be moved to deleted leads and can be restored later.`
    );

    if (!confirmDelete) return;

    try {
      setIsDeleting(true);
      await onDelete(lead.id);
      toast({
        title: "Lead deleted",
        description: `${lead.first_name} ${lead.last_name} has been deleted and can be restored from Deleted Leads.`,
      });
      onClose(true); // Close and trigger refresh
    } catch (error) {
      console.error('Error deleting lead:', error);
      toast({
        title: "Delete failed",
        description: error instanceof Error ? error.message : "Failed to delete lead",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-dashboard-darkBlue via-dashboard-mediumBlue to-dashboard-darkBlue border-white/20">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl font-bold text-white">
              {editMode ? "Edit Contact" : `${lead.first_name} ${lead.last_name}`}
            </DialogTitle>
            {!editMode && (
              <Button
                onClick={() => setEditMode(true)}
                variant="outline"
                size="sm"
                className="border-dashboard-accent text-dashboard-accent hover:bg-dashboard-accent hover:text-white"
              >
                <Edit2 className="w-4 h-4 mr-2" />
                Edit
              </Button>
            )}
          </div>
          <DialogDescription className="text-white/60">
            {editMode
              ? "Update contact information and details"
              : "View contact details. Pipeline stage and notes can be updated directly."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Name Fields - Editable in edit mode */}
          {editMode && (
            <div className="space-y-4 bg-white/5 rounded-lg p-4 border border-dashboard-accent/30">
              <h3 className="text-white/90 font-semibold text-sm uppercase tracking-wide">Basic Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName" className="text-white/90">
                    First Name *
                  </Label>
                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="bg-white/10 border-white/20 text-white"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName" className="text-white/90">
                    Last Name *
                  </Label>
                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="bg-white/10 border-white/20 text-white"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-white/90">
                  Email Address *
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-white/10 border-white/20 text-white"
                  required
                />
              </div>
            </div>
          )}

          {/* Pipeline Stage Selector - Always enabled for quick changes */}
          <div className="space-y-3">
            <h3 className="text-white/90 font-semibold">Pipeline Stage</h3>
            <Select
              value={pipelineStage}
              onValueChange={(value) => {
                setPipelineStage(value);
                handleQuickSave('pipeline_stage', value);
              }}
            >
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

          {/* Producer Assignment - Only show if producers are available */}
          {producers.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-white/90 font-semibold flex items-center gap-2">
                <User className="w-4 h-4" />
                Assigned Producer
              </h3>
              <Select
                value={assignedToUserId || "unassigned"}
                onValueChange={(value) => {
                  const producerId = value === "unassigned" ? "" : value;
                  handleProducerAssignment(producerId);
                }}
              >
                <SelectTrigger className="bg-white/10 border-white/20 text-white">
                  <SelectValue placeholder="Assign to producer..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {producers.map((producer) => (
                    <SelectItem key={producer.user_id} value={producer.user_id}>
                      {producer.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {assignedToName && (
                <p className="text-white/50 text-sm">
                  Currently assigned to: <span className="text-blue-300">{assignedToName}</span>
                </p>
              )}
            </div>
          )}

          {/* Contact Information */}
          <div className="space-y-3">
            <h3 className="text-white/90 font-semibold flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Contact Information
            </h3>
            {editMode ? (
              <div className="bg-white/5 rounded-lg p-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-white/90">
                    Phone Number
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(555) 123-4567"
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address" className="text-white/90">
                    Street Address
                  </Label>
                  <Input
                    id="address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="123 Main St"
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city" className="text-white/90">
                      City
                    </Label>
                    <Input
                      id="city"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Austin"
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state" className="text-white/90">
                      State
                    </Label>
                    <Input
                      id="state"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      placeholder="TX"
                      maxLength={2}
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="zip" className="text-white/90">
                      Zip Code
                    </Label>
                    <Input
                      id="zip"
                      value={zip}
                      onChange={(e) => setZip(e.target.value)}
                      placeholder="78701"
                      maxLength={10}
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                    />
                  </div>
                </div>
              </div>
            ) : (
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
            )}
          </div>

          {/* Professional Information */}
          {(editMode || lead.title || lead.company) && (
            <div className="space-y-3">
              <h3 className="text-white/90 font-semibold flex items-center gap-2">
                <Building className="w-4 h-4" />
                Professional Information
              </h3>
              {editMode ? (
                <div className="bg-white/5 rounded-lg p-4 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="title" className="text-white/90">
                      Job Title
                    </Label>
                    <Input
                      id="title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g., CEO, Manager"
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company" className="text-white/90">
                      Company
                    </Label>
                    <Input
                      id="company"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      placeholder="e.g., Acme Corp"
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                    />
                  </div>
                </div>
              ) : (
                <div className="bg-white/5 rounded-lg p-4 space-y-2">
                  {lead.title && (
                    <div className="text-blue-300 font-medium">{lead.title}</div>
                  )}
                  {lead.company && (
                    <div className="text-white/70">{lead.company}</div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Important Dates */}
          {(editMode || lead.renewal_date || lead.birthday || lead.date_received) && (
            <div className="space-y-3">
              <h3 className="text-white/90 font-semibold flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Important Dates
              </h3>
              {editMode ? (
                <div className="bg-white/5 rounded-lg p-4 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="renewalDate" className="text-white/90">
                      Renewal Date
                    </Label>
                    <Input
                      id="renewalDate"
                      value={renewalDate}
                      onChange={(e) => setRenewalDate(e.target.value)}
                      placeholder="November 15th"
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="birthday" className="text-white/90">
                      Birthday
                    </Label>
                    <Input
                      id="birthday"
                      value={birthday}
                      onChange={(e) => setBirthday(e.target.value)}
                      placeholder="01/15/1980"
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                    />
                  </div>
                  {lead.date_received && (
                    <div className="flex justify-between items-center text-white/50 text-sm">
                      <span>Date Received:</span>
                      <span>{new Date(lead.date_received).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              ) : (
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
              )}
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

          {/* Custom Variables - Only show if in edit mode or there are valid custom variables */}
          {(editMode || customVariables.length > 0) && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-white/90 font-semibold">Additional Information</h3>
                {editMode && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addCustomVariable}
                    className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Field
                  </Button>
                )}
              </div>
              {editMode ? (
                <div className="bg-white/5 rounded-lg p-4 space-y-3">
                  {customVariables.length > 0 ? (
                    customVariables.map((cv, idx) => (
                      <div key={idx} className="flex gap-2 items-start">
                        <Input
                          type="text"
                          placeholder="Field name"
                          value={cv.name}
                          onChange={(e) => updateCustomVariable(idx, 'name', e.target.value)}
                          className="bg-white/10 border-white/20 text-white placeholder:text-white/40 flex-1"
                        />
                        <Input
                          type="text"
                          placeholder="Value"
                          value={cv.value}
                          onChange={(e) => updateCustomVariable(idx, 'value', e.target.value)}
                          className="bg-white/10 border-white/20 text-white placeholder:text-white/40 flex-1"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeCustomVariable(idx)}
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/20"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))
                  ) : (
                    <div className="text-white/50 text-sm text-center py-4">
                      No custom fields. Click "Add Field" to add one.
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-white/5 rounded-lg p-4 space-y-2">
                  {customVariables.map((cv, idx) => (
                    <div key={idx} className="flex justify-between items-center">
                      <span className="text-white/50">{cv.name}:</span>
                      <span className="text-white/90">{cv.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SMA Insurance: Policies Section */}
          {lead.workspace_name === "SMA Insurance" && (
            <SMAPoliciesList
              leadId={lead.id}
              onPoliciesChange={onUpdate}
            />
          )}

          {/* Premium Information - Hide for SMA Insurance (they use policies instead) */}
          {lead.workspace_name !== "SMA Insurance" && (
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
                  Total Premium Amount {pipelineStage === 'won' && editMode && '*'}
                </Label>
                <Input
                  id="premiumAmount"
                  type="number"
                  step="0.01"
                  placeholder="Enter premium amount"
                  value={premiumAmount}
                  onChange={(e) => setPremiumAmount(e.target.value)}
                  className="bg-white/10 border-white/20 text-white"
                  disabled={!editMode}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="policyType" className="text-white/90">
                  Policy Type {pipelineStage === 'won' && editMode && '*'}
                </Label>
                <Input
                  id="policyType"
                  type="text"
                  placeholder="e.g., Home Insurance, Auto, Life"
                  value={policyType}
                  onChange={(e) => setPolicyType(e.target.value)}
                  className="bg-white/10 border-white/20 text-white"
                  disabled={!editMode}
                />
              </div>
              {pipelineStage === 'won' && editMode && (
                <div className="text-white/60 text-sm">
                  * Required fields for won deals
                </div>
              )}
            </div>
          </div>
          )}

          {/* Notes Section - Always enabled for quick updates */}
          <div className="space-y-3">
            <h3 className="text-white/90 font-semibold">Notes</h3>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => handleQuickSave('notes', notes)}
              placeholder="Add notes about this lead... (saves automatically)"
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

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end items-center pt-4 border-t border-white/10">
            {editMode ? (
              <>
                <Button
                  onClick={() => {
                    // Reset to original values
                    if (lead) {
                      setFirstName(lead.first_name || "");
                      setLastName(lead.last_name || "");
                      setEmail(lead.lead_email || "");
                      setPhone(lead.phone || "");
                      setAddress(lead.address || "");
                      setCity(lead.city || "");
                      setState(lead.state || "");
                      setZip(lead.zip || "");
                      setTitle(lead.title || "");
                      setCompany(lead.company || "");
                      setRenewalDate(lead.renewal_date || "");
                      setBirthday(lead.birthday || "");
                      setNotes(lead.notes || "");
                      setPremiumAmount(lead.premium_amount?.toString() || "");
                      setPolicyType(lead.policy_type || "");
                      setPipelineStage(lead.pipeline_stage || "new");
                      setCustomVariables(lead.custom_variables || []);
                    }
                    setEditMode(false);
                  }}
                  variant="ghost"
                  disabled={saving}
                  className="text-white hover:bg-white/10"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-dashboard-accent hover:bg-dashboard-accent/90 text-white"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </>
            ) : (
              <Button
                onClick={handleClose}
                className="bg-dashboard-accent hover:bg-dashboard-accent/90 text-white"
              >
                Close
              </Button>
            )}

            {/* Delete Button - Only visible for non-deleted leads */}
            {onDelete && !lead?.deleted_at && (
              <Button
                onClick={handleDelete}
                disabled={isDeleting}
                variant="destructive"
                className="ml-auto"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {isDeleting ? 'Deleting...' : 'Delete Lead'}
              </Button>
            )}

            {/* Deleted Indicator */}
            {lead?.deleted_at && (
              <div className="ml-auto flex items-center gap-2">
                <Badge variant="destructive" className="flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Lead Deleted
                </Badge>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};