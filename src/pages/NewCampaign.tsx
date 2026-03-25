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
  const [draftCampaignId, setDraftCampaignId] = useState<string | null>(null);
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
  const [autoResearchSignals, setAutoResearchSignals] = useState<{ type: string; text: string; source_url?: string | null; date?: string | null }[]>([]);
  const [lowConfidence, setLowConfidence] = useState(false);

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
    setLowConfidence(false);
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
      let perplexitySignals: { type: string; text: string; source_url?: string; date?: string; signal_type?: string }[] = [];
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
      setAutoResearchSignals(mergedSignals.map(s => ({ type: s.type, text: s.text, source_url: s.source_url, date: s.date })));
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

  // ----------------- BEGIN REFACTOR -------------------
  const handleBuildBriefClick = async () => {
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
    if (!user) return;

    // ← AGGIUNGI QUI
    const selectedTexts = autoResearchInsights.filter((i) => i.selected).map((i) => `[${i.source}] ${i.text}`);
    const sourcedSignals = autoResearchSignals.filter(s => s.source_url);
    const signalsSummary = sourcedSignals.length > 0
      ? sourcedSignals.map(s => `[${s.type.toUpperCase()}] ${s.text}${s.source_url ? ` (source: ${s.source_url})` : ""}`).join("\n\n")
      : "";
    const combined = [...selectedTexts, signalsSummary, manualNotes.trim()].filter(Boolean).join("\n\n");
    setSetupIntel(combined);

    if (draftCampaignId) {
      await persistSignals(draftCampaignId);
      await generateProofBrief(combined);
      return;
    }
    // ← FINE AGGIUNTA

    try {
      const { data, error } = await supabase
        .from("campaigns")
        .insert({
          user_id: user.id,
          company: setupCompany.trim() || "General",
          role: setupRole.trim(),
          jd_text: setupJd.trim() || "",
          status: "draft",
          proof_in_progress: false,
        } as any)
        .select("id")
        .single();

      if (error) {
        if (error.message?.includes("10 active campaigns")) {
          toast({ title: "Campaign limit reached", description: "Complete or archive one first.", variant: "destructive" });
        } else {
          toast({ title: "Error", description: error.message, variant: "destructive" });
        }
        return;
      }
      const campaignId = data.id;
      setDraftCampaignId(campaignId);
      await persistSignals(campaignId);
      await generateProofBrief(combined);

    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
      return;
    }
  };
  // ----------------------------------------------------

  const generateProofBrief = async (intel?: string) => {
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
          companyIntel: (intel ?? setupIntel).trim() || undefined,
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

  const persistSignals = async (campaignId: string) => {
    if (!user || autoResearchSignals.length === 0) return;
    try {
      const rows = autoResearchSignals
        .filter(s => s.type !== "pow_angle")
        .filter(s => !s.text.startsWith("NOT_FOUND") && !s.text.match(/^\S*NOT_FOUND/))
        .filter(s => !(s.type === "founder_linkedin" && (s.text.length < 50 || s.text.startsWith(".") || s.text.includes("Based on my research"))))
        // Filter to remove garbage "thinking" signals
        .filter(s => {
          const lowerText = s.text.toLowerCase();
          // phrases to match anywhere in the string (case insensitive)
          const garbagePhrases = [
            "now let me search",
            "let me search",
            "let me look",
            "based on my research",
            "i need to find",
            "let me check",
          ];
          // matches if text starts with lowercase + "let me" or "now let"
          const startsWithThinking = /^(?:[a-z]{1,10}\s*)?(let me|now let)\b/;
          const containsGarbage = garbagePhrases.some(phrase => lowerText.includes(phrase));
          const startsWithPattern = startsWithThinking.test(lowerText);
          return !containsGarbage && !startsWithPattern;
        })

        .map(s => ({
          campaign_id: campaignId,
          user_id: user.id,
          signal_type: s.type,
          text: s.text,
          source_url: s.source_url || null,
          date: s.date || null,
        }));
      if (rows.length > 0) {
        await supabase.from("campaign_signals").insert(rows);
      }
    } catch (_) {
      // Non-critical
    }
  };

  // ---------- handleStartBuilding and handleContinueCampaign refactors ---------
  const handleStartBuilding = async () => {
    if (!user) return;
    try {
      if (draftCampaignId) {
        // Update the existing campaign row
        const { error } = await supabase
          .from("campaigns")
          .update({
            proof_suggestion: JSON.stringify(proofBrief),
            proof_in_progress: true,
            status: "targeting",
          } as any)
          .eq("id", draftCampaignId);
        if (error) throw error;
        toast({ title: "Campaign created! Start building your proof of work." });
        nav("/app");
        return;
      } else {
        // Fallback to insert if draftCampaignId missing for some reason (original logic)
        const { data, error } = await supabase
          .from("campaigns")
          .insert({
            user_id: user.id,
            company: setupCompany.trim() || "General",
            role: setupRole.trim(),
            jd_text: setupJd.trim() || "",
            status: "targeting",
            proof_in_progress: true,
            proof_suggestion: JSON.stringify(proofBrief),
          } as any)
          .select("id")
          .single();
        if (error) throw error;
        setDraftCampaignId(data.id);
        toast({ title: "Campaign created! Start building your proof of work." });
        nav("/app");
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleContinueCampaign = async () => {
    if (!user) return;
    try {
      if (draftCampaignId) {
        // Update the existing campaign row
        const { error } = await supabase
          .from("campaigns")
          .update({
            proof_suggestion: JSON.stringify(proofBrief),
            proof_in_progress: true,
            status: "targeting",
          } as any)
          .eq("id", draftCampaignId);
        if (error) throw error;
        toast({ title: "Campaign created! Let's keep going." });
        nav(`/campaign/${draftCampaignId}`);
        return;
      } else {
        // Fallback to insert if draftCampaignId missing for some reason (original logic)
        const { data, error } = await supabase
          .from("campaigns")
          .insert({
            user_id: user.id,
            company: setupCompany.trim() || "General",
            role: setupRole.trim(),
            jd_text: setupJd.trim() || "",
            status: "targeting",
            proof_in_progress: true,
            proof_suggestion: JSON.stringify(proofBrief),
          } as any)
          .select("id")
          .single();
        if (error) throw error;
        setDraftCampaignId(data.id);
        toast({ title: "Campaign created! Let's keep going." });
        nav(`/campaign/${data.id}`);
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };
  // ---------------------------------------------------------------------------

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
            {/* ...remainder of render unchanged... */}
            {/* (omitted for brevity, see original code) */}
          </div>
        )}

        {/* ...other phases unchanged... */}
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
