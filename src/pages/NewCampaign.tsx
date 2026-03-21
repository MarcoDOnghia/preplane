import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import Header from "@/components/Header";
import InputSection from "@/components/InputSection";
import ResultsSection from "@/components/ResultsSection";
import CampaignBanner from "@/components/CampaignBanner";
import AlignmentBanner from "@/components/AlignmentBanner";
import ApplicationTrackingModal from "@/components/ApplicationTrackingModal";
import BriefNavigator from "@/components/BriefNavigator";
import { supabase } from "@/integrations/supabase/client";

import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  Loader2,
  Sparkles,
  ArrowRight,
  Lightbulb,
  Link2,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Lock,
  Search,
  Globe,
  Newspaper,
  BriefcaseBusiness,
  Star,
  LayoutTemplate,
  CheckCircle2,
} from "lucide-react";
import RoleWaitlistModal, { isRoleLocked, LOCKED_ROLES, UNLOCKED_ROLES } from "@/components/RoleWaitlistModal";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
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
  const [alignmentData, setAlignmentData] = useState<{
    alignment: "strong" | "partial" | "weak";
    reason: string;
    targetRole: string;
  } | null>(null);

  // --- Setup phase state ---
  const initialPhase = searchParams.get("phase") === "cv_tailoring" ? ("cv_tailoring" as const) : ("input" as const);
  const [setupPhase, setSetupPhase] = useState<"input" | "brief" | "cv_tailoring">(initialPhase);
  const [setupRole, setSetupRole] = useState(searchParams.get("role") || "");
  const [setupCompany, setSetupCompany] = useState(searchParams.get("company") || "");
  const [setupJd, setSetupJd] = useState(searchParams.get("jd") || "");
  const [proofBrief, setProofBrief] = useState<any>(null);
  const [generatingBrief, setGeneratingBrief] = useState(false);
  const [jdExtractingUrl, setJdExtractingUrl] = useState(false);

  const [setupIntel, setSetupIntel] = useState("");
  const [showWaitlistModal, setShowWaitlistModal] = useState(false);
  const [waitlistRole, setWaitlistRole] = useState("");
  const companyInputRef = useRef<HTMLInputElement>(null);

  // Auto-research state
  const [autoResearching, setAutoResearching] = useState(false);
  const [autoResearchStep, setAutoResearchStep] = useState(0);
  const [autoResearchInsights, setAutoResearchInsights] = useState<
    { text: string; source: string; selected: boolean }[]
  >([]);
  const [autoResearchDone, setAutoResearchDone] = useState(false);
  const [manualNotes, setManualNotes] = useState("");
  const [manualUrl, setManualUrl] = useState("");
  const [showManualSection, setShowManualSection] = useState(false);
  const [companyError, setCompanyError] = useState("");
  const [autoResearchSuccess, setAutoResearchSuccess] = useState(false);
  const [autoResearchSignals, setAutoResearchSignals] = useState<{ type: string; text: string }[]>([]);

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
  useEffect(() => {
    cvModelRef.current = cvModel;
  }, [cvModel]);

  // Pre-fill setup role from profile target
  useEffect(() => {
    if (targetRole && !setupRole) setSetupRole(targetRole);
  }, [targetRole]);

  // Detect if JD text looks like a URL
  const jdLooksLikeUrl = /^https?:\/\/\S+$/i.test(setupJd.trim());

  const handleExtractJdUrl = async () => {
    if (!setupJd.trim()) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();
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

  const AUTO_RESEARCH_STEPS = [
    "Searching recent news...",
    "Finding job listings...",
    "Checking customer reviews...",
    "Researching Product Hunt...",
    "Scanning founder activity...",
    "Building your research notes...",
  ];

  const handleAutoResearch = async () => {
    if (!setupCompany.trim()) {
      setCompanyError("Enter a company name first");
      companyInputRef.current?.focus();
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      toast({ title: "Your session expired. Please sign in again.", variant: "destructive" });
      nav("/onboarding");
      return;
    }

    setAutoResearching(true);
    setAutoResearchStep(0);
    setAutoResearchDone(false);
    setAutoResearchSuccess(false);
    setAutoResearchSignals([]);
    setCompanyError("");

    // Animate through steps in sync with real API call
    const stepPromise = (async () => {
      for (let i = 0; i < AUTO_RESEARCH_STEPS.length; i++) {
        setAutoResearchStep(i);
        await new Promise((r) => setTimeout(r, 1500));
      }
    })();

    try {
      // Call both research functions in parallel
      const baseUrl = import.meta.env.VITE_SUPABASE_URL;
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      };
      const body = JSON.stringify({
        company: setupCompany.trim(),
        role: setupRole.trim(),
      });

      const [claudeRes, perplexityRes] = await Promise.allSettled([
        fetch(`${baseUrl}/functions/v1/auto-research-company`, {
          method: "POST", headers, body,
        }),
        fetch(`${baseUrl}/functions/v1/research-company`, {
          method: "POST", headers, body,
        }),
      ]);

      // Wait for step animation to finish
      await stepPromise;

      // Process Claude research (existing flow)
      let claudeSignals: { type: string; text: string }[] = [];
      let research = "";
      if (claudeRes.status === "fulfilled" && claudeRes.value.ok) {
        const data = await claudeRes.value.json();
        if (!data.error) {
          research = data.research || "";
          claudeSignals = data.signals || [];
        }
      }

      // Process Perplexity research (new flow)
      let perplexitySignals: { type: string; text: string; source_url?: string; date?: string }[] = [];
      if (perplexityRes.status === "fulfilled" && perplexityRes.value.ok) {
        const data = await perplexityRes.value.json();
        if (!data.error && Array.isArray(data.signals)) {
          perplexitySignals = data.signals;
        }
      }

      // Merge: use perplexity signals as primary (they have source_url), supplement with Claude
      const mergedSignals = [
        ...perplexitySignals.map(s => ({
          type: s.signal_type || s.type,
          text: s.text,
          source_url: s.source_url || null,
          date: s.date || null,
        })),
        ...claudeSignals.map(s => ({
          type: s.type,
          text: s.text,
          source_url: null as string | null,
          date: null as string | null,
        })),
      ];

      if (mergedSignals.length === 0 && !research) {
        throw new Error("No research returned");
      }

      setManualNotes(research);
      setAutoResearchSignals(mergedSignals.map(s => ({ type: s.type, text: s.text, source_url: s.source_url, date: s.date })) as any);
      setShowManualSection(mergedSignals.length === 0);
      setAutoResearchDone(true);
      setAutoResearchSuccess(true);
    } catch (e: any) {
      setAutoResearchDone(true);
      setAutoResearchSuccess(false);
      setCompanyError("Research unavailable — add your own notes below to continue.");
      setShowManualSection(true);
    } finally {
      setAutoResearching(false);
    }
  };

  const selectedInsightsCount = autoResearchInsights.filter((i) => i.selected).length;
  const hasResearchContent = selectedInsightsCount > 0 || manualNotes.trim().length > 0;

  const handleBuildBriefClick = () => {
    if (!setupRole.trim()) {
      toast({ title: "Please enter a target role", variant: "destructive" });
      return;
    }
    if (!setupCompany.trim()) {
      toast({ title: "Add a company to generate a tailored PoW.", variant: "destructive" });
      companyInputRef.current?.focus();
      return;
    }
    if (!hasResearchContent) {
      toast({ title: "Run auto-research or add some notes first.", variant: "destructive" });
      return;
    }
    // Combine selected insights + auto-research signals + manual notes into setupIntel
    const selectedTexts = autoResearchInsights.filter((i) => i.selected).map((i) => `[${i.source}] ${i.text}`);
    const signalsSummary = autoResearchSignals.length > 0
      ? autoResearchSignals.map(s => `[${s.type.toUpperCase()}] ${s.text}`).join("\n\n")
      : "";
    const combined = [...selectedTexts, signalsSummary, manualNotes.trim()].filter(Boolean).join("\n\n");
    setSetupIntel(combined);
    generateProofBrief();
  };

  const generateProofBrief = async () => {
    if (!setupRole.trim()) {
      toast({ title: "Please enter a target role", variant: "destructive" });
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();
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
          companyIntel: setupIntel.trim() || undefined,
        }),
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          toast({ title: "Session expired — please sign in again", variant: "destructive" });
          nav("/onboarding");
          return;
        } else if (response.status === 429) {
          toast({
            title: "You have reached your daily limit for proof of work generation. Come back tomorrow.",
            variant: "destructive",
          });
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
      // Support both new (project) and legacy (title) formats
      if (data.project || data.title) {
        setProofBrief(data);
        setSetupPhase("brief");
      } else {
        throw new Error("Unexpected response format");
      }
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
          toast({
            title: "Campaign limit reached",
            description: "Complete or archive one first.",
            variant: "destructive",
          });
        } else throw error;
        return;
      }
      toast({ title: "Campaign created! Start building your proof of work." });
      nav("/app");
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleContinueCampaign = async () => {
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
          toast({
            title: "Campaign limit reached",
            description: "Complete or archive one first.",
            variant: "destructive",
          });
        } else throw error;
        return;
      }
      toast({ title: "Campaign created! Let's keep going." });
      nav(`/campaign/${data.id}`);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const saveCvToDb = useCallback(async (model: CvDataModel, applied: number[]) => {
    if (!lastAppIdRef.current) return;
    setSaveStatus("saving");
    try {
      const plainText = cvModelToPlainText(model);
      await supabase
        .from("applications")
        .update({
          current_cv: plainText,
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

  const debouncedSave = useCallback(
    (model: CvDataModel, applied: number[]) => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = setTimeout(() => saveCvToDb(model, applied), 3000);
    },
    [saveCvToDb],
  );

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
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
      description:
        data.status === "applied"
          ? "Good luck! We'll track this for you."
          : "You can apply later from your History page.",
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
  const applySuggestionToModel = (
    model: CvDataModel,
    original: string,
    suggested: string,
    sectionHint?: string,
  ): CvDataModel => {
    const clone: CvDataModel = JSON.parse(JSON.stringify(model));
    const hint = (sectionHint || "").toLowerCase();
    const matchPrefix = original
      .replace(/\.{3,}$/, "")
      .slice(0, 60)
      .toLowerCase();
    const shortPrefix = original
      .replace(/\.{3,}$/, "")
      .slice(0, 40)
      .toLowerCase();
    const veryShortPrefix = original
      .replace(/\.{3,}$/, "")
      .slice(0, 30)
      .toLowerCase();
    const fuzzyMatch = (text: string) => {
      const lower = text.replace(/\.{3,}$/, "").toLowerCase();
      return lower.includes(matchPrefix) || lower.includes(shortPrefix) || lower.includes(veryShortPrefix);
    };

    // STEP 5: If section hint targets summary/profile, bypass fuzzy match
    if (hint.includes("summary") || hint.includes("profile")) {
      clone.summary = suggested;
      return clone;
    }

    // STEP 5: If section hint targets skills, replace only the matching subsection
    if (hint.includes("skill")) {
      // Split skills into lines and find which line the original matches
      const skillLines = clone.skills.split("\n");
      const origLower = original
        .replace(/\.{3,}$/, "")
        .toLowerCase()
        .trim();
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
        clone.skills = skillLines.join("\n");
      } else {
        // Single line or no match — replace entirely
        clone.skills = suggested;
      }
      return clone;
    }

    // STEP 4: If section hint targets education, bypass fuzzy match
    if (hint.includes("education") || hint.includes("coursework") || hint.includes("degree")) {
      for (const edu of clone.education) {
        if (hint.includes("coursework") || hint.includes("relevant")) {
          edu.coursework = suggested;
          return clone;
        }
        if (hint.includes("degree")) {
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
      const roleOnly = exp.role.replace(/\s*\(.*$/, "").toLowerCase();
      const origRoleOnly = original
        .replace(/\s*\(.*$/, "")
        .slice(0, 60)
        .toLowerCase();
      if (roleOnly.includes(origRoleOnly) || exp.role.toLowerCase().includes(matchPrefix)) {
        const datePattern =
          /\s+(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{4}\s*[-–—].*$/i;
        const datePattern2 = /\s+\d{4}\s*[-–—]\s*(?:present|\d{4}).*$/i;
        let cleanRole = suggested.replace(datePattern, "").replace(datePattern2, "").trim();
        const dashParts = cleanRole.split(/\s*[—–]\s*/);
        if (
          dashParts.length > 1 &&
          exp.company &&
          dashParts[dashParts.length - 1].toLowerCase().includes(exp.company.toLowerCase())
        ) {
          cleanRole = dashParts.slice(0, -1).join(" — ").trim();
        }
        if (exp.company) {
          cleanRole = cleanRole.replace(/\s*\([^)]*\)\s*$/, "").trim();
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
    const scoreBefore = jd ? calculateAtsScore(cvModelToPlainText(currentModel), jd, aiKeywords).score : null;

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
                debouncedSave(
                  currentModel,
                  appliedSuggestions.filter((i) => i !== index),
                );
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
    if (hint.includes("skill")) {
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
      const companyLower = (exp.company || "").toLowerCase();
      const roleLower = (exp.role || "").toLowerCase();
      if (companyLower && hint.includes(companyLower)) {
        hintMatchedExpIdx = ei;
        break;
      }
      if (roleLower && hint.includes(roleLower)) {
        hintMatchedExpIdx = ei;
        break;
      }
      // Also check if hint words overlap significantly with company/role
      const hintWords = hint.split(/\s+/).filter((w) => w.length > 2);
      const companyWords = companyLower.split(/\s+/).filter((w) => w.length > 2);
      const roleWords = roleLower.split(/\s+/).filter((w) => w.length > 2);
      const companyMatch = companyWords.length > 0 && companyWords.every((w) => hintWords.some((hw) => hw.includes(w)));
      const roleMatch = roleWords.length > 0 && roleWords.every((w) => hintWords.some((hw) => hw.includes(w)));
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
        const existingText = existingWords.join(" ");
        // Check all 4-word windows in the new bullet against existing
        for (let i = 0; i <= newWords.length - 4; i++) {
          const phrase = newWords.slice(i, i + 4).join(" ");
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
      let bestKey = "";
      for (let bi = 0; bi < targetExp.bullets.length; bi++) {
        const bulletKey = `${hintMatchedExpIdx}:${bi}:${targetExp.bullets[bi].slice(0, 50)}`;
        if (replacedBulletsRef.current.has(bulletKey)) continue;
        const bWords = targetExp.bullets[bi].toLowerCase().split(/\s+/);
        const overlap = kwWords.filter((w) => bWords.some((bw) => bw.includes(w) || w.includes(bw))).length;
        const lenSim =
          1 -
          Math.abs(targetExp.bullets[bi].length - bullet.length) /
            Math.max(targetExp.bullets[bi].length, bullet.length, 1);
        const alreadyHas = targetExp.bullets[bi].toLowerCase().includes(keyword.toLowerCase()) ? -3 : 0;
        const score = overlap + lenSim + alreadyHas;
        if (score > bestScore) {
          bestScore = score;
          bestBi = bi;
          bestKey = bulletKey;
        }
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
      let bestBulletKey = "";

      for (let ei = 0; ei < clone.experience.length; ei++) {
        const exp = clone.experience[ei];
        for (let bi = 0; bi < exp.bullets.length; bi++) {
          const bulletKey = `${ei}:${bi}:${exp.bullets[bi].slice(0, 50)}`;
          if (replacedBulletsRef.current.has(bulletKey)) continue;
          const bulletText = exp.bullets[bi];
          const bulletLower = bulletText.toLowerCase();
          const bulletWords = bulletLower.split(/\s+/);
          const overlap = kwWords.filter((w) => bulletWords.some((bw) => bw.includes(w) || w.includes(bw))).length;
          const lenSimilarity = 1 - Math.abs(bulletText.length - bulletLen) / Math.max(bulletText.length, bulletLen, 1);
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
    // FIX 4: Validate CV text before calling edge function
    if (!cvContent || cvContent.trim().length < 50) {
      toast({ title: "We could not read your CV. Please try uploading it again.", variant: "destructive" });
      return;
    }

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
      const {
        data: { session },
      } = await supabase.auth.getSession();
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
        supabase.functions
          .invoke("check-alignment", {
            headers: authHeaders,
            body: { targetRole, jobDescription },
          })
          .then(({ data: alignData }) => {
            if (alignData && !alignData.skipped && alignData.alignment) {
              setAlignmentData(alignData);
            }
          })
          .catch(() => {});
      }

      // FIX 4: Invoke tailor-cv with retry
      const invokeWithRetry = async (retries = 1): Promise<any> => {
        const { data, error } = await supabase.functions.invoke("tailor-cv", {
          headers: authHeaders,
          body: { cvContent, jobDescription, tone: "professional" },
        });

        if (error) {
          const errMsg = typeof error === "object" && "message" in error ? (error as any).message : String(error);
          if (
            errMsg.includes("429") ||
            errMsg.toLowerCase().includes("rate limit") ||
            errMsg.toLowerCase().includes("daily limit")
          ) {
            throw new Error(
              "You've used your daily limit for this feature. Come back tomorrow — limits reset at midnight.",
            );
          }
          if (errMsg.includes("401") || errMsg.toLowerCase().includes("unauthorized")) {
            throw new Error("Your session has expired. Please sign out and sign back in.");
          }
          if (retries > 0) {
            await new Promise((r) => setTimeout(r, 2000));
            return invokeWithRetry(retries - 1);
          }
          throw new Error("Our AI is taking longer than usual. Please try again in a moment.");
        }

        if (data?.error) {
          if (data.error.includes("daily limit") || data.error.includes("limit")) {
            throw new Error(data.error);
          }
          if (retries > 0) {
            await new Promise((r) => setTimeout(r, 2000));
            return invokeWithRetry(retries - 1);
          }
          throw new Error(data.error);
        }

        return data;
      };

      const data = await invokeWithRetry(1);

      // Store result with suggestions — but do NOT apply them to the model
      setResult(data);

      // Extract company and role from AI result or JD text
      const stripMd = (s: string) => s.replace(/\*+/g, "").trim();
      let jobTitle = "Untitled Position";
      let company = "Unknown Company";

      // Try AI result fields first
      if (data.company) company = stripMd(data.company);
      if (data.jobTitle || data.role) jobTitle = stripMd(data.jobTitle || data.role);

      // Fallback: parse from JD text lines
      if (company === "Unknown Company" || jobTitle === "Untitled Position") {
        const lines = jobDescription
          .split(/\n/)
          .map((l) => l.trim())
          .filter(Boolean);
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

      const { data: inserted } = await supabase
        .from("applications")
        .insert({
          user_id: user.id,
          job_title: jobTitle,
          company,
          cv_content: cvContent,
          job_description: jobDescription,
          tone: "professional",
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
        } as any)
        .select("id")
        .single();

      if (inserted) lastAppIdRef.current = inserted.id;
      toast({ title: "Analysis complete!", description: "Your tailored results are ready." });
    } catch (error: any) {
      const msg = error.message || "Something went wrong while analysing your CV.";
      toast({
        title: msg.includes("daily limit") ? msg : "Our AI is taking longer than usual. Please try again in a moment.",
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
    <div
      className="min-h-screen"
      style={
        setupPhase === "input" || setupPhase === "brief"
          ? { background: "#111111", fontFamily: "Inter, sans-serif" }
          : undefined
      }
    >
      {setupPhase !== "input" && <Header />}
      <main className={setupPhase === "input" ? "" : "mx-auto px-4 py-8 max-w-[1200px] space-y-10"}>
        {/* Phase 1: Setup — role, company (dark themed) */}
        {setupPhase === "input" && (
          <div
            className="min-h-screen flex items-center justify-center px-4 py-16"
            style={{ fontFamily: "Inter, sans-serif" }}
          >
            <div className="w-full max-w-[520px] space-y-10">
              {/* Headline */}
              <div className="text-center space-y-4">
                <h1
                  style={{
                    color: "#FFFFFF",
                    fontSize: "32px",
                    fontWeight: 900,
                    lineHeight: 1.2,
                    letterSpacing: "-0.02em",
                  }}
                >
                  Who are you going after?
                </h1>
                <p style={{ color: "#94A3B8", fontSize: "16px", lineHeight: 1.6 }}>
                  Most students send a CV.
                  <br />
                  You're going to send something they actually remember.
                </p>
              </div>

              {/* Form */}
              <div className="space-y-5">
                {/* Field 1: Target role */}
                <div>
                  <label
                    style={{
                      color: "#FFFFFF",
                      fontSize: "13px",
                      fontWeight: 500,
                      display: "block",
                      marginBottom: "6px",
                    }}
                  >
                    Target role
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[...UNLOCKED_ROLES, ...Object.keys(LOCKED_ROLES)].map((role) => {
                      const locked = isRoleLocked(role);
                      const selected = setupRole === role;
                      return (
                        <button
                          key={role}
                          type="button"
                          onClick={() => {
                            if (locked) {
                              setWaitlistRole(role);
                              setShowWaitlistModal(true);
                            } else {
                              setSetupRole(role);
                            }
                          }}
                          className="transition-colors"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            padding: "8px 14px",
                            borderRadius: "8px",
                            fontSize: "13px",
                            fontWeight: 500,
                            cursor: "pointer",
                            background: selected ? "#F97316" : "rgba(30,41,59,0.5)",
                            color: selected ? "white" : locked ? "#64748B" : "#CBD5E1",
                            border: selected ? "1px solid #F97316" : "1px solid rgba(255,255,255,0.08)",
                          }}
                        >
                          {locked && <Lock className="w-3 h-3" style={{ flexShrink: 0 }} />}
                          {role}
                          {locked && (
                            <span
                              style={{
                                background: "rgba(249,116,22,0.15)",
                                color: "#F97316",
                                fontSize: "10px",
                                fontWeight: 600,
                                padding: "2px 6px",
                                borderRadius: "4px",
                              }}
                            >
                              Waitlist
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Field 2: Target company */}
                <div>
                  <label
                    style={{
                      color: "#FFFFFF",
                      fontSize: "13px",
                      fontWeight: 500,
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      marginBottom: "6px",
                    }}
                  >
                    Target company
                    <span
                      style={{
                        background: "rgba(249,115,22,0.15)",
                        color: "#F97316",
                        fontSize: "11px",
                        fontWeight: 600,
                        padding: "2px 8px",
                        borderRadius: "4px",
                        letterSpacing: "0.02em",
                      }}
                    >
                      Needed
                    </span>
                  </label>
                  <input
                    ref={companyInputRef}
                    value={setupCompany}
                    onChange={(e) => {
                      setSetupCompany(e.target.value);
                      setCompanyError("");
                      // Reset auto-research when company changes
                      if (autoResearchDone) {
                        setAutoResearchDone(false);
                        setAutoResearchInsights([]);
                        setAutoResearchSuccess(false);
                        setAutoResearchSignals([]);
                      }
                    }}
                    placeholder="e.g. Sequoia Capital"
                    style={{
                      width: "100%",
                      background: "#1A1A1A",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: "8px",
                      color: "#FFFFFF",
                      padding: "12px 14px",
                      fontSize: "14px",
                      outline: "none",
                      transition: "border-color 0.2s",
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = "#F97316";
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = "rgba(255,255,255,0.08)";
                    }}
                  />
                  {companyError && (
                    <p style={{ color: "#ef4444", fontSize: "13px", marginTop: "6px" }}>{companyError}</p>
                  )}
                </div>

                {/* Research section */}
                <div
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: "12px",
                    padding: "24px",
                  }}
                >
                  <div style={{ marginBottom: "4px" }}>
                    <h3
                      style={{
                        color: "#FFFFFF",
                        fontSize: "15px",
                        fontWeight: 700,
                        marginBottom: "6px",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <Search className="w-4 h-4" style={{ color: "#F97316" }} />
                      Let Preplane do the research
                    </h3>
                    <p style={{ color: "#64748B", fontSize: "13px", lineHeight: 1.6 }}>
                      We'll scan the web, recent news, and job boards to find specific hooks for your brief. No
                      hallucinations. No generic fluff.
                    </p>
                  </div>

                  {/* A) Auto-research button */}
                  <div style={{ marginTop: "16px" }}>
                    {!autoResearching && !autoResearchDone && (
                      <button
                        onClick={handleAutoResearch}
                        disabled={!setupCompany.trim()}
                        style={{
                          width: "100%",
                          background: !setupCompany.trim() ? "rgba(249,115,22,0.3)" : "#F97316",
                          color: "#FFFFFF",
                          fontWeight: 700,
                          fontSize: "15px",
                          padding: "14px",
                          borderRadius: "8px",
                          border: "none",
                          cursor: !setupCompany.trim() ? "not-allowed" : "pointer",
                          transition: "background 0.2s",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "8px",
                        }}
                        onMouseEnter={(e) => {
                          if (setupCompany.trim()) (e.target as HTMLButtonElement).style.background = "#EA6C0A";
                        }}
                        onMouseLeave={(e) => {
                          if (setupCompany.trim()) (e.target as HTMLButtonElement).style.background = "#F97316";
                        }}
                      >
                        <Globe className="w-4 h-4" />
                        Auto-Research Company
                      </button>
                    )}

                    {/* Research progress */}
                    {autoResearching && (
                      <div style={{ padding: "16px 0" }}>
                        <div className="space-y-3">
                          {AUTO_RESEARCH_STEPS.map((stepText, i) => (
                            <div
                              key={i}
                              className="flex items-center gap-3"
                              style={{
                                opacity: i <= autoResearchStep ? 1 : 0.3,
                                transition: "opacity 0.4s ease",
                              }}
                            >
                              {i < autoResearchStep ? (
                                <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: "#22c55e" }} />
                              ) : i === autoResearchStep ? (
                                <Loader2 className="w-4 h-4 flex-shrink-0 animate-spin" style={{ color: "#F97316" }} />
                              ) : (
                                <div
                                  style={{
                                    width: "16px",
                                    height: "16px",
                                    borderRadius: "50%",
                                    border: "1px solid rgba(255,255,255,0.1)",
                                    flexShrink: 0,
                                  }}
                                />
                              )}
                              <span style={{ color: i <= autoResearchStep ? "#E2E8F0" : "#475569", fontSize: "13px" }}>
                                {stepText}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Research success banner */}
                    {autoResearchDone && autoResearchSuccess && (
                      <div style={{ marginTop: "12px" }}>
                        <div
                          style={{
                            background: "rgba(34,197,94,0.1)",
                            border: "1px solid rgba(34,197,94,0.2)",
                            borderRadius: "8px",
                            padding: "12px",
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                          }}
                        >
                          <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: "#22c55e" }} />
                          <p style={{ color: "#22c55e", fontSize: "13px", margin: 0 }}>
                            Research complete — review and edit before generating your brief.
                          </p>
                        </div>
                        <button
                          onClick={handleAutoResearch}
                          style={{
                            marginTop: "10px",
                            background: "transparent",
                            border: "none",
                            color: "#64748B",
                            fontSize: "12px",
                            cursor: "pointer",
                            padding: "4px 0",
                          }}
                        >
                          ↻ Re-run research
                        </button>
                      </div>
                    )}

                    {/* Signal cards */}
                    {autoResearchDone && autoResearchSuccess && autoResearchSignals.length > 0 && (
                      <div style={{ marginTop: "12px", display: "grid", gap: "8px" }}>
                        {autoResearchSignals.filter(s => s.type !== "pow_angle").map((signal, i) => {
                          const config: Record<string, { emoji: string; label: string }> = {
                            company: { emoji: "🏢", label: "What They Do" },
                            news: { emoji: "📰", label: "Recent News" },
                            hiring: { emoji: "👔", label: "Open Roles" },
                            customer: { emoji: "⭐", label: "Customer Signals" },
                            founder_linkedin: { emoji: "👤", label: "Founder Activity" },
                          };
                          const c = config[signal.type] || { emoji: "📌", label: signal.type };
                          return (
                            <div
                              key={i}
                              style={{
                                background: "hsl(var(--card))",
                                border: "1px solid hsl(var(--border))",
                                borderRadius: "8px",
                                padding: "12px 14px",
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                                <span style={{ fontSize: "14px" }}>{c.emoji}</span>
                                <span style={{ fontSize: "12px", fontWeight: 600, color: "hsl(var(--foreground))", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                                  {c.label}
                                </span>
                              </div>
                              <p style={{ fontSize: "13px", color: "hsl(var(--muted-foreground))", lineHeight: 1.5, margin: 0, whiteSpace: "pre-line" }}>
                                {signal.text.replace(/^[\s*]+|[\s*]+$/g, '').replace(/\*\*/g, '').replace(/\*/g, '')}
                              </p>
                            </div>
                          );
                        })}
                        {/* PoW Angle card — always last */}
                        {(() => {
                          const powSignal = autoResearchSignals.find(s => s.type === "pow_angle");
                          return (
                            <div
                              style={{
                                background: powSignal ? "hsl(var(--card))" : "hsl(var(--muted))",
                                border: powSignal ? "1.5px solid hsl(270 60% 50%)" : "1px solid hsl(var(--border))",
                                borderRadius: "8px",
                                padding: "12px 14px",
                                opacity: powSignal ? 1 : 0.6,
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                                <span style={{ fontSize: "14px" }}>🎯</span>
                                <span style={{ fontSize: "12px", fontWeight: 600, color: powSignal ? "hsl(270 60% 60%)" : "hsl(var(--muted-foreground))", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                                  Your Proof of Work Angle
                                </span>
                              </div>
                              <p style={{ fontSize: "13px", color: powSignal ? "hsl(var(--muted-foreground))" : "hsl(var(--muted-foreground))", lineHeight: 1.5, margin: 0, whiteSpace: "pre-line", fontStyle: powSignal ? "normal" : "italic" }}>
                                {powSignal
                                  ? powSignal.text.replace(/^[\s*]+|[\s*]+$/g, '').replace(/\*\*/g, '').replace(/\*/g, '')
                                  : "Angle generating… check back in a moment."}
                              </p>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>

                  {/* B) Manual notes section */}
                  <div style={{ marginTop: "20px", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "16px" }}>
                    <button
                      type="button"
                      onClick={() => setShowManualSection(!showManualSection)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#94A3B8",
                        fontSize: "13px",
                        fontWeight: 500,
                        cursor: "pointer",
                        padding: 0,
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <Lightbulb className="w-3.5 h-3.5" />
                      Prefer to add your own notes?
                      <span style={{ fontSize: "11px", color: "#475569" }}>(optional)</span>
                    </button>

                    {showManualSection && (
                      <div className="space-y-3" style={{ marginTop: "12px" }}>
                        <p style={{ color: "#64748B", fontSize: "12px", lineHeight: 1.6 }}>
                          If you already have context, paste it — we'll turn it into your PoW brief.
                        </p>
                        <div style={{ marginBottom: "8px" }}>
                          <p style={{ color: "#94A3B8", fontSize: "12px", fontWeight: 600, marginBottom: "6px" }}>
                            Where to look:
                          </p>
                          <div className="space-y-1">
                            {[
                              "Founder LinkedIn posts",
                              "Google company name + recent news",
                              "Job listings on LinkedIn",
                              "G2 or Trustpilot reviews",
                              "Their website copy",
                            ].map((tip) => (
                              <p key={tip} style={{ color: "#64748B", fontSize: "12px", lineHeight: 1.5 }}>
                                → {tip}
                              </p>
                            ))}
                          </div>
                        </div>
                        <textarea
                          value={manualNotes}
                          onChange={(e) => setManualNotes(e.target.value)}
                          placeholder="e.g. Their CEO posted last week about struggling to break into the German market. They have 3 open SDR roles..."
                          style={{
                            width: "100%",
                            background: "#1A1A1A",
                            border: "1px solid rgba(255,255,255,0.08)",
                            borderRadius: "8px",
                            color: "#FFFFFF",
                            padding: "12px 16px",
                            fontSize: "14px",
                            minHeight: "80px",
                            outline: "none",
                            transition: "border-color 0.2s",
                            resize: "vertical",
                            fontFamily: "Inter, sans-serif",
                          }}
                          onFocus={(e) => {
                            e.target.style.borderColor = "#F97316";
                          }}
                          onBlur={(e) => {
                            e.target.style.borderColor = "rgba(255,255,255,0.08)";
                          }}
                        />
                        <input
                          value={manualUrl}
                          onChange={(e) => setManualUrl(e.target.value)}
                          placeholder="Paste a job description or article URL (optional)"
                          style={{
                            width: "100%",
                            background: "#1A1A1A",
                            border: "1px solid rgba(255,255,255,0.08)",
                            borderRadius: "8px",
                            color: "#FFFFFF",
                            padding: "12px 14px",
                            fontSize: "13px",
                            outline: "none",
                            transition: "border-color 0.2s",
                          }}
                          onFocus={(e) => {
                            e.target.style.borderColor = "#F97316";
                          }}
                          onBlur={(e) => {
                            e.target.style.borderColor = "rgba(255,255,255,0.08)";
                          }}
                        />
                        <p style={{ color: "#475569", fontSize: "11px" }}>
                          If link import isn't available, paste the key text above.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Status nudge */}
                <p
                  style={{
                    fontSize: "12px",
                    lineHeight: 1.5,
                    textAlign: "center" as const,
                    color: !setupCompany.trim() ? "#64748B" : "#94A3B8",
                  }}
                >
                  {!setupCompany.trim()
                    ? "Add a company to unlock tailored research."
                    : "The more context you give us, the sharper your brief will be."}
                </p>

                {/* CTA Button */}
                {(() => {
                  const ctaVisuallyDisabled = generatingBrief || !setupCompany.trim();
                  return (
                    <div>
                      <button
                        onClick={handleBuildBriefClick}
                        disabled={generatingBrief}
                        style={{
                          width: "100%",
                          background: ctaVisuallyDisabled ? "#242424" : "#F97316",
                          color: ctaVisuallyDisabled ? "#64748B" : "#FFFFFF",
                          fontWeight: 700,
                          fontSize: "16px",
                          padding: "16px",
                          borderRadius: "8px",
                          border: "none",
                          cursor: ctaVisuallyDisabled ? "not-allowed" : "pointer",
                          transition: "background 0.2s",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "8px",
                        }}
                        onMouseEnter={(e) => {
                          if (!ctaVisuallyDisabled) (e.target as HTMLButtonElement).style.background = "#EA6C0A";
                        }}
                        onMouseLeave={(e) => {
                          if (!ctaVisuallyDisabled) (e.target as HTMLButtonElement).style.background = "#F97316";
                        }}
                      >
                        {generatingBrief && <Loader2 className="h-5 w-5 animate-spin" />}
                        {generatingBrief ? "Generating..." : "Generate my brief →"}
                      </button>
                      {!setupCompany.trim() && !generatingBrief && (
                        <p
                          style={{ color: "#475569", fontSize: "12px", textAlign: "center" as const, marginTop: "8px" }}
                        >
                          Add a company to generate a tailored PoW.
                        </p>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* Phase 2: Proof of work brief — step-by-step navigator */}
        {setupPhase === "brief" && proofBrief && proofBrief.build_steps && (
          <BriefNavigator
            proofBrief={proofBrief}
            company={setupCompany}
            onStartBuilding={handleStartBuilding}
            onContinueCampaign={handleContinueCampaign}
            toast={toast}
          />
        )}
        {/* Legacy brief format fallback */}
        {setupPhase === "brief" && proofBrief && !proofBrief.build_steps && (
          <div style={{ maxWidth: "720px", margin: "0 auto" }}>
            <div
              style={{
                background: "#1A1A1A",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "16px",
                padding: "40px",
              }}
            >
              <h3 style={{ color: "#FFFFFF", fontSize: "20px", fontWeight: 700, marginBottom: "20px" }}>
                {proofBrief.title}
              </h3>
              <div style={{ marginBottom: "20px" }}>
                <p
                  style={{
                    color: "#F97316",
                    fontSize: "11px",
                    fontWeight: 700,
                    letterSpacing: "0.15em",
                    textTransform: "uppercase" as const,
                    marginBottom: "8px",
                  }}
                >
                  Why this works
                </p>
                <p style={{ color: "#E2E8F0", fontSize: "15px", lineHeight: 1.7 }}>{proofBrief.why_this_works}</p>
              </div>
              <div style={{ marginBottom: "20px" }}>
                <p
                  style={{
                    color: "#F97316",
                    fontSize: "11px",
                    fontWeight: 700,
                    letterSpacing: "0.15em",
                    textTransform: "uppercase" as const,
                    marginBottom: "8px",
                  }}
                >
                  What to build
                </p>
                <ul style={{ paddingLeft: "20px", margin: 0 }}>
                  {(proofBrief.what_to_build as string[]).map((b: string, i: number) => (
                    <li key={i} style={{ color: "#E2E8F0", fontSize: "15px", lineHeight: 1.7, marginBottom: "4px" }}>
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
              <div style={{ marginBottom: "20px" }}>
                <p
                  style={{
                    color: "#F97316",
                    fontSize: "11px",
                    fontWeight: 700,
                    letterSpacing: "0.15em",
                    textTransform: "uppercase" as const,
                    marginBottom: "8px",
                  }}
                >
                  Tools to use
                </p>
                <div style={{ display: "flex", flexWrap: "wrap" as const, gap: "6px" }}>
                  {(proofBrief.tools_to_use as string[]).map((t: string, i: number) => (
                    <span
                      key={i}
                      style={{
                        background: "rgba(249,115,22,0.15)",
                        color: "#F97316",
                        fontSize: "12px",
                        fontWeight: 500,
                        padding: "4px 10px",
                        borderRadius: "999px",
                      }}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "32px" }}
              className="sm:flex-row"
            >
              <button
                onClick={handleStartBuilding}
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "1px solid rgba(255,255,255,0.15)",
                  color: "#FFFFFF",
                  borderRadius: "8px",
                  padding: "12px 24px",
                  fontSize: "14px",
                  cursor: "pointer",
                  fontWeight: 500,
                }}
              >
                Start building — I'll be back when it's done
              </button>
              <button
                onClick={handleContinueCampaign}
                style={{
                  flex: 1,
                  background: "#F97316",
                  color: "#FFFFFF",
                  fontWeight: 700,
                  borderRadius: "8px",
                  padding: "12px 28px",
                  fontSize: "14px",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                }}
              >
                Continue setting up my campaign →
              </button>
            </div>
          </div>
        )}

        {/* Phase 3: CV tailoring — existing flow */}
        {setupPhase === "cv_tailoring" && (
          <>
            {/* Target context */}
            <div className="text-center space-y-2">
              <h1 className="text-[32px] font-bold tracking-tight text-foreground">
                {setupRole
                  ? `Build your case for ${setupRole}${setupCompany ? ` at ${setupCompany}` : ""}`
                  : targetRole
                    ? `Build your case for ${targetRole}`
                    : "Build your case"}
              </h1>
              <p className="text-muted-foreground text-sm">
                Paste a role you're genuinely excited about. One application, done properly.
              </p>
            </div>
            <InputSection
              onSubmit={handleSubmit}
              onClear={() => {
                setResult(null);
                downloadCountRef.current = 0;
              }}
              onCvParsed={(model) => setPreParsedModel(model)}
              loading={loading}
              loadingMessage={loadingMessage}
              initialJd={setupJd}
            />
            {loading && loadingProgress > 0 && (
              <div className="space-y-2">
                <Progress value={loadingProgress} className="h-2" />
                <p className="text-xs text-muted-foreground text-center">Step {Math.ceil(loadingProgress / 20)} of 5</p>
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

      {user && (
        <RoleWaitlistModal
          open={showWaitlistModal}
          onOpenChange={setShowWaitlistModal}
          role={waitlistRole}
          userId={user.id}
        />
      )}
    </div>
  );
};

export default Index;
