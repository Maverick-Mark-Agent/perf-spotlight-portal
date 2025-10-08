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
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Save, RefreshCw, Building2, CheckCircle2, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ClientFullData {
  // Identity
  workspace_id: number;
  workspace_name: string;
  display_name: string | null;
  is_active: boolean;
  is_agency: boolean;

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
}

const ClientProfile: React.FC = () => {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [client, setClient] = useState<ClientFullData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

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

  const handleFieldChange = (field: keyof ClientFullData, value: any) => {
    if (!client) return;
    setClient({ ...client, [field]: value });
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!client) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('client_registry')
        .update({
          display_name: client.display_name,
          is_active: client.is_active,
          is_agency: client.is_agency,
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
      <Tabs defaultValue="general" className="space-y-4">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="targets">Targets</TabsTrigger>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="territory">Territory</TabsTrigger>
          <TabsTrigger value="costs">Costs</TabsTrigger>
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
                    id="is_agency"
                    checked={client.is_agency}
                    onCheckedChange={(checked) => handleFieldChange('is_agency', checked)}
                  />
                  <Label htmlFor="is_agency">Agency Account</Label>
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
                        <SelectItem value="low">Low (< 15k/mo)</SelectItem>
                        <SelectItem value="medium">Medium (15-30k/mo)</SelectItem>
                        <SelectItem value="high">High (30-60k/mo)</SelectItem>
                        <SelectItem value="enterprise">Enterprise (> 60k/mo)</SelectItem>
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
