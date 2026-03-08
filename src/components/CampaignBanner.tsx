import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowRight, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface CampaignBannerProps {
  company: string;
  role: string;
  jdText: string;
  cvPlainText: string;
  matchScore: number;
  coverLetter?: string;
}

const CampaignBanner = ({
  company,
  role,
  jdText,
  cvPlainText,
  matchScore,
  coverLetter,
}: CampaignBannerProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(false);
  const [explainerOpen, setExplainerOpen] = useState(false);

  const handleCreate = async () => {
    if (!user) return;
    setCreating(true);
    try {
      const { data, error } = await supabase
        .from("campaigns")
        .insert({
          user_id: user.id,
          company,
          role,
          jd_text: jdText,
          cv_version: cvPlainText,
          match_score: matchScore,
          status: "targeting",
          step_cv_done: true,
          cover_letter: coverLetter || null,
          step_cover_letter_done: !!coverLetter,
        } as any)
        .select("id")
        .single();

      if (error) {
        if (error.message?.includes("10 active campaigns")) {
          toast({
            title: "Campaign limit reached",
            description: "You have 10 active campaigns. PrepLane is built for focus — complete or archive one before adding a new one.",
            variant: "destructive",
          });
        } else {
          throw error;
        }
        return;
      }

      setCreated(true);
      toast({ title: "Campaign created!" });
      navigate(`/campaign/${data.id}`);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  if (created) return null;

  return (
    <div className="space-y-0">
      {/* Main campaign CTA */}
      <div className="rounded-xl bg-[hsl(30,100%,97%)] border border-[hsl(30,80%,85%)] p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2 flex-1">
            <h3 className="text-lg md:text-xl font-bold text-foreground leading-tight">
              Your CV is ready. But a CV alone won't get you the interview.
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xl">
              Students who reach out with a proof of work before applying get 3× more responses.
              Build your full campaign for <span className="font-semibold text-foreground">{company}</span> — it takes 20 minutes and changes everything.
            </p>
          </div>
          <div className="flex flex-col items-start md:items-end gap-2 shrink-0">
            <Button
              onClick={handleCreate}
              disabled={creating}
              size="lg"
              className="bg-[#F97316] hover:bg-[#EA6C12] text-primary-foreground font-semibold text-base px-6"
            >
              {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Build my campaign <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
            <p className="text-xs text-muted-foreground">
              Already applied? You can still build the outreach and follow-up steps.
            </p>
          </div>
        </div>
      </div>

      {/* Why not just apply now? — collapsible explainer */}
      <Collapsible open={explainerOpen} onOpenChange={setExplainerOpen}>
        <CollapsibleTrigger className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors pt-3 pb-1 cursor-pointer">
          <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${explainerOpen ? "rotate-180" : ""}`} />
          Why not just apply now?
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="rounded-lg border bg-muted/30 p-4 mt-1 space-y-3">
            <div className="flex items-start gap-3">
              <span className="text-lg">👤</span>
              <p className="text-sm text-foreground">
                <span className="font-medium">Find one person at {company}</span> — a name beats a contact form every time
              </p>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-lg">🛠️</span>
              <p className="text-sm text-foreground">
                <span className="font-medium">Build one proof of work</span> — something specific that shows you understand their problem
              </p>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-lg">📩</span>
              <p className="text-sm text-foreground">
                <span className="font-medium">Reach out before you apply</span> — let your work open the door, not your CV
              </p>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

export default CampaignBanner;
