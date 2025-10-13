import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { Copy, Upload, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ZipBatch {
  batch_number: number;
  zips: string[];
  pulled: boolean;
  raw_contacts: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  workspaceName: string;
  displayName: string;
  month: string;
}

export default function ZipBatchUploadModal({
  open,
  onClose,
  workspaceName,
  displayName,
  month
}: Props) {
  const [batches, setBatches] = useState<ZipBatch[]>([]);
  const [currentBatch, setCurrentBatch] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadInProgress, setUploadInProgress] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      loadBatches();
    }
  }, [open, workspaceName, month]);

  const loadBatches = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('zip_batch_pulls')
        .select('*')
        .eq('workspace_name', workspaceName)
        .eq('month', month)
        .order('batch_number', { ascending: true });

      if (error) throw error;

      // Group by batch_number
      const batchMap = new Map<number, ZipBatch>();
      (data || []).forEach((row) => {
        if (!batchMap.has(row.batch_number)) {
          batchMap.set(row.batch_number, {
            batch_number: row.batch_number,
            zips: [],
            pulled: false,
            raw_contacts: 0,
          });
        }
        const batch = batchMap.get(row.batch_number)!;
        batch.zips.push(row.zip);
        if (row.pulled_at) batch.pulled = true;
        batch.raw_contacts += row.raw_contacts_uploaded || 0;
      });

      setBatches(Array.from(batchMap.values()));

      // Find first unpulled batch
      const firstUnpulled = Array.from(batchMap.values()).find(b => !b.pulled);
      if (firstUnpulled) {
        setCurrentBatch(firstUnpulled.batch_number);
      }
    } catch (error: any) {
      toast({
        title: 'Error loading batches',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopyZips = () => {
    const batch = batches.find(b => b.batch_number === currentBatch);
    if (!batch) return;

    // Format with commas after each ZIP, no spaces
    const zipText = batch.zips.map(zip => `${zip},`).join('');
    navigator.clipboard.writeText(zipText);

    toast({
      title: 'ZIP codes copied!',
      description: `${batch.zips.length} ZIP codes copied to clipboard`,
    });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Prevent simultaneous uploads (race condition protection)
    if (uploadInProgress) {
      toast({
        title: 'Upload in progress',
        description: 'Please wait for the current upload to complete before uploading another batch.',
        variant: 'destructive',
      });
      event.target.value = '';
      return;
    }

    setUploading(true);
    setUploadInProgress(true);

    try {
      const batch = batches.find(b => b.batch_number === currentBatch);
      if (!batch) throw new Error('Batch not found');

      // Read CSV file content
      const csvContent = await file.text();

      // Call Edge Function to process the upload server-side (eliminates browser cache issues)
      const { data, error } = await supabase.functions.invoke('process-batch-upload', {
        body: {
          csv_content: csvContent,
          workspace_name: workspaceName,
          month: month,
          batch_number: currentBatch,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Upload failed');

      toast({
        title: 'CSV uploaded successfully! [SERVER-SIDE]',
        description: data.message,
      });

      // Reload batches
      await loadBatches();

      // Move to next batch if available
      const nextBatch = batches.find(b => b.batch_number > currentBatch && !b.pulled);
      if (nextBatch) {
        setCurrentBatch(nextBatch.batch_number);
      }
    } catch (error: any) {
      toast({
        title: 'Upload failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      setUploadInProgress(false);
      event.target.value = '';
    }
  };

  const totalZips = batches.reduce((sum, b) => sum + b.zips.length, 0);
  const pulledZips = batches.filter(b => b.pulled).reduce((sum, b) => sum + b.zips.length, 0);
  const totalContacts = batches.reduce((sum, b) => sum + b.raw_contacts, 0);
  const progress = totalZips > 0 ? (pulledZips / totalZips) * 100 : 0;

  const currentBatchData = batches.find(b => b.batch_number === currentBatch);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>ZIP Code Batch Upload - {displayName}</span>
            <Badge variant="outline">{month}</Badge>
          </DialogTitle>
        </DialogHeader>

        {/* Progress Overview */}
        <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-semibold">Overall Progress</h3>
              <p className="text-sm text-muted-foreground">
                {pulledZips} of {totalZips} ZIP codes pulled
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold">{totalContacts.toLocaleString()}</div>
              <p className="text-sm text-muted-foreground">raw contacts</p>
            </div>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Batch Navigator */}
        <div className="flex gap-2 flex-wrap">
          {batches.map((batch) => (
            <Button
              key={batch.batch_number}
              variant={currentBatch === batch.batch_number ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCurrentBatch(batch.batch_number)}
              className="relative"
            >
              Batch {batch.batch_number}
              {batch.pulled && (
                <CheckCircle2 className="w-3 h-3 ml-1 text-green-500" />
              )}
            </Button>
          ))}
        </div>

        {/* Current Batch View */}
        {currentBatchData && (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <h3 className="font-semibold">Batch {currentBatchData.batch_number}</h3>
                <p className="text-sm text-muted-foreground">
                  {currentBatchData.zips.length} ZIP codes
                  {currentBatchData.pulled && ` • ${currentBatchData.raw_contacts.toLocaleString()} contacts uploaded`}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyZips}
                  disabled={currentBatchData.pulled}
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copy ZIPs
                </Button>
                {!currentBatchData.pulled && (
                  <label>
                    <Button
                      variant="default"
                      size="sm"
                      disabled={uploading || uploadInProgress}
                      asChild
                    >
                      <span>
                        <Upload className="w-4 h-4 mr-2" />
                        {uploading ? 'Uploading...' : 'Upload CSV'}
                      </span>
                    </Button>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleFileUpload}
                      className="hidden"
                      disabled={uploading || uploadInProgress}
                    />
                  </label>
                )}
              </div>
            </div>

            {/* ZIP Code Grid */}
            <div className="grid grid-cols-5 gap-2 p-4 bg-muted/30 rounded-lg max-h-64 overflow-y-auto">
              {currentBatchData.zips.map((zip) => (
                <Badge key={zip} variant="secondary" className="justify-center">
                  {zip}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Instructions */}
        {currentBatchData && !currentBatchData.pulled && (
          <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg space-y-2">
            <h4 className="font-semibold text-sm">Instructions:</h4>
            <ol className="text-sm space-y-1 list-decimal list-inside">
              <li>Click "Copy ZIPs" to copy all ZIP codes to clipboard</li>
              <li>Go to Cole X Dates (XDATE site) and paste the ZIP codes</li>
              <li>Download the CSV file from Cole X Dates</li>
              <li>Click "Upload CSV" and select the downloaded file</li>
              <li>The system will automatically move to the next batch</li>
            </ol>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
