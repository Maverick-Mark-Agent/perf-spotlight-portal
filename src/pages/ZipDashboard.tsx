import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import ZipVisualization, { type ZipData } from "@/components/ZipVisualization";
import ZipChoroplethLeaflet from "@/components/ZipChoroplethLeaflet";
import AgencyColorPicker from "@/components/AgencyColorPicker";
import CommitClientZipsModal from "@/components/CommitClientZipsModal";
import ManageAgencyZipsModal from "@/components/ManageAgencyZipsModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, Filter, MapPin, ArrowLeft, Calendar, Settings } from "lucide-react";
import { Link } from "react-router-dom";

type ZipRow = {
  zip: string;
  state: string | null;
  client_name: string;
  workspace_name: string | null;
  agency_color: string | null;
};

type AgencyStats = {
  client_name: string;
  workspace_name: string | null;
  agency_color: string | null;
  zipCount: number;
};

export default function ZipDashboard() {
  // Use 'active' as sentinel value for staging ZIPs (no month-based tracking in ZIP Dashboard)
  const ACTIVE_MONTH = 'active';

  const [zipData, setZipData] = useState<ZipData[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [agencyFilter, setAgencyFilter] = useState<string>("all");
  const [searchFilter, setSearchFilter] = useState<string>("");

  // Assignment modals
  const [manageZipsModalOpen, setManageZipsModalOpen] = useState(false);
  const [commitClientModalOpen, setCommitClientModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<{clientName: string, workspaceName: string, zipCount: number} | null>(null);

  useEffect(() => {
    loadZipData();
  }, []);

  async function loadZipData() {
    setLoading(true);
    setError(null);
    try {
      // Fetch all staging ZIPs (month='active') using pagination (handles 3000+ rows)
      let allData: ZipRow[] = [];
      let from = 0;
      const pageSize = 1000;

      while (true) {
        const { data, error: zipErr } = await supabase
          .from("client_zipcodes")
          .select("zip,state,client_name,workspace_name,agency_color")
          .eq("month", ACTIVE_MONTH)
          .range(from, from + pageSize - 1);

        if (zipErr) throw zipErr;

        if (!data || data.length === 0) break;

        allData = allData.concat(data as ZipRow[]);
        if (data.length < pageSize) break;
        from += pageSize;
      }

      setZipData(allData);
    } catch (e: any) {
      setError(e?.message || "Failed to load ZIP data");
    } finally {
      setLoading(false);
    }
  }

  // Calculate stats
  const stats = useMemo(() => {
    const agencies = new Map<string, AgencyStats>();
    let unassigned = 0;

    zipData.forEach((zip) => {
      if (!zip.agency_color) {
        unassigned++;
        return;
      }

      const key = zip.client_name;
      if (!agencies.has(key)) {
        agencies.set(key, {
          client_name: zip.client_name,
          workspace_name: zip.workspace_name,
          agency_color: zip.agency_color,
          zipCount: 0,
        });
      }
      agencies.get(key)!.zipCount++;
    });

    return {
      total: zipData.length,
      assigned: zipData.length - unassigned,
      unassigned,
      agencies: Array.from(agencies.values()).sort(
        (a, b) => b.zipCount - a.zipCount
      ),
    };
  }, [zipData]);

  // Get unique states and agencies for filters
  const uniqueStates = useMemo(() => {
    return Array.from(new Set(zipData.map((z) => z.state).filter(Boolean))).sort();
  }, [zipData]);

  const uniqueAgencies = useMemo(() => {
    return Array.from(
      new Set(zipData.map((z) => z.client_name).filter(Boolean))
    ).sort();
  }, [zipData]);

  // Filtered data
  const filteredZipData = useMemo(() => {
    return zipData.filter((zip) => {
      if (stateFilter !== "all" && zip.state !== stateFilter) return false;
      if (
        agencyFilter !== "all" &&
        zip.client_name !== agencyFilter
      )
        return false;
      if (
        searchFilter &&
        !zip.zip.includes(searchFilter) &&
        !zip.client_name.toLowerCase().includes(searchFilter.toLowerCase())
      )
        return false;
      return true;
    });
  }, [zipData, stateFilter, agencyFilter, searchFilter]);

  // Handle color change for agency
  async function handleColorChange(clientName: string, newColor: string) {
    try {
      const { error } = await (supabase as any)
        .from("client_zipcodes")
        .update({ agency_color: newColor })
        .eq("client_name", clientName)
        .eq("month", ACTIVE_MONTH);

      if (error) throw error;

      // Reload data
      await loadZipData();
    } catch (e: any) {
      console.error("Failed to update color:", e);
    }
  }

  // Export to CSV
  function exportToCSV() {
    const headers = ["ZIP", "State", "Agency", "Workspace", "Color"];
    const rows = filteredZipData.map((z) => [
      z.zip,
      z.state || "",
      z.client_name,
      z.workspace_name || "",
      z.agency_color || "",
    ]);

    const csv = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const timestamp = new Date().toISOString().split('T')[0];
    a.download = `zip-assignments-staging-${timestamp}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky Header */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b border-border shadow-lg">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                <Link to="/">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Portal
                </Link>
              </Button>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/20 rounded-lg">
                  <MapPin className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                    ZIP Code Dashboard
                  </h1>
                  <p className="text-sm text-muted-foreground">Territory Management & Analytics</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <p className="text-sm text-muted-foreground">Staging Area - Assign ZIPs to agencies and commit to months</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-card backdrop-blur-md rounded-xl border border-border p-6 hover:bg-accent/5 transition-all">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-primary/20 rounded-lg">
                <MapPin className="h-5 w-5 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground font-medium">Total ZIPs</p>
            </div>
            <p className="text-4xl font-bold">{stats.total.toLocaleString()}</p>
          </div>
          <div className="bg-card backdrop-blur-md rounded-xl border border-success/30 p-6 hover:bg-accent/5 transition-all">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-success/20 rounded-lg">
                <MapPin className="h-5 w-5 text-success" />
              </div>
              <p className="text-sm text-muted-foreground font-medium">Assigned</p>
            </div>
            <p className="text-4xl font-bold text-success">
              {stats.assigned.toLocaleString()}
            </p>
          </div>
          <div className="bg-card backdrop-blur-md rounded-xl border border-warning/30 p-6 hover:bg-accent/5 transition-all">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-warning/20 rounded-lg">
                <MapPin className="h-5 w-5 text-warning" />
              </div>
              <p className="text-sm text-muted-foreground font-medium">Unassigned</p>
            </div>
            <p className="text-4xl font-bold text-warning">
              {stats.unassigned.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 bg-card backdrop-blur-md rounded-xl border border-border p-4 mb-6">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search ZIP or agency..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-64"
          />
          <Select value={stateFilter} onValueChange={setStateFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All States" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All States</SelectItem>
              {uniqueStates.map((state) => (
                <SelectItem key={state} value={state!}>
                  {state}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={agencyFilter} onValueChange={setAgencyFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Agencies" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Agencies</SelectItem>
              {uniqueAgencies.map((agency) => (
                <SelectItem key={agency} value={agency}>
                  {agency}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex-1"></div>
          <Button onClick={exportToCSV} variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>

        {loading && <div className="text-sm text-muted-foreground">Loading...</div>}
        {error && <div className="text-sm text-destructive">Error: {error}</div>}

        {/* Choropleth Map */}
        {!loading && !error && filteredZipData.length > 0 && (
          <div className="mb-6">
            <ZipChoroplethLeaflet
              zipData={filteredZipData}
              loading={loading}
              onZipClick={() => {}} // Removed click-to-assign functionality
            />
          </div>
        )}

        {/* Main Content: Visualization and Table */}
        {!loading && !error && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* ZIP Visualization */}
            <div className="overflow-hidden">
              <ZipVisualization
                zipData={filteredZipData}
                onZipClick={() => {}} // Removed click-to-assign functionality
              />
            </div>

            {/* Agencies Table */}
            <div className="bg-card backdrop-blur-md rounded-xl border border-border overflow-hidden">
              <div className="p-4 border-b border-border">
                <h2 className="font-semibold">Agency Assignments</h2>
              </div>
              <div className="overflow-auto max-h-[600px]">
                <table className="w-full text-sm">
                  <thead className="bg-muted sticky top-0">
                    <tr className="text-left border-b border-border">
                      <th className="py-3 px-4 text-muted-foreground font-medium">Agency</th>
                      <th className="py-3 px-4 text-muted-foreground font-medium">ZIPs</th>
                      <th className="py-3 px-4 text-muted-foreground font-medium">Color</th>
                      <th className="py-3 px-4 text-muted-foreground font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.agencies.map((agency) => (
                      <tr key={agency.client_name} className="border-b border-border hover:bg-accent/50 transition-colors">
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-medium">{agency.client_name}</p>
                            {agency.workspace_name && (
                              <p className="text-xs text-muted-foreground">
                                {agency.workspace_name}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-semibold text-primary">
                          {agency.zipCount.toLocaleString()}
                        </td>
                        <td className="py-3 px-4">
                          <AgencyColorPicker
                            currentColor={agency.agency_color}
                            agencyName={agency.client_name}
                            onColorChange={(color) =>
                              handleColorChange(agency.client_name, color)
                            }
                          />
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedClient({
                                  clientName: agency.client_name,
                                  workspaceName: agency.workspace_name || agency.client_name,
                                  zipCount: agency.zipCount
                                });
                                setManageZipsModalOpen(true);
                              }}
                              className="text-xs"
                            >
                              <Settings className="h-3 w-3 mr-1" />
                              Manage ZIPs
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedClient({
                                  clientName: agency.client_name,
                                  workspaceName: agency.workspace_name || agency.client_name,
                                  zipCount: agency.zipCount
                                });
                                setCommitClientModalOpen(true);
                              }}
                              className="text-xs"
                            >
                              <Calendar className="h-3 w-3 mr-1" />
                              Commit
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {stats.agencies.length === 0 && (
                      <tr>
                        <td className="py-8 px-4 text-center text-muted-foreground" colSpan={4}>
                          No agencies with assigned ZIPs in staging area
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Manage Agency ZIPs Modal */}
      {selectedClient && (
        <ManageAgencyZipsModal
          open={manageZipsModalOpen}
          onClose={() => {
            setManageZipsModalOpen(false);
            setSelectedClient(null);
          }}
          clientName={selectedClient.clientName}
          workspaceName={selectedClient.workspaceName}
          onZipsUpdated={() => {
            loadZipData();
          }}
        />
      )}

      {/* Commit Client ZIPs to Month Modal */}
      {selectedClient && (
        <CommitClientZipsModal
          open={commitClientModalOpen}
          onClose={() => {
            setCommitClientModalOpen(false);
            setSelectedClient(null);
          }}
          currentMonth={ACTIVE_MONTH}
          clientName={selectedClient.clientName}
          workspaceName={selectedClient.workspaceName}
          zipCount={selectedClient.zipCount}
          onCommitComplete={() => {
            loadZipData();
          }}
        />
      )}
    </div>
  );
}

