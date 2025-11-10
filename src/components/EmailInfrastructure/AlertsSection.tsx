/**
 * Alerts Section Component
 *
 * Displays critical issues and action items requiring attention
 * Created: 2025-10-27
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, AlertCircle, Info, CheckCircle, Eye } from 'lucide-react';
import type { Alert, AlertsResult, EmailAccount } from '@/hooks/useAlerts';
import { useState } from 'react';
import { AlertAccountsModal } from './AlertAccountsModal';

interface AlertsSectionProps {
  alertsResult: AlertsResult;
  loading?: boolean;
  accounts?: EmailAccount[] | null;
}

export function AlertsSection({ alertsResult, loading = false, accounts = null }: AlertsSectionProps) {
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);

  const handleViewAllAccounts = (alert: Alert) => {
    setSelectedAlert(alert);
  };

  const handleCloseModal = () => {
    setSelectedAlert(null);
  };

  const getAlertIcon = (type: Alert['type']) => {
    switch (type) {
      case 'critical':
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      case 'info':
        return <Info className="h-5 w-5 text-blue-500" />;
    }
  };

  const getAlertColor = (type: Alert['type']) => {
    switch (type) {
      case 'critical':
        return 'border-red-500/50 bg-red-500/10';
      case 'warning':
        return 'border-yellow-500/50 bg-yellow-500/10';
      case 'info':
        return 'border-blue-500/50 bg-blue-500/10';
    }
  };

  const getCategoryBadge = (category: Alert['category']) => {
    const config = {
      connection: { text: 'Connection', className: 'bg-purple-500/20 text-purple-400 border-purple-500/40' },
      performance: { text: 'Performance', className: 'bg-orange-500/20 text-orange-400 border-orange-500/40' },
      reliability: { text: 'Reliability', className: 'bg-pink-500/20 text-pink-400 border-pink-500/40' },
      data: { text: 'Data', className: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40' },
    };
    const c = config[category];
    return (
      <Badge variant="outline" className={c.className}>
        {c.text}
      </Badge>
    );
  };

  if (loading) {
    return (
      <Card className="bg-white/5 backdrop-blur-sm border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500 animate-pulse" />
            <span>Action Items & Alerts</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-white/70 text-center py-8">Checking for issues...</div>
        </CardContent>
      </Card>
    );
  }

  if (alertsResult.alerts.length === 0) {
    return (
      <Card className="bg-white/5 backdrop-blur-sm border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center space-x-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <span>Action Items & Alerts</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-6 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
            <h3 className="text-white font-semibold text-lg mb-2">All Clear!</h3>
            <p className="text-green-200 text-sm">
              No critical issues or action items detected. Your email infrastructure is running smoothly.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white/5 backdrop-blur-sm border-white/10">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            <span>Action Items & Alerts</span>
          </CardTitle>
          <div className="flex items-center gap-2">
            {alertsResult.criticalCount > 0 && (
              <Badge variant="destructive" className="bg-red-500/20 text-red-400 border-red-500/40">
                {alertsResult.criticalCount} Critical
              </Badge>
            )}
            {alertsResult.warningCount > 0 && (
              <Badge variant="default" className="bg-yellow-500/20 text-yellow-400 border-yellow-500/40">
                {alertsResult.warningCount} Warning
              </Badge>
            )}
            {alertsResult.infoCount > 0 && (
              <Badge variant="outline" className="bg-blue-500/20 text-blue-400 border-blue-500/40">
                {alertsResult.infoCount} Info
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {alertsResult.alerts.map((alert) => {
            return (
              <div
                key={alert.id}
                className={`border rounded-lg p-4 transition-all ${getAlertColor(alert.type)}`}
              >
                <div className="flex items-start gap-3">
                  {getAlertIcon(alert.type)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex-1">
                        <h4 className="text-white font-semibold text-sm mb-1">
                          {alert.title}
                        </h4>
                        <p className="text-white/70 text-xs">
                          {alert.description}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {getCategoryBadge(alert.category)}
                        {alert.count && alert.count > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-3 text-xs bg-white/5 border-white/20 hover:bg-white/10 text-white"
                            onClick={() => handleViewAllAccounts(alert)}
                          >
                            <Eye className="h-3 w-3 mr-1.5" />
                            View All {alert.count}
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Preview: Show first 3 accounts if available */}
                    {alert.accounts && alert.accounts.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-white/10">
                        <div className="text-white/60 text-xs mb-2">
                          Sample accounts {alert.count && `(showing ${Math.min(alert.accounts.length, 3)} of ${alert.count})`}:
                        </div>
                        <div className="space-y-1">
                          {alert.accounts.slice(0, 3).map((email, idx) => (
                            <div
                              key={idx}
                              className="text-white/80 text-xs bg-white/5 rounded px-2 py-1 font-mono"
                            >
                              {email}
                            </div>
                          ))}
                          {alert.count && alert.count > 3 && (
                            <div className="text-white/60 text-xs italic">
                              ... and {alert.count - 3} more
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Recommendation */}
                    {alert.actionable && (
                      <div className="mt-3 bg-white/5 rounded p-2">
                        <div className="flex items-start gap-2">
                          <Info className="h-3 w-3 text-white/60 mt-0.5 flex-shrink-0" />
                          <div className="text-white/80 text-xs">
                            <strong>Recommendation:</strong> {alert.recommendation}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>

      {/* Alert Accounts Modal */}
      <AlertAccountsModal
        isOpen={selectedAlert !== null}
        onClose={handleCloseModal}
        alert={selectedAlert}
        allAccounts={accounts}
      />
    </Card>
  );
}
