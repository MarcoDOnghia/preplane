import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Rocket, Mail, CheckCircle2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email") || "";
  const [cooldown, setCooldown] = useState(0);
  const [sending, setSending] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  // Check if user is already verified (e.g. clicked link and came back)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user?.email_confirmed_at) {
        navigate("/app");
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleResend = async () => {
    if (cooldown > 0 || !email) return;
    setSending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) throw error;
      setCooldown(60);
      toast({ title: "Email sent", description: "Check your inbox for the verification link." });
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Failed to resend email", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <div className="bg-[#F97316] p-2 rounded-xl flex items-center justify-center">
              <Rocket className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900">PrepLane</span>
          </div>
        </div>

        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Mail className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Check your email</CardTitle>
            <CardDescription>
              We sent a verification link to{" "}
              <span className="font-medium text-foreground">{email || "your email"}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground space-y-2">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <span>Click the verification link in the email to activate your account</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <span>After verifying, you'll be redirected to the app</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <span>Check your spam folder if you don't see the email</span>
              </div>
            </div>

            <div className="space-y-2">
              <Button
                className="w-full"
                variant="outline"
                disabled={cooldown > 0 || sending || !email}
                onClick={handleResend}
              >
                {sending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : cooldown > 0 ? (
                  `Resend in ${cooldown}s`
                ) : (
                  "Resend verification email"
                )}
              </Button>
              <Button
                className="w-full"
                variant="ghost"
                onClick={() => navigate("/auth")}
              >
                ← Back to sign in
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default VerifyEmail;
