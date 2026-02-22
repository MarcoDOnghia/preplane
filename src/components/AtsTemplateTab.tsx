import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, FileText, Copy, CheckCircle2, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { exportAtsTemplateCv, reformattedCvToHtml } from "@/lib/exportAtsTemplate";
import type { ReformattedCv } from "@/lib/types";

interface AtsTemplateTabProps {
  reformattedCv: ReformattedCv;
  jobTitle: string;
  atsScore: number;
}

const AtsTemplateTab = ({ reformattedCv, jobTitle, atsScore }: AtsTemplateTabProps) => {
  const { toast } = useToast();
  const [downloading, setDownloading] = useState(false);

  const previewHtml = useMemo(() => reformattedCvToHtml(reformattedCv), [reformattedCv]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await exportAtsTemplateCv(reformattedCv, jobTitle);
      toast({ title: "✓ ATS Template CV downloaded" });
    } finally {
      setDownloading(false);
    }
  };

  const handleCopy = async () => {
    const text = previewHtml
      .replace(/<\/?(p|div|br)[^>]*>/gi, "\n")
      .replace(/<\/?(h[1-6])[^>]*>/gi, "\n")
      .replace(/<\/?(li)[^>]*>/gi, "\n• ")
      .replace(/<\/?(ul|ol|strong)[^>]*>/gi, "")
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    await navigator.clipboard.writeText(text);
    toast({ title: "✓ Copied to clipboard" });
  };

  return (
    <div className="space-y-4">
      {/* Header with score + actions */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Badge className="bg-primary/10 text-primary border-primary/20 text-sm px-3 py-1">
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            306 ATS Template
          </Badge>
          <Badge variant="outline" className="text-sm px-3 py-1">
            <CheckCircle2 className="h-3.5 w-3.5 mr-1.5 text-primary" />
            ATS Score: {atsScore}%
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleCopy}>
            <Copy className="h-4 w-4 mr-1" /> Copy
          </Button>
          <Button size="sm" onClick={handleDownload} disabled={downloading}>
            <Download className="h-4 w-4 mr-1" />
            {downloading ? "Exporting..." : "Download .docx"}
          </Button>
        </div>
      </div>

      {/* Preview */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Reformatted CV Preview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className="prose prose-sm max-w-none
              [&_h1]:text-center [&_h1]:text-xl [&_h1]:font-bold [&_h1]:uppercase [&_h1]:mb-1
              [&_h2]:text-sm [&_h2]:font-bold [&_h2]:uppercase [&_h2]:border-b [&_h2]:border-border [&_h2]:pb-1 [&_h2]:mt-5 [&_h2]:mb-2
              [&_p]:text-sm [&_p]:my-1 [&_p]:leading-relaxed
              [&_ul]:my-1 [&_li]:text-sm [&_li]:leading-relaxed
              [&_strong]:font-semibold"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center">
        Your CV has been reformatted into a standardized ATS-optimized template with JD keywords injected into bullets, summary, and skills.
      </p>
    </div>
  );
};

export default AtsTemplateTab;
