// SystemHealthBanner: red/yellow banner that surfaces integrity issues from
// the integrity-monitor cron. Reads the most recent system_health_checks
// row for each check and shows the worst-severity finding.
//
// Auto-refreshes every 60 seconds so the banner disappears once the next
// monitor run reports OK without needing a page reload.

import { useEffect, useState } from 'react';
import { AlertTriangle, AlertOctagon, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface HealthCheck {
  check_name:   string;
  severity:     'ok' | 'warning' | 'critical';
  issue_count:  number;
  description:  string;
  checked_at:   string;
}

export function SystemHealthBanner() {
  const [checks, setChecks] = useState<HealthCheck[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const fetchChecks = async () => {
      // Get the most recent row per check_name from the last hour.
      const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from('system_health_checks')
        .select('check_name, severity, issue_count, description, checked_at')
        .gte('checked_at', since)
        .order('checked_at', { ascending: false });

      if (!data) return;

      // Keep only the most recent row per check_name
      const latest = new Map<string, HealthCheck>();
      for (const row of data as HealthCheck[]) {
        if (!latest.has(row.check_name)) latest.set(row.check_name, row);
      }
      setChecks(Array.from(latest.values()));
    };

    fetchChecks();
    const interval = setInterval(fetchChecks, 60_000);
    return () => clearInterval(interval);
  }, []);

  const problems = checks.filter(c => c.severity !== 'ok' && c.issue_count > 0);
  if (problems.length === 0) return null;

  const hasCritical = problems.some(p => p.severity === 'critical');
  const bg = hasCritical ? 'bg-red-50 border-red-300' : 'bg-yellow-50 border-yellow-300';
  const fg = hasCritical ? 'text-red-800' : 'text-yellow-800';
  const Icon = hasCritical ? AlertOctagon : AlertTriangle;
  const totalIssues = problems.reduce((sum, p) => sum + p.issue_count, 0);

  return (
    <div className={`border-b ${bg} ${fg}`}>
      <div className="max-w-6xl mx-auto px-6 py-3">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 flex-shrink-0" />
            <span className="text-sm font-semibold">
              System health check found {totalIssues} issue{totalIssues === 1 ? '' : 's'} across {problems.length} check{problems.length === 1 ? '' : 's'}
            </span>
          </div>
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {expanded && (
          <div className="mt-3 space-y-2 text-xs">
            {problems.map(p => (
              <div key={p.check_name} className="flex items-start gap-2">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${p.severity === 'critical' ? 'bg-red-200 text-red-900' : 'bg-yellow-200 text-yellow-900'}`}>
                  {p.severity}
                </span>
                <span>
                  <strong>{p.check_name}:</strong> {p.description}
                </span>
              </div>
            ))}
            <p className="text-[10px] opacity-70 pt-1">
              Last checked: {new Date(problems[0].checked_at).toLocaleTimeString()}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
