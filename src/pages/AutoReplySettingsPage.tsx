/**
 * Auto-Reply Settings
 *
 * Per-workspace control panel for the auto-reply pipeline:
 *   - Enable / disable auto-reply (the kill switch)
 *   - Sentiment confidence + audit score thresholds
 *   - Hourly send cap
 *   - Human-feel delay (min minutes between inbound and auto-send)
 *   - Timezone (read-only, refreshable from Bison)
 *
 * All workspaces ship with auto_reply_enabled=FALSE — flipping the toggle
 * here is the explicit Phase 3 action that turns auto-reply on.
 */

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Bot, Clock, Globe, RefreshCw, Loader2, ShieldCheck, Save, AlertTriangle } from 'lucide-react';

interface WorkspaceSettings {
  workspace_name: string;
  auto_reply_enabled: boolean;
  timezone: string | null;
  auto_reply_min_sentiment_confidence: number;
  auto_reply_min_audit_score: number;
  auto_reply_max_per_hour: number;
  auto_reply_min_delay_minutes: number;
}

export default function AutoReplySettingsPage() {
  const [workspaces, setWorkspaces] = useState<WorkspaceSettings[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshingTz, setRefreshingTz] = useState(false);

  // Local edit buffer — applied to DB on Save. Keeps the slider/toggle
  // responsive without a write per keystroke.
  const [draft, setDraft] = useState<WorkspaceSettings | null>(null);
  const { toast } = useToast();

  const loadWorkspaces = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('client_registry')
      .select(
        'workspace_name, auto_reply_enabled, timezone, auto_reply_min_sentiment_confidence, auto_reply_min_audit_score, auto_reply_max_per_hour, auto_reply_min_delay_minutes'
      )
      .order('workspace_name', { ascending: true });

    if (error) {
      toast({ title: 'Error loading workspaces', description: error.message, variant: 'destructive' });
      setLoading(false);
      return;
    }
    setWorkspaces((data ?? []) as WorkspaceSettings[]);
    setLoading(false);
  };

  useEffect(() => {
    loadWorkspaces();
  }, []);

  // When the user picks a workspace, load its settings into the draft buffer.
  useEffect(() => {
    if (!selectedWorkspace) {
      setDraft(null);
      return;
    }
    const ws = workspaces.find((w) => w.workspace_name === selectedWorkspace);
    setDraft(ws ? { ...ws } : null);
  }, [selectedWorkspace, workspaces]);

  const dirty = useMemo(() => {
    if (!draft || !selectedWorkspace) return false;
    const original = workspaces.find((w) => w.workspace_name === selectedWorkspace);
    if (!original) return false;
    return (
      draft.auto_reply_enabled !== original.auto_reply_enabled ||
      draft.auto_reply_min_sentiment_confidence !== original.auto_reply_min_sentiment_confidence ||
      draft.auto_reply_min_audit_score !== original.auto_reply_min_audit_score ||
      draft.auto_reply_max_per_hour !== original.auto_reply_max_per_hour ||
      draft.auto_reply_min_delay_minutes !== original.auto_reply_min_delay_minutes
    );
  }, [draft, workspaces, selectedWorkspace]);

  const handleSave = async () => {
    if (!draft) return;

    // Hard-stop: can't enable without a timezone — eligibility check would
    // reject every reply with skip_reason='no_timezone'. Force the user to
    // refresh from Bison first.
    if (draft.auto_reply_enabled && !draft.timezone) {
      toast({
        title: 'Cannot enable auto-reply',
        description: 'No timezone synced for this workspace. Click "Refresh from Bison" first.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from('client_registry')
      .update({
        auto_reply_enabled: draft.auto_reply_enabled,
        auto_reply_min_sentiment_confidence: draft.auto_reply_min_sentiment_confidence,
        auto_reply_min_audit_score: draft.auto_reply_min_audit_score,
        auto_reply_max_per_hour: draft.auto_reply_max_per_hour,
        auto_reply_min_delay_minutes: draft.auto_reply_min_delay_minutes,
      })
      .eq('workspace_name', draft.workspace_name);

    setSaving(false);
    if (error) {
      toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
      return;
    }

    toast({
      title: 'Saved',
      description: `${draft.workspace_name} settings updated${draft.auto_reply_enabled ? ' (auto-reply ENABLED)' : ''}.`,
    });
    // Reload to refresh the workspace list with the new values.
    await loadWorkspaces();
  };

  const handleRefreshTimezone = async () => {
    if (!draft) return;
    setRefreshingTz(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: 'Not signed in', variant: 'destructive' });
        return;
      }
      const resp = await fetch(
        'https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/sync-bison-schedules',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
            apikey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0',
          },
          body: JSON.stringify({ workspace_name: draft.workspace_name }),
        }
      );
      const body = await resp.json();
      if (!resp.ok || !body.success) {
        throw new Error(body.error || `status ${resp.status}`);
      }
      const detail = (body.details || [])[0];
      if (detail?.status === 'updated') {
        toast({
          title: 'Timezone updated',
          description: `${draft.workspace_name}: ${detail.old_timezone || '(none)'} → ${detail.new_timezone}`,
        });
      } else if (detail?.status === 'unchanged') {
        toast({
          title: 'Timezone unchanged',
          description: `Bison reports ${detail.new_timezone}, already in sync.`,
        });
      } else {
        toast({
          title: 'Could not sync',
          description: `${detail?.status}: ${detail?.reason || 'no details'}`,
          variant: 'destructive',
        });
      }
      await loadWorkspaces();
    } catch (e: any) {
      toast({ title: 'Refresh failed', description: e?.message || 'Unknown', variant: 'destructive' });
    } finally {
      setRefreshingTz(false);
    }
  };

  return (
    <div className="min-h-screen">
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Bot className="h-7 w-7 text-purple-600" />
            <h1 className="text-2xl font-semibold text-foreground">Auto-Reply Settings</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Per-workspace controls for the AI auto-reply pipeline. All workspaces ship disabled —
            flip the switch to opt a client in.
          </p>
        </div>

        {/* Workspace picker */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Label className="text-sm font-medium whitespace-nowrap">Workspace:</Label>
              <Select
                value={selectedWorkspace || ''}
                onValueChange={(v) => setSelectedWorkspace(v || null)}
              >
                <SelectTrigger className="w-full md:w-96">
                  <SelectValue placeholder={loading ? 'Loading…' : 'Pick a workspace…'} />
                </SelectTrigger>
                <SelectContent>
                  {workspaces.map((w) => (
                    <SelectItem key={w.workspace_name} value={w.workspace_name}>
                      <div className="flex items-center gap-2">
                        <span>{w.workspace_name}</span>
                        {w.auto_reply_enabled && (
                          <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200 text-xs ml-2">
                            ON
                          </Badge>
                        )}
                        {!w.timezone && (
                          <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-200 text-xs ml-1">
                            no tz
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {!draft && !loading && (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              Pick a workspace above to view and edit its settings.
            </CardContent>
          </Card>
        )}

        {draft && (
          <>
            {/* Master toggle */}
            <Card className={draft.auto_reply_enabled ? 'border-l-4 border-l-green-500' : 'border-l-4 border-l-muted-foreground/30'}>
              <CardHeader>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Bot className="h-5 w-5 text-purple-600" />
                      Auto-reply for {draft.workspace_name}
                    </CardTitle>
                    <CardDescription>
                      When ON, qualifying inbound replies are drafted by AI, audited, and sent
                      automatically inside the Mon–Fri 7am–7pm window in this workspace's local time.
                    </CardDescription>
                  </div>
                  <Switch
                    checked={draft.auto_reply_enabled}
                    onCheckedChange={(checked) => setDraft({ ...draft, auto_reply_enabled: checked })}
                    aria-label="Enable auto-reply"
                  />
                </div>
              </CardHeader>
              {draft.auto_reply_enabled && !draft.timezone && (
                <CardContent>
                  <div className="flex items-start gap-2 text-sm text-yellow-800 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong>No timezone synced.</strong> Auto-reply will skip every inbound until
                      a timezone is populated. Click "Refresh from Bison" below.
                    </span>
                  </div>
                </CardContent>
              )}
            </Card>

            {/* Timezone */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5 text-blue-600" />
                  Timezone
                </CardTitle>
                <CardDescription>
                  Synced from this workspace's Bison campaign schedule. Determines the local
                  Mon–Fri 7am–7pm window for outbound sends.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-mono text-foreground">
                      {draft.timezone || <span className="text-muted-foreground">(not synced)</span>}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleRefreshTimezone} disabled={refreshingTz}>
                    {refreshingTz ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Refresh from Bison
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Quality thresholds */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-green-600" />
                  Quality thresholds
                </CardTitle>
                <CardDescription>
                  Both must clear for a draft to auto-send. Anything in the gap goes to the
                  Awaiting Review queue.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <ThresholdSlider
                  label="Minimum sentiment confidence"
                  hint="How sure we are the inbound reply is interested. Default 85."
                  value={draft.auto_reply_min_sentiment_confidence}
                  min={50}
                  max={100}
                  onChange={(v) => setDraft({ ...draft, auto_reply_min_sentiment_confidence: v })}
                />
                <ThresholdSlider
                  label="Minimum audit score"
                  hint="LLM-as-judge score (0–100) on the AI draft. Default 90 (strict)."
                  value={draft.auto_reply_min_audit_score}
                  min={50}
                  max={100}
                  onChange={(v) => setDraft({ ...draft, auto_reply_min_audit_score: v })}
                />
              </CardContent>
            </Card>

            {/* Pacing */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-orange-600" />
                  Pacing
                </CardTitle>
                <CardDescription>
                  Keeps auto-replies feeling human and prevents Bison rate-limit issues.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <Label className="text-sm font-medium">Human-feel delay (minutes)</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Floor between an inbound landing and our auto-send. Default 10.
                    </p>
                  </div>
                  <Input
                    type="number"
                    min={0}
                    max={1440}
                    value={draft.auto_reply_min_delay_minutes}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        auto_reply_min_delay_minutes: Math.max(0, Math.min(1440, Number(e.target.value) || 0)),
                      })
                    }
                    className="w-24"
                  />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <Label className="text-sm font-medium">Max auto-sends per hour</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Worker defers excess sends 30 min when this cap is hit. Default 30.
                    </p>
                  </div>
                  <Input
                    type="number"
                    min={0}
                    max={1000}
                    value={draft.auto_reply_max_per_hour}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        auto_reply_max_per_hour: Math.max(0, Math.min(1000, Number(e.target.value) || 0)),
                      })
                    }
                    className="w-24"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Save bar */}
            <div className="sticky bottom-4 flex justify-end">
              <Button
                size="lg"
                onClick={handleSave}
                disabled={!dirty || saving}
                className="shadow-lg"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {dirty ? 'Save changes' : 'No changes'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

interface ThresholdSliderProps {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}

function ThresholdSlider({ label, hint, value, min, max, onChange }: ThresholdSliderProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <Label className="text-sm font-medium">{label}</Label>
        <span className="text-sm font-mono text-foreground">{value}</span>
      </div>
      <p className="text-xs text-muted-foreground mb-2">{hint}</p>
      <Slider
        min={min}
        max={max}
        step={1}
        value={[value]}
        onValueChange={(v) => onChange(v[0])}
      />
      <div className="flex justify-between text-xs text-muted-foreground mt-1">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}
