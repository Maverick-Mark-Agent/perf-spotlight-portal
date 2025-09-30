import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, TrendingUp, Mail, Users, BarChart3, Calendar, Send, Target, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ClientSchedule {
  clientName: string;
  todayEmails: number;
  tomorrowEmails: number;
  totalScheduled: number;
  threeDayAverage: number;
}

const SendingVolumeDashboard = () => {
  const [isWebhookLoading, setIsWebhookLoading] = useState(false);
  const [schedules, setSchedules] = useState<ClientSchedule[]>([]);
  const [targetVolumePerDay, setTargetVolumePerDay] = useState(0);
  const [isLoadingSchedules, setIsLoadingSchedules] = useState(true);
  const [sortField, setSortField] = useState<'avgScheduled' | 'avgTarget' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    fetchScheduledEmails();
  }, []);

  const fetchScheduledEmails = async () => {
    try {
      console.log("Fetching scheduled emails from Airtable...");
      const { data, error } = await supabase.functions.invoke('airtable-campaigns');
      
      if (error) throw error;
      
      console.log("Scheduled emails data:", data);
      setSchedules(data.schedules || []);
      setTargetVolumePerDay(data.targetVolumePerDay || 0);
    } catch (error) {
      console.error("Error fetching scheduled emails:", error);
      toast({
        title: "Error",
        description: "Failed to fetch scheduled emails data",
        variant: "destructive",
      });
    } finally {
      setIsLoadingSchedules(false);
    }
  };

  const handleSort = (field: 'avgScheduled' | 'avgTarget') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedSchedules = useMemo(() => {
    if (!sortField) return schedules;
    
    return [...schedules].sort((a, b) => {
      let aVal = 0;
      let bVal = 0;
      
      if (sortField === 'avgScheduled') {
        aVal = a.totalScheduled;
        bVal = b.totalScheduled;
      } else if (sortField === 'avgTarget') {
        aVal = a.threeDayAverage;
        bVal = b.threeDayAverage;
      }
      
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [schedules, sortField, sortDirection]);

  const handleWebhookTrigger = async () => {
    setIsWebhookLoading(true);
    try {
      const response = await fetch('https://longrun.up.railway.app/webhook/677d43c6-3863-4352-b924-8782f33db6e8', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        toast({
          title: "Webhook triggered successfully",
          description: "The webhook has been called.",
        });
      } else {
        throw new Error('Failed to trigger webhook');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to trigger webhook. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsWebhookLoading(false);
    }
  };

  const clientData = [
    { name: "Kim Wallace", emails: 76905, target: 78000 },
    { name: "Jason Binyon", emails: 65558, target: 78000 },
    { name: "David Amiri", emails: 45191, target: 39000 },
    { name: "Workspark", emails: 37985, target: 52000 },
    { name: "John Roberts", emails: 35306, target: 39000 },
    { name: "Rob Russell", emails: 31772, target: 39000 },
    { name: "StreetSmart Trucking", emails: 27104, target: 52000 },
    { name: "StreetSmart P&C", emails: 21638, target: 39000 },
    { name: "Danny Schwartz", emails: 20753, target: 39000 },
    { name: "Radiant Energy", emails: 17045, target: 39000 },
    { name: "SMA Insurance", emails: 16246, target: 52000 },
    { name: "StreetSmart Commercial", emails: 15860, target: 52000 },
    { name: "Jeff Schroder", emails: 14705, target: 26000 },
    { name: "Devin Hodo", emails: 13555, target: 39000 },
    { name: "Kirk Hodgson", emails: 11108, target: 26000 },
    { name: "ATI", emails: 6059, target: 13000 },
    { name: "Maverick Longrun", emails: 3611, target: 26000 }
  ].map(client => ({
    ...client,
    targetPercentage: (client.emails / client.target) * 100,
    isAboveTarget: client.emails >= client.target,
    variance: client.emails - client.target
  })).sort((a, b) => b.targetPercentage - a.targetPercentage)
  .map((client, index) => ({
    ...client,
    rank: index + 1
  }));

  const getPerformanceColor = (client: any) => {
    if (client.isAboveTarget) return "green";
    if (client.targetPercentage >= 80) return "yellow";
    return "red";
  };

  const totalEmails = clientData.reduce((sum, client) => sum + client.emails, 0);
  const totalTargets = clientData.reduce((sum, client) => sum + client.target, 0);
  const overallTargetPercentage = (totalEmails / totalTargets) * 100;

  return (
    <div className="min-h-screen bg-gradient-dashboard">
      {/* Header */}
      <div className="bg-white/5 backdrop-blur-md border-b border-white/10 shadow-xl">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button asChild variant="ghost" size="sm" className="text-white/70 hover:text-white hover:bg-white/10">
                <Link to="/">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Portal
                </Link>
              </Button>
              <div className="h-6 w-px bg-white/20"></div>
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-white via-dashboard-primary to-dashboard-accent bg-clip-text text-transparent">
                  Sending Volume Overview
                </h1>
              </div>
            </div>
            <Button 
              onClick={handleWebhookTrigger}
              disabled={isWebhookLoading}
              variant="default"
              size="lg"
              className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-bold px-8 py-6 text-lg shadow-2xl shadow-red-500/50 hover:shadow-red-600/60 transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              <Send className="h-6 w-6 mr-3" />
              {isWebhookLoading ? "Sending..." : "Send Volume Slack DM"}
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Performance Highlights */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          {/* Top Performers */}
          <Card className="bg-dashboard-success/15 backdrop-blur-sm border-dashboard-success/50 shadow-2xl">
            <CardHeader>
              <CardTitle className="text-dashboard-success flex items-center gap-2 text-xl font-bold">
                <TrendingUp className="h-6 w-6" />
                Exceeding Targets
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {clientData.filter(client => client.isAboveTarget).slice(0, 3).map((client, index) => (
                <div key={client.name} className="flex items-center justify-between p-4 bg-white/10 rounded-lg border border-dashboard-success/40">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-dashboard-success text-white flex items-center justify-center font-bold text-sm">
                      ✓
                    </div>
                    <div>
                      <span className="text-foreground font-semibold block">{client.name}</span>
                      <span className="text-muted-foreground text-sm">{client.targetPercentage.toFixed(1)}% of target</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-dashboard-success font-bold text-lg">{client.emails.toLocaleString()}</span>
                    <div className="text-muted-foreground text-xs">Target: {client.target.toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Total Summary */}
          <Card className="bg-dashboard-primary/15 backdrop-blur-sm border-dashboard-primary/50 shadow-2xl">
            <CardHeader>
              <CardTitle className="text-dashboard-primary flex items-center gap-2 text-xl font-bold">
                <BarChart3 className="h-6 w-6" />
                Overall Progress
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center py-8">
              <div className="text-5xl font-bold text-dashboard-primary mb-2">{overallTargetPercentage.toFixed(1)}%</div>
              <p className="text-muted-foreground text-lg">Target Achievement</p>
              <div className="mt-4 w-full bg-white/20 rounded-full h-3">
                <div 
                  className={`h-3 rounded-full transition-all duration-1000 ${
                    overallTargetPercentage >= 100 
                      ? 'bg-dashboard-success' 
                      : overallTargetPercentage >= 80
                      ? 'bg-dashboard-warning'
                      : 'bg-dashboard-danger'
                  }`}
                  style={{ width: `${Math.min(overallTargetPercentage, 100)}%` }}
                ></div>
              </div>
              <p className="text-foreground text-sm mt-2">{totalEmails.toLocaleString()} / {totalTargets.toLocaleString()}</p>
            </CardContent>
          </Card>

          {/* Performance Summary */}
          <Card className="bg-dashboard-warning/15 backdrop-blur-sm border-dashboard-warning/50 shadow-2xl">
            <CardHeader>
              <CardTitle className="text-dashboard-warning flex items-center gap-2 text-xl font-bold">
                <Target className="h-6 w-6" />
                Performance Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-white/10 rounded-lg border border-white/20">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-muted-foreground text-sm">Clients Meeting Target</span>
                  <span className="text-foreground font-bold text-lg">
                    {clientData.filter(c => c.isAboveTarget).length} / {clientData.length}
                  </span>
                </div>
              </div>
              
              <div className="p-4 bg-white/10 rounded-lg border border-white/20">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-muted-foreground text-sm">Average Achievement</span>
                  <span className="text-foreground font-bold text-lg">
                    {(clientData.reduce((sum, c) => sum + c.targetPercentage, 0) / clientData.length).toFixed(1)}%
                  </span>
                </div>
              </div>

              <div className="p-4 bg-white/10 rounded-lg border border-white/20">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-muted-foreground text-sm">Total Variance</span>
                  <span className={`font-bold text-lg ${
                    (totalEmails - totalTargets) >= 0 ? 'text-dashboard-success' : 'text-dashboard-danger'
                  }`}>
                    {(totalEmails - totalTargets) >= 0 ? '+' : ''}{(totalEmails - totalTargets).toLocaleString()}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Scheduled Emails Section */}
        <Card className="bg-white/5 backdrop-blur-sm border-white/10 shadow-2xl mb-12">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-white flex items-center gap-3 text-xl">
                  <Calendar className="h-6 w-6 text-dashboard-primary" />
                  Scheduled Emails
                </CardTitle>
                <p className="text-white/60 mt-1 text-sm">Today & Tomorrow per client</p>
              </div>
              <div className="flex gap-6">
                {schedules.length > 0 && (
                  <>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-100">
                        {schedules.reduce((sum, s) => sum + s.todayEmails, 0).toLocaleString()}
                      </div>
                      <div className="text-xs text-blue-200">Total Today</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-100">
                        {schedules.reduce((sum, s) => sum + s.tomorrowEmails, 0).toLocaleString()}
                      </div>
                      <div className="text-xs text-purple-200">Total Tomorrow</div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingSchedules ? (
              <div className="text-center py-8 text-white/60">Loading scheduled emails...</div>
            ) : schedules.length === 0 ? (
              <div className="text-center py-8 text-white/60">No scheduled emails found</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left py-3 px-4 text-white/80 font-semibold">Client</th>
                      <th className="text-right py-3 px-4 text-white/80 font-semibold">Today</th>
                      <th className="text-right py-3 px-4 text-white/80 font-semibold">Tomorrow</th>
                      <th 
                        className="text-right py-3 px-4 text-white/80 font-semibold cursor-pointer hover:text-white transition-colors"
                        onClick={() => handleSort('avgScheduled')}
                      >
                        <div className="flex items-center justify-end gap-2">
                          Average Scheduled
                          {sortField === 'avgScheduled' ? (
                            sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                          ) : (
                            <ArrowUpDown className="h-4 w-4 opacity-50" />
                          )}
                        </div>
                      </th>
                      <th 
                        className="text-right py-3 px-4 text-white/80 font-semibold cursor-pointer hover:text-white transition-colors"
                        onClick={() => handleSort('avgTarget')}
                      >
                        <div className="flex items-center justify-end gap-2">
                          Average Target Volume
                          {sortField === 'avgTarget' ? (
                            sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                          ) : (
                            <ArrowUpDown className="h-4 w-4 opacity-50" />
                          )}
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedSchedules.map((schedule, index) => (
                      <tr 
                        key={schedule.clientName}
                        className={`border-b border-white/5 hover:bg-white/5 transition-colors ${
                          index % 2 === 0 ? 'bg-white/[0.02]' : ''
                        }`}
                      >
                        <td className="py-3 px-4 text-white font-medium">{schedule.clientName}</td>
                        <td className="py-3 px-4 text-right text-blue-100 font-semibold">
                          {schedule.todayEmails.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right text-purple-100 font-semibold">
                          {schedule.tomorrowEmails.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right text-green-100 font-bold">
                          {Math.round(schedule.totalScheduled).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right text-orange-100 font-bold">
                          {Math.round(schedule.threeDayAverage || 0).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Main Performance Display */}
        <Card className="bg-white/5 backdrop-blur-sm border-white/10 shadow-2xl">
          <CardHeader className="pb-6">
            <CardTitle className="text-white flex items-center gap-3 text-2xl">
              <Users className="h-7 w-7 text-dashboard-primary" />
              Sending Volume MTD
            </CardTitle>
            <p className="text-white/60 mt-2">All clients with actual vs target performance comparison</p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              {clientData.map((client) => {
                const percentage = (client.emails / client.target) * 100;
                const performanceColor = getPerformanceColor(client);
                const isExceeding = client.isAboveTarget;
                const isClose = client.targetPercentage >= 80 && client.targetPercentage < 100;
                const isFarBehind = client.targetPercentage < 50;
                
                return (
                  <div 
                    key={client.name} 
                    className={`p-6 rounded-xl border-2 transition-all duration-300 hover:scale-[1.02] ${
                      isExceeding 
                        ? 'bg-gradient-to-r from-green-500/20 to-green-600/30 border-green-400/50 shadow-green-500/20' 
                        : isClose 
                        ? 'bg-gradient-to-r from-yellow-500/20 to-yellow-600/30 border-yellow-400/50 shadow-yellow-500/20'
                        : isFarBehind
                        ? 'bg-gradient-to-r from-red-500/20 to-red-600/30 border-red-400/50 shadow-red-500/20'
                        : 'bg-gradient-to-r from-orange-500/20 to-orange-600/30 border-orange-400/50 shadow-orange-500/20'
                    } shadow-xl`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${
                          isExceeding 
                            ? 'bg-green-400 text-green-900' 
                            : isClose
                            ? 'bg-yellow-400 text-yellow-900'
                            : isFarBehind
                            ? 'bg-red-400 text-red-900'
                            : 'bg-orange-400 text-orange-900'
                        }`}>
                          {isExceeding ? '✓' : client.targetPercentage.toFixed(0)}%
                        </div>
                        <div>
                          <h3 className={`text-xl font-bold ${
                            isExceeding ? 'text-green-100' : isClose ? 'text-yellow-100' : isFarBehind ? 'text-red-100' : 'text-orange-100'
                          }`}>
                            {client.name}
                          </h3>
                          <p className={`text-sm ${
                            isExceeding ? 'text-green-200' : isClose ? 'text-yellow-200' : isFarBehind ? 'text-red-200' : 'text-orange-200'
                          }`}>
                            {isExceeding ? 'Target Exceeded!' : isClose ? 'Close to Target' : isFarBehind ? 'Far Behind Target' : 'Below Target'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-3xl font-bold ${
                          isExceeding ? 'text-green-100' : isClose ? 'text-yellow-100' : isFarBehind ? 'text-red-100' : 'text-orange-100'
                        }`}>
                          {client.emails.toLocaleString()}
                        </div>
                        <p className={`text-sm ${
                          isExceeding ? 'text-green-200' : isClose ? 'text-yellow-200' : isFarBehind ? 'text-red-200' : 'text-orange-200'
                        }`}>
                          Target: {client.target.toLocaleString()}
                        </p>
                        <p className={`text-xs font-semibold ${
                          isExceeding ? 'text-green-300' : isClose ? 'text-yellow-300' : isFarBehind ? 'text-red-300' : 'text-orange-300'
                        }`}>
                          {client.variance >= 0 ? '+' : ''}{client.variance.toLocaleString()} variance
                        </p>
                      </div>
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="relative">
                      <div className={`w-full h-4 rounded-full ${
                        isExceeding ? 'bg-green-900/30' : isClose ? 'bg-yellow-900/30' : isFarBehind ? 'bg-red-900/30' : 'bg-orange-900/30'
                      }`}>
                        <div 
                          className={`h-4 rounded-full transition-all duration-1000 ${
                            isExceeding 
                              ? 'bg-gradient-to-r from-green-400 to-green-500' 
                              : isClose
                              ? 'bg-gradient-to-r from-yellow-400 to-yellow-500'
                              : isFarBehind
                              ? 'bg-gradient-to-r from-red-400 to-red-500'
                              : 'bg-gradient-to-r from-orange-400 to-orange-500'
                          }`}
                          style={{ width: `${Math.min(percentage, 100)}%` }}
                        ></div>
                      </div>
                      <div className={`absolute right-2 top-0 h-4 flex items-center text-xs font-bold ${
                        isExceeding ? 'text-green-900' : isClose ? 'text-yellow-900' : isFarBehind ? 'text-red-900' : 'text-orange-900'
                      }`}>
                        {percentage.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SendingVolumeDashboard;