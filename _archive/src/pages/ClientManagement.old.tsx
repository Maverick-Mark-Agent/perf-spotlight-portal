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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { Settings, Save, RefreshCw, ArrowLeft, Building2, CheckCircle2, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

interface ClientData {
  workspace_id: number;
  workspace_name: string;
  display_name: string | null;
  is_active: boolean;
  billing_type: string;
  price_per_lead: number;
  retainer_amount: number;
  monthly_kpi_target: number;
  monthly_contact_target: number | null;
  contact_tier: string | null;
  payout: number | null;
  monthly_sending_target: number | null;
  notes: string | null;
}

const ClientManagement: React.FC = () => {
  const [clients, setClients] = useState<ClientData[]>([]);
  const [editedClients, setEditedClients] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const fetchClients = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('client_registry')
        .select('*')
        .order('is_active', { ascending: false })
        .order('display_name');

      if (error) throw error;
      setClients(data || []);
      setEditedClients(new Set());
    } catch (error) {
      console.error('Error fetching clients:', error);
      toast({
        title: 'Error',
        description: 'Failed to load clients',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const handleFieldChange = (workspaceId: number, field: keyof ClientData, value: any) => {
    setClients((prev) =>
      prev.map((client) =>
        client.workspace_id === workspaceId ? { ...client, [field]: value } : client
      )
    );
    setEditedClients((prev) => new Set(prev).add(workspaceId));
  };

  const handleSaveClient = async (workspaceId: number) => {
    setSaving(true);
    const client = clients.find((c) => c.workspace_id === workspaceId);
    if (!client) return;

    try {
      const { error } = await supabase
        .from('client_registry')
        .update({
          display_name: client.display_name,
          is_active: client.is_active,
          billing_type: client.billing_type,
          price_per_lead: client.price_per_lead,
          retainer_amount: client.retainer_amount,
          monthly_kpi_target: client.monthly_kpi_target,
          monthly_contact_target: client.monthly_contact_target,
          contact_tier: client.contact_tier,
          payout: client.payout,
          monthly_sending_target: client.monthly_sending_target,
          notes: client.notes,
        })
        .eq('workspace_id', workspaceId);

      if (error) throw error;

      setEditedClients((prev) => {
        const next = new Set(prev);
        next.delete(workspaceId);
        return next;
      });

      toast({
        title: 'Success',
        description: `${client.display_name || client.workspace_name} updated successfully`,
      });
    } catch (error) {
      console.error('Error saving client:', error);
      toast({
        title: 'Error',
        description: 'Failed to save client',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAll = async () => {
    setSaving(true);
    const clientsToUpdate = clients.filter((c) => editedClients.has(c.workspace_id));

    try {
      for (const client of clientsToUpdate) {
        const { error } = await supabase
          .from('client_registry')
          .update({
            display_name: client.display_name,
            is_active: client.is_active,
            billing_type: client.billing_type,
            price_per_lead: client.price_per_lead,
            retainer_amount: client.retainer_amount,
            monthly_kpi_target: client.monthly_kpi_target,
            monthly_contact_target: client.monthly_contact_target,
            contact_tier: client.contact_tier,
            payout: client.payout,
            monthly_sending_target: client.monthly_sending_target,
            notes: client.notes,
          })
          .eq('workspace_id', client.workspace_id);

        if (error) throw error;
      }

      setEditedClients(new Set());
      toast({
        title: 'Success',
        description: `${clientsToUpdate.length} client(s) updated successfully`,
      });
    } catch (error) {
      console.error('Error saving clients:', error);
      toast({
        title: 'Error',
        description: 'Failed to save some clients',
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
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchClients} disabled={saving}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          {editedClients.size > 0 && (
            <Button onClick={handleSaveAll} disabled={saving}>
              <Save className="w-4 h-4 mr-2" />
              Save All ({editedClients.size})
            </Button>
          )}
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
            <CardTitle className="text-sm font-medium">Unsaved Changes</CardTitle>
            <Settings className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{editedClients.size}</div>
          </CardContent>
        </Card>
      </div>

      {/* Client Table */}
      <Card>
        <CardHeader>
          <CardTitle>Client Registry</CardTitle>
          <CardDescription>
            Edit client information, billing details, and performance targets
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="relative max-h-[600px] overflow-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent" style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: 'hsl(var(--card))' }}>
                  <TableHead className="w-[40px]" style={{ position: 'sticky', top: 0, backgroundColor: 'hsl(var(--card))' }}>Active</TableHead>
                  <TableHead style={{ position: 'sticky', top: 0, backgroundColor: 'hsl(var(--card))' }}>Client Name</TableHead>
                  <TableHead style={{ position: 'sticky', top: 0, backgroundColor: 'hsl(var(--card))' }}>Billing Type</TableHead>
                  <TableHead style={{ position: 'sticky', top: 0, backgroundColor: 'hsl(var(--card))' }}>Price/Lead</TableHead>
                  <TableHead style={{ position: 'sticky', top: 0, backgroundColor: 'hsl(var(--card))' }}>Retainer</TableHead>
                  <TableHead style={{ position: 'sticky', top: 0, backgroundColor: 'hsl(var(--card))' }}>Payout</TableHead>
                  <TableHead style={{ position: 'sticky', top: 0, backgroundColor: 'hsl(var(--card))' }}>Lead Target</TableHead>
                  <TableHead style={{ position: 'sticky', top: 0, backgroundColor: 'hsl(var(--card))' }}>Contact Target</TableHead>
                  <TableHead style={{ position: 'sticky', top: 0, backgroundColor: 'hsl(var(--card))' }}>Contact Tier</TableHead>
                  <TableHead style={{ position: 'sticky', top: 0, backgroundColor: 'hsl(var(--card))' }}>Sending Target</TableHead>
                  <TableHead className="w-[100px]" style={{ position: 'sticky', top: 0, backgroundColor: 'hsl(var(--card))' }}>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients
                  .sort((a, b) => {
                    // Sort by active status first (active = true comes first)
                    if (a.is_active !== b.is_active) {
                      return a.is_active ? -1 : 1;
                    }
                    // Then sort by display_name or workspace_name
                    const nameA = (a.display_name || a.workspace_name).toLowerCase();
                    const nameB = (b.display_name || b.workspace_name).toLowerCase();
                    return nameA.localeCompare(nameB);
                  })
                  .map((client) => (
                  <TableRow
                    key={client.workspace_id}
                    className={editedClients.has(client.workspace_id) ? 'bg-yellow-50' : ''}
                  >
                    <TableCell>
                      <button
                        onClick={() =>
                          handleFieldChange(client.workspace_id, 'is_active', !client.is_active)
                        }
                        className="hover:scale-110 transition-transform"
                      >
                        {client.is_active ? (
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                        ) : (
                          <XCircle className="h-5 w-5 text-gray-400" />
                        )}
                      </button>
                    </TableCell>
                    <TableCell>
                      <div>
                        <Input
                          value={client.display_name || ''}
                          onChange={(e) =>
                            handleFieldChange(client.workspace_id, 'display_name', e.target.value)
                          }
                          placeholder="Display Name"
                          className="mb-1"
                        />
                        <span className="text-xs text-muted-foreground">
                          {client.workspace_name}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={client.billing_type}
                        onValueChange={(value) =>
                          handleFieldChange(client.workspace_id, 'billing_type', value)
                        }
                      >
                        <SelectTrigger className="w-[130px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="per_lead">Per Lead</SelectItem>
                          <SelectItem value="retainer">Retainer</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={client.price_per_lead || 0}
                        onChange={(e) =>
                          handleFieldChange(
                            client.workspace_id,
                            'price_per_lead',
                            parseFloat(e.target.value)
                          )
                        }
                        className="w-[100px]"
                        step="0.01"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={client.retainer_amount || 0}
                        onChange={(e) =>
                          handleFieldChange(
                            client.workspace_id,
                            'retainer_amount',
                            parseFloat(e.target.value)
                          )
                        }
                        className="w-[100px]"
                        step="0.01"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={client.payout || 0}
                        onChange={(e) =>
                          handleFieldChange(
                            client.workspace_id,
                            'payout',
                            parseFloat(e.target.value)
                          )
                        }
                        className="w-[100px]"
                        step="0.01"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={client.monthly_kpi_target || 0}
                        onChange={(e) =>
                          handleFieldChange(
                            client.workspace_id,
                            'monthly_kpi_target',
                            parseInt(e.target.value)
                          )
                        }
                        className="w-[100px]"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={client.monthly_contact_target || 0}
                        onChange={(e) =>
                          handleFieldChange(
                            client.workspace_id,
                            'monthly_contact_target',
                            parseInt(e.target.value)
                          )
                        }
                        className="w-[100px]"
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={client.contact_tier || ''}
                        onValueChange={(value) =>
                          handleFieldChange(client.workspace_id, 'contact_tier', value)
                        }
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue placeholder="Select tier" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="100_leads">100 Leads</SelectItem>
                          <SelectItem value="200_leads">200 Leads</SelectItem>
                          <SelectItem value="custom">Custom</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={client.monthly_sending_target || 0}
                        onChange={(e) =>
                          handleFieldChange(
                            client.workspace_id,
                            'monthly_sending_target',
                            parseInt(e.target.value)
                          )
                        }
                        className="w-[100px]"
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        onClick={() => handleSaveClient(client.workspace_id)}
                        disabled={saving || !editedClients.has(client.workspace_id)}
                      >
                        <Save className="w-3 h-3 mr-1" />
                        Save
                      </Button>
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
