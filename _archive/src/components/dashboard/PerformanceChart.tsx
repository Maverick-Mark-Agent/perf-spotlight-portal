import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface PerformanceChartProps {
  selectedPeriod: string;
  onPeriodChange: (period: string) => void;
}

const chartData = {
  "30-days": [
    { date: "Day 1", replies: 12 },
    { date: "Day 5", replies: 18 },
    { date: "Day 10", replies: 24 },
    { date: "Day 15", replies: 31 },
    { date: "Day 20", replies: 28 },
    { date: "Day 25", replies: 35 },
    { date: "Day 30", replies: 42 },
  ],
  "7-days": [
    { date: "Mon", replies: 8 },
    { date: "Tue", replies: 12 },
    { date: "Wed", replies: 15 },
    { date: "Thu", replies: 11 },
    { date: "Fri", replies: 18 },
    { date: "Sat", replies: 9 },
    { date: "Sun", replies: 14 },
  ],
  "14-days": [
    { date: "Week 1", replies: 65 },
    { date: "Week 2", replies: 87 },
  ],
  "current-month": [
    { date: "Week 1", replies: 45 },
    { date: "Week 2", replies: 62 },
    { date: "Week 3", replies: 78 },
    { date: "Week 4", replies: 85 },
  ],
  "last-month": [
    { date: "Week 1", replies: 38 },
    { date: "Week 2", replies: 55 },
    { date: "Week 3", replies: 71 },
    { date: "Week 4", replies: 82 },
  ],
};

const periods = [
  { value: "30-days", label: "Positive Replies Last 30 Days" },
  { value: "7-days", label: "Positive Replies Last 7 Days" },
  { value: "14-days", label: "Positive Replies Last 14 Days" },
  { value: "current-month", label: "Positive Replies Current Month" },
  { value: "last-month", label: "Positive Replies Last Month" },
];

export const PerformanceChart = ({ selectedPeriod, onPeriodChange }: PerformanceChartProps) => {
  const data = chartData[selectedPeriod as keyof typeof chartData] || chartData["30-days"];

  return (
    <Card className="bg-dashboard-card border-border">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-dashboard-primary">
            Performance Analytics
          </CardTitle>
          <Select value={selectedPeriod} onValueChange={onPeriodChange}>
            <SelectTrigger className="w-64 bg-dashboard-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-dashboard-card border-border">
              {periods.map((period) => (
                <SelectItem key={period.value} value={period.value}>
                  {period.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="date" 
                stroke="hsl(var(--dashboard-secondary))"
                fontSize={12}
              />
              <YAxis 
                stroke="hsl(var(--dashboard-secondary))"
                fontSize={12}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: "hsl(var(--dashboard-card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "6px",
                }}
              />
              <Line
                type="monotone"
                dataKey="replies"
                stroke="hsl(var(--dashboard-accent))"
                strokeWidth={3}
                dot={{ fill: "hsl(var(--dashboard-accent))", strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};