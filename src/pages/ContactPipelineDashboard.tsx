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

interface PipelineSummary {
  workspace_name: string;
  month: string;
  client_display_name: string;
  monthly_contact_target: number;
  contact_tier: string;
  upload_batch_count: number;
  raw_contacts_uploaded: number;
  verified_contacts: number;
  deliverable_count: number;
  undeliverable_count: number;
  risky_count: number;
  contacts_uploaded: number;
  contacts_pending: number;
  hnw_contacts: number;
  batches_created: number;
  batches_completed: number;
  contacts_needed: number;
  target_percentage: number;
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

  // Fetch pipeline summaries
  const fetchPipelineSummaries = async () => {
    try {
      const { data, error } = await supabase
        .from('monthly_contact_pipeline_summary')
        .select('*')
        .eq('month', selectedMonth)
        .order('target_percentage', { ascending: false });

      if (error) throw error;
      setPipelineSummaries(data || []);
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
  const totalTarget = pipelineSummaries.reduce((sum, p) => sum + (p.monthly_contact_target || 0), 0);
  const totalRawUploads = pipelineSummaries.reduce((sum, p) => sum + p.raw_contacts_uploaded, 0);
  const totalVerified = pipelineSummaries.reduce((sum, p) => sum + p.verified_contacts, 0);
  const totalUploaded = pipelineSummaries.reduce((sum, p) => sum + p.contacts_uploaded, 0);
  const totalPending = pipelineSummaries.reduce((sum, p) => sum + p.contacts_pending, 0);
  const overallPercentage = totalTarget > 0 ? (totalVerified / totalTarget) * 100 : 0;

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
              date.setMonth(date.getMonth() - i);
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

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Target</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTarget.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Monthly contact quota
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Raw Uploads</CardTitle>
            <Upload className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRawUploads.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Total CSV contacts
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
              {overallPercentage.toFixed(1)}% of target
            </p>
            <Progress value={overallPercentage} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Uploaded</CardTitle>
            <Mail className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUploaded.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Sent to Email Bison
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Upload</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPending.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Ready for weekly batches
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
                    <TableHead className="text-right">Target</TableHead>
                    <TableHead className="text-right">Verified</TableHead>
                    <TableHead className="text-right">Deliverable</TableHead>
                    <TableHead className="text-right">Uploaded</TableHead>
                    <TableHead className="text-right">Pending</TableHead>
                    <TableHead className="text-right">HNW</TableHead>
                    <TableHead className="text-right">Progress</TableHead>
                    <TableHead className="text-right">Gap</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pipelineSummaries.map((summary) => (
                    <TableRow key={`${summary.workspace_name}-${summary.month}`}>
                      <TableCell className="font-medium">
                        {summary.client_display_name}
                        {summary.contact_tier && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            {summary.contact_tier}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {summary.monthly_contact_target?.toLocaleString() || '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        {summary.verified_contacts.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-green-600 font-medium">
                          {summary.deliverable_count.toLocaleString()}
                        </span>
                        <span className="text-xs text-muted-foreground ml-1">
                          ({summary.undeliverable_count + summary.risky_count} bad)
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {summary.contacts_uploaded.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {summary.contacts_pending.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {summary.hnw_contacts > 0 && (
                          <Badge variant="outline" className="bg-purple-50">
                            {summary.hnw_contacts.toLocaleString()}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className={`font-medium ${
                            summary.target_percentage >= 100 ? 'text-green-600' :
                            summary.target_percentage >= 80 ? 'text-yellow-600' :
                            'text-red-600'
                          }`}>
                            {summary.target_percentage?.toFixed(0) || 0}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {summary.contacts_needed > 0 ? (
                          <span className="text-red-600 font-medium">
                            -{summary.contacts_needed.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-green-600 font-medium">
                            +{Math.abs(summary.contacts_needed).toLocaleString()}
                          </span>
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
