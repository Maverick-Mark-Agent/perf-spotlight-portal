import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from "recharts";

interface ComparisonMetric {
  title: string;
  current: number;
  previous: number;
  unit?: string;
  positiveRepliesLast7Days?: number;
  positiveRepliesLast14Days?: number;
  positiveRepliesCurrentMonth?: number;
  positiveRepliesMTD?: number;
}

interface ComparisonMetricsProps {
  metrics: ComparisonMetric[];
}

export const ComparisonMetrics = ({ metrics }: ComparisonMetricsProps) => {
  // Extract data from the first metric object which should contain all the client data
  const clientData = metrics[0] || {
    positiveRepliesLast7Days: 0,
    positiveRepliesLast14Days: 0,
    positiveRepliesCurrentMonth: 0,
    positiveRepliesMTD: 0
  };
  
  // Prepare chart data with the two requested metrics
  const chartData = [
    {
      name: "MTD",
      value: clientData.positiveRepliesMTD || clientData.positiveRepliesCurrentMonth || 0,
      fullName: "Positive Replies Month To Date"
    },
    {
      name: "Last 7 Days",
      value: clientData.positiveRepliesLast7Days || 0,
      fullName: "Positive Replies Last 7 Days"
    }
  ];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-dashboard-card border border-border p-3 rounded-lg shadow-lg">
          <p className="text-dashboard-primary font-medium text-sm mb-1">{data.fullName}</p>
          <p className="text-dashboard-primary text-lg font-bold">
            {data.value}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="bg-dashboard-card border-border">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold text-dashboard-primary">
          Performance Comparison
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis 
                dataKey="name" 
                className="text-dashboard-secondary text-xs"
                tick={{ fontSize: 12 }}
              />
              <YAxis 
                className="text-dashboard-secondary text-xs"
                tick={{ fontSize: 12 }}
                label={{ value: 'Replies Count', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={0} stroke="#666" strokeWidth={2} />
              <Bar 
                dataKey="value" 
                radius={[4, 4, 0, 0]}
              >
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.value >= 0 ? "hsl(var(--dashboard-success))" : "hsl(var(--dashboard-danger))"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};