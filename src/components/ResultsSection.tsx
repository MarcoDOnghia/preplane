import { useState, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Download,
  CheckCircle2,
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
import { exportCoverLetter, exportCvSuggestions } from "@/lib/exportDoc";
import { exportImprovedCv, copyToClipboard } from "@/lib/exportImprovedCv";
import AtsScoreTab from "@/components/AtsScoreTab";
import CoverLetterVersionsTab from "@/components/CoverLetterVersionsTab";
import AtsTemplateTab from "@/components/AtsTemplateTab";
import { useToast } from "@/hooks/use-toast";
import { calculateAtsScore } from "@/lib/atsScore";
import type { TailorResult, CvSuggestion } from "@/lib/types";

interface ResultsSectionProps {
  result: TailorResult;
  jobTitle: string;
  jobDescription?: string;
  onDownload?: () => void;
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
  const { toast } = useToast();

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
        </div>
      </div>

      {/* 3-tab layout */}
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
            {/* Left column: JD & Requirements */}
            <div className="space-y-4">
              {/* Requirements */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    Key Requirements ({result.keyRequirements.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1.5">
                    {result.keyRequirements.map((req, i) => (
                      <Badge key={i} variant="secondary" className="text-xs py-1 px-2.5">
                        {req}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* JD Summary */}
              {jobDescription && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                      <FileText className="h-4 w-4 text-primary" />
                      Job Description
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-[20] whitespace-pre-line">
                      {jobDescription}
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right column: ATS Template editor/preview */}
            <div>
              {result.reformattedCv ? (
                <AtsTemplateTab
                  reformattedCv={result.reformattedCv}
                  jobTitle={jobTitle}
                  atsScore={liveAts.score}
                />
              ) : (
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">
                      No ATS-reformatted CV available. Generate results with a job description to see the template.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ATS Score tab */}
        <TabsContent value="ats-score" className="mt-4">
          <AtsScoreTab
            atsAnalysis={liveAtsAnalysis}
            currentCv={currentCv}
            jobDescription={jobDescription}
            onCvChange={onCvChange}
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
