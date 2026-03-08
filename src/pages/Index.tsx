import { useState, useEffect } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import Header from "@/components/Header";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Plus, Sparkles, ArrowRight, Target, Clock, RotateCcw, Zap, Check, Lightbulb, Loader2, X, AlertTriangle } from "lucide-react";
import { formatDistanceToNow, differenceInDays } from "date-fns";

const TARGET_KEY = "preplane_onboarding_target";
const ONBOARDING_KEY = "preplane_onboarding_done";

const STEPS = [
  { key: "step_cv_done", label: "Tailor CV", weight: 18 },
  { key: "step_proof_done", label: "Build proof of work", weight: 20 },
  { key: "step_linkedin_done", label: "Post on LinkedIn", weight: 5 },
  { key: "step_connection_done", label: "Find contact", weight: 13 },
  { key: "step_outreach_done", label: "Send outreach", weight: 19 },
  { key: "step_cover_letter_done", label: "Cover letter", weight: 10 },
  { key: "step_followup_done", label: "Follow up", weight: 15 },
] as const;

const STATUS_BADGES: Record<string, { label: string; color: string }> = {
  targeting: { label: "Researching", color: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  applied: { label: "Formally Applied", color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20" },
  followed_up: { label: "Following Up", color: "bg-purple-500/10 text-purple-600 border-purple-500/20" },
  response_received: { label: "In Conversation", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  rejected: { label: "Not This Time", color: "bg-destructive/10 text-destructive border-destructive/20" },
};

interface CampaignRow {
  id: string;
  company: string;
  role: string;
  match_score: number;
  status: string;
  step_cv_done: boolean;
  step_connection_done: boolean;
  step_outreach_done: boolean;
  step_proof_done: boolean;
  step_linkedin_done: boolean;
  step_cover_letter_done: boolean;
  step_followup_done: boolean;
  created_at: string;
  archived: boolean;
  proof_suggestion: string | null;
  proof_in_progress: boolean;
  followup_date: string | null;
}

function getStrength(c: CampaignRow) {
  return STEPS.reduce((sum, s) => sum + ((c as any)[s.key] ? s.weight : 0), 0);
}

function getNextStep(c: CampaignRow) {
  // Priority 1: Proof brief exists but not started
  if (c.proof_suggestion && !c.proof_in_progress && !c.step_proof_done) {
    return "Start building your proof of work";
  }
  // Priority 2: Proof in progress
  if (c.proof_in_progress && !c.step_proof_done) {
    return "Finish your proof of work — this is what gets responses";
  }
  // Priority 3: Proof done, LinkedIn not posted
  if (c.step_proof_done && !c.step_linkedin_done) {
    return "Post about your proof of work on LinkedIn";
  }
  // Priority 4: LinkedIn posted, contact not found
  if (c.step_linkedin_done && !c.step_connection_done) {
    return "Find your contact — they may have seen your post";
  }
  // Priority 5: Contact found, outreach not sent
  if (c.step_connection_done && !c.step_outreach_done) {
    return "Your proof of work is ready. Time to reach out.";
  }
  // Priority 6: Outreach sent, no follow up
  if (c.step_outreach_done && !c.step_followup_done) {
    return "Follow up on your outreach";
  }
  // Priority 7: CV not tailored
  if (!c.step_cv_done) {
    return "Tailor your CV for this role";
  }
  if (!c.step_cover_letter_done) return "Prepare cover letter";
  return null;
}

const Index = () => {
  const { user, loading: authLoading } = useAuth();
  const nav = useNavigate();
  const [targetRole, setTargetRole] = useState<string | null>(null);
  const [targetLocation, setTargetLocation] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [followupNudgeDismissed, setFollowupNudgeDismissed] = useState(false);

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
          } catch {
            localStorage.removeItem(TARGET_KEY);
          }
        } else if (d && !d.onboarding_completed) {
          nav("/onboarding", { replace: true });
          return;
        } else {
          if (d?.target_role) setTargetRole(d.target_role);
          if (d?.target_location) setTargetLocation(d.target_location);
        }

        // Load campaigns
        const { data: campData } = await supabase
          .from("campaigns")
          .select("id, company, role, match_score, status, step_cv_done, step_connection_done, step_outreach_done, step_proof_done, step_linkedin_done, step_cover_letter_done, step_followup_done, created_at, archived, proof_suggestion, proof_in_progress, followup_date")
          .order("created_at", { ascending: false });
        setCampaigns((campData as any as CampaignRow[]) || []);
        setLoading(false);
      });
  }, [user, authLoading, nav]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }
  if (!user) return <Navigate to="/onboarding" replace />;

  const activeCampaigns = campaigns.filter((c) => !c.archived);
  const archivedCampaigns = campaigns.filter((c) => c.archived);

  // Find best focus campaign: highest strength with incomplete steps (active only)
  const focusCampaign = activeCampaigns
    .filter((c) => getNextStep(c) !== null && c.status !== "rejected")
    .sort((a, b) => getStrength(b) - getStrength(a))[0] || null;

  const atLimit = activeCampaigns.length >= 10;

  const handleUnarchive = async (campaignId: string) => {
    await supabase.from("campaigns").update({ archived: false } as any).eq("id", campaignId);
    setCampaigns((prev) => prev.map((c) => c.id === campaignId ? { ...c, archived: false } : c));
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto px-4 py-8 max-w-[1000px] space-y-8">
        {/* Top: Target context + New Campaign button */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div className="space-y-1">
            {targetRole && (
              <>
                <p className="text-muted-foreground text-sm">
                  Working toward: <span className="font-medium text-foreground">{targetRole}</span>
                  {targetLocation && <> in <span className="font-medium text-foreground">{targetLocation}</span></>}
                </p>
              </>
            )}
            <h1 className="text-2xl font-bold tracking-tight">Your campaigns</h1>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Button
              onClick={() => nav("/app/new")}
              disabled={atLimit}
              title={atLimit ? "You have 10 active campaigns. Complete or archive one first." : undefined}
            >
              <Plus className="h-4 w-4 mr-1" />
              New Campaign
            </Button>
            <button
              onClick={() => nav("/cv-workspace")}
              className="text-xs text-primary hover:text-primary/80 transition-colors underline underline-offset-2"
            >
              Just need to tailor a CV? Start here →
            </button>
          </div>
        </div>

        {atLimit && (
          <p className="text-xs text-muted-foreground bg-muted rounded-lg px-3 py-2">
            You have 10 active campaigns. PrepLane is built for focus — complete or archive one before adding a new one.
          </p>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : activeCampaigns.length === 0 && archivedCampaigns.length === 0 ? (
          /* Empty state */
          <Card className="border-dashed">
            <CardContent className="pt-8 pb-8 text-center space-y-4">
              <Target className="h-10 w-10 text-muted-foreground mx-auto" />
              <div>
                <h3 className="font-semibold text-lg">No campaigns yet</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Start by tailoring your CV to a role you actually want.
                </p>
              </div>
              <Button onClick={() => nav("/app/new")}>
                Start my first campaign <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Nudge: CV done but missing key steps */}
            {(() => {
              const nudgeCampaign = activeCampaigns.find(
                (c) => c.step_cv_done && !c.step_connection_done && !c.step_proof_done && c.status !== "rejected"
              );
              if (!nudgeCampaign) return null;
              return (
                <Card
                  className="border-[hsl(30,80%,85%)] bg-[hsl(30,100%,97%)] cursor-pointer hover:border-[hsl(30,80%,75%)] transition-colors"
                  onClick={() => nav(`/campaign/${nudgeCampaign.id}`)}
                >
                  <CardContent className="pt-5 pb-5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <Zap className="h-5 w-5 text-primary shrink-0" />
                      <p className="text-sm text-foreground">
                        <span className="font-medium">Don't stop at the CV</span> — {nudgeCampaign.company} campaign is missing the steps that actually get responses.
                      </p>
                    </div>
                    <Button size="sm" variant="outline" className="shrink-0">
                      Continue building <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })()}

            {/* Follow-up urgency nudge */}
            {(() => {
              const today = new Date().toISOString().slice(0, 10);
              const dismissKey = "preplane_followup_nudge_dismissed";
              const dismissed = followupNudgeDismissed || localStorage.getItem(dismissKey) === today;
              if (dismissed) return null;

              const needsFollowup = activeCampaigns
                .filter((c) => c.step_outreach_done && !c.step_followup_done && c.followup_date && c.status !== "rejected")
                .sort((a, b) => new Date(a.followup_date!).getTime() - new Date(b.followup_date!).getTime());

              if (needsFollowup.length === 0) return null;
              const c = needsFollowup[0];
              const outreachDate = new Date(new Date(c.followup_date!).getTime() - 7 * 24 * 60 * 60 * 1000);
              const daysSince = differenceInDays(new Date(), outreachDate);
              if (daysSince < 3) return null;

              let bgClass: string, borderClass: string, textClass: string, message: string, buttonLabel: string;
              if (daysSince >= 14) {
                bgClass = "bg-destructive/10"; borderClass = "border-destructive/30"; textClass = "text-destructive";
                message = `📬 It's been ${daysSince} days since you reached out to ${c.company}. Send one final follow-up today — then move on with your head high.`;
                buttonLabel = "Send final follow-up →";
              } else if (daysSince >= 7) {
                bgClass = "bg-orange-500/10"; borderClass = "border-orange-500/30"; textClass = "text-orange-600";
                message = `🔥 ${c.company} hasn't responded yet — that's normal. Day 7 follow-ups get 3x more responses than day 1. Send yours now.`;
                buttonLabel = "Write my follow-up →";
              } else {
                bgClass = "bg-yellow-500/10"; borderClass = "border-yellow-500/30"; textClass = "text-yellow-700";
                message = `⏰ You reached out to ${c.company} ${daysSince} days ago. Most people give up here — don't. A short follow-up today keeps you top of mind.`;
                buttonLabel = "Write my follow-up →";
              }

              return (
                <Card
                  className={`${borderClass} ${bgClass} cursor-pointer hover:opacity-90 transition-opacity`}
                  onClick={() => nav(`/campaign/${c.id}`)}
                >
                  <CardContent className="pt-5 pb-5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {daysSince >= 14 ? (
                        <AlertTriangle className={`h-5 w-5 ${textClass} shrink-0`} />
                      ) : (
                        <Clock className={`h-5 w-5 ${textClass} shrink-0`} />
                      )}
                      <p className={`text-sm ${textClass}`}>{message}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button size="sm" variant="outline" className="shrink-0">
                        {buttonLabel}
                      </Button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          localStorage.setItem(dismissKey, today);
                          setFollowupNudgeDismissed(true);
                        }}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </CardContent>
                </Card>
              );
            })()}

            {/* Today's focus */}
            {focusCampaign && (
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold text-primary">Today's focus</span>
                  </div>
                  <p className="text-foreground font-medium">
                    {focusCampaign.company} — {getNextStep(focusCampaign)}
                  </p>
                  <Button
                    size="sm"
                    className="mt-3"
                    onClick={() => nav(`/campaign/${focusCampaign.id}`)}
                  >
                    Go to campaign →
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Campaign grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeCampaigns.map((c) => {
                const strength = getStrength(c);
                const next = getNextStep(c);
                const status = STATUS_BADGES[c.status] || STATUS_BADGES.targeting;
                return (
                  <Card
                    key={c.id}
                    className="cursor-pointer hover:border-primary/40 transition-colors"
                    onClick={() => nav(`/campaign/${c.id}`)}
                  >
                    <CardContent className="pt-5 pb-5 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-semibold text-sm truncate">{c.role}</h3>
                          <p className="text-xs text-muted-foreground truncate">{c.company}</p>
                        </div>
                        <Badge variant="outline" className={`text-xs shrink-0 ${status.color}`}>
                          {status.label}
                        </Badge>
                      </div>

                      {/* Proof of work status — primary indicator */}
                      <div className="flex items-center gap-1.5 text-xs font-medium">
                        {c.step_proof_done ? (
                          <span className="flex items-center gap-1.5 text-success">
                            <Check className="h-3.5 w-3.5" /> Proof of work done
                          </span>
                        ) : c.proof_in_progress ? (
                          <span className="flex items-center gap-1.5 text-yellow-600">
                            <Loader2 className="h-3.5 w-3.5" /> Building in progress
                          </span>
                        ) : c.proof_suggestion ? (
                          <span className="flex items-center gap-1.5 text-primary">
                            <Lightbulb className="h-3.5 w-3.5" /> Brief ready — start building
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            <Lightbulb className="h-3.5 w-3.5" /> No proof of work yet
                          </span>
                        )}
                      </div>

                      {/* Strength bar — secondary */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Campaign strength</span>
                          <span className="font-semibold text-primary">{strength}%</span>
                        </div>
                        <Progress value={strength} className="h-2" />
                      </div>

                      {/* Next step + date */}
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        {next ? (
                          <span className="flex items-center gap-1">
                            <ArrowRight className="h-3 w-3" /> Next: {next}
                          </span>
                        ) : (
                          <span className="text-success font-medium">All steps complete ✓</span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Archived section */}
            {archivedCampaigns.length > 0 && (
              <div className="pt-4">
                <button
                  onClick={() => setShowArchived(!showArchived)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
                >
                  {showArchived ? "Hide archived" : `View archived (${archivedCampaigns.length})`}
                </button>

                {showArchived && (
                  <div className="mt-4 space-y-2">
                    {archivedCampaigns.map((c) => {
                      const status = STATUS_BADGES[c.status] || STATUS_BADGES.targeting;
                      return (
                        <Card key={c.id} className="opacity-60 hover:opacity-80 transition-opacity">
                          <CardContent className="py-3 flex items-center justify-between gap-3">
                            <div className="min-w-0 flex items-center gap-3">
                              <div className="min-w-0">
                                <span className="text-sm font-medium truncate block">{c.role}</span>
                                <span className="text-xs text-muted-foreground truncate block">{c.company}</span>
                              </div>
                              <Badge variant="outline" className={`text-xs shrink-0 ${status.color}`}>
                                {status.label}
                              </Badge>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs text-muted-foreground shrink-0"
                              onClick={(e) => { e.stopPropagation(); handleUnarchive(c.id); }}
                            >
                              <RotateCcw className="h-3 w-3 mr-1" /> Unarchive
                            </Button>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default Index;
