import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { Settings, RefreshCw, ArrowLeft, Building2, CheckCircle2, XCircle, Search, ChevronRight, Plus } from 'lucide-react';
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
        .select('workspace_id, workspace_name, display_name, is_active, billing_type, monthly_kpi_target, monthly_sending_target, payout')
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
          is_active: true,
          client_type: clientData.clientType,
          billing_type: clientData.billingType,
          price_per_lead: clientData.pricePerLead || 0,
          retainer_amount: clientData.retainerAmount || 0,
          monthly_kpi_target: clientData.monthlyKPITarget || 0,
          monthly_sending_target: clientData.monthlySendingTarget || 0,
          daily_sending_target: clientData.monthlySendingTarget
            ? Math.floor(clientData.monthlySendingTarget / 30)
            : 0,
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
          <div className="relative max-h-[600px] overflow-auto border rounded-md">
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="bg-card">Status</TableHead>
                  <TableHead className="bg-card">Client Name</TableHead>
                  <TableHead className="bg-card">Billing Type</TableHead>
                  <TableHead className="text-right bg-card">Lead Target</TableHead>
                  <TableHead className="text-right bg-card">Sending Target</TableHead>
                  <TableHead className="text-right bg-card">Payout</TableHead>
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
                    <TableCell className="text-right">
                      {client.payout ? `$${client.payout.toLocaleString()}` : '—'}
                    </TableCell>
                    <TableCell>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
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
