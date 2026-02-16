import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface MethodData {
  method: string;
  total: number;
  responses: number;
  rate: number;
}

interface MethodChartProps {
  data: MethodData[];
  bestMethod: string | null;
}

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--success))",
  "hsl(var(--warm))",
  "hsl(var(--destructive))",
  "hsl(var(--muted-foreground))",
];

const MethodChart = ({ data, bestMethod }: MethodChartProps) => {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Success by Method</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Set application methods on your applications to see which channels work best.
          </p>
        </CardContent>
      </Card>
    );
  }

  const bestRate = data.find((d) => d.method === bestMethod);
  const avgRate = data.reduce((s, d) => s + d.rate, 0) / data.length;
  const multiplier = bestRate && avgRate > 0 ? (bestRate.rate / avgRate).toFixed(1) : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Success by Method</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ left: 0, right: 10 }}>
              <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} fontSize={11} />
              <YAxis type="category" dataKey="method" width={80} fontSize={11} />
              <Tooltip
                formatter={(v: number) => [`${v}%`, "Response Rate"]}
                contentStyle={{ borderRadius: 8, fontSize: 12 }}
              />
              <Bar dataKey="rate" radius={[0, 4, 4, 0]}>
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        {bestMethod && multiplier && Number(multiplier) > 1 && (
          <p className="text-sm text-success font-medium">
            💡 Your {bestMethod} applications are {multiplier}x more likely to get responses!
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default MethodChart;
