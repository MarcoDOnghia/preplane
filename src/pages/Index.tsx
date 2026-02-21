import { useState, useRef, useCallback, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import Header from "@/components/Header";
import InputSection from "@/components/InputSection";
import ResultsSection from "@/components/ResultsSection";
import ApplicationTrackingModal from "@/components/ApplicationTrackingModal";
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

interface CvState {
  original: string;
  current: string;
  appliedSuggestions: number[];
  dismissedSuggestions: number[];
  isDirty: boolean;
}

const Index = () => {
  const { user, loading: authLoading } = useAuth();
  const [result, setResult] = useState<TailorResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [lastJobTitle, setLastJobTitle] = useState("Untitled Position");
  const [lastCompany, setLastCompany] = useState("Unknown Company");
  const [showTrackingModal, setShowTrackingModal] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [cvState, setCvState] = useState<CvState>({
    original: "",
    current: "",
    appliedSuggestions: [],
    dismissedSuggestions: [],
    isDirty: false,
  });
  const lastAppIdRef = useRef<string | null>(null);
  const downloadCountRef = useRef(0);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { toast } = useToast();

  // Autosave to database
  const saveCvToDb = useCallback(async (html: string, applied: number[]) => {
    if (!lastAppIdRef.current) return;
    setSaveStatus("saving");
    try {
      await supabase
        .from("applications")
        .update({
          current_cv: html,
          applied_suggestions: applied,
          last_edited: new Date().toISOString(),
        } as any)
        .eq("id", lastAppIdRef.current);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch {
      setSaveStatus("error");
    }
  }, []);

  // Debounced autosave
  const debouncedSave = useCallback(
    (html: string, applied: number[]) => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = setTimeout(() => saveCvToDb(html, applied), 3000);
    },
    [saveCvToDb]
  );

  // Warn on unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (cvState.isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [cvState.isDirty]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  const handleDownload = () => {
    downloadCountRef.current += 1;
    if (downloadCountRef.current === 1) {
      setShowTrackingModal(true);
    }
  };

  const handleTrackingSave = async (data: {
    status: string;
    applicationMethod?: string;
    appliedDate?: string;
    followUpDate?: string | null;
  }) => {
    if (!lastAppIdRef.current) return;
    const updates: Record<string, any> = { status: data.status };
    if (data.applicationMethod) updates.application_method = data.applicationMethod;
    if (data.appliedDate) updates.applied_date = data.appliedDate;
    if (data.followUpDate !== undefined) updates.follow_up_date = data.followUpDate;

    await supabase.from("applications").update(updates).eq("id", lastAppIdRef.current);
    toast({
      title: data.status === "applied" ? "Marked as Applied!" : "Saved for Later",
      description: data.status === "applied" ? "Good luck! We'll track this for you." : "You can apply later from your History page.",
    });
  };

  // --- CV Editing Handlers ---
  const handleCvChange = (html: string) => {
    setCvState((prev) => ({ ...prev, current: html, isDirty: true }));
    debouncedSave(html, cvState.appliedSuggestions);
  };

  const applySuggestionToText = (text: string, original: string, suggested: string): string => {
    // Try to find and replace in plain text and HTML
    if (text.includes(original)) {
      return text.replace(original, suggested);
    }
    // If not found exactly, append to end with a marker
    return text;
  };

  const handleApplySuggestion = (index: number) => {
    if (!result) return;
    const s = result.cvSuggestions[index];
    setCvState((prev) => {
      const newCurrent = applySuggestionToText(prev.current, s.original, s.suggested);
      const newApplied = [...prev.appliedSuggestions, index];
      debouncedSave(newCurrent, newApplied);
      return { ...prev, current: newCurrent, appliedSuggestions: newApplied, isDirty: true };
    });
    toast({ title: "✓ Applied", description: `Updated "${s.section}"` });
  };

  const handleDismissSuggestion = (index: number) => {
    setCvState((prev) => ({
      ...prev,
      dismissedSuggestions: [...prev.dismissedSuggestions, index],
    }));
  };

  const handleUndoSuggestion = (index: number) => {
    if (!result) return;
    const s = result.cvSuggestions[index];
    setCvState((prev) => {
      const newCurrent = applySuggestionToText(prev.current, s.suggested, s.original);
      const newApplied = prev.appliedSuggestions.filter((i) => i !== index);
      debouncedSave(newCurrent, newApplied);
      return { ...prev, current: newCurrent, appliedSuggestions: newApplied, isDirty: true };
    });
  };

  const handleApplyAllSuggestions = () => {
    if (!result) return;
    setCvState((prev) => {
      let newCurrent = prev.current;
      const newApplied = [...prev.appliedSuggestions];
      result.cvSuggestions.forEach((s, i) => {
        if (!newApplied.includes(i) && !prev.dismissedSuggestions.includes(i)) {
          newCurrent = applySuggestionToText(newCurrent, s.original, s.suggested);
          newApplied.push(i);
        }
      });
      debouncedSave(newCurrent, newApplied);
      return { ...prev, current: newCurrent, appliedSuggestions: newApplied, isDirty: true };
    });
    toast({ title: "Applied all suggestions!" });
  };

  const handleApplyHighPriority = () => {
    if (!result) return;
    let count = 0;
    setCvState((prev) => {
      let newCurrent = prev.current;
      const newApplied = [...prev.appliedSuggestions];
      result.cvSuggestions.forEach((s, i) => {
        if (s.priority === "high" && !newApplied.includes(i) && !prev.dismissedSuggestions.includes(i)) {
          newCurrent = applySuggestionToText(newCurrent, s.original, s.suggested);
          newApplied.push(i);
          count++;
        }
      });
      debouncedSave(newCurrent, newApplied);
      return { ...prev, current: newCurrent, appliedSuggestions: newApplied, isDirty: true };
    });
    toast({ title: `Applied ${count} high priority improvements` });
  };

  const handleResetCv = () => {
    setCvState((prev) => ({
      ...prev,
      current: prev.original,
      appliedSuggestions: [],
      dismissedSuggestions: [],
      isDirty: true,
    }));
    debouncedSave(cvState.original, []);
    toast({ title: "CV reset to original" });
  };

  const handleSubmit = async (cvContent: string, jobDescription: string, tone: Tone) => {
    setLoading(true);
    setResult(null);
    downloadCountRef.current = 0;
    lastAppIdRef.current = null;

    // Initialize CV state with uploaded content
    setCvState({
      original: cvContent,
      current: cvContent,
      appliedSuggestions: [],
      dismissedSuggestions: [],
      isDirty: false,
    });

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

      const firstLine = jobDescription.split(/\n/)[0]?.trim() || "";
      const dashMatch = firstLine.match(/^(.+?)\s*[—–]\s*(.+)$/);
      const jobTitle = (dashMatch?.[1]?.trim() || firstLine).slice(0, 100) || "Untitled Position";
      const company = dashMatch?.[2]?.trim().slice(0, 100) || "Unknown Company";
      setLastJobTitle(jobTitle);
      setLastCompany(company);

      const { data: inserted } = await supabase.from("applications").insert({
        user_id: user.id,
        job_title: jobTitle,
        company: company,
        cv_content: cvContent,
        job_description: jobDescription,
        tone,
        current_cv: cvContent,
        applied_suggestions: [],
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
      } as any).select("id").single();

      if (inserted) lastAppIdRef.current = inserted.id;

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
        <InputSection onSubmit={handleSubmit} onClear={() => { setResult(null); downloadCountRef.current = 0; }} loading={loading} loadingMessage={loadingMessage} />
        {loading && loadingProgress > 0 && (
          <div className="space-y-2">
            <Progress value={loadingProgress} className="h-2" />
            <p className="text-xs text-muted-foreground text-center">
              Step {Math.ceil(loadingProgress / 20)} of 5
            </p>
          </div>
        )}
        {result && (
          <ResultsSection
            result={result}
            jobTitle={lastJobTitle}
            onDownload={handleDownload}
            originalCv={cvState.original}
            currentCv={cvState.current}
            onCvChange={handleCvChange}
            onApplySuggestion={handleApplySuggestion}
            onDismissSuggestion={handleDismissSuggestion}
            onUndoSuggestion={handleUndoSuggestion}
            onApplyAllSuggestions={handleApplyAllSuggestions}
            onApplyHighPriority={handleApplyHighPriority}
            onResetCv={handleResetCv}
            appliedSuggestions={cvState.appliedSuggestions}
            dismissedSuggestions={cvState.dismissedSuggestions}
            saveStatus={saveStatus}
          />
        )}
      </main>

      <ApplicationTrackingModal
        open={showTrackingModal}
        onClose={() => setShowTrackingModal(false)}
        onSave={handleTrackingSave}
        jobTitle={lastJobTitle}
        company={lastCompany}
      />
    </div>
  );
};

export default Index;
