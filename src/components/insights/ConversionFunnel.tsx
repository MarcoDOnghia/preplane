import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface FunnelStage {
  label: string;
  count: number;
  percentage: number;
}

interface ConversionFunnelProps {
  stages: FunnelStage[];
}

const getColor = (pct: number, benchmark: number) => {
  if (pct >= benchmark * 1.2) return "bg-success/20 text-success border-success/30";
  if (pct >= benchmark * 0.8) return "bg-warm/20 text-warm border-warm/30";
  return "bg-destructive/10 text-destructive border-destructive/30";
};

const BENCHMARKS: Record<string, number> = {
  Responses: 22,
  Interviews: 10,
  Offers: 3,
};

const ConversionFunnel = ({ stages }: ConversionFunnelProps) => {
  const maxCount = stages[0]?.count || 1;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Conversion Funnel</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {stages.map((stage, i) => {
          const widthPct = Math.max(10, (stage.count / maxCount) * 100);
          const benchmark = BENCHMARKS[stage.label];
          const colorClass = benchmark
            ? getColor(stage.percentage, benchmark)
            : "bg-primary/10 text-primary border-primary/30";

          return (
            <div key={stage.label} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="font-medium">{stage.label}</span>
                <span className="text-muted-foreground">
                  {stage.count} {i > 0 && `(${stage.percentage}%)`}
                </span>
              </div>
              <div className="h-8 bg-muted rounded-md overflow-hidden">
                <div
                  className={`h-full rounded-md flex items-center px-3 text-xs font-medium transition-all ${colorClass}`}
                  style={{ width: `${widthPct}%` }}
                >
                  {benchmark && (
                    <span className="truncate">
                      {stage.percentage >= benchmark ? "Above" : "Below"} avg ({benchmark}%)
                    </span>
                  )}
                </div>
              </div>
              {i < stages.length - 1 && (
                <div className="flex justify-center text-muted-foreground text-xs">↓</div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default ConversionFunnel;
