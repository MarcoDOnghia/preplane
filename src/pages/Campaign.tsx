import { useState, useEffect, useCallback } from "react";
import { useParams, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import Header from "@/components/Header";
import { supabase } from "@/integrations/supabase/client";
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
  Flag,
  Archive,
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
  step_cover_letter_done: boolean;
  step_followup_done: boolean;
  connection_name: string | null;
  connection_url: string | null;
  outreach_message: string | null;
  proof_suggestion: string | null;
  cover_letter: string | null;
  followup_date: string | null;
  notes: string | null;
}

const STATUS_OPTIONS = [
  { value: "targeting", label: "Targeting", color: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  { value: "applied", label: "Applied", color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20" },
  { value: "followed_up", label: "Followed Up", color: "bg-purple-500/10 text-purple-600 border-purple-500/20" },
  { value: "response_received", label: "Response Received", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  { value: "rejected", label: "Rejected", color: "bg-destructive/10 text-destructive border-destructive/20" },
];

const STEPS = [
  { key: "step_cv_done", label: "CV tailored", weight: 20, icon: FileText },
  { key: "step_connection_done", label: "Connection identified", weight: 15, icon: Users },
  { key: "step_outreach_done", label: "Outreach sent", weight: 20, icon: Send },
  { key: "step_proof_done", label: "Proof of work created", weight: 20, icon: Lightbulb },
  { key: "step_cover_letter_done", label: "Cover letter ready", weight: 10, icon: Mail },
  { key: "step_followup_done", label: "Follow-up scheduled", weight: 15, icon: Clock },
] as const;

const Campaign = () => {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [campaign, setCampaign] = useState<CampaignData | null>(null);
  const [loading, setLoading] = useState(true);
  const [openSteps, setOpenSteps] = useState<Set<number>>(new Set());
  const [generating, setGenerating] = useState<string | null>(null);

  // Local editable state
  const [connectionName, setConnectionName] = useState("");
  const [connectionUrl, setConnectionUrl] = useState("");
  const [outreachMessage, setOutreachMessage] = useState("");
  const [proofSuggestion, setProofSuggestion] = useState("");
  const [coverLetter, setCoverLetter] = useState("");
  const [followups, setFollowups] = useState<{ day3: string; day7: string; day14: string }>({ day3: "", day7: "", day14: "" });
  const [followupSent, setFollowupSent] = useState<{ day3: boolean; day7: boolean; day14: boolean }>({ day3: false, day7: false, day14: false });
  const [notes, setNotes] = useState("");

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
    // Auto-open the next incomplete step
    const nextIdx = STEPS.findIndex((s) => !c[s.key]);
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
    ? STEPS.reduce((sum, s) => sum + (campaign[s.key] ? s.weight : 0), 0)
    : 0;

  const nextStep = campaign ? STEPS.findIndex((s) => !campaign[s.key]) : -1;

  const statusInfo = STATUS_OPTIONS.find((s) => s.value === campaign?.status) || STATUS_OPTIONS[0];

  // AI generation
  const generateContent = async (contentType: string) => {
    if (!campaign) return;
    setGenerating(contentType);
    try {
      const { data, error } = await supabase.functions.invoke("generate-campaign-content", {
        body: {
          contentType,
          company: campaign.company,
          role: campaign.role,
          jdText: campaign.jd_text,
          cvSummary: campaign.cv_version?.slice(0, 2000),
          connectionName: connectionName || undefined,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (contentType === "outreach" && data.message) {
        setOutreachMessage(data.message);
        await updateCampaign({ outreach_message: data.message });
      } else if (contentType === "proof_of_work" && data.title) {
        const structured = JSON.stringify(data);
        setProofSuggestion(structured);
        await updateCampaign({ proof_suggestion: structured });
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

  const handleArchive = async () => {
    if (!id) return;
    await supabase.from("campaigns").update({ archived: true } as any).eq("id", id);
    toast({ title: "Campaign archived" });
    navigate("/app");
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
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto px-4 py-8 max-w-[800px] space-y-6">
        {/* Back button */}
        <Button variant="ghost" size="sm" onClick={() => navigate("/app")} className="text-muted-foreground">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to dashboard
        </Button>

        {/* Top: Company + Role + Status + Archive */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{campaign.role}</h1>
            <p className="text-muted-foreground">{campaign.company}</p>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={campaign.status}
              onValueChange={(val) => updateCampaign({ status: val })}
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

        {/* Campaign Strength Score */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                <span className="font-semibold">Campaign Strength</span>
              </div>
              <span className={`text-2xl font-bold ${strengthScore >= 80 ? "text-success" : strengthScore >= 50 ? "text-yellow-500" : "text-muted-foreground"}`}>
                {strengthScore}%
              </span>
            </div>
            <Progress value={strengthScore} className="h-3" />
            <div className="flex flex-wrap gap-2 mt-3">
              {STEPS.map((s, i) => (
                <Badge key={s.key} variant="outline" className={`text-xs ${campaign[s.key] ? "bg-success/10 text-success border-success/20" : "text-muted-foreground"}`}>
                  {campaign[s.key] ? <Check className="h-3 w-3 mr-1" /> : null}
                  {s.label} ({s.weight}%)
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Today's Focus */}
        {nextStep >= 0 && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-primary">Today's focus</span>
              </div>
              <p className="text-sm text-foreground">
                {STEPS[nextStep].label} — complete this step to strengthen your campaign.
              </p>
              <Button
                size="sm"
                className="mt-3"
                onClick={() => { setOpenSteps(new Set([nextStep])); }}
              >
                Go to step →
              </Button>
            </CardContent>
          </Card>
        )}

        {/* 6 Steps */}
        <div className="space-y-3">
          {/* Step 1: CV */}
          <StepCard
            index={0}
            step={STEPS[0]}
            done={campaign.step_cv_done}
            open={openSteps.has(0)}
            onToggle={() => toggleStep(0)}
          >
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">Match Score:</span>
                <span className={`text-lg font-bold ${campaign.match_score >= 80 ? "text-success" : campaign.match_score >= 60 ? "text-yellow-500" : "text-destructive"}`}>
                  {campaign.match_score}%
                </span>
              </div>
              <p className="text-xs text-muted-foreground">Your CV has been tailored for this role. You can view the full tailored version below.</p>
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" size="sm">View tailored CV</Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-3">
                  <div className="bg-muted rounded-lg p-4 text-xs whitespace-pre-wrap max-h-[300px] overflow-auto">
                    {campaign.cv_version || "No CV content saved."}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          </StepCard>

          {/* Step 2: Find a connection */}
          <StepCard
            index={1}
            step={STEPS[1]}
            done={campaign.step_connection_done}
            open={openSteps.has(1)}
            onToggle={() => toggleStep(1)}
          >
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
              <Button
                size="sm"
                onClick={() => generateContent("outreach")}
                disabled={!!generating}
              >
                {generating === "outreach" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
                Generate outreach message
              </Button>
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
              <Button
                size="sm"
                variant="default"
                className="bg-success hover:bg-success/90"
                disabled={!connectionName}
                onClick={async () => {
                  const followDate = new Date();
                  followDate.setDate(followDate.getDate() + 7);
                  await updateCampaign({
                    step_connection_done: true,
                    step_outreach_done: true,
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

          {/* Step 3: Proof of work */}
          <StepCard
            index={2}
            step={STEPS[3]}
            done={campaign.step_proof_done}
            open={openSteps.has(2)}
            onToggle={() => toggleStep(2)}
          >
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
                if (parsed && parsed.title && parsed.what_to_build) {
                  return (
                    <div className="space-y-4 rounded-lg border p-4 bg-muted/30">
                      <h4 className="font-semibold text-base">{parsed.title}</h4>

                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Why this works</p>
                        <p className="text-sm">{parsed.why_this_works}</p>
                      </div>

                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">What to build</p>
                        <ul className="list-disc pl-5 space-y-1">
                          {(parsed.what_to_build as string[]).map((b: string, i: number) => (
                            <li key={i} className="text-sm">{b}</li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Tools to use</p>
                        <div className="flex flex-wrap gap-1.5">
                          {(parsed.tools_to_use as string[]).map((t: string, i: number) => (
                            <span key={i} className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">{t}</span>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Time estimate</p>
                        <p className="text-sm">{parsed.time_estimate}</p>
                      </div>

                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Ready-to-use AI prompt</p>
                        <div className="relative">
                          <pre className="text-xs bg-muted rounded-md p-3 whitespace-pre-wrap font-sans">{parsed.ai_prompt}</pre>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="absolute top-1 right-1 h-7 text-xs"
                            onClick={() => { navigator.clipboard.writeText(parsed.ai_prompt); toast({ title: "Prompt copied!" }); }}
                          >
                            Copy
                          </Button>
                        </div>
                      </div>
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
                  onCheckedChange={(checked) => updateCampaign({ step_proof_done: !!checked, proof_suggestion: proofSuggestion || null })}
                />
                <label htmlFor="proof-done" className="text-sm">I've completed this</label>
              </div>
            </div>
          </StepCard>

          {/* Step 4: Cover letter */}
          <StepCard
            index={3}
            step={STEPS[4]}
            done={campaign.step_cover_letter_done}
            open={openSteps.has(3)}
            onToggle={() => toggleStep(3)}
          >
            <div className="space-y-3">
              {!coverLetter && (
                <Button
                  size="sm"
                  onClick={() => generateContent("cover_letter")}
                  disabled={!!generating}
                >
                  {generating === "cover_letter" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
                  Generate cover letter
                </Button>
              )}
              {coverLetter && (
                <Textarea
                  value={coverLetter}
                  onChange={(e) => setCoverLetter(e.target.value)}
                  onBlur={() => updateCampaign({ cover_letter: coverLetter })}
                  rows={10}
                  className="text-sm"
                />
              )}
              <div className="flex items-center gap-2">
                <Checkbox
                  id="cover-done"
                  checked={campaign.step_cover_letter_done}
                  onCheckedChange={(checked) => updateCampaign({ step_cover_letter_done: !!checked, cover_letter: coverLetter || null })}
                />
                <label htmlFor="cover-done" className="text-sm">Ready to send</label>
              </div>
            </div>
          </StepCard>

          {/* Step 5: Follow-up */}
          <StepCard
            index={4}
            step={STEPS[5]}
            done={campaign.step_followup_done}
            open={openSteps.has(4)}
            onToggle={() => toggleStep(4)}
          >
            <div className="space-y-3">
              {campaign.followup_date && (
                <p className="text-sm text-muted-foreground">
                  Follow up on <span className="font-medium text-foreground">{new Date(campaign.followup_date).toLocaleDateString()}</span>
                </p>
              )}
              <Button
                size="sm"
                onClick={() => generateContent("follow_up")}
                disabled={!!generating}
              >
                {generating === "follow_up" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
                Generate follow-up messages
              </Button>
              {(followups.day3 || followups.day7 || followups.day14) && (
                <div className="space-y-4">
                  {[
                    { key: "day3" as const, label: "Day 3 — Light touch" },
                    { key: "day7" as const, label: "Day 7 — Add value" },
                    { key: "day14" as const, label: "Day 14 — Final check-in" },
                  ].map((f) => (
                    <div key={f.key} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{f.label}</span>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={followupSent[f.key]}
                            onCheckedChange={(checked) => {
                              const next = { ...followupSent, [f.key]: !!checked };
                              setFollowupSent(next);
                              if (next.day3 && next.day7 && next.day14) {
                                updateCampaign({ step_followup_done: true });
                              }
                            }}
                          />
                          <span className="text-xs text-muted-foreground">Sent</span>
                        </div>
                      </div>
                      <Textarea
                        value={followups[f.key]}
                        onChange={(e) => setFollowups((prev) => ({ ...prev, [f.key]: e.target.value }))}
                        rows={3}
                        className="text-sm"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </StepCard>

          {/* Step 6: Outcome */}
          <StepCard
            index={5}
            step={{ label: "Outcome", weight: 0, icon: Flag }}
            done={campaign.status === "response_received" || campaign.status === "rejected"}
            open={openSteps.has(5)}
            onToggle={() => toggleStep(5)}
            isOutcome
          >
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Update status</label>
                <Select
                  value={campaign.status}
                  onValueChange={(val) => updateCampaign({ status: val })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Notes — what worked, what didn't</label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  onBlur={() => updateCampaign({ notes: notes || null })}
                  rows={4}
                  placeholder="Reflect on this campaign..."
                  className="mt-1 text-sm"
                />
              </div>
            </div>
          </StepCard>
        </div>
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
  step: { label: string; weight: number; icon: any };
  done: boolean;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  isOutcome?: boolean;
}) {
  const Icon = step.icon;
  return (
    <Card className={done ? "border-success/30" : ""}>
      <CardHeader
        className="pb-0 cursor-pointer select-none"
        onClick={onToggle}
      >
        <CardTitle className="text-sm flex items-center gap-2">
          <span className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${done ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"}`}>
            {done ? <Check className="h-3.5 w-3.5" /> : index + 1}
          </span>
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="flex-1">{step.label}</span>
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
