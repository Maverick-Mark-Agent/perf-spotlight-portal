import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

interface ProgressPieChartProps {
  percentage: number;
  title: string;
}

export const ProgressPieChart = ({ percentage, title }: ProgressPieChartProps) => {
  const displayPercentage = Math.min(percentage, 100);
  const remaining = Math.max(100 - displayPercentage, 0);

  const data = [
    { name: "Achieved", value: displayPercentage, color: "hsl(var(--dashboard-success))" },
    { name: "Remaining", value: remaining, color: "hsl(var(--border))" },
  ];

  return (
    <Card className="bg-dashboard-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-dashboard-secondary">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative h-32">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={25}
                outerRadius={50}
                startAngle={90}
                endAngle={-270}
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-xl font-bold text-dashboard-primary">
                {displayPercentage.toFixed(1)}%
              </div>
              <div className="text-xs text-dashboard-secondary">Complete</div>
            </div>
          </div>
        </div>
        <div className="mt-2 text-center">
          <div className="text-sm text-dashboard-secondary">
            {displayPercentage.toFixed(1)}%
          </div>
        </div>
      </CardContent>
    </Card>
  );
};