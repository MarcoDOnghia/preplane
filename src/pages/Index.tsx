import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import Header from "@/components/Header";
import InputSection from "@/components/InputSection";
import ResultsSection from "@/components/ResultsSection";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import type { TailorResult, Tone } from "@/lib/types";

const LOADING_STEPS = [
  { message: "Analyzing job requirements...", progress: 15 },
  { message: "Checking ATS compatibility...", progress: 35 },
  { message: "Tailoring your CV suggestions...", progress: 55 },
  { message: "Generating cover letter versions...", progress: 75 },
  { message: "Preparing interview questions...", progress: 90 },
  { message: "Polishing results...", progress: 95 },
];

const Index = () => {
  const { user, loading: authLoading } = useAuth();
  const [result, setResult] = useState<TailorResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [lastJobTitle, setLastJobTitle] = useState("Untitled Position");
  const { toast } = useToast();

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  const handleSubmit = async (cvContent: string, jobDescription: string, tone: Tone) => {
    setLoading(true);
    setResult(null);

    let stepIndex = 0;
    setLoadingMessage(LOADING_STEPS[0].message);
    setLoadingProgress(LOADING_STEPS[0].progress);
    const interval = setInterval(() => {
      stepIndex = Math.min(stepIndex + 1, LOADING_STEPS.length - 1);
      setLoadingMessage(LOADING_STEPS[stepIndex].message);
      setLoadingProgress(LOADING_STEPS[stepIndex].progress);
    }, 4000);

    try {
      const { data, error } = await supabase.functions.invoke("tailor-cv", {
        body: { cvContent, jobDescription, tone },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setResult(data);

      const titleMatch = jobDescription.match(/^(.+?)(?:\s*[—–-]\s*.+)?$/m);
      const jobTitle = titleMatch?.[1]?.trim().slice(0, 100) || "Untitled Position";
      const companyMatch = jobDescription.match(/[—–-]\s*(.+?)$/m);
      const company = companyMatch?.[1]?.trim().slice(0, 100) || "Unknown Company";
      setLastJobTitle(jobTitle);

      await supabase.from("applications").insert({
        user_id: user.id,
        job_title: jobTitle,
        company: company,
        cv_content: cvContent,
        job_description: jobDescription,
        tone,
        key_requirements: data.keyRequirements,
        cv_suggestions: data.cvSuggestions,
        cover_letter: data.coverLetter || data.coverLetterVersions?.[0]?.content || "",
        cover_letter_versions: data.coverLetterVersions || [],
        ats_score: data.atsAnalysis?.score || 0,
        keywords_found: data.atsAnalysis?.keywordsFound || [],
        keywords_missing: data.atsAnalysis?.keywordsMissing || [],
        formatting_issues: data.atsAnalysis?.formattingIssues || [],
        quick_wins: data.atsAnalysis?.quickWins || [],
        interview_questions: data.interviewQuestions || [],
        questions_to_ask: data.questionsToAsk || [],
        company_brief: data.companyBrief || "",
      });

      toast({ title: "Analysis complete!", description: "Your tailored results are ready." });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      clearInterval(interval);
      setLoading(false);
      setLoadingMessage("");
      setLoadingProgress(0);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-6xl space-y-10">
        <InputSection onSubmit={handleSubmit} loading={loading} loadingMessage={loadingMessage} />
        {loading && loadingProgress > 0 && (
          <div className="space-y-2">
            <Progress value={loadingProgress} className="h-2" />
            <p className="text-xs text-muted-foreground text-center">
              Step {Math.ceil(loadingProgress / 20)} of 5
            </p>
          </div>
        )}
        {result && <ResultsSection result={result} jobTitle={lastJobTitle} />}
      </main>
    </div>
  );
};

export default Index;
