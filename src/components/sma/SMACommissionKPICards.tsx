import { useEffect, useState } from "react";
import { KPICard } from "@/components/dashboard/KPICard";
import { DollarSign, Building2, TrendingUp } from "lucide-react";
import { getSMACommissionSummary } from "@/services/smaPoliciesService";
import { SMACommissionSummary } from "@/types/sma";

export const SMACommissionKPICards = () => {
  const [summary, setSummary] = useState<SMACommissionSummary>({
    total_premium: 0,
    total_agency_commission: 0,
    total_maverick_commission: 0,
    policy_count: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSummary();
  }, []);

  const fetchSummary = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getSMACommissionSummary();
      setSummary(data);
    } catch (err) {
      console.error('Error fetching SMA commission summary:', err);
      setError('Failed to load commission data');
    } finally {
      setLoading(false);
    }
  };

  // Refresh function that can be called externally
  const refresh = () => {
    fetchSummary();
  };

  // Expose refresh function via ref if needed
  useEffect(() => {
    // Store refresh function in window for external access if needed
    (window as any).refreshSMAKPIs = refresh;
    return () => {
      delete (window as any).refreshSMAKPIs;
    };
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-40 bg-muted/80 border border-border rounded-2xl relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_2s_infinite] before:bg-gradient-to-r before:from-transparent before:via-foreground/10 before:to-transparent"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <div className="col-span-full bg-red-500/10 border border-red-500/30 rounded-2xl p-6 text-center">
          <p className="text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
      {/* Total Premium Closed */}
      <KPICard
        title="Total Premium Closed"
        value={`$${summary.total_premium.toLocaleString()}`}
        subtitle={`${summary.policy_count} ${summary.policy_count === 1 ? 'policy' : 'policies'}`}
        status="above-target"
        icon={<DollarSign className="h-5 w-5" />}
        trend="up"
      />

      {/* Total Commission to SMA */}
      <KPICard
        title="Total Commission to SMA"
        value={`$${summary.total_agency_commission.toLocaleString()}`}
        subtitle="Agency earnings"
        status="above-target"
        icon={<Building2 className="h-5 w-5" />}
        trend="up"
      />

      {/* Total Commission to Maverick */}
      <KPICard
        title="Total Commission to Maverick"
        value={`$${summary.total_maverick_commission.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        subtitle="20% of SMA commission"
        status="above-target"
        icon={<TrendingUp className="h-5 w-5" />}
        trend="up"
      />
    </div>
  );
};
