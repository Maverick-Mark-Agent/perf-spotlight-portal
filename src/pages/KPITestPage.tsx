import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, RefreshCw, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const KPITestPage = () => {
  const [loading, setLoading] = useState(true);
  const [testData, setTestData] = useState<any>(null);
  const { toast } = useToast();

  const fetchTestData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('email-bison-kpi-test');

      if (error) throw error;

      setTestData(data);
      toast({
        title: "Success",
        description: "Test data loaded successfully",
      });
    } catch (error) {
      console.error('Error fetching test data:', error);
      toast({
        title: "Error",
        description: "Failed to fetch test data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTestData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-lg text-muted-foreground">Loading test data...</p>
        </div>
      </div>
    );
  }

  if (!testData) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Failed to load test data. Please try again.</p>
            <Button onClick={fetchTestData} className="mt-4">Retry</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { client, monthlyKPI, airtableMetrics, emailBisonMetrics, calculatedMetrics, comparison } = testData;

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b border-border shadow-md">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button asChild variant="ghost" size="sm">
                <Link to="/kpi-dashboard">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to KPI Dashboard
                </Link>
              </Button>
              <div>
                <h1 className="text-2xl font-bold">Email Bison KPI Test</h1>
                <p className="text-sm text-muted-foreground">Comparing Airtable vs Email Bison data sources</p>
              </div>
            </div>
            <Button onClick={fetchTestData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Client Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Testing: {client}</span>
              <Badge variant="outline" className="text-lg">Monthly Target: {monthlyKPI}</Badge>
            </CardTitle>
          </CardHeader>
        </Card>

        {/* Comparison Alert */}
        <Card className={`border-2 ${comparison.mtdDifference !== 0 ? 'border-destructive bg-destructive/5' : 'border-success bg-success/5'}`}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {comparison.mtdDifference !== 0 ? (
                <>
                  <AlertCircle className="h-5 w-5 text-destructive" />
                  <span className="text-destructive">Data Mismatch Detected</span>
                </>
              ) : (
                <>
                  <CheckCircle className="h-5 w-5 text-success" />
                  <span className="text-success">Data Matches</span>
                </>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg">{comparison.message}</p>
            <p className="text-sm text-muted-foreground mt-2">
              Difference: {comparison.mtdDifference > 0 ? '+' : ''}{comparison.mtdDifference} leads
            </p>
          </CardContent>
        </Card>

        {/* Side-by-Side Comparison */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Airtable Data */}
          <Card className="border-2 border-orange-500/50">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Current Source: Airtable</span>
                <XCircle className="h-5 w-5 text-destructive" />
              </CardTitle>
              <p className="text-sm text-muted-foreground">Data from Airtable linked records</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <div className="text-sm text-muted-foreground">Positive Replies MTD</div>
                <div className="text-4xl font-bold">{airtableMetrics.positiveRepliesMTD}</div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between p-2 bg-muted/50 rounded">
                  <span className="text-sm">Current Month:</span>
                  <span className="font-semibold">{airtableMetrics.positiveRepliesCurrentMonth}</span>
                </div>
                <div className="flex justify-between p-2 bg-muted/50 rounded">
                  <span className="text-sm">Last 7 Days:</span>
                  <span className="font-semibold">{airtableMetrics.positiveRepliesLast7Days}</span>
                </div>
                <div className="flex justify-between p-2 bg-muted/50 rounded">
                  <span className="text-sm">Last 30 Days:</span>
                  <span className="font-semibold">{airtableMetrics.positiveRepliesLast30Days}</span>
                </div>
                <div className="flex justify-between p-2 bg-muted/50 rounded">
                  <span className="text-sm">Last Month:</span>
                  <span className="font-semibold">{airtableMetrics.positiveRepliesLastMonth}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Email Bison Data */}
          <Card className="border-2 border-success/50">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>New Source: Email Bison</span>
                <CheckCircle className="h-5 w-5 text-success" />
              </CardTitle>
              <p className="text-sm text-muted-foreground">Real-time data from Email Bison API</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-success/10 rounded-lg border border-success/30">
                <div className="text-sm text-muted-foreground">Positive Replies MTD</div>
                <div className="text-4xl font-bold text-success">{emailBisonMetrics.positiveRepliesMTD}</div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between p-2 bg-muted/50 rounded">
                  <span className="text-sm">Current Month:</span>
                  <span className="font-semibold">{emailBisonMetrics.positiveRepliesCurrentMonth}</span>
                </div>
                <div className="flex justify-between p-2 bg-muted/50 rounded">
                  <span className="text-sm">Last 7 Days:</span>
                  <span className="font-semibold">{emailBisonMetrics.positiveRepliesLast7Days}</span>
                </div>
                <div className="flex justify-between p-2 bg-muted/50 rounded">
                  <span className="text-sm">Last 30 Days:</span>
                  <span className="font-semibold">{emailBisonMetrics.positiveRepliesLast30Days}</span>
                </div>
                <div className="flex justify-between p-2 bg-muted/50 rounded">
                  <span className="text-sm">Last Month:</span>
                  <span className="font-semibold">{emailBisonMetrics.positiveRepliesLastMonth}</span>
                </div>
              </div>

              <div className="pt-4 border-t space-y-2">
                <div className="flex justify-between p-2 bg-primary/5 rounded">
                  <span className="text-sm">Emails Sent MTD:</span>
                  <span className="font-semibold">{emailBisonMetrics.emailsSent}</span>
                </div>
                <div className="flex justify-between p-2 bg-primary/5 rounded">
                  <span className="text-sm">Reply Rate:</span>
                  <span className="font-semibold">{emailBisonMetrics.replyRate}%</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Calculated Metrics */}
        <Card>
          <CardHeader>
            <CardTitle>Calculated Metrics (Email Bison)</CardTitle>
            <p className="text-sm text-muted-foreground">Projections and comparisons based on Email Bison data</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="p-4 bg-muted rounded-lg">
                <div className="text-sm text-muted-foreground">Daily Average</div>
                <div className="text-2xl font-bold">{calculatedMetrics.dailyAverage}</div>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <div className="text-sm text-muted-foreground">Projected EOM</div>
                <div className="text-2xl font-bold">{calculatedMetrics.projectedReplies}</div>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <div className="text-sm text-muted-foreground">Current Progress</div>
                <div className="text-2xl font-bold">{calculatedMetrics.currentProgress}</div>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <div className="text-sm text-muted-foreground">Projection Progress</div>
                <div className="text-2xl font-bold">{calculatedMetrics.projectionProgress}</div>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <div className="text-sm text-muted-foreground">Week vs Week</div>
                <div className="text-2xl font-bold">{calculatedMetrics.lastWeekVsWeekBeforeProgress}</div>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <div className="text-sm text-muted-foreground">Month vs Month</div>
                <div className="text-2xl font-bold">{calculatedMetrics.positiveRepliesLastVsThisMonth}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Next Steps */}
        <Card className="border-2 border-primary/50">
          <CardHeader>
            <CardTitle>Next Steps</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-success text-success-foreground flex items-center justify-center font-bold shrink-0">
                1
              </div>
              <div>
                <div className="font-semibold">Verify Data Accuracy</div>
                <div className="text-sm text-muted-foreground">Email Bison shows {emailBisonMetrics.positiveRepliesMTD} leads vs Airtable's {airtableMetrics.positiveRepliesMTD}. Confirm this is correct.</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold shrink-0">
                2
              </div>
              <div>
                <div className="font-semibold">Update Main Function</div>
                <div className="text-sm text-muted-foreground">Apply this logic to all clients in the hybrid-workspace-analytics function</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center font-bold shrink-0">
                3
              </div>
              <div>
                <div className="font-semibold">Deploy & Monitor</div>
                <div className="text-sm text-muted-foreground">Deploy updated function and verify all clients show accurate data</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default KPITestPage;
