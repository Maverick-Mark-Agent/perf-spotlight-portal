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
import { Textarea } from "@/components/ui/textarea";
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

type BulkZipAssignmentModalProps = {
  open: boolean;
  onClose: () => void;
  onBulkAssign: (zipCodes: string[], clientName: string, color: string) => Promise<void>;
  agencies: Agency[];
};

export default function BulkZipAssignmentModal({
  open,
  onClose,
  onBulkAssign,
  agencies,
}: BulkZipAssignmentModalProps) {
  const [selectedAgency, setSelectedAgency] = useState<string>("");
  const [zipInput, setZipInput] = useState("");
  const [loading, setLoading] = useState(false);

  const parseZipCodes = (input: string): string[] => {
    // Split by commas, newlines, or spaces, then clean up
    return input
      .split(/[\n,\s]+/)
      .map((zip) => zip.trim())
      .filter((zip) => zip.length === 5 && /^\d+$/.test(zip));
  };

  const zipCodes = parseZipCodes(zipInput);

  const handleBulkAssign = async () => {
    if (!selectedAgency || zipCodes.length === 0) return;

    setLoading(true);
    try {
      const agency = agencies.find((a) => a.client_name === selectedAgency);
      const color = agency?.agency_color || "#3B82F6";
      await onBulkAssign(zipCodes, selectedAgency, color);
      onClose();
      setSelectedAgency("");
      setZipInput("");
    } catch (error) {
      console.error("Failed to bulk assign ZIPs:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bulk Assign ZIP Codes</DialogTitle>
          <DialogDescription>
            Assign multiple ZIP codes to an agency at once. Enter ZIP codes separated by commas, spaces, or new lines.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="zip-input">ZIP Codes</Label>
            <Textarea
              id="zip-input"
              placeholder="Enter ZIP codes (e.g., 90210, 10001, 60601)&#10;or one per line:&#10;90210&#10;10001&#10;60601"
              value={zipInput}
              onChange={(e) => setZipInput(e.target.value)}
              rows={6}
              className="font-mono"
            />
            <p className="text-sm text-gray-500">
              {zipCodes.length > 0 ? (
                <span className="text-green-600 font-semibold">
                  {zipCodes.length} valid ZIP code{zipCodes.length !== 1 ? "s" : ""} detected
                </span>
              ) : (
                "No valid ZIP codes entered yet"
              )}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bulk-agency">Select Agency</Label>
            <Select value={selectedAgency} onValueChange={setSelectedAgency}>
              <SelectTrigger id="bulk-agency">
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
          <Button
            onClick={handleBulkAssign}
            disabled={!selectedAgency || zipCodes.length === 0 || loading}
          >
            {loading ? "Assigning..." : `Assign ${zipCodes.length} ZIP${zipCodes.length !== 1 ? "s" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
