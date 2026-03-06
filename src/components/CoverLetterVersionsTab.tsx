import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { CoverLetterVersion } from "@/lib/types";

interface CoverLetterVersionsTabProps {
  versions: CoverLetterVersion[];
  onSelect: (content: string) => void;
  selectedIndex: number;
}

const CoverLetterVersionsTab = ({ versions, onSelect, selectedIndex }: CoverLetterVersionsTabProps) => {
  const [editedVersions, setEditedVersions] = useState<Record<number, string>>(
    Object.fromEntries(versions.map((v, i) => [i, v.content]))
  );
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const getWordCount = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;
  const getCharCount = (text: string) => text.length;

  const i = 0;

  const handleCopy = async () => {
    const text = editedVersions[i] || "";
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast({ title: "✓ Cover letter copied to clipboard" });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Cover Letter</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          value={editedVersions[i] || ""}
          onChange={(e) =>
            setEditedVersions((prev) => ({ ...prev, [i]: e.target.value }))
          }
          className="min-h-[400px] text-sm leading-relaxed"
        />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{getWordCount(editedVersions[i] || "")} words</span>
          <div className="flex items-center gap-3">
            <span>{getCharCount(editedVersions[i] || "")} chars</span>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={handleCopy}>
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CoverLetterVersionsTab;
