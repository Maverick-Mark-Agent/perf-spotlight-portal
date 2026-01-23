import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  CheckCircle2,
  Circle,
  Loader2,
  XCircle,
  AlertCircle,
  Zap,
  RefreshCw
} from "lucide-react";

interface OnboardingChecklistProps {
  workspaceName: string;
  workspaceId: number;
  onSetupComplete?: () => void;
}

interface ChecklistStatus {
  bisonLinked: 'pending' | 'completed';
  apiKeyConfigured: 'pending' | 'completed';
  webhooksCreated: 'pending' | 'in_progress' | 'completed' | 'partial';
  emailsSynced: 'pending' | 'in_progress' | 'completed';
  slackConfigured: 'pending' | 'completed' | 'skipped';
}

interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'partial' | 'skipped';
  optional?: boolean;
}

export default function OnboardingChecklist({
  workspaceName,
  workspaceId,
  onSetupComplete
}: OnboardingChecklistProps) {
  const [status, setStatus] = useState<ChecklistStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [completingSetup, setCompletingSetup] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [setupResult, setSetupResult] = useState<any>(null);
  const [emailAccountCount, setEmailAccountCount] = useState(0);

  // Fetch status on mount and when workspace changes
  useEffect(() => {
    fetchStatus();

    // Subscribe to client_registry changes for real-time updates
    const channel = supabase
      .channel(`client-setup-${workspaceId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'client_registry',
        filter: `workspace_id=eq.${workspaceId}`
      }, () => {
        fetchStatus();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [workspaceId, workspaceName]);

  const fetchStatus = async () => {
    try {
      // Get client config
      const { data: client, error: clientError } = await supabase
        .from('client_registry')
        .select(`
          bison_workspace_id,
          bison_api_key,
          bison_webhook_enabled,
          bison_webhook_events,
          slack_webhook_url
        `)
        .eq('workspace_id', workspaceId)
        .single();

      if (clientError) {
        console.error('Error fetching client status:', clientError);
        return;
      }

      // Check email accounts count
      let accountCount = 0;
      if (client?.bison_workspace_id) {
        const { count } = await supabase
          .from('email_accounts_raw')
          .select('*', { count: 'exact', head: true })
          .eq('workspace_id', client.bison_workspace_id)
          .is('deleted_at', null);
        accountCount = count || 0;
      }
      setEmailAccountCount(accountCount);

      // Determine webhook status
      const webhookEvents = client?.bison_webhook_events || [];
      const hasReplied = webhookEvents.includes('lead_replied');
      const hasInterested = webhookEvents.includes('lead_interested');
      let webhooksStatus: 'pending' | 'in_progress' | 'completed' | 'partial' = 'pending';
      if (client?.bison_webhook_enabled && hasReplied && hasInterested) {
        webhooksStatus = 'completed';
      } else if (hasReplied || hasInterested) {
        webhooksStatus = 'partial';
      }

      setStatus({
        bisonLinked: client?.bison_workspace_id ? 'completed' : 'pending',
        apiKeyConfigured: client?.bison_api_key ? 'completed' : 'pending',
        webhooksCreated: webhooksStatus,
        emailsSynced: accountCount > 0 ? 'completed' : 'pending',
        slackConfigured: client?.slack_webhook_url ? 'completed' : 'skipped'
      });
    } catch (error) {
      console.error('Error fetching checklist status:', error);
    } finally {
      setLoading(false);
    }
  };

  const triggerCompleteSetup = async () => {
    setCompletingSetup(true);
    setSetupError(null);
    setSetupResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('complete-client-setup', {
        body: { workspace_name: workspaceName }
      });

      if (error) {
        setSetupError(error.message);
        return;
      }

      setSetupResult(data);

      if (data?.success) {
        onSetupComplete?.();
      } else if (data?.errors?.length > 0) {
        setSetupError(data.errors.join(', '));
      }

      // Refresh status after setup
      await fetchStatus();
    } catch (err: any) {
      setSetupError(err.message || 'Setup failed');
    } finally {
      setCompletingSetup(false);
    }
  };

  // Build checklist items
  const items: ChecklistItem[] = [
    {
      id: 'bison_linked',
      label: 'Bison Workspace Linked',
      description: 'Workspace ID verified in Email Bison',
      status: status?.bisonLinked || 'pending'
    },
    {
      id: 'api_key',
      label: 'API Key Configured',
      description: 'Workspace-specific API key for webhook creation',
      status: status?.apiKeyConfigured || 'pending'
    },
    {
      id: 'webhooks',
      label: 'Webhooks Created',
      description: 'lead_replied + lead_interested webhooks active',
      status: status?.webhooksCreated || 'pending'
    },
    {
      id: 'email_sync',
      label: 'Email Accounts Synced',
      description: emailAccountCount > 0 ? `${emailAccountCount} accounts synced` : 'Email accounts from Email Bison',
      status: status?.emailsSynced || 'pending'
    },
    {
      id: 'slack',
      label: 'Slack Notifications',
      description: 'Webhook URL for interested lead alerts',
      status: status?.slackConfigured || 'skipped',
      optional: true
    }
  ];

  // Check if all required items are complete
  const allComplete = status &&
    status.bisonLinked === 'completed' &&
    status.apiKeyConfigured === 'completed' &&
    status.webhooksCreated === 'completed' &&
    status.emailsSynced === 'completed';

  // Check if setup can be triggered (API key exists but webhooks not created)
  const canTriggerSetup = status &&
    status.apiKeyConfigured === 'completed' &&
    status.webhooksCreated !== 'completed';

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Setup Status</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // Don't render if everything is complete
  if (allComplete) {
    return null;
  }

  const getStatusIcon = (itemStatus: string) => {
    switch (itemStatus) {
      case 'completed':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'in_progress':
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'partial':
        return <AlertCircle className="w-5 h-5 text-amber-500" />;
      case 'skipped':
        return <Circle className="w-5 h-5 text-gray-400" />;
      default:
        return <Circle className="w-5 h-5 text-gray-400" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Zap className="w-4 h-4" />
          Setup Status
        </CardTitle>
        <CardDescription>
          Complete these steps to enable all dashboard features
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Checklist items */}
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className={`flex items-start gap-3 p-2 rounded-md ${
                item.status === 'completed' ? 'bg-green-50 dark:bg-green-950/20' :
                item.status === 'partial' ? 'bg-amber-50 dark:bg-amber-950/20' :
                item.status === 'skipped' ? 'bg-gray-50 dark:bg-gray-800/50' :
                'bg-gray-50 dark:bg-gray-800/50'
              }`}
            >
              {getStatusIcon(item.status)}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${
                    item.status === 'completed' ? 'text-green-700 dark:text-green-400' :
                    item.status === 'partial' ? 'text-amber-700 dark:text-amber-400' :
                    'text-gray-700 dark:text-gray-300'
                  }`}>
                    {item.label}
                  </span>
                  {item.optional && (
                    <span className="text-xs text-muted-foreground">(optional)</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{item.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Setup error */}
        {setupError && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertTitle>Setup Error</AlertTitle>
            <AlertDescription>
              {setupError}
            </AlertDescription>
          </Alert>
        )}

        {/* Partial success */}
        {setupResult && !setupResult.success && setupResult.webhooks_created > 0 && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Partial Setup</AlertTitle>
            <AlertDescription>
              {setupResult.webhooks_created} of 2 webhooks created. Click "Complete Setup" to retry.
            </AlertDescription>
          </Alert>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 pt-2">
          {canTriggerSetup && (
            <Button
              onClick={triggerCompleteSetup}
              disabled={completingSetup}
              className="flex-1"
            >
              {completingSetup ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Setting up...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 mr-2" />
                  Complete Setup
                </>
              )}
            </Button>
          )}
          <Button
            variant="outline"
            size="icon"
            onClick={fetchStatus}
            disabled={completingSetup}
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        {/* Guidance for missing API key */}
        {status?.apiKeyConfigured === 'pending' && (
          <p className="text-xs text-muted-foreground">
            Add an API key in the API tab to enable automatic webhook creation.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
