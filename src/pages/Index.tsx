import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import Header from "@/components/Header";
import InputSection from "@/components/InputSection";
import ResultsSection from "@/components/ResultsSection";
import ApplicationTrackingModal from "@/components/ApplicationTrackingModal";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import type { TailorResult } from "@/lib/types";
import { parseCvToModel, cvModelToPlainText, aiParsedCvToModel } from "@/lib/cvDataModel";
import type { CvDataModel } from "@/lib/cvDataModel";

const LOADING_STEPS = [
  { message: "Analyzing job requirements...", progress: 15 },
  { message: "Checking ATS compatibility...", progress: 35 },
  { message: "Tailoring your CV suggestions...", progress: 55 },
  { message: "Generating 3 cover letter versions...", progress: 75 },
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
  const [lastCompany, setLastCompany] = useState("Unknown Company");
  const [lastJobDescription, setLastJobDescription] = useState("");
  const [showTrackingModal, setShowTrackingModal] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  // CV data model state
  const [cvModel, setCvModel] = useState<CvDataModel | null>(null);
  const [originalCvModel, setOriginalCvModel] = useState<CvDataModel | null>(null);
  const [preParsedModel, setPreParsedModel] = useState<CvDataModel | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // Suggestion tracking
  const [appliedSuggestions, setAppliedSuggestions] = useState<number[]>([]);
  const [dismissedSuggestions, setDismissedSuggestions] = useState<number[]>([]);

  // Undo stack: stores snapshots of the model before each change
  const undoStackRef = useRef<CvDataModel[]>([]);

  const lastAppIdRef = useRef<string | null>(null);
  const downloadCountRef = useRef(0);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { toast } = useToast();

  // --- Autosave ---
  const saveCvToDb = useCallback(async (model: CvDataModel, applied: number[]) => {
    if (!lastAppIdRef.current) return;
    setSaveStatus("saving");
    try {
      const plainText = cvModelToPlainText(model);
      await supabase.from("applications").update({
        current_cv: plainText, applied_suggestions: applied, last_edited: new Date().toISOString(),
      } as any).eq("id", lastAppIdRef.current);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch { setSaveStatus("error"); }
  }, []);

  const debouncedSave = useCallback((model: CvDataModel, applied: number[]) => {
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => saveCvToDb(model, applied), 3000);
  }, [saveCvToDb]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => { if (isDirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;

  // --- Download / Tracking ---
  const handleDownload = () => {
    downloadCountRef.current += 1;
    if (downloadCountRef.current === 1) setShowTrackingModal(true);
  };

  const handleTrackingSave = async (data: { status: string; applicationMethod?: string; appliedDate?: string; followUpDate?: string | null; }) => {
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

  // --- CV Model Editing (manual edits push undo) ---
  const handleCvModelChange = (model: CvDataModel) => {
    if (cvModel) {
      undoStackRef.current = [...undoStackRef.current.slice(-19), cvModel];
    }
    setCvModel(model);
    setIsDirty(true);
    debouncedSave(model, appliedSuggestions);
  };

  const handleUndo = () => {
    const stack = undoStackRef.current;
    if (stack.length === 0) return;
    const prev = stack[stack.length - 1];
    undoStackRef.current = stack.slice(0, -1);
    setCvModel(prev);
    setIsDirty(true);
    debouncedSave(prev, appliedSuggestions);
    toast({ title: "Undone" });
  };

  const handleResetCv = () => {
    if (originalCvModel && cvModel) {
      undoStackRef.current = [...undoStackRef.current.slice(-19), cvModel];
      setCvModel({ ...originalCvModel });
      setAppliedSuggestions([]);
      setDismissedSuggestions([]);
      setIsDirty(true);
      debouncedSave(originalCvModel, []);
      toast({ title: "CV reset to original" });
    }
  };

  // --- Suggestion handlers (opt-in only) ---
  const applySuggestionToModel = (model: CvDataModel, original: string, suggested: string): CvDataModel => {
    const plainText = cvModelToPlainText(model);
    // Try to find which field contains the original text and replace it
    const clone: CvDataModel = JSON.parse(JSON.stringify(model));

    // Check summary
    if (clone.summary.includes(original)) {
      clone.summary = clone.summary.replace(original, suggested);
      return clone;
    }

    // Check experience bullets
    for (const exp of clone.experience) {
      for (let j = 0; j < exp.bullets.length; j++) {
        if (exp.bullets[j].includes(original)) {
          exp.bullets[j] = exp.bullets[j].replace(original, suggested);
          return clone;
        }
      }
      // Check role/company
      if (exp.role.includes(original)) { exp.role = exp.role.replace(original, suggested); return clone; }
    }

    // Check skills
    if (clone.skills.includes(original)) {
      clone.skills = clone.skills.replace(original, suggested);
      return clone;
    }

    // Check education
    for (const edu of clone.education) {
      if (edu.degree.includes(original)) { edu.degree = edu.degree.replace(original, suggested); return clone; }
      if (edu.coursework.includes(original)) { edu.coursework = edu.coursework.replace(original, suggested); return clone; }
    }

    // Check projects
    for (const proj of clone.projects) {
      for (let j = 0; j < proj.bullets.length; j++) {
        if (proj.bullets[j].includes(original)) {
          proj.bullets[j] = proj.bullets[j].replace(original, suggested);
          return clone;
        }
      }
    }

    // Fuzzy: case-insensitive match across plain text
    const lowerOriginal = original.toLowerCase();
    // Try experience bullets fuzzy
    for (const exp of clone.experience) {
      for (let j = 0; j < exp.bullets.length; j++) {
        if (exp.bullets[j].toLowerCase().includes(lowerOriginal)) {
          const idx = exp.bullets[j].toLowerCase().indexOf(lowerOriginal);
          exp.bullets[j] = exp.bullets[j].slice(0, idx) + suggested + exp.bullets[j].slice(idx + original.length);
          return clone;
        }
      }
    }

    // Fallback: append as a new bullet in the first experience entry
    if (clone.experience.length > 0) {
      clone.experience[0].bullets.push(suggested);
    } else {
      clone.summary = clone.summary + " " + suggested;
    }
    return clone;
  };

  const handleApplySuggestion = (index: number) => {
    if (!result || !cvModel) return;
    const s = result.cvSuggestions[index];
    undoStackRef.current = [...undoStackRef.current.slice(-19), cvModel];
    const newModel = applySuggestionToModel(cvModel, s.original, s.suggested);
    const newApplied = [...appliedSuggestions, index];
    setCvModel(newModel);
    setAppliedSuggestions(newApplied);
    setIsDirty(true);
    debouncedSave(newModel, newApplied);
    toast({ title: "✓ Applied", description: `Updated "${s.section}"` });
  };

  const handleDismissSuggestion = (index: number) => {
    setDismissedSuggestions((prev) => [...prev, index]);
  };

  const handleUndoSuggestion = (index: number) => {
    if (!result || !cvModel) return;
    const s = result.cvSuggestions[index];
    undoStackRef.current = [...undoStackRef.current.slice(-19), cvModel];
    const newModel = applySuggestionToModel(cvModel, s.suggested, s.original);
    const newApplied = appliedSuggestions.filter((i) => i !== index);
    setCvModel(newModel);
    setAppliedSuggestions(newApplied);
    setIsDirty(true);
    debouncedSave(newModel, newApplied);
    toast({ title: "Suggestion undone" });
  };

  const handleApplyHighPriority = () => {
    if (!result || !cvModel) return;
    undoStackRef.current = [...undoStackRef.current.slice(-19), cvModel];
    let model = cvModel;
    const newApplied = [...appliedSuggestions];
    let count = 0;
    result.cvSuggestions.forEach((s, i) => {
      if (s.priority === "high" && !newApplied.includes(i) && !dismissedSuggestions.includes(i)) {
        model = applySuggestionToModel(model, s.original, s.suggested);
        newApplied.push(i);
        count++;
      }
    });
    setCvModel(model);
    setAppliedSuggestions(newApplied);
    setIsDirty(true);
    debouncedSave(model, newApplied);
    toast({ title: `Applied ${count} high-priority suggestion${count !== 1 ? "s" : ""}` });
  };

  // --- Submit ---
  const handleSubmit = async (cvContent: string, jobDescription: string) => {
    setLoading(true);
    setResult(null);
    downloadCountRef.current = 0;
    lastAppIdRef.current = null;
    setAppliedSuggestions([]);
    setDismissedSuggestions([]);
    undoStackRef.current = [];

    // Use AI-parsed model if available, otherwise fall back to local parser
    const parsed = preParsedModel || parseCvToModel(cvContent);
    setCvModel(parsed);
    setOriginalCvModel(parsed);
    setPreParsedModel(null); // consumed
    setIsDirty(false);

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
        body: { cvContent, jobDescription, tone: "professional" },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);

      // Store result with suggestions — but do NOT apply them to the model
      setResult(data);

      const firstLine = jobDescription.split(/\n/)[0]?.trim() || "";
      const dashMatch = firstLine.match(/^(.+?)\s*[—–]\s*(.+)$/);
      const jobTitle = (dashMatch?.[1]?.trim() || firstLine).slice(0, 100) || "Untitled Position";
      const company = dashMatch?.[2]?.trim().slice(0, 100) || "Unknown Company";
      setLastJobTitle(jobTitle);
      setLastCompany(company);
      setLastJobDescription(jobDescription);

      const { data: inserted } = await supabase.from("applications").insert({
        user_id: user.id, job_title: jobTitle, company, cv_content: cvContent,
        job_description: jobDescription, tone: "professional", current_cv: cvContent, applied_suggestions: [],
        key_requirements: data.keyRequirements, cv_suggestions: data.cvSuggestions,
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
      toast({ title: "Error", description: error.message || "Something went wrong", variant: "destructive" });
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
      <main className="mx-auto px-4 py-8 max-w-[1200px] space-y-10">
        <InputSection
          onSubmit={handleSubmit}
          onClear={() => { setResult(null); downloadCountRef.current = 0; }}
          onCvParsed={(model) => setPreParsedModel(model)}
          loading={loading}
          loadingMessage={loadingMessage}
        />
        {loading && loadingProgress > 0 && (
          <div className="space-y-2">
            <Progress value={loadingProgress} className="h-2" />
            <p className="text-xs text-muted-foreground text-center">
              Step {Math.ceil(loadingProgress / 20)} of 5
            </p>
          </div>
        )}
        {result && cvModel && (
          <ResultsSection
            result={result}
            jobTitle={lastJobTitle}
            jobDescription={lastJobDescription}
            onDownload={handleDownload}
            cvModel={cvModel}
            onCvModelChange={handleCvModelChange}
            onResetCv={handleResetCv}
            onUndo={handleUndo}
            canUndo={undoStackRef.current.length > 0}
            saveStatus={saveStatus}
            appliedSuggestions={appliedSuggestions}
            dismissedSuggestions={dismissedSuggestions}
            onApplySuggestion={handleApplySuggestion}
            onDismissSuggestion={handleDismissSuggestion}
            onUndoSuggestion={handleUndoSuggestion}
            onApplyHighPriority={handleApplyHighPriority}
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
