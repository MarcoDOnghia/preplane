import { useState, useEffect, useMemo } from "react";
import AppFooter from "@/components/AppFooter";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Rocket, ArrowRight, Linkedin, Mail, Check, X, Briefcase, Building2, FileText, MapPin, Calendar, Search, Heart, BadgeCheck, Link as LinkIcon, MessageSquare, User, Lock, Eye, EyeOff, GraduationCap, Sparkles, Lightbulb, CheckCircle2, Archive, LogOut, Target, LayoutDashboard } from "lucide-react";
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

const SignInBanner = () => {
  const navigate = useNavigate();
  return (
    <div className="w-full flex justify-center pt-4 pb-2 px-4">
      <button
        onClick={() => navigate("/onboarding?step=4&mode=login")}
        className="inline-flex items-center gap-2 px-5 py-2 rounded-full border border-[#F97316] text-[#F97316] text-sm font-medium hover:bg-[#F97316]/5 transition-colors"
      >
        Already a PrepLane user? Sign in →
      </button>
    </div>
  );
};

const Onboarding = () => {
  const [searchParams] = useSearchParams();
  const initialStep = searchParams.get("step") === "4" ? 4 : 1;
  const initialLoginMode = searchParams.get("mode") === "login";
  const [step, setStep] = useState(initialStep);
  const [targetRole, setTargetRole] = useState("");
  const [targetLocation, setTargetLocation] = useState("");
  const [targetStart, setTargetStart] = useState("");
  const [companySizes, setCompanySizes] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [isReturning, setIsReturning] = useState(false);
  const [ready, setReady] = useState(false);

  // Auth form state (step 4)
  const [isLogin, setIsLogin] = useState(initialLoginMode);

  // Sync step and login mode when URL search params change (e.g. Sign In banner click)
  useEffect(() => {
    const urlStep = searchParams.get("step") === "4" ? 4 : null;
    const urlMode = searchParams.get("mode") === "login";
    if (urlStep !== null) setStep(urlStep);
    if (urlMode) setIsLogin(true);
  }, [searchParams]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [touched, setTouched] = useState<{ email?: boolean; password?: boolean }>({});
  const [forgotMode, setForgotMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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

    // Only update fields that have actual values — never overwrite existing data with null
    const updates: Record<string, any> = { onboarding_completed: true };
    if (role) updates.target_role = role;
    if (loc) updates.target_location = loc;
    if (start) updates.target_start = start;

    await supabase
      .from("profiles")
      .update(updates)
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
        const { data: signUpData, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: displayName },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        // Check if email is already registered (empty identities array)
        if (signUpData?.user?.identities && signUpData.user.identities.length === 0) {
          setAuthError("ALREADY_EXISTS");
          setAuthLoading(false);
          return;
        }
        // Store target data in localStorage so we can save after email verification
        localStorage.setItem(TARGET_KEY, JSON.stringify({
          target_role: targetRole,
          target_location: targetLocation,
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
      <div className="relative min-h-screen overflow-hidden flex flex-col items-center" style={{ background: "#111111", fontFamily: "Inter, sans-serif" }}>
        {/* Background glow blobs */}
        <div className="fixed top-0 left-0 rounded-full pointer-events-none" style={{ width: "40vw", height: "40vw", background: "#f97415", opacity: 0.08, filter: "blur(120px)", zIndex: -1 }} />
        <div className="fixed bottom-0 right-0 rounded-full pointer-events-none" style={{ width: "40vw", height: "40vw", background: "#f97415", opacity: 0.04, filter: "blur(120px)", zIndex: -1 }} />

        {/* Header - logo only, centered */}
        <header className="flex justify-center" style={{ paddingTop: "32px" }}>
          <div className="flex items-center gap-2">
            <div className="bg-[#f97415] p-2 rounded-xl flex items-center justify-center">
              <Rocket className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white">PrepLane</span>
          </div>
        </header>

        <div className="w-full max-w-[1200px] px-6 flex flex-col items-center text-center">
          {/* Progress pills */}
          <div className="flex flex-col items-center gap-3" style={{ marginTop: "32px" }}>
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-12 rounded-full bg-[#f97415]" />
              <div className="h-1.5 w-12 rounded-full bg-[#1e293b]" />
              <div className="h-1.5 w-12 rounded-full bg-[#1e293b]" />
              <div className="h-1.5 w-12 rounded-full bg-[#1e293b]" />
            </div>
            <span className="font-medium uppercase" style={{ color: "#64748b", fontSize: "11px", letterSpacing: "0.15em" }}>Step 1 of 4</span>
          </div>

          {/* Headline */}
          <h1 className="leading-[1.1]" style={{ fontSize: "clamp(36px, 6vw, 60px)", fontWeight: 900, letterSpacing: "-0.02em", marginTop: "80px" }}>
            <span className="text-white">Stop applying to everything.</span>
            <br />
            <span style={{ color: "#f97415" }}>Start owning your shot.</span>
          </h1>

          {/* Subtitle */}
          <div className="max-w-[520px]" style={{ color: "#64748b", fontSize: "18px", lineHeight: "1.7", marginTop: "32px" }}>
            <p>Most students send 30+ applications and hear nothing back. Not because their CV is bad — because they never stopped to ask:</p>
            <p className="italic font-bold mt-2">what do I actually want, and am I building toward it?</p>
          </div>

          {/* CTA */}
          <button
            type="button"
            onClick={() => setStep(2)}
            className="font-bold text-white transition-colors hover:bg-[#ea6c0a]"
            style={{ background: "#f97415", fontSize: "18px", padding: "16px 40px", borderRadius: "8px", marginTop: "48px" }}
          >
            I'm in →
          </button>

          {/* Social proof */}
          <p className="max-w-[600px]" style={{ fontSize: "13px", color: "#64748b", marginTop: "32px" }}>
            Joining students going after Stockholm scaleups, VC-backed founders, angel-funded teams, and the next generation of European startups.
          </p>

          {/* Stat cards */}
          <div className="flex flex-wrap justify-center gap-4" style={{ marginTop: "48px" }}>
            {[
              { number: "5", label: "targeted campaigns beat 50 random applications" },
              { number: "1", label: "proof of work opens doors a CV never will" },
              { number: "Free", label: "no credit card, no catch" },
            ].map((card) => (
              <div
                key={card.number}
                className="text-center"
                style={{
                  background: "#1a1a1a",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: "12px",
                  padding: "20px 28px",
                  minWidth: "200px",
                  maxWidth: "280px",
                }}
              >
                <div className="text-white" style={{ fontSize: "24px", fontWeight: 900 }}>{card.number}</div>
                <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>{card.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Sign in banner for all steps */}
      {!user && <SignInBanner />}

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


          {step === 2 && isReturning && (
            <div className="animate-in fade-in duration-500 fixed inset-0 flex flex-col" style={{ background: "#F8F7F5", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              {/* Header/Nav */}
              <header className="bg-white border-b border-slate-200 sticky top-0 z-50 backdrop-blur-md px-6 md:px-10 py-3 flex items-center justify-between">
                <button onClick={() => navigate("/app")} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                  <div className="bg-[#F97316] p-2 rounded-xl flex items-center justify-center">
                    <Rocket className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-xl font-extrabold tracking-tight text-slate-900">PrepLane</span>
                </button>
                <nav className="hidden md:flex items-center gap-6">
                  <button onClick={() => navigate("/app")} className="text-sm font-semibold text-slate-600 hover:text-[#F97316] transition-colors">Dashboard</button>
                  <button onClick={() => navigate("/cv-workspace")} className="text-sm font-semibold text-slate-600 hover:text-[#F97316] transition-colors">CV Workspace</button>
                  <button className="text-sm font-bold text-[#F97316] border-b-2 border-[#F97316] pb-1">My Target</button>
                  <button onClick={async () => { await supabase.auth.signOut(); navigate("/onboarding"); }} className="text-sm font-semibold text-slate-600 hover:text-[#F97316] transition-colors">Sign Out</button>
                </nav>
                <div className="size-10 rounded-full ring-2 ring-[#F97316]/20 bg-[#F97316]/10 flex items-center justify-center">
                  <span className="text-sm font-semibold text-[#F97316]">{user?.email?.charAt(0).toUpperCase() || "U"}</span>
                </div>
              </header>

              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto">
                <div className="max-w-6xl mx-auto px-6 md:px-10 py-10">
                  {/* Page hero */}
                  <div className="mb-10">
                    <h1 className="text-4xl md:text-5xl font-black text-slate-900 leading-tight tracking-tight">Set Your Target</h1>
                    <p className="text-slate-600 text-lg max-w-2xl mt-3">Define your dream role and company to generate a tailored proof of work brief that makes you stand out.</p>
                  </div>

                  {/* Main grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left column — form cards */}
                    <div className="lg:col-span-2 flex flex-col gap-6">
                      {/* Card 1 — Target Role */}
                      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <div className="flex items-center gap-3 mb-1">
                          <div className="size-12 rounded-lg bg-[#F97316]/10 flex items-center justify-center">
                            <Briefcase className="w-6 h-6 text-[#F97316]" />
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-slate-900">Target Role</h3>
                            <p className="text-slate-500 text-sm">What job title are you aiming for?</p>
                          </div>
                        </div>
                        <input
                          type="text"
                          placeholder="e.g. Senior Frontend Developer or Product Designer"
                          value={targetRole}
                          onChange={(e) => setTargetRole(e.target.value)}
                          className="w-full h-14 px-4 rounded-xl border border-slate-200 bg-[#F8F7F5] focus:border-[#F97316] focus:ring-[#F97316] focus:ring-2 focus:outline-none text-slate-900 placeholder:text-slate-400 mt-6"
                        />
                      </div>

                      {/* Card 2 — Location (Europe toggle) */}
                      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <div className="flex items-center gap-3 mb-1">
                          <div className="size-12 rounded-lg bg-blue-100 flex items-center justify-center">
                            <MapPin className="w-6 h-6 text-blue-600" />
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-slate-900">Location</h3>
                            <p className="text-slate-500 text-sm">Are you based in Europe?</p>
                          </div>
                        </div>
                        <div className="flex gap-3 mt-6">
                          <button
                            type="button"
                            onClick={() => setTargetLocation("Europe")}
                            className={`flex-1 px-4 py-3.5 rounded-xl text-sm font-medium transition-all ${
                              targetLocation === "Europe"
                                ? "border-2 border-[#F97316] text-[#F97316] bg-orange-50 shadow-sm"
                                : "border border-slate-200 text-slate-600 bg-[#F8F7F5] hover:border-slate-300"
                            }`}
                          >
                            🌍 Yes, I'm in Europe
                          </button>
                          <button
                            type="button"
                            onClick={() => setTargetLocation("")}
                            className={`flex-1 px-4 py-3.5 rounded-xl text-sm font-medium transition-all ${
                              targetLocation !== "Europe" && targetLocation !== null
                                ? "border-2 border-[#F97316] text-[#F97316] bg-orange-50 shadow-sm"
                                : targetLocation === null
                                  ? "border border-slate-200 text-slate-600 bg-[#F8F7F5] hover:border-slate-300"
                                  : "border border-slate-200 text-slate-600 bg-[#F8F7F5] hover:border-slate-300"
                            }`}
                          >
                            🌐 No, I'm elsewhere
                          </button>
                        </div>
                        <p className="text-xs text-slate-400 mt-2">
                          PrepLane is currently optimized for the European market. You can still use it anywhere.
                        </p>
                      </div>

                      {/* Card 3 — Preferences (optional) */}
                      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <div className="flex items-center gap-3 mb-1">
                          <div className="size-12 rounded-lg bg-green-100 flex items-center justify-center">
                            <Sparkles className="w-6 h-6 text-green-600" />
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-slate-900">Preferences <span className="text-slate-400 font-normal text-sm ml-1">(optional)</span></h3>
                            <p className="text-slate-500 text-sm">Help us personalize your experience.</p>
                          </div>
                        </div>

                        {/* Company size preference */}
                        <div className="mt-6 space-y-3">
                          <label className="text-sm font-medium text-slate-700">What size company interests you?</label>
                          <div className="flex flex-wrap gap-2">
                            {[
                              { label: "🚀 Early-stage startup", value: "Early-stage startup" },
                              { label: "📈 Scaleup", value: "Scaleup" },
                              { label: "🏦 Boutique", value: "Boutique" },
                              { label: "🏢 Mid-size", value: "Mid-size" },
                              { label: "🌐 Big Tech/Corporate", value: "Big Tech/Corporate" },
                            ].map((size) => {
                              const selected = companySizes.includes(size.value);
                              return (
                                <button
                                  key={size.value}
                                  type="button"
                                  onClick={() =>
                                    setCompanySizes((prev) =>
                                      selected ? prev.filter((s) => s !== size.value) : [...prev, size.value]
                                    )
                                  }
                                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                                    selected
                                      ? "border border-[#F97316] text-[#F97316] bg-orange-50"
                                      : "border border-slate-200 text-slate-600 bg-white hover:border-slate-300"
                                  }`}
                                >
                                  {size.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Timeline preference */}
                        <div className="mt-6 space-y-3">
                          <label className="text-sm font-medium text-slate-700">When are you looking to start?</label>
                          <div className="flex flex-wrap gap-2">
                            {["Immediately", "In 1-3 months", "In 3-6 months", "Just exploring"].map((option) => (
                              <button
                                key={option}
                                type="button"
                                onClick={() => setTargetStart(option)}
                                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                                  targetStart === option
                                    ? "border border-[#F97316] text-[#F97316] bg-orange-50"
                                    : "border border-slate-200 text-slate-600 bg-white hover:border-slate-300"
                                }`}
                              >
                                {option}
                              </button>
                            ))}
                          </div>
                        </div>

                        <p className="text-xs text-slate-400 mt-4">
                          These help us personalize suggestions in future updates.
                        </p>
                      </div>

                      {/* CTA */}
                      <button
                        type="button"
                        onClick={saveTargetAndAdvance}
                        disabled={saving}
                        className="w-fit px-8 py-4 bg-[#F97316] hover:bg-orange-600 text-white font-bold rounded-xl shadow-lg shadow-[#F97316]/20 flex items-center gap-2 transition-all disabled:opacity-60"
                      >
                        {saving ? "Saving..." : "Save target"}
                        <ArrowRight className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Right sidebar */}
                    <div className="flex flex-col gap-6">
                      {/* Pro-tip card */}
                      <div className="bg-[#F97316]/5 border border-[#F97316]/20 p-6 rounded-xl relative overflow-hidden">
                        <Lightbulb className="w-24 h-24 text-[#F97316]/10 absolute -right-4 -top-4" />
                        <div className="flex items-center gap-2 mb-3">
                          <Lightbulb className="w-5 h-5 text-[#F97316]" />
                          <span className="text-[#F97316] font-bold text-lg">Pro-tip</span>
                        </div>
                        <p className="text-slate-700 text-sm leading-relaxed mb-4">Defining a target helps our AI tailor your portfolio projects to exactly what recruiters are looking for.</p>
                        <div className="space-y-2.5">
                          <div className="flex items-start gap-2">
                            <CheckCircle2 className="w-4 h-4 text-[#F97316] mt-0.5 shrink-0" />
                            <span className="text-xs text-slate-600 font-medium">Matches technical stack requirements</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <CheckCircle2 className="w-4 h-4 text-[#F97316] mt-0.5 shrink-0" />
                            <span className="text-xs text-slate-600 font-medium">Aligns with company industry & tone</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <CheckCircle2 className="w-4 h-4 text-[#F97316] mt-0.5 shrink-0" />
                            <span className="text-xs text-slate-600 font-medium">Solves real-world problems relevant to the role</span>
                          </div>
                        </div>
                      </div>

                      {/* Previous Targets card */}
                      <div className="p-6 rounded-xl border border-dashed border-slate-300 flex flex-col items-center text-center gap-3">
                        <div className="w-full h-32 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, rgba(249,116,22,0.1) 0%, rgba(249,116,22,0.05) 100%)" }}>
                          <Archive className="w-10 h-10 text-slate-400" />
                        </div>
                        <span className="font-bold text-slate-900">Previous Targets</span>
                        <p className="text-slate-500 text-xs">No previous targets found. Your first brief will appear here once generated.</p>
                      </div>
                    </div>
                  </div>
                </div>

                <AppFooter />
              </div>
            </div>
          )}

          {step === 2 && !isReturning && (
            <div className="animate-in fade-in duration-500 fixed inset-0 z-50 flex flex-col" style={{ background: "#111111", fontFamily: "Inter, sans-serif" }}>
              {/* Header */}
              <div className="w-full max-w-[960px] mx-auto flex items-center justify-between px-6 py-6">
                <button
                  onClick={() => setStep(1)}
                  className="p-2.5 rounded-lg transition-colors"
                  style={{ background: "rgba(30,41,59,0.5)", border: "1px solid rgba(255,255,255,0.08)" }}
                  aria-label="Go back"
                >
                  <ArrowRight className="w-5 h-5 text-white rotate-180" />
                </button>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-12 rounded-full bg-[#f97415]" />
                  <div className="h-1.5 w-12 rounded-full bg-[#f97415]" />
                  <div className="h-1.5 w-12 rounded-full bg-[#334155]" />
                  <div className="h-1.5 w-12 rounded-full bg-[#334155]" />
                </div>
                <div className="w-10" />
              </div>

              {/* Main card */}
              <div className="flex-1 flex items-center justify-center px-4">
                <div
                  className="w-full max-w-[520px] space-y-8"
                  style={{
                    background: "#1a1a1a",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "12px",
                    padding: "48px",
                  }}
                >
                  {/* Label */}
                  <span className="font-bold uppercase" style={{ color: "#f97415", fontSize: "11px", letterSpacing: "0.15em" }}>
                    YOUR NORTH STAR
                  </span>

                  {/* Headline */}
                  <div style={{ marginTop: "12px" }}>
                    <h1 className="font-bold text-white" style={{ fontSize: "30px" }}>Who are you going after?</h1>
                    <p style={{ color: "#94a3b8", fontSize: "15px", marginTop: "8px" }}>
                      Every campaign you build in PrepLane will be calibrated around this target.
                    </p>
                  </div>

                  {/* Target role input */}
                  <div className="space-y-2">
                    <label className="block font-medium" style={{ color: "#cbd5e1", fontSize: "13px" }}>Target role</label>
                    <input
                      type="text"
                      value={targetRole}
                      onChange={(e) => setTargetRole(e.target.value)}
                      placeholder="e.g. GTM Intern, VC Analyst, Marketing Intern"
                      className="w-full focus:outline-none transition-colors"
                      style={{
                        background: "rgba(15,23,42,0.5)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: "8px",
                        padding: "12px 16px",
                        color: "white",
                        fontSize: "14px",
                      }}
                      onFocus={(e) => { e.target.style.borderColor = "#f97415"; e.target.style.boxShadow = "0 0 0 1px #f97415"; }}
                      onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.08)"; e.target.style.boxShadow = "none"; }}
                    />
                  </div>

                  {/* Target company type */}
                  <div className="space-y-2">
                    <label className="block font-medium" style={{ color: "#cbd5e1", fontSize: "13px" }}>Target company type</label>
                    <div className="flex flex-wrap gap-2">
                      {["Startup", "Scaleup", "Boutique firm", "VC fund"].map((type) => {
                        const selected = companySizes.includes(type);
                        return (
                          <button
                            key={type}
                            type="button"
                            onClick={() =>
                              setCompanySizes((prev) =>
                                selected ? prev.filter((s) => s !== type) : [...prev, type]
                              )
                            }
                            className="rounded-full font-medium transition-colors"
                            style={{
                              padding: "8px 16px",
                              fontSize: "13px",
                              background: selected ? "#f97415" : "rgba(30,41,59,0.5)",
                              color: selected ? "white" : "#94a3b8",
                              border: selected ? "1px solid #f97415" : "1px solid rgba(255,255,255,0.08)",
                            }}
                          >
                            {type}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* CTA */}
                  <button
                    type="button"
                    onClick={saveTargetAndAdvance}
                    disabled={saving || !targetRole.trim()}
                    className="group w-full flex items-center justify-center gap-2 text-white font-bold transition-all hover:bg-[#ea6c0a] disabled:opacity-60"
                    style={{ background: "#f97415", padding: "16px", borderRadius: "8px" }}
                  >
                    {saving ? "Saving..." : "Set my target"}
                    <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                  </button>
                </div>
              </div>

              {/* Footer logo */}
              <div className="flex justify-center py-6 opacity-30">
                <div className="flex items-center gap-2">
                  <div className="bg-[#f97415] p-1.5 rounded-lg flex items-center justify-center">
                    <Rocket className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-sm font-bold text-white">PrepLane</span>
                </div>
              </div>
            </div>
          )}

          {/* Step 3 — The invitation */}
          {step === 3 && (
            <div className="animate-in fade-in duration-500 fixed inset-0 z-50 flex flex-col" style={{ background: "#111111", fontFamily: "Inter, sans-serif" }}>
              {/* Header */}
              <div className="w-full max-w-[960px] mx-auto flex items-center justify-between px-6 py-6">
                <button
                  onClick={() => setStep(2)}
                  className="p-2.5 rounded-lg transition-colors hover:bg-white/10"
                  style={{ background: "rgba(255,255,255,0.05)" }}
                  aria-label="Go back"
                >
                  <ArrowRight className="w-5 h-5 text-white rotate-180" />
                </button>
                <div className="flex items-center gap-2 flex-1 mx-4">
                  <div className="h-1.5 flex-1 rounded-full bg-[#f97415]" />
                  <div className="h-1.5 flex-1 rounded-full bg-[#f97415]" />
                  <div className="h-1.5 flex-1 rounded-full bg-[#f97415]" />
                  <div className="h-1.5 flex-1 rounded-full" style={{ background: "rgba(255,255,255,0.10)" }} />
                </div>
                <div className="w-10" />
              </div>

              {/* Main card */}
              <div className="flex-1 flex items-center justify-center px-4">
                <div
                  className="w-full max-w-[520px] flex flex-col gap-8"
                  style={{
                    background: "#1a1a1a",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "12px",
                    padding: "48px",
                  }}
                >
                  {/* Label */}
                  <span className="font-bold uppercase" style={{ color: "#f97415", fontSize: "11px", letterSpacing: "0.1em" }}>
                    BUILT WITH YOU
                  </span>

                  {/* Headline */}
                  <h1 className="font-bold text-white tracking-tight" style={{ fontSize: "30px" }}>
                    Help me build this with you.
                  </h1>

                  {/* Paragraphs */}
                  <div className="flex flex-col gap-4" style={{ color: "#64748b", fontSize: "15px", lineHeight: "1.7" }}>
                    <p>PrepLane is being built by a 20yo student who faced the exact same problem.</p>
                    <p>If you have ideas, frustrations, or features you wish existed I genuinely want to hear from you. Early users are shaping what this becomes.</p>
                    <p>Oh, and PrepLane is completely free. No credit card, no trial, no catch. Just a tool I wished existed when I started applying.</p>
                  </div>

                  {/* Buttons */}
                  <div className="flex flex-col gap-3">
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
                      className="w-full text-white font-bold transition-colors hover:bg-[#ea6c0a] disabled:opacity-60"
                      style={{ background: "#f97415", padding: "16px", borderRadius: "8px" }}
                    >
                      {saving ? "Starting..." : "Start building my profile →"}
                    </button>

                    <a
                      href="https://www.linkedin.com/in/marcodonghiaa/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full text-center font-bold transition-colors"
                      style={{
                        color: "#f97415",
                        border: "1px solid #f97415",
                        padding: "16px",
                        borderRadius: "8px",
                        background: "transparent",
                      }}
                      onMouseEnter={(e) => { (e.target as HTMLElement).style.background = "rgba(249,116,22,0.05)"; }}
                      onMouseLeave={(e) => { (e.target as HTMLElement).style.background = "transparent"; }}
                    >
                      Connect on LinkedIn →
                    </a>
                  </div>
                </div>
              </div>

              {/* Footer logo */}
              <div className="flex justify-center py-6 opacity-30">
                <div className="flex items-center gap-2">
                  <div className="bg-[#f97415] p-1.5 rounded-lg flex items-center justify-center">
                    <Rocket className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-sm font-bold text-white">PrepLane</span>
                </div>
              </div>
            </div>
          )}

          {/* Step 4 — Sign up / Login (only for unauthenticated users) */}
          {step === 4 && !user && (
            <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "#111111", fontFamily: "Inter, sans-serif" }}>
              {/* Header */}
              <div className="w-full flex items-center justify-between" style={{ padding: "16px 24px" }}>
                <button
                  onClick={() => setStep(step - 1)}
                  className="flex items-center justify-center w-10 h-10 rounded-lg transition-colors"
                  style={{ background: "rgba(255,255,255,0.05)" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.10)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"; }}
                  aria-label="Go back"
                >
                  <ArrowRight className="w-5 h-5 text-white rotate-180" />
                </button>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4].map((s) => (
                    <div key={s} className="h-1.5 w-12 rounded-full bg-[#f97415]" />
                  ))}
                </div>
                <div className="w-10" />
              </div>

              {/* Main */}
              <div className="flex-1 flex items-center justify-center" style={{ padding: "48px 24px" }}>
                <div
                  className="w-full max-w-[448px]"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.10)",
                    borderRadius: "12px",
                    padding: "32px",
                    backdropFilter: "blur(8px)",
                  }}
                >
                  {/* Headline */}
                  <h1 className="text-center font-bold text-white" style={{ fontSize: "30px", marginBottom: "8px" }}>
                    Save your progress.
                  </h1>
                  <p className="text-center" style={{ color: "#94a3b8", fontSize: "14px", marginBottom: "24px" }}>
                    Create a free account to save your target, your CV, and your campaigns. Takes 10 seconds.
                  </p>

                  {/* Google Button */}
                  <button
                    type="button"
                    disabled={authLoading}
                    onClick={async () => {
                      localStorage.setItem(TARGET_KEY, JSON.stringify({
                        target_role: targetRole,
                        target_location: targetLocation,
                      }));
                      setAuthLoading(true);
                      const { error } = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
                      if (error) {
                        toast({ title: "Error", description: error.message, variant: "destructive" });
                        setAuthLoading(false);
                      }
                    }}
                    className="w-full flex items-center justify-center gap-3 bg-white font-semibold transition-colors disabled:opacity-60 hover:bg-[#f1f5f9]"
                    style={{ color: "#111111", fontSize: "15px", borderRadius: "8px", padding: "12px 16px", marginBottom: "16px" }}
                  >
                    <svg className="h-5 w-5" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    Continue with Google
                  </button>

                  {/* Divider */}
                  <div className="flex items-center gap-3" style={{ margin: "16px 0" }}>
                    <div className="flex-1" style={{ height: "1px", background: "rgba(255,255,255,0.10)" }} />
                    <span className="uppercase font-medium" style={{ color: "#64748b", fontSize: "13px", letterSpacing: "0.1em" }}>or</span>
                    <div className="flex-1" style={{ height: "1px", background: "rgba(255,255,255,0.10)" }} />
                  </div>

                  {/* Form */}
                  <form onSubmit={handleAuth}>
                    {/* Full Name — signup only */}
                    {!isLogin && (
                    <div style={{ marginBottom: "16px" }}>
                      <label className="block font-medium" style={{ color: "#cbd5e1", fontSize: "13px", marginBottom: "6px" }}>Full Name</label>
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="John Doe"
                        required={!isLogin}
                        className="w-full focus:outline-none transition-colors"
                        style={{
                          background: "rgba(255,255,255,0.05)",
                          border: "1px solid rgba(255,255,255,0.10)",
                          borderRadius: "8px",
                          color: "white",
                          padding: "12px 16px",
                          fontSize: "14px",
                        }}
                        onFocus={(e) => { e.target.style.borderColor = "#f97415"; e.target.style.boxShadow = "0 0 0 1px #f97415"; }}
                        onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.10)"; e.target.style.boxShadow = "none"; }}
                      />
                    </div>
                    )}

                    {/* Email */}
                    <div style={{ marginBottom: "16px" }}>
                      <label className="block font-medium" style={{ color: "#cbd5e1", fontSize: "13px", marginBottom: "6px" }}>Email Address</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onBlur={(e) => { setTouched((t) => ({ ...t, email: true })); e.target.style.borderColor = "rgba(255,255,255,0.10)"; e.target.style.boxShadow = "none"; }}
                        onFocus={(e) => { e.target.style.borderColor = "#f97415"; e.target.style.boxShadow = "0 0 0 1px #f97415"; }}
                        placeholder="john@example.com"
                        required
                        className="w-full focus:outline-none transition-colors"
                        style={{
                          background: "rgba(255,255,255,0.05)",
                          border: touched.email && email && !isEmailValid
                            ? "1px solid #ef4444"
                            : touched.email && email && isEmailValid
                            ? "1px solid #22c55e"
                            : "1px solid rgba(255,255,255,0.10)",
                          borderRadius: "8px",
                          color: "white",
                          padding: "12px 16px",
                          fontSize: "14px",
                        }}
                      />
                    </div>

                    {/* Password */}
                    <div style={{ marginBottom: "16px" }}>
                      <label className="block font-medium" style={{ color: "#cbd5e1", fontSize: "13px", marginBottom: "6px" }}>Password</label>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          onBlur={(e) => { setTouched((t) => ({ ...t, password: true })); e.target.style.borderColor = "rgba(255,255,255,0.10)"; e.target.style.boxShadow = "none"; }}
                          onFocus={(e) => { e.target.style.borderColor = "#f97415"; e.target.style.boxShadow = "0 0 0 1px #f97415"; }}
                          placeholder="••••••••"
                          required
                          minLength={8}
                          className="w-full focus:outline-none transition-colors"
                          style={{
                            background: "rgba(255,255,255,0.05)",
                            border: "1px solid rgba(255,255,255,0.10)",
                            borderRadius: "8px",
                            color: "white",
                            padding: "12px 16px",
                            fontSize: "14px",
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors hover:opacity-80"
                          style={{ color: "#64748b" }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#94a3b8"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#64748b"; }}
                        >
                          {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>

                    {/* Error */}
                    {authError && (
                      <div className="rounded-lg p-3 text-sm" style={{ backgroundColor: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444", marginBottom: "16px" }}>
                        {authError === "ALREADY_EXISTS" ? (
                          <>
                            An account with this email already exists.{" "}
                            <button
                              type="button"
                              className="font-medium hover:underline"
                              style={{ color: "#f97415" }}
                              onClick={() => { setIsLogin(true); setAuthError(null); setTouched({}); }}
                            >
                              Sign in instead
                            </button>
                          </>
                        ) : (
                          authError
                        )}
                      </div>
                    )}

                    {/* Submit */}
                    <button
                      type="submit"
                      disabled={authLoading}
                      className="w-full flex items-center justify-center gap-2 text-white font-bold transition-all active:scale-[0.98] hover:bg-[#ea6c0a] disabled:opacity-60"
                      style={{ background: "#f97415", fontSize: "16px", padding: "16px", borderRadius: "8px", marginTop: "8px" }}
                    >
                      {authLoading ? "Please wait..." : "Create my free account →"}
                    </button>
                  </form>
                </div>
              </div>

              {/* Footer */}
              <div className="text-center" style={{ padding: "32px", color: "#94a3b8", fontSize: "14px" }}>
                Already have an account?{" "}
                <button
                  type="button"
                  className="hover:underline"
                  style={{ color: "#f97415", fontWeight: 600 }}
                  onClick={() => setIsLogin(true)}
                >
                  Sign in
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
