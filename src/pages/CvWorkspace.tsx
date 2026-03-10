import { useState, useRef, useCallback, useEffect } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import Header from "@/components/Header";
import AppFooter from "@/components/AppFooter";
import InputSection from "@/components/InputSection";
import ResultsSection from "@/components/ResultsSection";
import CampaignBanner from "@/components/CampaignBanner";
import AlignmentBanner from "@/components/AlignmentBanner";
import ApplicationTrackingModal from "@/components/ApplicationTrackingModal";
import PowReminderModal from "@/components/PowReminderModal";
import PowIncludeModal from "@/components/PowIncludeModal";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Rocket, ArrowLeft, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToastAction } from "@/components/ui/toast";
import type { TailorResult } from "@/lib/types";
import { parseCvToModel, cvModelToPlainText, aiParsedCvToModel } from "@/lib/cvDataModel";
import type { CvDataModel } from "@/lib/cvDataModel";
import { calculateAtsScore } from "@/lib/atsScore";

// LOADING_STEPS constant
const LOADING_STEPS = [
  { message: "Analyzing job requirements...", progress: 15 },
  { message: "Checking job match compatibility...", progress: 35 },
  { message: "Tailoring your CV suggestions...", progress: 55 },
  { message: "Generating your cover letter...", progress: 75 },
  { message: "Polishing results...", progress: 95 },
];

const CvWorkspace = () => {
  const { user, loading: authLoading } = useAuth();
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const initialRole = searchParams.get("role") || "";
  const initialCompany = searchParams.get("company") || "";
  const initialJd = searchParams.get("jd") || "";
  const campaignId = searchParams.get("campaign_id") || null;

  const [targetRole, setTargetRole] = useState<string | null>(null);
  const [targetLocation, setTargetLocation] = useState<string | null>(null);

  const [result, setResult] = useState<TailorResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [lastJobTitle, setLastJobTitle] = useState("Untitled Position");
  const [lastCompany, setLastCompany] = useState("Unknown Company");
  const [lastJobDescription, setLastJobDescription] = useState("");
  const [showTrackingModal, setShowTrackingModal] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [alignmentData, setAlignmentData] = useState<{ alignment: "strong" | "partial" | "weak"; reason: string; targetRole: string } | null>(null);
  const [campaignSynced, setCampaignSynced] = useState(false);
  const [cvModel, setCvModel] = useState<CvDataModel | null>(null);
  const [originalCvModel, setOriginalCvModel] = useState<CvDataModel | null>(null);
  const [preParsedModel, setPreParsedModel] = useState<CvDataModel | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // PoW integration state
  const [showPowReminder, setShowPowReminder] = useState(false);
  const [showPowInclude, setShowPowInclude] = useState(false);
  const [pendingSubmitArgs, setPendingSubmitArgs] = useState<{ cvContent: string; jobDescription: string } | null>(null);
  const [powData, setPowData] = useState<{ proof_suggestion: string; company: string; role: string } | null>(null);
  const [includePow, setIncludePow] = useState(false);

  useEffect(() => {
    if (preParsedModel) {
      setCvModel(preParsedModel);
      setOriginalCvModel(preParsedModel);
      setIsDirty(false);
    }
  }, [preParsedModel]);

  const [appliedSuggestions, setAppliedSuggestions] = useState<number[]>([]);
  const [dismissedSuggestions, setDismissedSuggestions] = useState<number[]>([]);
  const appliedKeywordBulletsRef = useRef<string[]>([]);
  const [addedKeywords, setAddedKeywords] = useState<Set<string>>(new Set());

  const undoStackRef = useRef<CvDataModel[]>([]);
  const replacedBulletsRef = useRef<Set<string>>(new Set());
  const lastAppIdRef = useRef<string | null>(null);
  const downloadCountRef = useRef(0);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cvModelRef = useRef<CvDataModel | null>(null);
  useEffect(() => { cvModelRef.current = cvModel; }, [cvModel]);

  // Stats state
  const [totalCvs, setTotalCvs] = useState(0);
  const [totalTailored, setTotalTailored] = useState(0);
  const [avgScore, setAvgScore] = useState(0);

  useEffect(() => {
    if (authLoading || !user) return;
    supabase
      .from("profiles")
      .select("target_role, target_location")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        const d = data as any;
        if (d?.target_role) setTargetRole(d.target_role);
        if (d?.target_location) setTargetLocation(d.target_location);
      });

    // Fetch stats
    supabase.from("cvs").select("id", { count: "exact", head: true }).eq("user_id", user.id).then(({ count }) => {
      setTotalCvs(count || 0);
    });
    supabase.from("applications").select("ats_score").eq("user_id", user.id).then(({ data }) => {
      if (data) {
        setTotalTailored(data.length);
        const scores = data.map((a: any) => a.ats_score || 0).filter((s: number) => s > 0);
        setAvgScore(scores.length > 0 ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length) : 0);
      }
    });
  }, [user, authLoading]);

  useEffect(() => {
    if (initialJd) {
      setTimeout(() => {
        document.getElementById("tailor-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 300);
    }
  }, [initialJd]);

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
      <div className="flex min-h-screen items-center justify-center bg-[#FAF9F7]">
        <div className="animate-spin h-8 w-8 border-4 border-[#F97316] border-t-transparent rounded-full" />
      </div>
    );
  }
  if (!user) return <Navigate to="/onboarding" replace />;

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

  const applySuggestionToModel = (model: CvDataModel, original: string, suggested: string, sectionHint?: string): CvDataModel => {
    const clone: CvDataModel = JSON.parse(JSON.stringify(model));
    const hint = (sectionHint || '').toLowerCase();

    // Advisory-only suggestions (empty original) — these are informational cards
    // like "Experience Awareness" or "Proof of Work" reminders. They cannot modify the CV model.
    if (!original || original.trim() === '') {
      // For summary suggestions with empty original, set summary directly
      if (hint.includes('summary') || hint.includes('profile')) {
        clone.summary = suggested;
        return clone;
      }
      // For projects suggestions, add as a new project entry note in summary
      if (hint.includes('project')) {
        // Can't add a project structurally — append to summary as guidance
        return clone;
      }
      // General advisory cards — return unchanged
      return clone;
    }

    const matchPrefix = original.replace(/\.{3,}$/, '').slice(0, 60).toLowerCase();
    const shortPrefix = original.replace(/\.{3,}$/, '').slice(0, 40).toLowerCase();
    const veryShortPrefix = original.replace(/\.{3,}$/, '').slice(0, 30).toLowerCase();
    const fuzzyMatch = (text: string) => {
      if (!matchPrefix && !shortPrefix && !veryShortPrefix) return false;
      const lower = text.replace(/\.{3,}$/, '').toLowerCase();
      return lower.includes(matchPrefix) || lower.includes(shortPrefix) || lower.includes(veryShortPrefix);
    };

    if (hint.includes('summary') || hint.includes('profile')) { clone.summary = suggested; return clone; }

    if (hint.includes('skill')) {
      const skillLines = clone.skills.split('\n');
      const origLower = original.replace(/\.{3,}$/, '').toLowerCase().trim();
      const origPrefix = origLower.slice(0, 30);
      let matchedLineIdx = -1;
      if (origPrefix) {
        for (let li = 0; li < skillLines.length; li++) {
          const lineLower = skillLines[li].toLowerCase().trim();
          if (lineLower && (lineLower.includes(origPrefix) || origLower.includes(lineLower.slice(0, 30)))) { matchedLineIdx = li; break; }
        }
      }
      if (matchedLineIdx >= 0 && skillLines.length > 1) { skillLines[matchedLineIdx] = suggested; clone.skills = skillLines.join('\n'); }
      else { clone.skills = suggested; }
      return clone;
    }

    if (hint.includes('education') || hint.includes('coursework') || hint.includes('degree')) {
      for (const edu of clone.education) {
        if (hint.includes('coursework') || hint.includes('relevant')) { edu.coursework = suggested; return clone; }
        if (hint.includes('degree')) { edu.degree = suggested; return clone; }
        if (edu.coursework && fuzzyMatch(edu.coursework)) { edu.coursework = suggested; return clone; }
        if (edu.degree && fuzzyMatch(edu.degree)) { edu.degree = suggested; return clone; }
      }
      if (clone.education.length > 0) { clone.education[0].coursework = suggested; return clone; }
    }

    if (clone.summary && fuzzyMatch(clone.summary)) { clone.summary = suggested; return clone; }

    for (const exp of clone.experience) {
      for (let j = 0; j < exp.bullets.length; j++) {
        if (fuzzyMatch(exp.bullets[j])) { exp.bullets.splice(j, 1, suggested); return clone; }
      }
      const roleOnly = exp.role.replace(/\s*\(.*$/, '').toLowerCase();
      const origRoleOnly = original.replace(/\s*\(.*$/, '').slice(0, 60).toLowerCase();
      if (origRoleOnly && (roleOnly.includes(origRoleOnly) || exp.role.toLowerCase().includes(matchPrefix))) {
        const datePattern = /\s+(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{4}\s*[-–—].*$/i;
        const datePattern2 = /\s+\d{4}\s*[-–—]\s*(?:present|\d{4}).*$/i;
        let cleanRole = suggested.replace(datePattern, '').replace(datePattern2, '').trim();
        const dashParts = cleanRole.split(/\s*[—–]\s*/);
        if (dashParts.length > 1 && exp.company && dashParts[dashParts.length - 1].toLowerCase().includes(exp.company.toLowerCase())) {
          cleanRole = dashParts.slice(0, -1).join(' — ').trim();
        }
        if (exp.company) { cleanRole = cleanRole.replace(/\s*\([^)]*\)\s*$/, '').trim(); }
        exp.role = cleanRole;
        return clone;
      }
    }

    if (clone.skills && fuzzyMatch(clone.skills)) { clone.skills = suggested; return clone; }
    for (const edu of clone.education) {
      if (edu.degree && fuzzyMatch(edu.degree)) { edu.degree = suggested; return clone; }
      if (edu.coursework && fuzzyMatch(edu.coursework)) { edu.coursework = suggested; return clone; }
    }
    return clone;
  };

  const handleApplySuggestion = (index: number) => {
    const currentModel = cvModelRef.current;
    if (!result || !currentModel) return;
    const s = result.cvSuggestions[index];

    // FIX 3: Calculate score before applying
    const aiKeywords = [...(result.atsAnalysis?.keywordsFound || []), ...(result.atsAnalysis?.keywordsMissing || [])];
    const scoreBefore = lastJobDescription
      ? calculateAtsScore(cvModelToPlainText(currentModel), lastJobDescription, aiKeywords).score
      : null;

    undoStackRef.current = [...undoStackRef.current.slice(-19), currentModel];
    const newModel = applySuggestionToModel(currentModel, s.original, s.suggested, s.section);
    const newApplied = [...appliedSuggestions, index];
    setCvModel(newModel);
    setAppliedSuggestions(newApplied);
    setIsDirty(true);
    debouncedSave(newModel, newApplied);

    // FIX 3: Check if score dropped and offer undo
    if (scoreBefore !== null && lastJobDescription) {
      const scoreAfter = calculateAtsScore(cvModelToPlainText(newModel), lastJobDescription, aiKeywords).score;
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

  const handleDismissSuggestion = (index: number) => { setDismissedSuggestions((prev) => [...prev, index]); };

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

  const handleAddKeywordBullet = (keyword: string, bullet: string, sectionHint: string) => {
    if (!cvModel) return;
    undoStackRef.current = [...undoStackRef.current.slice(-19), cvModel];
    const clone: CvDataModel = JSON.parse(JSON.stringify(cvModel));
    const hint = sectionHint.toLowerCase();

    if (hint.includes('skill')) {
      clone.skills = bullet;
      appliedKeywordBulletsRef.current = [...appliedKeywordBulletsRef.current, bullet];
      setAddedKeywords((prev) => new Set(prev).add(keyword.toLowerCase()));
      setCvModel(clone);
      setIsDirty(true);
      debouncedSave(clone, appliedSuggestions);
      return;
    }

    const findDuplicatePhrase = (newBullet: string, existingBullets: string[]): string | null => {
      const newWords = newBullet.toLowerCase().split(/\s+/);
      for (const existing of existingBullets) {
        const existingWords = existing.toLowerCase().split(/\s+/);
        const existingText = existingWords.join(' ');
        for (let i = 0; i <= newWords.length - 4; i++) {
          const phrase = newWords.slice(i, i + 4).join(' ');
          if (existingText.includes(phrase)) return phrase;
        }
      }
      const newMetrics = newBullet.match(/\$?\d[\d,.]*[%kKmMbB+]?/g) || [];
      for (const metric of newMetrics) {
        for (const existing of existingBullets) {
          if (existing.includes(metric)) return metric;
        }
      }
      return null;
    };

    let hintMatchedExpIdx = -1;
    for (let ei = 0; ei < clone.experience.length; ei++) {
      const exp = clone.experience[ei];
      const companyLower = (exp.company || '').toLowerCase();
      const roleLower = (exp.role || '').toLowerCase();
      if (companyLower && hint.includes(companyLower)) { hintMatchedExpIdx = ei; break; }
      if (roleLower && hint.includes(roleLower)) { hintMatchedExpIdx = ei; break; }
      const hintWords = hint.split(/\s+/).filter(w => w.length > 2);
      const companyWords = companyLower.split(/\s+/).filter(w => w.length > 2);
      const roleWords = roleLower.split(/\s+/).filter(w => w.length > 2);
      if (companyWords.length > 0 && companyWords.every(w => hintWords.some(hw => hw.includes(w)))) { hintMatchedExpIdx = ei; break; }
      if (roleWords.length > 0 && roleWords.every(w => hintWords.some(hw => hw.includes(w)))) { hintMatchedExpIdx = ei; break; }
    }

    const kwWords = keyword.toLowerCase().split(/\s+/);

    if (hintMatchedExpIdx >= 0) {
      const targetExp = clone.experience[hintMatchedExpIdx];
      const dupPhrase = findDuplicatePhrase(bullet, targetExp.bullets);
      if (dupPhrase) {
        toast({ title: "Generated bullet overlaps with existing content", description: `Duplicate phrase: "${dupPhrase}..." — try Regenerate.`, variant: "destructive" });
        return;
      }
      let bestBi = -1, bestScore = -Infinity, bestKey = '';
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
      let bestScore = -Infinity, bestExpIdx = -1, bestBulletIdx = -1, bestBulletKey = '';
      for (let ei = 0; ei < clone.experience.length; ei++) {
        const exp = clone.experience[ei];
        for (let bi = 0; bi < exp.bullets.length; bi++) {
          const bulletKey = `${ei}:${bi}:${exp.bullets[bi].slice(0, 50)}`;
          if (replacedBulletsRef.current.has(bulletKey)) continue;
          const bulletLower = exp.bullets[bi].toLowerCase();
          const bulletWords = bulletLower.split(/\s+/);
          const overlap = kwWords.filter(w => bulletWords.some(bw => bw.includes(w) || w.includes(bw))).length;
          const lenSimilarity = 1 - Math.abs(exp.bullets[bi].length - bullet.length) / Math.max(exp.bullets[bi].length, bullet.length, 1);
          const alreadyHas = bulletLower.includes(keyword.toLowerCase()) ? -3 : 0;
          const score = overlap + lenSimilarity + alreadyHas;
          if (score > bestScore) { bestScore = score; bestExpIdx = ei; bestBulletIdx = bi; bestBulletKey = bulletKey; }
        }
      }
      const targetExpIdx = bestExpIdx >= 0 ? bestExpIdx : 0;
      if (clone.experience[targetExpIdx]) {
        const otherBullets = clone.experience[targetExpIdx].bullets.filter((_, i) => i !== bestBulletIdx);
        const dupPhrase = findDuplicatePhrase(bullet, otherBullets);
        if (dupPhrase) {
          toast({ title: "Generated bullet overlaps with existing content", description: `Duplicate phrase: "${dupPhrase}..." — try Regenerate.`, variant: "destructive" });
          return;
        }
      }
      if (bestExpIdx >= 0 && bestBulletIdx >= 0) {
        clone.experience[bestExpIdx].bullets[bestBulletIdx] = bullet;
        replacedBulletsRef.current = new Set(replacedBulletsRef.current).add(bestBulletKey);
      } else if (clone.experience.length > 0) {
        clone.experience[0].bullets.push(bullet);
      } else {
        clone.summary = clone.summary ? `${clone.summary} ${bullet}` : bullet;
      }
    }

    appliedKeywordBulletsRef.current = [...appliedKeywordBulletsRef.current, bullet];
    setAddedKeywords((prev) => new Set(prev).add(keyword.toLowerCase()));
    setCvModel(clone);
    setIsDirty(true);
    debouncedSave(clone, appliedSuggestions);
  };

  // Wrapper: show PoW reminder popup for non-campaign access
  const handleTailorClick = async (cvContent: string, jobDescription: string) => {
    // If coming from a campaign, skip the popup — go straight to tailoring
    if (campaignId) {
      // Fetch campaign PoW data if available
      const { data: campData } = await supabase
        .from("campaigns")
        .select("proof_suggestion, company, role")
        .eq("id", campaignId)
        .single();

      if (campData?.proof_suggestion) {
        setPowData({ proof_suggestion: campData.proof_suggestion, company: campData.company, role: campData.role });
        setIncludePow(true);
      }
      return handleSubmit(cvContent, jobDescription);
    }

    // Not from a campaign — check if we should show the PoW reminder
    const POW_DISMISSED_KEY = "preplane_pow_reminder_dismissed";
    const alreadyDismissed = sessionStorage.getItem(POW_DISMISSED_KEY) === "true";

    if (!alreadyDismissed) {
      setPendingSubmitArgs({ cvContent, jobDescription });
      setShowPowReminder(true);
      return;
    }

    // Check if user has any campaigns with completed PoW
    await checkAndOfferPow(cvContent, jobDescription);
  };

  const checkAndOfferPow = async (cvContent: string, jobDescription: string) => {
    const { data: campaigns } = await supabase
      .from("campaigns")
      .select("proof_suggestion, company, role")
      .eq("user_id", user.id)
      .not("proof_suggestion", "is", null)
      .order("created_at", { ascending: false })
      .limit(1);

    if (campaigns && campaigns.length > 0 && campaigns[0].proof_suggestion) {
      setPowData({ proof_suggestion: campaigns[0].proof_suggestion, company: campaigns[0].company, role: campaigns[0].role });
      setPendingSubmitArgs({ cvContent, jobDescription });
      setShowPowInclude(true);
      return;
    }

    return handleSubmit(cvContent, jobDescription);
  };

  const handlePowReminderContinue = () => {
    sessionStorage.setItem("preplane_pow_reminder_dismissed", "true");
    setShowPowReminder(false);
    if (pendingSubmitArgs) {
      checkAndOfferPow(pendingSubmitArgs.cvContent, pendingSubmitArgs.jobDescription);
    }
  };

  const handlePowIncludeYes = () => {
    setIncludePow(true);
    setShowPowInclude(false);
    if (pendingSubmitArgs) {
      handleSubmit(pendingSubmitArgs.cvContent, pendingSubmitArgs.jobDescription);
    }
  };

  const handlePowIncludeSkip = () => {
    setIncludePow(false);
    setPowData(null);
    setShowPowInclude(false);
    if (pendingSubmitArgs) {
      handleSubmit(pendingSubmitArgs.cvContent, pendingSubmitArgs.jobDescription);
    }
  };

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

    const parsed = preParsedModel || parseCvToModel(cvContent);
    setCvModel(parsed);
    setOriginalCvModel(parsed);
    setPreParsedModel(null);
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
      if (targetRole) {
        supabase.functions.invoke("check-alignment", {
          body: { targetRole, jobDescription },
        }).then(({ data: alignData }) => {
          if (alignData && !alignData.skipped && alignData.alignment) setAlignmentData(alignData);
        }).catch(() => {});
      }

      // Inject PoW into CV content if available
      let enrichedCvContent = cvContent;
      if (includePow && powData?.proof_suggestion) {
        const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
        const now = new Date();
        const currentDate = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;
        const powSection = `\n\nPROJECTS\n${powData.role || "Proof of Work"} Project — Self-initiated | ${currentDate}\n${powData.proof_suggestion}\nBuilt as a targeted proof of work for ${powData.company || "a target role"}\n`;
        enrichedCvContent = cvContent + powSection;
      }

      // Helper: invoke tailor-cv with retry
      const invokeWithRetry = async (retries = 1): Promise<any> => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Please sign in to use this feature.");

        const { data, error } = await supabase.functions.invoke("tailor-cv", {
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: { cvContent: enrichedCvContent, jobDescription, tone: "professional" },
        });

        if (error) {
          // Parse friendly error messages
          const errMsg = typeof error === "object" && "message" in error ? (error as any).message : String(error);
          
          if (errMsg.includes("429") || errMsg.toLowerCase().includes("rate limit") || errMsg.toLowerCase().includes("daily limit")) {
            throw new Error("You've used your daily limit for this feature. Come back tomorrow — limits reset at midnight.");
          }
          if (errMsg.includes("401") || errMsg.toLowerCase().includes("unauthorized")) {
            throw new Error("Your session has expired. Please sign out and sign back in.");
          }
          
          // Retry once on generic errors
          if (retries > 0) {
            await new Promise(r => setTimeout(r, 2000));
            return invokeWithRetry(retries - 1);
          }
          
          throw new Error("Something went wrong while analyzing your CV. Please try again in a moment.");
        }

        if (data?.error) {
          if (data.error.includes("daily limit") || data.error.includes("limit")) {
            throw new Error(data.error);
          }
          if (retries > 0) {
            await new Promise(r => setTimeout(r, 2000));
            return invokeWithRetry(retries - 1);
          }
          throw new Error(data.error);
        }

        return data;
      };

      const data = await invokeWithRetry(1);

      setResult(data);

      const stripMd = (s: string) => s.replace(/\*+/g, '').trim();
      let jobTitle = "Untitled Position";
      let company = "Unknown Company";
      if (data.company) company = stripMd(data.company);
      if (data.jobTitle || data.role) jobTitle = stripMd(data.jobTitle || data.role);
      if (company === "Unknown Company" || jobTitle === "Untitled Position") {
        const lines = jobDescription.split(/\n/).map(l => l.trim()).filter(Boolean);
        for (const line of lines) {
          const companyMatch = line.match(/^(?:\*{0,2})Company[:\s]+\*{0,2}\s*(.+)/i);
          if (companyMatch && company === "Unknown Company") company = stripMd(companyMatch[1]);
          const roleMatch = line.match(/^(?:\*{0,2})(?:Role|Title|Position)[:\s]+\*{0,2}\s*(.+)/i);
          if (roleMatch && jobTitle === "Untitled Position") jobTitle = stripMd(roleMatch[1]);
        }
        if (jobTitle === "Untitled Position" || company === "Unknown Company") {
          const firstLine = (jobDescription.split(/\n/).map(l => l.trim()).filter(Boolean))[0] || "";
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

      // Sync results back to campaign if accessed from one
      if (campaignId && user) {
        const cvText = cvModelToPlainText(parsed);
        const matchScore = data.atsAnalysis?.score || 0;
        const coverLetterText = data.coverLetterVersions?.[0]?.content || data.coverLetter || "";

        const campaignUpdates: Record<string, any> = {
          step_cv_done: true,
          match_score: matchScore,
          cv_version: cvText,
        };
        if (jobDescription) campaignUpdates.jd_text = jobDescription;
        if (coverLetterText) {
          campaignUpdates.cover_letter = coverLetterText;
          campaignUpdates.step_cover_letter_done = true;
        }

        await supabase.from("campaigns").update(campaignUpdates).eq("id", campaignId);
        setCampaignSynced(true);
      }

      toast({ title: "Analysis complete!", description: "Your tailored results are ready." });
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Something went wrong. Please try again.", variant: "destructive" });
    } finally {
      clearInterval(interval);
      setLoading(false);
      setLoadingMessage("");
      setLoadingProgress(0);
    }
  };

  const headingText = initialRole
    ? `Tailor your CV for ${initialRole}${initialCompany ? ` at ${initialCompany}` : ''}`
    : targetRole
      ? `Tailor your CV for ${targetRole}`
      : 'Tailor your CV';

  return (
    <div className="min-h-screen bg-[#FAF9F7] flex flex-col">
      <Header />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Page title */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">CV Workspace</h1>
          <p className="text-slate-500 mt-1">Manage your CVs and tailor them for specific roles.</p>
        </div>

        {/* Tailor section */}
        <div id="tailor-section" className="space-y-6">
          <InputSection
            onSubmit={handleTailorClick}
            onClear={() => { setResult(null); downloadCountRef.current = 0; }}
            onCvParsed={(model) => setPreParsedModel(model)}
            loading={loading}
            loadingMessage={loadingMessage}
            initialJd={initialJd}
          />
          {loading && loadingProgress > 0 && (
            <div className="space-y-2">
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${loadingProgress}%` }} />
              </div>
              <p className="text-xs text-muted-foreground text-center">Step {Math.ceil(loadingProgress / 20)} of 5</p>
            </div>
          )}
          {result && cvModel && (
            <>
              {/* Alignment banner — FIRST thing user sees after tailoring */}
              {alignmentData && (
                <AlignmentBanner
                  alignment={alignmentData.alignment}
                  reason={alignmentData.reason}
                  targetRole={alignmentData.targetRole}
                />
              )}
              {/* Return to campaign banner */}
              {campaignId && campaignSynced && (
                <div className="rounded-lg border border-success/30 bg-success/5 px-4 py-3 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-success" />
                    <p className="text-sm font-medium">CV tailored successfully. Your campaign has been updated.</p>
                  </div>
                  <Button size="sm" onClick={() => nav(`/campaign/${campaignId}`)}>
                    <ArrowLeft className="h-4 w-4 mr-1" /> Return to your campaign →
                  </Button>
                </div>
              )}
              {!campaignId && (
                <CampaignBanner
                  company={lastCompany}
                  role={lastJobTitle}
                  jdText={lastJobDescription}
                  cvPlainText={cvModelToPlainText(cvModel)}
                  matchScore={result.atsAnalysis?.score || 0}
                  coverLetter={result.coverLetterVersions?.[0]?.content || result.coverLetter}
                />
              )}
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
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-12">
          <div className="p-4 rounded-xl bg-white border border-primary/5 shadow-sm">
            <p className="text-xs text-muted-foreground font-medium mb-1">CVs in Library</p>
            <p className="text-xl font-bold text-foreground">{totalCvs}</p>
            <div className="mt-2">
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full" style={{ width: `${(totalCvs / 5) * 100}%` }} />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">{totalCvs}/5 used</p>
            </div>
          </div>
          <div className="p-4 rounded-xl bg-white border border-primary/5 shadow-sm">
            <p className="text-xs text-muted-foreground font-medium mb-1">CVs Tailored</p>
            <p className="text-xl font-bold text-foreground">{totalTailored}</p>
          </div>
          <div className="p-4 rounded-xl bg-white border border-primary/5 shadow-sm">
            <p className="text-xs text-muted-foreground font-medium mb-1">Avg Match Score</p>
            <p className="text-xl font-bold text-foreground">{avgScore > 0 ? `${avgScore}%` : "—"}</p>
          </div>
          <div className="p-4 rounded-xl bg-white border border-primary/5 shadow-sm">
            <p className="text-xs text-muted-foreground font-medium mb-1">Last Activity</p>
            <p className="text-xl font-bold text-foreground">{totalTailored > 0 ? "Today" : "—"}</p>
          </div>
        </div>
      </main>

      <AppFooter />

      <ApplicationTrackingModal
        open={showTrackingModal}
        onClose={() => setShowTrackingModal(false)}
        onSave={handleTrackingSave}
        jobTitle={lastJobTitle}
        company={lastCompany}
      />

      {/* PoW reminder popup — only for non-campaign access */}
      <PowReminderModal
        open={showPowReminder}
        onClose={() => setShowPowReminder(false)}
        onStartPoW={() => {
          sessionStorage.setItem("preplane_pow_reminder_dismissed", "true");
          setShowPowReminder(false);
          nav("/app/new");
        }}
        onContinue={handlePowReminderContinue}
      />

      {/* PoW include offer — when user has completed PoW from another campaign */}
      {powData && (
        <PowIncludeModal
          open={showPowInclude}
          onClose={() => setShowPowInclude(false)}
          onInclude={handlePowIncludeYes}
          onSkip={handlePowIncludeSkip}
          role={powData.role}
        />
      )}
    </div>
  );
};

export default CvWorkspace;
