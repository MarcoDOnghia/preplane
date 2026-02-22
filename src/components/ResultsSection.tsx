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
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { exportCoverLetter, exportCvSuggestions } from "@/lib/exportDoc";
import { exportImprovedCv, copyToClipboard } from "@/lib/exportImprovedCv";
import AtsScoreTab from "@/components/AtsScoreTab";
import CoverLetterVersionsTab from "@/components/CoverLetterVersionsTab";
import AtsCvEditor from "@/components/AtsCvEditor";
import { useToast } from "@/hooks/use-toast";
import { calculateAtsScore } from "@/lib/atsScore";
import { cvModelToPlainText, cvModelToHtml } from "@/lib/cvDataModel";
import type { CvDataModel } from "@/lib/cvDataModel";
import type { TailorResult } from "@/lib/types";

interface ResultsSectionProps {
  result: TailorResult;
  jobTitle: string;
  jobDescription?: string;
  onDownload?: () => void;
  // CV data model
  cvModel: CvDataModel;
  onCvModelChange: (model: CvDataModel) => void;
  onResetCv: () => void;
  saveStatus: "idle" | "saving" | "saved" | "error";
}

const ResultsSection = ({
  result,
  jobTitle,
  jobDescription = "",
  onDownload,
  cvModel,
  onCvModelChange,
  onResetCv,
  saveStatus,
}: ResultsSectionProps) => {
  const [selectedCoverLetterIndex, setSelectedCoverLetterIndex] = useState(0);
  const [selectedCoverLetter, setSelectedCoverLetter] = useState(
    result.coverLetterVersions?.[0]?.content || result.coverLetter
  );
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

  // Projected score if all missing keywords were added
  const highPriorityRemaining = useMemo(() => {
    return result.cvSuggestions.filter((s) => s.priority === "high").length;
  }, [result.cvSuggestions]);

  const projectedScore = useMemo(() => {
    if (!jobDescription || !cvPlainText) return liveAts.score;
    const missingCount = liveAts.missingKeywords.length;
    if (missingCount === 0) return liveAts.score;
    const totalKeywords = liveAts.matchedKeywords.length + missingCount;
    return Math.min(100, Math.round((totalKeywords / totalKeywords) * 100));
  }, [liveAts, jobDescription, cvPlainText]);

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

      {/* 2-tab layout (Requirements merged into editor left column) */}
      <Tabs defaultValue="ats-editor" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="ats-editor" className="font-semibold">
            ✏️ ATS CV Editor
          </TabsTrigger>
          <TabsTrigger value="ats-score">ATS Score</TabsTrigger>
          <TabsTrigger value="cover-letters">Cover Letters</TabsTrigger>
        </TabsList>

        {/* ATS CV Editor: two-column layout */}
        <TabsContent value="ats-editor" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-[30%_1fr] gap-4">
            {/* Left: Job Requirements & Keywords panel */}
            <JdRequirementsPanel
              requirements={result.keyRequirements}
              matchedKeywords={liveAts.matchedKeywords}
              missingKeywords={liveAts.missingKeywords}
              currentScore={liveAts.score}
              projectedScore={projectedScore}
              highPriorityRemaining={highPriorityRemaining}
              jobDescription={jobDescription}
            />

            {/* Right: Editable ATS CV */}
            <AtsCvEditor
              model={cvModel}
              onChange={onCvModelChange}
              onReset={onResetCv}
              originalAtsScore={result.atsAnalysis?.score || 0}
              liveAtsScore={liveAts.score}
              saveStatus={saveStatus}
              jobTitle={jobTitle}
            />
          </div>
        </TabsContent>

        {/* ATS Score tab */}
        <TabsContent value="ats-score" className="mt-4">
          <AtsScoreTab
            atsAnalysis={liveAtsAnalysis}
            currentCv={cvPlainText}
            jobDescription={jobDescription}
            onCvChange={() => {}}
          />
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

// ─── Left-column panel ─────────────────────────────────────

function JdRequirementsPanel({
  requirements,
  matchedKeywords,
  missingKeywords,
  currentScore,
  projectedScore,
  highPriorityRemaining,
  jobDescription,
}: {
  requirements: string[];
  matchedKeywords: string[];
  missingKeywords: string[];
  currentScore: number;
  projectedScore: number;
  highPriorityRemaining: number;
  jobDescription: string;
}) {
  const scoreColor =
    currentScore >= 80 ? "text-success" : currentScore >= 60 ? "text-yellow-500" : "text-destructive";
  const progressColor =
    currentScore >= 80 ? "bg-success" : currentScore >= 60 ? "bg-yellow-500" : "bg-destructive";

  return (
    <div className="space-y-4">
      {/* ATS Score overview */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
            <Target className="h-4 w-4 text-primary" />
            ATS Score
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-end justify-between">
            <span className={`text-3xl font-bold ${scoreColor}`}>{currentScore}%</span>
            {projectedScore > currentScore && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <TrendingUp className="h-3 w-3 text-success" />
                Projected: {projectedScore}%
              </span>
            )}
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

      {/* Requirements */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            Job Requirements ({requirements.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1.5">
            {requirements.map((req, i) => (
              <li key={i} className="flex items-start gap-2 text-xs leading-relaxed">
                <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary/60" />
                {req}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Keywords */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-primary" />
            Keywords ({matchedKeywords.length + missingKeywords.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {matchedKeywords.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 font-medium">
                Matched ({matchedKeywords.length})
              </p>
              <div className="flex flex-wrap gap-1">
                {matchedKeywords.map((kw, i) => (
                  <Badge key={i} variant="secondary" className="text-[11px] py-0.5 px-2 bg-success/10 text-success border-success/20">
                    ✓ {kw}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          {missingKeywords.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 font-medium">
                Missing ({missingKeywords.length})
              </p>
              <div className="flex flex-wrap gap-1">
                {missingKeywords.map((kw, i) => (
                  <Badge key={i} variant="outline" className="text-[11px] py-0.5 px-2 border-destructive/30 text-destructive">
                    ✗ {kw}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Collapsed JD */}
      {jobDescription && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <FileText className="h-4 w-4 text-primary" />
              Job Description
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-[12] whitespace-pre-line">
              {jobDescription}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
