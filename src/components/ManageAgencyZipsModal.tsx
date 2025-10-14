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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { getStateFromZip } from "@/utils/zipStateMapping";
import { Trash2, Plus, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ManageAgencyZipsModalProps {
  open: boolean;
  onClose: () => void;
  clientName: string;
  workspaceName: string;
  onZipsUpdated: () => void;
}

type ZipEntry = {
  zip: string;
  state: string | null;
};

const ACTIVE_MONTH = 'active';

export default function ManageAgencyZipsModal({
  open,
  onClose,
  clientName,
  workspaceName,
  onZipsUpdated,
}: ManageAgencyZipsModalProps) {
  const [zips, setZips] = useState<ZipEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [zipInput, setZipInput] = useState("");
  const [searchFilter, setSearchFilter] = useState("");
  const { toast } = useToast();

  // Load ZIPs for this agency
  useEffect(() => {
    if (open) {
      loadZips();
      setZipInput("");
      setSearchFilter("");
    }
  }, [open, workspaceName]);

  async function loadZips() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("client_zipcodes")
        .select("zip, state")
        .eq("workspace_name", workspaceName)
        .eq("month", ACTIVE_MONTH)
        .order("zip", { ascending: true });

      if (error) throw error;

      setZips((data as ZipEntry[]) || []);
    } catch (error: any) {
      console.error("[ManageZIPs] Error loading ZIPs:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to load ZIPs",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  // Parse ZIP codes from input (comma, newline, space separated)
  const parseZipCodes = (input: string): string[] => {
    return input
      .split(/[\n,\s]+/)
      .map((zip) => zip.trim())
      .filter((zip) => zip.length === 5 && /^\d+$/.test(zip));
  };

  const parsedNewZips = parseZipCodes(zipInput);

  // Add new ZIPs
  async function handleAddZips() {
    if (parsedNewZips.length === 0) {
      toast({
        title: "No Valid ZIPs",
        description: "Please enter valid 5-digit ZIP codes",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      console.log(`[ManageZIPs] Adding ${parsedNewZips.length} ZIPs to ${clientName}`);

      // Get agency color from client_registry
      const { data: clientData } = await supabase
        .from('client_registry')
        .select('agency_color')
        .eq('workspace_name', workspaceName)
        .single();

      const agencyColor = clientData?.agency_color || '#3B82F6';

      // Prepare ZIP entries
      const zipEntries = parsedNewZips.map(zip => ({
        zip: zip,
        month: ACTIVE_MONTH,
        client_name: clientName,
        workspace_name: workspaceName,
        agency_color: agencyColor,
        state: getStateFromZip(zip),
        source: 'manual',
        pulled_at: new Date().toISOString(),
        inserted_at: new Date().toISOString(),
      }));

      // Check for duplicates (ZIPs already assigned to ANY agency)
      const { data: existingZips, error: checkError } = await supabase
        .from("client_zipcodes")
        .select("zip, client_name")
        .eq("month", ACTIVE_MONTH)
        .in("zip", parsedNewZips);

      if (checkError) throw checkError;

      if (existingZips && existingZips.length > 0) {
        const duplicates = existingZips.map(z => `${z.zip} (assigned to ${z.client_name})`).join(", ");
        toast({
          title: "Duplicate ZIPs Found",
          description: `The following ZIPs are already assigned: ${duplicates}. Please remove them first.`,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Insert new entries
      const { error } = await supabase
        .from("client_zipcodes")
        .insert(zipEntries);

      if (error) throw error;

      console.log(`[ManageZIPs] ✓ Successfully added ${parsedNewZips.length} ZIPs`);

      toast({
        title: "Success",
        description: `Added ${parsedNewZips.length} ZIP${parsedNewZips.length !== 1 ? 's' : ''} to ${clientName}`,
      });

      setZipInput("");
      await loadZips();
      onZipsUpdated();
    } catch (error: any) {
      console.error("[ManageZIPs] Error adding ZIPs:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to add ZIPs",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  // Delete a single ZIP
  async function handleDeleteZip(zip: string) {
    setLoading(true);
    try {
      console.log(`[ManageZIPs] Deleting ZIP ${zip} from ${clientName}`);

      const { error } = await supabase
        .from("client_zipcodes")
        .delete()
        .eq("zip", zip)
        .eq("workspace_name", workspaceName)
        .eq("month", ACTIVE_MONTH);

      if (error) throw error;

      console.log(`[ManageZIPs] ✓ Successfully deleted ZIP ${zip}`);

      toast({
        title: "Success",
        description: `Removed ZIP ${zip} from ${clientName}`,
      });

      await loadZips();
      onZipsUpdated();
    } catch (error: any) {
      console.error("[ManageZIPs] Error deleting ZIP:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete ZIP",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  // Filter ZIPs by search
  const filteredZips = zips.filter((z) => {
    if (!searchFilter) return true;
    return z.zip.includes(searchFilter) || z.state?.toLowerCase().includes(searchFilter.toLowerCase());
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Manage ZIPs for {clientName}
          </DialogTitle>
          <DialogDescription>
            Add or remove ZIP codes for this agency. ZIPs in the staging area can be committed to specific months.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-4 py-4">
          {/* Add ZIPs Section */}
          <div className="space-y-2 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <Label htmlFor="zip-input" className="flex items-center gap-2 font-semibold">
              <Plus className="h-4 w-4" />
              Add New ZIPs
            </Label>
            <Textarea
              id="zip-input"
              placeholder="Enter ZIP codes (e.g., 90210, 10001, 60601)&#10;or one per line:&#10;90210&#10;10001&#10;60601"
              value={zipInput}
              onChange={(e) => setZipInput(e.target.value)}
              rows={4}
              className="font-mono"
            />
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {parsedNewZips.length > 0 ? (
                  <span className="text-green-600 dark:text-green-400 font-semibold">
                    {parsedNewZips.length} valid ZIP code{parsedNewZips.length !== 1 ? "s" : ""} ready to add
                  </span>
                ) : (
                  "No valid ZIP codes entered yet"
                )}
              </p>
              <Button
                onClick={handleAddZips}
                disabled={parsedNewZips.length === 0 || loading}
                size="sm"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add {parsedNewZips.length} ZIP{parsedNewZips.length !== 1 ? "s" : ""}
              </Button>
            </div>
          </div>

          {/* Current ZIPs List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="font-semibold">
                Current ZIPs ({filteredZips.length} {searchFilter && `of ${zips.length}`})
              </Label>
              <Input
                type="text"
                placeholder="Search ZIPs or states..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-64"
              />
            </div>

            {loading && <p className="text-sm text-muted-foreground">Loading...</p>}

            {!loading && zips.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <MapPin className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No ZIPs assigned to this agency yet</p>
                <p className="text-sm">Add ZIPs using the form above</p>
              </div>
            )}

            {!loading && zips.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <div className="max-h-[400px] overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted sticky top-0">
                      <tr className="text-left border-b">
                        <th className="py-2 px-4 font-medium">ZIP Code</th>
                        <th className="py-2 px-4 font-medium">State</th>
                        <th className="py-2 px-4 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredZips.map((zipEntry) => (
                        <tr key={zipEntry.zip} className="border-b hover:bg-muted/50">
                          <td className="py-2 px-4 font-mono font-semibold">{zipEntry.zip}</td>
                          <td className="py-2 px-4">{zipEntry.state || "Unknown"}</td>
                          <td className="py-2 px-4 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteZip(zipEntry.zip)}
                              disabled={loading}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                      {filteredZips.length === 0 && searchFilter && (
                        <tr>
                          <td colSpan={3} className="py-8 text-center text-muted-foreground">
                            No ZIPs match your search
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
