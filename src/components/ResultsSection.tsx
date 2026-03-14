import { useState, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Download,
  CheckCircle2,
  ChevronDown,
  Copy,
  FileText,
  Target,
  TrendingUp,
  AlertTriangle,
  Sparkles,
  Check,
  X,
  Undo2,
  ArrowRight,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { exportCoverLetter, exportCvSuggestions } from "@/lib/exportDoc";
import { exportImprovedCv } from "@/lib/exportImprovedCv";
import AtsScoreTab from "@/components/AtsScoreTab";
import CoverLetterVersionsTab from "@/components/CoverLetterVersionsTab";
import AtsCvEditor from "@/components/AtsCvEditor";
import { useToast } from "@/hooks/use-toast";
import { calculateAtsScore } from "@/lib/atsScore";
import { cvModelToPlainText, cvModelToHtml } from "@/lib/cvDataModel";
import type { CvDataModel } from "@/lib/cvDataModel";
import type { TailorResult, CvSuggestion } from "@/lib/types";
import { matchKeyword } from "@/lib/atsScore";
import { sanitizeDisplayText, sanitizeDisplayArray } from "@/lib/sanitizeText";

interface ResultsSectionProps {
  result: TailorResult;
  jobTitle: string;
  jobDescription?: string;
  onDownload?: () => void;
  cvModel: CvDataModel;
  onCvModelChange: (model: CvDataModel) => void;
  onResetCv: () => void;
  onUndo: () => void;
  canUndo: boolean;
  saveStatus: "idle" | "saving" | "saved" | "error";
  // Suggestions
  appliedSuggestions: number[];
  dismissedSuggestions: number[];
  onApplySuggestion: (index: number) => void;
  onDismissSuggestion: (index: number) => void;
  onUndoSuggestion: (index: number) => void;
  onApplyHighPriority: () => void;
  onAddKeywordBullet?: (keyword: string, bullet: string, sectionHint: string) => void;
  appliedKeywordBullets?: string[];
  addedKeywords?: Set<string>;
}

const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-destructive/10 text-destructive border-destructive/20",
  medium: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  low: "bg-success/10 text-success border-success/20",
};

const ResultsSection = ({
  result,
  jobTitle,
  jobDescription = "",
  onDownload,
  cvModel,
  onCvModelChange,
  onResetCv,
  onUndo,
  canUndo,
  saveStatus,
  appliedSuggestions,
  dismissedSuggestions,
  onApplySuggestion,
  onDismissSuggestion,
  onUndoSuggestion,
  onApplyHighPriority,
  onAddKeywordBullet,
  appliedKeywordBullets = [],
  addedKeywords = new Set<string>(),
}: ResultsSectionProps) => {
  const [selectedCoverLetterIndex, setSelectedCoverLetterIndex] = useState(0);
  const [selectedCoverLetter, setSelectedCoverLetter] = useState(
    result.coverLetterVersions?.[0]?.content || result.coverLetter
  );
  const [priorityFilter, setPriorityFilter] = useState<string | null>(null);
  const { toast } = useToast();

  // Derive plain text and HTML from model for ATS scoring
  const cvPlainText = useMemo(() => cvModelToPlainText(cvModel), [cvModel]);
  const cvHtml = useMemo(() => cvModelToHtml(cvModel), [cvModel]);

  // Use AI-extracted keywords as the canonical keyword list
  const aiKeywords = useMemo(() => {
    const found = result.atsAnalysis?.keywordsFound || [];
    const missing = result.atsAnalysis?.keywordsMissing || [];
    return [...found, ...missing];
  }, [result.atsAnalysis]);

  // Single source of truth for live ATS score
  const liveAts = useMemo(() => {
    if (!jobDescription || !cvPlainText) {
      return {
        score: result.atsAnalysis?.score || 0,
        matchedKeywords: result.atsAnalysis?.keywordsFound || [],
        missingKeywords: result.atsAnalysis?.keywordsMissing || [],
      };
    }
    return calculateAtsScore(cvPlainText, jobDescription, aiKeywords);
  }, [cvPlainText, jobDescription, result.atsAnalysis, aiKeywords]);

  const liveAtsAnalysis = useMemo(() => ({
    ...result.atsAnalysis,
    score: liveAts.score,
    keywordsFound: liveAts.matchedKeywords,
    keywordsMissing: liveAts.missingKeywords,
  }), [result.atsAnalysis, liveAts]);

  // Suggestion counts
  const highPriorityRemaining = useMemo(() => {
    return result.cvSuggestions.filter(
      (s, i) => s.priority === "high" && !appliedSuggestions.includes(i) && !dismissedSuggestions.includes(i)
    ).length;
  }, [result.cvSuggestions, appliedSuggestions, dismissedSuggestions]);

  const projectedScore = useMemo(() => {
    if (!jobDescription || !cvPlainText) return liveAts.score;
    const missingCount = liveAts.missingKeywords.length;
    if (missingCount === 0) return liveAts.score;
    const totalKeywords = liveAts.matchedKeywords.length + missingCount;
    return Math.min(100, Math.round((totalKeywords / totalKeywords) * 100));
  }, [liveAts, jobDescription, cvPlainText]);

  // BUG 5: Filter out AI suggestions that overlap >60% with applied keyword bullets
  const wordOverlap = (a: string, b: string): number => {
    const wordsA = a.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const wordsB = new Set(b.toLowerCase().split(/\s+/).filter(w => w.length > 3));
    if (wordsA.length === 0) return 0;
    const matched = wordsA.filter(w => wordsB.has(w)).length;
    return matched / wordsA.length;
  };

  const visibleSuggestions = useMemo(() => {
    const allKeywords = [...(liveAts.matchedKeywords || []), ...(liveAts.missingKeywords || [])];

    return result.cvSuggestions
      .map((s, i) => {
        // FIX 2: Check if applying this suggestion would reduce keyword matches
        let keywordWarning = false;
        if (allKeywords.length > 0 && s.original && s.suggested) {
          const origLower = s.original.toLowerCase();
          const sugLower = s.suggested.toLowerCase();
          // Check if any currently matched keyword in original would be lost in suggested
          for (const kw of allKeywords) {
            if (matchKeyword(kw, origLower) && !matchKeyword(kw, sugLower)) {
              keywordWarning = true;
              break;
            }
          }
        }
        return { ...s, originalIndex: i, keywordWarning };
      })
      .filter((_, i) => !dismissedSuggestions.includes(i))
      .filter((s) => {
        if (appliedKeywordBullets.length > 0) {
          for (const kb of appliedKeywordBullets) {
            if (wordOverlap(s.suggested, kb) > 0.5) return false;
          }
        }
        return true;
      })
      .filter((s) => (priorityFilter ? s.priority === priorityFilter : true));
  }, [result.cvSuggestions, dismissedSuggestions, priorityFilter, appliedKeywordBullets, liveAts]);

  const totalActive = result.cvSuggestions.length - dismissedSuggestions.length;

  const handleSelectVersion = (content: string) => {
    setSelectedCoverLetter(content);
    const idx = result.coverLetterVersions?.findIndex((v) => v.content === content);
    setSelectedCoverLetterIndex(idx !== undefined && idx >= 0 ? idx : 0);
  };

  const handleDownloadImprovedCv = async () => {
    await exportImprovedCv(cvHtml, "", jobTitle);
    onDownload?.();
    toast({ title: "✓ CV downloaded successfully" });
  };

  const handleCopyToClipboard = async () => {
    const text = cvModelToPlainText(cvModel);
    await navigator.clipboard.writeText(text);
    toast({ title: "✓ Copied to clipboard" });
  };

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-2xl font-bold">Results</h2>
        <div className="flex gap-2 flex-wrap">
          <div className="flex">
            <Button
              size="sm"
              className="rounded-r-none bg-primary hover:bg-primary/90"
              onClick={handleDownloadImprovedCv}
            >
              <Download className="h-4 w-4 mr-1" /> Download CV
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="rounded-l-none border-l border-primary-foreground/20 bg-primary hover:bg-primary/90 px-2">
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleDownloadImprovedCv}>
                  <FileText className="h-4 w-4 mr-2" /> Download as .docx
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { exportCvSuggestions(result.cvSuggestions, jobTitle); onDownload?.(); }}>
                  <FileText className="h-4 w-4 mr-2" /> Download Suggestions List
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleCopyToClipboard}>
                  <Copy className="h-4 w-4 mr-2" /> Copy to Clipboard
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <Button variant="outline" size="sm" onClick={() => { exportCoverLetter(selectedCoverLetter, jobTitle); onDownload?.(); }}>
            <Download className="h-4 w-4 mr-1" /> Cover Letter
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="ats-editor" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="ats-editor" className="font-semibold">
            CV Editor
          </TabsTrigger>
          <TabsTrigger value="ats-score">Job Match Score</TabsTrigger>
          <TabsTrigger value="cover-letters">Cover Letter</TabsTrigger>
        </TabsList>

        {/* CV Editor: two-column layout, no suggestions here */}
        <TabsContent value="ats-editor" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-[30%_1fr] gap-4">
            {/* Left: Score first, then Requirements & Quick Wins */}
            <JdRequirementsPanel
              requirements={result.keyRequirements}
              currentScore={liveAts.score}
              highPriorityRemaining={highPriorityRemaining}
              quickWins={liveAtsAnalysis.quickWins || []}
            />

            {/* Right: Editable ATS CV */}
            <AtsCvEditor
              model={cvModel}
              onChange={onCvModelChange}
              onReset={onResetCv}
              onUndo={onUndo}
              canUndo={canUndo}
              originalAtsScore={result.atsAnalysis?.score || 0}
              liveAtsScore={liveAts.score}
              saveStatus={saveStatus}
              jobTitle={jobTitle}
            />
          </div>
        </TabsContent>

        {/* Job Match Score tab — AI Suggestions first, then score details */}
        <TabsContent value="ats-score" className="mt-4 space-y-6">
          {/* AI Suggestions panel — shown first */}
          {result.cvSuggestions.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-lg font-bold">AI Suggestions</h3>
                <div className="flex gap-2 flex-wrap items-center">
                  <Button size="sm" variant={priorityFilter === null ? "default" : "outline"} onClick={() => setPriorityFilter(null)}>
                    All ({totalActive})
                  </Button>
                  {(["high", "medium"] as const).map((p) => {
                    const count = result.cvSuggestions.filter(
                      (s, i) => s.priority === p && !dismissedSuggestions.includes(i)
                    ).length;
                    return (
                      <Button key={p} size="sm" variant={priorityFilter === p ? "default" : "outline"} onClick={() => setPriorityFilter(p)}>
                        {p.charAt(0).toUpperCase() + p.slice(1)} ({count})
                      </Button>
                    );
                  })}
                  <Button
                    size="sm"
                    variant="default"
                    onClick={onApplyHighPriority}
                    disabled={highPriorityRemaining === 0}
                    className="ml-2"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    Apply All High Priority
                  </Button>
                </div>
              </div>

              {visibleSuggestions.map((suggestion) => (
                <SuggestionCard
                  key={suggestion.originalIndex}
                  suggestion={suggestion}
                  index={suggestion.originalIndex}
                  isApplied={appliedSuggestions.includes(suggestion.originalIndex)}
                  onApply={() => onApplySuggestion(suggestion.originalIndex)}
                  onDismiss={() => onDismissSuggestion(suggestion.originalIndex)}
                  onUndo={() => onUndoSuggestion(suggestion.originalIndex)}
                />
              ))}

              {visibleSuggestions.length === 0 && (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  {dismissedSuggestions.length > 0
                    ? "All suggestions have been handled!"
                    : "No suggestions match the selected filter."}
                </div>
              )}
            </div>
          )}

          <AtsScoreTab
            atsAnalysis={liveAtsAnalysis}
            currentCv={cvPlainText}
            jobDescription={jobDescription}
            onCvChange={() => {}}
          />

          {/* Score details (Keywords, Formatting, Quick Wins) */}
        </TabsContent>

        {/* Cover Letters tab */}
        <TabsContent value="cover-letters" className="mt-4">
          {result.coverLetterVersions?.length > 0 ? (
            <CoverLetterVersionsTab
              versions={result.coverLetterVersions}
              onSelect={handleSelectVersion}
              selectedIndex={selectedCoverLetterIndex}
            />
          ) : (
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm leading-relaxed whitespace-pre-line">{result.coverLetter}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ResultsSection;

// ─── Suggestion Card ────────────────────────────────────────

function SuggestionCard({
  suggestion,
  index,
  isApplied,
  onApply,
  onDismiss,
  onUndo,
}: {
  suggestion: CvSuggestion & { originalIndex: number; keywordWarning?: boolean };
  index: number;
  isApplied: boolean;
  onApply: () => void;
  onDismiss: () => void;
  onUndo: () => void;
}) {
  const cleanSection = sanitizeDisplayText(suggestion.section);
  const cleanOriginal = sanitizeDisplayText(suggestion.original);
  const cleanSuggested = sanitizeDisplayText(suggestion.suggested);
  const cleanReason = sanitizeDisplayText(suggestion.reason);

  // Fallback for malformed data
  if (!cleanSuggested && !cleanOriginal) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">We couldn't generate suggestions for this section. Try re-uploading your CV.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={isApplied ? "border-success/30 bg-success/5" : ""}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2 flex-wrap">
          <span className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${isApplied ? "bg-success text-success-foreground" : "bg-primary text-primary-foreground"}`}>
            {isApplied ? <Check className="h-3.5 w-3.5" /> : index + 1}
          </span>
          {cleanSection}
          {suggestion.priority && (
            <Badge variant="outline" className={`text-xs ${PRIORITY_COLORS[suggestion.priority] || ""}`}>
              {suggestion.priority}
            </Badge>
          )}
          {suggestion.keywordWarning && !isApplied && (
            <Badge variant="outline" className="text-xs border-amber-400/50 bg-amber-50 text-amber-700">
              <AlertTriangle className="h-3 w-3 mr-1" />
              May affect score
            </Badge>
          )}
          <div className="ml-auto flex gap-1.5">
            {isApplied ? (
              <Button size="sm" variant="outline" onClick={onUndo} className="text-xs h-7">
                <Undo2 className="h-3 w-3 mr-1" /> Undo
              </Button>
            ) : (
              <>
                <Button size="sm" onClick={onApply} className="text-xs h-7 bg-success hover:bg-success/90 text-success-foreground">
                  <Check className="h-3 w-3 mr-1" /> Apply
                </Button>
                <Button size="sm" variant="ghost" onClick={onDismiss} className="text-xs h-7 text-muted-foreground">
                  <X className="h-3 w-3 mr-1" /> Dismiss
                </Button>
              </>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {suggestion.keywordWarning && !isApplied && (
          <div className="mb-3 rounded-md border border-amber-300/50 bg-amber-50 p-2 text-xs text-amber-800 flex items-start gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            ⚠️ This change may slightly reduce your keyword score but improves readability
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className={`rounded-lg p-4 text-sm ${isApplied ? "bg-muted/50 line-through opacity-60" : "bg-muted"}`}>
            <p className="text-xs font-medium text-muted-foreground mb-2">Original</p>
            <p className="whitespace-pre-line">{cleanOriginal}</p>
          </div>
          <div className={`rounded-lg border p-4 text-sm ${isApplied ? "bg-success/10 border-success/20" : "bg-primary/5 border-primary/20"}`}>
            <p className={`text-xs font-medium mb-2 flex items-center gap-1 ${isApplied ? "text-success" : "text-primary"}`}>
              {isApplied ? <Check className="h-3 w-3" /> : <ArrowRight className="h-3 w-3" />}
              {isApplied ? "Applied" : "Suggested"}
            </p>
            <p className="whitespace-pre-line">{cleanSuggested}</p>
          </div>
        </div>
        <p className="mt-3 text-sm text-muted-foreground italic">💡 {cleanReason}</p>
      </CardContent>
    </Card>
  );
}

// ─── Left-column panel ─────────────────────────────────────

function JdRequirementsPanel({
  requirements,
  currentScore,
  highPriorityRemaining,
  quickWins,
}: {
  requirements: string[];
  currentScore: number;
  highPriorityRemaining: number;
  quickWins: string[];
}) {
  const scoreColor =
    currentScore >= 80 ? "text-success" : currentScore >= 60 ? "text-yellow-500" : "text-destructive";

  return (
    <div className="space-y-4">
      {/* Job Match Score — first and most prominent */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
            <Target className="h-4 w-4 text-primary" />
            Job Match Score
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-end justify-between">
            <span className={`text-3xl font-bold ${scoreColor}`}>{currentScore}%</span>
          </div>
          <Progress value={currentScore} className="h-2" />
          {highPriorityRemaining > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />
              {highPriorityRemaining} high-priority suggestion{highPriorityRemaining > 1 ? "s" : ""} remaining
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Wins — actionable, shown second */}
      {quickWins.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-primary" />
              Quick Wins
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5">
              {sanitizeDisplayArray(quickWins).slice(0, 3).map((win, i) => (
                <li key={i} className="flex items-start gap-2 text-xs leading-relaxed">
                  <TrendingUp className="h-3.5 w-3.5 mt-0.5 shrink-0 text-success" />
                  {win}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Job Requirements — reference list, shown last */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            Job Requirements ({requirements.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1.5">
            {sanitizeDisplayArray(requirements).map((req, i) => (
              <li key={i} className="flex items-start gap-2 text-xs leading-relaxed">
                <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary/60" />
                {req}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
