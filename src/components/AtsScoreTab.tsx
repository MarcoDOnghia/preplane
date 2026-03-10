import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Zap,
  Loader2,
  Target,
  Wrench,
  Info,
} from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import type { AtsAnalysis } from "@/lib/types";

interface AtsScoreTabProps {
  atsAnalysis: AtsAnalysis;
  currentCv?: string;
  jobDescription?: string;
  onCvChange?: (html: string) => void;
}

const TARGET_SCORE = 90;

const AtsScoreTab = ({ atsAnalysis, currentCv, jobDescription, onCvChange }: AtsScoreTabProps) => {
  const { score, keywordsFound, keywordsMissing, formattingIssues, quickWins } = atsAnalysis;
  const [fixingFormat, setFixingFormat] = useState(false);
  const [animatedScore, setAnimatedScore] = useState(score);
  const { toast } = useToast();

  // Animate score changes smoothly
  useEffect(() => {
    if (animatedScore === score) return;
    const diff = score - animatedScore;
    const step = diff > 0 ? 1 : -1;
    const timer = setInterval(() => {
      setAnimatedScore((prev) => {
        const next = prev + step;
        if ((step > 0 && next >= score) || (step < 0 && next <= score)) {
          clearInterval(timer);
          return score;
        }
        return next;
      });
    }, 30);
    return () => clearInterval(timer);
  }, [score]);

  const totalKeywords = keywordsFound.length + keywordsMissing.length;

  const keywordsNeeded = useMemo(() => {
    if (totalKeywords === 0) return 0;
    const currentMatchRate = keywordsFound.length / totalKeywords;
    const targetMatchRate = TARGET_SCORE / 100;
    if (currentMatchRate >= targetMatchRate) return 0;
    return Math.ceil(targetMatchRate * totalKeywords) - keywordsFound.length;
  }, [keywordsFound.length, totalKeywords]);

  const scoreColor =
    animatedScore >= 80 ? "text-success" : animatedScore >= 60 ? "text-yellow-500" : "text-destructive";
  const scoreBarColor =
    animatedScore >= 80 ? "[&>div]:bg-success" : animatedScore >= 60 ? "[&>div]:bg-yellow-500" : "[&>div]:bg-destructive";

  // Auto-fix formatting issues
  const handleAutoFixFormatting = () => {
    if (!currentCv || !onCvChange) return;
    setFixingFormat(true);

    let fixed = currentCv;
    fixed = fixed.replace(/<a[^>]*>(.*?)<\/a>/gi, "$1");
    fixed = fixed.replace(/<img[^>]*>/gi, "");
    fixed = fixed.replace(/\s*style="[^"]*"/gi, "");
    fixed = fixed.replace(/[★☆►▶●○◆◇■□▪▫–—]/g, "");
    fixed = fixed.replace(/\u00A0/g, " ");
    fixed = fixed.replace(/\s{2,}/g, " ");
    fixed = fixed.replace(/<(p|li|div|span)>\s*<\/\1>/gi, "");

    onCvChange(fixed);

    const issuesFixed = formattingIssues.length;
    toast({
      title: `✓ Formatting fixed`,
      description: `${issuesFixed} issue${issuesFixed !== 1 ? "s" : ""} addressed • Expected +3-5% score boost`,
    });

    setTimeout(() => setFixingFormat(false), 500);
  };

  return (
    <div className="space-y-6">
      {/* Score + Target Tracker */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Target className="h-5 w-5 text-muted-foreground" />
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium">Job Match Score</p>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[280px]">
                      <p className="text-xs">ATS = software companies use to filter CVs automatically. Score below 60% means you may never reach a human recruiter.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
              <div className="text-right">
                <div className={`text-4xl font-bold tabular-nums transition-colors duration-300 ${scoreColor}`}>
                  {animatedScore}
                </div>
              </div>
            </div>

            {/* Score bar */}
            <div className="space-y-1">
              <Progress value={animatedScore} className={`h-2.5 transition-all duration-700 ${scoreBarColor}`} />
              {animatedScore < TARGET_SCORE && (
                <p className="text-xs text-muted-foreground">
                  {Math.max(0, keywordsNeeded)} keyword{keywordsNeeded !== 1 ? "s" : ""} away from {TARGET_SCORE}%
                </p>
              )}
              {animatedScore >= TARGET_SCORE && (
                <p className="text-xs text-success font-medium">Your CV is optimized for this role!</p>
              )}
            </div>

            {/* Coach tip */}
            <p className="text-xs text-muted-foreground/80 italic leading-relaxed pt-1">
              A 70+ score is strong. But a tailored proof of work will do more for your application than a perfect score ever will.
            </p>

            {/* Summary badges */}
            <div className="flex gap-3 pt-1 flex-wrap">
              <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                ✓ {keywordsFound.length} matched
              </Badge>
              <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
                ✗ {keywordsMissing.length} missing
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Keywords */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Matched Keywords */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2">
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

        {/* Missing Keywords — read-only chips */}
        <Card className="border-destructive/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <XCircle className="h-4 w-4 text-destructive" />
              Missing Keywords ({keywordsMissing.length})
            </CardTitle>
            {keywordsMissing.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Address these via the AI Suggestions above to improve your score.
              </p>
            )}
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {keywordsMissing.map((kw) => (
                <Badge
                  key={kw}
                  variant="outline"
                  className="text-destructive border-destructive/30 text-xs"
                >
                  ✗ {kw}
                </Badge>
              ))}
              {keywordsMissing.length === 0 && (
                <p className="text-sm text-success font-medium">🎉 All keywords covered!</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Formatting Issues with Auto-Fix */}
      {formattingIssues.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                Formatting Issues ({formattingIssues.length})
              </CardTitle>
              {currentCv && onCvChange && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={handleAutoFixFormatting}
                  disabled={fixingFormat}
                >
                  {fixingFormat ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Wrench className="h-3.5 w-3.5" />
                  )}
                  Auto-Fix All
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-1">
                    +3-5%
                  </Badge>
                </Button>
              )}
            </div>
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

      {/* Quick Wins — max 3 */}
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
              {quickWins.slice(0, 3).map((win, i) => (
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
