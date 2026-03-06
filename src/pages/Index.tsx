import { useState, useEffect } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import Header from "@/components/Header";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Plus, Sparkles, ArrowRight, Target, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const TARGET_KEY = "preplane_onboarding_target";
const ONBOARDING_KEY = "preplane_onboarding_done";

const STEPS = [
  { key: "step_cv_done", label: "Tailor CV", weight: 20 },
  { key: "step_connection_done", label: "Find connection", weight: 15 },
  { key: "step_outreach_done", label: "Send outreach", weight: 20 },
  { key: "step_proof_done", label: "Create proof of work", weight: 20 },
  { key: "step_cover_letter_done", label: "Cover letter", weight: 10 },
  { key: "step_followup_done", label: "Schedule follow-up", weight: 15 },
] as const;

const STATUS_BADGES: Record<string, { label: string; color: string }> = {
  targeting: { label: "Targeting", color: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  applied: { label: "Applied", color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20" },
  followed_up: { label: "Followed Up", color: "bg-purple-500/10 text-purple-600 border-purple-500/20" },
  response_received: { label: "Response", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  rejected: { label: "Rejected", color: "bg-destructive/10 text-destructive border-destructive/20" },
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
  step_cover_letter_done: boolean;
  step_followup_done: boolean;
  created_at: string;
}

function getStrength(c: CampaignRow) {
  return STEPS.reduce((sum, s) => sum + ((c as any)[s.key] ? s.weight : 0), 0);
}

function getNextStep(c: CampaignRow) {
  const idx = STEPS.findIndex((s) => !(c as any)[s.key]);
  return idx >= 0 ? STEPS[idx].label : null;
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
          .select("id, company, role, match_score, status, step_cv_done, step_connection_done, step_outreach_done, step_proof_done, step_cover_letter_done, step_followup_done, created_at")
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

  // Find best focus campaign: highest strength with incomplete steps
  const focusCampaign = campaigns
    .filter((c) => getNextStep(c) !== null && c.status !== "rejected")
    .sort((a, b) => getStrength(b) - getStrength(a))[0] || null;

  const atLimit = campaigns.length >= 10;

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
          <Button
            onClick={() => nav("/app/new")}
            disabled={atLimit}
            title={atLimit ? "You have 10 active campaigns. Complete or archive one first." : undefined}
          >
            <Plus className="h-4 w-4 mr-1" />
            New Campaign
          </Button>
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
        ) : campaigns.length === 0 ? (
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
              {campaigns.map((c) => {
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

                      {/* Strength bar */}
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
          </>
        )}
      </main>
    </div>
  );
};

export default Index;
