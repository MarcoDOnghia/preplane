import { useState } from "react";
import { CheckCircle2, AlertTriangle, X, Lightbulb } from "lucide-react";

interface AlignmentBannerProps {
  alignment: "strong" | "partial" | "weak";
  reason: string;
  targetRole: string;
}

const config = {
  strong: {
    bg: "bg-green-500/15 border-green-500/40",
    iconColor: "text-green-600",
    textColor: "text-green-900",
    label: "Strong alignment",
    text: (role: string, _reason?: string) =>
      `This role is a strong step toward ${role}. Keep going — you're on the right track.`,
  },
  partial: {
    bg: "bg-yellow-400/15 border-yellow-500/40",
    iconColor: "text-yellow-600",
    textColor: "text-yellow-900",
    label: "Partial alignment",
    text: (role: string, reason: string) =>
      `This role could be a useful stepping stone toward ${role} — ${reason}`,
  },
  weak: {
    bg: "bg-orange-500/15 border-orange-500/40",
    iconColor: "text-orange-600",
    textColor: "text-orange-900",
    label: "Weak alignment",
    text: (role: string, reason: string) =>
      `Heads up — it's not obvious how this role connects to your goal of ${role}. ${reason} Worth being intentional about it.`,
  },
};

const AlignmentBanner = ({ alignment, reason, targetRole }: AlignmentBannerProps) => {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const c = config[alignment];
  const Icon = alignment === "strong" ? CheckCircle2 : AlertTriangle;

  return (
    <div className={`w-full rounded-xl border-2 px-5 py-4 flex items-start gap-4 ${c.bg}`}>
      <div className={`shrink-0 mt-0.5 ${c.iconColor}`}>
        <Icon className="h-6 w-6" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-sm font-bold uppercase tracking-wide ${c.iconColor}`}>
            {c.label}
          </span>
        </div>
        <p className={`text-base font-medium leading-relaxed ${c.textColor}`}>
          {c.text(targetRole, reason)}
        </p>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  );
};

export default AlignmentBanner;
