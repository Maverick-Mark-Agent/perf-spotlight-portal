import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import {
  Upload,
  CheckCircle2,
  Clock,
  AlertCircle,
  TrendingUp,
  Users,
  Mail,
  Calendar,
  Download,
  RefreshCw,
  ArrowLeft,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import UploadCSVModal from '@/components/UploadCSVModal';
import ZipBatchUploadModal from '@/components/ZipBatchUploadModal.tsx';

interface PipelineSummary {
  workspace_name: string;
  month: string;
  client_display_name: string;
  clean_contact_target: number;  // RENAMED from monthly_contact_target
  contact_tier: string;
  upload_batch_count: number;
  total_raw_contacts: number;  // RENAMED from raw_contacts_uploaded
  verified_contacts: number;
  batches_created: number;
  added_to_campaign_count: number;  // NEW
  contacts_gap: number;  // RENAMED from contacts_needed

  // ZIP code progress fields (keep these)
  total_zips?: number;
  zips_pulled?: number;
  zips_remaining?: number;

  // REMOVED: deliverable_count, undeliverable_count, risky_count,
  //          contacts_uploaded, contacts_pending, hnw_contacts,
  //          batches_completed, target_percentage
}

interface WeeklyBatch {
  batch_id: string;
  workspace_name: string;
  client_display_name: string;
  month: string;
  week_number: number;
  scheduled_upload_date: string;
  actual_upload_date: string | null;
  contact_count: number;
  hnw_count: number;
  bison_upload_status: string;
  bison_campaign_name: string | null;
  slack_approved_by: string | null;
  slack_approved_at: string | null;
  upload_status_text: string;
}

const ContactPipelineDashboard: React.FC = () => {
  const [pipelineSummaries, setPipelineSummaries] = useState<PipelineSummary[]>([]);
  const [weeklyBatches, setWeeklyBatches] = useState<WeeklyBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [zipBatchModalOpen, setZipBatchModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<{workspace_name: string, display_name: string} | null>(null);

  // Fetch pipeline summaries
  const fetchPipelineSummaries = async () => {
    try {
      console.log('[ContactPipeline] Fetching data for month:', selectedMonth);

      // First, fetch ALL home insurance clients from client_registry
      const { data: allClients, error: clientsError } = await supabase
        .from('client_registry')
        .select('workspace_name, display_name, monthly_contact_target, contact_tier')
        .eq('is_active', true)
        .eq('client_type', 'home_insurance')
        .order('display_name');

      if (clientsError) throw clientsError;
      console.log('[ContactPipeline] Found home_insurance clients:', allClients?.length);

      // Fetch contact pipeline data
      const { data: pipelineData, error: pipelineError } = await supabase
        .from('monthly_contact_pipeline_summary')
        .select('*')
        .eq('month', selectedMonth)
        .order('target_percentage', { ascending: false });

      if (pipelineError) throw pipelineError;

      // Fetch ZIP progress data
      const { data: zipProgress, error: zipError } = await supabase
        .from('client_zip_progress')
        .select('*')
        .eq('month', selectedMonth);

      if (zipError) {
        console.error('Error fetching ZIP progress:', zipError);
      }

      // Merge the data - start with ALL home insurance clients
      const workspaceMap = new Map<string, PipelineSummary>();

      // Initialize with all home insurance clients (zeros for everything)
      (allClients || []).forEach((client) => {
        workspaceMap.set(client.workspace_name, {
          workspace_name: client.workspace_name,
          month: selectedMonth,
          client_display_name: client.display_name || client.workspace_name,
          monthly_contact_target: client.monthly_contact_target || 0,
          contact_tier: client.contact_tier || '',
          upload_batch_count: 0,
          raw_contacts_uploaded: 0,
          verified_contacts: 0,
          deliverable_count: 0,
          undeliverable_count: 0,
          risky_count: 0,
          contacts_uploaded: 0,
          contacts_pending: 0,
          hnw_contacts: 0,
          batches_created: 0,
          batches_completed: 0,
          contacts_needed: client.monthly_contact_target || 0,
          target_percentage: 0,
          total_zips: 0,
          zips_pulled: 0,
          zips_remaining: 0,
          total_raw_contacts: 0,
        });
      });

      // Overlay pipeline data (actual contact uploads)
      (pipelineData || []).forEach((pipeline) => {
        if (workspaceMap.has(pipeline.workspace_name)) {
          const existing = workspaceMap.get(pipeline.workspace_name)!;
          workspaceMap.set(pipeline.workspace_name, {
            ...existing,
            ...pipeline, // Override with actual pipeline data
            total_zips: existing.total_zips, // Keep ZIP data from previous step
            zips_pulled: existing.zips_pulled,
            zips_remaining: existing.zips_remaining,
            total_raw_contacts: existing.total_raw_contacts,
          });
        }
      });

      // Overlay ZIP progress data
      (zipProgress || []).forEach((zipData) => {
        if (workspaceMap.has(zipData.workspace_name)) {
          const existing = workspaceMap.get(zipData.workspace_name)!;
          workspaceMap.set(zipData.workspace_name, {
            ...existing,
            total_zips: zipData.total_zips || 0,
            zips_pulled: zipData.zips_pulled || 0,
            zips_remaining: zipData.zips_remaining || 0,
            total_raw_contacts: zipData.total_raw_contacts || 0,
          });
        }
      });

      const merged = Array.from(workspaceMap.values());
      setPipelineSummaries(merged);
    } catch (error) {
      console.error('Error fetching pipeline summaries:', error);
    }
  };

  // Fetch weekly batches
  const fetchWeeklyBatches = async () => {
    try {
      const { data, error } = await supabase
        .from('weekly_batch_status')
        .select('*')
        .order('scheduled_upload_date', { ascending: false });

      if (error) throw error;
      setWeeklyBatches(data || []);
    } catch (error) {
      console.error('Error fetching weekly batches:', error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchPipelineSummaries(), fetchWeeklyBatches()]);
      setLoading(false);
    };

    loadData();
  }, [selectedMonth]);

  // Calculate overall stats
  const totalCleanTarget = pipelineSummaries.reduce((sum, p) => sum + (p.clean_contact_target || 0), 0);
  const totalRawContacts = pipelineSummaries.reduce((sum, p) => sum + p.total_raw_contacts, 0);
  const totalVerified = pipelineSummaries.reduce((sum, p) => sum + p.verified_contacts, 0);
  const totalAddedToCampaign = pipelineSummaries.reduce((sum, p) => sum + p.added_to_campaign_count, 0);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-50"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'uploaded':
        return <Badge variant="outline" className="bg-blue-50"><Upload className="w-3 h-3 mr-1" />Uploaded</Badge>;
      case 'added_to_campaign':
        return <Badge variant="outline" className="bg-green-50"><CheckCircle2 className="w-3 h-3 mr-1" />Completed</Badge>;
      case 'failed':
        return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
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
          <h1 className="text-3xl font-bold">Contact Pipeline Dashboard</h1>
          <p className="text-muted-foreground">
            Automated list cleaning and weekly batch uploads
          </p>
        </div>
        <div className="flex gap-2">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-4 py-2 border rounded-md bg-background text-foreground font-medium focus:ring-2 focus:ring-primary focus:outline-none"
          >
            {Array.from({ length: 12 }, (_, i) => {
              const date = new Date();
              date.setMonth(date.getMonth() + i);
              const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
              return (
                <option key={value} value={value}>
                  {date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </option>
              );
            })}
          </select>
          <Button
            variant="default"
            onClick={() => setUploadModalOpen(true)}
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload CSV
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              fetchPipelineSummaries();
              fetchWeeklyBatches();
            }}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Upload Modal */}
      {uploadModalOpen && (
        <UploadCSVModal
          open={uploadModalOpen}
          onClose={() => {
            setUploadModalOpen(false);
            setUploadResult(null);
          }}
          onUploadComplete={(result) => {
            setUploadResult(result);
            fetchPipelineSummaries();
            fetchWeeklyBatches();
          }}
        />
      )}

      {/* ZIP Batch Upload Modal */}
      {zipBatchModalOpen && selectedClient && (
        <ZipBatchUploadModal
          open={zipBatchModalOpen}
          onClose={() => {
            setZipBatchModalOpen(false);
            setSelectedClient(null);
            fetchPipelineSummaries();
          }}
          workspaceName={selectedClient.workspace_name}
          displayName={selectedClient.display_name}
          month={selectedMonth}
        />
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clean Contact Target</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCleanTarget.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Monthly verified contact goal
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Raw Contacts</CardTitle>
            <Upload className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRawContacts.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Total uploaded contacts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Verified Contacts</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalVerified.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Email verified & deliverable
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Added to Campaign</CardTitle>
            <Mail className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalAddedToCampaign.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Batches in Email Bison
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="clients" className="space-y-4">
        <TabsList>
          <TabsTrigger value="clients">Client Progress</TabsTrigger>
          <TabsTrigger value="batches">Weekly Batches</TabsTrigger>
        </TabsList>

        {/* Client Progress Tab */}
        <TabsContent value="clients" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Client Contact Pipeline Progress</CardTitle>
              <CardDescription>
                Track verification and upload progress for each client
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead className="text-right">Clean Contact Target</TableHead>
                    <TableHead className="text-right">ZIP Codes Pulled</TableHead>
                    <TableHead className="text-right">Verified</TableHead>
                    <TableHead className="text-right">Total Raw Contacts</TableHead>
                    <TableHead className="text-right">Gap</TableHead>
                    <TableHead className="text-right">Added to Campaign</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pipelineSummaries.map((summary) => (
                    <TableRow key={`${summary.workspace_name}-${summary.month}`}>
                      <TableCell className="font-medium">
                        <button
                          onClick={async () => {
                            // Initialize batches if not already done
                            try {
                              await supabase.functions.invoke('initialize-zip-batches', {
                                body: { workspace_name: summary.workspace_name, month: selectedMonth }
                              });
                            } catch (error) {
                              console.error('Error initializing batches:', error);
                            }

                            setSelectedClient({
                              workspace_name: summary.workspace_name,
                              display_name: summary.client_display_name,
                            });
                            setZipBatchModalOpen(true);
                          }}
                          className="text-left hover:underline focus:outline-none focus:underline"
                        >
                          {summary.client_display_name}
                        </button>
                        {summary.contact_tier && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            {summary.contact_tier}
                          </Badge>
                        )}
                      </TableCell>
                      {/* 2. Clean Contact Target */}
                      <TableCell className="text-right">
                        {summary.clean_contact_target?.toLocaleString() || '0'}
                      </TableCell>

                      {/* 3. ZIP Codes Pulled */}
                      <TableCell className="text-right">
                        {summary.total_zips ? (
                          <div className="flex flex-col items-end">
                            <span className="font-medium">
                              {summary.zips_pulled} / {summary.total_zips}
                            </span>
                            {summary.total_raw_contacts > 0 && (
                              <span className="text-xs text-muted-foreground">
                                {summary.total_raw_contacts.toLocaleString()} contacts
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>

                      {/* 4. Verified */}
                      <TableCell className="text-right">
                        {summary.verified_contacts.toLocaleString()}
                      </TableCell>

                      {/* 5. Total Raw Contacts */}
                      <TableCell className="text-right">
                        {summary.total_raw_contacts.toLocaleString()}
                      </TableCell>

                      {/* 6. Gap */}
                      <TableCell className="text-right">
                        {summary.contacts_gap > 0 ? (
                          <span className="text-red-600 font-medium">
                            -{summary.contacts_gap.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-green-600 font-medium">
                            ✓
                          </span>
                        )}
                      </TableCell>

                      {/* 7. Added to Campaign */}
                      <TableCell className="text-right">
                        {summary.added_to_campaign_count > 0 ? (
                          <Badge variant="outline" className="bg-green-50">
                            {summary.added_to_campaign_count}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Weekly Batches Tab */}
        <TabsContent value="batches" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Weekly Batch Upload Schedule</CardTitle>
              <CardDescription>
                Monitor scheduled and completed batch uploads to Email Bison
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Week</TableHead>
                    <TableHead>Scheduled Date</TableHead>
                    <TableHead className="text-right">Contacts</TableHead>
                    <TableHead className="text-right">HNW</TableHead>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Approved By</TableHead>
                    <TableHead>Upload Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {weeklyBatches.map((batch) => (
                    <TableRow key={batch.batch_id}>
                      <TableCell className="font-medium">
                        {batch.client_display_name || batch.workspace_name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">Week {batch.week_number}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          {new Date(batch.scheduled_upload_date).toLocaleDateString()}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {batch.contact_count.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {batch.hnw_count > 0 && (
                          <Badge variant="outline" className="bg-purple-50">
                            {batch.hnw_count}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {batch.bison_campaign_name || 'Evergreen'}
                        </span>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(batch.bison_upload_status)}
                      </TableCell>
                      <TableCell>
                        {batch.slack_approved_by ? (
                          <div className="text-xs">
                            <div className="font-medium">{batch.slack_approved_by}</div>
                            <div className="text-muted-foreground">
                              {batch.slack_approved_at && new Date(batch.slack_approved_at).toLocaleDateString()}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">Pending approval</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {batch.upload_status_text}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ContactPipelineDashboard;
