import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface AtsRange {
  range: string;
  total: number;
  responded: number;
  rate: number;
}

interface AtsImpactChartProps {
  data: AtsRange[];
}

const RANGE_COLORS = ["hsl(var(--destructive))", "hsl(var(--warm))", "hsl(var(--success))"];

const AtsImpactChart = ({ data }: AtsImpactChartProps) => {
  const highRange = data.find((d) => d.range === "80-100");
  const lowRange = data.find((d) => d.range === "0-59");
  const multiplier =
    highRange && lowRange && lowRange.rate > 0
      ? (highRange.rate / lowRange.rate).toFixed(1)
      : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">ATS Score Impact</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ left: 0, right: 10 }}>
              <XAxis dataKey="range" fontSize={11} />
              <YAxis tickFormatter={(v) => `${v}%`} fontSize={11} />
              <Tooltip
                formatter={(v: number, name: string) => [
                  name === "rate" ? `${v}%` : v,
                  name === "rate" ? "Response Rate" : "Total",
                ]}
                contentStyle={{ borderRadius: 8, fontSize: 12 }}
              />
              <Bar dataKey="rate" radius={[4, 4, 0, 0]}>
                {data.map((_, i) => (
                  <Cell key={i} fill={RANGE_COLORS[i] || RANGE_COLORS[2]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        {multiplier && Number(multiplier) > 1 && (
          <p className="text-sm text-success font-medium">
            📊 Apps with ATS &gt;80 have {highRange!.rate}% response rate vs {lowRange!.rate}% for &lt;60.
            Improving ATS could increase results by {multiplier}x.
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default AtsImpactChart;
