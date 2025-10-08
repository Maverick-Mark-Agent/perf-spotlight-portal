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
import { Settings, RefreshCw, ArrowLeft, Building2, CheckCircle2, XCircle, Search, ChevronRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

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
  const [clients, setClients] = useState<ClientData[]>([]);
  const [filteredClients, setFilteredClients] = useState<ClientData[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
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
          <div className="flex items-center gap-4 mb-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Home
              </Link>
            </Button>
          </div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Building2 className="h-8 w-8" />
            Client Management
          </h1>
          <p className="text-muted-foreground">
            Manage client data, billing, targets, and configuration
          </p>
        </div>
        <Button variant="outline" onClick={fetchClients}>
          <RefreshCw className="w-4 w-4 mr-2" />
          Refresh
        </Button>
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
    </div>
  );
};

export default ClientManagement;
