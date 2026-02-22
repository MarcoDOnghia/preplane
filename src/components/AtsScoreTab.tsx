import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Zap,
  Check,
  Plus,
  Loader2,
  Eye,
  Sparkles,
  Target,
  TrendingUp,
  Wrench,
  ScrollText,
} from "lucide-react";
import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { calculateAtsScore } from "@/lib/atsScore";
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
const SCORE_DEBOUNCE_MS = 500;

const AtsScoreTab = ({ atsAnalysis, currentCv, jobDescription, onCvChange }: AtsScoreTabProps) => {
  const { score, keywordsFound, keywordsMissing, formattingIssues, quickWins } = atsAnalysis;
  const [loadingKeyword, setLoadingKeyword] = useState<string | null>(null);
  const [previews, setPreviews] = useState<Record<string, GeneratedBullet>>({});
  const [addedKeywords, setAddedKeywords] = useState<Set<string>>(new Set());
  const [fixingFormat, setFixingFormat] = useState(false);
  const [animatedScore, setAnimatedScore] = useState(score);
  const [highlightedSection, setHighlightedSection] = useState<string | null>(null);
  const scoreTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  // Effective missing: from props minus already-added ones that haven't been picked up by rescan yet
  const effectiveMissing = useMemo(
    () => keywordsMissing.filter((kw) => !addedKeywords.has(kw.toLowerCase())),
    [keywordsMissing, addedKeywords]
  );

  // Effective found: from props plus added ones
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
    return Math.round(70 / totalKeywords); // each keyword is worth ~70/total points
  }, [totalKeywords]);

  const scoreColor =
    animatedScore >= 80 ? "text-success" : animatedScore >= 60 ? "text-yellow-500" : "text-destructive";
  const scoreBarColor =
    animatedScore >= 80 ? "[&>div]:bg-success" : animatedScore >= 60 ? "[&>div]:bg-yellow-500" : "[&>div]:bg-destructive";

  // Check if keyword already exists in CV (duplicate detection)
  const keywordExistsInCv = useCallback(
    (keyword: string): boolean => {
      if (!currentCv) return false;
      const cvLower = currentCv.toLowerCase();
      return cvLower.includes(keyword.toLowerCase());
    },
    [currentCv]
  );

  // Find best matching section in CV for a keyword
  const findBestSection = useCallback(
    (sectionHint: string): { position: number; sectionName: string } | null => {
      if (!currentCv) return null;

      const sectionMap: Record<string, string[]> = {
        skills: ["skills", "technical skills", "core competencies", "competenze", "abilità"],
        experience: ["experience", "work experience", "professional experience", "esperienza", "esperienze"],
        education: ["education", "academic", "istruzione", "formazione"],
        summary: ["summary", "profile", "about", "objective", "profilo", "riepilogo"],
        certifications: ["certifications", "certificates", "certificazioni"],
      };

      const hint = sectionHint.toLowerCase();
      const sectionKeys = Object.entries(sectionMap);

      // Find matching section category
      let targetPatterns: string[] = [];
      for (const [key, patterns] of sectionKeys) {
        if (hint.includes(key) || patterns.some((p) => hint.includes(p))) {
          targetPatterns = patterns;
          break;
        }
      }

      if (targetPatterns.length === 0) {
        // Default to experience
        targetPatterns = sectionMap.experience;
      }

      // Search CV for section heading
      for (const pattern of targetPatterns) {
        const regex = new RegExp(`<h[12][^>]*>[^<]*${pattern}[^<]*</h[12]>`, "i");
        const match = currentCv.match(regex);
        if (match && match.index !== undefined) {
          return { position: match.index + match[0].length, sectionName: pattern };
        }
        // Try bold/strong headings
        const boldRegex = new RegExp(`<(?:strong|b)>[^<]*${pattern}[^<]*</(?:strong|b)>`, "i");
        const boldMatch = currentCv.match(boldRegex);
        if (boldMatch && boldMatch.index !== undefined) {
          return { position: boldMatch.index + boldMatch[0].length, sectionName: pattern };
        }
      }

      return null;
    },
    [currentCv]
  );

  const handleGenerateBullet = async (keyword: string) => {
    if (!currentCv) {
      toast({ title: "No CV loaded", description: "Please analyze a CV first.", variant: "destructive" });
      return;
    }

    // Check for duplicates
    if (keywordExistsInCv(keyword)) {
      toast({
        title: "Keyword already in CV",
        description: `"${keyword}" already appears in your CV. Consider enhancing the existing bullet instead.`,
      });
    }

    setLoadingKeyword(keyword);
    try {
      const { data, error } = await supabase.functions.invoke("generate-keyword-bullet", {
        body: { keyword, cvContent: currentCv, jobDescription },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      setPreviews((prev) => ({ ...prev, [keyword]: data }));
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

  const handleApplyBullet = (keyword: string) => {
    const preview = previews[keyword];
    if (!preview || !onCvChange || !currentCv) return;

    const bulletHtml = `<ul><li>${preview.bullet}</li></ul>`;

    // Find the right section
    const section = findBestSection(preview.section);
    let newCv: string;

    if (section) {
      const afterSection = currentCv.slice(section.position);
      const nextSectionMatch = afterSection.match(/<h[12][^>]*>/i);
      if (nextSectionMatch && nextSectionMatch.index !== undefined) {
        const insertAt = section.position + nextSectionMatch.index;
        newCv = currentCv.slice(0, insertAt) + bulletHtml + currentCv.slice(insertAt);
      } else {
        newCv = currentCv.slice(0, section.position) + bulletHtml + currentCv.slice(section.position);
      }
    } else {
      newCv = currentCv + bulletHtml;
    }

    // Apply change immediately
    onCvChange(newCv);

    // Track as added
    setAddedKeywords((prev) => new Set(prev).add(keyword.toLowerCase()));

    // Clear preview
    setPreviews((prev) => {
      const next = { ...prev };
      delete next[keyword];
      return next;
    });

    // Highlight the section briefly
    setHighlightedSection(preview.section);
    setTimeout(() => setHighlightedSection(null), 3000);

    // Debug logging
    console.log(`[ATS] Added keyword "${keyword}" to section "${preview.section}"`);
    console.log(`[ATS] Keywords: found=${effectiveFound.length + 1}, missing=${effectiveMissing.length - 1}, total=${totalKeywords}`);
    console.log(`[ATS] Score before: ${score}, projected after: ~${score + projectedScorePerKeyword}`);

    toast({
      title: `✓ Added "${keyword}"`,
      description: `Inserted in ${preview.section} section • Score updating...`,
    });
  };

  const handleDismissPreview = (keyword: string) => {
    setPreviews((prev) => {
      const next = { ...prev };
      delete next[keyword];
      return next;
    });
  };

  // Auto-fix formatting issues
  const handleAutoFixFormatting = () => {
    if (!currentCv || !onCvChange) return;
    setFixingFormat(true);

    let fixed = currentCv;

    // Strip hyperlinks but keep text
    fixed = fixed.replace(/<a[^>]*>(.*?)<\/a>/gi, "$1");

    // Remove images
    fixed = fixed.replace(/<img[^>]*>/gi, "");

    // Strip inline styles that ATS can't read
    fixed = fixed.replace(/\s*style="[^"]*"/gi, "");

    // Remove problematic special characters
    fixed = fixed.replace(/[★☆►▶●○◆◇■□▪▫–—]/g, "");
    fixed = fixed.replace(/\u00A0/g, " "); // non-breaking spaces

    // Normalize whitespace
    fixed = fixed.replace(/\s{2,}/g, " ");

    // Clean empty tags
    fixed = fixed.replace(/<(p|li|div|span)>\s*<\/\1>/gi, "");

    onCvChange(fixed);

    const issuesFixed = formattingIssues.length;
    console.log(`[ATS] Auto-fixed formatting: ${issuesFixed} issues addressed`);
    console.log(`[ATS] Predicted score boost: +${Math.min(5, issuesFixed * 2)}%`);

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
            <CardTitle className="text-base flex items-center gap-2">
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
              {/* Show newly added keywords with special styling */}
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

        {/* Missing Keywords */}
        <Card className="border-destructive/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <XCircle className="h-4 w-4 text-destructive" />
              Missing Keywords ({effectiveMissing.length})
            </CardTitle>
            {effectiveMissing.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {currentCv
                  ? "If a keyword matches your experience, click ADD to generate a tailored bullet."
                  : "Click a keyword to copy it, then add it to your CV in the Edit tab."}
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {effectiveMissing.map((kw) => {
                const isDuplicate = keywordExistsInCv(kw);
                return (
                  <div key={kw} className="inline-flex">
                    {currentCv ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto px-2.5 py-1 gap-1.5 bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 text-xs font-normal rounded-full"
                        onClick={() => handleGenerateBullet(kw)}
                        disabled={loadingKeyword === kw}
                      >
                        {loadingKeyword === kw ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Plus className="h-3 w-3" />
                        )}
                        {kw}
                        {isDuplicate && (
                          <span className="text-[10px] opacity-60 ml-0.5">(enhance)</span>
                        )}
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto px-2.5 py-1 gap-1.5 bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 text-xs font-normal rounded-full"
                        onClick={async () => {
                          await navigator.clipboard.writeText(kw);
                          toast({ title: `"${kw}" copied`, description: "Paste it into your CV in the Edit tab." });
                        }}
                      >
                        ✗ {kw}
                      </Button>
                    )}
                  </div>
                );
              })}
              {effectiveMissing.length === 0 && (
                <p className="text-sm text-success font-medium">🎉 All keywords covered!</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI-Generated Bullet Previews */}
      {Object.entries(previews).map(([keyword, preview]) => {
        return (
          <Card key={keyword} className="border-primary/30 bg-primary/5 animate-in fade-in-0 slide-in-from-top-2 duration-300">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 flex-wrap">
                <Sparkles className="h-4 w-4 text-primary" />
                AI-generated for "{keyword}"
                <Badge variant="outline" className="text-[10px] ml-1">
                  → {preview.section}
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
                <span className="text-[10px] text-muted-foreground ml-auto">
                  +~{projectedScorePerKeyword}% score
                </span>
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
                  onClick={() => handleApplyBullet(keyword)}
                >
                  <Check className="h-3.5 w-3.5 mr-1" /> Add to CV
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground"
                  onClick={() => handleDismissPreview(keyword)}
                >
                  Dismiss
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleGenerateBullet(keyword)}
                  disabled={loadingKeyword === keyword}
                >
                  {loadingKeyword === keyword ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                  ) : null}
                  Regenerate
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}

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

      {/* Section highlight indicator */}
      {highlightedSection && (
        <div className="fixed bottom-6 right-6 bg-success text-success-foreground px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-in fade-in-0 slide-in-from-bottom-4 duration-300 z-50">
          <ScrollText className="h-4 w-4" />
          Bullet added to {highlightedSection} — switch to Edit CV tab to review
        </div>
      )}
    </div>
  );
};

export default AtsScoreTab;
