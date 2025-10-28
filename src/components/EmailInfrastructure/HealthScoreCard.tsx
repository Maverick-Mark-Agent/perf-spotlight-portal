/**
 * Health Score Card Component
 *
 * Displays overall email infrastructure health score with breakdown
 * Created: 2025-10-27
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import type { HealthScoreResult } from '@/hooks/useHealthScore';

interface HealthScoreCardProps {
  healthScore: HealthScoreResult;
  loading?: boolean;
}

export function HealthScoreCard({ healthScore, loading = false }: HealthScoreCardProps) {
  const getStatusIcon = () => {
    switch (healthScore.status) {
      case 'excellent':
      case 'good':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'fair':
        return <Minus className="h-5 w-5 text-yellow-500" />;
      case 'poor':
        return <TrendingDown className="h-5 w-5 text-orange-500" />;
      case 'critical':
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
    }
  };

  const getStatusBadge = () => {
    const statusConfig = {
      excellent: { variant: 'default' as const, text: 'Excellent', className: 'bg-green-500/20 text-green-500 border-green-500/40' },
      good: { variant: 'default' as const, text: 'Good', className: 'bg-green-400/20 text-green-400 border-green-400/40' },
      fair: { variant: 'default' as const, text: 'Fair', className: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/40' },
      poor: { variant: 'default' as const, text: 'Poor', className: 'bg-orange-500/20 text-orange-500 border-orange-500/40' },
      critical: { variant: 'destructive' as const, text: 'Critical', className: 'bg-red-500/20 text-red-500 border-red-500/40' },
    };
    const config = statusConfig[healthScore.status];
    return (
      <Badge variant={config.variant} className={config.className}>
        {config.text}
      </Badge>
    );
  };

  if (loading) {
    return (
      <Card className="bg-white/5 backdrop-blur-sm border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center space-x-2">
            <Activity className="h-5 w-5 text-dashboard-primary animate-pulse" />
            <span>System Health Score</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-white/70 text-center py-8">Calculating health score...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white/5 backdrop-blur-sm border-white/10">
      <CardHeader>
        <CardTitle className="text-white flex items-center space-x-2">
          <Activity className="h-5 w-5 text-dashboard-primary" />
          <span>System Health Score</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Issues - MOVED TO TOP */}
        {healthScore.issues.length > 0 && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="text-red-300 font-semibold text-sm mb-1">Issues Detected</h4>
                <ul className="space-y-1">
                  {healthScore.issues.map((issue, idx) => (
                    <li key={idx} className="text-red-200 text-xs">• {issue}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Breakdown Progress Bars */}
        <div className="space-y-3">
          <h4 className="text-white font-semibold text-sm mb-3">Health Breakdown</h4>

          {/* Connection Health */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/70">Connection Health (35%)</span>
              <span className={`font-semibold ${healthScore.breakdown.connectionHealth >= 80 ? 'text-green-500' : healthScore.breakdown.connectionHealth >= 60 ? 'text-yellow-500' : 'text-red-500'}`}>
                {healthScore.breakdown.connectionHealth}%
              </span>
            </div>
            <Progress
              value={healthScore.breakdown.connectionHealth}
              className="h-2"
            />
          </div>

          {/* Performance Health */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/70">Performance Health (30%)</span>
              <span className={`font-semibold ${healthScore.breakdown.performanceHealth >= 80 ? 'text-green-500' : healthScore.breakdown.performanceHealth >= 60 ? 'text-yellow-500' : 'text-red-500'}`}>
                {healthScore.breakdown.performanceHealth}%
              </span>
            </div>
            <Progress
              value={healthScore.breakdown.performanceHealth}
              className="h-2"
            />
          </div>

          {/* Reliability Health */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/70">Reliability Health (20%)</span>
              <span className={`font-semibold ${healthScore.breakdown.reliabilityHealth >= 80 ? 'text-green-500' : healthScore.breakdown.reliabilityHealth >= 60 ? 'text-yellow-500' : 'text-red-500'}`}>
                {healthScore.breakdown.reliabilityHealth}%
              </span>
            </div>
            <Progress
              value={healthScore.breakdown.reliabilityHealth}
              className="h-2"
            />
          </div>

          {/* Data Freshness */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/70">Data Freshness (15%)</span>
              <span className={`font-semibold ${healthScore.breakdown.dataFreshnessHealth >= 80 ? 'text-green-500' : healthScore.breakdown.dataFreshnessHealth >= 60 ? 'text-yellow-500' : 'text-red-500'}`}>
                {healthScore.breakdown.dataFreshnessHealth}%
              </span>
            </div>
            <Progress
              value={healthScore.breakdown.dataFreshnessHealth}
              className="h-2"
            />
          </div>
        </div>

        {/* Recommendations */}
        {healthScore.recommendations.length > 0 && (
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="text-blue-300 font-semibold text-sm mb-1">Recommendations</h4>
                <ul className="space-y-1">
                  {healthScore.recommendations.map((rec, idx) => (
                    <li key={idx} className="text-blue-200 text-xs">• {rec}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
