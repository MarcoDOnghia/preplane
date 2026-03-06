import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Zap,
  Loader2,
  Sparkles,
  Target,
  TrendingUp,
  Wrench,
  ScrollText,
} from "lucide-react";
import { useState, useMemo, useRef, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { calculateAtsScore } from "@/lib/atsScore";
import type { AtsAnalysis } from "@/lib/types";

interface AtsScoreTabProps {
  atsAnalysis: AtsAnalysis;
  currentCv?: string;
  jobDescription?: string;
  onCvChange?: (html: string) => void;
  addedKeywords?: Set<string>;
}

const TARGET_SCORE = 90;

const AtsScoreTab = ({ atsAnalysis, currentCv, jobDescription, onCvChange, addedKeywords: parentAddedKeywords }: AtsScoreTabProps) => {
  const { score, keywordsFound, keywordsMissing, formattingIssues, quickWins } = atsAnalysis;
  const addedKeywords = parentAddedKeywords || new Set<string>();
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

  // Effective missing: from live props minus added keywords not yet picked up by live scoring
  const effectiveMissing = useMemo(
    () => keywordsMissing.filter((kw) => !addedKeywords.has(kw.toLowerCase())),
    [keywordsMissing, addedKeywords]
  );

  // Effective found: from live props plus added ones
  const effectiveFound = useMemo(() => {
    const fromProps = new Set(keywordsFound.map((k) => k.toLowerCase()));
    addedKeywords.forEach((k) => fromProps.add(k));
    return Array.from(fromProps);
  }, [keywordsFound, addedKeywords]);

  const totalKeywords = keywordsFound.length + keywordsMissing.length;

  const keywordsNeeded = useMemo(() => {
    if (totalKeywords === 0) return 0;
    const currentMatchRate = effectiveFound.length / totalKeywords;
    const targetMatchRate = TARGET_SCORE / 100;
    if (currentMatchRate >= targetMatchRate) return 0;
    return Math.ceil(targetMatchRate * totalKeywords) - effectiveFound.length;
  }, [effectiveFound.length, totalKeywords]);

  const projectedScorePerKeyword = useMemo(() => {
    if (totalKeywords === 0) return 0;
    return Math.round(70 / totalKeywords);
  }, [totalKeywords]);

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
                <div>
                  <p className="text-sm font-medium">ATS Compatibility Score</p>
                  <p className="text-xs text-muted-foreground">
                    {animatedScore >= TARGET_SCORE
                      ? "Your CV is ATS-optimized!"
                      : `Add ${Math.max(0, keywordsNeeded)} more keywords to reach ${TARGET_SCORE}%`}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className={`text-4xl font-bold tabular-nums transition-colors duration-300 ${scoreColor}`}>
                  {animatedScore}
                </div>
                {addedKeywords.size > 0 && (
                  <div className="flex items-center gap-1 text-success text-sm font-medium">
                    <TrendingUp className="h-3.5 w-3.5" />
                    +{addedKeywords.size * projectedScorePerKeyword} from additions
                  </div>
                )}
              </div>
            </div>

            {/* Current score bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Current</span>
                <span>{animatedScore}%</span>
              </div>
              <Progress value={animatedScore} className={`h-2.5 transition-all duration-700 ${scoreBarColor}`} />
            </div>

            {/* Target score bar */}
            {animatedScore < TARGET_SCORE && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Sparkles className="h-3 w-3" /> Target
                  </span>
                  <span>{TARGET_SCORE}%</span>
                </div>
                <div className="relative">
                  <Progress value={TARGET_SCORE} className="h-2.5 [&>div]:bg-muted-foreground/20 opacity-40" />
                  <div
                    className="absolute top-0 h-2.5 border-r-2 border-dashed border-foreground/40"
                    style={{ left: `${TARGET_SCORE}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Reach {TARGET_SCORE}% ATS by adding {keywordsNeeded} keyword{keywordsNeeded !== 1 ? "s" : ""} →
                  each adds ~{projectedScorePerKeyword}%
                </p>
              </div>
            )}

            {/* Summary badges */}
            <div className="flex gap-3 pt-1 flex-wrap">
              <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                ✓ {effectiveFound.length} matched
              </Badge>
              <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
                ✗ {effectiveMissing.length} missing
              </Badge>
              {addedKeywords.size > 0 && (
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                  + {addedKeywords.size} added this session
                </Badge>
              )}
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
              Keywords Found ({effectiveFound.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {keywordsFound.map((kw, i) => (
                <Badge key={i} className="bg-success/10 text-success border-success/20 hover:bg-success/20">
                  ✓ {kw}
                </Badge>
              ))}
              {Array.from(addedKeywords)
                .filter((kw) => !keywordsFound.map((k) => k.toLowerCase()).includes(kw))
                .map((kw) => (
                  <Badge key={`added-${kw}`} className="bg-primary/10 text-primary border-primary/20 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
                    ✓ {kw} <span className="text-[10px] ml-1 opacity-60">new</span>
                  </Badge>
                ))}
              {effectiveFound.length === 0 && (
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
              Missing Keywords ({effectiveMissing.length})
            </CardTitle>
            {effectiveMissing.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Address these via the AI Suggestions below to improve your ATS score.
              </p>
            )}
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {effectiveMissing.map((kw) => (
                <Badge
                  key={kw}
                  variant="outline"
                  className="text-destructive border-destructive/30 text-xs"
                >
                  ✗ {kw}
                </Badge>
              ))}
              {effectiveMissing.length === 0 && (
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
