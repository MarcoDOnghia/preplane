import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { X, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const LOCKED_ROLES: Record<string, string> = {
  "Software Engineer": "Software Engineer",
  "Product Manager": "Product Manager",
  "Designer": "Designer",
  "Finance / VC": "Finance / VC",
  "Operations": "Operations",
  "Other": "Other",
};

const UNLOCKED_ROLES = [
  "SDR / Sales",
  "GTM",
  "Marketing",
  "Growth",
];

export function isRoleLocked(role: string): boolean {
  const lower = role.toLowerCase();
  return Object.keys(LOCKED_ROLES).some(k => k.toLowerCase() === lower);
}

export function getLockedRoleLabel(role: string): string {
  const lower = role.toLowerCase();
  const match = Object.entries(LOCKED_ROLES).find(([k]) => k.toLowerCase() === lower);
  return match ? match[1] : role;
}

export { LOCKED_ROLES, UNLOCKED_ROLES };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: string;
  userId: string;
}

type ModalState = "waitlist" | "insight" | "success";

export default function RoleWaitlistModal({ open, onOpenChange, role, userId }: Props) {
  const [state, setState] = useState<ModalState>("waitlist");
  const [insight, setInsight] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleJoinWaitlist = async () => {
    setSubmitting(true);
    try {
      await supabase.from("role_waitlist" as any).upsert(
        { user_id: userId, role } as any,
        { onConflict: "user_id,role" }
      );
      setState("insight");
    } catch {
      // silently handle
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitInsight = async () => {
    if (!insight.trim()) return;
    setSubmitting(true);
    try {
      await supabase.from("role_waitlist_insights" as any).insert({
        user_id: userId,
        role,
        insight: sanitizeInput(insight),
      } as any);
      setState("success");
      setTimeout(() => {
        onOpenChange(false);
        // Reset for next open
        setTimeout(() => { setState("waitlist"); setInsight(""); }, 300);
      }, 2000);
    } catch {
      // silently handle
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = () => {
    onOpenChange(false);
    setTimeout(() => { setState("waitlist"); setInsight(""); }, 300);
  };

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(() => { setState("waitlist"); setInsight(""); }, 300);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent
        className="border-0 p-0 gap-0"
        style={{
          background: "#1A1A1A",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "16px",
          padding: "32px",
          maxWidth: "480px",
          fontFamily: "Inter, sans-serif",
        }}
      >
        <VisuallyHidden><DialogTitle>Role waitlist</DialogTitle></VisuallyHidden>

        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 rounded-sm transition-opacity hover:opacity-100"
          style={{ color: "#64748B", background: "none", border: "none", cursor: "pointer" }}
        >
          <X className="h-4 w-4" />
        </button>

        {state === "waitlist" && (
          <div className="space-y-5">
            <span
              style={{
                color: "#F97316",
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "0.15em",
                textTransform: "uppercase",
              }}
            >
              COMING SOON
            </span>

            <h2 style={{ color: "#FFFFFF", fontWeight: 700, fontSize: "22px", lineHeight: 1.3, marginTop: "8px" }}>
              We're building the {role} campaign.
              <br />
              But not until it's good enough.
            </h2>

            <p style={{ color: "#94A3B8", fontSize: "14px", lineHeight: 1.7 }}>
              Generic AI templates don't get replies.
              We're interviewing {role} leaders
              to build campaigns that actually work.
              <br /><br />
              We'll notify you when it's ready.
            </p>

            <button
              onClick={handleJoinWaitlist}
              disabled={submitting}
              style={{
                width: "100%",
                background: submitting ? "rgba(249,116,22,0.5)" : "#F97316",
                color: "#FFFFFF",
                fontWeight: 700,
                fontSize: "15px",
                padding: "14px",
                borderRadius: "8px",
                border: "none",
                cursor: submitting ? "not-allowed" : "pointer",
                transition: "background 0.2s",
              }}
            >
              {submitting ? "Joining..." : `Join the ${role} waitlist →`}
            </button>
          </div>
        )}

        {state === "insight" && (
          <div className="space-y-5">
            <h2 style={{ color: "#FFFFFF", fontWeight: 700, fontSize: "20px", lineHeight: 1.3 }}>
              You're on the list.
            </h2>

            <p style={{ color: "#94A3B8", fontSize: "14px", lineHeight: 1.7 }}>
              Want to move to the front?
              <br />
              Tell us what's hardest to prove
              in a {role} application.
            </p>

            <textarea
              value={insight}
              onChange={(e) => setInsight(e.target.value)}
              placeholder="The hardest thing to prove is..."
              style={{
                width: "100%",
                background: "#1A1A1A",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "8px",
                padding: "12px 16px",
                color: "white",
                fontSize: "14px",
                minHeight: "80px",
                outline: "none",
                resize: "vertical",
                fontFamily: "Inter, sans-serif",
              }}
              onFocus={(e) => { e.target.style.borderColor = "#F97316"; }}
              onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.08)"; }}
            />

            <button
              onClick={handleSubmitInsight}
              disabled={submitting || !insight.trim()}
              style={{
                width: "100%",
                background: submitting || !insight.trim() ? "rgba(249,116,22,0.5)" : "#F97316",
                color: "#FFFFFF",
                fontWeight: 700,
                fontSize: "15px",
                padding: "14px",
                borderRadius: "8px",
                border: "none",
                cursor: submitting || !insight.trim() ? "not-allowed" : "pointer",
                transition: "background 0.2s",
              }}
            >
              {submitting ? "Submitting..." : "Submit"}
            </button>

            <button
              onClick={handleSkip}
              style={{
                width: "100%",
                background: "transparent",
                color: "white",
                fontSize: "13px",
                padding: "10px",
                borderRadius: "8px",
                border: "1px solid rgba(255,255,255,0.15)",
                cursor: "pointer",
              }}
            >
              Skip
            </button>
          </div>
        )}

        {state === "success" && (
          <div className="flex flex-col items-center justify-center py-6 space-y-4">
            <CheckCircle2 className="w-12 h-12" style={{ color: "#22c55e" }} />
            <p style={{ color: "#22c55e", fontSize: "16px", fontWeight: 600, textAlign: "center" }}>
              Got it. You'll be first to know.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
