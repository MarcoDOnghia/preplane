import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Upload, FileText, Sparkles, Loader2, X, CheckCircle2, Link2 } from "lucide-react";
import { extractTextFromFile } from "@/lib/fileParser";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface InputSectionProps {
  onSubmit: (cvContent: string, jobDescription: string) => void;
  onClear?: () => void;
  loading: boolean;
  loadingMessage: string;
}

interface FileState {
  file: File | null;
  text: string;
  name: string;
  error: string;
}

const MAX_SIZE = 2 * 1024 * 1024;

const InputSection = ({ onSubmit, onClear, loading, loadingMessage }: InputSectionProps) => {
  const [cv, setCv] = useState<FileState>({ file: null, text: "", name: "", error: "" });
  const [jdText, setJdText] = useState("");
  const [jdFile, setJdFile] = useState<FileState>({ file: null, text: "", name: "", error: "" });
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [cvDragOver, setCvDragOver] = useState(false);
  const cvInputRef = useRef<HTMLInputElement>(null);
  const jdInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const processFile = useCallback(async (file: File, setter: typeof setCv) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["pdf", "docx"].includes(ext || "")) {
      setter({ file: null, text: "", name: "", error: "Only .pdf and .docx files are supported" });
      return;
    }
    if (file.size > MAX_SIZE) {
      setter({ file: null, text: "", name: "", error: "File exceeds 2MB limit" });
      return;
    }
    try {
      const text = await extractTextFromFile(file);
      setter({ file, text, name: file.name, error: "" });
      toast({ title: "File parsed", description: `Extracted text from ${file.name}` });
    } catch (err: any) {
      setter({ file: null, text: "", name: "", error: err.message });
    }
  }, [toast]);

  const handleCvDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setCvDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file, setCv);
  }, [processFile]);

  const handleJdFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      processFile(f, setJdFile);
    }
  };

  const handleExtractFromUrl = async () => {
    if (!linkedinUrl.trim()) return;
    setExtracting(true);
    try {
      const { data, error } = await supabase.functions.invoke("extract-jd-from-url", {
        body: { url: linkedinUrl.trim() },
      });
      if (error) throw error;
      if (data?.jobDescription) {
        setJdText(data.jobDescription);
        toast({ title: "Job description extracted!", description: "Review and edit if needed." });
      } else {
        toast({ title: "Couldn't extract", description: "Try pasting the job description manually.", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Extraction failed", description: err.message || "Paste the job description manually.", variant: "destructive" });
    } finally {
      setExtracting(false);
    }
  };

  // Effective JD: paste takes priority, then file
  const effectiveJd = jdText.trim() || jdFile.text;
  const bothReady = cv.text.length > 0 && effectiveJd.length > 0;

  const handleSubmit = () => {
    if (!cv.text || !effectiveJd) {
      toast({ title: "Missing input", description: "Upload your CV and provide a job description.", variant: "destructive" });
      return;
    }
    onSubmit(cv.text, effectiveJd);
  };

  const handleClear = () => {
    setCv({ file: null, text: "", name: "", error: "" });
    setJdText("");
    setJdFile({ file: null, text: "", name: "", error: "" });
    setLinkedinUrl("");
    if (cvInputRef.current) cvInputRef.current.value = "";
    if (jdInputRef.current) jdInputRef.current.value = "";
    onClear?.();
  };

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="text-center space-y-2">
        <h1 className="text-[32px] font-bold tracking-tight text-foreground">
          Preplane — 90% ATS + 3 Cover Letters
        </h1>
        <p className="text-muted-foreground text-sm">
          PDF CV + JD paste → Instant optimization
        </p>
      </div>

      {/* Two-column: CV (40%) | JD (60%) */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        {/* CV Column - 2/5 = 40% */}
        <div className="md:col-span-2 space-y-2">
          <label className="text-sm font-medium text-foreground">CV (PDF/Docx)</label>
          <Card
            className={`relative cursor-pointer transition-all duration-200 ${
              cvDragOver ? "border-primary border-2 bg-primary/5 scale-[1.02]" :
              cv.text ? "border-green-500/40 bg-green-500/5" :
              cv.error ? "border-destructive/40 bg-destructive/5" :
              "border-dashed border-2 border-muted-foreground/25 hover:border-primary/50 hover:bg-primary/5"
            }`}
            onDragOver={(e) => { e.preventDefault(); setCvDragOver(true); }}
            onDragLeave={() => setCvDragOver(false)}
            onDrop={handleCvDrop}
            onClick={() => !cv.text && cvInputRef.current?.click()}
          >
            <input
              ref={cvInputRef}
              type="file"
              accept=".pdf,.docx"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f, setCv); }}
              className="hidden"
            />
            <div className="flex flex-col items-center justify-center py-12 px-6 min-h-[200px]">
              {cv.text ? (
                <div className="text-center space-y-2">
                  <CheckCircle2 className="h-10 w-10 text-primary mx-auto" />
                  <p className="font-semibold text-sm">{cv.name}</p>
                  <p className="text-xs text-muted-foreground">{Math.round(cv.text.length / 100) / 10}k chars</p>
                  <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setCv({ file: null, text: "", name: "", error: "" }); if (cvInputRef.current) cvInputRef.current.value = ""; }} className="text-xs text-muted-foreground mt-1">
                    <X className="h-3 w-3 mr-1" /> Remove
                  </Button>
                </div>
              ) : (
                <div className="text-center space-y-3">
                  <div className={`mx-auto rounded-full p-4 ${cvDragOver ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                    {cvDragOver ? <Upload className="h-8 w-8" /> : <FileText className="h-8 w-8" />}
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Drag & drop or click</p>
                    <p className="text-xs text-muted-foreground mt-1">PDF or DOCX only · Max 2MB</p>
                  </div>
                  {cv.error && <p className="text-xs text-destructive font-medium">{cv.error}</p>}
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* JD Column - 3/5 = 60% */}
        <div className="md:col-span-3 space-y-3">
          <label className="text-sm font-medium text-foreground">JD (Paste)</label>
          
          {/* Primary: Paste textarea */}
          <Textarea
            value={jdText}
            onChange={(e) => setJdText(e.target.value)}
            placeholder="Paste full job description here..."
            className="min-h-[180px] text-sm resize-y"
            disabled={loading}
          />

          {/* Secondary options row */}
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Upload JD file */}
            <div className="flex items-center gap-2">
              <input
                ref={jdInputRef}
                type="file"
                accept=".pdf,.docx"
                onChange={handleJdFileUpload}
                className="hidden"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => jdInputRef.current?.click()}
                disabled={loading}
                className="text-xs"
              >
                <Upload className="h-3 w-3 mr-1" />
                Upload PDF/Docx
              </Button>
              {jdFile.text && (
                <span className="text-xs text-primary flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> {jdFile.name}
                  <button onClick={() => { setJdFile({ file: null, text: "", name: "", error: "" }); if (jdInputRef.current) jdInputRef.current.value = ""; }} className="text-muted-foreground hover:text-destructive ml-1">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {jdFile.error && <span className="text-xs text-destructive">{jdFile.error}</span>}
            </div>

            {/* LinkedIn URL */}
            <div className="flex items-center gap-2 flex-1">
              <div className="relative flex-1">
                <Link2 className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                  placeholder="LinkedIn job URL (optional)"
                  className="pl-8 h-8 text-xs"
                  disabled={loading || extracting}
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExtractFromUrl}
                disabled={!linkedinUrl.trim() || extracting || loading}
                className="text-xs h-8"
              >
                {extracting ? <Loader2 className="h-3 w-3 animate-spin" /> : "Extract"}
              </Button>
            </div>
          </div>

          {!jdText && !jdFile.text && (
            <p className="text-xs text-muted-foreground">Paste is fastest — or upload a PDF / enter a LinkedIn URL</p>
          )}
        </div>
      </div>

      {/* CTA */}
      <div className="flex flex-col items-center gap-3">
        <Button
          onClick={handleSubmit}
          disabled={loading || !bothReady}
          size="lg"
          className="w-full max-w-xl h-14 text-lg font-bold bg-primary hover:bg-primary/90"
        >
          {loading ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              {loadingMessage}
            </>
          ) : (
            <>
              <Sparkles className="h-5 w-5 mr-2" />
              Generate Application Kit
            </>
          )}
        </Button>
        {!bothReady && !loading && (
          <p className="text-sm text-muted-foreground">
            {!cv.text && !effectiveJd ? "Upload your CV and provide a job description to start" :
             !cv.text ? "Upload your CV to continue" : "Paste or upload a job description"}
          </p>
        )}
        {(cv.text || effectiveJd) && !loading && (
          <Button variant="ghost" size="sm" onClick={handleClear} className="text-muted-foreground">
            <X className="h-4 w-4 mr-1" /> Clear All
          </Button>
        )}
      </div>
    </div>
  );
};

export default InputSection;
