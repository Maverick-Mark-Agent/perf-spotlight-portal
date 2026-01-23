import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Save, RefreshCw, Building2, CheckCircle2, XCircle, Activity, AlertCircle, Eye, EyeOff, Key, Zap, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ReplyTemplatesTab } from '@/components/client-profile/ReplyTemplatesTab';
import OnboardingChecklist from '@/components/client-profile/OnboardingChecklist';

interface ClientFullData {
  // Identity
  workspace_id: number;
  workspace_name: string;
  display_name: string | null;
  is_active: boolean;
  client_type: 'home_insurance' | 'other';

  // Email Bison Integration
  bison_workspace_id: number | null;
  bison_workspace_name: string | null;

  // Billing
  billing_type: string;
  price_per_lead: number;
  retainer_amount: number;
  payout: number | null;
  billing_contact_email: string | null;
  billing_frequency: string | null;
  auto_billing_enabled: boolean;

  // Lead Targets
  monthly_kpi_target: number;
  lead_tier: string | null;
  kpi_calculation_method: string | null;

  // Contact Pipeline
  monthly_contact_target: number | null;
  contact_tier: string | null;
  weekly_batch_schedule: number | null;
  debounce_credits_allocated: number | null;
  target_campaign_name: string | null;
  hnw_enabled: boolean;

  // Email Sending
  daily_sending_target: number | null;
  monthly_sending_target: number | null;
  sending_tier: string | null;
  warmup_phase: boolean;

  // Territory
  territory_states: string[] | null;
  zip_assignment_type: string | null;
  agency_color: string | null;

  // Costs
  cost_per_lead: number | null;
  labor_cost_allocation: number | null;
  email_account_costs: number | null;

  // Portal
  portal_access_enabled: boolean;
  default_commission_rate: number | null;
  portal_custom_branding: any | null;

  // ROI Defaults
  default_conversion_rate: number | null;
  default_avg_deal_size: number | null;
  default_customer_ltv: number | null;

  // Metadata
  notes: string | null;
  created_at: string;
  updated_at: string;

  // API & Webhook Management
  bison_api_key: string | null;
  bison_api_key_name: string | null;
  bison_api_key_created_at: string | null;
  bison_api_key_last_used_at: string | null;
  bison_api_key_status: string | null;
  bison_webhook_url: string | null;
  bison_webhook_secret: string | null;
  bison_webhook_enabled: boolean;
  bison_webhook_events: string[] | null;
  bison_webhook_last_received_at: string | null;
  bison_webhook_health: string | null;
  api_last_successful_call_at: string | null;
  api_last_failed_call_at: string | null;
  api_consecutive_failures: number;
  api_calls_today: number;
  api_errors_today: number;
  api_health_status: string | null;
  bison_instance: string | null;

  // Feature Toggles
  kpi_dashboard_enabled: boolean;
  volume_dashboard_enabled: boolean;
  live_replies_enabled: boolean;
  disconnect_notifications_enabled: boolean;
  slack_webhook_url: string | null;
}

const ClientProfile: React.FC = () => {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [client, setClient] = useState<ClientFullData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [apiLogs, setApiLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [completingSetup, setCompletingSetup] = useState(false);

  const fetchClient = async () => {
    if (!workspaceId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('client_registry')
        .select('*')
        .eq('workspace_id', parseInt(workspaceId))
        .single();

      if (error) throw error;
      setClient(data);
      setHasChanges(false);
    } catch (error) {
      console.error('Error fetching client:', error);
      toast({
        title: 'Error',
        description: 'Failed to load client data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClient();
  }, [workspaceId]);

  useEffect(() => {
    if (client?.workspace_name) {
      fetchApiLogs();
    }
  }, [client?.workspace_name]);

  const fetchApiLogs = async () => {
    if (!client?.workspace_name) return;

    setLoadingLogs(true);
    try {
      const { data, error } = await supabase
        .from('workspace_api_logs')
        .select('*')
        .eq('workspace_name', client.workspace_name)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setApiLogs(data || []);
    } catch (error) {
      console.error('Error fetching API logs:', error);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleFieldChange = (field: keyof ClientFullData, value: any) => {
    if (!client) return;
    setClient({ ...client, [field]: value });
    setHasChanges(true);
  };

  const triggerCompleteSetup = async () => {
    if (!client) return;

    setCompletingSetup(true);
    try {
      const { data, error } = await supabase.functions.invoke('complete-client-setup', {
        body: { workspace_name: client.workspace_name }
      });

      if (error) {
        toast({
          title: 'Setup Error',
          description: error.message,
          variant: 'destructive',
        });
        return;
      }

      if (data?.success) {
        toast({
          title: 'Setup Complete',
          description: `Webhooks created and email sync triggered for "${client.display_name || client.workspace_name}"`,
        });
        // Refresh client data to show updated status
        fetchClient();
      } else if (data?.errors?.length > 0) {
        toast({
          title: 'Partial Setup',
          description: data.errors.join(', '),
          variant: 'default',
        });
        fetchClient();
      }
    } catch (err: any) {
      toast({
        title: 'Setup Failed',
        description: err.message || 'Failed to complete setup',
        variant: 'destructive',
      });
    } finally {
      setCompletingSetup(false);
    }
  };

  const handleSave = async () => {
    if (!client) return;

    setSaving(true);
    try {
      // If changing to home_insurance, check if ZIP placeholder exists
      console.log('[ClientProfile] Saving client, client_type:', client.client_type);
      if (client.client_type === 'home_insurance') {
        console.log('[ClientProfile] Client is home_insurance, checking for ZIP placeholder...');
        const { data: existingZip, error: zipCheckError } = await supabase
          .from('client_zipcodes')
          .select('zip')
          .eq('workspace_name', client.workspace_name)
          .limit(1);

        console.log('[ClientProfile] Existing ZIP check:', { existingZip, zipCheckError });

        // Create ZIP placeholder if it doesn't exist
        if (!existingZip || existingZip.length === 0) {
          console.log('[ClientProfile] No ZIP found, creating placeholder...');
          const currentMonth = new Date().toISOString().slice(0, 7);
          const insertData = {
            zip: '00000',
            month: currentMonth,
            client_name: client.display_name || client.workspace_name,
            workspace_name: client.workspace_name,
            agency_color: client.agency_color || '#3B82F6',
            state: null,
          };
          console.log('[ClientProfile] Inserting ZIP with data:', insertData);

          const { data: insertResult, error: insertError } = await supabase
            .from('client_zipcodes')
            .insert(insertData)
            .select();

          console.log('[ClientProfile] ZIP insert result:', { insertResult, insertError });

          if (insertError) {
            // Log the error but don't block the save - ZIP placeholder is not critical
            console.warn('[ClientProfile] Failed to create ZIP placeholder (non-blocking):', insertError);
          } else {
            console.log('[ClientProfile] ✅ ZIP placeholder created successfully!');
          }
        } else {
          console.log('[ClientProfile] ZIP already exists, skipping creation');
        }
      }

      const { error } = await supabase
        .from('client_registry')
        .update({
          display_name: client.display_name,
          is_active: client.is_active,
          client_type: client.client_type,
          bison_workspace_id: client.bison_workspace_id,
          bison_workspace_name: client.bison_workspace_name,
          billing_type: client.billing_type,
          price_per_lead: client.price_per_lead,
          retainer_amount: client.retainer_amount,
          payout: client.payout,
          billing_contact_email: client.billing_contact_email,
          billing_frequency: client.billing_frequency,
          auto_billing_enabled: client.auto_billing_enabled,
          monthly_kpi_target: client.monthly_kpi_target,
          lead_tier: client.lead_tier,
          kpi_calculation_method: client.kpi_calculation_method,
          monthly_contact_target: client.monthly_contact_target,
          contact_tier: client.contact_tier,
          weekly_batch_schedule: client.weekly_batch_schedule,
          debounce_credits_allocated: client.debounce_credits_allocated,
          target_campaign_name: client.target_campaign_name,
          hnw_enabled: client.hnw_enabled,
          daily_sending_target: client.daily_sending_target,
          monthly_sending_target: client.monthly_sending_target,
          sending_tier: client.sending_tier,
          warmup_phase: client.warmup_phase,
          territory_states: client.territory_states,
          zip_assignment_type: client.zip_assignment_type,
          agency_color: client.agency_color,
          cost_per_lead: client.cost_per_lead,
          labor_cost_allocation: client.labor_cost_allocation,
          email_account_costs: client.email_account_costs,
          portal_access_enabled: client.portal_access_enabled,
          kpi_dashboard_enabled: client.kpi_dashboard_enabled,
          volume_dashboard_enabled: client.volume_dashboard_enabled,
          live_replies_enabled: client.live_replies_enabled,
          disconnect_notifications_enabled: client.disconnect_notifications_enabled,
          slack_webhook_url: client.slack_webhook_url,
          default_commission_rate: client.default_commission_rate,
          portal_custom_branding: client.portal_custom_branding,
          default_conversion_rate: client.default_conversion_rate,
          default_avg_deal_size: client.default_avg_deal_size,
          default_customer_ltv: client.default_customer_ltv,
          notes: client.notes,
          bison_api_key: client.bison_api_key,
        })
        .eq('workspace_id', client.workspace_id);

      if (error) throw error;

      setHasChanges(false);
      toast({
        title: 'Success',
        description: `${client.display_name || client.workspace_name} updated successfully`,
      });
    } catch (error: any) {
      console.error('Error saving client:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save client',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Client Not Found</CardTitle>
            <CardDescription>The requested client could not be found.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to="/client-management">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Client List
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-4 mb-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/client-management">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Clients
              </Link>
            </Button>
          </div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Building2 className="h-8 w-8" />
            {client.display_name || client.workspace_name}
            {client.is_active ? (
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Active
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-200">
                <XCircle className="h-3 w-3 mr-1" />
                Inactive
              </Badge>
            )}
          </h1>
          <p className="text-muted-foreground">
            Workspace: {client.workspace_name}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchClient}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={handleSave} disabled={saving || !hasChanges}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="billing">Billing & Targets</TabsTrigger>
          <TabsTrigger value="features">Features</TabsTrigger>
          <TabsTrigger value="templates">Reply Templates</TabsTrigger>
          <TabsTrigger value="api">API</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          {/* Onboarding Checklist - shows if setup is incomplete */}
          <OnboardingChecklist
            workspaceName={client.workspace_name}
            workspaceId={client.workspace_id}
            onSetupComplete={fetchClient}
          />

          <Card>
            <CardHeader>
              <CardTitle>General Information</CardTitle>
              <CardDescription>Basic client identity and status</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="display_name">Display Name</Label>
                  <Input
                    id="display_name"
                    value={client.display_name || ''}
                    onChange={(e) => handleFieldChange('display_name', e.target.value)}
                    placeholder="Client display name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="workspace_name">Workspace Name (Read-only)</Label>
                  <Input
                    id="workspace_name"
                    value={client.workspace_name}
                    disabled
                    className="bg-muted"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_active"
                    checked={client.is_active}
                    onCheckedChange={(checked) => handleFieldChange('is_active', checked)}
                  />
                  <Label htmlFor="is_active">Active Client</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="client_type"
                    checked={client.client_type === 'home_insurance'}
                    onCheckedChange={(checked) => handleFieldChange('client_type', checked ? 'home_insurance' : 'other')}
                  />
                  <Label htmlFor="client_type">Home Insurance Client</Label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bison_workspace_id">Email Bison Workspace ID</Label>
                  <Input
                    id="bison_workspace_id"
                    type="number"
                    value={client.bison_workspace_id || ''}
                    onChange={(e) => handleFieldChange('bison_workspace_id', e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="22"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="agency_color">Agency Color (for ZIP Dashboard)</Label>
                  <div className="flex gap-2">
                    <Input
                      id="agency_color"
                      value={client.agency_color || ''}
                      onChange={(e) => handleFieldChange('agency_color', e.target.value)}
                      placeholder="#FF5733"
                    />
                    {client.agency_color && (
                      <div
                        className="w-10 h-10 rounded border flex-shrink-0"
                        style={{ backgroundColor: client.agency_color }}
                      />
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={client.notes || ''}
                  onChange={(e) => handleFieldChange('notes', e.target.value)}
                  placeholder="Internal notes about this client"
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Billing & Targets Tab */}
        <TabsContent value="billing" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Billing & Targets</CardTitle>
              <CardDescription>Pricing, payments, and performance targets</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Billing Section */}
              <div>
                <h3 className="font-semibold mb-3">Billing</h3>
                <div className="grid grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="billing_type">Billing Type</Label>
                    <Select
                      value={client.billing_type}
                      onValueChange={(value) => handleFieldChange('billing_type', value)}
                    >
                      <SelectTrigger id="billing_type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="per_lead">Per Lead</SelectItem>
                        <SelectItem value="retainer">Retainer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="price_per_lead">Price Per Lead ($)</Label>
                    <Input
                      id="price_per_lead"
                      type="number"
                      step="0.01"
                      value={client.price_per_lead || 0}
                      onChange={(e) => handleFieldChange('price_per_lead', parseFloat(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="retainer_amount">Monthly Retainer ($)</Label>
                    <Input
                      id="retainer_amount"
                      type="number"
                      step="0.01"
                      value={client.retainer_amount || 0}
                      onChange={(e) => handleFieldChange('retainer_amount', parseFloat(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="payout">Monthly Payout ($)</Label>
                    <Input
                      id="payout"
                      type="number"
                      step="0.01"
                      value={client.payout || 0}
                      onChange={(e) => handleFieldChange('payout', parseFloat(e.target.value))}
                    />
                  </div>
                </div>
              </div>

              {/* Targets Section */}
              <div>
                <h3 className="font-semibold mb-3">Targets</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="monthly_kpi_target">Monthly Lead Target</Label>
                    <Input
                      id="monthly_kpi_target"
                      type="number"
                      value={client.monthly_kpi_target || 0}
                      onChange={(e) => handleFieldChange('monthly_kpi_target', parseInt(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="daily_sending_target">Daily Sending Target</Label>
                    <Input
                      id="daily_sending_target"
                      type="number"
                      value={client.daily_sending_target || 0}
                      onChange={(e) => handleFieldChange('daily_sending_target', parseInt(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="monthly_sending_target">Monthly Sending Target</Label>
                    <Input
                      id="monthly_sending_target"
                      type="number"
                      value={client.monthly_sending_target || 0}
                      onChange={(e) => handleFieldChange('monthly_sending_target', parseInt(e.target.value))}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Features Tab */}
        <TabsContent value="features" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Dashboard Access</CardTitle>
              <CardDescription>Enable or disable dashboards for this client</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-4 border rounded-lg bg-blue-50/50 dark:bg-blue-950/20">
                  <div>
                    <Label htmlFor="is_active" className="font-medium">Email Infrastructure Dashboard</Label>
                    <p className="text-xs text-muted-foreground">Enable email account polling & sync</p>
                  </div>
                  <Switch
                    id="is_active"
                    checked={client.is_active}
                    onCheckedChange={(checked) => handleFieldChange('is_active', checked)}
                  />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <Label htmlFor="kpi_dashboard_enabled" className="font-medium">KPI Dashboard</Label>
                    <p className="text-xs text-muted-foreground">Lead generation tracking</p>
                  </div>
                  <Switch
                    id="kpi_dashboard_enabled"
                    checked={client.kpi_dashboard_enabled ?? true}
                    onCheckedChange={(checked) => handleFieldChange('kpi_dashboard_enabled', checked)}
                  />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <Label htmlFor="volume_dashboard_enabled" className="font-medium">Volume Dashboard</Label>
                    <p className="text-xs text-muted-foreground">Email sending metrics</p>
                  </div>
                  <Switch
                    id="volume_dashboard_enabled"
                    checked={client.volume_dashboard_enabled ?? true}
                    onCheckedChange={(checked) => handleFieldChange('volume_dashboard_enabled', checked)}
                  />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <Label htmlFor="portal_access_enabled" className="font-medium">Client Portal</Label>
                    <p className="text-xs text-muted-foreground">Lead pipeline portal access</p>
                  </div>
                  <Switch
                    id="portal_access_enabled"
                    checked={client.portal_access_enabled}
                    onCheckedChange={(checked) => handleFieldChange('portal_access_enabled', checked)}
                  />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <Label htmlFor="live_replies_enabled" className="font-medium">Live Replies Board</Label>
                    <p className="text-xs text-muted-foreground">Real-time reply monitoring</p>
                  </div>
                  <Switch
                    id="live_replies_enabled"
                    checked={client.live_replies_enabled ?? true}
                    onCheckedChange={(checked) => handleFieldChange('live_replies_enabled', checked)}
                  />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <Label htmlFor="disconnect_notifications_enabled" className="font-medium">Disconnect Notifications</Label>
                    <p className="text-xs text-muted-foreground">Slack alerts when email accounts disconnect</p>
                  </div>
                  <Switch
                    id="disconnect_notifications_enabled"
                    checked={client.disconnect_notifications_enabled ?? true}
                    onCheckedChange={(checked) => handleFieldChange('disconnect_notifications_enabled', checked)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
              <CardDescription>Slack webhook for lead notifications</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="slack_webhook_url">Slack Webhook URL</Label>
                <Input
                  id="slack_webhook_url"
                  value={client.slack_webhook_url || ''}
                  onChange={(e) => handleFieldChange('slack_webhook_url', e.target.value)}
                  placeholder="https://hooks.slack.com/services/..."
                />
                <p className="text-xs text-muted-foreground">
                  Receives notifications when interested leads come in
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>


        {/* API Tab */}
        <TabsContent value="api" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>API Health</CardTitle>
              <CardDescription>Email Bison API status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Health Status</Label>
                  <div className="flex items-center gap-2">
                    {client.api_health_status === 'healthy' && (
                      <Badge className="bg-green-50 text-green-700 border-green-200">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Healthy
                      </Badge>
                    )}
                    {client.api_health_status === 'degraded' && (
                      <Badge className="bg-yellow-50 text-yellow-700 border-yellow-200">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Degraded
                      </Badge>
                    )}
                    {client.api_health_status === 'failing' && (
                      <Badge className="bg-red-50 text-red-700 border-red-200">
                        <XCircle className="h-3 w-3 mr-1" />
                        Failing
                      </Badge>
                    )}
                    {(!client.api_health_status || client.api_health_status === 'no_key') && (
                      <Badge className="bg-gray-50 text-gray-600 border-gray-200">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Not Configured
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Instance</Label>
                  <p className="text-sm text-muted-foreground">
                    {client.bison_instance === 'maverick' ? 'Maverick' : client.bison_instance === 'longrun' ? 'Long Run' : 'Not configured'}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Workspace ID</Label>
                  <p className="text-sm text-muted-foreground">
                    {client.bison_workspace_id || 'Not configured'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* API Key Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="w-4 h-4" />
                API Key Configuration
              </CardTitle>
              <CardDescription>
                Workspace-specific API key for webhook creation and email sync
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="bison_api_key">Email Bison API Key</Label>
                <div className="flex gap-2">
                  <Input
                    id="bison_api_key"
                    type={showApiKey ? 'text' : 'password'}
                    value={client.bison_api_key || ''}
                    onChange={(e) => handleFieldChange('bison_api_key', e.target.value)}
                    placeholder="e.g., 95|LISJUmFy..."
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setShowApiKey(!showApiKey)}
                  >
                    {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Get this from Email Bison workspace settings. Required for webhook creation and email account sync.
                </p>
              </div>

              {/* Complete Setup Button - shows if API key exists but webhooks not configured */}
              {client.bison_api_key && !client.bison_webhook_enabled && (
                <div className="pt-2">
                  <Button
                    onClick={triggerCompleteSetup}
                    disabled={completingSetup || hasChanges}
                    className="w-full"
                  >
                    {completingSetup ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Setting up webhooks...
                      </>
                    ) : hasChanges ? (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Save changes first
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4 mr-2" />
                        Complete Setup (Create Webhooks + Sync)
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    This will create webhooks for Live Replies and Slack notifications, then trigger an email account sync.
                  </p>
                </div>
              )}

              {/* Webhook Status */}
              {client.bison_webhook_enabled && (
                <div className="pt-2 border-t">
                  <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Webhooks configured and active</span>
                  </div>
                  {client.bison_webhook_events && (
                    <div className="mt-2 flex gap-2 flex-wrap">
                      {client.bison_webhook_events.map((event) => (
                        <Badge key={event} variant="outline" className="text-xs">
                          {event}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* API Call Logs */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Recent API Calls</CardTitle>
                <CardDescription>Last 50 API calls for this workspace</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={fetchApiLogs}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </CardHeader>
            <CardContent>
              {loadingLogs ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : apiLogs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No API calls recorded yet</p>
                </div>
              ) : (
                <div className="relative max-h-[400px] overflow-auto border rounded-md">
                  <Table>
                    <TableHeader className="sticky top-0 bg-card z-10">
                      <TableRow>
                        <TableHead className="bg-card">Timestamp</TableHead>
                        <TableHead className="bg-card">Endpoint</TableHead>
                        <TableHead className="bg-card">Status</TableHead>
                        <TableHead className="text-right bg-card">Response Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {apiLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="text-xs">
                            {new Date(log.created_at).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-xs font-mono max-w-[200px] truncate">
                            {log.endpoint}
                          </TableCell>
                          <TableCell>
                            {log.success ? (
                              <Badge className="bg-green-50 text-green-700 border-green-200 text-xs">
                                {log.status_code}
                              </Badge>
                            ) : (
                              <Badge className="bg-red-50 text-red-700 border-red-200 text-xs">
                                {log.status_code || 'Error'}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right text-xs">
                            {log.response_time_ms}ms
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reply Templates Tab */}
        <TabsContent value="templates" className="space-y-4">
          <ReplyTemplatesTab
            workspaceName={client.workspace_name}
            clientDisplayName={client.display_name || client.workspace_name}
          />
        </TabsContent>

      </Tabs>
    </div>
  );
};

export default ClientProfile;
