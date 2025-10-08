import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertCircle, CheckCircle, Clock, XCircle } from "lucide-react";

export interface DataFreshnessIndicatorProps {
  lastUpdated: Date | null;
  loading?: boolean;
  error?: string;
  cached?: boolean;
  fresh?: boolean;
  warnings?: string[];
  className?: string;
}

/**
 * Data Freshness Indicator Component
 * Shows the freshness status of data with visual indicators and tooltips
 */
export const DataFreshnessIndicator = ({
  lastUpdated,
  loading = false,
  error,
  cached = false,
  fresh = true,
  warnings,
  className = "",
}: DataFreshnessIndicatorProps) => {
  // Calculate time since last update
  const getTimeSince = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  // Determine status
  let status: 'loading' | 'error' | 'warning' | 'stale' | 'fresh';
  let statusColor: string;
  let statusIcon: React.ReactNode;
  let statusText: string;
  let tooltipContent: string;

  if (loading) {
    status = 'loading';
    statusColor = 'bg-blue-500/20 text-blue-400 border-blue-500/40';
    statusIcon = <Clock className="h-3 w-3 animate-spin" />;
    statusText = 'Loading';
    tooltipContent = 'Fetching fresh data...';
  } else if (error) {
    status = 'error';
    statusColor = 'bg-red-500/20 text-red-400 border-red-500/40';
    statusIcon = <XCircle className="h-3 w-3" />;
    statusText = 'Error';
    tooltipContent = `Error loading data: ${error}`;
  } else if (warnings && warnings.length > 0) {
    status = 'warning';
    statusColor = 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40';
    statusIcon = <AlertCircle className="h-3 w-3" />;
    statusText = 'Warning';
    tooltipContent = `Data loaded with warnings: ${warnings.join(', ')}`;
  } else if (!fresh && lastUpdated) {
    status = 'stale';
    statusColor = 'bg-orange-500/20 text-orange-400 border-orange-500/40';
    statusIcon = <Clock className="h-3 w-3" />;
    statusText = 'Stale';
    const timeSince = getTimeSince(lastUpdated);
    tooltipContent = `Data is stale (updated ${timeSince}). Click refresh for latest data.`;
  } else if (lastUpdated) {
    status = 'fresh';
    statusColor = 'bg-green-500/20 text-green-400 border-green-500/40';
    statusIcon = <CheckCircle className="h-3 w-3" />;
    statusText = 'Fresh';
    const timeSince = getTimeSince(lastUpdated);
    tooltipContent = `Data is up-to-date (updated ${timeSince})${cached ? ' from cache' : ''}`;
  } else {
    status = 'loading';
    statusColor = 'bg-gray-500/20 text-gray-400 border-gray-500/40';
    statusIcon = <Clock className="h-3 w-3" />;
    statusText = 'Unknown';
    tooltipContent = 'No data available';
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={`flex items-center gap-1.5 ${statusColor} ${className}`}
          >
            {statusIcon}
            <span className="text-xs font-medium">{statusText}</span>
            {lastUpdated && !loading && !error && (
              <span className="text-[10px] opacity-70">
                {getTimeSince(lastUpdated)}
              </span>
            )}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1">
            <p className="font-medium">{tooltipContent}</p>
            {lastUpdated && (
              <p className="text-xs text-muted-foreground">
                Last updated: {lastUpdated.toLocaleString()}
              </p>
            )}
            {cached && (
              <p className="text-xs text-muted-foreground">
                📦 Served from cache
              </p>
            )}
            {warnings && warnings.length > 0 && (
              <div className="mt-2 pt-2 border-t border-border">
                <p className="text-xs font-medium mb-1">Warnings:</p>
                <ul className="text-xs space-y-0.5">
                  {warnings.map((warning, idx) => (
                    <li key={idx} className="text-yellow-400">
                      • {warning}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

/**
 * Compact Data Freshness Indicator (icon only)
 */
export const DataFreshnessIcon = ({
  lastUpdated,
  loading,
  error,
  fresh,
  className = "",
}: Omit<DataFreshnessIndicatorProps, 'cached' | 'warnings'>) => {
  let statusColor: string;
  let statusIcon: React.ReactNode;
  let statusText: string;

  if (loading) {
    statusColor = 'text-blue-400';
    statusIcon = <Clock className="h-4 w-4 animate-spin" />;
    statusText = 'Loading...';
  } else if (error) {
    statusColor = 'text-red-400';
    statusIcon = <XCircle className="h-4 w-4" />;
    statusText = `Error: ${error}`;
  } else if (!fresh && lastUpdated) {
    statusColor = 'text-orange-400';
    statusIcon = <Clock className="h-4 w-4" />;
    const now = new Date();
    const diffMs = now.getTime() - lastUpdated.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    statusText = `Stale (${diffMins}m old)`;
  } else {
    statusColor = 'text-green-400';
    statusIcon = <CheckCircle className="h-4 w-4" />;
    statusText = 'Up to date';
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`${statusColor} ${className}`}>
            {statusIcon}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{statusText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

/**
 * Data Freshness Status Bar (full-width)
 * Shows data freshness with additional metadata
 */
export const DataFreshnessStatusBar = ({
  lastUpdated,
  loading,
  error,
  cached,
  fresh,
  warnings,
  fetchDurationMs,
  recordCount,
}: DataFreshnessIndicatorProps & {
  fetchDurationMs?: number;
  recordCount?: number;
}) => {
  const getTimeSince = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  let statusColor: string;
  let statusBg: string;

  if (loading) {
    statusColor = 'text-blue-400';
    statusBg = 'bg-blue-500/10';
  } else if (error) {
    statusColor = 'text-red-400';
    statusBg = 'bg-red-500/10';
  } else if (warnings && warnings.length > 0) {
    statusColor = 'text-yellow-400';
    statusBg = 'bg-yellow-500/10';
  } else if (!fresh) {
    statusColor = 'text-orange-400';
    statusBg = 'bg-orange-500/10';
  } else {
    statusColor = 'text-green-400';
    statusBg = 'bg-green-500/10';
  }

  return (
    <div className={`px-4 py-2 rounded-lg ${statusBg} ${statusColor} text-sm flex items-center justify-between`}>
      <div className="flex items-center gap-3">
        <DataFreshnessIndicator
          lastUpdated={lastUpdated}
          loading={loading}
          error={error}
          cached={cached}
          fresh={fresh}
          warnings={warnings}
        />
        {lastUpdated && !loading && !error && (
          <span className="text-xs opacity-70">
            Updated {getTimeSince(lastUpdated)}
          </span>
        )}
      </div>
      <div className="flex items-center gap-4 text-xs opacity-70">
        {recordCount !== undefined && (
          <span>{recordCount.toLocaleString()} records</span>
        )}
        {fetchDurationMs !== undefined && (
          <span>{fetchDurationMs}ms</span>
        )}
      </div>
    </div>
  );
};
