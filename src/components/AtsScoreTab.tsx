import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Zap,
  Copy,
  Check,
  Plus,
  Loader2,
  Eye,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { useState, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { AtsAnalysis } from "@/lib/types";

interface AtsScoreTabProps {
  atsAnalysis: AtsAnalysis;
  currentCv?: string;
  jobDescription?: string;
  onCvChange?: (html: string) => void;
}

interface GeneratedBullet {
  bullet: string;
  section: string;
  isRephrase: boolean;
  confidence: string;
}

const TARGET_SCORE = 90;

const AtsScoreTab = ({ atsAnalysis, currentCv, jobDescription, onCvChange }: AtsScoreTabProps) => {
  const { score, keywordsFound, keywordsMissing, formattingIssues, quickWins } = atsAnalysis;
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [loadingKeyword, setLoadingKeyword] = useState<number | null>(null);
  const [previews, setPreviews] = useState<Record<number, GeneratedBullet>>({});
  const [addedKeywords, setAddedKeywords] = useState<Set<number>>(new Set());
  const { toast } = useToast();

  const totalKeywords = keywordsFound.length + keywordsMissing.length;

  // Calculate how many keywords need to be added to reach target
  const keywordsNeeded = useMemo(() => {
    if (totalKeywords === 0) return 0;
    const currentMatchRate = keywordsFound.length / totalKeywords;
    const targetMatchRate = TARGET_SCORE / 100;
    if (currentMatchRate >= targetMatchRate) return 0;
    return Math.ceil(targetMatchRate * totalKeywords) - keywordsFound.length;
  }, [keywordsFound.length, totalKeywords]);

  // Projected score after adding a keyword
  const projectedScore = useMemo(() => {
    if (totalKeywords === 0) return score;
    const addedCount = addedKeywords.size;
    const newMatchRate = (keywordsFound.length + addedCount) / totalKeywords;
    return Math.min(100, Math.round(newMatchRate * 70 + 30)); // 70% keyword weight + 30% format
  }, [keywordsFound.length, totalKeywords, addedKeywords.size, score]);

  const scoreColor =
    score >= 80 ? "text-success" : score >= 60 ? "text-yellow-500" : "text-destructive";
  const scoreBarColor =
    score >= 80 ? "[&>div]:bg-success" : score >= 60 ? "[&>div]:bg-yellow-500" : "[&>div]:bg-destructive";
  const targetBarColor =
    projectedScore >= 80 ? "[&>div]:bg-success" : projectedScore >= 60 ? "[&>div]:bg-yellow-500" : "[&>div]:bg-destructive";

  const handleCopyKeyword = async (kw: string, index: number) => {
    await navigator.clipboard.writeText(kw);
    setCopiedIndex(index);
    toast({ title: `"${kw}" copied`, description: "Paste it into your CV in the Edit tab." });
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleGenerateBullet = async (keyword: string, index: number) => {
    if (!currentCv) {
      toast({ title: "No CV loaded", description: "Please analyze a CV first.", variant: "destructive" });
      return;
    }
    setLoadingKeyword(index);
    try {
      const { data, error } = await supabase.functions.invoke("generate-keyword-bullet", {
        body: { keyword, cvContent: currentCv, jobDescription },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      setPreviews((prev) => ({ ...prev, [index]: data }));
    } catch (err: any) {
      toast({
        title: "Failed to generate",
        description: err.message || "Try again",
        variant: "destructive",
      });
    } finally {
      setLoadingKeyword(null);
    }
  };

  const handleApplyBullet = (keyword: string, index: number) => {
    const preview = previews[index];
    if (!preview || !onCvChange || !currentCv) return;

    // Find the right section in CV and append the bullet
    const sectionName = preview.section.toLowerCase();
    const cvLower = currentCv.toLowerCase();

    // Try to find the section heading
    const sectionPatterns = [
      new RegExp(`<h[12][^>]*>[^<]*${sectionName}[^<]*</h[12]>`, "i"),
      new RegExp(`<strong>[^<]*${sectionName}[^<]*</strong>`, "i"),
      new RegExp(`<b>[^<]*${sectionName}[^<]*</b>`, "i"),
    ];

    let insertPosition = -1;
    let matchLength = 0;
    for (const pattern of sectionPatterns) {
      const match = currentCv.match(pattern);
      if (match && match.index !== undefined) {
        insertPosition = match.index + match[0].length;
        matchLength = match[0].length;
        break;
      }
    }

    let newCv: string;
    const bulletHtml = `<ul><li>${preview.bullet}</li></ul>`;

    if (insertPosition !== -1) {
      // Find the next section or end, and insert before it
      const afterSection = currentCv.slice(insertPosition);
      const nextSectionMatch = afterSection.match(/<h[12][^>]*>/i);
      if (nextSectionMatch && nextSectionMatch.index !== undefined) {
        const insertAt = insertPosition + nextSectionMatch.index;
        newCv = currentCv.slice(0, insertAt) + bulletHtml + currentCv.slice(insertAt);
      } else {
        // Append at end of section
        newCv = currentCv.slice(0, insertPosition) + bulletHtml + currentCv.slice(insertPosition);
      }
    } else {
      // Fallback: append at end
      newCv = currentCv + bulletHtml;
    }

    onCvChange(newCv);
    setAddedKeywords((prev) => new Set(prev).add(index));
    setPreviews((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
    toast({
      title: `✓ Added "${keyword}"`,
      description: `Inserted in ${preview.section} section`,
    });
  };

  const handleDismissPreview = (index: number) => {
    setPreviews((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
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
                    {score >= TARGET_SCORE
                      ? "Your CV is ATS-optimized!"
                      : `Add ${Math.max(0, keywordsNeeded - addedKeywords.size)} more keywords to reach ${TARGET_SCORE}%`}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className={`text-4xl font-bold ${scoreColor}`}>{score}</div>
                {addedKeywords.size > 0 && projectedScore > score && (
                  <div className="flex items-center gap-1 text-success text-sm font-medium">
                    <TrendingUp className="h-3.5 w-3.5" />
                    → {projectedScore} projected
                  </div>
                )}
              </div>
            </div>

            {/* Current score bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Current</span>
                <span>{score}%</span>
              </div>
              <Progress value={score} className={`h-2.5 ${scoreBarColor}`} />
            </div>

            {/* Target score bar */}
            {score < TARGET_SCORE && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Sparkles className="h-3 w-3" /> Target
                  </span>
                  <span>{TARGET_SCORE}%</span>
                </div>
                <div className="relative">
                  <Progress value={projectedScore} className={`h-2.5 ${targetBarColor} opacity-60`} />
                  <div
                    className="absolute top-0 h-2.5 border-r-2 border-dashed border-foreground/40"
                    style={{ left: `${TARGET_SCORE}%` }}
                  />
                </div>
              </div>
            )}

            {/* Summary badges */}
            <div className="flex gap-3 pt-1">
              <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                ✓ {keywordsFound.length} matched
              </Badge>
              <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
                ✗ {keywordsMissing.length - addedKeywords.size} missing
              </Badge>
              {addedKeywords.size > 0 && (
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                  + {addedKeywords.size} added
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

        {/* Missing Keywords */}
        <Card className="border-destructive/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <XCircle className="h-4 w-4 text-destructive" />
              Missing Keywords ({keywordsMissing.length - addedKeywords.size})
            </CardTitle>
            {keywordsMissing.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {currentCv
                  ? "If a keyword matches your experience, click ADD to generate a tailored bullet point."
                  : "Click a keyword to copy it, then add it to your CV in the Edit tab."}
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {keywordsMissing.map((kw, i) => {
                if (addedKeywords.has(i)) {
                  return (
                    <Badge key={i} className="bg-success/10 text-success border-success/20">
                      <Check className="h-3 w-3 mr-1" /> {kw} — Added
                    </Badge>
                  );
                }
                return (
                  <div key={i} className="inline-flex">
                    {currentCv ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto px-2.5 py-1 gap-1.5 bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 text-xs font-normal rounded-full"
                        onClick={() => handleGenerateBullet(kw, i)}
                        disabled={loadingKeyword === i}
                      >
                        {loadingKeyword === i ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Plus className="h-3 w-3" />
                        )}
                        {kw}
                      </Button>
                    ) : (
                      <Button
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
                    )}
                  </div>
                );
              })}
              {keywordsMissing.length === 0 && (
                <p className="text-sm text-muted-foreground">All keywords covered!</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI-Generated Bullet Previews */}
      {Object.entries(previews).map(([indexStr, preview]) => {
        const index = parseInt(indexStr);
        const keyword = keywordsMissing[index];
        if (!keyword) return null;
        return (
          <Card key={index} className="border-primary/30 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 flex-wrap">
                <Sparkles className="h-4 w-4 text-primary" />
                AI-generated for "{keyword}"
                <Badge variant="outline" className="text-[10px] ml-1">
                  {preview.section}
                </Badge>
                {preview.isRephrase && (
                  <Badge variant="outline" className="text-[10px] bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
                    Rephrase suggestion
                  </Badge>
                )}
                <Badge
                  variant="outline"
                  className={`text-[10px] ${
                    preview.confidence === "high"
                      ? "bg-success/10 text-success border-success/20"
                      : preview.confidence === "medium"
                      ? "bg-yellow-500/10 text-yellow-600 border-yellow-500/20"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {preview.confidence} match
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border bg-card p-3 text-sm mb-3">
                <Eye className="h-3.5 w-3.5 text-muted-foreground inline mr-2" />
                {preview.bullet}
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="bg-success hover:bg-success/90 text-success-foreground"
                  onClick={() => handleApplyBullet(keyword, index)}
                >
                  <Check className="h-3.5 w-3.5 mr-1" /> Add to CV
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground"
                  onClick={() => handleDismissPreview(index)}
                >
                  Dismiss
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleGenerateBullet(keyword, index)}
                  disabled={loadingKeyword === index}
                >
                  {loadingKeyword === index ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                  ) : null}
                  Regenerate
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}

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
