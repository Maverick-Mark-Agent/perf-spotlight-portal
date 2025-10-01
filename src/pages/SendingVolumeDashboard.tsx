import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowLeft, TrendingUp, Mail, Users, BarChart3, Calendar, Send, Target, ArrowUpDown, ArrowUp, ArrowDown, RefreshCw } from "lucide-react";
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

interface ClientData {
  name: string;
  emails: number;
  target: number;
  projection: number;
  targetPercentage: number;
  projectedPercentage: number;
  isAboveTarget: boolean;
  isProjectedAboveTarget: boolean;
  variance: number;
  projectedVariance: number;
  distanceToTarget: number;
  rank: number;
}

const SendingVolumeDashboard = () => {
  const [isWebhookLoading, setIsWebhookLoading] = useState(false);
  const [schedules, setSchedules] = useState<ClientSchedule[]>([]);
  const [clientData, setClientData] = useState<ClientData[]>([]);
  const [targetVolumePerDay, setTargetVolumePerDay] = useState(0);
  const [isLoadingSchedules, setIsLoadingSchedules] = useState(true);
  const [isLoadingClients, setIsLoadingClients] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRefreshingClients, setIsRefreshingClients] = useState(false);
  const [sortField, setSortField] = useState<'avgScheduled' | 'avgTarget' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    fetchScheduledEmails();
    fetchClientData();
  }, []);

  const fetchScheduledEmails = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setIsRefreshing(true);
      }
      console.log("Fetching scheduled emails from Airtable...");
      const { data, error } = await supabase.functions.invoke('airtable-campaigns');
      
      if (error) throw error;
      
      console.log("Scheduled emails data:", data);
      setSchedules(data.schedules || []);
      setTargetVolumePerDay(data.targetVolumePerDay || 0);
      
      if (isRefresh) {
        toast({
          title: "Success",
          description: "Scheduled emails refreshed successfully",
        });
      }
    } catch (error) {
      console.error("Error fetching scheduled emails:", error);
      toast({
        title: "Error",
        description: "Failed to fetch scheduled emails data",
        variant: "destructive",
      });
    } finally {
      setIsLoadingSchedules(false);
      if (isRefresh) {
        setIsRefreshing(false);
      }
    }
  };

  const fetchClientData = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setIsRefreshingClients(true);
      }
      console.log("Fetching client sending volume from Airtable...");
      const { data, error } = await supabase.functions.invoke('airtable-sending-volume');
      
      if (error) throw error;
      
      console.log("Client data:", data);
      setClientData(data.clients || []);
      
      if (isRefresh) {
        toast({
          title: "Success",
          description: "Sending volume data refreshed successfully",
        });
      }
    } catch (error) {
      console.error("Error fetching client data:", error);
      toast({
        title: "Error",
        description: "Failed to fetch sending volume data",
        variant: "destructive",
      });
    } finally {
      setIsLoadingClients(false);
      if (isRefresh) {
        setIsRefreshingClients(false);
      }
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


  const getPerformanceColor = (client: any) => {
    if (client.isAboveTarget) return "green";
    if (client.targetPercentage >= 80) return "yellow";
    return "red";
  };

  const totalEmails = clientData.reduce((sum, client) => sum + client.emails, 0);
  const totalTargets = clientData.reduce((sum, client) => sum + client.target, 0);
  const overallTargetPercentage = (totalEmails / totalTargets) * 100;

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b border-border shadow-md">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button asChild variant="ghost" size="sm" className="hover:bg-accent">
                <Link to="/">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Portal
                </Link>
              </Button>
              <div className="h-6 w-px bg-border"></div>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-primary/10 rounded-xl">
                  <Send className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-foreground">
                    Sending Volume Overview
                  </h1>
                  <p className="text-muted-foreground text-sm">Monitor daily email sending performance</p>
                </div>
              </div>
            </div>
            <Button 
              onClick={handleWebhookTrigger}
              disabled={isWebhookLoading}
              variant="default"
              size="lg"
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold px-6 py-3 text-base shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl disabled:opacity-50"
            >
              <Send className="h-5 w-5 mr-2" />
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
                On Track to Exceed Target
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {clientData.filter(client => client.isProjectedAboveTarget).slice(0, 3).map((client, index) => (
                <div key={client.name} className="flex items-center justify-between p-4 bg-white/10 rounded-lg border border-dashboard-success/40">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-dashboard-success text-white flex items-center justify-center font-bold text-sm">
                      #{client.rank}
                    </div>
                    <div>
                      <span className="text-foreground font-semibold block">{client.name}</span>
                      <span className="text-muted-foreground text-sm">Projected: {client.projectedPercentage.toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-dashboard-success font-bold text-lg">{client.projection.toLocaleString()}</span>
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
                  <span className="text-muted-foreground text-sm">Projected to Meet Target</span>
                  <span className="text-foreground font-bold text-lg">
                    {clientData.filter(c => c.isProjectedAboveTarget).length} / {clientData.length}
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
              <div className="flex items-center gap-4">
                <div>
                  <CardTitle className="text-white flex items-center gap-3 text-xl">
                    <Calendar className="h-6 w-6 text-dashboard-primary" />
                    Scheduled Emails
                  </CardTitle>
                  <p className="text-white/60 mt-1 text-sm">Today & Tomorrow per client</p>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={() => fetchScheduledEmails(true)}
                      disabled={isRefreshing}
                      variant="ghost"
                      size="sm"
                      className="text-white/70 hover:text-white hover:bg-white/10"
                    >
                      <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Refresh scheduled emails data</p>
                  </TooltipContent>
                </Tooltip>
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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div>
                  <CardTitle className="text-white flex items-center gap-3 text-2xl">
                    <Users className="h-7 w-7 text-dashboard-primary" />
                    Sending Volume MTD
                  </CardTitle>
                  <p className="text-white/60 mt-2">All clients with actual vs target performance comparison</p>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={() => fetchClientData(true)}
                      disabled={isRefreshingClients}
                      variant="ghost"
                      size="sm"
                      className="text-white/70 hover:text-white hover:bg-white/10"
                    >
                      <RefreshCw className={`h-4 w-4 ${isRefreshingClients ? 'animate-spin' : ''}`} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Refresh sending volume data</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingClients ? (
              <div className="text-center py-8 text-white/60">Loading client data...</div>
            ) : clientData.length === 0 ? (
              <div className="text-center py-8 text-white/60">No client data found</div>
            ) : (
              <div className="grid gap-4">
                {clientData.map((client) => {
                const percentage = (client.emails / client.target) * 100;
                const isCurrentlyExceeding = client.isAboveTarget;
                const isClose = client.targetPercentage >= 80 && client.targetPercentage < 100;
                const isFarBehind = client.targetPercentage < 50;
                
                return (
                  <div 
                    key={client.name} 
                    className={`p-6 rounded-xl border-2 transition-all duration-300 hover:scale-[1.02] ${
                      isCurrentlyExceeding 
                        ? 'bg-gradient-to-r from-green-500/20 to-green-600/30 border-green-400/50 shadow-green-500/20' 
                        : isClose 
                        ? 'bg-gradient-to-r from-yellow-500/20 to-yellow-600/30 border-yellow-400/50 shadow-yellow-500/20'
                        : isFarBehind
                        ? 'bg-gradient-to-r from-red-500/20 to-red-600/30 border-red-400/50 shadow-red-500/20'
                        : 'bg-gradient-to-r from-orange-500/20 to-orange-600/30 border-orange-400/50 shadow-orange-500/20'
                    } shadow-xl`}
                  >
                    {/* Header Section */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className={`w-14 h-14 rounded-full flex items-center justify-center font-bold text-xl ${
                          isCurrentlyExceeding 
                            ? 'bg-green-400 text-green-900' 
                            : isClose
                            ? 'bg-yellow-400 text-yellow-900'
                            : isFarBehind
                            ? 'bg-red-400 text-red-900'
                            : 'bg-orange-400 text-orange-900'
                        }`}>
                          {isCurrentlyExceeding ? '✓' : `${client.targetPercentage.toFixed(0)}%`}
                        </div>
                        <div>
                          <h3 className={`text-2xl font-bold ${
                            isCurrentlyExceeding ? 'text-green-100' : isClose ? 'text-yellow-100' : isFarBehind ? 'text-red-100' : 'text-orange-100'
                          }`}>
                            {client.name}
                          </h3>
                          <p className={`text-sm ${
                            isCurrentlyExceeding ? 'text-green-200' : isClose ? 'text-yellow-200' : isFarBehind ? 'text-red-200' : 'text-orange-200'
                          }`}>
                            {isCurrentlyExceeding ? 'Target Exceeded!' : isClose ? 'Close to Target' : isFarBehind ? 'Far Behind Target' : 'Below Target'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-4xl font-bold ${
                          isCurrentlyExceeding ? 'text-green-100' : isClose ? 'text-yellow-100' : isFarBehind ? 'text-red-100' : 'text-orange-100'
                        }`}>
                          {client.emails.toLocaleString()}
                        </div>
                        <p className={`text-sm ${
                          isCurrentlyExceeding ? 'text-green-200' : isClose ? 'text-yellow-200' : isFarBehind ? 'text-red-200' : 'text-orange-200'
                        }`}>
                          Target: {client.target.toLocaleString()}
                        </p>
                        <p className={`text-xs font-semibold mt-1 ${
                          client.variance >= 0 ? 'text-green-300' : 'text-red-300'
                        }`}>
                          {client.variance >= 0 ? '+' : ''}{client.variance.toLocaleString()} variance
                        </p>
                      </div>
                    </div>
                    
                    {/* Main Progress Bar - MTD vs Target */}
                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between text-sm font-semibold text-white mb-2">
                        <span>Month-to-Date Progress</span>
                        <span className={isCurrentlyExceeding ? 'text-green-300' : ''}>{client.targetPercentage.toFixed(1)}%</span>
                      </div>
                      <div className="relative h-6 rounded-full overflow-hidden bg-white/10">
                        <div 
                          className={`h-6 rounded-full transition-all duration-1000 flex items-center justify-end pr-2 ${
                            isCurrentlyExceeding 
                              ? 'bg-gradient-to-r from-green-400 to-green-500' 
                              : isClose
                              ? 'bg-gradient-to-r from-yellow-400 to-yellow-500'
                              : isFarBehind
                              ? 'bg-gradient-to-r from-red-400 to-red-500'
                              : 'bg-gradient-to-r from-orange-400 to-orange-500'
                          }`}
                          style={{ width: `${Math.min(percentage, 100)}%` }}
                        >
                          {percentage > 15 && (
                            <span className="text-xs font-bold text-white drop-shadow-lg">
                              {client.emails.toLocaleString()}
                            </span>
                          )}
                        </div>
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-white/70 pointer-events-none">
                          {percentage <= 15 && client.emails.toLocaleString()}
                        </div>
                      </div>
                    </div>
                    
                    {/* Projection Info - Less Visible */}
                    <div className="pt-3 border-t border-white/10 opacity-60 hover:opacity-100 transition-opacity duration-300">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-4">
                          <div>
                            <p className="text-white/50 mb-0.5">Projected EOM</p>
                            <p className="text-white/80 font-semibold text-sm">
                              {client.projection.toLocaleString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-white/50 mb-0.5">Projected %</p>
                            <p className={`font-semibold text-sm ${
                              client.isProjectedAboveTarget ? 'text-green-300' : 'text-white/80'
                            }`}>
                              {client.projectedPercentage.toFixed(1)}%
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-white/50 mb-0.5">Projected Variance</p>
                          <p className={`font-semibold text-sm ${
                            client.projectedVariance >= 0 ? 'text-green-300' : 'text-red-300'
                          }`}>
                            {client.projectedVariance >= 0 ? '+' : ''}{client.projectedVariance.toLocaleString()}
                          </p>
                        </div>
                      </div>
                      
                      {/* Small Projection Bar */}
                      <div className="relative h-2 rounded-full overflow-hidden bg-white/5 mt-2">
                        <div 
                          className={`h-2 rounded-full transition-all duration-1000 ${
                            client.isProjectedAboveTarget 
                              ? 'bg-green-400/50' 
                              : 'bg-white/30'
                          }`}
                          style={{ width: `${Math.min(client.projectedPercentage, 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                );
              })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      </div>
    </TooltipProvider>
  );
};

export default SendingVolumeDashboard;