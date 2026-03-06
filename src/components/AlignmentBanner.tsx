import { useState } from "react";
import { CheckCircle2, AlertTriangle, X } from "lucide-react";

interface AlignmentBannerProps {
  alignment: "strong" | "partial" | "weak";
  reason: string;
  targetRole: string;
}

const config = {
  strong: {
    bg: "bg-success/10 border-success/30",
    icon: <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />,
    text: (role: string, _reason?: string) => `This role is a strong step toward ${role}.`,
  },
  partial: {
    bg: "bg-yellow-500/10 border-yellow-500/30",
    icon: <AlertTriangle className="h-4 w-4 text-yellow-600 shrink-0 mt-0.5" />,
    text: (role: string, reason: string) =>
      `This role could be a useful stepping stone toward ${role} — ${reason}`,
  },
  weak: {
    bg: "bg-orange-500/10 border-orange-500/30",
    icon: <AlertTriangle className="h-4 w-4 text-orange-600 shrink-0 mt-0.5" />,
    text: (role: string, reason: string) =>
      `Heads up — it's not obvious how this role connects to your goal of ${role}. ${reason} Worth being intentional about it.`,
  },
};

const AlignmentBanner = ({ alignment, reason, targetRole }: AlignmentBannerProps) => {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const c = config[alignment];

  return (
    <div className={`rounded-lg border p-3 flex items-start gap-3 ${c.bg}`}>
      {c.icon}
      <p className="text-sm flex-1">
        {alignment === "strong" ? c.text(targetRole) : c.text(targetRole, reason)}
      </p>
      <button onClick={() => setDismissed(true)} className="shrink-0 text-muted-foreground hover:text-foreground">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

export default AlignmentBanner;
