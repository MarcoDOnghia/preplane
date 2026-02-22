import { useState, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Download,
  CheckCircle2,
  ArrowRight,
  Check,
  X,
  Undo2,
  ChevronDown,
  Copy,
  FileText,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { exportCoverLetter, exportCvSuggestions, exportInterviewPrep } from "@/lib/exportDoc";
import { exportImprovedCv, copyToClipboard } from "@/lib/exportImprovedCv";
import AtsScoreTab from "@/components/AtsScoreTab";
import InterviewPrepTab from "@/components/InterviewPrepTab";
import CoverLetterVersionsTab from "@/components/CoverLetterVersionsTab";
import CvEditorTab from "@/components/CvEditorTab";
import { useToast } from "@/hooks/use-toast";
import { calculateAtsScore } from "@/lib/atsScore";
import type { TailorResult, CvSuggestion } from "@/lib/types";

interface ResultsSectionProps {
  result: TailorResult;
  jobTitle: string;
  jobDescription?: string;
  onDownload?: () => void;
  // CV editing props
  originalCv: string;
  currentCv: string;
  onCvChange: (html: string) => void;
  onApplySuggestion: (index: number) => void;
  onDismissSuggestion: (index: number) => void;
  onUndoSuggestion: (index: number) => void;
  onApplyAllSuggestions: () => void;
  onApplyHighPriority: () => void;
  onResetCv: () => void;
  appliedSuggestions: number[];
  dismissedSuggestions: number[];
  saveStatus: "idle" | "saving" | "saved" | "error";
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
  originalCv,
  currentCv,
  onCvChange,
  onApplySuggestion,
  onDismissSuggestion,
  onUndoSuggestion,
  onApplyAllSuggestions,
  onApplyHighPriority,
  onResetCv,
  appliedSuggestions,
  dismissedSuggestions,
  saveStatus,
}: ResultsSectionProps) => {
  const [selectedCoverLetterIndex, setSelectedCoverLetterIndex] = useState(0);
  const [selectedCoverLetter, setSelectedCoverLetter] = useState(
    result.coverLetterVersions?.[0]?.content || result.coverLetter
  );
  const [priorityFilter, setPriorityFilter] = useState<string | null>(null);
  const { toast } = useToast();

  const visibleSuggestions = useMemo(() => {
    return result.cvSuggestions
      .map((s, i) => ({ ...s, originalIndex: i }))
      .filter((_, i) => !dismissedSuggestions.includes(i))
      .filter((s) => (priorityFilter ? s.priority === priorityFilter : true));
  }, [result.cvSuggestions, dismissedSuggestions, priorityFilter]);

  const appliedCount = appliedSuggestions.length;
  const totalCount = result.cvSuggestions.length;

  // Use AI-extracted keywords as the canonical keyword list for recalculation
  const aiKeywords = useMemo(() => {
    const found = result.atsAnalysis?.keywordsFound || [];
    const missing = result.atsAnalysis?.keywordsMissing || [];
    return [...found, ...missing];
  }, [result.atsAnalysis]);

  // Single source of truth for live ATS score
  const liveAts = useMemo(() => {
    if (!jobDescription || !currentCv) {
      return {
        score: result.atsAnalysis?.score || 0,
        matchedKeywords: result.atsAnalysis?.keywordsFound || [],
        missingKeywords: result.atsAnalysis?.keywordsMissing || [],
      };
    }
    return calculateAtsScore(currentCv, jobDescription, aiKeywords);
  }, [currentCv, jobDescription, result.atsAnalysis, aiKeywords]);

  const liveAtsAnalysis = useMemo(() => ({
    ...result.atsAnalysis,
    score: liveAts.score,
    keywordsFound: liveAts.matchedKeywords,
    keywordsMissing: liveAts.missingKeywords,
  }), [result.atsAnalysis, liveAts]);

  const handleSelectVersion = (content: string) => {
    setSelectedCoverLetter(content);
    const idx = result.coverLetterVersions?.findIndex((v) => v.content === content);
    setSelectedCoverLetterIndex(idx !== undefined && idx >= 0 ? idx : 0);
  };

  const handleDownloadImprovedCv = async () => {
    await exportImprovedCv(currentCv, "", jobTitle);
    onDownload?.();
    toast({ title: "✓ CV downloaded successfully" });
  };

  const handleCopyToClipboard = async () => {
    const text = copyToClipboard(currentCv);
    await navigator.clipboard.writeText(text);
    toast({ title: "✓ Copied to clipboard" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-2xl font-bold">Results</h2>
        <div className="flex gap-2 flex-wrap">
          {/* Primary download */}
          <div className="flex">
            <Button
              size="sm"
              className="rounded-r-none bg-primary hover:bg-primary/90"
              onClick={handleDownloadImprovedCv}
            >
              <Download className="h-4 w-4 mr-1" /> Download Improved CV
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
          <Button variant="outline" size="sm" onClick={() => { exportInterviewPrep(result.interviewQuestions, result.questionsToAsk, result.companyBrief, jobTitle); onDownload?.(); }}>
            <Download className="h-4 w-4 mr-1" /> Interview Prep
          </Button>
        </div>
      </div>

      <Tabs defaultValue="requirements" className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="requirements">Requirements</TabsTrigger>
          <TabsTrigger value="suggestions">
            CV Suggestions
            {appliedCount > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">
                {appliedCount}/{totalCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="edit-cv" className="font-semibold">
            ✏️ Edit Your CV
          </TabsTrigger>
          <TabsTrigger value="ats">ATS Score</TabsTrigger>
          <TabsTrigger value="cover-letter">Cover Letters</TabsTrigger>
          <TabsTrigger value="interview">Interview Prep</TabsTrigger>
        </TabsList>

        <TabsContent value="requirements" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Key Requirements Identified ({result.keyRequirements.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {result.keyRequirements.map((req, i) => (
                  <Badge key={i} variant="secondary" className="text-sm py-2 px-4 flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                    {req}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="suggestions" className="mt-4 space-y-4">
          {/* Top actions */}
          <div className="flex gap-2 flex-wrap items-center">
            <Button size="sm" variant={priorityFilter === null ? "default" : "outline"} onClick={() => setPriorityFilter(null)}>
              All ({totalCount - dismissedSuggestions.length})
            </Button>
            {["high", "medium", "low"].map((p) => {
              const count = result.cvSuggestions.filter((s, i) => s.priority === p && !dismissedSuggestions.includes(i)).length;
              return (
                <Button key={p} size="sm" variant={priorityFilter === p ? "default" : "outline"} onClick={() => setPriorityFilter(p)}>
                  {p.charAt(0).toUpperCase() + p.slice(1)} ({count})
                </Button>
              );
            })}
            <div className="ml-auto">
              <Button
                size="sm"
                variant="default"
                onClick={onApplyHighPriority}
                disabled={result.cvSuggestions.every((s, i) => s.priority !== "high" || appliedSuggestions.includes(i))}
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
            <div className="text-center py-8 text-muted-foreground">
              {dismissedSuggestions.length > 0
                ? "All suggestions have been handled!"
                : "No suggestions match the selected filter."}
            </div>
          )}
        </TabsContent>

        <TabsContent value="edit-cv" className="mt-4">
          <CvEditorTab
            originalCv={originalCv}
            currentCv={currentCv}
            onChange={onCvChange}
            onApplyAll={onApplyAllSuggestions}
            onReset={onResetCv}
            originalAtsScore={result.atsAnalysis?.score || 0}
            liveAtsScore={liveAts.score}
            jobDescription={jobDescription}
            suggestions={result.cvSuggestions}
            appliedSuggestions={appliedSuggestions}
            saveStatus={saveStatus}
          />
        </TabsContent>

        <TabsContent value="ats" className="mt-4">
          <AtsScoreTab atsAnalysis={liveAtsAnalysis} />
        </TabsContent>

        <TabsContent value="cover-letter" className="mt-4">
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

        <TabsContent value="interview" className="mt-4">
          <InterviewPrepTab
            interviewQuestions={result.interviewQuestions}
            questionsToAsk={result.questionsToAsk}
            companyBrief={result.companyBrief}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

function SuggestionCard({
  suggestion,
  index,
  isApplied,
  onApply,
  onDismiss,
  onUndo,
}: {
  suggestion: CvSuggestion;
  index: number;
  isApplied: boolean;
  onApply: () => void;
  onDismiss: () => void;
  onUndo: () => void;
}) {
  return (
    <Card className={isApplied ? "border-success/30 bg-success/5" : ""}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2 flex-wrap">
          <span className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${isApplied ? "bg-success text-success-foreground" : "bg-primary text-primary-foreground"}`}>
            {isApplied ? <Check className="h-3.5 w-3.5" /> : index + 1}
          </span>
          {suggestion.section}
          {suggestion.priority && (
            <Badge variant="outline" className={`text-xs ${PRIORITY_COLORS[suggestion.priority] || ""}`}>
              {suggestion.priority}
            </Badge>
          )}
          {suggestion.impactScore && (
            <span className="text-xs text-muted-foreground">Impact: {suggestion.impactScore}/10</span>
          )}
          {/* Action buttons */}
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className={`rounded-lg p-4 text-sm ${isApplied ? "bg-muted/50 line-through opacity-60" : "bg-muted"}`}>
            <p className="text-xs font-medium text-muted-foreground mb-2">Original</p>
            <p>{suggestion.original}</p>
          </div>
          <div className={`rounded-lg border p-4 text-sm ${isApplied ? "bg-success/10 border-success/20" : "bg-primary/5 border-primary/20"}`}>
            <p className={`text-xs font-medium mb-2 flex items-center gap-1 ${isApplied ? "text-success" : "text-primary"}`}>
              {isApplied ? <Check className="h-3 w-3" /> : <ArrowRight className="h-3 w-3" />}
              {isApplied ? "Applied" : "Suggested"}
            </p>
            <p>{suggestion.suggested}</p>
          </div>
        </div>
        <p className="mt-3 text-sm text-muted-foreground italic">💡 {suggestion.reason}</p>
      </CardContent>
    </Card>
  );
}

export default ResultsSection;
