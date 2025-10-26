/**
 * SyncProgressBar Component
 *
 * Displays real-time progress of email account sync jobs
 * Uses Supabase Realtime to subscribe to sync_progress table updates
 *
 * Features:
 * - Live progress bar (0-100%)
 * - Current workspace being synced
 * - Account count updates
 * - Auto-hides when sync completes
 */

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, RefreshCw, XCircle } from 'lucide-react';

interface SyncProgress {
  id: string;
  job_id: string;
  job_name: string;
  total_workspaces: number;
  workspaces_completed: number;
  current_workspace: string | null;
  total_accounts: number;
  status: 'running' | 'completed' | 'failed';
  error_message: string | null;
  started_at: string;
  updated_at: string;
  completed_at: string | null;
}

interface SyncProgressBarProps {
  jobId: string | null;
  onComplete?: () => void;
}

export function SyncProgressBar({ jobId, onComplete }: SyncProgressBarProps) {
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (!jobId) {
      setProgress(null);
      setIsVisible(false);
      return;
    }

    setIsVisible(true);

    // Fetch current progress state
    const fetchProgress = async () => {
      const { data, error } = await supabase
        .from('sync_progress')
        .select('*')
        .eq('job_id', jobId)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error fetching sync progress:', error);
        return;
      }

      if (data) {
        console.log('Progress fetched:', data);
        setProgress(data as SyncProgress);

        // Auto-hide after completion
        if (data.status === 'completed' || data.status === 'failed') {
          setTimeout(() => {
            setIsVisible(false);
            if (data.status === 'completed' && onComplete) {
              onComplete();
            }
          }, 3000); // Hide after 3 seconds
        }
      }
    };

    // Initial fetch
    fetchProgress();

    // Poll every 2 seconds while running
    const pollInterval = setInterval(fetchProgress, 2000);

    return () => {
      clearInterval(pollInterval);
    };
  }, [jobId, onComplete]);

  if (!isVisible || !progress) return null;

  const percentage = progress.total_workspaces > 0
    ? Math.round((progress.workspaces_completed / progress.total_workspaces) * 100)
    : 0;

  const getStatusIcon = () => {
    switch (progress.status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'running':
      default:
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
    }
  };

  const getStatusText = () => {
    switch (progress.status) {
      case 'completed':
        return 'Sync completed!';
      case 'failed':
        return 'Sync failed';
      case 'running':
      default:
        return `Syncing ${progress.current_workspace || '...'}`;
    }
  };

  const getStatusColor = () => {
    switch (progress.status) {
      case 'completed':
        return 'text-green-600';
      case 'failed':
        return 'text-red-600';
      case 'running':
      default:
        return 'text-blue-600';
    }
  };

  return (
    <div className="w-full space-y-2 p-4 border rounded-lg bg-card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <span className={`text-sm font-medium ${getStatusColor()}`}>
            {getStatusText()}
          </span>
        </div>
        <span className="text-sm text-muted-foreground">
          {progress.workspaces_completed}/{progress.total_workspaces} workspaces
        </span>
      </div>

      <Progress value={percentage} className="h-2" />

      <div className="flex justify-between text-xs text-muted-foreground">
        <span>
          {progress.total_accounts.toLocaleString()} accounts synced
        </span>
        <span>
          {percentage}%
        </span>
      </div>

      {progress.error_message && (
        <div className="text-xs text-red-600 mt-2">
          Error: {progress.error_message}
        </div>
      )}
    </div>
  );
}
