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

type AddAgencyModalProps = {
  open: boolean;
  onClose: () => void;
  onAddAgency: (clientName: string, workspaceName: string, color: string) => Promise<void>;
};

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

export default function AddAgencyModal({
  open,
  onClose,
  onAddAgency,
}: AddAgencyModalProps) {
  const [clientName, setClientName] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0]);
  const [loading, setLoading] = useState(false);

  const handleAdd = async () => {
    if (!clientName.trim()) return;

    setLoading(true);
    try {
      await onAddAgency(
        clientName.trim(),
        workspaceName.trim() || clientName.trim(),
        selectedColor
      );
      onClose();
      // Reset form
      setClientName("");
      setWorkspaceName("");
      setSelectedColor(PRESET_COLORS[0]);
    } catch (error) {
      console.error("Failed to add agency:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Agency</DialogTitle>
          <DialogDescription>
            Create a new agency that can be assigned to ZIP codes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="client-name">Agency Name *</Label>
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
              placeholder="Leave blank to use agency name"
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Agency Color</Label>
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleAdd} disabled={!clientName.trim() || loading}>
            {loading ? "Adding..." : "Add Agency"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
