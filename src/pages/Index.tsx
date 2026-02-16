import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import Header from "@/components/Header";
import InputSection from "@/components/InputSection";
import ResultsSection from "@/components/ResultsSection";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { TailorResult, Tone } from "@/lib/types";

const LOADING_MESSAGES = [
  "Analyzing job requirements...",
  "Tailoring your CV...",
  "Crafting cover letter...",
  "Polishing results...",
];

const Index = () => {
  const { user, loading: authLoading } = useAuth();
  const [result, setResult] = useState<TailorResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
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

    // Cycle through loading messages
    let msgIndex = 0;
    setLoadingMessage(LOADING_MESSAGES[0]);
    const interval = setInterval(() => {
      msgIndex = Math.min(msgIndex + 1, LOADING_MESSAGES.length - 1);
      setLoadingMessage(LOADING_MESSAGES[msgIndex]);
    }, 3000);

    try {
      const { data, error } = await supabase.functions.invoke("tailor-cv", {
        body: { cvContent, jobDescription, tone },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setResult(data);

      // Extract job title from description
      const titleMatch = jobDescription.match(/^(.+?)(?:\s*[—–-]\s*.+)?$/m);
      const jobTitle = titleMatch?.[1]?.trim().slice(0, 100) || "Untitled Position";
      const companyMatch = jobDescription.match(/[—–-]\s*(.+?)$/m);
      const company = companyMatch?.[1]?.trim().slice(0, 100) || "Unknown Company";
      setLastJobTitle(jobTitle);

      // Save to history
      await supabase.from("applications").insert({
        user_id: user.id,
        job_title: jobTitle,
        company: company,
        cv_content: cvContent,
        job_description: jobDescription,
        tone,
        key_requirements: data.keyRequirements,
        cv_suggestions: data.cvSuggestions,
        cover_letter: data.coverLetter,
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
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-6xl space-y-10">
        <InputSection onSubmit={handleSubmit} loading={loading} loadingMessage={loadingMessage} />
        {result && <ResultsSection result={result} jobTitle={lastJobTitle} />}
      </main>
    </div>
  );
};

export default Index;
