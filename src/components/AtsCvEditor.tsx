import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Download,
  Copy,
  RotateCcw,
  Undo2,
  TrendingUp,
  Save,
  Check,
  Plus,
  Trash2,
  Sparkles,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { exportAtsTemplateCv } from "@/lib/exportAtsTemplate";
import type { CvDataModel, CvExperience, CvEducation, CvProject, CvAward } from "@/lib/cvDataModel";
import { cvModelToPlainText } from "@/lib/cvDataModel";
import type { ReformattedCv } from "@/lib/types";

interface AtsCvEditorProps {
  model: CvDataModel;
  onChange: (model: CvDataModel) => void;
  onReset: () => void;
  onUndo: () => void;
  canUndo: boolean;
  originalAtsScore: number;
  liveAtsScore: number;
  saveStatus: "idle" | "saving" | "saved" | "error";
  jobTitle: string;
}

// ─── Tiny section editor helpers ──────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[13px] font-bold text-foreground tracking-wider uppercase mt-8 mb-3 first:mt-0 border-b border-border pb-1.5">
      {children}
    </h3>
  );
}

function BulletEditor({
  bullets,
  onChange,
}: {
  bullets: string[];
  onChange: (bullets: string[]) => void;
}) {
  const update = (i: number, val: string) => {
    const next = [...bullets];
    next[i] = val;
    onChange(next);
  };
  const remove = (i: number) => onChange(bullets.filter((_, idx) => idx !== i));
  const add = () => onChange([...bullets, ""]);

  return (
    <div className="space-y-1.5 ml-4">
      {bullets.map((b, i) => (
        <div key={i} className="flex items-start gap-1.5 group">
          <span className="text-muted-foreground mt-2 text-xs">•</span>
          <Textarea
            value={b}
            onChange={(e) => update(i, e.target.value)}
            className="min-h-[36px] text-sm py-1.5 px-2 resize-none border-transparent hover:border-input focus-visible:border-input bg-transparent transition-colors"
            rows={1}
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 opacity-0 group-hover:opacity-100 shrink-0"
            onClick={() => remove(i)}
          >
            <Trash2 className="h-3 w-3 text-muted-foreground" />
          </Button>
        </div>
      ))}
      <Button variant="ghost" size="sm" className="text-xs h-7 text-muted-foreground" onClick={add}>
        <Plus className="h-3 w-3 mr-1" /> Add bullet
      </Button>
    </div>
  );
}

// ─── Main Editor Component ──────────────────────────────────

const AtsCvEditor = ({
  model,
  onChange,
  onReset,
  onUndo,
  canUndo,
  originalAtsScore,
  liveAtsScore,
  saveStatus,
  jobTitle,
}: AtsCvEditorProps) => {
  const { toast } = useToast();
  const [downloading, setDownloading] = useState(false);

  const scoreColor = liveAtsScore >= 80 ? "text-success" : liveAtsScore >= 60 ? "text-yellow-500" : "text-destructive";
  const scoreDelta = liveAtsScore - originalAtsScore;

  // Mutators
  const set = useCallback(
    <K extends keyof CvDataModel>(key: K, val: CvDataModel[K]) => {
      onChange({ ...model, [key]: val });
    },
    [model, onChange]
  );

  const updateExp = useCallback(
    (i: number, patch: Partial<CvExperience>) => {
      const next = [...model.experience];
      next[i] = { ...next[i], ...patch };
      set("experience", next);
    },
    [model.experience, set]
  );

  const updateEdu = useCallback(
    (i: number, patch: Partial<CvEducation>) => {
      const next = [...model.education];
      next[i] = { ...next[i], ...patch };
      set("education", next);
    },
    [model.education, set]
  );

  const updateProj = useCallback(
    (i: number, patch: Partial<CvProject>) => {
      const next = [...model.projects];
      next[i] = { ...next[i], ...patch };
      set("projects", next);
    },
    [model.projects, set]
  );

  const handleDownload = async () => {
    setDownloading(true);
    try {
      // Convert model to ReformattedCv shape for the existing exporter
      const cv: ReformattedCv = {
        name: model.name,
        contact: model.contact,
        profileSummary: model.summary,
        experience: model.experience.map((e) => ({
          role: e.role,
          company: e.company,
          dates: e.dates,
          bullets: e.bullets,
        })),
        education: model.education.map((e) => ({
          degree: e.degree,
          university: e.university,
          dates: e.dates,
          coursework: e.coursework,
          gpa: "",
        })),
        technicalSkills: model.skills,
        projectExperience: model.projects.map((p) => ({
          title: p.title,
          dates: p.dates,
          bullets: p.bullets,
        })),
        honorsAwards: model.awards.map((a) => ({ title: a.title, date: a.date })),
      };
      await exportAtsTemplateCv(cv, jobTitle);
      toast({ title: "✓ ATS CV downloaded" });
    } finally {
      setDownloading(false);
    }
  };

  const handleCopy = async () => {
    const text = cvModelToPlainText(model);
    await navigator.clipboard.writeText(text);
    toast({ title: "✓ Copied to clipboard" });
  };

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap rounded-lg border bg-card p-2">
        <Button size="sm" onClick={handleDownload} disabled={downloading}>
          <Download className="h-4 w-4 mr-1" />
          {downloading ? "Exporting…" : "Download .docx"}
        </Button>
        <Button size="sm" variant="outline" onClick={handleCopy}>
          <Copy className="h-4 w-4 mr-1" /> Copy
        </Button>
        <Button size="sm" variant="outline" onClick={onUndo} disabled={!canUndo}>
          <Undo2 className="h-4 w-4 mr-1" /> Undo
        </Button>
        <Button size="sm" variant="outline" onClick={onReset}>
          <RotateCcw className="h-4 w-4 mr-1" /> Reset
        </Button>

        <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
          {saveStatus === "saving" && (
            <span className="flex items-center gap-1"><Save className="h-3 w-3 animate-pulse" /> Saving…</span>
          )}
          {saveStatus === "saved" && (
            <span className="flex items-center gap-1 text-success"><Check className="h-3 w-3" /> Saved</span>
          )}
          {saveStatus === "error" && <span className="text-destructive">Save failed</span>}
          <Badge variant="outline" className={`text-xs ${scoreColor}`}>
            ATS: {liveAtsScore}/100
            {scoreDelta > 0 && (
              <span className="ml-1 text-success flex items-center gap-0.5">
                <TrendingUp className="h-3 w-3" />+{scoreDelta}
              </span>
            )}
          </Badge>
        </div>
      </div>

      {/* Document — single-column, clean ATS format */}
      <Card className="shadow-lg border-border/50 font-[Arial,Helvetica,sans-serif]">
        <CardContent className="pt-8 pb-10 px-8 md:px-12 space-y-1">
          {/* Header */}
          <Input
            value={model.name}
            onChange={(e) => set("name", e.target.value)}
            className="text-lg font-bold text-center border-none shadow-none focus-visible:ring-0"
            placeholder="Your Name"
          />
          {model.contact ? (
            <Input
              value={model.contact}
              onChange={(e) => set("contact", e.target.value)}
              className="text-sm text-center text-muted-foreground border-none shadow-none focus-visible:ring-0"
            />
          ) : (
            <Input
              value=""
              onChange={(e) => set("contact", e.target.value)}
              className="text-sm text-center text-muted-foreground border-none shadow-none focus-visible:ring-0"
              placeholder="Add contact info (email, phone, location)"
            />
          )}

          {/* Profile Summary */}
          <SectionLabel>PROFILE SUMMARY</SectionLabel>
          <Textarea
            value={model.summary}
            onChange={(e) => set("summary", e.target.value)}
            className="text-sm min-h-[60px] resize-none border-transparent hover:border-input focus-visible:border-input bg-transparent transition-colors"
            placeholder="Write a tailored summary..."
          />

          {/* Professional Experience */}
          <SectionLabel>PROFESSIONAL EXPERIENCE</SectionLabel>
          {model.experience.map((exp, i) => (
            <div key={i} className="mb-4 group relative">
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-1.5 mb-1">
                <div className="flex gap-1.5">
                  <Input
                    value={exp.role}
                    onChange={(e) => updateExp(i, { role: e.target.value })}
                    className="text-sm font-semibold"
                    placeholder="Role"
                  />
                  <Input
                    value={exp.company}
                    onChange={(e) => updateExp(i, { company: e.target.value })}
                    className="text-sm"
                    placeholder="Company"
                  />
                </div>
                <Input
                  value={exp.dates}
                  onChange={(e) => updateExp(i, { dates: e.target.value })}
                  className="text-sm text-muted-foreground w-full sm:w-40"
                  placeholder="Dates"
                />
              </div>
              <BulletEditor
                bullets={exp.bullets}
                onChange={(bullets) => updateExp(i, { bullets })}
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute -right-2 top-0 h-6 w-6 opacity-0 group-hover:opacity-100"
                onClick={() => set("experience", model.experience.filter((_, idx) => idx !== i))}
              >
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          ))}
          <Button
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={() =>
              set("experience", [...model.experience, { role: "", company: "", dates: "", bullets: [""] }])
            }
          >
            <Plus className="h-3 w-3 mr-1" /> Add Experience
          </Button>

          {/* Education */}
          <SectionLabel>EDUCATION</SectionLabel>
          {model.education.map((edu, i) => (
            <div key={i} className="mb-4 group relative">
              {/* University | Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-1.5 mb-1">
                <Input
                  value={edu.university}
                  onChange={(e) => updateEdu(i, { university: e.target.value })}
                  className="text-sm font-semibold"
                  placeholder="University / School"
                />
                <Input
                  value={edu.dates}
                  onChange={(e) => updateEdu(i, { dates: e.target.value })}
                  className="text-sm text-muted-foreground w-full sm:w-48"
                  placeholder="Start – End"
                />
              </div>
              {/* Degree */}
              <Input
                value={edu.degree}
                onChange={(e) => updateEdu(i, { degree: e.target.value })}
                className="text-sm mb-1"
                placeholder="Degree (e.g. BSc Economics and Management)"
              />
              {/* GPA */}
              <div className="flex items-center gap-1.5 mb-1 ml-4">
                <span className="text-xs text-muted-foreground whitespace-nowrap">GPA:</span>
                <Input
                  value={edu.gpa || ""}
                  onChange={(e) => updateEdu(i, { gpa: e.target.value })}
                  className="text-xs text-muted-foreground h-7 max-w-[200px]"
                  placeholder="e.g. 3.8/4.0 (leave blank if N/A)"
                />
              </div>
              {/* Coursework */}
              <div className="flex items-center gap-1.5 ml-4">
                <span className="text-xs text-muted-foreground whitespace-nowrap">Coursework:</span>
                <Input
                  value={edu.coursework}
                  onChange={(e) => updateEdu(i, { coursework: e.target.value })}
                  className="text-xs text-muted-foreground h-7"
                  placeholder="Relevant Coursework (comma-separated)"
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="absolute -right-2 top-0 h-6 w-6 opacity-0 group-hover:opacity-100"
                onClick={() => set("education", model.education.filter((_, idx) => idx !== i))}
              >
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          ))}
          <Button
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={() =>
              set("education", [...model.education, { degree: "", university: "", dates: "", gpa: "", coursework: "" }])
            }
          >
            <Plus className="h-3 w-3 mr-1" /> Add Education
          </Button>

          {/* Skills */}
          <SectionLabel>SKILLS</SectionLabel>
          <Textarea
            value={model.skills}
            onChange={(e) => set("skills", e.target.value)}
            className="text-sm min-h-[40px] resize-none border-transparent hover:border-input focus-visible:border-input bg-transparent transition-colors"
            placeholder="Comma-separated skills list"
          />


        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center">
        Edit any field above. Changes auto-save and update your Job Match Score in real-time.
      </p>
    </div>
  );
};

export default AtsCvEditor;
