import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Calendar, Building2 } from 'lucide-react';

interface CommitClientZipsModalProps {
  open: boolean;
  onClose: () => void;
  currentMonth: string;
  clientName: string;
  workspaceName: string;
  zipCount: number;
  onCommitComplete: () => void;
}

const CommitClientZipsModal: React.FC<CommitClientZipsModalProps> = ({
  open,
  onClose,
  currentMonth,
  clientName,
  workspaceName,
  zipCount,
  onCommitComplete,
}) => {
  const [targetMonth, setTargetMonth] = useState<string>('');
  const [committing, setCommitting] = useState(false);
  const { toast } = useToast();

  // Generate next 12 months
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() + i);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const label = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    return { value, label };
  });

  const handleCommit = async () => {
    if (!targetMonth) {
      toast({
        title: 'Error',
        description: 'Please select a target month',
        variant: 'destructive',
      });
      return;
    }

    setCommitting(true);
    try {
      console.log(`[CommitClientZips] Copying ${clientName} ZIPs from ${currentMonth} to ${targetMonth}...`);

      // Fetch all ZIP assignments for this specific client from current month
      const { data: currentZips, error: fetchError } = await supabase
        .from('client_zipcodes')
        .select('*')
        .eq('month', currentMonth)
        .eq('workspace_name', workspaceName)
        .order('zip', { ascending: true });

      if (fetchError) throw fetchError;

      if (!currentZips || currentZips.length === 0) {
        throw new Error(`No ZIP assignments found for ${clientName} in ${currentMonth}`);
      }

      console.log(`[CommitClientZips] Found ${currentZips.length} ZIP assignments to copy`);

      // If same month, no need to do anything
      if (currentMonth === targetMonth) {
        toast({
          title: 'No Changes',
          description: 'Source and target months are the same. No changes needed.',
        });
        onClose();
        return;
      }

      // Delete existing assignments for this client in target month
      const { error: deleteError } = await supabase
        .from('client_zipcodes')
        .delete()
        .eq('month', targetMonth)
        .eq('workspace_name', workspaceName);

      if (deleteError) {
        console.warn('[CommitClientZips] Warning deleting existing target month data:', deleteError);
      }

      // Prepare new records for target month
      const newZips = currentZips.map((zip) => ({
        zip: zip.zip,
        month: targetMonth,
        client_name: zip.client_name,
        workspace_name: zip.workspace_name,
        agency_color: zip.agency_color,
        state: zip.state,
        source: zip.source || 'csv',
        pulled_at: new Date().toISOString(),
        inserted_at: new Date().toISOString(),
      }));

      // Insert in batches of 500
      const batchSize = 500;
      for (let i = 0; i < newZips.length; i += batchSize) {
        const batch = newZips.slice(i, i + batchSize);
        const { error: insertError } = await supabase
          .from('client_zipcodes')
          .insert(batch);

        if (insertError) {
          console.error(`[CommitClientZips] Error on batch ${Math.floor(i / batchSize) + 1}:`, insertError);
          throw insertError;
        }
        console.log(`[CommitClientZips] Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(newZips.length / batchSize)}`);
      }

      // Initialize zip_batch_pulls entries (marks all ZIPs as "not pulled yet")
      console.log('[CommitClientZips] Initializing zip_batch_pulls tracking...');
      const pullEntries = newZips.map((zip, index) => ({
        workspace_name: workspaceName,
        month: targetMonth,
        zip: zip.zip,
        state: zip.state,
        batch_number: Math.floor(index / 25) + 1, // Group into batches of 25
        pulled_at: null, // Not pulled yet
        raw_contacts_uploaded: 0,
      }));

      // Delete existing pull tracking for this client/month first
      await supabase
        .from('zip_batch_pulls')
        .delete()
        .eq('workspace_name', workspaceName)
        .eq('month', targetMonth);

      // Insert new pull tracking entries
      for (let i = 0; i < pullEntries.length; i += batchSize) {
        const batch = pullEntries.slice(i, i + batchSize);
        const { error: pullError } = await supabase
          .from('zip_batch_pulls')
          .insert(batch);

        if (pullError) {
          console.error(`[CommitClientZips] Error inserting pull tracking:`, pullError);
          // Don't throw - ZIP commits succeeded, tracking is optional
        }
      }
      console.log('[CommitClientZips] ✓ ZIP batch tracking initialized');

      toast({
        title: 'Success',
        description: `Committed ${currentZips.length} ZIP assignments for ${clientName} to ${monthOptions.find(m => m.value === targetMonth)?.label}. ZIP progress tracking initialized.`,
      });

      onCommitComplete();
      onClose();
      setTargetMonth(''); // Reset for next use
    } catch (error: any) {
      console.error('[CommitClientZips] Error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to commit ZIP assignments',
        variant: 'destructive',
      });
    } finally {
      setCommitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Commit {clientName} ZIPs to Month
          </DialogTitle>
          <DialogDescription>
            Copy all ZIP assignments for {clientName} ({zipCount.toLocaleString()} ZIPs) to a specific month.
            This will make these assignments available in the Contact Pipeline for that month.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="current-month">Current View</Label>
            <div className="px-3 py-2 bg-muted rounded-md text-sm font-medium">
              {monthOptions.find(m => m.value === currentMonth)?.label || currentMonth}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="target-month">Target Month *</Label>
            <Select value={targetMonth} onValueChange={setTargetMonth}>
              <SelectTrigger>
                <SelectValue placeholder="Select month to commit to..." />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Existing assignments for {clientName} in this month will be replaced
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={committing}>
            Cancel
          </Button>
          <Button onClick={handleCommit} disabled={committing || !targetMonth}>
            {committing ? 'Committing...' : 'Commit to Month'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CommitClientZipsModal;
