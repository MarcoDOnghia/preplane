import { useState, useEffect, useCallback } from "react";
import { useParams, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import Header from "@/components/Header";
import { supabase } from "@/integrations/supabase/client";
import { getAuthHeader } from "@/lib/auth";
import BriefNavigator from "@/components/BriefNavigator";
import ProofCardBuilder from "@/components/ProofCardBuilder";
import { useToast } from "@/hooks/use-toast";
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
  FileText,
  Users,
  Send,
  Lightbulb,
  Mail,
  Clock,
  Check,
  Loader2,
  Sparkles,
  Target,
  ArrowLeft,
  ArrowRight,
  Archive,
  Hammer,
  Pencil,
  Copy,
  CreditCard,
  Check,
  Loader2,
  Sparkles,
  Target,
  ArrowLeft,
  ArrowRight,
  Archive,
  Hammer,
  Pencil,
  Copy,
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
  { value: "targeting", label: "Building my PoW", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  { value: "pow_ready", label: "PoW ready", color: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
  { value: "posted", label: "Posted", color: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
  { value: "applied", label: "Outreach sent", color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
  { value: "followed_up", label: "Following up", color: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
  { value: "response_received", label: "In conversation", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  { value: "rejected", label: "Not this time", color: "bg-red-500/10 text-red-400 border-red-500/20" },
];

const WIZARD_STEPS = [
  { label: "PoW Brief", icon: Lightbulb },
  { label: "Build It", icon: Hammer },
  { label: "LinkedIn", icon: Users },
  { label: "Outreach", icon: Send },
];

// Confirmation modal content per step
const STEP_CONFIRMATIONS = [
  {
    headline: "Did you generate your brief?",
    subtext: "Your proof of work brief is the foundation of your entire campaign. Without it, the next steps won't land.",
    confirmLabel: "Yes, I have my brief →",
    confirmColor: "#F97416",
    cancelLabel: "Let me finish this first",
  },
  {
    headline: "Have you built your proof of work?",
    subtext: "This is the most important step. Don't skip it. A half-built PoW is worse than none.",
    confirmLabel: "Yes, I built it →",
    confirmColor: "#F97416",
    cancelLabel: "Still working on it",
  },
  {
    headline: "Did you post about it?",
    subtext: "Posting before you pitch warms up the conversation. Skip this and your outreach goes cold.",
    confirmLabel: "Yes, I posted it →",
    confirmColor: "#22c55e",
    cancelLabel: "I'll skip this time",
  },
  {
    headline: "Did you send your outreach?",
    subtext: "Mark this campaign as sent and track the response.",
    confirmLabel: "Sent — tracking response",
    confirmColor: "#22c55e",
    cancelLabel: "Not yet",
  },
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

const Campaign = () => {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [campaign, setCampaign] = useState<CampaignData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [generating, setGenerating] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [celebratingStep, setCelebratingStep] = useState<number | null>(null);
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

    // Determine completed steps and current step
    const done = new Set<number>();
    // Step 0: PoW brief generated
    if (c.proof_suggestion) done.add(0);
    // Step 1: Built (using step_proof_done as the "I built it" marker)
    if (c.step_proof_done) done.add(1);
    // Step 2: LinkedIn posted
    if (c.step_linkedin_done) done.add(2);
    // Step 3: Outreach sent
    if (c.step_outreach_done) done.add(3);
    setCompletedSteps(done);

    // Auto-navigate to next incomplete step
    const nextIncomplete = [0, 1, 2, 3].find((i) => !done.has(i));
    setCurrentStep(nextIncomplete ?? 3);
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
        { done: !!campaign.proof_suggestion, weight: 25 },
        { done: campaign.step_proof_done, weight: 35 },
        { done: campaign.step_linkedin_done, weight: 20 },
        { done: campaign.step_outreach_done, weight: 20 },
      ].reduce((sum, s) => sum + (s.done ? s.weight : 0), 0)
    : 0;

  const statusInfo = STATUS_OPTIONS.find((s) => s.value === campaign?.status) || STATUS_OPTIONS[0];

  const handleStatusChange = (val: string) => {
    if (!campaign) return;
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
    try {
      const headers = await getAuthHeader();
      const needsPoW = ["outreach", "linkedin_angles", "cover_letter", "follow_up"];
      const powTitle = needsPoW.includes(contentType) ? getProofTitle() : undefined;
      const powDetails = ["linkedin_angles", "cover_letter", "follow_up"].includes(contentType) ? proofSuggestion : undefined;
      const powHook = contentType === "outreach" ? getProofHook() : undefined;

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
      } else if (contentType === "proof_of_work" && (data.project || data.title)) {
        const structured = JSON.stringify(data);
        setProofSuggestion(structured);
        await updateCampaign({ proof_suggestion: structured });
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

  // Step completion + celebration
  const completeStep = async (stepIndex: number) => {
    setCompletedSteps((prev) => new Set(prev).add(stepIndex));
    setCelebratingStep(stepIndex);
    setTimeout(() => setCelebratingStep(null), 1200);

    // Update status automatically
    const statusMap: Record<number, string> = {
      0: "targeting",
      1: "pow_ready",
      2: "posted",
      3: "applied",
    };
    const newStatus = statusMap[stepIndex];

    if (stepIndex === 1) {
      await updateCampaign({ step_proof_done: true, proof_in_progress: false, proof_suggestion: proofSuggestion || null, status: newStatus } as any);
    } else if (stepIndex === 2) {
      await updateCampaign({ step_linkedin_done: true, status: newStatus } as any);
    } else if (stepIndex === 3) {
      const followDate = new Date();
      followDate.setDate(followDate.getDate() + 7);
      await updateCampaign({
        step_outreach_done: true,
        step_connection_done: true,
        connection_name: connectionName,
        connection_url: connectionUrl || null,
        outreach_message: outreachMessage || null,
        followup_date: followDate.toISOString(),
        status: newStatus,
      });
      toast({ title: "Marked as sent! Follow-up set for 7 days." });
    } else if (stepIndex === 0) {
      await updateCampaign({ status: newStatus });
    }

    // Advance to next step
    if (stepIndex < 3) {
      setTimeout(() => setCurrentStep(stepIndex + 1), 600);
    }
    setShowConfirmModal(false);
  };

  const handleNext = () => {
    setShowConfirmModal(true);
  };

  const handlePrevious = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: '#111111' }}>
        <div className="animate-spin h-8 w-8 border-4 border-[#F97416] border-t-transparent rounded-full" />
      </div>
    );
  }
  if (!user) return <Navigate to="/onboarding" replace />;

  if (loading || !campaign) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#111111' }}>
        <Header />
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin h-8 w-8 border-4 border-[#F97416] border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#111111', color: '#ffffff' }}>
      <Header />
      <main className="mx-auto px-4 py-6 max-w-[800px] space-y-6">
        {/* Top bar: Back + Title + Status + Archive */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate("/app")} className="text-[#94A3B8] hover:text-white">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div className="flex items-center gap-2">
            <Select value={campaign.status} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-auto border-0 bg-transparent p-0 h-auto shadow-none focus:ring-0">
                <Badge variant="outline" className={statusInfo.color}>{statusInfo.label}</Badge>
              </SelectTrigger>
              <SelectContent style={{ backgroundColor: '#1A1A1A', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px' }}>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value} className="text-white hover:bg-[#242424] focus:bg-[#242424] focus:text-[#F97416] data-[state=checked]:text-[#F97416]">
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-[#94A3B8] hover:text-white h-8 px-2">
                  <Archive className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent style={{ backgroundColor: '#1A1A1A', border: '1px solid rgba(255,255,255,0.08)' }}>
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-white">Archive this campaign?</AlertDialogTitle>
                  <AlertDialogDescription className="text-[#94A3B8]">
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

        {/* Page header */}
        <div className="text-center">
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#ffffff', lineHeight: 1.2 }}>{campaign.role}</h1>
          <p style={{ fontSize: '16px', color: '#94A3B8', marginTop: '4px' }}>{campaign.company}</p>
        </div>

        {/* Progress pills */}
        <div className="flex items-center justify-center gap-2">
          {WIZARD_STEPS.map((step, i) => {
            const Icon = step.icon;
            const isActive = i === currentStep;
            const isDone = completedSteps.has(i);
            const isCelebrating = celebratingStep === i;
            return (
              <button
                key={i}
                onClick={() => setCurrentStep(i)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold transition-all duration-300"
                style={{
                  backgroundColor: isDone ? '#22c55e' : isActive ? '#F97416' : '#242424',
                  color: isDone || isActive ? '#ffffff' : '#64748B',
                  transform: isCelebrating ? 'scale(1.15)' : 'scale(1)',
                  boxShadow: isCelebrating ? '0 0 20px rgba(34,197,94,0.5)' : 'none',
                }}
              >
                {isDone ? <Check className="h-3 w-3" /> : <span>{i + 1}</span>}
                <span className="hidden sm:inline">{step.label}</span>
              </button>
            );
          })}
        </div>
        <p style={{ color: '#64748B', fontSize: '13px', textAlign: 'center' }}>Step {currentStep + 1} of 4</p>

        {/* Campaign progress bar */}
        <div style={{ backgroundColor: '#1A1A1A', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '16px' }}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-[#F97416]" />
              <span className="text-sm font-medium text-white">Campaign Progress</span>
            </div>
            <span className="text-sm font-bold text-[#94A3B8]">{strengthScore}%</span>
          </div>
          <Progress value={strengthScore} className="h-2 bg-white/10 [&>div]:bg-[#F97416]" />
        </div>

        {/* Step content area */}
        <div
          className="transition-opacity duration-300"
          style={{
            backgroundColor: '#1A1A1A',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '16px',
            padding: '40px',
          }}
        >
          {currentStep === 0 && <Step1Content campaign={campaign} proofSuggestion={proofSuggestion} generating={generating} generateContent={generateContent} toast={toast} updateCampaign={updateCampaign} />}
          {currentStep === 1 && <Step2Content campaign={campaign} proofSuggestion={proofSuggestion} getProofHook={getProofHook} getProofTitle={getProofTitle} />}
          {currentStep === 2 && <Step3Content campaign={campaign} proofSuggestion={proofSuggestion} generating={generating} generateContent={generateContent} getProofHook={getProofHook} toast={toast} />}
          {currentStep === 3 && <Step4Content campaign={campaign} connectionName={connectionName} setConnectionName={setConnectionName} connectionUrl={connectionUrl} setConnectionUrl={setConnectionUrl} outreachMessage={outreachMessage} setOutreachMessage={setOutreachMessage} companyInput={companyInput} setCompanyInput={setCompanyInput} generating={generating} generateContent={generateContent} updateCampaign={updateCampaign} getProofHook={getProofHook} toast={toast} />}
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={handlePrevious}
            disabled={currentStep === 0}
            className="text-[#94A3B8] hover:text-white disabled:opacity-30"
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Previous
          </Button>
          <Button
            onClick={handleNext}
            style={{ backgroundColor: currentStep >= 2 ? '#22c55e' : '#F97416' }}
            className="text-white font-semibold hover:opacity-90"
          >
            {currentStep === 3 ? "Complete" : "Next"} <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>

        {/* Notes section */}
        <div className="rounded-xl" style={{ backgroundColor: '#1A1A1A', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px' }}>
          <div className="p-6 pb-3">
            <h3 className="text-sm font-semibold text-white">Campaign notes</h3>
          </div>
          <div className="px-6 pb-6 space-y-3">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => updateCampaign({ notes: notes || null })}
              rows={5}
              placeholder={"What did you build?\n\nWhat response did you get?\n\nWhat would you do differently?"}
              className="text-sm campaign-notes-textarea"
              style={{ backgroundColor: '#1A1A1A', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: 'white' }}
            />
            <p style={{ color: '#64748B', fontSize: '12px' }}>Your notes help you improve your next campaign. PrepLane learns from what works.</p>
          </div>
        </div>

        {/* Apply warning dialog */}
        <AlertDialog open={showApplyWarning} onOpenChange={setShowApplyWarning}>
          <AlertDialogContent style={{ backgroundColor: '#1A1A1A', border: '1px solid rgba(255,255,255,0.08)' }}>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-white">Pre-application steps incomplete</AlertDialogTitle>
              <AlertDialogDescription className="text-[#94A3B8]">
                You haven't completed your pre-application steps yet. Are you sure?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => { setShowApplyWarning(false); setPendingStatus(null); }}>Go back</AlertDialogCancel>
              <AlertDialogAction onClick={confirmApplyAnyway}>Apply anyway</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Step confirmation modal */}
        {showConfirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
            <div style={{ backgroundColor: '#1A1A1A', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '32px', maxWidth: '400px', width: '100%', margin: '0 16px' }}>
              <h3 style={{ color: '#ffffff', fontSize: '20px', fontWeight: 700, marginBottom: '12px' }}>
                {STEP_CONFIRMATIONS[currentStep].headline}
              </h3>
              <p style={{ color: '#94A3B8', fontSize: '14px', lineHeight: 1.6, marginBottom: '24px' }}>
                {STEP_CONFIRMATIONS[currentStep].subtext}
              </p>
              <div className="space-y-2">
                <button
                  onClick={() => completeStep(currentStep)}
                  className="w-full py-3 rounded-lg text-white font-semibold text-sm transition-opacity hover:opacity-90"
                  style={{ backgroundColor: STEP_CONFIRMATIONS[currentStep].confirmColor }}
                >
                  {STEP_CONFIRMATIONS[currentStep].confirmLabel}
                </button>
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="w-full py-3 rounded-lg text-sm font-medium transition-colors hover:bg-white/5"
                  style={{ color: '#94A3B8', backgroundColor: '#242424' }}
                >
                  {STEP_CONFIRMATIONS[currentStep].cancelLabel}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

// ==================== STEP 1: Generate PoW Brief ====================
function Step1Content({ campaign, proofSuggestion, generating, generateContent, toast, updateCampaign }: any) {
  let parsed: any = null;
  try { parsed = JSON.parse(proofSuggestion || ""); } catch {}
  const hasStructuredBrief = parsed && (parsed.project || parsed.title) && parsed.build_steps;

  return (
    <div className="space-y-6">
      <div>
        <h2 style={{ color: '#ffffff', fontSize: '22px', fontWeight: 700, marginBottom: '8px' }}>Generate your PoW brief</h2>
        {!proofSuggestion && (
          <p style={{ color: '#94A3B8', fontSize: '15px', lineHeight: 1.7 }}>
            This is the core of your campaign. Everything else builds on this.
          </p>
        )}
      </div>

      <Button
        size="sm"
        onClick={() => generateContent("proof_of_work")}
        disabled={!!generating}
        style={{ backgroundColor: '#F97416' }}
        className="text-white"
      >
        {generating === "proof_of_work" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
        {proofSuggestion ? "Regenerate proof of work idea" : "Generate proof of work idea"}
      </Button>

      {hasStructuredBrief ? (
        <BriefNavigator proofBrief={parsed} company={campaign.company} toast={toast} />
      ) : proofSuggestion ? (
        <PowBriefDisplay proofSuggestion={proofSuggestion} toast={toast} />
      ) : null}
    </div>
  );
}

// ==================== STEP 2: Build It ====================
function Step2Content({ campaign, proofSuggestion, getProofHook, getProofTitle }: any) {
  const hook = getProofHook();
  const title = getProofTitle();

  return (
    <div className="space-y-6">
      <div>
        <h2 style={{ color: '#ffffff', fontSize: '22px', fontWeight: 700, marginBottom: '8px' }}>Now go build it.</h2>
        <p style={{ color: '#94A3B8', fontSize: '15px', lineHeight: 1.7 }}>
          Use your brief as your guide. Come back when you have something real to show.
        </p>
      </div>

      {title && (
        <div style={{ backgroundColor: '#242424', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '20px' }}>
          <p style={{ color: '#F97416', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: '8px' }}>Your project</p>
          <p style={{ color: '#ffffff', fontSize: '16px', fontWeight: 600 }}>{title}</p>
        </div>
      )}

      {hook && (
        <div>
          <p style={{ color: '#94A3B8', fontSize: '14px', marginBottom: '12px' }}>When you're done, you'll send this:</p>
          <div style={{ backgroundColor: 'rgba(249,116,22,0.08)', border: '1px solid rgba(249,116,22,0.2)', borderRadius: '12px', padding: '20px' }}>
            <p style={{ color: '#ffffff', fontSize: '15px', fontWeight: 500, lineHeight: 1.6 }}>{hook}</p>
          </div>
        </div>
      )}

      {!proofSuggestion && (
        <div style={{ backgroundColor: '#242424', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '20px' }}>
          <p style={{ color: '#94A3B8', fontSize: '14px' }}>Go back to Step 1 and generate your PoW brief first.</p>
        </div>
      )}
    </div>
  );
}

// ==================== STEP 3: LinkedIn ====================
const WRITING_STYLES = ["Direct and punchy", "Conversational", "Formal", "Casual and personal"];

function Step3Content({ campaign, proofSuggestion, generating, generateContent, getProofHook, toast }: any) {
  const [selectedStyle, setSelectedStyle] = useState("Direct and punchy");
  const [selectedAngle, setSelectedAngle] = useState<string | null>(null);
  const [generatedPost, setGeneratedPost] = useState("");
  const [generatingPost, setGeneratingPost] = useState(false);

  const handleGeneratePost = async () => {
    const hook = getProofHook();
    if (!hook) {
      toast({ title: "Complete your proof of work first", variant: "destructive" });
      return;
    }
    setGeneratingPost(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-linkedin-post", {
        body: {
          company: campaign.company,
          role: campaign.role,
          outreachHook: hook,
          writingStyle: selectedStyle,
          selectedAngle: selectedAngle || undefined,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setGeneratedPost(data.post || "");
    } catch (e: any) {
      toast({ title: e.message || "Failed to generate post", variant: "destructive" });
    } finally {
      setGeneratingPost(false);
    }
  };

  // Parse angles for selection
  let angles: any[] | null = null;
  try { angles = JSON.parse(campaign.linkedin_angles || "null"); } catch {}

  return (
    <div className="space-y-6">
      <div>
        <h2 style={{ color: '#ffffff', fontSize: '22px', fontWeight: 700, marginBottom: '8px' }}>Showcase your work before you pitch</h2>
        <p style={{ color: '#94A3B8', fontSize: '15px', lineHeight: 1.7 }}>
          Don't reach out cold. Post about what you built first.
          <br /><br />
          When your DM arrives, there's a chance they've already seen your work — that changes the entire conversation.
          <br /><br />
          Personal branding isn't vanity. It's your warmest possible introduction.
        </p>
      </div>

      {/* DO THIS FIRST */}
      <div>
        <p style={{ color: '#F97416', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: '16px' }}>Do this first</p>
        <div style={{ backgroundColor: '#242424', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '16px', marginBottom: '10px' }}>
          <p style={{ color: '#ffffff', fontSize: '14px', fontWeight: 700, marginBottom: '8px' }}>Send the connection request first</p>
          <p style={{ color: '#94A3B8', fontSize: '13px', lineHeight: 1.6 }}>
            Find the person you're targeting at <strong style={{ color: '#ffffff' }}>{campaign.company}</strong> on LinkedIn and send a connection request before you post.
          </p>
        </div>
        <div style={{ backgroundColor: '#242424', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '16px', marginBottom: '10px' }}>
          <p style={{ color: '#ffffff', fontSize: '14px', fontWeight: 700, marginBottom: '8px' }}>Warm up your feed before you post</p>
          <p style={{ color: '#94A3B8', fontSize: '13px', lineHeight: 1.6 }}>
            Leave 2-3 genuine comments on posts related to your target role in the next 24 hours.
          </p>
        </div>
        <p style={{ color: '#64748B', fontSize: '12px', fontStyle: 'italic' }}>
          {(() => {
            const role = (campaign.role || '').toLowerCase();
            if (role.includes('sdr') || role.includes('sales') || role.includes('bdr')) return 'Look for posts about outbound strategy, startup sales, or pipeline building';
            if (role.includes('marketing') || role.includes('growth')) return 'Look for posts about growth strategy, content marketing, or startup GTM';
            if (role.includes('product') || role.includes('design') || role.includes('ux')) return 'Look for posts about product thinking, UX, or startup building';
            if (role.includes('finance') || role.includes('vc') || role.includes('venture')) return 'Look for posts about venture capital, deal flow, or startup investing';
            if (role.includes('engineer') || role.includes('developer') || role.includes('software')) return 'Look for posts about technical challenges, system design, or startup engineering';
            return 'Look for posts related to your target industry and role';
          })()}
        </p>
      </div>

      {/* WHAT TO WRITE ABOUT */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p style={{ color: '#F97416', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>What to write about</p>
          <Button size="sm" variant="outline" className="bg-transparent text-white border-white/15 hover:bg-white/5" style={{ borderRadius: '8px' }} onClick={() => generateContent("linkedin_angles")} disabled={!!generating || !proofSuggestion}>
            {generating === "linkedin_angles" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
            {angles ? "Regenerate angles" : "Generate angles"}
          </Button>
        </div>
        {!proofSuggestion && <p style={{ color: '#94A3B8', fontSize: '12px' }}>Complete your proof of work first.</p>}
        {angles && (
          <div className="space-y-2.5">
            {angles.map((angle: any, i: number) => {
              const isString = typeof angle === 'string';
              const title = isString ? `Angle ${i + 1}` : angle.title;
              const description = isString ? angle : angle.description;
              const isSelected = selectedAngle === (isString ? angle : angle.title + ": " + angle.description);
              return (
                <button
                  key={i}
                  onClick={() => setSelectedAngle(isSelected ? null : (isString ? angle : angle.title + ": " + angle.description))}
                  style={{
                    backgroundColor: isSelected ? 'rgba(249,116,22,0.12)' : '#242424',
                    border: isSelected ? '1px solid #F97416' : '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '8px',
                    padding: '16px',
                    width: '100%',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <p style={{ color: '#ffffff', fontSize: '14px', fontWeight: 700, marginBottom: '6px' }}>{title}</p>
                  <p style={{ color: '#94A3B8', fontSize: '13px', lineHeight: 1.6 }}>{description}</p>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* GENERATE A DRAFT POST */}
      <div style={{ marginTop: '24px' }}>
        <p style={{ color: '#F97416', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: '16px' }}>Generate a draft post</p>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ color: '#ffffff', fontSize: '13px', fontWeight: 500, display: 'block', marginBottom: '10px' }}>
            How would you describe your writing style?
          </label>
          <div className="flex flex-wrap gap-2">
            {WRITING_STYLES.map((style) => (
              <button
                key={style}
                onClick={() => setSelectedStyle(style)}
                style={{
                  backgroundColor: selectedStyle === style ? '#F97416' : '#242424',
                  color: selectedStyle === style ? '#ffffff' : '#94A3B8',
                  border: 'none',
                  borderRadius: '20px',
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {style}
              </button>
            ))}
          </div>
        </div>

        <Button
          onClick={handleGeneratePost}
          disabled={generatingPost || !proofSuggestion}
          style={{ backgroundColor: '#F97416', borderRadius: '8px' }}
          className="text-white font-bold"
        >
          {generatingPost ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          Generate my draft post →
        </Button>

        {generatedPost && (
          <div style={{ marginTop: '20px' }} className="space-y-4">
            {/* Warning card */}
            <div style={{
              backgroundColor: 'rgba(249,116,22,0.12)',
              border: '2px solid #F97416',
              borderRadius: '8px',
              padding: '16px',
              display: 'flex',
              gap: '12px',
              alignItems: 'flex-start',
            }}>
              <Pencil className="h-5 w-5 flex-shrink-0" style={{ color: '#F97416', marginTop: '2px' }} />
              <p style={{ color: '#ffffff', fontSize: '14px', fontWeight: 600, lineHeight: 1.6 }}>
                This is a starting point — not your post.
                Rewrite it in your own words before you publish. Authentic posts get 10x more engagement than AI-written ones.
                The angle is right. The words should be yours.
              </p>
            </div>

            {/* Generated post textarea */}
            <Textarea
              value={generatedPost}
              onChange={(e) => setGeneratedPost(e.target.value)}
              className="campaign-notes-textarea"
              style={{
                backgroundColor: '#1A1A1A',
                border: '1px solid #F97416',
                borderRadius: '8px',
                padding: '16px',
                color: 'white',
                fontSize: '14px',
                lineHeight: 1.7,
                minHeight: '200px',
              }}
            />

            {/* Copy button */}
            <Button
              variant="outline"
              className="bg-transparent text-white border-white/15 hover:bg-white/5"
              style={{ borderRadius: '8px' }}
              onClick={() => { navigator.clipboard.writeText(generatedPost); toast({ title: "Draft copied!" }); }}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy draft →
            </Button>
          </div>
        )}
      </div>

      {/* Important note */}
      <div style={{ backgroundColor: 'rgba(249,116,22,0.08)', border: '1px solid rgba(249,116,22,0.2)', borderRadius: '8px', padding: '16px' }}>
        <p style={{ color: '#94A3B8', fontSize: '13px', lineHeight: 1.6 }}>
          <strong style={{ color: '#ffffff' }}>Write this yourself</strong> — authenticity is everything. AI-written posts get ignored.
        </p>
      </div>

      {/* Playbook */}
      <div className="space-y-3">
        <p style={{ color: '#F97416', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>PrepLane's LinkedIn playbook</p>
        <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '16px' }} className="space-y-3">
          <p style={{ color: '#94A3B8', fontSize: '13px' }}><strong style={{ color: '#ffffff' }}>Write it yourself</strong> — authenticity is detectable.</p>
          <p style={{ color: '#94A3B8', fontSize: '13px' }}><strong style={{ color: '#ffffff' }}>Post in real time, never schedule</strong> — scheduled posts get less reach.</p>
          <p style={{ color: '#94A3B8', fontSize: '13px' }}><strong style={{ color: '#ffffff' }}>Answer every comment within the first hour</strong> — early interaction is gold.</p>
          <p style={{ color: '#94A3B8', fontSize: '13px' }}><strong style={{ color: '#ffffff' }}>Put links in the comments, never in the post</strong> — LinkedIn suppresses external links.</p>
          <p style={{ color: '#94A3B8', fontSize: '13px' }}><strong style={{ color: '#ffffff' }}>Use 3–5 relevant hashtags</strong> — no more, no less.</p>
          <p style={{ color: '#94A3B8', fontSize: '13px' }}><strong style={{ color: '#ffffff' }}>Tag people mentioned in your work</strong> — only if it adds value.</p>
          <p style={{ color: '#94A3B8', fontSize: '13px' }}><strong style={{ color: '#ffffff' }}>Post consistently</strong> — once a week minimum.</p>
          <p style={{ color: '#94A3B8', fontSize: '13px' }}><strong style={{ color: '#ffffff' }}>Leave genuine comments daily</strong> — this increases your own reach.</p>
        </div>
      </div>
    </div>
  );
}

// ==================== STEP 4: Outreach ====================
function Step4Content({ campaign, connectionName, setConnectionName, connectionUrl, setConnectionUrl, outreachMessage, setOutreachMessage, companyInput, setCompanyInput, generating, generateContent, updateCampaign, getProofHook, toast }: any) {
  return (
    <div className="space-y-6">
      <div>
        <h2 style={{ color: '#ffffff', fontSize: '22px', fontWeight: 700, marginBottom: '8px' }}>Find your contact and send outreach</h2>
        <p style={{ color: '#94A3B8', fontSize: '15px', lineHeight: 1.7 }}>
          Find the right person at {campaign.company} and reach out with your proof of work.
        </p>
      </div>

      {/* Who to look for */}
      <div className="space-y-3">
        <p style={{ color: '#F97416', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>Who to look for</p>
        <div style={{ backgroundColor: '#242424', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '16px' }}>
          <p style={{ color: '#94A3B8', fontSize: '13px', lineHeight: 1.6 }}>
            Look for someone at <strong style={{ color: '#ffffff' }}>{campaign.company}</strong> who is the hiring manager, a team lead, or a recruiter for the <strong style={{ color: '#ffffff' }}>{campaign.role}</strong> role.
          </p>
        </div>
        <Button size="sm" variant="outline" className="bg-transparent text-white border-white/15 hover:bg-white/5" style={{ borderRadius: '8px' }} onClick={() => {
          const query = encodeURIComponent(`${campaign.company} ${campaign.role}`);
          window.open(`https://www.linkedin.com/search/results/people/?keywords=${query}`, "_blank");
        }}>
          Open LinkedIn →
        </Button>
      </div>

      {/* Contact inputs */}
      <div className="space-y-3">
        <div>
          <label style={{ color: '#ffffff', fontSize: '13px', fontWeight: 500 }}>Name of someone at {campaign.company}</label>
          <Input value={connectionName} onChange={(e) => setConnectionName(e.target.value)} onBlur={() => updateCampaign({ connection_name: connectionName || null })} placeholder="e.g. Sarah Chen" className="mt-1 campaign-notes-textarea" style={{ backgroundColor: '#1A1A1A', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: 'white' }} />
        </div>
        <div>
          <label style={{ color: '#ffffff', fontSize: '13px', fontWeight: 500 }}>Their LinkedIn URL (optional)</label>
          <Input value={connectionUrl} onChange={(e) => setConnectionUrl(e.target.value)} onBlur={() => updateCampaign({ connection_url: connectionUrl || null })} placeholder="https://linkedin.com/in/..." className="mt-1 campaign-notes-textarea" style={{ backgroundColor: '#1A1A1A', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: 'white' }} />
        </div>
      </div>

      {/* Outreach message */}
      <div className="space-y-3">
        <p style={{ color: '#F97416', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>Your outreach message</p>
        {!getProofHook() ? (
          <div style={{ backgroundColor: 'rgba(249,116,22,0.08)', border: '1px solid rgba(249,116,22,0.2)', borderRadius: '8px', padding: '16px' }}>
            <p className="font-semibold text-white text-sm">Generate your Proof of Work first — your outreach needs to lead with something real.</p>
            <p className="text-[#94A3B8] text-xs mt-1">Your PoW brief includes an outreach hook that becomes the opening line.</p>
          </div>
        ) : (
          <Button size="sm" onClick={() => generateContent("outreach")} disabled={!!generating}>
            {generating === "outreach" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
            Generate outreach message
          </Button>
        )}
        {outreachMessage && (
          <div className="space-y-2">
            <Textarea value={outreachMessage} onChange={(e) => setOutreachMessage(e.target.value)} onBlur={() => updateCampaign({ outreach_message: outreachMessage })} rows={5} className="text-sm" />
            <Button size="sm" variant="outline" className="bg-transparent text-white border-white/15 hover:bg-white/5" style={{ borderRadius: '8px' }} onClick={() => { navigator.clipboard.writeText(outreachMessage); toast({ title: "Copied to clipboard!" }); }}>
              Copy message
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== PoW Brief Display (shared) ====================
function PowBriefDisplay({ proofSuggestion, toast }: { proofSuggestion: string; toast: any }) {
  let parsed: any = null;
  try { parsed = JSON.parse(proofSuggestion); } catch { /* legacy */ }

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
            <p className="flex items-center gap-1 text-xs text-green-500 mt-2">
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
                <div className="rounded-md border border-[rgba(255,255,255,0.08)] p-3" style={{ background: "#242424" }}>
                  <p className="text-xs font-semibold text-[#F97416] mb-0.5">Minimum (gets noticed)</p>
                  <p className="text-sm text-[#94A3B8]">{parsed.effort_guide.minimum}</p>
                </div>
                <div className="rounded-md border border-[rgba(255,255,255,0.08)] p-3" style={{ background: "#242424" }}>
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
              <Button variant="ghost" size="sm" className="absolute top-1 right-1 h-7 text-xs" onClick={() => { navigator.clipboard.writeText(parsed.outreach_hook); toast({ title: "Hook copied!" }); }}>Copy</Button>
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
              <span key={i} className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ backgroundColor: 'rgba(249,116,22,0.1)', color: '#F97416' }}>{t}</span>
            ))}
          </div>
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
              <Button variant="ghost" size="sm" className="absolute top-1 right-1 h-7 text-xs" onClick={() => { navigator.clipboard.writeText(parsed.ai_prompt); toast({ title: "Prompt copied!" }); }}>Copy</Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Plain text fallback
  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px' }}>
      <p className="text-sm text-[#94A3B8] whitespace-pre-wrap">{proofSuggestion}</p>
    </div>
  );
}

export default Campaign;
