import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";

interface TimeAnalysisProps {
  avgResponseDays: number;
  dayOfWeekStats: { day: string; count: number; responses: number; rate: number }[];
  staleCount: number;
}

const TimeAnalysis = ({ avgResponseDays, dayOfWeekStats, staleCount }: TimeAnalysisProps) => {
  const bestDay = dayOfWeekStats.reduce(
    (best, d) => (d.rate > best.rate && d.count >= 2 ? d : best),
    { day: "", rate: 0, count: 0, responses: 0 }
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Time Analysis</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border p-3 text-center">
            <Clock className="h-5 w-5 mx-auto text-primary mb-1" />
            <p className="text-2xl font-bold">{avgResponseDays > 0 ? `${avgResponseDays}d` : "—"}</p>
            <p className="text-xs text-muted-foreground">Avg response time</p>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <p className="text-2xl font-bold">{staleCount}</p>
            <p className="text-xs text-muted-foreground">No response &gt;14 days</p>
          </div>
        </div>

        {dayOfWeekStats.some((d) => d.count > 0) && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Application day performance</p>
            <div className="flex gap-1 flex-wrap">
              {dayOfWeekStats.map((d) => (
                <Badge
                  key={d.day}
                  variant="outline"
                  className={`text-xs ${d.day === bestDay.day && bestDay.rate > 0 ? "border-success text-success" : ""}`}
                >
                  {d.day.slice(0, 3)}: {d.rate}% ({d.count})
                </Badge>
              ))}
            </div>
            {bestDay.day && bestDay.rate > 0 && (
              <p className="text-sm text-success font-medium">
                📅 Best day to apply: {bestDay.day} ({bestDay.rate}% response rate)
              </p>
            )}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          💡 Most companies respond within 7-14 days. Follow up if no response after 2 weeks.
        </p>

        {staleCount > 0 && (
          <p className="text-sm text-warm font-medium">
            ⏰ You have {staleCount} applications sent 2+ weeks ago with no response. Consider following up.
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default TimeAnalysis;
