import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { Settings, RefreshCw, ArrowLeft, Building2, CheckCircle2, XCircle, Search, ChevronRight, Plus, BarChart3, Activity, MessageSquare, Globe, Bell } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import AddClientModal, { ClientFormData } from '@/components/AddClientModal';
import { useToast } from '@/hooks/use-toast';

interface ClientData {
  workspace_id: number;
  workspace_name: string;
  display_name: string | null;
  is_active: boolean;
  billing_type: string;
  monthly_kpi_target: number;
  monthly_sending_target: number | null;
  payout: number | null;
  // Feature toggles
  kpi_dashboard_enabled: boolean;
  volume_dashboard_enabled: boolean;
  live_replies_enabled: boolean;
  portal_access_enabled: boolean;
  disconnect_notifications_enabled: boolean;
}

const ClientManagement: React.FC = () => {
  const { toast } = useToast();
  const [clients, setClients] = useState<ClientData[]>([]);
  const [filteredClients, setFilteredClients] = useState<ClientData[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [addClientOpen, setAddClientOpen] = useState(false);
  const navigate = useNavigate();

  const fetchClients = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('client_registry')
        .select(`
          workspace_id, workspace_name, display_name, is_active, billing_type,
          monthly_kpi_target, monthly_sending_target, payout,
          kpi_dashboard_enabled, volume_dashboard_enabled, live_replies_enabled,
          portal_access_enabled, disconnect_notifications_enabled
        `)
        .order('is_active', { ascending: false })
        .order('display_name');

      if (error) throw error;
      setClients(data || []);
      setFilteredClients(data || []);
    } catch (error) {
      console.error('Error fetching clients:', error);
    } finally {
      setLoading(false);
    }
  };

  // Toggle a feature for a client
  const handleToggleFeature = async (
    workspaceId: number,
    field: keyof ClientData,
    currentValue: boolean,
    e: React.MouseEvent
  ) => {
    e.stopPropagation(); // Prevent row click navigation

    try {
      const { error } = await supabase
        .from('client_registry')
        .update({ [field]: !currentValue })
        .eq('workspace_id', workspaceId);

      if (error) throw error;

      // Update local state immediately for responsiveness
      setClients(prev => prev.map(c =>
        c.workspace_id === workspaceId ? { ...c, [field]: !currentValue } : c
      ));
      setFilteredClients(prev => prev.map(c =>
        c.workspace_id === workspaceId ? { ...c, [field]: !currentValue } : c
      ));

      toast({
        title: 'Updated',
        description: `${field.replace(/_/g, ' ').replace('enabled', '')} ${!currentValue ? 'enabled' : 'disabled'}`,
      });
    } catch (error) {
      console.error('Error toggling feature:', error);
      toast({
        title: 'Error',
        description: 'Failed to update feature toggle',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  useEffect(() => {
    if (searchTerm) {
      const filtered = clients.filter((client) =>
        (client.display_name || client.workspace_name)
          .toLowerCase()
          .includes(searchTerm.toLowerCase())
      );
      setFilteredClients(filtered);
    } else {
      setFilteredClients(clients);
    }
  }, [searchTerm, clients]);

  const handleAddClient = async (clientData: ClientFormData) => {
    try {
      // Generate unique workspace_id
      const workspaceId = Math.floor(Date.now() / 1000);

      // Insert into client_registry
      const { error: registryError } = await supabase
        .from('client_registry')
        .insert({
          workspace_id: workspaceId,
          workspace_name: clientData.workspaceName,
          display_name: clientData.clientName,
          is_active: clientData.infraEnabled ?? true,
          client_type: clientData.clientType,
          billing_type: clientData.billingType,
          price_per_lead: clientData.pricePerLead || 0,
          retainer_amount: clientData.retainerAmount || 0,
          monthly_kpi_target: clientData.monthlyKPITarget || 0,
          monthly_sending_target: clientData.monthlySendingTarget || 0,
          daily_sending_target: clientData.monthlySendingTarget
            ? Math.floor(clientData.monthlySendingTarget / 30)
            : 0,
          // Feature toggles
          kpi_dashboard_enabled: clientData.kpiEnabled ?? true,
          volume_dashboard_enabled: clientData.volumeEnabled ?? true,
          portal_access_enabled: clientData.portalEnabled ?? true,
          live_replies_enabled: clientData.liveRepliesEnabled ?? true,
          disconnect_notifications_enabled: clientData.disconnectNotificationsEnabled ?? true,
          slack_webhook_url: clientData.slackWebhookUrl || null,
          // Email Bison configuration
          bison_workspace_id: clientData.bisonWorkspaceId || null,
          bison_instance: clientData.bisonInstance || 'Maverick',
          bison_api_key: clientData.bisonApiKey || null,
        });

      if (registryError) {
        if (registryError.code === '23505') {
          throw new Error(`Client "${clientData.workspaceName}" already exists. Please use a different name.`);
        }
        throw registryError;
      }

      // Create placeholder ZIP entry only for home insurance clients
      if (clientData.clientType === 'home_insurance') {
        const currentMonth = new Date().toISOString().slice(0, 7); // "2025-10"
        await supabase.from('client_zipcodes').insert({
          zip: '00000',
          month: currentMonth,
          client_name: clientData.clientName,
          workspace_name: clientData.workspaceName,
          agency_color: clientData.zipColor,
          state: null,
        });
      }

      // Seed client_metrics so they appear in KPI Dashboard immediately
      if (clientData.kpiEnabled !== false) {
        const today = new Date().toISOString().split('T')[0];
        await supabase.from('client_metrics').insert({
          workspace_name: clientData.workspaceName,
          metric_type: 'mtd',
          metric_date: today,
          positive_replies_mtd: 0,
          emails_sent_mtd: 0,
        });
      }

      // If API key was provided, trigger automated setup (webhooks + email sync)
      if (clientData.bisonApiKey && clientData.bisonWorkspaceId) {
        console.log('Triggering automated setup for new client...');
        try {
          const { data: setupResult, error: setupError } = await supabase.functions.invoke('complete-client-setup', {
            body: { workspace_name: clientData.workspaceName }
          });

          if (setupError) {
            console.warn('Automated setup warning:', setupError);
            toast({
              title: "Client Created",
              description: `Client added but automated setup had issues: ${setupError.message}. You can complete setup manually from the client profile.`,
              variant: "default",
            });
          } else if (setupResult?.success) {
            toast({
              title: "Client Fully Configured",
              description: `Webhooks created and email sync triggered for "${clientData.clientName}"`,
            });
          } else if (setupResult?.errors?.length > 0) {
            toast({
              title: "Partial Setup",
              description: `Client added but some setup steps failed. Visit client profile to retry.`,
              variant: "default",
            });
          }
        } catch (setupErr: any) {
          console.warn('Automated setup exception:', setupErr);
          // Don't throw - client was already created successfully
        }
      }

      // Refresh client list
      await fetchClients();
    } catch (e: any) {
      console.error('Failed to add client:', e);
      throw e;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Building2 className="h-8 w-8" />
            Client Management
          </h1>
          <p className="text-muted-foreground">
            Manage client data, billing, targets, and configuration
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="default" onClick={() => setAddClientOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Client
          </Button>
          <Button variant="outline" onClick={fetchClients}>
            <RefreshCw className="w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clients.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Clients</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {clients.filter((c) => c.is_active).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inactive Clients</CardTitle>
            <XCircle className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {clients.filter((c) => !c.is_active).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle>Client List</CardTitle>
          <CardDescription>
            Click on a client to view and edit their full profile
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search clients..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Client Table */}
          <TooltipProvider>
            <div className="relative max-h-[600px] overflow-auto border rounded-md">
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="bg-card">Status</TableHead>
                    <TableHead className="bg-card">Client Name</TableHead>
                    <TableHead className="bg-card">Features</TableHead>
                    <TableHead className="bg-card">Billing Type</TableHead>
                    <TableHead className="text-right bg-card">Lead Target</TableHead>
                    <TableHead className="text-right bg-card">Sending Target</TableHead>
                    <TableHead className="bg-card"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClients.map((client) => (
                    <TableRow
                      key={client.workspace_id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/client-management/${client.workspace_id}`)}
                    >
                      <TableCell>
                        {client.is_active ? (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700">
                            <XCircle className="h-3 w-3 mr-1" />
                            Inactive
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">
                        <div>
                          <div>{client.display_name || client.workspace_name}</div>
                          {client.display_name && (
                            <div className="text-xs text-muted-foreground">{client.workspace_name}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={(e) => handleToggleFeature(client.workspace_id, 'kpi_dashboard_enabled', client.kpi_dashboard_enabled, e)}
                                className={`p-1.5 rounded-md transition-colors ${
                                  client.kpi_dashboard_enabled
                                    ? 'bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400'
                                    : 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-600'
                                }`}
                              >
                                <BarChart3 className="h-3.5 w-3.5" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>KPI Dashboard: {client.kpi_dashboard_enabled ? 'Enabled' : 'Disabled'}</p>
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={(e) => handleToggleFeature(client.workspace_id, 'volume_dashboard_enabled', client.volume_dashboard_enabled, e)}
                                className={`p-1.5 rounded-md transition-colors ${
                                  client.volume_dashboard_enabled
                                    ? 'bg-purple-100 text-purple-600 dark:bg-purple-950 dark:text-purple-400'
                                    : 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-600'
                                }`}
                              >
                                <Activity className="h-3.5 w-3.5" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Volume Dashboard: {client.volume_dashboard_enabled ? 'Enabled' : 'Disabled'}</p>
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={(e) => handleToggleFeature(client.workspace_id, 'live_replies_enabled', client.live_replies_enabled, e)}
                                className={`p-1.5 rounded-md transition-colors ${
                                  client.live_replies_enabled
                                    ? 'bg-green-100 text-green-600 dark:bg-green-950 dark:text-green-400'
                                    : 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-600'
                                }`}
                              >
                                <MessageSquare className="h-3.5 w-3.5" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Live Replies: {client.live_replies_enabled ? 'Enabled' : 'Disabled'}</p>
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={(e) => handleToggleFeature(client.workspace_id, 'portal_access_enabled', client.portal_access_enabled, e)}
                                className={`p-1.5 rounded-md transition-colors ${
                                  client.portal_access_enabled
                                    ? 'bg-orange-100 text-orange-600 dark:bg-orange-950 dark:text-orange-400'
                                    : 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-600'
                                }`}
                              >
                                <Globe className="h-3.5 w-3.5" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Client Portal: {client.portal_access_enabled ? 'Enabled' : 'Disabled'}</p>
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={(e) => handleToggleFeature(client.workspace_id, 'disconnect_notifications_enabled', client.disconnect_notifications_enabled, e)}
                                className={`p-1.5 rounded-md transition-colors ${
                                  client.disconnect_notifications_enabled
                                    ? 'bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400'
                                    : 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-600'
                                }`}
                              >
                                <Bell className="h-3.5 w-3.5" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Disconnect Alerts: {client.disconnect_notifications_enabled ? 'Enabled' : 'Disabled'}</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {client.billing_type === 'per_lead' ? 'Per Lead' : 'Retainer'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {client.monthly_kpi_target > 0 ? client.monthly_kpi_target.toLocaleString() : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        {client.monthly_sending_target ? client.monthly_sending_target.toLocaleString() : '—'}
                      </TableCell>
                      <TableCell>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TooltipProvider>
        </CardContent>
      </Card>

      {/* Add Client Modal */}
      <AddClientModal
        open={addClientOpen}
        onClose={() => setAddClientOpen(false)}
        onAddClient={handleAddClient}
      />
    </div>
  );
};

export default ClientManagement;
