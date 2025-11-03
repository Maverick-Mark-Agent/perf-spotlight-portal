import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, X } from "lucide-react";

interface AddContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  workspaceName: string;
}

interface CustomVariable {
  name: string;
  value: string;
}

export const AddContactModal = ({ isOpen, onClose, onSuccess, workspaceName }: AddContactModalProps) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  // Required fields
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  // Optional contact fields
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");

  // Insurance-specific fields
  const [renewalDate, setRenewalDate] = useState("");
  const [birthday, setBirthday] = useState("");

  // Notes
  const [notes, setNotes] = useState("");

  // Custom variables (dynamic fields)
  const [customVariables, setCustomVariables] = useState<CustomVariable[]>([]);

  const resetForm = () => {
    setEmail("");
    setFirstName("");
    setLastName("");
    setPhone("");
    setAddress("");
    setCity("");
    setState("");
    setZip("");
    setRenewalDate("");
    setBirthday("");
    setNotes("");
    setCustomVariables([]);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!email.trim() || !firstName.trim() || !lastName.trim()) {
      toast({
        title: "Missing required fields",
        description: "Email, First Name, and Last Name are required",
        variant: "destructive",
      });
      return;
    }

    if (!validateEmail(email)) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);

      // Import supabase dynamically to avoid circular dependencies
      const { supabase } = await import("@/integrations/supabase/client");

      // Check for duplicate email in this workspace
      const { data: existingLead, error: checkError } = await supabase
        .from('client_leads')
        .select('id, lead_email')
        .eq('workspace_name', workspaceName)
        .eq('lead_email', email.toLowerCase().trim())
        .maybeSingle();

      if (checkError) {
        console.error('Error checking for duplicate:', checkError);
        throw checkError;
      }

      if (existingLead) {
        toast({
          title: "Duplicate contact",
          description: `${email} already exists in ${workspaceName}`,
          variant: "destructive",
        });
        return;
      }

      // Filter out empty custom variables
      const filteredCustomVariables = customVariables
        .filter(cv => cv.name.trim() && cv.value.trim())
        .map(cv => ({ name: cv.name.trim(), value: cv.value.trim() }));

      // Prepare lead data
      const leadData = {
        workspace_name: workspaceName,
        lead_email: email.toLowerCase().trim(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone.trim() || null,
        address: address.trim() || null,
        city: city.trim() || null,
        state: state.trim() || null,
        zip: zip.trim() || null,
        renewal_date: renewalDate.trim() || null,
        birthday: birthday.trim() || null,
        notes: notes.trim() || null,
        custom_variables: filteredCustomVariables.length > 0 ? filteredCustomVariables : null,
        pipeline_stage: 'interested',
        interested: true,
        date_received: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_synced_at: new Date().toISOString(),
        lead_value: 0,
        pipeline_position: 0,
        icp: false,
      };

      // Insert into database
      const { error: insertError } = await supabase
        .from('client_leads')
        .insert([leadData]);

      if (insertError) {
        console.error('Error inserting lead:', insertError);
        throw insertError;
      }

      toast({
        title: "Contact added successfully!",
        description: `${firstName} ${lastName} has been added to the Interested column`,
      });

      resetForm();
      onSuccess(); // Refresh the leads list
      onClose();
    } catch (error) {
      console.error('Error adding contact:', error);
      toast({
        title: "Failed to add contact",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-dashboard-darkBlue via-dashboard-mediumBlue to-dashboard-darkBlue border-white/20">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-white">
            Add New Contact to {workspaceName}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Required Fields */}
          <div className="space-y-4">
            <h3 className="text-white/90 font-semibold text-sm uppercase tracking-wide">Required Information</h3>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-white/90">
                Email Address *
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="contact@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName" className="text-white/90">
                  First Name *
                </Label>
                <Input
                  id="firstName"
                  type="text"
                  placeholder="John"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName" className="text-white/90">
                  Last Name *
                </Label>
                <Input
                  id="lastName"
                  type="text"
                  placeholder="Doe"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                  required
                />
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="space-y-4">
            <h3 className="text-white/90 font-semibold text-sm uppercase tracking-wide">Contact Information</h3>

            <div className="space-y-2">
              <Label htmlFor="phone" className="text-white/90">
                Phone Number
              </Label>
              <Input
                id="phone"
                type="tel"
                placeholder="(555) 123-4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address" className="text-white/90">
                Street Address
              </Label>
              <Input
                id="address"
                type="text"
                placeholder="123 Main St"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
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
                  type="text"
                  placeholder="Austin"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="state" className="text-white/90">
                  State
                </Label>
                <Input
                  id="state"
                  type="text"
                  placeholder="TX"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                  maxLength={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="zip" className="text-white/90">
                  Zip Code
                </Label>
                <Input
                  id="zip"
                  type="text"
                  placeholder="78701"
                  value={zip}
                  onChange={(e) => setZip(e.target.value)}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                  maxLength={10}
                />
              </div>
            </div>
          </div>

          {/* Insurance-Specific Fields */}
          <div className="space-y-4">
            <h3 className="text-white/90 font-semibold text-sm uppercase tracking-wide">Insurance Information</h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="renewalDate" className="text-white/90">
                  Renewal Date
                </Label>
                <Input
                  id="renewalDate"
                  type="text"
                  placeholder="November 15th"
                  value={renewalDate}
                  onChange={(e) => setRenewalDate(e.target.value)}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="birthday" className="text-white/90">
                  Birthday
                </Label>
                <Input
                  id="birthday"
                  type="text"
                  placeholder="01/15/1980"
                  value={birthday}
                  onChange={(e) => setBirthday(e.target.value)}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                />
              </div>
            </div>
          </div>

          {/* Custom Variables */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-white/90 font-semibold text-sm uppercase tracking-wide">Additional Fields</h3>
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
            </div>

            {customVariables.length > 0 && (
              <div className="space-y-3">
                {customVariables.map((cv, index) => (
                  <div key={index} className="flex gap-2 items-start">
                    <Input
                      type="text"
                      placeholder="Field name (e.g., Home Value)"
                      value={cv.name}
                      onChange={(e) => updateCustomVariable(index, 'name', e.target.value)}
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/40 flex-1"
                    />
                    <Input
                      type="text"
                      placeholder="Value"
                      value={cv.value}
                      onChange={(e) => updateCustomVariable(index, 'value', e.target.value)}
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/40 flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeCustomVariable(index)}
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/20"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes" className="text-white/90">
              Notes
            </Label>
            <Textarea
              id="notes"
              placeholder="Add any additional notes about this contact..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[100px] bg-white/10 border-white/20 text-white placeholder:text-white/40 resize-y"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end items-center pt-4 border-t border-white/10">
            <Button
              type="button"
              variant="ghost"
              onClick={handleClose}
              disabled={saving}
              className="text-white hover:bg-white/10"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="bg-dashboard-accent hover:bg-dashboard-accent/90 text-white"
            >
              {saving ? 'Adding Contact...' : 'Add Contact'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
