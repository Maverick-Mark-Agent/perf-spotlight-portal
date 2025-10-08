import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface UploadCSVModalProps {
  open: boolean;
  onClose: () => void;
  onUploadComplete: (result: any) => void;
}

interface Client {
  workspace_name: string;
  display_name: string;
}

const UploadCSVModal: React.FC<UploadCSVModalProps> = ({ open, onClose, onUploadComplete }) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [month, setMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch clients from client_registry
  useEffect(() => {
    const fetchClients = async () => {
      const { data, error } = await supabase
        .from('client_registry')
        .select('workspace_name, display_name')
        .eq('is_active', true)
        .order('display_name');

      if (error) {
        console.error('Error fetching clients:', error);
      } else {
        setClients(data || []);
      }
    };

    if (open) {
      fetchClients();
    }
  }, [open]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.csv')) {
        setError('Please select a CSV file');
        setFile(null);
        return;
      }
      setFile(selectedFile);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedClient || !month || !file) {
      setError('Please fill in all fields and select a file');
      return;
    }

    setUploading(true);
    setError(null);
    setUploadResult(null);

    try {
      // Create FormData
      const formData = new FormData();
      formData.append('csv_file', file);
      formData.append('workspace_name', selectedClient);
      formData.append('month', month);
      formData.append('uploaded_by', 'dashboard_user');

      // Get Supabase URL and anon key
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      // Call Edge Function
      const response = await fetch(`${supabaseUrl}/functions/v1/process-contact-upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: formData,
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Upload failed');
      }

      setUploadResult(result);
      onUploadComplete(result);
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || 'Failed to upload CSV');
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setError(null);
    setUploadResult(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Upload Cole X Dates CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file from Cole X Dates to process contacts and extract ZIP codes
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Client Selection */}
          <div className="space-y-2">
            <Label htmlFor="client">Client / Workspace</Label>
            <Select value={selectedClient} onValueChange={setSelectedClient}>
              <SelectTrigger id="client">
                <SelectValue placeholder="Select a client" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((client) => (
                  <SelectItem key={client.workspace_name} value={client.workspace_name}>
                    {client.display_name || client.workspace_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Month Selection */}
          <div className="space-y-2">
            <Label htmlFor="month">Processing Month</Label>
            <Input
              id="month"
              type="text"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              placeholder="2025-11"
            />
            <p className="text-xs text-muted-foreground">
              Format: YYYY-MM (e.g., 2025-11 for November 2025)
            </p>
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <Label htmlFor="file">CSV File</Label>
            <Input
              id="file"
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              disabled={uploading}
            />
            <p className="text-xs text-muted-foreground">
              Expected columns: First Name, Last Name, Mailing Address, Mailing City, Mailing State,
              Mailing ZIP, Property Address, Property City, Property State, Property ZIP, Home Value Estimate,
              Purchase Date, Email
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Success Result */}
          {uploadResult && (
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-semibold text-green-800">Upload Successful!</p>
                  <div className="text-sm text-green-700">
                    <p>• Total Contacts: {uploadResult.summary.total_contacts.toLocaleString()}</p>
                    <p>• Ready for Verification: {uploadResult.summary.ready_for_verification.toLocaleString()}</p>
                    <p>• Filtered Out: {uploadResult.summary.filtered_out.toLocaleString()}</p>
                    <p>• High Net Worth: {uploadResult.summary.hnw_contacts.toLocaleString()}</p>
                    <p>• ZIP Codes Added: {uploadResult.summary.zips_inserted?.toLocaleString() || 0}</p>
                  </div>
                  <p className="text-xs text-green-600 mt-2">
                    {uploadResult.message}
                  </p>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={handleClose} disabled={uploading}>
            {uploadResult ? 'Close' : 'Cancel'}
          </Button>
          {!uploadResult && (
            <Button onClick={handleUpload} disabled={uploading || !file || !selectedClient || !month}>
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload & Process
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UploadCSVModal;
