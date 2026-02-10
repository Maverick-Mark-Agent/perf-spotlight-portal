import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";

type StateLeadStats = {
  client_name: string;
  workspace_name: string | null;
  target: number;
  zipsPulled: number;
  qualified: number;
  deliverable: number;
  uploaded: number;
  gap: number;
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
      // Get client target from client_registry
      const { data: registryData, error: registryErr } = await supabase
        .from("client_registry")
        .select("workspace_name, monthly_kpi_target");

      if (registryErr) throw registryErr;

      // Get ZIP batch pull data
      const { data: zipBatchData, error: zipBatchErr } = await supabase
        .from("zip_batch_pulls")
        .select("workspace_name, zip, pulled_at, qualified_contacts, deliverable_contacts, uploaded_to_bison")
        .eq("month", month)
        .not("pulled_at", "is", null);

      if (zipBatchErr) throw zipBatchErr;

      // Aggregate by workspace
      const aggregated: Record<string, StateLeadStats> = {};

      // Initialize with registry data
      registryData?.forEach((client) => {
        if (client.workspace_name) {
          aggregated[client.workspace_name] = {
            client_name: client.workspace_name,
            workspace_name: client.workspace_name,
            target: client.monthly_kpi_target || 0,
            zipsPulled: 0,
            qualified: 0,
            deliverable: 0,
            uploaded: 0,
            gap: 0,
          };
        }
      });

      // Aggregate ZIP batch data
      zipBatchData?.forEach((batch) => {
        if (batch.workspace_name && aggregated[batch.workspace_name]) {
          aggregated[batch.workspace_name].zipsPulled++;
          aggregated[batch.workspace_name].qualified += batch.qualified_contacts || 0;
          aggregated[batch.workspace_name].deliverable += batch.deliverable_contacts || 0;
          aggregated[batch.workspace_name].uploaded += batch.uploaded_to_bison ? 1 : 0;
        }
      });

      // Calculate gap (qualified vs target)
      Object.values(aggregated).forEach((stat) => {
        stat.gap = stat.target - stat.qualified;
      });

      // Convert to array and sort by client name
      const sorted = Object.values(aggregated)
        .filter((stat) => stat.zipsPulled > 0) // Only show clients with pulled ZIPs
        .sort((a, b) => a.client_name.localeCompare(b.client_name));

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

  return (
    <Card className="bg-white/10 backdrop-blur-md border-white/20">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Contact Pipeline Progress
        </CardTitle>
        <CardDescription className="text-gray-400">
          Track qualified, deliverable, and uploaded contacts by client for {month}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {stats.length === 0 ? (
          <p className="text-center text-gray-400 py-8">No contact data available for {month}</p>
        ) : (
          <div className="overflow-auto max-h-[500px]">
            <Table>
              <TableHeader className="sticky top-0 bg-white/5">
                <TableRow className="border-white/20 hover:bg-white/5">
                  <TableHead className="text-gray-300">Client</TableHead>
                  <TableHead className="text-gray-300 text-right">Target</TableHead>
                  <TableHead className="text-gray-300 text-right">ZIP Codes Pulled</TableHead>
                  <TableHead className="text-gray-300 text-right">Qualified Contacts</TableHead>
                  <TableHead className="text-gray-300 text-right">Deliverable</TableHead>
                  <TableHead className="text-gray-300 text-right">Uploaded</TableHead>
                  <TableHead className="text-gray-300 text-right">Gap</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.map((stat, idx) => (
                  <TableRow key={idx} className="border-white/10 hover:bg-white/5">
                    <TableCell>
                      <p className="text-white font-medium">{stat.client_name}</p>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-gray-300 font-semibold">{stat.target.toLocaleString()}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-blue-400 font-semibold">{stat.zipsPulled.toLocaleString()}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-green-400 font-semibold">{stat.qualified.toLocaleString()}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-purple-400 font-semibold">{stat.deliverable.toLocaleString()}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-yellow-400 font-semibold">{stat.uploaded.toLocaleString()}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={stat.gap > 0 ? "text-orange-400 font-semibold" : "text-green-400 font-semibold"}>
                        {stat.gap.toLocaleString()}
                      </span>
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
