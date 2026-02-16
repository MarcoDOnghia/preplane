import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, CheckCircle2, ArrowRight } from "lucide-react";
import { exportCoverLetter, exportCvSuggestions, exportInterviewPrep } from "@/lib/exportDoc";
import AtsScoreTab from "@/components/AtsScoreTab";
import InterviewPrepTab from "@/components/InterviewPrepTab";
import CoverLetterVersionsTab from "@/components/CoverLetterVersionsTab";
import type { TailorResult, CvSuggestion } from "@/lib/types";

interface ResultsSectionProps {
  result: TailorResult;
  jobTitle: string;
}

const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-destructive/10 text-destructive border-destructive/20",
  medium: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  low: "bg-success/10 text-success border-success/20",
};

const ResultsSection = ({ result, jobTitle }: ResultsSectionProps) => {
  const [selectedCoverLetterIndex, setSelectedCoverLetterIndex] = useState(0);
  const [selectedCoverLetter, setSelectedCoverLetter] = useState(
    result.coverLetterVersions?.[0]?.content || result.coverLetter
  );
  const [priorityFilter, setPriorityFilter] = useState<string | null>(null);

  const filteredSuggestions = priorityFilter
    ? result.cvSuggestions.filter((s) => s.priority === priorityFilter)
    : result.cvSuggestions;

  const handleSelectVersion = (content: string) => {
    setSelectedCoverLetter(content);
    const idx = result.coverLetterVersions?.findIndex((v) => v.content === content);
    setSelectedCoverLetterIndex(idx !== undefined && idx >= 0 ? idx : 0);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-2xl font-bold">Results</h2>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => exportCvSuggestions(result.cvSuggestions, jobTitle)}>
            <Download className="h-4 w-4 mr-1" /> CV Suggestions
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportCoverLetter(selectedCoverLetter, jobTitle)}>
            <Download className="h-4 w-4 mr-1" /> Cover Letter
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportInterviewPrep(result.interviewQuestions, result.questionsToAsk, result.companyBrief, jobTitle)}>
            <Download className="h-4 w-4 mr-1" /> Interview Prep
          </Button>
        </div>
      </div>

      <Tabs defaultValue="ats" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="ats">ATS Score</TabsTrigger>
          <TabsTrigger value="requirements">Requirements</TabsTrigger>
          <TabsTrigger value="suggestions">CV Suggestions</TabsTrigger>
          <TabsTrigger value="cover-letter">Cover Letters</TabsTrigger>
          <TabsTrigger value="interview">Interview Prep</TabsTrigger>
        </TabsList>

        <TabsContent value="ats" className="mt-4">
          <AtsScoreTab atsAnalysis={result.atsAnalysis} />
        </TabsContent>

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
          {/* Priority Filter */}
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant={priorityFilter === null ? "default" : "outline"} onClick={() => setPriorityFilter(null)}>
              All ({result.cvSuggestions.length})
            </Button>
            {["high", "medium", "low"].map((p) => {
              const count = result.cvSuggestions.filter((s) => s.priority === p).length;
              return (
                <Button key={p} size="sm" variant={priorityFilter === p ? "default" : "outline"} onClick={() => setPriorityFilter(p)}>
                  {p.charAt(0).toUpperCase() + p.slice(1)} ({count})
                </Button>
              );
            })}
          </div>
          {filteredSuggestions.map((suggestion, i) => (
            <SuggestionCard key={i} suggestion={suggestion} index={i} />
          ))}
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

function SuggestionCard({ suggestion, index }: { suggestion: CvSuggestion; index: number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2 flex-wrap">
          <span className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
            {index + 1}
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
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-lg bg-muted p-4 text-sm">
            <p className="text-xs font-medium text-muted-foreground mb-2">Original</p>
            <p>{suggestion.original}</p>
          </div>
          <div className="rounded-lg bg-primary/5 border border-primary/20 p-4 text-sm">
            <p className="text-xs font-medium text-primary mb-2 flex items-center gap-1">
              <ArrowRight className="h-3 w-3" /> Suggested
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
