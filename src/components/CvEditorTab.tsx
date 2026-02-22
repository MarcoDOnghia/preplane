import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Highlight from "@tiptap/extension-highlight";
import { useEffect, useCallback, useRef, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Bold,
  Italic,
  List,
  Heading2,
  Undo2,
  Redo2,
  RotateCcw,
  CheckCheck,
  Save,
  Check,
  TrendingUp,
} from "lucide-react";
import type { CvSuggestion } from "@/lib/types";
import { cvTextToStructuredHtml } from "@/lib/cvParser";
import { calculateAtsScore } from "@/lib/atsScore";

interface CvEditorTabProps {
  originalCv: string;
  currentCv: string;
  onChange: (html: string) => void;
  onApplyAll: () => void;
  onReset: () => void;
  originalAtsScore?: number;
  jobDescription?: string;
  suggestions: CvSuggestion[];
  appliedSuggestions: number[];
  saveStatus: "idle" | "saving" | "saved" | "error";
}

function ensureHtml(text: string): string {
  // Always run through the parser to guarantee proper structure
  return cvTextToStructuredHtml(text);
}

function countWords(html: string): number {
  const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return text ? text.split(" ").length : 0;
}

const CvEditorTab = ({
  originalCv,
  currentCv,
  onChange,
  onApplyAll,
  onReset,
  originalAtsScore = 0,
  jobDescription = "",
  suggestions,
  appliedSuggestions,
  saveStatus,
}: CvEditorTabProps) => {
  const [showTooltip, setShowTooltip] = useState(true);
  const initializedRef = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Highlight.configure({ multicolor: true }),
    ],
    content: ensureHtml(currentCv),
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "cv-editor-content",
      },
    },
  });

  // Update editor content when currentCv changes externally (e.g., applying suggestions)
  useEffect(() => {
    if (!editor) return;
    if (!initializedRef.current) {
      initializedRef.current = true;
      return;
    }
    const newContent = ensureHtml(currentCv);
    const currentContent = editor.getHTML();
    if (newContent !== currentContent) {
      editor.commands.setContent(newContent, { emitUpdate: false });
    }
  }, [currentCv, editor]);

  // Dismiss tooltip after 8 seconds
  useEffect(() => {
    const t = setTimeout(() => setShowTooltip(false), 8000);
    return () => clearTimeout(t);
  }, []);

  const remaining = suggestions.length - appliedSuggestions.length;
  const wordCount = editor ? countWords(editor.getHTML()) : 0;

  // Live ATS score recalculation
  const liveAtsScore = useMemo(() => {
    if (!jobDescription || !currentCv) return originalAtsScore;
    return calculateAtsScore(currentCv, jobDescription).score;
  }, [currentCv, jobDescription, originalAtsScore]);

  const scoreImprovement = liveAtsScore - originalAtsScore;
  const scoreColor = liveAtsScore >= 80 ? "text-success" : liveAtsScore >= 60 ? "text-yellow-500" : "text-destructive";

  if (!editor) return null;

  return (
    <div className="space-y-3">
      {/* Tooltip */}
      {showTooltip && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-muted-foreground flex items-start gap-2">
          <span className="text-primary">💡</span>
          Edit your CV directly below. Use "Apply All Suggestions" to accept AI improvements, or type freely to customize.
          <button onClick={() => setShowTooltip(false)} className="ml-auto text-xs hover:text-foreground">✕</button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap rounded-lg border bg-card p-2">
        <div className="flex items-center gap-1 border-r pr-2 mr-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => editor.chain().focus().toggleBold().run()}
            data-active={editor.isActive("bold")}
          >
            <Bold className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            data-active={editor.isActive("italic")}
          >
            <Italic className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            data-active={editor.isActive("bulletList")}
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            data-active={editor.isActive("heading")}
          >
            <Heading2 className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-1 border-r pr-2 mr-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => editor.chain().focus().undo().run()}>
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => editor.chain().focus().redo().run()}>
            <Redo2 className="h-4 w-4" />
          </Button>
        </div>

        <Button variant="default" size="sm" onClick={onApplyAll} disabled={remaining === 0}>
          <CheckCheck className="h-4 w-4 mr-1" />
          Apply All Suggestions ({remaining})
        </Button>
        <Button variant="outline" size="sm" onClick={onReset}>
          <RotateCcw className="h-4 w-4 mr-1" />
          Reset to Original
        </Button>

        <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
          {saveStatus === "saving" && (
            <span className="flex items-center gap-1">
              <Save className="h-3 w-3 animate-pulse" /> Saving...
            </span>
          )}
          {saveStatus === "saved" && (
            <span className="flex items-center gap-1 text-success">
              <Check className="h-3 w-3" /> Saved
            </span>
          )}
          {saveStatus === "error" && (
            <span className="text-destructive">Save failed</span>
          )}
          <Badge variant="outline" className={`text-xs ${scoreColor}`}>
            ATS: {liveAtsScore}/100
            {scoreImprovement > 0 && (
              <span className="ml-1 text-success flex items-center gap-0.5">
                <TrendingUp className="h-3 w-3" />+{scoreImprovement}
              </span>
            )}
          </Badge>
          <span>{wordCount} words</span>
        </div>
      </div>

      {/* Editor - styled like a real document */}
      <div className="rounded-lg border bg-white dark:bg-card overflow-hidden shadow-sm">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
};

export default CvEditorTab;
