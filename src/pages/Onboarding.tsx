import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Compass, ArrowRight, Linkedin, Mail, Check, X, Briefcase, MapPin, Calendar, Search, Heart, BadgeCheck, Link as LinkIcon, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

const ONBOARDING_KEY = "preplane_onboarding_done";
const TARGET_KEY = "preplane_onboarding_target";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const passwordRules = [
  { label: "Minimum 8 characters", test: (p: string) => p.length >= 8 },
  { label: "At least one uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
  { label: "At least one lowercase letter", test: (p: string) => /[a-z]/.test(p) },
  { label: "At least one number", test: (p: string) => /[0-9]/.test(p) },
];

const Onboarding = () => {
  const [searchParams] = useSearchParams();
  const initialStep = searchParams.get("step") === "4" ? 4 : 1;
  const [step, setStep] = useState(initialStep);
  const [targetRole, setTargetRole] = useState("");
  const [targetLocation, setTargetLocation] = useState("");
  const [targetStart, setTargetStart] = useState("");
  const [companySizes, setCompanySizes] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [isReturning, setIsReturning] = useState(false);
  const [ready, setReady] = useState(false);

  // Auth form state (step 4)
  const [isLogin, setIsLogin] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [touched, setTouched] = useState<{ email?: boolean; password?: boolean }>({});
  const [forgotMode, setForgotMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const { user, loading: sessionLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const isEmailValid = EMAIL_REGEX.test(email);
  const passwordChecks = useMemo(() => passwordRules.map((r) => ({ ...r, met: r.test(password) })), [password]);
  const isPasswordValid = passwordChecks.every((c) => c.met);

  // If user is already logged in, check onboarding status
  useEffect(() => {
    if (sessionLoading) return;
    if (!user) {
      // Load target from localStorage if available (pre-auth returning)
      const saved = localStorage.getItem(TARGET_KEY);
      if (saved) {
        try {
          const t = JSON.parse(saved);
          if (t.target_role) setTargetRole(t.target_role);
          if (t.target_location) setTargetLocation(t.target_location);
          if (t.target_start) setTargetStart(t.target_start);
        } catch {}
      }
      setReady(true);
      return;
    }
    // Logged-in user — check if onboarding done
    supabase
      .from("profiles")
      .select("onboarding_completed, target_role, target_location, target_start")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (!data) { setReady(true); return; }
        const d = data as any;
        if (d.onboarding_completed) {
          setIsReturning(true);
          setStep(2); // Let them edit target
          if (d.target_role) setTargetRole(d.target_role);
          if (d.target_location) setTargetLocation(d.target_location);
          if (d.target_start) setTargetStart(d.target_start);
        } else {
          // Logged in but didn't finish onboarding — start fresh
          if (d.target_role) setTargetRole(d.target_role);
          if (d.target_location) setTargetLocation(d.target_location);
          if (d.target_start) setTargetStart(d.target_start);
        }
        setReady(true);
      });
  }, [user, sessionLoading]);

  // After OAuth sign-in, user state changes — save target and go to app
  useEffect(() => {
    if (!user || !ready) return;
    // If we're on step 4 (auth step) and user just signed in, save and redirect
    if (step === 4) {
      saveProfileAndComplete();
    }
  }, [user]);

  const saveProfileAndComplete = async () => {
    if (!user) return;
    setSaving(true);
    // Load from localStorage if component state is empty
    const role = targetRole || (() => { try { return JSON.parse(localStorage.getItem(TARGET_KEY) || "{}").target_role; } catch { return null; } })();
    const loc = targetLocation || (() => { try { return JSON.parse(localStorage.getItem(TARGET_KEY) || "{}").target_location; } catch { return null; } })();
    const start = targetStart || (() => { try { return JSON.parse(localStorage.getItem(TARGET_KEY) || "{}").target_start; } catch { return null; } })();
    await supabase
      .from("profiles")
      .update({
        target_role: role || null,
        target_location: loc || null,
        target_start: start || null,
        onboarding_completed: true,
      } as any)
      .eq("user_id", user.id);
    // Clean up localStorage
    localStorage.removeItem(TARGET_KEY);
    localStorage.removeItem(ONBOARDING_KEY);
    setSaving(false);
    navigate("/app");
  };

  const saveTargetAndAdvance = async () => {
    if (user) {
      // Logged-in user editing target
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
    } else {
      // Not logged in — save to localStorage, advance
      localStorage.setItem(TARGET_KEY, JSON.stringify({
        target_role: targetRole,
        target_location: targetLocation,
        target_start: targetStart,
      }));
      setStep(3);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ email: true, password: true });

    if (!isLogin) {
      if (!isEmailValid) { setAuthError("Please enter a valid email address"); return; }
      if (!isPasswordValid) { setAuthError("Password doesn't meet the requirements"); return; }
    }

    setAuthLoading(true);
    setAuthError(null);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          if (error.message?.toLowerCase().includes("email not confirmed")) {
            setAuthError("Please verify your email before logging in. Check your inbox for the verification link.");
            return;
          }
          throw error;
        }
        // Save target + complete for returning login
        // The useEffect on user will handle it
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: displayName },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        // Store target data in localStorage so we can save after email verification
        localStorage.setItem(TARGET_KEY, JSON.stringify({
          target_role: targetRole,
          target_location: targetLocation,
          target_start: targetStart,
        }));
        navigate(`/verify-email?email=${encodeURIComponent(email)}`);
      }
    } catch (err: any) {
      const msg = err?.message || "Something went wrong. Please try again.";
      setAuthError(msg);
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setAuthLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setResetSent(true);
      toast({ title: "Check your email", description: "We sent you a password reset link." });
    } catch (err: any) {
      setAuthError(err?.message || "Failed to send reset email");
    } finally {
      setAuthLoading(false);
    }
  };

  const emailInputClass = () => {
    if (!touched.email || !email) return "";
    return isEmailValid
      ? "border-green-500 focus-visible:ring-green-500"
      : "border-destructive focus-visible:ring-destructive";
  };

  if (!ready || sessionLoading) return null;

  const totalSteps = user ? 3 : 4;
  const progressSteps = Array.from({ length: totalSteps }, (_, i) => i + 1);

  if (step === 1) {
    return (
      <div className="relative min-h-screen overflow-hidden flex flex-col" style={{ background: "#FAF9F6", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        {/* Background orbs */}
        <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-[#F97316]/5 blur-3xl -z-10" />
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-[#F97316]/5 blur-3xl -z-10" />

        {/* Header */}
        <header className="w-full border-b border-[#F97316]/10 px-6 md:px-20 py-4 flex items-center justify-between">
           <div className="flex items-center gap-2">
              <Compass className="w-6 h-6 text-[#F97316]" />
              <span className="text-xl font-extrabold text-slate-900 tracking-tight">PrepLane</span>
          </div>
          <div className="flex items-center gap-3">
            <button className="p-2 rounded-full bg-[#F97316]/10 text-slate-600 hover:bg-[#F97316]/20 transition-colors">
              <Search className="w-5 h-5" />
            </button>
            <div className="w-9 h-9 rounded-full bg-slate-200" />
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 flex flex-col items-center justify-center px-6 py-12">
          <div className="max-w-[720px] text-center space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Icon badge */}
            <div className="mx-auto w-fit p-4 rounded-full bg-[#F97316]/10">
              <Compass className="w-12 h-12 text-[#F97316]" />
            </div>

            {/* Heading */}
            <h1 className="text-4xl md:text-6xl font-extrabold leading-[1.1] tracking-tight text-slate-900">
              Stop applying to everything.
              <br />
              <span className="text-[#F97316]">Start owning your shot.</span>
            </h1>

            {/* Body */}
            <p className="text-lg md:text-xl font-medium text-slate-800 max-w-[640px] mx-auto leading-relaxed">
              Most students send 30+ applications and hear nothing back. Not because their CV is bad — because they never stopped to ask:{" "}
              <em className="font-bold">what do I actually want, and am I building toward it?</em>
            </p>
            <p className="text-base md:text-lg text-slate-800/70 max-w-[600px] mx-auto leading-relaxed">
              PrepLane is being built to change that. Not a tool that helps you apply faster — one that helps you apply smarter, to fewer roles, with a genuinely compelling case for each one.
            </p>

            {/* CTA */}
            <div>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="group inline-flex items-center gap-2 rounded-xl h-14 px-8 bg-[#F97316] text-white text-lg font-bold shadow-lg shadow-[#F97316]/25 hover:-translate-y-0.5 transition-all active:translate-y-0"
              >
                I'm in
                <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="py-6 text-center text-sm uppercase tracking-widest text-slate-800/40">
          Build Smarter • Apply Better • PrepLane 2026
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Progress indicator */}
      <div className="w-full flex justify-center pt-8 pb-4">
        <div className="flex items-center gap-2">
          {progressSteps.map((s) => (
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


          {step === 2 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              <div className="w-full max-w-lg mx-auto bg-white rounded-xl shadow-sm border border-slate-100 p-8 md:p-12 space-y-8">
                {/* Header */}
                <div className="space-y-4 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-[#F97316] flex items-center justify-center">
                      <Compass className="h-4 w-4 text-white" />
                    </div>
                    <span className="text-lg font-bold text-slate-900 tracking-tight">PrepLane</span>
                  </div>
                  <div>
                    <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                      What are you working toward?
                    </h1>
                    <p className="text-slate-500 mt-2 text-sm">
                      Tell us your goals to personalize your career path.
                    </p>
                  </div>
                </div>

                {/* Form fields */}
                <div className="space-y-4">
                  <div className="relative">
                    <Briefcase className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="e.g. Product Designer"
                      value={targetRole}
                      onChange={(e) => setTargetRole(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316] focus:border-[#F97316] transition-colors"
                    />
                  </div>
                  <div className="relative">
                    <MapPin className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="e.g. San Francisco, Remote"
                      value={targetLocation}
                      onChange={(e) => setTargetLocation(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] focus:border-[hsl(var(--primary))] transition-colors"
                    />
                  </div>
                  <div className="relative">
                    <Calendar className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                    <select
                      value={targetStart}
                      onChange={(e) => setTargetStart(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] focus:border-[hsl(var(--primary))] transition-colors"
                    >
                      <option value="" disabled>When do you want to start?</option>
                      <option value="Immediately">Immediately</option>
                      <option value="In 1–3 months">In 1–3 months</option>
                      <option value="In 3–6 months">In 3–6 months</option>
                      <option value="Just exploring">Just exploring</option>
                    </select>
                  </div>
                </div>

                {/* Company size pills */}
                <div className="space-y-3">
                  <p className="text-sm font-medium text-slate-700">What size company interests you?</p>
                  <div className="flex flex-wrap gap-2">
                    {["Early-stage startup", "Scaleup", "Boutique", "Mid-size", "Big Tech"].map((size) => {
                      const selected = companySizes.includes(size);
                      return (
                        <button
                          key={size}
                          type="button"
                          onClick={() =>
                            setCompanySizes((prev) =>
                              selected ? prev.filter((s) => s !== size) : [...prev, size]
                            )
                          }
                          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                            selected
                              ? "border border-[hsl(var(--primary))] text-[hsl(var(--primary))] bg-orange-50"
                              : "border border-slate-200 text-slate-600 bg-white hover:border-slate-300"
                          }`}
                        >
                          {size}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* CTA */}
                <button
                  type="button"
                  onClick={saveTargetAndAdvance}
                  disabled={saving}
                  className="w-full flex items-center justify-center gap-2 bg-[hsl(var(--primary))] hover:bg-orange-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-orange-200 transition-colors disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Continue"}
                  <ArrowRight className="w-5 h-5" />
                </button>

                {/* Footer */}
                <p className="text-center text-xs text-slate-400">
                  Step 1 of 3: Professional Background
                </p>
              </div>
            </div>
          )}

          {/* Step 3 — The invitation */}
          {step === 3 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              <div className="w-full max-w-lg mx-auto bg-white rounded-xl shadow-sm border border-slate-100 p-8 md:p-12 space-y-8">
                {/* Icon badge */}
                <div className="flex justify-center">
                  <div className="relative">
                    <div className="w-20 h-20 rounded-full bg-[hsl(var(--primary))]/10 flex items-center justify-center">
                      <Heart className="w-8 h-8 text-[hsl(var(--primary))]" />
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[hsl(var(--primary))]/15 flex items-center justify-center">
                      <BadgeCheck className="w-4 h-4 text-[hsl(var(--primary))]" />
                    </div>
                  </div>
                </div>

                {/* Heading */}
                <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight text-center">
                  Help me build this for you.
                </h1>

                {/* Body */}
                <p className="text-slate-500 text-base md:text-lg leading-relaxed text-center">
                  PrepLane is being built in public by a 20-year-old who faced the exact same problem. If you have ideas, frustrations, or features you wish existed — I genuinely want to hear from you. Early users are shaping what this becomes.
                </p>
                <p className="text-slate-500 text-base md:text-lg leading-relaxed text-center">
                  Oh, and PrepLane is completely free. No credit card, no trial, no catch. Just a tool I wish existed when I started applying.
                </p>

                {/* Action buttons */}
                <div className="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => window.open("https://www.linkedin.com/in/marcodonghiaa/", "_blank")}
                    className="flex items-center gap-2 px-6 py-3.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-medium text-sm hover:border-slate-300 transition-colors"
                  >
                    <LinkIcon className="w-4 h-4 text-slate-500" />
                    Connect on LinkedIn
                  </button>
                  <button
                    type="button"
                    onClick={() => window.open("mailto:marco.dgh06@gmail.com", "_blank")}
                    className="flex items-center gap-2 px-6 py-3.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-medium text-sm hover:border-slate-300 transition-colors"
                  >
                    <MessageSquare className="w-4 h-4 text-slate-500" />
                    Send feedback
                  </button>
                </div>

                {/* CTA */}
                <button
                  type="button"
                  onClick={() => {
                    if (user) {
                      saveProfileAndComplete();
                    } else {
                      localStorage.setItem(ONBOARDING_KEY, "true");
                      setStep(4);
                    }
                  }}
                  disabled={saving}
                  className="w-full flex items-center justify-center gap-2 bg-[hsl(var(--primary))] hover:bg-orange-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-orange-200 transition-colors disabled:opacity-60"
                >
                  {saving ? "Starting..." : "Start building my profile"}
                  <ArrowRight className="w-5 h-5" />
                </button>

                {/* Footer */}
                <p className="text-center text-xs text-slate-400">
                  Step 3 of 4 · <span className="text-[hsl(var(--primary))]">Community & Vision</span>
                </p>
              </div>
            </div>
          )}

          {/* Step 4 — Sign up / Login (only for unauthenticated users) */}
          {step === 4 && !user && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6 text-center">
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                Save your profile and get started
              </h1>
              <p className="text-muted-foreground text-base md:text-lg max-w-[480px] mx-auto">
                Create a free account to save your target, your CV, and your applications. Takes 10 seconds.
              </p>

              {/* Google OAuth */}
              <div className="max-w-[400px] mx-auto space-y-3">
                <Button
                  variant="outline"
                  className="w-full h-12 text-base"
                  type="button"
                  disabled={authLoading}
                  onClick={async () => {
                    // Store target in localStorage before OAuth redirect
                    localStorage.setItem(TARGET_KEY, JSON.stringify({
                      target_role: targetRole,
                      target_location: targetLocation,
                      target_start: targetStart,
                    }));
                    setAuthLoading(true);
                    const { error } = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
                    if (error) {
                      toast({ title: "Error", description: error.message, variant: "destructive" });
                      setAuthLoading(false);
                    }
                  }}
                >
                  <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  Continue with Google
                </Button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">or with email</span>
                  </div>
                </div>

                {forgotMode ? (
                  resetSent ? (
                    <div className="space-y-4 text-left">
                      <div className="rounded-md bg-primary/10 border border-primary/20 p-3 text-sm text-primary">
                        Check your email for a password reset link.
                      </div>
                      <button
                        type="button"
                        className="text-sm text-primary hover:underline font-medium"
                        onClick={() => { setForgotMode(false); setResetSent(false); setAuthError(null); }}
                      >
                        ← Back
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleForgotPassword} className="space-y-4 text-left">
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
                      </div>
                      {authError && <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">{authError}</div>}
                      <Button type="submit" className="w-full" disabled={authLoading}>{authLoading ? "Sending..." : "Send Reset Link"}</Button>
                      <button type="button" className="text-sm text-primary hover:underline font-medium w-full text-center" onClick={() => { setForgotMode(false); setAuthError(null); }}>← Back</button>
                    </form>
                  )
                ) : (
                  <form onSubmit={handleAuth} className="space-y-4 text-left">
                    {!isLogin && (
                      <div className="space-y-2">
                        <Label htmlFor="displayName">Your name</Label>
                        <Input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" required={!isLogin} />
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                        placeholder="you@example.com"
                        required
                        className={emailInputClass()}
                      />
                      {touched.email && email && !isEmailValid && (
                        <p className="text-xs text-destructive">Please enter a valid email address</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="password">Password</Label>
                        {isLogin && (
                          <button type="button" className="text-xs text-primary hover:underline" onClick={() => { setForgotMode(true); setAuthError(null); }}>Forgot password?</button>
                        )}
                      </div>
                      <Input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                        placeholder="••••••••"
                        required
                        minLength={isLogin ? 6 : 8}
                      />
                      {!isLogin && (touched.password || password.length > 0) && (
                        <ul className="space-y-1 mt-2">
                          {passwordChecks.map((check, i) => (
                            <li key={i} className={`flex items-center gap-1.5 text-xs ${check.met ? "text-green-600" : "text-destructive"}`}>
                              {check.met ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                              {check.label}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    {authError && <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">{authError}</div>}
                    <Button type="submit" className="w-full text-base h-11" disabled={authLoading}>
                      {authLoading ? "Please wait..." : isLogin ? "Sign In" : <>Create my free account <ArrowRight className="ml-1 h-4 w-4" /></>}
                    </Button>
                  </form>
                )}

                <div className="text-sm text-muted-foreground">
                  {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
                  <button
                    type="button"
                    className="text-primary hover:underline font-medium"
                    onClick={() => { setIsLogin(!isLogin); setAuthError(null); setForgotMode(false); setTouched({}); }}
                  >
                    {isLogin ? "Sign up" : "Sign in"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
