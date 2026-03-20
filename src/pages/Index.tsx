import { useState, useEffect } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import Header from "@/components/Header";
import AppFooter from "@/components/AppFooter";
import { supabase } from "@/integrations/supabase/client";
import {
  PlusCircle, ArrowRight, Target, Clock, RotateCcw, Zap, Check, Lightbulb,
  Loader2, X, AlertTriangle, CalendarDays, FileEdit, CheckCircle2, Circle
} from "lucide-react";
import { formatDistanceToNow, differenceInDays } from "date-fns";

const TARGET_KEY = "preplane_onboarding_target";
const ONBOARDING_KEY = "preplane_onboarding_done";

const STEPS = [
  { key: "step_proof_done", label: "Build proof of work", weight: 20 },
  { key: "step_linkedin_done", label: "Post on LinkedIn", weight: 5 },
  { key: "step_connection_done", label: "Find contact", weight: 15 },
  { key: "step_outreach_done", label: "Send outreach", weight: 20 },
  { key: "step_cv_done", label: "CV ready", weight: 15 },
  { key: "step_cover_letter_done", label: "Cover letter", weight: 10 },
  { key: "step_followup_done", label: "Follow up", weight: 15 },
] as const;

const STATUS_BADGES: Record<string, { label: string; bg: string; text: string }> = {
  targeting: { label: "RESEARCHING", bg: "rgba(249,115,22,0.15)", text: "#F97316" },
  applied: { label: "APPLIED", bg: "rgba(234,179,8,0.15)", text: "#EAB308" },
  followed_up: { label: "FOLLOWING UP", bg: "rgba(168,85,247,0.15)", text: "#A855F7" },
  response_received: { label: "INTERVIEW", bg: "rgba(34,197,94,0.15)", text: "#22C55E" },
  rejected: { label: "CLOSED", bg: "rgba(239,68,68,0.15)", text: "#EF4444" },
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
  if (c.proof_suggestion && !c.proof_in_progress && !c.step_proof_done) return "Start building your proof of work";
  if (c.proof_in_progress && !c.step_proof_done) return "Finish your proof of work — this is what gets responses";
  if (c.step_proof_done && !c.step_linkedin_done) return "Post about your proof of work on LinkedIn";
  if (c.step_linkedin_done && !c.step_connection_done) return "Find your contact — they may have seen your post";
  if (c.step_connection_done && !c.step_outreach_done) return "Your proof of work is ready. Time to reach out.";
  if (!c.step_cv_done) return "Get your CV ready for this role";
  if (!c.step_cover_letter_done) return "Prepare cover letter";
  if (c.step_outreach_done && !c.step_followup_done) return "Follow up on your outreach";
  return null;
}

function getChecklist(c: CampaignRow) {
  const items: { label: string; done: boolean }[] = [];
  if (c.step_cv_done) items.push({ label: "CV ready", done: true });
  if (c.step_proof_done) items.push({ label: "Proof of work done", done: true });
  else if (c.proof_in_progress) items.push({ label: "Proof of work in progress", done: false });
  if (c.step_connection_done) items.push({ label: "Company research complete", done: true });
  if (c.step_outreach_done) items.push({ label: "Application submitted", done: true });
  if (items.length === 0) {
    items.push({ label: "Getting started", done: false });
  }
  return items.slice(0, 2);
}

const Index = () => {
  const { user, loading: authLoading } = useAuth();
  const nav = useNavigate();
  const [targetRole, setTargetRole] = useState<string | null>(null);
  const [targetLocation, setTargetLocation] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(true);

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
        let resolvedRole: string | null = null;
        let resolvedLocation: string | null = null;

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
            resolvedRole = target.target_role || null;
            resolvedLocation = target.target_location || null;
          } catch {
            localStorage.removeItem(TARGET_KEY);
          }
        } else if (d && !d.onboarding_completed) {
          nav("/onboarding", { replace: true });
          return;
        } else {
          resolvedRole = d?.target_role || null;
          resolvedLocation = d?.target_location || null;
        }

        setTargetRole(resolvedRole);
        setTargetLocation(resolvedLocation);

        const { data: campData } = await supabase
          .from("campaigns")
          .select("id, company, role, match_score, status, step_cv_done, step_connection_done, step_outreach_done, step_proof_done, step_linkedin_done, step_cover_letter_done, step_followup_done, created_at, archived, proof_suggestion, proof_in_progress, followup_date")
          .order("created_at", { ascending: false });
        const loadedCampaigns = (campData as any as CampaignRow[]) || [];
        setCampaigns(loadedCampaigns);
        setLoading(false);
      });
  }, [user, authLoading, nav]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: "#111111" }}>
        <div className="animate-spin h-8 w-8 border-4 border-[#F97316] border-t-transparent rounded-full" />
      </div>
    );
  }
  if (!user) return <Navigate to="/onboarding" replace />;

  // First-load PoW generating screen
  if (powGenerating && !powSkipped) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: "#111111", fontFamily: "Inter, sans-serif" }}>
        <div className="max-w-md text-center space-y-6">
          <div className="relative mx-auto w-16 h-16">
            <div className="absolute inset-0 rounded-full bg-[#F97316]/20 animate-ping" />
            <div className="relative flex items-center justify-center w-16 h-16 rounded-full bg-[#F97316]/10">
              <Rocket className="w-8 h-8 text-[#F97316] animate-pulse" />
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Building your first proof of work brief</h2>
            <p className="mt-2" style={{ color: "#94A3B8" }}>for <span className="font-semibold text-white">{targetRole}</span>...</p>
          </div>
          <div className="h-1.5 w-48 mx-auto rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
            <div className="h-full bg-[#F97316] rounded-full" style={{ width: '60%', animation: 'pulse 1.5s ease-in-out infinite' }} />
          </div>
          <button
            onClick={() => setPowSkipped(true)}
            className="text-xs underline underline-offset-2 transition-colors"
            style={{ color: "#64748B" }}
          >
            Skip for now →
          </button>
        </div>
      </div>
    );
  }

  const activeCampaigns = campaigns.filter((c) => !c.archived);
  const archivedCampaigns = campaigns.filter((c) => c.archived);

  const focusCampaign = activeCampaigns
    .filter((c) => getNextStep(c) !== null && c.status !== "rejected")
    .sort((a, b) => getStrength(b) - getStrength(a))[0] || null;

  const atLimit = activeCampaigns.length >= 10;

  const handleUnarchive = async (campaignId: string) => {
    await supabase.from("campaigns").update({ archived: false } as any).eq("id", campaignId);
    setCampaigns((prev) => prev.map((c) => c.id === campaignId ? { ...c, archived: false } : c));
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#111111", fontFamily: "Inter, sans-serif" }}>
      <Header />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Page title row */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl" style={{ color: "#FFFFFF", fontWeight: 900 }}>Your campaigns</h1>
            <p style={{ color: "#94A3B8" }} className="mt-1">Manage and track your target roles</p>
          </div>
          <button
            onClick={() => nav("/app/new")}
            disabled={atLimit}
            className="flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: "#F97316",
              color: "#FFFFFF",
              fontWeight: 700,
              padding: "12px 24px",
              borderRadius: "8px",
              border: "none",
              cursor: atLimit ? "not-allowed" : "pointer",
            }}
            onMouseEnter={(e) => { if (!atLimit) (e.currentTarget).style.background = "#EA6C0A"; }}
            onMouseLeave={(e) => { if (!atLimit) (e.currentTarget).style.background = "#F97316"; }}
            title={atLimit ? "You have 10 active campaigns. Complete or archive one first." : undefined}
          >
            <PlusCircle className="w-5 h-5" />
            New Target Role
          </button>
        </div>

        {atLimit && (
          <p className="text-xs px-3 py-2" style={{ color: "#94A3B8", background: "#1A1A1A", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.08)" }}>
            You have 10 active campaigns. PrepLane is built for focus — complete or archive one before adding a new one.
          </p>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin h-8 w-8 border-4 border-[#F97316] border-t-transparent rounded-full" />
          </div>
        ) : activeCampaigns.length === 0 && archivedCampaigns.length === 0 ? (
          /* Empty state */
          <div className="p-12 text-center space-y-4" style={{ background: "#1A1A1A", borderRadius: "12px", border: "1px dashed rgba(255,255,255,0.12)" }}>
            <Lightbulb className="h-10 w-10 text-[#F97316] mx-auto" />
            <div>
              <h3 className="font-bold text-lg text-white">Start by telling us which role you're going after.</h3>
              <p className="text-sm mt-1" style={{ color: "#94A3B8" }}>
                We'll build you a proof of work brief in 60 seconds.
              </p>
            </div>
            <button
              onClick={() => nav("/app/new")}
              className="inline-flex items-center gap-2 transition-colors"
              style={{ background: "#F97316", color: "#FFFFFF", fontWeight: 700, padding: "12px 24px", borderRadius: "8px", border: "none", cursor: "pointer" }}
              onMouseEnter={(e) => (e.currentTarget).style.background = "#EA6C0A"}
              onMouseLeave={(e) => (e.currentTarget).style.background = "#F97316"}
            >
              Build my first proof of work <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <>
            {/* Nudge: CV done but missing key steps */}
            {(() => {
              const nudgeCampaign = activeCampaigns.find(
                (c) => c.step_cv_done && !c.step_connection_done && !c.step_proof_done && c.status !== "rejected"
              );
              if (!nudgeCampaign) return null;
              return (
                <div
                  className="flex flex-col md:flex-row items-center justify-between gap-6 cursor-pointer transition-all"
                  style={{ background: "#1A1A1A", border: "1px solid rgba(249,115,22,0.2)", borderRadius: "12px", padding: "24px" }}
                  onClick={() => nav(`/campaign/${nudgeCampaign.id}`)}
                >
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-full shrink-0" style={{ background: "rgba(249,115,22,0.15)" }}>
                      <Lightbulb className="w-5 h-5 text-[#F97316]" />
                    </div>
                    <div>
                      <p className="font-bold text-white">Don't stop at the CV</p>
                      <p className="text-sm" style={{ color: "#94A3B8" }}>{nudgeCampaign.company} campaign is missing the steps that actually get responses.</p>
                    </div>
                  </div>
                  <button
                    className="shrink-0 transition-colors"
                    style={{ background: "#F97316", color: "#FFFFFF", fontWeight: 600, padding: "10px 20px", borderRadius: "8px", border: "none", cursor: "pointer" }}
                  >
                    Continue building
                  </button>
                </div>
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

              let borderColor: string, message: string, buttonLabel: string;
              if (daysSince >= 14) {
                borderColor = "rgba(239,68,68,0.3)";
                message = `📬 It's been ${daysSince} days since you reached out to ${c.company}. Send one final follow-up today — then move on with your head high.`;
                buttonLabel = "Send final follow-up →";
              } else if (daysSince >= 7) {
                borderColor = "rgba(249,115,22,0.3)";
                message = `🔥 ${c.company} hasn't responded yet — that's normal. Day 7 follow-ups get 3x more responses than day 1. Send yours now.`;
                buttonLabel = "Write my follow-up →";
              } else {
                borderColor = "rgba(234,179,8,0.3)";
                message = `⏰ You reached out to ${c.company} ${daysSince} days ago. Most people give up here — don't. A short follow-up today keeps you top of mind.`;
                buttonLabel = "Write my follow-up →";
              }

              return (
                <div
                  className="flex items-center justify-between gap-4 cursor-pointer transition-all"
                  style={{ background: "#1A1A1A", border: `1px solid ${borderColor}`, borderRadius: "12px", padding: "20px 24px" }}
                  onClick={() => nav(`/campaign/${c.id}`)}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {daysSince >= 14 ? (
                      <AlertTriangle className="h-5 w-5 text-red-400 shrink-0" />
                    ) : (
                      <Clock className="h-5 w-5 text-[#F97316] shrink-0" />
                    )}
                    <p className="text-sm" style={{ color: "#94A3B8" }}>{message}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                      style={{ background: "rgba(255,255,255,0.08)", color: "#FFFFFF", border: "1px solid rgba(255,255,255,0.08)" }}
                    >
                      {buttonLabel}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        localStorage.setItem(dismissKey, today);
                        setFollowupNudgeDismissed(true);
                      }}
                      style={{ color: "#64748B" }}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Today's focus */}
            {focusCampaign && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <CalendarDays className="w-5 h-5 text-[#F97316]" />
                  <h2 className="text-xl" style={{ color: "#FFFFFF", fontWeight: 900 }}>Today's focus</h2>
                </div>
                <div
                  className="flex flex-col md:flex-row md:items-center justify-between gap-4"
                  style={{ background: "#1A1A1A", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "24px" }}
                >
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(249,115,22,0.15)" }}>
                      <FileEdit className="w-5 h-5 text-[#F97316]" />
                    </div>
                    <div>
                      <p className="text-sm font-medium uppercase tracking-wider" style={{ color: "#F97316" }}>{focusCampaign.company}</p>
                      <p className="text-lg font-bold text-white">{getNextStep(focusCampaign)}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => nav(`/campaign/${focusCampaign.id}`)}
                    className="flex items-center gap-2 shrink-0 transition-colors"
                    style={{ background: "rgba(255,255,255,0.08)", color: "#FFFFFF", fontWeight: 600, padding: "10px 20px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer" }}
                  >
                    Go to campaign <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Campaign cards grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {activeCampaigns.map((c) => {
                const next = getNextStep(c);
                const status = STATUS_BADGES[c.status] || STATUS_BADGES.targeting;
                const checklist = getChecklist(c);
                return (
                  <div
                    key={c.id}
                    className="flex flex-col cursor-pointer group transition-all duration-300"
                    style={{
                      background: "#1A1A1A",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: "12px",
                      padding: "24px",
                    }}
                    onClick={() => nav(`/campaign/${c.id}`)}
                    onMouseEnter={(e) => { (e.currentTarget).style.borderColor = "rgba(249,115,22,0.3)"; (e.currentTarget).style.transform = "translateY(-2px)"; }}
                    onMouseLeave={(e) => { (e.currentTarget).style.borderColor = "rgba(255,255,255,0.08)"; (e.currentTarget).style.transform = "translateY(0)"; }}
                  >
                    {/* Top: role + status */}
                    <div className="flex items-start justify-between gap-2 mb-4">
                      <div className="min-w-0">
                        <h3 className="text-lg font-bold text-white truncate">{c.role}</h3>
                        <p className="text-sm truncate" style={{ color: "#94A3B8" }}>{c.company}</p>
                      </div>
                      <span
                        className="text-xs font-bold px-3 py-1 rounded-full uppercase shrink-0"
                        style={{ background: status.bg, color: status.text }}
                      >
                        {status.label}
                      </span>
                    </div>

                    {/* Checklist */}
                    <div className="space-y-2 mb-4">
                      {checklist.map((item, i) => (
                        <div key={i} className="flex items-center gap-2">
                          {item.done ? (
                            <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                          ) : (
                            <Circle className="w-4 h-4 shrink-0" style={{ color: "rgba(255,255,255,0.15)" }} />
                          )}
                          <span className="text-sm" style={{ color: item.done ? "#94A3B8" : "#64748B" }}>{item.label}</span>
                        </div>
                      ))}
                    </div>

                    {/* Next step (replaces readiness bar) */}
                    <div className="mt-auto pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                      {next ? (
                        <>
                          <p className="text-xs mb-1 uppercase" style={{ color: "#64748B" }}>Next step</p>
                          <p className="text-sm font-semibold text-white">{next}</p>
                        </>
                      ) : (
                        <p className="text-sm font-semibold text-green-400">All steps complete ✓</p>
                      )}
                      <p className="text-[10px] mt-3" style={{ color: "#64748B" }}>
                        Updated {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Archived section */}
            {archivedCampaigns.length > 0 && (
              <div className="pt-4">
                <button
                  onClick={() => setShowArchived(!showArchived)}
                  className="text-xs underline underline-offset-2 transition-colors"
                  style={{ color: "#64748B" }}
                >
                  {showArchived ? "Hide archived" : `View archived (${archivedCampaigns.length})`}
                </button>

                {showArchived && (
                  <div className="mt-4 space-y-2">
                    {archivedCampaigns.map((c) => {
                      const status = STATUS_BADGES[c.status] || STATUS_BADGES.targeting;
                      return (
                        <div
                          key={c.id}
                          className="opacity-60 hover:opacity-80 transition-opacity flex items-center justify-between gap-3"
                          style={{ background: "#1A1A1A", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.08)", padding: "16px" }}
                        >
                          <div className="min-w-0 flex items-center gap-3">
                            <div className="min-w-0">
                              <span className="text-sm font-medium text-white truncate block">{c.role}</span>
                              <span className="text-xs truncate block" style={{ color: "#64748B" }}>{c.company}</span>
                            </div>
                            <span
                              className="text-xs font-bold px-3 py-1 rounded-full uppercase shrink-0"
                              style={{ background: status.bg, color: status.text }}
                            >
                              {status.label}
                            </span>
                          </div>
                          <button
                            className="text-xs flex items-center gap-1 shrink-0 transition-colors"
                            style={{ color: "#64748B" }}
                            onClick={(e) => { e.stopPropagation(); handleUnarchive(c.id); }}
                          >
                            <RotateCcw className="h-3 w-3" /> Unarchive
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      <AppFooter />
    </div>
  );
};

export default Index;
