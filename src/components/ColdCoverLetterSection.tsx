import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Copy, FileText, Loader2, AlertTriangle, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ColdCoverLetterSectionProps {
  cvPlainText: string;
  company: string;
  roleType: string;
  powBrief: string | null;
}

const ColdCoverLetterSection = ({ cvPlainText, company, roleType, powBrief }: ColdCoverLetterSectionProps) => {
  const { toast } = useToast();
  const [coverLetter, setCoverLetter] = useState("");
  const [loading, setLoading] = useState(false);
  const [contactName, setContactName] = useState("");

  const hasPow = !!powBrief;

  const handleGenerate = async () => {
    if (!hasPow) return;
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Please sign in to use this feature.");

      const { data, error } = await supabase.functions.invoke("generate-cold-cover-letter", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: {
          cvContent: cvPlainText,
          company,
          roleType,
          powBrief,
          contactName: contactName.trim() || undefined,
        },
      });

      if (error) {
        const msg = error.message || "Something went wrong.";
        if (msg.includes("daily limit") || msg.includes("429")) {
          toast({ title: "Daily limit reached. Come back tomorrow.", variant: "destructive" });
        } else if (msg.includes("402")) {
          toast({ title: "AI usage limit reached. Please add credits.", variant: "destructive" });
        } else {
          toast({ title: msg, variant: "destructive" });
        }
        return;
      }

      if (data?.coverLetter) {
        setCoverLetter(data.coverLetter);
        toast({ title: "Cover letter generated!" });
      } else {
        toast({ title: "No cover letter was returned. Please try again.", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: err.message || "Something went wrong.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(coverLetter);
    toast({ title: "Copied to clipboard" });
  };

  return (
    <Card className="border-primary/10">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Mail className="h-4 w-4 text-primary" />
          Want a cover letter? Optional but useful for email outreach.
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasPow ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-900">
                Build your Proof of Work first
              </p>
              <p className="text-sm text-amber-800/80 mt-1">
                The cover letter needs to lead with something real.
              </p>
            </div>
          </div>
        ) : !coverLetter ? (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Contact's first name (optional — improves the greeting)
              </label>
              <Input
                placeholder="e.g. Sarah"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="max-w-xs"
              />
            </div>
            <Button onClick={handleGenerate} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  Generate cold outreach cover letter
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <Textarea
              value={coverLetter}
              onChange={(e) => setCoverLetter(e.target.value)}
              className="min-h-[240px] text-sm leading-relaxed"
            />
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handleCopy}>
                <Copy className="h-3.5 w-3.5 mr-1" /> Copy
              </Button>
              <Button size="sm" variant="outline" onClick={handleGenerate} disabled={loading}>
                {loading ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <FileText className="h-3.5 w-3.5 mr-1" />}
                Regenerate
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ColdCoverLetterSection;
