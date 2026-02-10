import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import type { InfrastructureAlert } from "@/hooks/useReplyMetrics";

interface InfrastructureAlertBannerProps {
  alerts: InfrastructureAlert[];
}

export const InfrastructureAlertBanner = ({ alerts }: InfrastructureAlertBannerProps) => {
  if (alerts.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {alerts.map((alert) => (
        <Alert
          key={alert.workspaceName}
          variant="destructive"
          className="bg-destructive/10 border-destructive/50"
        >
          <AlertTriangle className="h-5 w-5" />
          <AlertTitle className="font-bold">Infrastructure Alert</AlertTitle>
          <AlertDescription className="mt-2">
            <span className="font-semibold">{alert.clientName}</span> reply rate dropped to{' '}
            <span className="font-bold">{alert.replyRate.toFixed(2)}%</span> — check infrastructure
            <div className="text-xs mt-1 text-muted-foreground">
              ({alert.emailsSent.toLocaleString()} emails sent today, threshold: 0.3%)
            </div>
          </AlertDescription>
        </Alert>
      ))}
    </div>
  );
};
