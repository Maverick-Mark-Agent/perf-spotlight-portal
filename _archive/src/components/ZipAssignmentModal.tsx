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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Agency = {
  client_name: string;
  workspace_name: string | null;
  agency_color: string | null;
};

type ZipAssignmentModalProps = {
  open: boolean;
  onClose: () => void;
  onAssign: (clientName: string, color: string) => Promise<void>;
  agencies: Agency[];
  zipCode: string | null;
  currentAgency?: string | null;
};

export default function ZipAssignmentModal({
  open,
  onClose,
  onAssign,
  agencies,
  zipCode,
  currentAgency,
}: ZipAssignmentModalProps) {
  const [selectedAgency, setSelectedAgency] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const handleAssign = async () => {
    if (!selectedAgency) return;

    setLoading(true);
    try {
      const agency = agencies.find((a) => a.client_name === selectedAgency);
      const color = agency?.agency_color || "#3B82F6"; // Default blue if no color
      await onAssign(selectedAgency, color);
      onClose();
      setSelectedAgency("");
    } catch (error) {
      console.error("Failed to assign ZIP:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign ZIP Code</DialogTitle>
          <DialogDescription>
            {zipCode && (
              <>
                Assign ZIP code <strong>{zipCode}</strong> to an agency.
                {currentAgency && (
                  <>
                    {" "}
                    Currently assigned to: <strong>{currentAgency}</strong>
                  </>
                )}
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="agency">Select Agency</Label>
            <Select value={selectedAgency} onValueChange={setSelectedAgency}>
              <SelectTrigger id="agency">
                <SelectValue placeholder="Choose an agency..." />
              </SelectTrigger>
              <SelectContent>
                {agencies.map((agency) => (
                  <SelectItem
                    key={agency.client_name}
                    value={agency.client_name}
                  >
                    <div className="flex items-center gap-2">
                      {agency.agency_color && (
                        <div
                          className="w-3 h-3 rounded-sm border border-gray-300"
                          style={{ backgroundColor: agency.agency_color }}
                        />
                      )}
                      <span>{agency.client_name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleAssign} disabled={!selectedAgency || loading}>
            {loading ? "Assigning..." : "Assign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
