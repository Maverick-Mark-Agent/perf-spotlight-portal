import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";

type StateLeadStats = {
  client_name: string;
  state: string;
  total_leads: number;
  workspace_name: string | null;
};

type StateLeadsAnalyticsProps = {
  month: string;
};

export default function StateLeadsAnalytics({ month }: StateLeadsAnalyticsProps) {
  const [stats, setStats] = useState<StateLeadStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadLeadStats();
  }, [month]);

  async function loadLeadStats() {
    setLoading(true);
    setError(null);
    try {
      // Get all ZIP assignments with leads data
      const { data: zipData, error: zipErr } = await supabase
        .from("client_zipcodes")
        .select("zip, state, client_name, workspace_name")
        .eq("month", month)
        .not("state", "is", null);

      if (zipErr) throw zipErr;

      // Get lead counts per ZIP from monthly_cleaned_leads
      const { data: leadsData, error: leadsErr } = await supabase
        .from("monthly_cleaned_leads")
        .select("zip_code")
        .eq("month", month);

      if (leadsErr) throw leadsErr;

      // Count leads per ZIP
      const leadCounts: Record<string, number> = {};
      leadsData?.forEach((lead) => {
        if (lead.zip_code) {
          leadCounts[lead.zip_code] = (leadCounts[lead.zip_code] || 0) + 1;
        }
      });

      // Aggregate by client and state
      const aggregated: Record<string, StateLeadStats> = {};

      zipData?.forEach((zip) => {
        const key = `${zip.client_name}|${zip.state}`;
        const leadCount = leadCounts[zip.zip] || 0;

        if (!aggregated[key]) {
          aggregated[key] = {
            client_name: zip.client_name,
            state: zip.state!,
            total_leads: 0,
            workspace_name: zip.workspace_name,
          };
        }

        aggregated[key].total_leads += leadCount;
      });

      // Convert to array and sort by total leads desc
      const sorted = Object.values(aggregated)
        .filter((stat) => stat.total_leads > 0) // Only show clients with leads
        .sort((a, b) => b.total_leads - a.total_leads);

      setStats(sorted);
    } catch (e: any) {
      setError(e?.message || "Failed to load lead statistics");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <Card className="bg-white/10 backdrop-blur-md border-white/20">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Leads by Client & State
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto"></div>
            <p className="text-gray-400 mt-4">Loading lead statistics...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-white/10 backdrop-blur-md border-white/20">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Leads by Client & State
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-400">{error}</p>
        </CardContent>
      </Card>
    );
  }

  const totalLeads = stats.reduce((sum, stat) => sum + stat.total_leads, 0);

  return (
    <Card className="bg-white/10 backdrop-blur-md border-white/20">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Leads by Client & State
        </CardTitle>
        <CardDescription className="text-gray-400">
          Total leads: <span className="text-blue-400 font-semibold">{totalLeads.toLocaleString()}</span> across{" "}
          {stats.length} client-state combinations
        </CardDescription>
      </CardHeader>
      <CardContent>
        {stats.length === 0 ? (
          <p className="text-center text-gray-400 py-8">No lead data available for {month}</p>
        ) : (
          <div className="overflow-auto max-h-[500px]">
            <Table>
              <TableHeader className="sticky top-0 bg-white/5">
                <TableRow className="border-white/20 hover:bg-white/5">
                  <TableHead className="text-gray-300">Client</TableHead>
                  <TableHead className="text-gray-300">State</TableHead>
                  <TableHead className="text-gray-300 text-right">Total Leads</TableHead>
                  <TableHead className="text-gray-300 text-right">% of Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.map((stat, idx) => (
                  <TableRow key={idx} className="border-white/10 hover:bg-white/5">
                    <TableCell>
                      <div>
                        <p className="text-white font-medium">{stat.client_name}</p>
                        {stat.workspace_name && stat.workspace_name !== stat.client_name && (
                          <p className="text-xs text-gray-400">{stat.workspace_name}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-300">
                      <span className="px-2 py-1 rounded bg-white/10 font-mono text-sm">{stat.state}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-blue-400 font-semibold">{stat.total_leads.toLocaleString()}</span>
                    </TableCell>
                    <TableCell className="text-right text-gray-300">
                      {((stat.total_leads / totalLeads) * 100).toFixed(1)}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
