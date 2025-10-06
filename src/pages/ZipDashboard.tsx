import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import ZipVisualization, { type ZipData } from "@/components/ZipVisualization";
import ZipChoroplethMap from "@/components/ZipChoroplethMap";
import ZipAssignmentModal from "@/components/ZipAssignmentModal";
import AgencyColorPicker from "@/components/AgencyColorPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, Filter, MapPin, ArrowLeft } from "lucide-react";
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
  const defaultMonth = useMemo(() => {
    return "2025-11"; // Match imported ZIP data
  }, []);

  const [month, setMonth] = useState<string>(defaultMonth);
  const [zipData, setZipData] = useState<ZipData[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [agencyFilter, setAgencyFilter] = useState<string>("all");
  const [searchFilter, setSearchFilter] = useState<string>("");

  // Assignment modal
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [selectedZip, setSelectedZip] = useState<string | null>(null);

  useEffect(() => {
    loadZipData();
  }, [month]);

  async function loadZipData() {
    setLoading(true);
    setError(null);
    try {
      // Fetch all rows using pagination (handles 3000+ rows)
      let allData: ZipRow[] = [];
      let from = 0;
      const pageSize = 1000;

      while (true) {
        const { data, error: zipErr } = await supabase
          .from("client_zipcodes")
          .select("zip,state,client_name,workspace_name,agency_color")
          .eq("month", month)
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

  // Handle ZIP assignment
  async function handleAssignZip(clientName: string, color: string) {
    if (!selectedZip) return;

    try {
      const { error } = await supabase
        .from("client_zipcodes")
        .update({ client_name: clientName, agency_color: color })
        .eq("zip", selectedZip)
        .eq("month", month);

      if (error) throw error;

      // Reload data
      await loadZipData();
    } catch (e: any) {
      console.error("Failed to assign ZIP:", e);
      throw e;
    }
  }

  // Handle color change for agency
  async function handleColorChange(clientName: string, newColor: string) {
    try {
      const { error } = await supabase
        .from("client_zipcodes")
        .update({ agency_color: newColor })
        .eq("client_name", clientName)
        .eq("month", month);

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
    a.download = `zip-assignments-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
      {/* Sticky Header */}
      <div className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur-md border-b border-white/10 shadow-lg">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button asChild variant="ghost" size="sm" className="text-gray-300 hover:text-white hover:bg-white/10">
                <Link to="/">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Portal
                </Link>
              </Button>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <MapPin className="h-6 w-6 text-blue-400" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                    ZIP Code Dashboard
                  </h1>
                  <p className="text-sm text-gray-400">Territory Management & Analytics</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-gray-300">Month:</label>
              <Input
                type="text"
                className="w-32 bg-white/10 border-white/20 text-white placeholder:text-gray-400"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                placeholder="2025-11"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-6 hover:bg-white/15 transition-all">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <MapPin className="h-5 w-5 text-blue-400" />
              </div>
              <p className="text-sm text-gray-300 font-medium">Total ZIPs</p>
            </div>
            <p className="text-4xl font-bold text-white">{stats.total.toLocaleString()}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-xl border border-green-500/30 p-6 hover:bg-white/15 transition-all">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <MapPin className="h-5 w-5 text-green-400" />
              </div>
              <p className="text-sm text-gray-300 font-medium">Assigned</p>
            </div>
            <p className="text-4xl font-bold text-green-400">
              {stats.assigned.toLocaleString()}
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-xl border border-orange-500/30 p-6 hover:bg-white/15 transition-all">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-orange-500/20 rounded-lg">
                <MapPin className="h-5 w-5 text-orange-400" />
              </div>
              <p className="text-sm text-gray-300 font-medium">Unassigned</p>
            </div>
            <p className="text-4xl font-bold text-orange-400">
              {stats.unassigned.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-4 mb-6">
          <Filter className="w-4 h-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search ZIP or agency..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-64 bg-white/10 border-white/20 text-white placeholder:text-gray-400"
          />
          <Select value={stateFilter} onValueChange={setStateFilter}>
            <SelectTrigger className="w-40 bg-white/10 border-white/20 text-white">
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
            <SelectTrigger className="w-48 bg-white/10 border-white/20 text-white">
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
          <Button onClick={exportToCSV} variant="outline" size="sm" className="bg-white/10 border-white/20 text-white hover:bg-white/20">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>

        {loading && <div className="text-sm text-gray-300">Loading...</div>}
        {error && <div className="text-sm text-red-400">Error: {error}</div>}

        {/* Choropleth Map */}
        {!loading && !error && filteredZipData.length > 0 && (
          <div className="mb-6">
            <ZipChoroplethMap zipData={filteredZipData} loading={loading} />
          </div>
        )}

        {/* Main Content: Visualization and Table */}
        {!loading && !error && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* ZIP Visualization */}
            <div className="overflow-hidden">
              <ZipVisualization
                zipData={filteredZipData}
                onZipClick={(zip) => {
                  setSelectedZip(zip);
                  setAssignmentOpen(true);
                }}
              />
            </div>

            {/* Agencies Table */}
            <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 overflow-hidden">
              <div className="p-4 border-b border-white/20">
                <h2 className="font-semibold text-white">Agency Assignments</h2>
              </div>
              <div className="overflow-auto max-h-[600px]">
                <table className="w-full text-sm">
                  <thead className="bg-white/5 sticky top-0">
                    <tr className="text-left border-b border-white/20">
                      <th className="py-3 px-4 text-gray-300 font-medium">Agency</th>
                      <th className="py-3 px-4 text-gray-300 font-medium">ZIPs</th>
                      <th className="py-3 px-4 text-gray-300 font-medium">Color</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.agencies.map((agency) => (
                      <tr key={agency.client_name} className="border-b border-white/10 hover:bg-white/5 transition-colors">
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-medium text-white">{agency.client_name}</p>
                            {agency.workspace_name && (
                              <p className="text-xs text-gray-400">
                                {agency.workspace_name}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-semibold text-blue-400">
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
                      </tr>
                    ))}
                    {stats.agencies.length === 0 && (
                      <tr>
                        <td className="py-8 px-4 text-center text-gray-400" colSpan={3}>
                          No agencies with assigned ZIPs for {month}
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

      {/* Assignment Modal */}
      <ZipAssignmentModal
        open={assignmentOpen}
        onClose={() => {
          setAssignmentOpen(false);
          setSelectedZip(null);
        }}
        onAssign={handleAssignZip}
        agencies={stats.agencies}
        zipCode={selectedZip}
        currentAgency={
          zipData.find((z) => z.zip === selectedZip)?.client_name
        }
      />
    </div>
  );
}
