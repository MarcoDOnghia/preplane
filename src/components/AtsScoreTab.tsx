import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, XCircle, AlertTriangle, Zap, Copy, Check } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import type { AtsAnalysis } from "@/lib/types";

interface AtsScoreTabProps {
  atsAnalysis: AtsAnalysis;
}

const AtsScoreTab = ({ atsAnalysis }: AtsScoreTabProps) => {
  const { score, keywordsFound, keywordsMissing, formattingIssues, quickWins } = atsAnalysis;
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const { toast } = useToast();

  const scoreColor =
    score >= 80 ? "text-success" : score >= 60 ? "text-yellow-500" : "text-destructive";
  const scoreBarColor =
    score >= 80 ? "[&>div]:bg-success" : score >= 60 ? "[&>div]:bg-yellow-500" : "[&>div]:bg-destructive";

  const handleCopyKeyword = async (kw: string, index: number) => {
    await navigator.clipboard.writeText(kw);
    setCopiedIndex(index);
    toast({ title: `"${kw}" copied`, description: "Paste it into your CV in the Edit tab." });
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Score Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center gap-4">
            <div className={`text-6xl font-bold ${scoreColor}`}>{score}</div>
            <p className="text-sm text-muted-foreground">ATS Compatibility Score</p>
            <Progress value={score} className={`h-3 w-full max-w-md ${scoreBarColor}`} />
            <p className="text-xs text-muted-foreground">
              {score >= 80
                ? "Great! Your CV is well-optimized for ATS."
                : score >= 60
                ? "Good, but there's room for improvement."
                : "Needs work — many ATS systems may filter this CV out."}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Keywords */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-success" />
              Keywords Found ({keywordsFound.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {keywordsFound.map((kw, i) => (
                <Badge key={i} className="bg-success/10 text-success border-success/20 hover:bg-success/20">
                  ✓ {kw}
                </Badge>
              ))}
              {keywordsFound.length === 0 && (
                <p className="text-sm text-muted-foreground">No matching keywords found</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <XCircle className="h-4 w-4 text-destructive" />
              Keywords Missing ({keywordsMissing.length})
            </CardTitle>
            {keywordsMissing.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Click a keyword to copy it, then add it to your CV in the Edit tab.
              </p>
            )}
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {keywordsMissing.map((kw, i) => (
                <Button
                  key={i}
                  variant="ghost"
                  size="sm"
                  className="h-auto px-2.5 py-1 gap-1.5 bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 text-xs font-normal rounded-full"
                  onClick={() => handleCopyKeyword(kw, i)}
                >
                  ✗ {kw}
                  {copiedIndex === i ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Copy className="h-3 w-3 opacity-50" />
                  )}
                </Button>
              ))}
              {keywordsMissing.length === 0 && (
                <p className="text-sm text-muted-foreground">All keywords covered!</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Formatting Issues */}
      {formattingIssues.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              Formatting Issues ({formattingIssues.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {formattingIssues.map((issue, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0 mt-0.5" />
                  {issue}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Quick Wins */}
      {quickWins.length > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              Quick Wins
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2">
              {quickWins.map((win, i) => (
                <li key={i} className="flex items-start gap-3 text-sm">
                  <span className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">
                    {i + 1}
                  </span>
                  {win}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AtsScoreTab;
