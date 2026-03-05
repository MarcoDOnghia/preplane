import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
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

  const getWordCount = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;
  const getCharCount = (text: string) => text.length;

  // Just show the first version (no tone variants)
  const version = versions[0];
  const i = 0;

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
          <span>{getCharCount(editedVersions[i] || "")} chars</span>
        </div>
      </CardContent>
    </Card>
  );
};

export default CoverLetterVersionsTab;
