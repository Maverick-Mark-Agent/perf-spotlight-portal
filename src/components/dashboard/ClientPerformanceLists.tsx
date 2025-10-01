import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, Target, TrendingUp, TrendingDown, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface ClientData {
  id: string;
  name: string;
  leadsGenerated: number;
  projectedReplies: number;
  leadsTarget: number;
  repliesTarget: number;
  monthlyKPI: number;
  currentProgress: number;
  repliesProgress: number;
  positiveRepliesLast30Days: number;
  positiveRepliesLast7Days: number;
  positiveRepliesLast14Days: number;
  positiveRepliesCurrentMonth: number;
  positiveRepliesLastMonth: number;
  lastWeekVsWeekBeforeProgress: number;
  positiveRepliesLastVsThisMonth: number;
}

interface ClientPerformanceListsProps {
  clients: ClientData[];
}

export const ClientPerformanceLists = ({ clients }: ClientPerformanceListsProps) => {
  const [expandedList, setExpandedList] = useState<'above' | 'below' | null>(null);

  const clientsAboveTarget = clients.filter(client => 
    client.projectedReplies >= client.monthlyKPI && client.monthlyKPI > 0
  );
  
  const clientsBelowTarget = clients.filter(client => 
    client.projectedReplies < client.monthlyKPI && client.monthlyKPI > 0
  );

  const handleListToggle = (listType: 'above' | 'below') => {
    setExpandedList(expandedList === listType ? null : listType);
  };

  const ClientCard = ({ client }: { client: ClientData }) => {
    const progressPercentage = client.monthlyKPI > 0 
      ? (client.projectedReplies / client.monthlyKPI) * 100 
      : 0;
    
    return (
      <Card className="bg-card border-2 border-border hover:shadow-lg transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-foreground">
              {client.name}
            </CardTitle>
            <Badge variant={progressPercentage >= 100 ? "default" : "destructive"}>
              {progressPercentage.toFixed(1)}%
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="text-sm font-medium text-foreground/60">Projected Replies</div>
              <div className="text-xl font-bold text-foreground">
                {client.projectedReplies}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-sm font-medium text-foreground/60">Monthly KPI</div>
              <div className="text-xl font-bold text-foreground">
                {client.monthlyKPI}
              </div>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-foreground/60 font-medium">Progress to Target</span>
              <span className={cn(
                "font-semibold",
                progressPercentage >= 100 ? "text-success" : "text-destructive"
              )}>
                {client.projectedReplies} / {client.monthlyKPI}
              </span>
            </div>
            <div className="w-full bg-muted/80 rounded-full h-2.5 border border-border">
              <div 
                className={cn(
                  "h-full rounded-full transition-all duration-300",
                  progressPercentage >= 100 ? "bg-success" : "bg-destructive"
                )}
                style={{ width: `${Math.min(progressPercentage, 100)}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-2 border-t-2 border-border">
            <div className="text-center">
              <div className="text-xs font-medium text-foreground/60">Current Month</div>
              <div className="text-sm font-semibold text-foreground">
                {client.positiveRepliesCurrentMonth}
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs font-medium text-foreground/60">Last 7 Days</div>
              <div className="text-sm font-semibold text-foreground">
                {client.positiveRepliesLast7Days}
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs font-medium text-foreground/60">Last 30 Days</div>
              <div className="text-sm font-semibold text-foreground">
                {client.positiveRepliesLast30Days}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-foreground mb-2">
          Client Performance Overview
        </h2>
        <p className="text-foreground/60 font-medium">
          Clients categorized by their projected positive replies vs Monthly KPI targets
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Clients Above Target */}
        <Card className="bg-card border-2 border-success/30 shadow-lg">
          <CardHeader 
            className="cursor-pointer hover:bg-success/5 transition-colors"
            onClick={() => handleListToggle('above')}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-success/20 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-success" />
                </div>
                <div>
                  <CardTitle className="text-lg font-bold text-success">
                    Above Target
                  </CardTitle>
                  <p className="text-sm font-medium text-foreground/60">
                    {clientsAboveTarget.length} client{clientsAboveTarget.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-success border-success font-semibold">
                  {clientsAboveTarget.length}
                </Badge>
                {expandedList === 'above' ? (
                  <ChevronDown className="h-4 w-4 text-foreground/60" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-foreground/60" />
                )}
              </div>
            </div>
          </CardHeader>
          
          {expandedList === 'above' && (
            <CardContent className="pt-0">
              <div className="space-y-4">
                {clientsAboveTarget.length > 0 ? (
                  clientsAboveTarget.map((client) => (
                    <ClientCard key={client.id} client={client} />
                  ))
                ) : (
                  <div className="text-center py-8 text-foreground/60">
                    <Target className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p className="font-medium">No clients above target</p>
                  </div>
                )}
              </div>
            </CardContent>
          )}
        </Card>

        {/* Clients Below Target */}
        <Card className="bg-card border-2 border-destructive/30 shadow-lg">
          <CardHeader 
            className="cursor-pointer hover:bg-destructive/5 transition-colors"
            onClick={() => handleListToggle('below')}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-destructive/20 rounded-lg">
                  <TrendingDown className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <CardTitle className="text-lg font-bold text-destructive">
                    Below Target
                  </CardTitle>
                  <p className="text-sm font-medium text-foreground/60">
                    {clientsBelowTarget.length} client{clientsBelowTarget.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-destructive border-destructive font-semibold">
                  {clientsBelowTarget.length}
                </Badge>
                {expandedList === 'below' ? (
                  <ChevronDown className="h-4 w-4 text-foreground/60" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-foreground/60" />
                )}
              </div>
            </div>
          </CardHeader>
          
          {expandedList === 'below' && (
            <CardContent className="pt-0">
              <div className="space-y-4">
                {clientsBelowTarget.length > 0 ? (
                  clientsBelowTarget.map((client) => (
                    <ClientCard key={client.id} client={client} />
                  ))
                ) : (
                  <div className="text-center py-8 text-foreground/60">
                    <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p className="font-medium">No clients below target</p>
                  </div>
                )}
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
};