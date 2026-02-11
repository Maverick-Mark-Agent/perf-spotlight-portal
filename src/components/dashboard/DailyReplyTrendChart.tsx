import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp } from "lucide-react";
import type { DailyReplyTrend } from "@/hooks/useReplyMetrics";

interface DailyReplyTrendChartProps {
  data: DailyReplyTrend[];
  selectedClient: string;
  onClientChange: (client: string) => void;
  availableClients: string[];
  loading?: boolean;
}

export const DailyReplyTrendChart = ({
  data,
  selectedClient,
  onClientChange,
  availableClients,
  loading = false,
}: DailyReplyTrendChartProps) => {
  // Format date for display (MM/DD)
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  // Custom tooltip to show interested rate %
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-card/95 backdrop-blur-sm border border-border rounded-lg p-3 shadow-lg">
          <p className="text-sm font-semibold text-foreground mb-2">{formatDate(label)}</p>
          <div className="space-y-1">
            <p className="text-sm text-primary">
              Total Replies: <span className="font-bold">{data.totalReplies}</span>
            </p>
            <p className="text-sm text-success">
              Interested Leads: <span className="font-bold">{data.interestedLeads}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              Interested Rate: <span className="font-bold">{data.interestedRate.toFixed(1)}%</span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-primary/20 shadow-xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold text-foreground">
                Daily Reply Trend (Last 30 Days)
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Track total replies and interested leads over time
              </p>
            </div>
          </div>
          
          {/* Client filter dropdown */}
          <Select value={selectedClient} onValueChange={onClientChange}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select client" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Clients</SelectItem>
              {availableClients.map(client => (
                <SelectItem key={client} value={client}>
                  {client}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-[300px] flex items-center justify-center">
            <div className="text-muted-foreground">Loading chart data...</div>
          </div>
        ) : data.length === 0 ? (
          <div className="h-[300px] flex items-center justify-center">
            <div className="text-muted-foreground">No data available for this period</div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                stroke="hsl(var(--muted-foreground))"
                style={{ fontSize: '12px' }}
              />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                style={{ fontSize: '12px' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ paddingTop: '20px' }}
                iconType="line"
              />
              <Line
                type="monotone"
                dataKey="totalReplies"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--primary))', r: 4 }}
                activeDot={{ r: 6 }}
                name="Total Replies"
              />
              <Line
                type="monotone"
                dataKey="interestedLeads"
                stroke="hsl(var(--success))"
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--success))', r: 4 }}
                activeDot={{ r: 6 }}
                name="Interested Leads"
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
};
