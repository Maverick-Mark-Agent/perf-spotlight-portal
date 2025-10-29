/**
 * Manage Clients Section Component
 *
 * Two-column layout for managing which clients belong to the Home Insurance category
 * Left: Current Home Insurance clients (with remove button)
 * Right: Other clients (with add button)
 * Created: 2025-10-27
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, X, RefreshCw, Building2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  fetchAllClients,
  addClientToHomeInsurance,
  removeClientFromHomeInsurance,
  refreshHomeInsuranceView,
} from '@/services/homeInsuranceService';
import type { HomeInsuranceClient } from '@/types/homeInsurance';

interface ManageClientsSectionProps {
  onUpdate?: () => void; // Callback when clients are added/removed
}

export function ManageClientsSection({ onUpdate }: ManageClientsSectionProps) {
  const [allClients, setAllClients] = useState<HomeInsuranceClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingClient, setProcessingClient] = useState<string | null>(null);
  const { toast } = useToast();

  // Load all clients on mount
  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      setLoading(true);
      const clients = await fetchAllClients();
      setAllClients(clients);
    } catch (error) {
      console.error('Error loading clients:', error);
      toast({
        title: 'Error',
        description: 'Failed to load clients. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddClient = async (workspaceName: string) => {
    try {
      setProcessingClient(workspaceName);
      await addClientToHomeInsurance(workspaceName);

      toast({
        title: 'Success',
        description: `Added "${workspaceName}" to Home Insurance category`,
      });

      // Refresh materialized view (may not have permissions, but try)
      try {
        await refreshHomeInsuranceView();
      } catch (err) {
        console.log('View will refresh on next scheduled sync');
      }

      // Reload clients and notify parent
      await loadClients();
      onUpdate?.();
    } catch (error) {
      console.error('Error adding client:', error);
      toast({
        title: 'Error',
        description: `Failed to add "${workspaceName}" to Home Insurance`,
        variant: 'destructive',
      });
    } finally {
      setProcessingClient(null);
    }
  };

  const handleRemoveClient = async (workspaceName: string) => {
    try {
      setProcessingClient(workspaceName);
      await removeClientFromHomeInsurance(workspaceName);

      toast({
        title: 'Success',
        description: `Removed "${workspaceName}" from Home Insurance category`,
      });

      // Refresh materialized view (may not have permissions, but try)
      try {
        await refreshHomeInsuranceView();
      } catch (err) {
        console.log('View will refresh on next scheduled sync');
      }

      // Reload clients and notify parent
      await loadClients();
      onUpdate?.();
    } catch (error) {
      console.error('Error removing client:', error);
      toast({
        title: 'Error',
        description: `Failed to remove "${workspaceName}" from Home Insurance`,
        variant: 'destructive',
      });
    } finally {
      setProcessingClient(null);
    }
  };

  // Split clients into Home Insurance and Other
  const homeInsuranceClients = allClients.filter(c => c.client_type === 'home_insurance');
  const otherClients = allClients.filter(c => c.client_type !== 'home_insurance');

  if (loading) {
    return (
      <div className="bg-white/5 rounded-lg border border-white/10 p-8">
        <div className="flex items-center justify-center gap-3 text-white/70">
          <RefreshCw className="h-5 w-5 animate-spin" />
          <span>Loading clients...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-white font-semibold text-lg">Manage Home Insurance Clients</h3>
          <p className="text-white/60 text-sm mt-0.5">
            Add or remove clients from the Home Insurance category
          </p>
        </div>
        <Button
          onClick={loadClients}
          variant="outline"
          size="sm"
          className="bg-white/5 border-white/10 hover:bg-white/10 text-white"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Left Column: Current Home Insurance Clients */}
        <div className="bg-white/5 rounded-lg border border-white/10 p-4">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-white font-semibold flex items-center gap-2">
              <Building2 className="h-4 w-4 text-green-500" />
              Home Insurance Clients
            </h4>
            <Badge variant="outline" className="bg-green-500/20 text-green-500 border-green-500/40">
              {homeInsuranceClients.length} clients
            </Badge>
          </div>

          {homeInsuranceClients.length === 0 ? (
            <div className="text-center py-8 text-white/50">
              <AlertCircle className="h-8 w-8 mx-auto mb-2" />
              <p className="text-sm">No clients in Home Insurance category</p>
              <p className="text-xs mt-1">Add clients from the right panel</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {homeInsuranceClients.map((client) => (
                <div
                  key={client.workspace_name}
                  className="flex items-center justify-between bg-white/5 rounded p-3 hover:bg-white/10 transition-colors"
                >
                  <div className="flex-1">
                    <div className="text-white font-medium text-sm">
                      {client.display_name || client.workspace_name}
                    </div>
                    {client.display_name && (
                      <div className="text-white/50 text-xs mt-0.5">
                        {client.workspace_name}
                      </div>
                    )}
                  </div>
                  <Button
                    onClick={() => handleRemoveClient(client.workspace_name)}
                    disabled={processingClient === client.workspace_name}
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 hover:bg-red-500/20 hover:text-red-500"
                  >
                    {processingClient === client.workspace_name ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <X className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Other Clients */}
        <div className="bg-white/5 rounded-lg border border-white/10 p-4">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-white font-semibold flex items-center gap-2">
              <Building2 className="h-4 w-4 text-blue-500" />
              Other Clients
            </h4>
            <Badge variant="outline" className="bg-blue-500/20 text-blue-500 border-blue-500/40">
              {otherClients.length} clients
            </Badge>
          </div>

          {otherClients.length === 0 ? (
            <div className="text-center py-8 text-white/50">
              <AlertCircle className="h-8 w-8 mx-auto mb-2" />
              <p className="text-sm">All clients are in Home Insurance</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {otherClients.map((client) => (
                <div
                  key={client.workspace_name}
                  className="flex items-center justify-between bg-white/5 rounded p-3 hover:bg-white/10 transition-colors"
                >
                  <div className="flex-1">
                    <div className="text-white font-medium text-sm">
                      {client.display_name || client.workspace_name}
                    </div>
                    {client.display_name && (
                      <div className="text-white/50 text-xs mt-0.5">
                        {client.workspace_name}
                      </div>
                    )}
                  </div>
                  <Button
                    onClick={() => handleAddClient(client.workspace_name)}
                    disabled={processingClient === client.workspace_name}
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 hover:bg-green-500/20 hover:text-green-500"
                  >
                    {processingClient === client.workspace_name ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
        <div className="flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-blue-200">
            <strong>Note:</strong> Changes to client categories may take a few moments to reflect in the dashboard.
            The materialized view refreshes automatically during the nightly sync, or you can refresh the page
            to see the latest data.
          </div>
        </div>
      </div>
    </div>
  );
}
