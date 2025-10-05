import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type ZipRow = { client_name: string | null; workspace_name: string | null; zip: string };
type CleanedRow = { client_name: string | null; workspace_name: string | null; cleaned_count: number };

export default function ZipDashboard() {
  const defaultMonth = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }, []);
  const [month, setMonth] = useState<string>(defaultMonth);
  const [rows, setRows] = useState<Array<{ client: string; workspace: string; zips: number; cleaned: number }>>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: zips, error: zErr } = await supabase
          .from("client_zipcodes")
          .select("client_name,workspace_name,zip")
          .eq("month", month);
        if (zErr) throw zErr;

        const agg = new Map<string, { client: string; workspace: string; zips: number }>();
        (zips as ZipRow[] | null || []).forEach((r) => {
          const ws = r.workspace_name || r.client_name || "unknown";
          const key = ws;
          if (!agg.has(key)) {
            agg.set(key, { client: r.client_name || ws, workspace: ws, zips: 0 });
          }
          agg.get(key)!.zips += 1;
        });

        const { data: cleaned, error: cErr } = await supabase
          .from("monthly_cleaned_leads")
          .select("client_name,workspace_name,cleaned_count")
          .eq("month", month);
        if (cErr && (cErr as any).code !== "42P01") throw cErr;

        const cleanedMap = new Map<string, number>();
        (cleaned as CleanedRow[] | null || []).forEach((r) => {
          const ws = r.workspace_name || r.client_name || "unknown";
          cleanedMap.set(ws, r.cleaned_count || 0);
        });

        const merged = Array.from(agg.values()).map((r) => ({
          ...r,
          cleaned: cleanedMap.get(r.workspace) || 0,
        }));

        setRows(merged.sort((a, b) => a.client.localeCompare(b.client)));
      } catch (e: any) {
        setError(e?.message || "Failed to load data");
      } finally {
        setLoading(false);
      }
    })();
  }, [month]);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">ZIPs + Cleaned Leads (per client)</h1>

      <div className="flex items-center gap-3">
        <label className="text-sm">Month (YYYY-MM)</label>
        <input
          className="border rounded px-2 py-1 bg-transparent"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          placeholder="2025-11"
        />
      </div>

      {loading && <div className="text-sm opacity-80">Loading…</div>}
      {error && <div className="text-sm text-red-500">Error: {error}</div>}

      {!loading && !error && (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-4">Client</th>
                <th className="py-2 pr-4">Workspace</th>
                <th className="py-2 pr-4">ZIPs</th>
                <th className="py-2 pr-4">Cleaned Leads</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.workspace} className="border-b last:border-0">
                  <td className="py-2 pr-4">{r.client}</td>
                  <td className="py-2 pr-4">{r.workspace}</td>
                  <td className="py-2 pr-4">{r.zips}</td>
                  <td className="py-2 pr-4">{r.cleaned}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td className="py-4 text-sm opacity-70" colSpan={4}>
                    No data for {month}. Import ZIPs and (optionally) cleaned counts to see results.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}


