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

  // Sync preParsedModel into editor state whenever it's set (from CV upload)
  useEffect(() => {
    if (preParsedModel) {
      setCvModel(preParsedModel);
      setOriginalCvModel(preParsedModel);
      setIsDirty(false);
    }
  }, [preParsedModel]);

  // Suggestion tracking
  const [appliedSuggestions, setAppliedSuggestions] = useState<number[]>([]);
  const [dismissedSuggestions, setDismissedSuggestions] = useState<number[]>([]);
  // Track keyword bullet texts for duplicate detection (Bug 5)
  const appliedKeywordBulletsRef = useRef<string[]>([]);
  // Persistent added keywords set — survives tab switches, reset only on Reset/new CV
  const [addedKeywords, setAddedKeywords] = useState<Set<string>>(new Set());

  // Undo stack: stores snapshots of the model before each change
  const undoStackRef = useRef<CvDataModel[]>([]);
  // BUG 5: Track which bullets have been replaced by keyword additions
  const replacedBulletsRef = useRef<Set<string>>(new Set());

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
      setAddedKeywords(new Set());
      replacedBulletsRef.current = new Set();
      appliedKeywordBulletsRef.current = [];
      setIsDirty(true);
      debouncedSave(originalCvModel, []);
      toast({ title: "CV reset to original" });
    }
  };

  // --- Suggestion handlers (opt-in only) ---
  const applySuggestionToModel = (model: CvDataModel, original: string, suggested: string, sectionHint?: string): CvDataModel => {
    const clone: CvDataModel = JSON.parse(JSON.stringify(model));
    const hint = (sectionHint || '').toLowerCase();
    const matchPrefix = original.slice(0, 60).toLowerCase();
    const shortPrefix = original.replace(/\.{3,}$/, '').slice(0, 40).toLowerCase();
    const fuzzyMatch = (text: string) => {
      const lower = text.toLowerCase();
      return lower.includes(matchPrefix) || lower.includes(shortPrefix);
    };

    // BUG 3: If section hint targets summary/profile, bypass fuzzy match
    if (hint.includes('summary') || hint.includes('profile')) {
      clone.summary = suggested;
      return clone;
    }

    // BUG 1: If section hint targets skills, replace directly
    if (hint.includes('skill')) {
      clone.skills = suggested;
      return clone;
    }

    // Check summary (fuzzy fallback)
    if (clone.summary && fuzzyMatch(clone.summary)) {
      clone.summary = clone.summary.replace(original, suggested);
      return clone;
    }

    // Check experience bullets — find by partial match, splice in-place
    for (const exp of clone.experience) {
      for (let j = 0; j < exp.bullets.length; j++) {
        if (fuzzyMatch(exp.bullets[j])) {
          exp.bullets.splice(j, 1, suggested);
          return clone;
        }
      }
      // BUG 2: Strip parenthesized portion before building match prefix for role
      const roleOnly = exp.role.replace(/\s*\(.*$/, '').toLowerCase();
      const origRoleOnly = original.replace(/\s*\(.*$/, '').slice(0, 60).toLowerCase();
      if (roleOnly.includes(origRoleOnly) || exp.role.toLowerCase().includes(matchPrefix)) {
        const datePattern = /\s+(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{4}\s*[-–—].*$/i;
        const datePattern2 = /\s+\d{4}\s*[-–—]\s*(?:present|\d{4}).*$/i;
        let cleanRole = suggested.replace(datePattern, '').replace(datePattern2, '').trim();
        const dashParts = cleanRole.split(/\s*[—–]\s*/);
        if (dashParts.length > 1 && exp.company && dashParts[dashParts.length - 1].toLowerCase().includes(exp.company.toLowerCase())) {
          cleanRole = dashParts.slice(0, -1).join(' — ').trim();
        }
        // BUG 3 (issue 3): Strip parenthesized company from role if company already stored separately
        if (exp.company) {
          cleanRole = cleanRole.replace(/\s*\([^)]*\)\s*$/, '').trim();
        }
        exp.role = cleanRole;
        return clone;
      }
    }

    // Check skills — replace entirely (fuzzy fallback)
    if (clone.skills && fuzzyMatch(clone.skills)) {
      clone.skills = suggested;
      return clone;
    }

    // Check education
    for (const edu of clone.education) {
      if (fuzzyMatch(edu.degree)) { edu.degree = suggested; return clone; }
      if (fuzzyMatch(edu.coursework)) { edu.coursework = suggested; return clone; }
    }

    // Check projects
    for (const proj of clone.projects) {
      for (let j = 0; j < proj.bullets.length; j++) {
        if (fuzzyMatch(proj.bullets[j])) {
          proj.bullets.splice(j, 1, suggested);
          return clone;
        }
      }
    }

    // Fallback: no match found — do not mutate
    console.warn("Suggestion match not found, returning CV unchanged. Original:", matchPrefix);
    return clone;
  };

  const handleApplySuggestion = (index: number) => {
    if (!result || !cvModel) return;
    const s = result.cvSuggestions[index];
    undoStackRef.current = [...undoStackRef.current.slice(-19), cvModel];
    const newModel = applySuggestionToModel(cvModel, s.original, s.suggested, s.section);
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
    const newModel = applySuggestionToModel(cvModel, s.suggested, s.original, s.section);
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
        model = applySuggestionToModel(model, s.original, s.suggested, s.section);
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

  // --- Add keyword bullet to CV model ---
  const handleAddKeywordBullet = (keyword: string, bullet: string, sectionHint: string) => {
    if (!cvModel) return;
    undoStackRef.current = [...undoStackRef.current.slice(-19), cvModel];
    const clone: CvDataModel = JSON.parse(JSON.stringify(cvModel));
    const kwWords = keyword.toLowerCase().split(/\s+/);
    const bulletLen = bullet.length;

    // Score each bullet: word overlap + length similarity, deprioritize bullets containing the keyword
    let bestScore = -Infinity;
    let bestExpIdx = -1;
    let bestBulletIdx = -1;
    let bestBulletKey = '';

    for (let ei = 0; ei < clone.experience.length; ei++) {
      const exp = clone.experience[ei];
      for (let bi = 0; bi < exp.bullets.length; bi++) {
        const bulletKey = `${ei}:${bi}:${exp.bullets[bi].slice(0, 50)}`;
        // BUG 5: Skip bullets already replaced by a previous keyword addition
        if (replacedBulletsRef.current.has(bulletKey)) continue;

        const bulletText = exp.bullets[bi];
        const bulletLower = bulletText.toLowerCase();
        const bulletWords = bulletLower.split(/\s+/);

        // Word overlap score
        const overlap = kwWords.filter(w => bulletWords.some(bw => bw.includes(w) || w.includes(bw))).length;

        // Length similarity score (0-1, higher is better)
        const lenSimilarity = 1 - Math.abs(bulletText.length - bulletLen) / Math.max(bulletText.length, bulletLen, 1);

        // Deprioritize bullets that already contain the keyword (BUG 2 fix)
        const alreadyHasKeyword = bulletLower.includes(keyword.toLowerCase()) ? -3 : 0;

        const score = overlap + lenSimilarity + alreadyHasKeyword;
        if (score > bestScore) {
          bestScore = score;
          bestExpIdx = ei;
          bestBulletIdx = bi;
          bestBulletKey = bulletKey;
        }
      }
    }

    // Issue 6: Before inserting, check for >60% word overlap with existing bullets to replace instead of append
    const bulletWords = bullet.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const wordOverlapCheck = (existing: string): number => {
      const existingWords = new Set(existing.toLowerCase().split(/\s+/).filter(w => w.length > 3));
      if (bulletWords.length === 0) return 0;
      return bulletWords.filter(w => existingWords.has(w)).length / bulletWords.length;
    };

    if (bestExpIdx >= 0 && bestBulletIdx >= 0) {
      clone.experience[bestExpIdx].bullets[bestBulletIdx] = bullet;
      replacedBulletsRef.current = new Set(replacedBulletsRef.current).add(bestBulletKey);
    } else {
      // No best match from scoring — check all bullets for >60% overlap before appending
      let foundOverlap = false;
      for (const exp of clone.experience) {
        for (let bi = 0; bi < exp.bullets.length; bi++) {
          if (wordOverlapCheck(exp.bullets[bi]) > 0.6) {
            exp.bullets[bi] = bullet;
            foundOverlap = true;
            break;
          }
        }
        if (foundOverlap) break;
      }
      if (!foundOverlap) {
        if (clone.experience.length > 0) {
          clone.experience[0].bullets.push(bullet);
        } else {
          clone.summary = clone.summary ? `${clone.summary} ${bullet}` : bullet;
        }
      }
    }

    // Track keyword bullet text for duplicate detection (Bug 5)
    appliedKeywordBulletsRef.current = [...appliedKeywordBulletsRef.current, bullet];

    // Atomically update addedKeywords AND cvModel together
    setAddedKeywords((prev) => new Set(prev).add(keyword.toLowerCase()));
    setCvModel(clone);
    setIsDirty(true);
    debouncedSave(clone, appliedSuggestions);
  };

  // --- Submit ---
  const handleSubmit = async (cvContent: string, jobDescription: string) => {
    setLoading(true);
    setResult(null);
    downloadCountRef.current = 0;
    lastAppIdRef.current = null;
    setAppliedSuggestions([]);
    setDismissedSuggestions([]);
    setAddedKeywords(new Set());
    replacedBulletsRef.current = new Set();
    appliedKeywordBulletsRef.current = [];
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
            onAddKeywordBullet={handleAddKeywordBullet}
            appliedKeywordBullets={appliedKeywordBulletsRef.current}
            addedKeywords={addedKeywords}
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
