import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowLeft, TrendingUp, BarChart3, Send, Target, RefreshCw, Users, AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useDashboardContext } from "@/contexts/DashboardContext";

const VolumeDashboard = () => {
  const [isWebhookLoading, setIsWebhookLoading] = useState(false);
  const [isRefreshingClients, setIsRefreshingClients] = useState(false);

  const { volumeDashboard, refreshVolumeDashboard } = useDashboardContext();
  const { clients: clientData, loading: isLoadingClients, lastUpdated, isUsingCache } = volumeDashboard;

  const fetchClientData = async (isRefresh = false) => {
    if (isRefresh) {
      setIsRefreshingClients(true);
    }
    try {
      await refreshVolumeDashboard(isRefresh);
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
      if (isRefresh) {
        setIsRefreshingClients(false);
      }
    }
  };

  const handleWebhookTrigger = async () => {
    setIsWebhookLoading(true);
    try {
      console.log("Sending volume report to Slack...");
      const { data, error } = await supabase.functions.invoke('send-volume-slack-dm');

      if (error) throw error;

      console.log("Slack response:", data);
      toast({
        title: "Success",
        description: "Volume report sent to Slack successfully",
      });
    } catch (error) {
      console.error("Error sending to Slack:", error);
      toast({
        title: "Error",
        description: "Failed to send volume report to Slack. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsWebhookLoading(false);
    }
  };


  const getPerformanceColor = (client: ClientData): "green" | "yellow" | "red" => {
    if (client.isAboveTarget) return "green";
    if (client.targetPercentage >= 80) return "yellow";
    return "red";
  };

  const totalEmails = clientData.reduce((sum, client) => sum + client.emails, 0);
  const totalTargets = clientData.reduce((sum, client) => sum + client.target, 0);
  const overallTargetPercentage = totalTargets > 0 ? (totalEmails / totalTargets) * 100 : 0;

  const formatLastUpdated = () => {
    if (!lastUpdated) return '';
    const now = new Date();
    const diffMs = now.getTime() - lastUpdated.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    return lastUpdated.toLocaleString();
  };

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
                  <p className="text-muted-foreground text-sm">
                    Monitor daily email sending performance
                    {lastUpdated && (
                      <span className="ml-2">
                        • Updated {formatLastUpdated()}
                        {isUsingCache && <span className="text-yellow-600 ml-1">(cached)</span>}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={() => fetchClientData(true)}
                    disabled={isRefreshingClients}
                    variant="outline"
                    size="lg"
                    className="px-6 py-3 text-base shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl"
                  >
                    <RefreshCw className={`h-5 w-5 mr-2 ${isRefreshingClients ? 'animate-spin' : ''}`} />
                    {isRefreshingClients ? "Refreshing..." : "Refresh Data"}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Manually refresh volume data (auto-refreshes hourly)</p>
                </TooltipContent>
              </Tooltip>
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
      </div>

      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Performance Highlights */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 mb-12">
          {/* Critical Clients - NEW */}
          <Card className="bg-dashboard-danger/15 backdrop-blur-sm border-dashboard-danger/50 shadow-2xl">
            <CardHeader>
              <CardTitle className="text-dashboard-danger flex items-center gap-2 text-xl font-bold">
                <AlertCircle className="h-6 w-6" />
                Critical Clients
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {clientData
                .filter(client => client.emails > 0 && client.projectedPercentage < 80)
                .slice(0, 3)
                .map((client) => (
                <div key={client.name} className="flex items-center justify-between p-4 bg-white/10 rounded-lg border border-dashboard-danger/40">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-dashboard-danger text-white flex items-center justify-center font-bold text-sm">
                      !
                    </div>
                    <div>
                      <span className="text-foreground font-semibold block">{client.name}</span>
                      <span className="text-muted-foreground text-sm">Projected: {client.projectedPercentage.toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-dashboard-danger font-bold text-lg">{client.projection.toLocaleString()}</span>
                    <div className="text-muted-foreground text-xs">Target: {client.target.toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

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
                    {clientData.length > 0 ? (clientData.reduce((sum, c) => sum + c.targetPercentage, 0) / clientData.length).toFixed(1) : '0.0'}%
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

        {/* Main Performance Display */}
        <Card className="bg-white/5 backdrop-blur-sm border-white/10 shadow-2xl">
          <CardHeader className="pb-6">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-white flex items-center gap-3 text-2xl">
                  <Users className="h-7 w-7 text-dashboard-primary" />
                  Sending Volume MTD
                </CardTitle>
                <p className="text-white/60 mt-2">All clients with actual vs target performance comparison</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingClients ? (
              <div className="text-center py-8 text-white/60">Loading client data...</div>
            ) : clientData.length === 0 ? (
              <div className="text-center py-8 text-white/60">No client data found</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {clientData.map((client) => {
                const percentage = (client.emails / client.target) * 100;

                // Color based on projection, not current status
                const isProjectedOnTrack = client.projectedPercentage >= 100;
                const isProjectedClose = client.projectedPercentage >= 80 && client.projectedPercentage < 100;
                const isProjectedBehind = client.projectedPercentage < 80;

                return (
                  <Card
                    key={client.name}
                    className={`border-2 transition-all duration-300 hover:scale-[1.02] ${
                      isProjectedOnTrack
                        ? 'bg-gradient-to-br from-green-500/20 to-green-600/30 border-green-400/50'
                        : isProjectedClose
                        ? 'bg-gradient-to-br from-yellow-500/20 to-yellow-600/30 border-yellow-400/50'
                        : 'bg-gradient-to-br from-red-500/20 to-red-600/30 border-red-400/50'
                    }`}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className={`text-lg font-bold ${
                            isProjectedOnTrack ? 'text-green-100' : isProjectedClose ? 'text-yellow-100' : 'text-red-100'
                          }`}>
                            {client.name}
                          </CardTitle>
                          <p className={`text-xs mt-1 ${
                            isProjectedOnTrack ? 'text-green-200' : isProjectedClose ? 'text-yellow-200' : 'text-red-200'
                          }`}>
                            {isProjectedOnTrack ? '✓ On Pace' : isProjectedClose ? 'Near Target' : 'Behind Pace'}
                          </p>
                        </div>
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                          isProjectedOnTrack
                            ? 'bg-green-400 text-green-900'
                            : isProjectedClose
                            ? 'bg-yellow-400 text-yellow-900'
                            : 'bg-red-400 text-red-900'
                        }`}>
                          {isProjectedOnTrack ? '✓' : `${Math.round(client.projectedPercentage)}%`}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {/* Main Stats */}
                      <div>
                        <div className="flex justify-between items-baseline mb-1">
                          <span className={`text-2xl font-bold ${
                            isProjectedOnTrack ? 'text-green-100' : isProjectedClose ? 'text-yellow-100' : 'text-red-100'
                          }`}>
                            {client.emails.toLocaleString()}
                          </span>
                          <span className="text-xs text-white/60">/ {client.target.toLocaleString()}</span>
                        </div>

                        {/* Progress Bar */}
                        <div className="relative h-2 rounded-full overflow-hidden bg-white/10">
                          <div
                            className={`h-2 rounded-full transition-all duration-1000 ${
                              isProjectedOnTrack
                                ? 'bg-gradient-to-r from-green-400 to-green-500'
                                : isProjectedClose
                                ? 'bg-gradient-to-r from-yellow-400 to-yellow-500'
                                : 'bg-gradient-to-r from-red-400 to-red-500'
                            }`}
                            style={{ width: `${Math.min(percentage, 100)}%` }}
                          ></div>
                        </div>

                        <div className="flex justify-between text-xs text-white/60 mt-1">
                          <span>{client.targetPercentage.toFixed(1)}% of target</span>
                          <span className={client.emails >= client.expectedByNow ? 'text-green-300' : 'text-red-300'}>
                            {client.emails >= client.expectedByNow ? '✓' : '⚠'} {client.expectedByNow.toLocaleString()} exp
                          </span>
                        </div>
                      </div>

                      {/* Daily Pace */}
                      <div className="flex items-center justify-between p-2 rounded bg-white/5">
                        <div>
                          <p className="text-xs text-white/50">Today</p>
                          <p className="text-sm font-semibold text-white/80">{client.emailsToday.toLocaleString()}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-white/50">Need/day</p>
                          <p className="text-sm font-semibold text-white/80">{client.dailyQuota.toLocaleString()}</p>
                        </div>
                      </div>

                      {/* Projection */}
                      <div className="pt-2 border-t border-white/10">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-white/50">Projected EOM</span>
                          <span className={`font-semibold ${
                            client.isProjectedAboveTarget ? 'text-green-300' : 'text-white/80'
                          }`}>
                            {client.projection.toLocaleString()} ({client.projectedPercentage.toFixed(0)}%)
                          </span>
                        </div>
                        <div className="relative h-1.5 rounded-full overflow-hidden bg-white/5">
                          <div
                            className={`h-1.5 rounded-full transition-all duration-1000 ${
                              client.isProjectedAboveTarget ? 'bg-green-400/50' : 'bg-red-400/50'
                            }`}
                            style={{ width: `${Math.min(client.projectedPercentage, 100)}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* Rolling Windows */}
                      <div className="grid grid-cols-3 gap-1.5">
                        <div className="p-1.5 bg-white/5 rounded text-center">
                          <p className="text-[10px] text-white/50">7d</p>
                          <p className="text-xs font-semibold text-white/80">{client.emailsLast7Days.toLocaleString()}</p>
                        </div>
                        <div className="p-1.5 bg-white/5 rounded text-center">
                          <p className="text-[10px] text-white/50">14d</p>
                          <p className="text-xs font-semibold text-white/80">{client.emailsLast14Days.toLocaleString()}</p>
                        </div>
                        <div className="p-1.5 bg-white/5 rounded text-center">
                          <p className="text-[10px] text-white/50">30d</p>
                          <p className="text-xs font-semibold text-white/80">{client.emailsLast30Days.toLocaleString()}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
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

export default VolumeDashboard;