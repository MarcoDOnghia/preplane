import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {versions.map((version, i) => (
        <Card key={i} className={`relative ${selectedIndex === i ? "ring-2 ring-primary" : ""}`}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">{version.label}</CardTitle>
              {selectedIndex === i && (
                <Badge className="bg-primary text-primary-foreground text-xs">
                  <Check className="h-3 w-3 mr-1" /> Selected
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={editedVersions[i] || ""}
              onChange={(e) =>
                setEditedVersions((prev) => ({ ...prev, [i]: e.target.value }))
              }
              className="min-h-[300px] text-xs leading-relaxed"
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{getWordCount(editedVersions[i] || "")} words</span>
              <span>{getCharCount(editedVersions[i] || "")} chars</span>
            </div>
            <Button
              size="sm"
              variant={selectedIndex === i ? "secondary" : "default"}
              className="w-full"
              onClick={() => onSelect(editedVersions[i] || version.content)}
            >
              {selectedIndex === i ? "Currently Selected" : "Use This Version"}
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default CoverLetterVersionsTab;
