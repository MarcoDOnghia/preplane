import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Download, CheckCircle2, ArrowRight } from "lucide-react";
import { exportCoverLetter, exportCvSuggestions } from "@/lib/exportDoc";
import type { TailorResult, CvSuggestion } from "@/lib/types";

interface ResultsSectionProps {
  result: TailorResult;
  jobTitle: string;
}

const ResultsSection = ({ result, jobTitle }: ResultsSectionProps) => {
  const [coverLetter, setCoverLetter] = useState(result.coverLetter);
  const wordCount = coverLetter.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Results</h2>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportCvSuggestions(result.cvSuggestions, jobTitle)}
          >
            <Download className="h-4 w-4 mr-1" />
            CV Suggestions
          </Button>
          <Button
            size="sm"
            onClick={() => exportCoverLetter(coverLetter, jobTitle)}
          >
            <Download className="h-4 w-4 mr-1" />
            Cover Letter
          </Button>
        </div>
      </div>

      <Tabs defaultValue="requirements" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="requirements">Key Requirements</TabsTrigger>
          <TabsTrigger value="suggestions">CV Suggestions</TabsTrigger>
          <TabsTrigger value="cover-letter">Cover Letter</TabsTrigger>
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
                  <Badge
                    key={i}
                    variant="secondary"
                    className="text-sm py-2 px-4 flex items-center gap-2"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                    {req}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="suggestions" className="mt-4 space-y-4">
          {result.cvSuggestions.map((suggestion, i) => (
            <SuggestionCard key={i} suggestion={suggestion} index={i} />
          ))}
        </TabsContent>

        <TabsContent value="cover-letter" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Cover Letter</CardTitle>
              <span className="text-sm text-muted-foreground">{wordCount} words</span>
            </CardHeader>
            <CardContent>
              <Textarea
                value={coverLetter}
                onChange={(e) => setCoverLetter(e.target.value)}
                className="min-h-[400px] text-sm leading-relaxed"
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

function SuggestionCard({ suggestion, index }: { suggestion: CvSuggestion; index: number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <span className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
            {index + 1}
          </span>
          {suggestion.section}
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
