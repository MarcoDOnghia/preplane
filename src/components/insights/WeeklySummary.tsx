import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface WeeklySummaryProps {
  thisWeek: { applied: number; responses: number; interviews: number };
  thisMonth: { applied: number; responses: number; interviews: number };
  lastMonth: { applied: number; responses: number; interviews: number };
}

const Trend = ({ current, previous, label }: { current: number; previous: number; label: string }) => {
  if (previous === 0 && current === 0) return null;
  const diff = previous > 0 ? Math.round(((current - previous) / previous) * 100) : current > 0 ? 100 : 0;

  return (
    <div className="flex items-center gap-1 text-xs">
      {diff > 0 ? (
        <TrendingUp className="h-3 w-3 text-success" />
      ) : diff < 0 ? (
        <TrendingDown className="h-3 w-3 text-destructive" />
      ) : (
        <Minus className="h-3 w-3 text-muted-foreground" />
      )}
      <span className={diff > 0 ? "text-success" : diff < 0 ? "text-destructive" : "text-muted-foreground"}>
        {diff > 0 ? "+" : ""}
        {diff}% {label}
      </span>
    </div>
  );
};

const WeeklySummary = ({ thisWeek, thisMonth, lastMonth }: WeeklySummaryProps) => {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Activity Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm font-medium mb-2">This Week</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Applied", value: thisWeek.applied },
              { label: "Responses", value: thisWeek.responses },
              { label: "Interviews", value: thisWeek.interviews },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border p-2 text-center">
                <p className="text-xl font-bold">{s.value}</p>
                <p className="text-[10px] text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-medium mb-2">This Month</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Applied", value: thisMonth.applied },
              { label: "Responses", value: thisMonth.responses },
              { label: "Interviews", value: thisMonth.interviews },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border p-2 text-center">
                <p className="text-xl font-bold">{s.value}</p>
                <p className="text-[10px] text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">vs Last Month</p>
          <Trend current={thisMonth.applied} previous={lastMonth.applied} label="applications" />
          <Trend current={thisMonth.responses} previous={lastMonth.responses} label="responses" />
          <Trend current={thisMonth.interviews} previous={lastMonth.interviews} label="interviews" />
        </div>
      </CardContent>
    </Card>
  );
};

export default WeeklySummary;
