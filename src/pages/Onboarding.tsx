import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Compass, ArrowRight, Linkedin, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Navigate } from "react-router-dom";

const Onboarding = () => {
  const [step, setStep] = useState(1);
  const [targetRole, setTargetRole] = useState("");
  const [targetLocation, setTargetLocation] = useState("");
  const [targetStart, setTargetStart] = useState("");
  const [saving, setSaving] = useState(false);
  const [isReturning, setIsReturning] = useState(false);
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Load existing profile data if returning user
  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("onboarding_completed, target_role, target_location, target_start")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (!data) return;
        const d = data as any;
        if (d.onboarding_completed) {
          setIsReturning(true);
          setStep(2); // Go straight to target editing
        }
        if (d.target_role) setTargetRole(d.target_role);
        if (d.target_location) setTargetLocation(d.target_location);
        if (d.target_start) setTargetStart(d.target_start);
      });
  }, [user]);

  if (authLoading) return null;
  if (!user) return <Navigate to="/auth" replace />;

  const saveTargetAndAdvance = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        target_role: targetRole || null,
        target_location: targetLocation || null,
        target_start: targetStart || null,
      } as any)
      .eq("user_id", user.id);
    setSaving(false);
    if (error) {
      toast({ title: "Error saving target", description: error.message, variant: "destructive" });
      return;
    }
    if (isReturning) {
      toast({ title: "Target updated!" });
      navigate("/app");
    } else {
      setStep(3);
    }
  };

  const completeOnboarding = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ onboarding_completed: true } as any)
      .eq("user_id", user.id);
    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    navigate("/app");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Progress indicator */}
      <div className="w-full flex justify-center pt-8 pb-4">
        <div className="flex items-center gap-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-2 rounded-full transition-all duration-500 ${
                s === step ? "w-10 bg-primary" : s < step ? "w-6 bg-primary/60" : "w-6 bg-muted"
              }`}
            />
          ))}
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-[600px]">
          {/* Step 1 — The vision */}
          {step === 1 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8 text-center">
              <Compass className="h-10 w-10 text-primary mx-auto" />
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight leading-tight">
                Stop applying to everything.
                <br />
                Start owning your shot.
              </h1>
              <p className="text-muted-foreground text-base md:text-lg leading-relaxed max-w-[540px] mx-auto">
                Most students send 30+ applications and hear nothing back. Not because their CV is bad — because they never stopped to ask: <em>what do I actually want, and am I building toward it?</em>
              </p>
              <p className="text-muted-foreground text-base md:text-lg leading-relaxed max-w-[540px] mx-auto">
                PrepLane is being built to change that. Not a tool that helps you apply faster — one that helps you apply smarter, to fewer roles, with a genuinely compelling case for each one.
              </p>
              <p className="text-muted-foreground text-base md:text-lg leading-relaxed max-w-[540px] mx-auto">
                We are just getting started. And we want to build this with you.
              </p>
              <Button size="lg" onClick={() => setStep(2)} className="mt-4 text-base px-8">
                I'm in <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Step 2 — Define your target */}
          {step === 2 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
              <div className="text-center space-y-3">
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                  What are you working toward?
                </h1>
                <p className="text-muted-foreground text-base md:text-lg max-w-[500px] mx-auto">
                  This becomes your north star. Every application you work on in PrepLane will be measured against it.
                </p>
              </div>

              <div className="space-y-5 max-w-[480px] mx-auto">
                <div className="space-y-2">
                  <Label htmlFor="target-role">What kind of role are you targeting?</Label>
                  <Input
                    id="target-role"
                    placeholder="e.g. VC analyst, startup operations, business development"
                    value={targetRole}
                    onChange={(e) => setTargetRole(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="target-location">Where?</Label>
                  <Input
                    id="target-location"
                    placeholder="e.g. Italy, Remote, London"
                    value={targetLocation}
                    onChange={(e) => setTargetLocation(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="target-start">When are you looking to start?</Label>
                  <Input
                    id="target-start"
                    placeholder="e.g. Summer 2026, ASAP"
                    value={targetStart}
                    onChange={(e) => setTargetStart(e.target.value)}
                  />
                </div>
              </div>

              <div className="text-center">
                <Button size="lg" onClick={saveTargetAndAdvance} disabled={saving} className="text-base px-8">
                  {saving ? "Saving..." : "Set my target"} <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 3 — The invitation */}
          {step === 3 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8 text-center">
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                Help me build this for you.
              </h1>
              <p className="text-muted-foreground text-base md:text-lg leading-relaxed max-w-[540px] mx-auto">
                PrepLane is being built in public by a 20-year-old who faced the exact same problem. If you have ideas, frustrations, or features you wish existed — I genuinely want to hear from you. Early users are shaping what this becomes.
              </p>

              <div className="flex items-center justify-center gap-3">
                <Button
                  variant="outline"
                  size="lg"
                  className="text-base"
                  onClick={() => window.open("https://www.linkedin.com/in/marcodonghiaa/", "_blank")}
                >
                  <Linkedin className="mr-2 h-4 w-4" />
                  Connect on LinkedIn
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="text-base"
                  onClick={() => window.open("mailto:marco.dgh06@gmail.com", "_blank")}
                >
                  <Mail className="mr-2 h-4 w-4" />
                  Send feedback
                </Button>
              </div>

              <button
                onClick={completeOnboarding}
                className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
              >
                Skip for now
              </button>

              <div>
                <Button size="lg" onClick={completeOnboarding} disabled={saving} className="text-base px-8">
                  {saving ? "Starting..." : "Start building my profile"} <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
