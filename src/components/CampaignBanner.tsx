import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";

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
        // Check for 10-campaign limit
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
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="pt-6 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <p className="text-sm">
            Your CV is ready. Turn this into a full campaign for{" "}
            <span className="font-semibold text-foreground">{company}</span>?
          </p>
        </div>
        <Button onClick={handleCreate} disabled={creating} size="sm">
          {creating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
          Build my campaign →
        </Button>
      </CardContent>
    </Card>
  );
};

export default CampaignBanner;
