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
import { ArrowLeft, Save, RefreshCw, Building2, CheckCircle2, XCircle, Activity, AlertCircle, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ROUTES } from '@/constants/navigation';

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
            console.error('[ClientProfile] Failed to create ZIP placeholder:', insertError);
            throw new Error(`Failed to create ZIP placeholder: ${insertError.message}`);
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
          default_commission_rate: client.default_commission_rate,
          portal_custom_branding: client.portal_custom_branding,
          default_conversion_rate: client.default_conversion_rate,
          default_avg_deal_size: client.default_avg_deal_size,
          default_customer_ltv: client.default_customer_ltv,
          notes: client.notes,
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
              <Link to={ROUTES.CLIENT_MANAGEMENT}>
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
              <Link to={ROUTES.CLIENT_MANAGEMENT}>
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
      <Tabs defaultValue="general" className="space-y-4">
        <TabsList className="grid w-full grid-cols-8">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="targets">Targets</TabsTrigger>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="territory">Territory</TabsTrigger>
          <TabsTrigger value="costs">Costs</TabsTrigger>
          <TabsTrigger value="api">API & Webhooks</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>

        {/* General Tab */}
        <TabsContent value="general" className="space-y-4">
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
                  <Label htmlFor="client_type">Home Insurance (ZIP Dashboard + Contact Pipeline)</Label>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={client.notes || ''}
                  onChange={(e) => handleFieldChange('notes', e.target.value)}
                  placeholder="Internal notes about this client"
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Email Bison Integration</CardTitle>
              <CardDescription>Workspace mapping for Volume Dashboard and sending metrics</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
                  <p className="text-xs text-muted-foreground">
                    The workspace ID from Email Bison API (used for accurate data matching)
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bison_workspace_name">Email Bison Workspace Name</Label>
                  <Input
                    id="bison_workspace_name"
                    value={client.bison_workspace_name || ''}
                    onChange={(e) => handleFieldChange('bison_workspace_name', e.target.value)}
                    placeholder="STREETSMART P&C"
                  />
                  <p className="text-xs text-muted-foreground">
                    The exact workspace name in Email Bison (for verification)
                  </p>
                </div>
              </div>
              {!client.bison_workspace_id && (
                <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-md">
                  <XCircle className="h-4 w-4 text-amber-600" />
                  <p className="text-sm text-amber-800">
                    Warning: No Email Bison workspace mapped. Volume Dashboard data may be incorrect.
                  </p>
                </div>
              )}
              {client.bison_workspace_id && (
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-md">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <p className="text-sm text-green-800">
                    Workspace ID {client.bison_workspace_id} mapped successfully
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Billing Tab */}
        <TabsContent value="billing" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Billing Configuration</CardTitle>
              <CardDescription>Pricing, payments, and billing settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
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
                  <Label htmlFor="billing_frequency">Billing Frequency</Label>
                  <Select
                    value={client.billing_frequency || 'monthly'}
                    onValueChange={(value) => handleFieldChange('billing_frequency', value)}
                  >
                    <SelectTrigger id="billing_frequency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="annual">Annual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
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

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="billing_contact_email">Billing Contact Email</Label>
                  <Input
                    id="billing_contact_email"
                    type="email"
                    value={client.billing_contact_email || ''}
                    onChange={(e) => handleFieldChange('billing_contact_email', e.target.value)}
                    placeholder="billing@client.com"
                  />
                </div>
                <div className="flex items-center space-x-2 pt-8">
                  <Switch
                    id="auto_billing_enabled"
                    checked={client.auto_billing_enabled}
                    onCheckedChange={(checked) => handleFieldChange('auto_billing_enabled', checked)}
                  />
                  <Label htmlFor="auto_billing_enabled">Auto Billing Enabled</Label>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Targets Tab */}
        <TabsContent value="targets" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance Targets</CardTitle>
              <CardDescription>Lead generation and email sending targets</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="font-semibold mb-3">Lead Generation</h3>
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
                    <Label htmlFor="lead_tier">Lead Tier</Label>
                    <Select
                      value={client.lead_tier || ''}
                      onValueChange={(value) => handleFieldChange('lead_tier', value)}
                    >
                      <SelectTrigger id="lead_tier">
                        <SelectValue placeholder="Select tier" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="100_leads">100 Leads/Month</SelectItem>
                        <SelectItem value="200_leads">200 Leads/Month</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="kpi_calculation_method">KPI Method</Label>
                    <Select
                      value={client.kpi_calculation_method || 'positive_replies'}
                      onValueChange={(value) => handleFieldChange('kpi_calculation_method', value)}
                    >
                      <SelectTrigger id="kpi_calculation_method">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="positive_replies">Positive Replies</SelectItem>
                        <SelectItem value="all_leads">All Leads</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-3">Email Sending</h3>
                <div className="grid grid-cols-3 gap-4">
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
                  <div className="space-y-2">
                    <Label htmlFor="sending_tier">Sending Tier</Label>
                    <Select
                      value={client.sending_tier || ''}
                      onValueChange={(value) => handleFieldChange('sending_tier', value)}
                    >
                      <SelectTrigger id="sending_tier">
                        <SelectValue placeholder="Select tier" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low (&lt; 15k/mo)</SelectItem>
                        <SelectItem value="medium">Medium (15-30k/mo)</SelectItem>
                        <SelectItem value="high">High (30-60k/mo)</SelectItem>
                        <SelectItem value="enterprise">Enterprise (&gt; 60k/mo)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-center space-x-2 mt-4">
                  <Switch
                    id="warmup_phase"
                    checked={client.warmup_phase}
                    onCheckedChange={(checked) => handleFieldChange('warmup_phase', checked)}
                  />
                  <Label htmlFor="warmup_phase">Email Warmup Phase Active</Label>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pipeline Tab */}
        <TabsContent value="pipeline" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Contact Pipeline Settings</CardTitle>
              <CardDescription>Contact list processing and batch upload configuration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="monthly_contact_target">Monthly Contact Target</Label>
                  <Input
                    id="monthly_contact_target"
                    type="number"
                    value={client.monthly_contact_target || 0}
                    onChange={(e) => handleFieldChange('monthly_contact_target', parseInt(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact_tier">Contact Tier</Label>
                  <Select
                    value={client.contact_tier || ''}
                    onValueChange={(value) => handleFieldChange('contact_tier', value)}
                  >
                    <SelectTrigger id="contact_tier">
                      <SelectValue placeholder="Select tier" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="100_leads">100 Leads (15k contacts)</SelectItem>
                      <SelectItem value="200_leads">200 Leads (30k contacts)</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="weekly_batch_schedule">Weekly Batch Schedule</Label>
                  <Select
                    value={client.weekly_batch_schedule?.toString() || ''}
                    onValueChange={(value) => handleFieldChange('weekly_batch_schedule', parseInt(value))}
                  >
                    <SelectTrigger id="weekly_batch_schedule">
                      <SelectValue placeholder="Select week" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Week 1</SelectItem>
                      <SelectItem value="2">Week 2</SelectItem>
                      <SelectItem value="3">Week 3</SelectItem>
                      <SelectItem value="4">Week 4</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="debounce_credits_allocated">Debounce Credits/Month</Label>
                  <Input
                    id="debounce_credits_allocated"
                    type="number"
                    value={client.debounce_credits_allocated || 0}
                    onChange={(e) => handleFieldChange('debounce_credits_allocated', parseInt(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="target_campaign_name">Target Campaign Name</Label>
                  <Input
                    id="target_campaign_name"
                    value={client.target_campaign_name || ''}
                    onChange={(e) => handleFieldChange('target_campaign_name', e.target.value)}
                    placeholder="Evergreen"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="hnw_enabled"
                  checked={client.hnw_enabled}
                  onCheckedChange={(checked) => handleFieldChange('hnw_enabled', checked)}
                />
                <Label htmlFor="hnw_enabled">High Net Worth (HNW) Routing Enabled</Label>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Territory Tab */}
        <TabsContent value="territory" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Territory & ZIP Management</CardTitle>
              <CardDescription>Geographic coverage and ZIP code assignments</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="agency_color">Agency Color (Hex)</Label>
                  <div className="flex gap-2">
                    <Input
                      id="agency_color"
                      value={client.agency_color || ''}
                      onChange={(e) => handleFieldChange('agency_color', e.target.value)}
                      placeholder="#FF5733"
                    />
                    {client.agency_color && (
                      <div
                        className="w-10 h-10 rounded border"
                        style={{ backgroundColor: client.agency_color }}
                      />
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="zip_assignment_type">ZIP Assignment Type</Label>
                  <Select
                    value={client.zip_assignment_type || ''}
                    onValueChange={(value) => handleFieldChange('zip_assignment_type', value)}
                  >
                    <SelectTrigger id="zip_assignment_type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="exclusive">Exclusive</SelectItem>
                      <SelectItem value="shared">Shared</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="territory_states">Territory States (comma-separated)</Label>
                <Input
                  id="territory_states"
                  value={client.territory_states?.join(', ') || ''}
                  onChange={(e) => handleFieldChange('territory_states', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                  placeholder="TX, OK, LA, AR"
                />
                <p className="text-xs text-muted-foreground">
                  Enter state codes separated by commas (e.g., CA, NV, AZ)
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Costs Tab */}
        <TabsContent value="costs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Cost Allocation</CardTitle>
              <CardDescription>Internal costs and profitability tracking</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cost_per_lead">Cost Per Lead ($)</Label>
                  <Input
                    id="cost_per_lead"
                    type="number"
                    step="0.01"
                    value={client.cost_per_lead || 0}
                    onChange={(e) => handleFieldChange('cost_per_lead', parseFloat(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="labor_cost_allocation">Labor Cost % (%)</Label>
                  <Input
                    id="labor_cost_allocation"
                    type="number"
                    step="0.01"
                    value={client.labor_cost_allocation || 0}
                    onChange={(e) => handleFieldChange('labor_cost_allocation', parseFloat(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email_account_costs">Email Costs/Month ($)</Label>
                  <Input
                    id="email_account_costs"
                    type="number"
                    step="0.01"
                    value={client.email_account_costs || 0}
                    onChange={(e) => handleFieldChange('email_account_costs', parseFloat(e.target.value))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* API & Webhooks Tab */}
        <TabsContent value="api" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>API Health & Status</CardTitle>
              <CardDescription>Workspace-specific API key health and monitoring</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Health Status */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">API Health Status</Label>
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
                    {client.api_health_status === 'no_key' && (
                      <Badge className="bg-gray-50 text-gray-600 border-gray-200">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        No API Key
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Email Bison Instance</Label>
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

              {/* API Key Info */}
              <div>
                <h3 className="font-semibold mb-3">API Key Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">API Key Suffix</Label>
                    <p className="text-sm font-mono text-muted-foreground">
                      {client.bison_api_key ? `...${client.bison_api_key.slice(-8)}` : 'No API key configured'}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Key Status</Label>
                    <Badge variant="outline" className={
                      client.bison_api_key_status === 'active' ? 'bg-green-50 text-green-700 border-green-200' :
                      'bg-gray-50 text-gray-600 border-gray-200'
                    }>
                      {client.bison_api_key_status || 'N/A'}
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Last Used</Label>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      {client.bison_api_key_last_used_at
                        ? new Date(client.bison_api_key_last_used_at).toLocaleString()
                        : 'Never'}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Consecutive Failures</Label>
                    <p className={`text-sm font-medium ${
                      client.api_consecutive_failures === 0 ? 'text-green-600' :
                      client.api_consecutive_failures < 3 ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {client.api_consecutive_failures || 0}
                    </p>
                  </div>
                </div>
              </div>

              {/* Today's Stats */}
              <div>
                <h3 className="font-semibold mb-3">Today's Activity</h3>
                <div className="grid grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">API Calls</Label>
                    <p className="text-2xl font-bold">{client.api_calls_today || 0}</p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Errors</Label>
                    <p className={`text-2xl font-bold ${
                      (client.api_errors_today || 0) === 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {client.api_errors_today || 0}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Last Success</Label>
                    <p className="text-xs text-muted-foreground">
                      {client.api_last_successful_call_at
                        ? new Date(client.api_last_successful_call_at).toLocaleTimeString()
                        : 'Never'}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Last Failure</Label>
                    <p className="text-xs text-muted-foreground">
                      {client.api_last_failed_call_at
                        ? new Date(client.api_last_failed_call_at).toLocaleTimeString()
                        : 'Never'}
                    </p>
                  </div>
                </div>
              </div>
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
                Refresh Logs
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
                        <TableHead className="bg-card">Method</TableHead>
                        <TableHead className="bg-card">Status</TableHead>
                        <TableHead className="text-right bg-card">Response Time</TableHead>
                        <TableHead className="bg-card">Function</TableHead>
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
                            <Badge variant="outline" className="text-xs">
                              {log.method}
                            </Badge>
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
                          <TableCell className="text-xs text-muted-foreground">
                            {log.edge_function || 'N/A'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Webhook Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>Webhook Configuration</CardTitle>
              <CardDescription>Email Bison webhook settings and health</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Webhook Status</Label>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={client.bison_webhook_enabled}
                      disabled
                    />
                    <Label className="text-sm">
                      {client.bison_webhook_enabled ? 'Enabled' : 'Disabled'}
                    </Label>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Webhook Health</Label>
                  <Badge variant="outline" className={
                    client.bison_webhook_health === 'healthy' ? 'bg-green-50 text-green-700 border-green-200' :
                    client.bison_webhook_health === 'degraded' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                    client.bison_webhook_health === 'failing' ? 'bg-red-50 text-red-700 border-red-200' :
                    'bg-gray-50 text-gray-600 border-gray-200'
                  }>
                    {client.bison_webhook_health || 'disabled'}
                  </Badge>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Webhook URL</Label>
                  <p className="text-xs font-mono text-muted-foreground break-all">
                    {client.bison_webhook_url || 'Not configured'}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Last Event Received</Label>
                  <p className="text-xs text-muted-foreground">
                    {client.bison_webhook_last_received_at
                      ? new Date(client.bison_webhook_last_received_at).toLocaleString()
                      : 'Never'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Advanced Tab */}
        <TabsContent value="advanced" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Advanced Settings</CardTitle>
              <CardDescription>Portal access and ROI defaults</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="font-semibold mb-3">Client Portal</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="portal_access_enabled"
                      checked={client.portal_access_enabled}
                      onCheckedChange={(checked) => handleFieldChange('portal_access_enabled', checked)}
                    />
                    <Label htmlFor="portal_access_enabled">Portal Access Enabled</Label>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="default_commission_rate">Default Commission Rate (%)</Label>
                    <Input
                      id="default_commission_rate"
                      type="number"
                      step="0.01"
                      value={client.default_commission_rate || 0}
                      onChange={(e) => handleFieldChange('default_commission_rate', parseFloat(e.target.value))}
                    />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-3">ROI Calculator Defaults</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="default_conversion_rate">Conversion Rate (%)</Label>
                    <Input
                      id="default_conversion_rate"
                      type="number"
                      step="0.01"
                      value={client.default_conversion_rate || 0}
                      onChange={(e) => handleFieldChange('default_conversion_rate', parseFloat(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="default_avg_deal_size">Avg Deal Size ($)</Label>
                    <Input
                      id="default_avg_deal_size"
                      type="number"
                      step="0.01"
                      value={client.default_avg_deal_size || 0}
                      onChange={(e) => handleFieldChange('default_avg_deal_size', parseFloat(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="default_customer_ltv">Customer LTV ($)</Label>
                    <Input
                      id="default_customer_ltv"
                      type="number"
                      step="0.01"
                      value={client.default_customer_ltv || 0}
                      onChange={(e) => handleFieldChange('default_customer_ltv', parseFloat(e.target.value))}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ClientProfile;
