import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import Header from "@/components/Header";
import InputSection from "@/components/InputSection";
import ResultsSection from "@/components/ResultsSection";
import CampaignBanner from "@/components/CampaignBanner";
import AlignmentBanner from "@/components/AlignmentBanner";
import ApplicationTrackingModal from "@/components/ApplicationTrackingModal";
import { supabase } from "@/integrations/supabase/client";
import { getAuthHeader } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkles, ArrowRight, Lightbulb, Link2, Check } from "lucide-react";
import type { TailorResult } from "@/lib/types";
import { parseCvToModel, cvModelToPlainText, aiParsedCvToModel } from "@/lib/cvDataModel";
import type { CvDataModel } from "@/lib/cvDataModel";
import { calculateAtsScore } from "@/lib/atsScore";
import { ToastAction } from "@/components/ui/toast";

const LOADING_STEPS = [
  { message: "Analyzing job requirements...", progress: 15 },
  { message: "Checking job match compatibility...", progress: 35 },
  { message: "Tailoring your CV suggestions...", progress: 55 },
  { message: "Generating your cover letter...", progress: 75 },
  { message: "Polishing results...", progress: 95 },
];

const TARGET_KEY = "preplane_onboarding_target";
const ONBOARDING_KEY = "preplane_onboarding_done";

const Index = () => {
  const { user, loading: authLoading } = useAuth();
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [targetRole, setTargetRole] = useState<string | null>(null);
  const [targetLocation, setTargetLocation] = useState<string | null>(null);
  const [alignmentData, setAlignmentData] = useState<{ alignment: "strong" | "partial" | "weak"; reason: string; targetRole: string } | null>(null);

  // --- Setup phase state ---
  const initialPhase = searchParams.get("phase") === "cv_tailoring" ? "cv_tailoring" as const : "input" as const;
  const [setupPhase, setSetupPhase] = useState<'input' | 'brief' | 'cv_tailoring'>(initialPhase);
  const [setupRole, setSetupRole] = useState(searchParams.get("role") || "");
  const [setupCompany, setSetupCompany] = useState(searchParams.get("company") || "");
  const [setupJd, setSetupJd] = useState(searchParams.get("jd") || "");
  const [proofBrief, setProofBrief] = useState<any>(null);
  const [generatingBrief, setGeneratingBrief] = useState(false);
  const [jdExtractingUrl, setJdExtractingUrl] = useState(false);

  // Check onboarding status and save any pending target from onboarding
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      nav("/onboarding", { replace: true });
      return;
    }
    const savedTarget = localStorage.getItem(TARGET_KEY);

    supabase
      .from("profiles")
      .select("onboarding_completed, target_role, target_location")
      .eq("user_id", user.id)
      .single()
      .then(async ({ data }) => {
        const d = data as any;
        // Save pending onboarding target if exists
        if (savedTarget) {
          try {
            const target = JSON.parse(savedTarget);
            await supabase
              .from("profiles")
              .update({
                target_role: target.target_role || null,
                target_location: target.target_location || null,
                target_start: target.target_start || null,
                onboarding_completed: true,
              } as any)
              .eq("user_id", user.id);
            localStorage.removeItem(TARGET_KEY);
            localStorage.removeItem(ONBOARDING_KEY);
            setTargetRole(target.target_role || null);
            setTargetLocation(target.target_location || null);
            setOnboardingChecked(true);
          } catch {
            localStorage.removeItem(TARGET_KEY);
            setOnboardingChecked(true);
          }
        } else if (d && !d.onboarding_completed) {
          nav("/onboarding", { replace: true });
        } else {
          if (d?.target_role) setTargetRole(d.target_role);
          if (d?.target_location) setTargetLocation(d.target_location);
          setOnboardingChecked(true);
        }
      });
  }, [user, authLoading, nav]);
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

  // Ref to always hold the latest cvModel (fixes stale closure bug)
  const cvModelRef = useRef<CvDataModel | null>(null);
  useEffect(() => { cvModelRef.current = cvModel; }, [cvModel]);

  // Pre-fill setup role from profile target
  useEffect(() => {
    if (targetRole && !setupRole) setSetupRole(targetRole);
  }, [targetRole]);

  // Detect if JD text looks like a URL
  const jdLooksLikeUrl = /^https?:\/\/\S+$/i.test(setupJd.trim());

  const handleExtractJdUrl = async () => {
    if (!setupJd.trim()) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast({ title: "Your session expired. Please sign in again.", variant: "destructive" });
      nav("/onboarding");
      return;
    }

    setJdExtractingUrl(true);
    try {
      const { data, error } = await supabase.functions.invoke("extract-jd-from-url", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { url: setupJd.trim() },
      });
      if (error) throw error;
      if (data?.jobDescription) {
        setSetupJd(data.jobDescription);
        toast({ title: "Job description extracted!" });
      } else {
        toast({ title: "Couldn't extract", description: "Try pasting the JD manually.", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Extraction failed", description: err.message, variant: "destructive" });
    } finally {
      setJdExtractingUrl(false);
    }
  };

  const generateProofBrief = async () => {
    if (!setupRole.trim()) {
      toast({ title: "Please enter a target role", variant: "destructive" });
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast({ title: "Your session expired. Please sign in again.", variant: "destructive" });
      nav("/onboarding");
      return;
    }

    setGeneratingBrief(true);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-campaign-content`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          contentType: "proof_of_work",
          company: setupCompany.trim() || "a company in this space",
          role: setupRole.trim(),
          jdText: setupJd.trim() || undefined,
        }),
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          toast({ title: "Session expired — please sign in again", variant: "destructive" });
          nav("/onboarding");
          return;
        } else if (response.status === 429) {
          toast({ title: "You have reached your daily limit for proof of work generation. Come back tomorrow.", variant: "destructive" });
          return;
        } else if (response.status === 500) {
          toast({ title: "Something went wrong on our end. Please try again in a moment.", variant: "destructive" });
          return;
        }
        toast({ title: "Generation failed — please try again.", variant: "destructive" });
        return;
      }

      const data = await response.json();
      if (data?.error) throw new Error(data.error);
      setProofBrief(data);
      setSetupPhase('brief');
    } catch (e: any) {
      toast({ title: "Generation failed", description: e.message, variant: "destructive" });
    } finally {
      setGeneratingBrief(false);
    }
  };

  const handleStartBuilding = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("campaigns")
        .insert({
          user_id: user.id,
          company: setupCompany.trim() || "General",
          role: setupRole.trim(),
          jd_text: setupJd.trim() || "",
          proof_suggestion: JSON.stringify(proofBrief),
          proof_in_progress: true,
          status: "targeting",
        } as any)
        .select("id")
        .single();
      if (error) {
        if (error.message?.includes("10 active campaigns")) {
          toast({ title: "Campaign limit reached", description: "Complete or archive one first.", variant: "destructive" });
        } else throw error;
        return;
      }
      toast({ title: "Campaign created! Start building your proof of work." });
      nav("/app");
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

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
    const matchPrefix = original.replace(/\.{3,}$/, '').slice(0, 60).toLowerCase();
    const shortPrefix = original.replace(/\.{3,}$/, '').slice(0, 40).toLowerCase();
    const veryShortPrefix = original.replace(/\.{3,}$/, '').slice(0, 30).toLowerCase();
    const fuzzyMatch = (text: string) => {
      const lower = text.replace(/\.{3,}$/, '').toLowerCase();
      return lower.includes(matchPrefix) || lower.includes(shortPrefix) || lower.includes(veryShortPrefix);
    };


    // STEP 5: If section hint targets summary/profile, bypass fuzzy match
    if (hint.includes('summary') || hint.includes('profile')) {
      clone.summary = suggested;
      return clone;
    }

    // STEP 5: If section hint targets skills, replace only the matching subsection
    if (hint.includes('skill')) {
      
      // Split skills into lines and find which line the original matches
      const skillLines = clone.skills.split('\n');
      const origLower = original.replace(/\.{3,}$/, '').toLowerCase().trim();
      const origPrefix = origLower.slice(0, 30);
      let matchedLineIdx = -1;
      for (let li = 0; li < skillLines.length; li++) {
        const lineLower = skillLines[li].toLowerCase().trim();
        if (lineLower && (lineLower.includes(origPrefix) || origLower.includes(lineLower.slice(0, 30)))) {
          matchedLineIdx = li;
          break;
        }
      }
      if (matchedLineIdx >= 0 && skillLines.length > 1) {
        // Replace only the matched line, preserve all others
        
        skillLines[matchedLineIdx] = suggested;
        clone.skills = skillLines.join('\n');
      } else {
        // Single line or no match — replace entirely
        clone.skills = suggested;
      }
      return clone;
    }

    // STEP 4: If section hint targets education, bypass fuzzy match
    if (hint.includes('education') || hint.includes('coursework') || hint.includes('degree')) {
      for (const edu of clone.education) {
        if (hint.includes('coursework') || hint.includes('relevant')) {
          
          edu.coursework = suggested;
          return clone;
        }
        if (hint.includes('degree')) {
          
          edu.degree = suggested;
          return clone;
        }
        // Generic education hint — try coursework first, then degree
        if (edu.coursework && fuzzyMatch(edu.coursework)) {
          
          edu.coursework = suggested;
          return clone;
        }
        if (edu.degree && fuzzyMatch(edu.degree)) {
          
          edu.degree = suggested;
          return clone;
        }
      }
      // If we have education hint but couldn't match specific field, replace first education's coursework
      if (clone.education.length > 0) {
        
        clone.education[0].coursework = suggested;
        return clone;
      }
    }

    // Check summary (fuzzy fallback)
    if (clone.summary && fuzzyMatch(clone.summary)) {
      clone.summary = suggested;
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
      // Strip parenthesized portion before building match prefix for role
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

    // Check education (fuzzy fallback)
    for (const edu of clone.education) {
      if (edu.degree && fuzzyMatch(edu.degree)) {
        
        edu.degree = suggested;
        return clone;
      }
      if (edu.coursework && fuzzyMatch(edu.coursework)) {
        
        edu.coursework = suggested;
        return clone;
      }
    }

    // Fallback: no match found — do not mutate
    
    return clone;
  };

  const handleApplySuggestion = (index: number) => {
    const currentModel = cvModelRef.current;
    if (!result || !currentModel) return;
    const s = result.cvSuggestions[index];

    // FIX 3: Calculate score before applying
    const aiKeywords = [...(result.atsAnalysis?.keywordsFound || []), ...(result.atsAnalysis?.keywordsMissing || [])];
    const jd = lastJobDescription || "";
    const scoreBefore = jd
      ? calculateAtsScore(cvModelToPlainText(currentModel), jd, aiKeywords).score
      : null;

    undoStackRef.current = [...undoStackRef.current.slice(-19), currentModel];
    const newModel = applySuggestionToModel(currentModel, s.original, s.suggested, s.section);
    const newApplied = [...appliedSuggestions, index];
    setCvModel(newModel);
    setAppliedSuggestions(newApplied);
    setIsDirty(true);
    debouncedSave(newModel, newApplied);

    // FIX 3: Check if score dropped and offer undo
    if (scoreBefore !== null && jd) {
      const scoreAfter = calculateAtsScore(cvModelToPlainText(newModel), jd, aiKeywords).score;
      if (scoreAfter < scoreBefore) {
        toast({
          title: `Score dropped from ${scoreBefore} to ${scoreAfter}`,
          description: "This suggestion reduced your keyword match. Undo?",
          action: (
            <ToastAction
              altText="Undo"
              onClick={() => {
                setCvModel(currentModel);
                setAppliedSuggestions(appliedSuggestions.filter((i) => i !== index));
                setIsDirty(true);
                debouncedSave(currentModel, appliedSuggestions.filter((i) => i !== index));
                toast({ title: "Change undone — score restored" });
              }}
            >
              Undo
            </ToastAction>
          ),
        });
        return;
      }
    }

    toast({ title: "✓ Applied", description: `Updated "${s.section}"` });
  };

  const handleDismissSuggestion = (index: number) => {
    setDismissedSuggestions((prev) => [...prev, index]);
  };

  const handleUndoSuggestion = (index: number) => {
    const currentModel = cvModelRef.current;
    if (!result || !currentModel) return;
    const s = result.cvSuggestions[index];
    undoStackRef.current = [...undoStackRef.current.slice(-19), currentModel];
    const newModel = applySuggestionToModel(currentModel, s.suggested, s.original, s.section);
    const newApplied = appliedSuggestions.filter((i) => i !== index);
    setCvModel(newModel);
    setAppliedSuggestions(newApplied);
    setIsDirty(true);
    debouncedSave(newModel, newApplied);
    toast({ title: "Suggestion undone" });
  };

  const handleApplyHighPriority = () => {
    const currentModel = cvModelRef.current;
    if (!result || !currentModel) return;
    undoStackRef.current = [...undoStackRef.current.slice(-19), currentModel];
    let model = currentModel;
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
    const hint = sectionHint.toLowerCase();

    // If the suggestion targets Skills, update the skills field directly
    if (hint.includes('skill')) {
      clone.skills = bullet;
      // Track keyword bullet text for duplicate detection (Bug 5)
      appliedKeywordBulletsRef.current = [...appliedKeywordBulletsRef.current, bullet];
      setAddedKeywords((prev) => new Set(prev).add(keyword.toLowerCase()));
      setCvModel(clone);
      setIsDirty(true);
      debouncedSave(clone, appliedSuggestions);
      return;
    }

    // BUG 1 FIX: Try to match sectionHint against company/role names first
    let hintMatchedExpIdx = -1;
    for (let ei = 0; ei < clone.experience.length; ei++) {
      const exp = clone.experience[ei];
      const companyLower = (exp.company || '').toLowerCase();
      const roleLower = (exp.role || '').toLowerCase();
      if (companyLower && hint.includes(companyLower)) {
        hintMatchedExpIdx = ei;
        break;
      }
      if (roleLower && hint.includes(roleLower)) {
        hintMatchedExpIdx = ei;
        break;
      }
      // Also check if hint words overlap significantly with company/role
      const hintWords = hint.split(/\s+/).filter(w => w.length > 2);
      const companyWords = companyLower.split(/\s+/).filter(w => w.length > 2);
      const roleWords = roleLower.split(/\s+/).filter(w => w.length > 2);
      const companyMatch = companyWords.length > 0 && companyWords.every(w => hintWords.some(hw => hw.includes(w)));
      const roleMatch = roleWords.length > 0 && roleWords.every(w => hintWords.some(hw => hw.includes(w)));
      if (companyMatch || roleMatch) {
        hintMatchedExpIdx = ei;
        break;
      }
    }

    // BUG 3 FIX: Duplicate phrase detection helper (4-word window + number/percentage check)
    const findDuplicatePhrase = (newBullet: string, existingBullets: string[]): string | null => {
      const newWords = newBullet.toLowerCase().split(/\s+/);
      for (const existing of existingBullets) {
        const existingWords = existing.toLowerCase().split(/\s+/);
        const existingText = existingWords.join(' ');
        // Check all 4-word windows in the new bullet against existing
        for (let i = 0; i <= newWords.length - 4; i++) {
          const phrase = newWords.slice(i, i + 4).join(' ');
          if (existingText.includes(phrase)) {
            return phrase;
          }
        }
      }
      // Check for repeated numbers/percentages (e.g. "47%", "$95k", "200+")
      const newMetrics = newBullet.match(/\$?\d[\d,.]*[%kKmMbB+]?/g) || [];
      for (const metric of newMetrics) {
        for (const existing of existingBullets) {
          if (existing.includes(metric)) {
            return metric;
          }
        }
      }
      return null;
    };

    // If sectionHint matched a specific experience entry, target it directly
    if (hintMatchedExpIdx >= 0) {
      const targetExp = clone.experience[hintMatchedExpIdx];
      
      // BUG 3: Check for duplicate phrases before inserting
      const dupPhrase = findDuplicatePhrase(bullet, targetExp.bullets);
      if (dupPhrase) {
        toast({
          title: "Generated bullet overlaps with existing content",
          description: `Duplicate phrase: "${dupPhrase}..." — try Regenerate.`,
          variant: "destructive",
        });
        return;
      }

      // Find best bullet to replace within this entry by word overlap
      const kwWords = keyword.toLowerCase().split(/\s+/);
      let bestBi = -1;
      let bestScore = -Infinity;
      let bestKey = '';
      for (let bi = 0; bi < targetExp.bullets.length; bi++) {
        const bulletKey = `${hintMatchedExpIdx}:${bi}:${targetExp.bullets[bi].slice(0, 50)}`;
        if (replacedBulletsRef.current.has(bulletKey)) continue;
        const bWords = targetExp.bullets[bi].toLowerCase().split(/\s+/);
        const overlap = kwWords.filter(w => bWords.some(bw => bw.includes(w) || w.includes(bw))).length;
        const lenSim = 1 - Math.abs(targetExp.bullets[bi].length - bullet.length) / Math.max(targetExp.bullets[bi].length, bullet.length, 1);
        const alreadyHas = targetExp.bullets[bi].toLowerCase().includes(keyword.toLowerCase()) ? -3 : 0;
        const score = overlap + lenSim + alreadyHas;
        if (score > bestScore) { bestScore = score; bestBi = bi; bestKey = bulletKey; }
      }
      if (bestBi >= 0) {
        targetExp.bullets[bestBi] = bullet;
        replacedBulletsRef.current = new Set(replacedBulletsRef.current).add(bestKey);
      } else {
        targetExp.bullets.push(bullet);
      }
    } else {
      // Fallback: original word-overlap scoring across all entries
      const kwWords = keyword.toLowerCase().split(/\s+/);
      const bulletLen = bullet.length;
      let bestScore = -Infinity;
      let bestExpIdx = -1;
      let bestBulletIdx = -1;
      let bestBulletKey = '';

      for (let ei = 0; ei < clone.experience.length; ei++) {
        const exp = clone.experience[ei];
        for (let bi = 0; bi < exp.bullets.length; bi++) {
          const bulletKey = `${ei}:${bi}:${exp.bullets[bi].slice(0, 50)}`;
          if (replacedBulletsRef.current.has(bulletKey)) continue;
          const bulletText = exp.bullets[bi];
          const bulletLower = bulletText.toLowerCase();
          const bulletWords = bulletLower.split(/\s+/);
          const overlap = kwWords.filter(w => bulletWords.some(bw => bw.includes(w) || w.includes(bw))).length;
          const lenSimilarity = 1 - Math.abs(bulletText.length - bulletLen) / Math.max(bulletText.length, bulletLen, 1);
          const alreadyHasKeyword = bulletLower.includes(keyword.toLowerCase()) ? -3 : 0;
          const score = overlap + lenSimilarity + alreadyHasKeyword;
          if (score > bestScore) {
            bestScore = score; bestExpIdx = ei; bestBulletIdx = bi; bestBulletKey = bulletKey;
          }
        }
      }

      // Determine target experience index for duplicate check
      const targetExpIdx = bestExpIdx >= 0 ? bestExpIdx : 0;
      if (clone.experience[targetExpIdx]) {
        // BUG 3: Check for duplicate phrases before inserting
        const otherBullets = clone.experience[targetExpIdx].bullets.filter((_, i) => i !== bestBulletIdx);
        const dupPhrase = findDuplicatePhrase(bullet, otherBullets);
        if (dupPhrase) {
          toast({
            title: "Generated bullet overlaps with existing content",
            description: `Duplicate phrase: "${dupPhrase}..." — try Regenerate.`,
            variant: "destructive",
          });
          return;
        }
      }

      if (bestExpIdx >= 0 && bestBulletIdx >= 0) {
        clone.experience[bestExpIdx].bullets[bestBulletIdx] = bullet;
        replacedBulletsRef.current = new Set(replacedBulletsRef.current).add(bestBulletKey);
      } else {
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
    setAlignmentData(null);
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
      // Session check before AI calls
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: "Your session expired. Please sign in again.", variant: "destructive" });
        clearInterval(interval);
        setLoading(false);
        nav("/onboarding");
        return;
      }
      const authHeaders = { Authorization: `Bearer ${session.access_token}` };

      // Fire alignment check in parallel (non-blocking)
      if (targetRole) {
        supabase.functions.invoke("check-alignment", {
          headers: authHeaders,
          body: { targetRole, jobDescription },
        }).then(({ data: alignData }) => {
          if (alignData && !alignData.skipped && alignData.alignment) {
            setAlignmentData(alignData);
          }
        }).catch(() => {});
      }

      const { data, error } = await supabase.functions.invoke("tailor-cv", {
        headers: authHeaders,
        body: { cvContent, jobDescription, tone: "professional" },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);

      // Store result with suggestions — but do NOT apply them to the model
      setResult(data);

      // Extract company and role from AI result or JD text
      const stripMd = (s: string) => s.replace(/\*+/g, '').trim();
      let jobTitle = "Untitled Position";
      let company = "Unknown Company";

      // Try AI result fields first
      if (data.company) company = stripMd(data.company);
      if (data.jobTitle || data.role) jobTitle = stripMd(data.jobTitle || data.role);

      // Fallback: parse from JD text lines
      if (company === "Unknown Company" || jobTitle === "Untitled Position") {
        const lines = jobDescription.split(/\n/).map(l => l.trim()).filter(Boolean);
        for (const line of lines) {
          const companyMatch = line.match(/^(?:\*{0,2})Company[:\s]+\*{0,2}\s*(.+)/i);
          if (companyMatch && company === "Unknown Company") {
            company = stripMd(companyMatch[1]);
          }
          const roleMatch = line.match(/^(?:\*{0,2})(?:Role|Title|Position)[:\s]+\*{0,2}\s*(.+)/i);
          if (roleMatch && jobTitle === "Untitled Position") {
            jobTitle = stripMd(roleMatch[1]);
          }
        }
        // Last fallback: first line dash pattern
        if (jobTitle === "Untitled Position" || company === "Unknown Company") {
          const firstLine = lines[0] || "";
          const dashMatch = firstLine.match(/^(.+?)\s*[—–-]\s*(.+)$/);
          if (dashMatch) {
            if (jobTitle === "Untitled Position") jobTitle = stripMd(dashMatch[1]).slice(0, 100);
            if (company === "Unknown Company") company = stripMd(dashMatch[2]).slice(0, 100);
          } else if (jobTitle === "Untitled Position") {
            jobTitle = stripMd(firstLine).slice(0, 100) || "Untitled Position";
          }
        }
      }

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

        {/* Phase 1: Setup — role, company, JD */}
        {setupPhase === 'input' && (
          <div className="max-w-[600px] mx-auto space-y-8">
            <div className="text-center space-y-2">
              <Lightbulb className="h-10 w-10 text-primary mx-auto" />
              <h1 className="text-[28px] font-bold tracking-tight">What role are you going after?</h1>
              <p className="text-muted-foreground text-sm">
                We'll generate a proof-of-work brief — a specific mini-project that shows you're the real deal.
              </p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Which role are you targeting?</label>
                <Input
                  value={setupRole}
                  onChange={(e) => setSetupRole(e.target.value)}
                  placeholder="e.g. VC Analyst Internship"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">
                  Company name{" "}
                  <span className="text-muted-foreground font-normal">(optional — leave blank for a general brief)</span>
                </label>
                <Input
                  value={setupCompany}
                  onChange={(e) => setSetupCompany(e.target.value)}
                  placeholder="e.g. Sequoia Capital"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">
                  Job description{" "}
                  <span className="text-muted-foreground font-normal">(optional but recommended)</span>
                </label>
                <Textarea
                  value={setupJd}
                  onChange={(e) => setSetupJd(e.target.value)}
                  placeholder="Paste the full job description or a job posting URL..."
                  rows={6}
                  className="mt-1"
                />
                {jdLooksLikeUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 text-xs"
                    onClick={handleExtractJdUrl}
                    disabled={jdExtractingUrl}
                  >
                    {jdExtractingUrl ? (
                      <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Extracting...</>
                    ) : (
                      <><Link2 className="h-3 w-3 mr-1" /> Extract job description from URL</>
                    )}
                  </Button>
                )}
              </div>
              <Button
                onClick={generateProofBrief}
                disabled={generatingBrief || !setupRole.trim()}
                size="lg"
                className="w-full font-semibold"
              >
                {generatingBrief ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                Generate my proof of work brief →
              </Button>
            </div>
          </div>
        )}

        {/* Phase 2: Proof of work brief — the hero moment */}
        {setupPhase === 'brief' && proofBrief && (
          <div className="max-w-[700px] mx-auto space-y-8">
            <div className="text-center space-y-2">
              <h1 className="text-[28px] font-bold tracking-tight">Your proof-of-work brief</h1>
              <p className="text-muted-foreground text-sm">
                This is what will set you apart from every other applicant
                {setupCompany ? ` at ${setupCompany}` : ""}.
              </p>
            </div>

            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="pt-6 space-y-5">
                <h3 className="text-xl font-bold">{proofBrief.title}</h3>

                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Why this works</p>
                  <p className="text-sm">{proofBrief.why_this_works}</p>
                </div>

                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">What to build</p>
                  <ul className="list-disc pl-5 space-y-1">
                    {(proofBrief.what_to_build as string[]).map((b: string, i: number) => (
                      <li key={i} className="text-sm">{b}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Tools to use</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(proofBrief.tools_to_use as string[]).map((t: string, i: number) => (
                      <span key={i} className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                        {t}
                      </span>
                    ))}
                  </div>
                  <p className="flex items-center gap-1 text-xs text-green-600 mt-2">
                    <Check className="h-3 w-3" />
                    All tools listed are free or freemium — no budget needed.
                  </p>
                </div>

                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Time estimate</p>
                  <p className="text-sm">{proofBrief.time_estimate}</p>
                </div>

                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Ready-to-use AI prompt</p>
                  <div className="relative">
                    <pre className="text-xs bg-muted rounded-md p-3 whitespace-pre-wrap font-sans">{proofBrief.ai_prompt}</pre>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-1 right-1 h-7 text-xs"
                      onClick={() => {
                        navigator.clipboard.writeText(proofBrief.ai_prompt);
                        toast({ title: "Prompt copied!" });
                      }}
                    >
                      Copy
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button onClick={handleStartBuilding} variant="outline" size="lg" className="flex-1">
                Start building — I'll be back when it's done
              </Button>
              <Button onClick={() => setSetupPhase('cv_tailoring')} size="lg" className="flex-1">
                Continue setting up my campaign →
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
            <p className="text-xs text-center text-muted-foreground">
              "Start building" creates your campaign and takes you back to the dashboard. Come back when your proof of work is ready.
            </p>
          </div>
        )}

        {/* Phase 3: CV tailoring — existing flow */}
        {setupPhase === 'cv_tailoring' && (
          <>
            {/* Target context */}
            <div className="text-center space-y-2">
              <h1 className="text-[32px] font-bold tracking-tight text-foreground">
                {setupRole
                  ? `Build your case for ${setupRole}${setupCompany ? ` at ${setupCompany}` : ''}`
                  : targetRole
                    ? `Build your case for ${targetRole}`
                    : 'Build your case'}
              </h1>
              <p className="text-muted-foreground text-sm">
                Paste a role you're genuinely excited about. One application, done properly.
              </p>
            </div>
            <InputSection
              onSubmit={handleSubmit}
              onClear={() => { setResult(null); downloadCountRef.current = 0; }}
              onCvParsed={(model) => setPreParsedModel(model)}
              loading={loading}
              loadingMessage={loadingMessage}
              initialJd={setupJd}
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
              <>
                {alignmentData && (
                  <AlignmentBanner
                    alignment={alignmentData.alignment}
                    reason={alignmentData.reason}
                    targetRole={alignmentData.targetRole}
                  />
                )}
                <CampaignBanner
                  company={lastCompany}
                  role={lastJobTitle}
                  jdText={lastJobDescription}
                  cvPlainText={cvModelToPlainText(cvModel)}
                  matchScore={result.atsAnalysis?.score || 0}
                  coverLetter={result.coverLetterVersions?.[0]?.content || result.coverLetter}
                />
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
              </>
            )}
          </>
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
