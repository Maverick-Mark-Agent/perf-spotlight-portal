import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

interface ProgressPieChartProps {
  percentage: number;
  title: string;
}

export const ProgressPieChart = ({ percentage, title }: ProgressPieChartProps) => {
  const achieved = Math.min(percentage, 100);
  const remaining = Math.max(100 - percentage, 0);

  const data = [
    { name: "Achieved", value: achieved },
    { name: "Remaining", value: remaining },
  ];

  const getColor = () => {
    if (achieved >= 80) return "hsl(142 76% 36%)"; // success
    if (achieved >= 50) return "hsl(38 92% 50%)"; // warning
    return "hsl(217 91% 60%)"; // primary
  };

  const COLORS = [getColor(), "hsl(214 32% 91%)"];

  return (
    <Card className="shadow-md hover:shadow-xl transition-all duration-300 rounded-2xl overflow-hidden border-l-4 border-l-primary bg-gradient-to-br from-white to-blue-50/30 group h-full">
      <CardHeader className="pb-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {title}
        </p>
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center pb-6">
        <div className="relative w-32 h-32">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={60}
                paddingAngle={2}
                dataKey="value"
                startAngle={90}
                endAngle={-270}
              >
                {data.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={COLORS[index]} 
                    strokeWidth={0}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <p className="text-3xl font-bold text-foreground">
                {Math.round(achieved)}%
              </p>
              <p className="text-xs text-muted-foreground">
                Complete
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};