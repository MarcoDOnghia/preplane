import { useState, useEffect } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import Header from "@/components/Header";
import AppFooter from "@/components/AppFooter";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  PlusCircle, ArrowRight, Target, Clock, RotateCcw, Zap, Check, Lightbulb,
  Loader2, X, AlertTriangle, CalendarDays, FileEdit, CheckCircle2, Circle, Rocket
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

const STATUS_BADGES: Record<string, { label: string; classes: string }> = {
  targeting: { label: "RESEARCHING", classes: "bg-blue-100 text-blue-700" },
  applied: { label: "APPLIED", classes: "bg-amber-100 text-amber-700" },
  followed_up: { label: "FOLLOWING UP", classes: "bg-purple-100 text-purple-700" },
  response_received: { label: "INTERVIEW", classes: "bg-green-100 text-green-700" },
  rejected: { label: "CLOSED", classes: "bg-red-100 text-red-700" },
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
  if (c.step_outreach_done && !c.step_followup_done) return "Follow up on your outreach";
  if (!c.step_cover_letter_done) return "Prepare cover letter";
  if (!c.step_cv_done) return "Get your CV ready for this role";
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
      <div className="flex min-h-screen items-center justify-center bg-[#FAF9F7]">
        <div className="animate-spin h-8 w-8 border-4 border-[#F97316] border-t-transparent rounded-full" />
      </div>
    );
  }
  if (!user) return <Navigate to="/onboarding" replace />;

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
    <div className="min-h-screen bg-[#FAF9F7] flex flex-col">
      <Header />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Page title row */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Your campaigns</h1>
            <p className="text-slate-500 mt-1">Manage and track your target roles</p>
          </div>
          <button
            onClick={() => nav("/app/new")}
            disabled={atLimit}
            className="bg-[#F97316] hover:bg-orange-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-[#F97316]/20 flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title={atLimit ? "You have 10 active campaigns. Complete or archive one first." : undefined}
          >
            <PlusCircle className="w-5 h-5" />
            New Target Role
          </button>
        </div>

        {atLimit && (
          <p className="text-xs text-slate-500 bg-slate-100 rounded-lg px-3 py-2">
            You have 10 active campaigns. PrepLane is built for focus — complete or archive one before adding a new one.
          </p>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin h-8 w-8 border-4 border-[#F97316] border-t-transparent rounded-full" />
          </div>
        ) : activeCampaigns.length === 0 && archivedCampaigns.length === 0 ? (
          /* Empty state */
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center space-y-4">
            <Lightbulb className="h-10 w-10 text-[#F97316] mx-auto" />
            <div>
              <h3 className="font-bold text-lg text-slate-900">Start by telling us which role you're going after.</h3>
              <p className="text-sm text-slate-500 mt-1">
                We'll build you a proof of work brief in 60 seconds.
              </p>
            </div>
            <button
              onClick={() => nav("/app/new")}
              className="bg-[#F97316] hover:bg-orange-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-[#F97316]/20 inline-flex items-center gap-2 transition-colors"
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
                  className="bg-white border border-[#F97316]/20 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6 cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => nav(`/campaign/${nudgeCampaign.id}`)}
                >
                  <div className="flex items-center gap-4">
                    <div className="bg-[#F97316]/10 p-3 rounded-full shrink-0">
                      <Lightbulb className="w-5 h-5 text-[#F97316]" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">Don't stop at the CV</p>
                      <p className="text-sm text-slate-600">{nudgeCampaign.company} campaign is missing the steps that actually get responses.</p>
                    </div>
                  </div>
                  <button className="bg-[#F97316] text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-orange-600 transition-colors shrink-0">
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

              let bgClass: string, borderClass: string, textClass: string, message: string, buttonLabel: string;
              if (daysSince >= 14) {
                bgClass = "bg-red-50"; borderClass = "border-red-200"; textClass = "text-red-700";
                message = `📬 It's been ${daysSince} days since you reached out to ${c.company}. Send one final follow-up today — then move on with your head high.`;
                buttonLabel = "Send final follow-up →";
              } else if (daysSince >= 7) {
                bgClass = "bg-orange-50"; borderClass = "border-orange-200"; textClass = "text-orange-700";
                message = `🔥 ${c.company} hasn't responded yet — that's normal. Day 7 follow-ups get 3x more responses than day 1. Send yours now.`;
                buttonLabel = "Write my follow-up →";
              } else {
                bgClass = "bg-yellow-50"; borderClass = "border-yellow-200"; textClass = "text-yellow-800";
                message = `⏰ You reached out to ${c.company} ${daysSince} days ago. Most people give up here — don't. A short follow-up today keeps you top of mind.`;
                buttonLabel = "Write my follow-up →";
              }

              return (
                <div
                  className={`${bgClass} border ${borderClass} rounded-2xl p-6 shadow-sm flex items-center justify-between gap-4 cursor-pointer hover:shadow-md transition-shadow`}
                  onClick={() => nav(`/campaign/${c.id}`)}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {daysSince >= 14 ? (
                      <AlertTriangle className={`h-5 w-5 ${textClass} shrink-0`} />
                    ) : (
                      <Clock className={`h-5 w-5 ${textClass} shrink-0`} />
                    )}
                    <p className={`text-sm ${textClass}`}>{message}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button className="bg-white border border-slate-200 text-slate-900 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors">
                      {buttonLabel}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        localStorage.setItem(dismissKey, today);
                        setFollowupNudgeDismissed(true);
                      }}
                      className="text-slate-400 hover:text-slate-600"
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
                  <h2 className="text-xl font-bold text-slate-900">Today's focus</h2>
                </div>
                <div className="bg-[#F97316]/5 border border-[#F97316]/20 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-white shadow-sm flex items-center justify-center shrink-0">
                      <FileEdit className="w-5 h-5 text-[#F97316]" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[#F97316] uppercase tracking-wider">{focusCampaign.company}</p>
                      <p className="text-lg font-bold text-slate-900">{getNextStep(focusCampaign)}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => nav(`/campaign/${focusCampaign.id}`)}
                    className="bg-white border border-slate-200 text-slate-900 px-6 py-2 rounded-lg font-semibold hover:bg-slate-50 transition-colors flex items-center gap-2 shrink-0"
                  >
                    Go to campaign <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Campaign cards grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {activeCampaigns.map((c) => {
                const strength = getStrength(c);
                const next = getNextStep(c);
                const status = STATUS_BADGES[c.status] || STATUS_BADGES.targeting;
                const checklist = getChecklist(c);
                return (
                  <div
                    key={c.id}
                    className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer group"
                    onClick={() => nav(`/campaign/${c.id}`)}
                  >
                    {/* Top: role + status */}
                    <div className="flex items-start justify-between gap-2 mb-4">
                      <div className="min-w-0">
                        <h3 className="text-lg font-bold text-slate-900 group-hover:text-[#F97316] transition-colors truncate">{c.role}</h3>
                        <p className="text-slate-500 text-sm truncate">{c.company}</p>
                      </div>
                      <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase shrink-0 ${status.classes}`}>
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
                            <Circle className="w-4 h-4 text-slate-300 shrink-0" />
                          )}
                          <span className={`text-sm ${item.done ? "text-slate-600" : "text-slate-400"}`}>{item.label}</span>
                        </div>
                      ))}
                    </div>

                    {/* Campaign strength */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-tight">Application readiness</span>
                        <span className="text-xs font-bold text-[#F97316]">{strength}%</span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#F97316] rounded-full transition-all duration-500"
                          style={{ width: `${strength}%` }}
                        />
                      </div>
                    </div>

                    {/* Next step */}
                    <div className="border-t border-slate-100 pt-4 mt-auto">
                      {next ? (
                        <>
                          <p className="text-xs text-slate-400 mb-1 uppercase">Next step</p>
                          <p className="text-sm font-semibold text-slate-800">{next}</p>
                        </>
                      ) : (
                        <p className="text-sm font-semibold text-green-600">All steps complete ✓</p>
                      )}
                      <p className="text-[10px] text-slate-400 mt-3">
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
                  className="text-xs text-slate-400 hover:text-slate-600 transition-colors underline underline-offset-2"
                >
                  {showArchived ? "Hide archived" : `View archived (${archivedCampaigns.length})`}
                </button>

                {showArchived && (
                  <div className="mt-4 space-y-2">
                    {archivedCampaigns.map((c) => {
                      const status = STATUS_BADGES[c.status] || STATUS_BADGES.targeting;
                      return (
                        <div key={c.id} className="bg-white rounded-2xl border border-slate-200 p-4 opacity-60 hover:opacity-80 transition-opacity flex items-center justify-between gap-3">
                          <div className="min-w-0 flex items-center gap-3">
                            <div className="min-w-0">
                              <span className="text-sm font-medium text-slate-900 truncate block">{c.role}</span>
                              <span className="text-xs text-slate-500 truncate block">{c.company}</span>
                            </div>
                            <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase shrink-0 ${status.classes}`}>
                              {status.label}
                            </span>
                          </div>
                          <button
                            className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 shrink-0"
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
