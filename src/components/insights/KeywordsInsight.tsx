import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface KeywordsInsightProps {
  successKeywords: { keyword: string; count: number }[];
  failKeywords: { keyword: string; count: number }[];
}

const KeywordsInsight = ({ successKeywords, failKeywords }: KeywordsInsightProps) => {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Keywords That Work</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {successKeywords.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm font-medium text-success">✅ Keywords in jobs that led to interviews</p>
            <div className="flex gap-1.5 flex-wrap">
              {successKeywords.slice(0, 12).map((k) => (
                <Badge key={k.keyword} className="bg-success/10 text-success border-success/30 text-xs">
                  {k.keyword} ({k.count})
                </Badge>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Get more interviews to see which keywords correlate with success.
          </p>
        )}

        {failKeywords.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">⚠️ Keywords with low response rates</p>
            <div className="flex gap-1.5 flex-wrap">
              {failKeywords.slice(0, 8).map((k) => (
                <Badge key={k.keyword} variant="outline" className="text-xs text-muted-foreground">
                  {k.keyword} ({k.count})
                </Badge>
              ))}
            </div>
          </div>
        )}

        {successKeywords.length > 0 && (
          <p className="text-sm text-primary font-medium">
            💡 Emphasize "{successKeywords[0]?.keyword}" and "{successKeywords[1]?.keyword || successKeywords[0]?.keyword}" in future applications.
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default KeywordsInsight;
