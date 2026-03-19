import { useState, useEffect, useCallback } from "react";
import { useParams, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import Header from "@/components/Header";
import { supabase } from "@/integrations/supabase/client";
import { getAuthHeader } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  FileText,
  Users,
  Send,
  Lightbulb,
  Mail,
  Clock,
  ChevronDown,
  ChevronRight,
  Check,
  Loader2,
  Sparkles,
  Target,
  ArrowLeft,
  
  Archive,
  Info,
  X,
} from "lucide-react";

interface CampaignData {
  id: string;
  company: string;
  role: string;
  jd_text: string;
  cv_version: string;
  match_score: number;
  status: string;
  step_cv_done: boolean;
  step_connection_done: boolean;
  step_outreach_done: boolean;
  step_proof_done: boolean;
  step_linkedin_done: boolean;
  step_cover_letter_done: boolean;
  step_followup_done: boolean;
  connection_name: string | null;
  connection_url: string | null;
  outreach_message: string | null;
  proof_suggestion: string | null;
  linkedin_angles: string | null;
  cover_letter: string | null;
  followup_date: string | null;
  notes: string | null;
}

const STATUS_OPTIONS = [
  { value: "targeting", label: "Researching", color: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  { value: "applied", label: "Formally Applied", color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20" },
  { value: "followed_up", label: "Following Up", color: "bg-purple-500/10 text-purple-600 border-purple-500/20" },
  { value: "response_received", label: "In Conversation", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  { value: "rejected", label: "Not This Time", color: "bg-destructive/10 text-destructive border-destructive/20" },
];

// Step order: Set target → PoW → LinkedIn → Contact+Outreach
// Active steps for the beta launch flow
const ACTIVE_STEPS = [
  { key: "step_proof_done", label: "Set your target", weight: 25, icon: Target, subtext: "Define the company and role you're going after." },
  { key: "step_proof_done", label: "Generate your PoW brief", weight: 35, icon: Lightbulb, subtext: "This is the core of your campaign. Build something real that shows you can do the job — before you even apply." },
  { key: "step_linkedin_done", label: "Showcase your work before you pitch", weight: 20, icon: Users, subtext: "Post before you reach out. Tag the company, mention the space, ask a genuine question. Warm is better than cold." },
  { key: "step_outreach_done", label: "Find your contact and send outreach", weight: 20, icon: Send, subtext: "Find the right person at the company and reach out with your proof of work." },
] as const;

// Coming soon steps (hidden from active flow)
const COMING_SOON_STEPS = [
  { label: "CV tailoring", icon: FileText },
  { label: "Cover letter", icon: Mail },
  { label: "Follow up sequence", icon: Clock },
];

// Legacy STEPS kept for score calculation compatibility
const STEPS = [
  { key: "step_proof_done", label: "Build your proof of work", weight: 20, icon: Lightbulb, subtext: "" },
  { key: "step_linkedin_done", label: "Post about it on LinkedIn", weight: 5, icon: Users, subtext: "" },
  { key: "step_connection_done", label: "Find your contact", weight: 15, icon: Users, subtext: "" },
  { key: "step_outreach_done", label: "Send outreach", weight: 20, icon: Send, subtext: "" },
  { key: "step_cv_done", label: "CV ready", weight: 15, icon: FileText, subtext: "" },
  { key: "step_cover_letter_done", label: "Cover letter", weight: 10, icon: Mail, subtext: "" },
  { key: "step_followup_done", label: "Follow up", weight: 15, icon: Clock, subtext: "" },
] as const;

const BANNER_DISMISS_PREFIX = "preplane_campaign_banner_dismissed_";

const Campaign = () => {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [campaign, setCampaign] = useState<CampaignData | null>(null);
  const [loading, setLoading] = useState(true);
  const [openSteps, setOpenSteps] = useState<Set<number>>(new Set());
  const [generating, setGenerating] = useState<string | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [showApplyWarning, setShowApplyWarning] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);

  // Local editable state
  const [connectionName, setConnectionName] = useState("");
  const [connectionUrl, setConnectionUrl] = useState("");
  const [outreachMessage, setOutreachMessage] = useState("");
  const [proofSuggestion, setProofSuggestion] = useState("");
  const [coverLetter, setCoverLetter] = useState("");
  const [followups, setFollowups] = useState<{ day3: string; day7: string; day14: string }>({ day3: "", day7: "", day14: "" });
  const [followupSent, setFollowupSent] = useState<{ day3: boolean; day7: boolean; day14: boolean }>({ day3: false, day7: false, day14: false });
  const [notes, setNotes] = useState("");
  const [companyInput, setCompanyInput] = useState("");

  useEffect(() => {
    if (id) {
      setBannerDismissed(localStorage.getItem(BANNER_DISMISS_PREFIX + id) === "1");
    }
  }, [id]);

  useEffect(() => {
    if (authLoading || !user || !id) return;
    loadCampaign();
  }, [user, authLoading, id]);

  const loadCampaign = async () => {
    if (!id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", id)
      .single();
    if (error || !data) {
      toast({ title: "Campaign not found", variant: "destructive" });
      navigate("/app");
      return;
    }
    const c = data as any as CampaignData;
    
    console.log(`[PoW flow] Campaign ${id} loaded: proof_suggestion ${c.proof_suggestion ? 'PRESENT' : 'MISSING'}, cover_letter ${c.cover_letter ? 'PRESENT' : 'MISSING'}`);
    
    setCampaign(c);
    setConnectionName(c.connection_name || "");
    setConnectionUrl(c.connection_url || "");
    setOutreachMessage(c.outreach_message || "");
    setProofSuggestion(c.proof_suggestion || "");
    setCoverLetter(c.cover_letter || "");
    setNotes(c.notes || "");

    // Auto-mark cover letter step done if cover letter exists but step not yet marked
    if (c.cover_letter && !c.step_cover_letter_done) {
      await supabase.from("campaigns").update({ step_cover_letter_done: true }).eq("id", id);
      c.step_cover_letter_done = true;
    }

    // Auto-open the next incomplete active step
    const activeStepDone = [
      !!(c.company && c.role),
      c.step_proof_done,
      c.step_linkedin_done,
      c.step_outreach_done,
    ];
    const nextIdx = activeStepDone.findIndex((done) => !done);
    if (nextIdx >= 0) setOpenSteps(new Set([nextIdx]));
    setLoading(false);
  };

  const updateCampaign = useCallback(async (updates: Record<string, any>) => {
    if (!id) return;
    const { error } = await supabase.from("campaigns").update(updates).eq("id", id);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    setCampaign((prev) => prev ? { ...prev, ...updates } : prev);
  }, [id, toast]);

  const strengthScore = campaign
    ? [
        { done: !!(campaign.company && campaign.role), weight: 25 },
        { done: campaign.step_proof_done, weight: 35 },
        { done: campaign.step_linkedin_done, weight: 20 },
        { done: campaign.step_outreach_done, weight: 20 },
      ].reduce((sum, s) => sum + (s.done ? s.weight : 0), 0)
    : 0;

  const statusInfo = STATUS_OPTIONS.find((s) => s.value === campaign?.status) || STATUS_OPTIONS[0];

  const handleStatusChange = (val: string) => {
    if (!campaign) return;
    // Warn if trying to set "applied" before steps 2, 3, 4 are done
    if (val === "applied" && (!campaign.step_connection_done || !campaign.step_proof_done || !campaign.step_outreach_done)) {
      setPendingStatus(val);
      setShowApplyWarning(true);
      return;
    }
    updateCampaign({ status: val });
  };

  const confirmApplyAnyway = () => {
    if (pendingStatus) {
      updateCampaign({ status: pendingStatus });
    }
    setShowApplyWarning(false);
    setPendingStatus(null);
  };

  // AI generation
  const generateContent = async (contentType: string) => {
    if (!campaign) return;
    setGenerating(contentType);
    console.log(`[PoW flow] generateContent("${contentType}") for campaign ${id}, company: ${campaign.company}`);
    console.log(`[PoW flow] Campaign ${id} proof_suggestion: ${proofSuggestion ? 'PRESENT (' + proofSuggestion.slice(0, 80) + '...)' : 'MISSING'}`);
    try {
      const headers = await getAuthHeader();
      // PoW data is passed to ALL content types that benefit from it
      const needsPoW = ["outreach", "linkedin_angles", "cover_letter", "follow_up"];
      const powTitle = needsPoW.includes(contentType) ? getProofTitle() : undefined;
      const powDetails = ["linkedin_angles", "cover_letter", "follow_up"].includes(contentType) ? proofSuggestion : undefined;
      const powHook = contentType === "outreach" ? getProofHook() : undefined;

      console.log(`[PoW flow] ${contentType}: powTitle=${powTitle || 'none'}, powDetails=${powDetails ? 'PRESENT' : 'none'}, powHook=${powHook || 'none'}`);

      const { data, error } = await supabase.functions.invoke("generate-campaign-content", {
        headers,
        body: {
          contentType,
          company: campaign.company,
          role: campaign.role,
          jdText: campaign.jd_text,
          cvSummary: campaign.cv_version?.slice(0, 2000),
          connectionName: connectionName || undefined,
          proofOfWorkTitle: powTitle,
          proofOfWorkDetails: powDetails,
          proofOfWorkHook: powHook,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (contentType === "outreach" && data.message) {
        setOutreachMessage(data.message);
        await updateCampaign({ outreach_message: data.message });
        console.log(`[PoW flow] Outreach message stored for campaign ${id}`);
      } else if (contentType === "proof_of_work" && (data.project || data.title)) {
        const structured = JSON.stringify(data);
        setProofSuggestion(structured);
        await updateCampaign({ proof_suggestion: structured });
        console.log(`[PoW flow] PoW brief stored for campaign ${id}: ${structured.slice(0, 100)}...`);
      } else if (contentType === "linkedin_angles" && data.angles) {
        const anglesJson = JSON.stringify(data.angles);
        await updateCampaign({ linkedin_angles: anglesJson } as any);
        setCampaign((prev) => prev ? { ...prev, linkedin_angles: anglesJson } : prev);
      } else if (contentType === "follow_up") {
        setFollowups({ day3: data.day3 || "", day7: data.day7 || "", day14: data.day14 || "" });
      } else if (contentType === "cover_letter" && data.content) {
        setCoverLetter(data.content);
        await updateCampaign({ cover_letter: data.content });
      }
      toast({ title: "Content generated!" });
    } catch (e: any) {
      toast({ title: "Generation failed", description: e.message, variant: "destructive" });
    } finally {
      setGenerating(null);
    }
  };

  const getProofTitle = (): string | undefined => {
    if (!proofSuggestion) return undefined;
    try {
      const parsed = JSON.parse(proofSuggestion);
      return parsed?.project || parsed?.title;
    } catch {
      return proofSuggestion.split("\n")[0];
    }
  };

  const getProofHook = (): string | undefined => {
    if (!proofSuggestion) return undefined;
    try {
      const parsed = JSON.parse(proofSuggestion);
      return parsed?.outreach_hook;
    } catch {
      return undefined;
    }
  };

  const handleArchive = async () => {
    if (!id) return;
    await supabase.from("campaigns").update({ archived: true } as any).eq("id", id);
    toast({ title: "Campaign archived" });
    navigate("/app");
  };

  const dismissBanner = () => {
    if (id) localStorage.setItem(BANNER_DISMISS_PREFIX + id, "1");
    setBannerDismissed(true);
  };

  const toggleStep = (idx: number) => {
    setOpenSteps((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }
  if (!user) return <Navigate to="/onboarding" replace />;

  if (loading || !campaign) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#111111', color: '#ffffff' }}>
      <Header />
      <main className="mx-auto px-4 py-8 max-w-[800px] space-y-6">
        {/* Back button */}
        <Button variant="ghost" size="sm" onClick={() => navigate("/app")} className="text-[#94A3B8] hover:text-white">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to dashboard
        </Button>

        {/* Top: Company + Role + Status + Archive */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">{campaign.role}</h1>
            <p className="text-[#94A3B8]">{campaign.company}</p>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={campaign.status}
              onValueChange={handleStatusChange}
            >
              <SelectTrigger className="w-auto">
                <Badge variant="outline" className={statusInfo.color}>
                  {statusInfo.label}
                </Badge>
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground h-8 px-2">
                  <Archive className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Archive this campaign?</AlertDialogTitle>
                  <AlertDialogDescription>
                    It will be removed from your dashboard but you can still access it later.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleArchive}>Archive campaign</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Apply warning dialog */}
        <AlertDialog open={showApplyWarning} onOpenChange={setShowApplyWarning}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Pre-application steps incomplete</AlertDialogTitle>
              <AlertDialogDescription>
                You haven't completed your pre-application steps yet. Students who reach out with a proof of work before applying get significantly more responses. Are you sure you want to mark this as formally applied?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => { setShowApplyWarning(false); setPendingStatus(null); }}>
                Go back and complete steps
              </AlertDialogCancel>
              <AlertDialogAction onClick={confirmApplyAnyway}>Apply anyway</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Pre-apply banner */}
        {!bannerDismissed && (
          <div className="relative rounded-xl px-4 py-3 flex items-start gap-3" style={{ backgroundColor: '#1A1A1A', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px' }}>
            <Info className="h-4 w-4 text-[#F97416] mt-0.5 shrink-0" />
            <p className="text-sm text-[#94A3B8] flex-1">
              These steps are designed to be completed before you formally apply. A warm introduction and a proof of work will make your application 10x more memorable than a cold CV submission.
            </p>
            <button onClick={dismissBanner} className="text-[#94A3B8] hover:text-white shrink-0">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Campaign Strength — simplified for beta */}
        <div style={{ backgroundColor: '#1A1A1A', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '24px' }}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-[#F97416]" />
                <span className="font-semibold text-white">Campaign Progress</span>
              </div>
              <span className={`text-2xl font-bold ${strengthScore >= 80 ? "text-success" : strengthScore >= 50 ? "text-yellow-500" : "text-[#94A3B8]"}`}>
                {strengthScore}%
              </span>
            </div>
            <Progress value={strengthScore} className="h-3 bg-white/10 [&>div]:bg-[#F97416]" />
        </div>

        {/* ===== ACTIVE STEPS (Beta: 4 steps) ===== */}
        <div className="space-y-3">

          {/* STEP 1 — Set your target (kept as-is: company + role are shown in header) */}
          <StepCard
            index={0}
            step={ACTIVE_STEPS[0]}
            done={!!(campaign.company && campaign.role)}
            open={openSteps.has(0)}
            onToggle={() => toggleStep(0)}
          >
            <div className="space-y-3">
              <div className="rounded-xl p-4 space-y-2" style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px' }}>
                <div>
                  <p className="text-[11px] font-medium text-[#F97416] uppercase tracking-wider mb-1">Company</p>
                  <p className="text-sm font-semibold text-white">{campaign.company || "Not set"}</p>
                </div>
                <div>
                  <p className="text-[11px] font-medium text-[#F97416] uppercase tracking-wider mb-1">Role</p>
                  <p className="text-sm font-semibold text-white">{campaign.role || "Not set"}</p>
                </div>
                {campaign.match_score > 0 && (
                  <div>
                    <p className="text-[11px] font-medium text-[#F97416] uppercase tracking-wider mb-1">Match Score</p>
                    <p className={`text-sm font-semibold ${campaign.match_score >= 80 ? "text-success" : campaign.match_score >= 60 ? "text-yellow-500" : "text-destructive"}`}>
                      {campaign.match_score}%
                    </p>
                  </div>
                )}
              </div>
              {campaign.company && campaign.role && (
                <div className="flex items-center gap-2 text-success font-medium text-sm">
                  <Check className="h-5 w-5" />
                  <span>Target set — {campaign.company}, {campaign.role}</span>
                </div>
              )}
            </div>
          </StepCard>

          {/* STEP 2 — Generate your PoW brief (visually prominent) */}
          <div id="step-1" className="rounded-xl" style={{ backgroundColor: '#1A1A1A', border: campaign.step_proof_done ? '1px solid rgba(34,197,94,0.3)' : '2px solid rgba(249,116,22,0.4)', borderRadius: '12px' }}>
            <div
              className="pb-0 cursor-pointer select-none p-6"
              onClick={() => toggleStep(1)}
            >
              <div className="text-sm flex items-center gap-2">
                <span className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold ${campaign.step_proof_done ? "bg-success text-success-foreground" : "bg-[#F97416] text-white"}`}>
                  {campaign.step_proof_done ? <Check className="h-4 w-4" /> : 2}
                </span>
                <Lightbulb className={`h-5 w-5 ${campaign.step_proof_done ? "text-[#94A3B8]" : "text-[#F97416]"}`} />
                <span className="flex-1">
                  <span className={`font-semibold ${campaign.step_proof_done ? "text-white" : "text-[#F97416] font-bold"}`}>Generate your PoW brief</span>
                  <span className="block text-xs font-normal text-[#94A3B8] mt-0.5">
                    This is the core of your campaign. Build something real that shows you can do the job — before you even apply.
                  </span>
                </span>
                {openSteps.has(1) ? <ChevronDown className="h-4 w-4 text-[#94A3B8]" /> : <ChevronRight className="h-4 w-4 text-[#94A3B8]" />}
              </div>
            </div>
            {openSteps.has(1) && (
              <div className="px-6 pb-6 pt-0">
                <div className="space-y-3">
                  <Button
                    size="sm"
                    onClick={() => generateContent("proof_of_work")}
                    disabled={!!generating}
                  >
                    {generating === "proof_of_work" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
                    Generate proof of work idea
                  </Button>
                  {proofSuggestion && (() => {
                    let parsed: any = null;
                    try { parsed = JSON.parse(proofSuggestion); } catch { /* legacy plain text */ }
                    if (parsed && (parsed.project || parsed.title) && (parsed.build_steps || parsed.what_to_build)) {
                      if (parsed.build_steps) {
                      return (
                          <div className="space-y-5 rounded-xl p-4" style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px' }}>
                            <div>
                              <p className="text-[11px] font-medium text-[#F97416] uppercase tracking-wider mb-1">The Project</p>
                              <p className="text-sm font-semibold text-white">{parsed.project}</p>
                            </div>
                            <div>
                              <p className="text-[11px] font-medium text-[#F97416] uppercase tracking-wider mb-1">Why This Works</p>
                              <p className="text-sm text-[#94A3B8]">{parsed.why_this_works}</p>
                            </div>
                            <div>
                              <p className="text-[11px] font-medium text-[#F97416] uppercase tracking-wider mb-1">How to Build It — Step by Step</p>
                              <ol className="list-decimal pl-5 space-y-2">
                                {(parsed.build_steps as string[]).map((step: string, i: number) => (
                                  <li key={i} className="text-sm text-[#94A3B8]">{step}</li>
                                ))}
                              </ol>
                              <p className="flex items-center gap-1 text-xs text-green-600 mt-2">
                                <Check className="h-3 w-3" />
                                All tools listed are free or freemium — no budget needed.
                              </p>
                            </div>
                            <div>
                              <p className="text-[11px] font-medium text-[#F97416] uppercase tracking-wider mb-1">What the Final Output Should Look Like</p>
                              <p className="text-sm text-[#94A3B8]">{parsed.final_output}</p>
                            </div>
                            {parsed.effort_guide && (
                              <div>
                                <p className="text-[11px] font-medium text-[#F97416] uppercase tracking-wider mb-2">Effort Guide</p>
                                <div className="space-y-2">
                                  <div className="rounded-md border border-[rgba(255,255,255,0.08)] p-3" style={{ background: "#1A1A1A" }}>
                                    <p className="text-xs font-semibold text-[#F97416] mb-0.5">Minimum (gets noticed)</p>
                                    <p className="text-sm text-[#94A3B8]">{parsed.effort_guide.minimum}</p>
                                  </div>
                                  <div className="rounded-md border border-[rgba(255,255,255,0.08)] p-3" style={{ background: "#1A1A1A" }}>
                                    <p className="text-xs font-semibold text-[#F97416] mb-0.5">Impressive (gets forwarded)</p>
                                    <p className="text-sm text-[#94A3B8]">{parsed.effort_guide.impressive}</p>
                                  </div>
                                </div>
                              </div>
                            )}
                            <div>
                              <p className="text-[11px] font-medium text-[#F97416] uppercase tracking-wider mb-1">The Insight to Include</p>
                              <p className="text-sm italic text-[#94A3B8]">{parsed.key_insight}</p>
                            </div>
                            <div>
                              <p className="text-[11px] font-medium text-[#F97416] uppercase tracking-wider mb-1">Your Outreach Hook</p>
                              <div className="relative">
                                <p className="text-sm rounded-md p-3 font-medium text-white" style={{ backgroundColor: 'rgba(249,116,22,0.08)', border: '1px solid rgba(249,116,22,0.2)' }}>{parsed.outreach_hook}</p>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="absolute top-1 right-1 h-7 text-xs"
                                  onClick={() => { navigator.clipboard.writeText(parsed.outreach_hook); toast({ title: "Hook copied!" }); }}
                                >
                                  Copy
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      // Legacy format
                      return (
                        <div className="space-y-4 rounded-xl p-4" style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px' }}>
                          <h4 className="font-semibold text-base text-white">{parsed.title}</h4>
                          <div>
                            <p className="text-[11px] font-medium text-[#F97416] uppercase tracking-wider mb-1">Why this works</p>
                            <p className="text-sm text-[#94A3B8]">{parsed.why_this_works}</p>
                          </div>
                          <div>
                            <p className="text-[11px] font-medium text-[#F97416] uppercase tracking-wider mb-1">What to build</p>
                            <ul className="list-disc pl-5 space-y-1">
                              {(parsed.what_to_build as string[]).map((b: string, i: number) => (
                                <li key={i} className="text-sm text-[#94A3B8]">{b}</li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <p className="text-[11px] font-medium text-[#F97416] uppercase tracking-wider mb-1">Tools to use</p>
                            <div className="flex flex-wrap gap-1.5">
                              {(parsed.tools_to_use as string[]).map((t: string, i: number) => (
                                <span key={i} className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">{t}</span>
                              ))}
                            </div>
                            <p className="flex items-center gap-1 text-xs text-green-600 mt-2">
                              <Check className="h-3 w-3" />
                              All tools listed are free or freemium — no budget needed.
                            </p>
                          </div>
                          <div>
                            <p className="text-[11px] font-medium text-[#F97416] uppercase tracking-wider mb-1">Time estimate</p>
                            <p className="text-sm text-[#94A3B8]">{parsed.time_estimate}</p>
                          </div>
                          {parsed.ai_prompt && (
                            <div>
                              <p className="text-[11px] font-medium text-[#F97416] uppercase tracking-wider mb-1">Ready-to-use AI prompt</p>
                              <div className="relative">
                                <pre className="text-xs rounded-md p-3 whitespace-pre-wrap font-sans text-[#94A3B8]" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>{parsed.ai_prompt}</pre>
                                <Button variant="ghost" size="sm" className="absolute top-1 right-1 h-7 text-xs"
                                  onClick={() => { navigator.clipboard.writeText(parsed.ai_prompt); toast({ title: "Prompt copied!" }); }}>Copy</Button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    }
                    // Legacy fallback: plain text
                    return (
                      <Textarea
                        value={proofSuggestion}
                        onChange={(e) => setProofSuggestion(e.target.value)}
                        onBlur={() => updateCampaign({ proof_suggestion: proofSuggestion })}
                        rows={5}
                        className="text-sm"
                      />
                    );
                  })()}
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="proof-done"
                      checked={campaign.step_proof_done}
                      onCheckedChange={(checked) => updateCampaign({ step_proof_done: !!checked, proof_in_progress: false, proof_suggestion: proofSuggestion || null } as any)}
                    />
                    <label htmlFor="proof-done" className="text-sm text-[#94A3B8]">I've completed this</label>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* STEP 3 — Post about it on LinkedIn */}
          <StepCard
            index={2}
            step={ACTIVE_STEPS[2]}
            done={campaign.step_linkedin_done}
            open={openSteps.has(2)}
            onToggle={() => toggleStep(2)}
          >
            <div className="space-y-5">
              {/* Intro text */}
              <p style={{ color: '#94A3B8', fontSize: '15px', lineHeight: 1.7, margin: 0 }}>
                Don't reach out cold. Post about what you built first.
                <br /><br />
                When your DM arrives, there's a chance they've already seen your work — that changes the entire conversation.
                <br /><br />
                Personal branding isn't vanity. It's your warmest possible introduction.
              </p>
              {/* New note at the top */}
              <div className="rounded-xl px-4 py-3" style={{ backgroundColor: 'rgba(249,116,22,0.08)', border: '1px solid rgba(249,116,22,0.2)', borderRadius: '12px' }}>
                <p className="text-sm text-white font-medium">
                  ✍️ Write this yourself — authenticity is everything. We give you the angle, you write the words.
                </p>
              </div>

              {/* AI-generated angles */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-medium text-[#F97416] uppercase tracking-wider">What to write about</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => generateContent("linkedin_angles")}
                    disabled={!!generating || !proofSuggestion}
                  >
                    {generating === "linkedin_angles" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
                    {(() => {
                      try { return JSON.parse(campaign.linkedin_angles || "null") ? "Regenerate angles" : "Generate angles"; } catch { return "Generate angles"; }
                    })()}
                  </Button>
                </div>
                {!proofSuggestion && (
                  <p className="text-xs text-muted-foreground">Complete your proof of work first — we need it to suggest specific angles.</p>
                )}
                {(() => {
                  let angles: string[] | null = null;
                  try { angles = JSON.parse(campaign.linkedin_angles || "null"); } catch {}
                  if (!angles) return null;
                  return (
                    <ul className="space-y-2">
                      {angles.map((angle: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <span className="mt-0.5 h-5 w-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">{i + 1}</span>
                          {angle}
                        </li>
                      ))}
                    </ul>
                  );
                })()}
              </div>

              {/* Playbook */}
              <div className="space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">PrepLane's LinkedIn playbook</p>
                <div className="rounded-lg border bg-muted/30 p-4 space-y-3 text-sm">
                  <p>✍️ <strong>Write it yourself</strong> — authenticity is detectable. AI-written posts get ignored.</p>
                  <p>🕐 <strong>Post in real time, never schedule</strong> — scheduled posts get less reach</p>
                  <p>💬 <strong>Answer every comment within the first hour</strong> — early interaction is gold for the algorithm</p>
                  <p>🔗 <strong>Put links in the comments, never in the post</strong> — LinkedIn suppresses posts with external links</p>
                  <p>🏷️ <strong>Use 3–5 relevant hashtags</strong> — no more, no less</p>
                  <p>👥 <strong>Tag people mentioned in your work</strong> — but only if it adds value, not just for reach</p>
                  <p>📅 <strong>Post consistently</strong> — once a week minimum, same days if possible</p>
                  <p>💡 <strong>Leave genuine comments on others' posts daily</strong> — this increases your own reach significantly</p>
                </div>
              </div>

              {campaign.step_linkedin_done ? (
                <div className="flex items-center gap-2 text-success font-medium text-sm">
                  <Check className="h-5 w-5" />
                  <span>Posted ✓ — nice work. Now find your contact, they may have already seen it.</span>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="default"
                  className="bg-success hover:bg-success/90"
                  onClick={() => {
                    updateCampaign({ step_linkedin_done: true } as any);
                    setTimeout(() => {
                      setOpenSteps((prev) => {
                        const next = new Set(prev);
                        next.delete(2);
                        return next;
                      });
                    }, 1500);
                  }}
                >
                  <Check className="h-4 w-4 mr-1" /> I've posted it →
                </Button>
              )}
            </div>
          </StepCard>

          {/* STEP 4 — Find your contact and send outreach (merged) */}
          <StepCard
            index={3}
            step={ACTIVE_STEPS[3]}
            done={campaign.step_outreach_done}
            open={openSteps.has(3)}
            onToggle={() => toggleStep(3)}
          >
            <div className="space-y-6">
              {/* Section A: Who to look for */}
              <div className="space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Who to look for</p>
                <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                  <p className="text-sm">
                    Look for someone at <span className="font-semibold">{campaign.company}</span> who is either:
                  </p>
                  <ul className="list-disc pl-5 space-y-1 text-sm">
                    <li>The hiring manager for the <span className="font-semibold">{campaign.role}</span> role</li>
                    <li>A team lead or senior IC in the same department</li>
                    <li>A recruiter who recently posted about this team or role</li>
                  </ul>
                  <p className="text-xs text-muted-foreground mt-2">
                    Search LinkedIn for "{campaign.company} {campaign.role}" — look for someone 1–2 levels above the role you're targeting.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const query = encodeURIComponent(`${campaign.company} ${campaign.role}`);
                    window.open(`https://www.linkedin.com/search/results/people/?keywords=${query}`, "_blank");
                  }}
                >
                  Open LinkedIn → 
                </Button>
              </div>

              {/* Contact info inputs */}
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">Name of someone at {campaign.company}</label>
                  <Input
                    value={connectionName}
                    onChange={(e) => setConnectionName(e.target.value)}
                    onBlur={() => updateCampaign({ connection_name: connectionName || null })}
                    placeholder="e.g. Sarah Chen"
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Their LinkedIn URL (optional)</label>
                  <Input
                    value={connectionUrl}
                    onChange={(e) => setConnectionUrl(e.target.value)}
                    onBlur={() => updateCampaign({ connection_url: connectionUrl || null })}
                    placeholder="https://linkedin.com/in/..."
                    className="mt-1"
                  />
                </div>
              </div>

              {/* Section B: Outreach message */}
              <div className="space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Your outreach message</p>

                {!campaign.company || campaign.company.trim() === "" ? (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Which company are you targeting with this outreach?</label>
                    <div className="flex gap-2">
                      <Input
                        value={companyInput}
                        onChange={(e) => setCompanyInput(e.target.value)}
                        placeholder="e.g. Stripe"
                        className="flex-1"
                      />
                      <Button
                        size="sm"
                        disabled={!companyInput.trim()}
                        onClick={async () => {
                          const name = companyInput.trim();
                          if (!name) return;
                          await updateCampaign({ company: name });
                          setCompanyInput("");
                        }}
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    {!getProofHook() ? (
                      <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 space-y-1">
                        <p className="font-semibold">Generate your Proof of Work first — your outreach needs to lead with something real.</p>
                        <p className="text-amber-800/80 text-xs">Your PoW brief includes an outreach hook that becomes the opening line of your message. Without it, outreach is generic.</p>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => generateContent("outreach")}
                        disabled={!!generating}
                      >
                        {generating === "outreach" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
                        Generate outreach message
                      </Button>
                    )}
                  </>
                )}
                {outreachMessage && (
                  <div className="space-y-2">
                    <Textarea
                      value={outreachMessage}
                      onChange={(e) => setOutreachMessage(e.target.value)}
                      onBlur={() => updateCampaign({ outreach_message: outreachMessage })}
                      rows={5}
                      className="text-sm"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText(outreachMessage);
                        toast({ title: "Copied to clipboard!" });
                      }}
                    >
                      Copy message
                    </Button>
                  </div>
                )}
              </div>

              {/* Mark as done */}
              <Button
                size="sm"
                variant="default"
                className="bg-success hover:bg-success/90"
                disabled={!connectionName}
                onClick={async () => {
                  const followDate = new Date();
                  followDate.setDate(followDate.getDate() + 7);
                  await updateCampaign({
                    step_outreach_done: true,
                    step_connection_done: true,
                    connection_name: connectionName,
                    connection_url: connectionUrl || null,
                    outreach_message: outreachMessage || null,
                    followup_date: followDate.toISOString(),
                  });
                  toast({ title: "Marked as sent! Follow-up set for 7 days." });
                }}
              >
                <Check className="h-4 w-4 mr-1" /> Mark as sent
              </Button>
            </div>
          </StepCard>
        </div>

        {/* ===== COMING SOON CARDS ===== */}
        <div className="space-y-3 mt-8">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground px-1">More tools — coming soon</p>
          {COMING_SOON_STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <Card key={step.label} className="opacity-50 cursor-default">
                <CardHeader className="pb-0">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <span className="h-6 w-6 rounded-full flex items-center justify-center bg-muted text-muted-foreground text-xs">—</span>
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1 text-muted-foreground">{step.label}</span>
                    <Badge className="bg-[#F97316]/15 text-[#F97316] border-[#F97316]/30 hover:bg-[#F97316]/15 text-xs">
                      Coming soon
                    </Badge>
                  </CardTitle>
                </CardHeader>
              </Card>
            );
          })}
        </div>

        {/* Notes */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Notes — what worked, what didn't</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => updateCampaign({ notes: notes || null })}
              rows={4}
              placeholder="Reflect on this campaign..."
              className="text-sm"
            />
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

// Step Card component
function StepCard({
  index,
  step,
  done,
  open,
  onToggle,
  children,
  isOutcome,
}: {
  index: number;
  step: { label: string; weight: number; icon: any; subtext: string };
  done: boolean;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  isOutcome?: boolean;
}) {
  const Icon = step.icon;
  return (
    <Card id={`step-${index}`} className={done ? "border-success/30" : ""}>
      <CardHeader
        className="pb-0 cursor-pointer select-none"
        onClick={onToggle}
      >
        <CardTitle className="text-sm flex items-center gap-2">
          <span className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${done ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"}`}>
            {done ? <Check className="h-3.5 w-3.5" /> : index + 1}
          </span>
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="flex-1">
            {step.label}
            {step.subtext && (
              <span className="block text-xs font-normal text-muted-foreground mt-0.5">{step.subtext}</span>
            )}
          </span>
          {!isOutcome && (
            <span className="text-xs text-muted-foreground font-normal">{step.weight}%</span>
          )}
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </CardTitle>
      </CardHeader>
      {open && <CardContent className="pt-4">{children}</CardContent>}
    </Card>
  );
}

export default Campaign;
