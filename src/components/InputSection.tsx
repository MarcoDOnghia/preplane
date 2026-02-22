import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, FileText, Sparkles, Loader2, X, CheckCircle2 } from "lucide-react";
import { extractTextFromFile } from "@/lib/fileParser";
import { useToast } from "@/hooks/use-toast";

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

const MAX_SIZE = 2 * 1024 * 1024; // 2MB

const InputSection = ({ onSubmit, onClear, loading, loadingMessage }: InputSectionProps) => {
  const [cv, setCv] = useState<FileState>({ file: null, text: "", name: "", error: "" });
  const [jd, setJd] = useState<FileState>({ file: null, text: "", name: "", error: "" });
  const [cvDragOver, setCvDragOver] = useState(false);
  const [jdDragOver, setJdDragOver] = useState(false);
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

  const handleDrop = useCallback((e: React.DragEvent, setter: typeof setCv, setDrag: typeof setCvDragOver) => {
    e.preventDefault();
    setDrag(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file, setter);
  }, [processFile]);

  const handleSubmit = () => {
    if (!cv.text || !jd.text) {
      toast({ title: "Missing files", description: "Please upload both your CV and a job description.", variant: "destructive" });
      return;
    }
    onSubmit(cv.text, jd.text);
  };

  const handleClear = () => {
    setCv({ file: null, text: "", name: "", error: "" });
    setJd({ file: null, text: "", name: "", error: "" });
    if (cvInputRef.current) cvInputRef.current.value = "";
    if (jdInputRef.current) jdInputRef.current.value = "";
    onClear?.();
  };

  const bothReady = cv.text.length > 0 && jd.text.length > 0;

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="text-center space-y-3">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
          ATS-Optimized Application Kit
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Upload both → Get 90% ATS CV + 3 cover letters instantly
        </p>
      </div>

      {/* Dropzones */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <DropZone
          label="Your CV / Resume"
          icon={<FileText className="h-8 w-8" />}
          state={cv}
          isDragOver={cvDragOver}
          inputRef={cvInputRef}
          onDragOver={(e) => { e.preventDefault(); setCvDragOver(true); }}
          onDragLeave={() => setCvDragOver(false)}
          onDrop={(e) => handleDrop(e, setCv, setCvDragOver)}
          onFileChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f, setCv); }}
          onClear={() => { setCv({ file: null, text: "", name: "", error: "" }); if (cvInputRef.current) cvInputRef.current.value = ""; }}
        />
        <DropZone
          label="Job Description"
          icon={<Sparkles className="h-8 w-8" />}
          state={jd}
          isDragOver={jdDragOver}
          inputRef={jdInputRef}
          onDragOver={(e) => { e.preventDefault(); setJdDragOver(true); }}
          onDragLeave={() => setJdDragOver(false)}
          onDrop={(e) => handleDrop(e, setJd, setJdDragOver)}
          onFileChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f, setJd); }}
          onClear={() => { setJd({ file: null, text: "", name: "", error: "" }); if (jdInputRef.current) jdInputRef.current.value = ""; }}
        />
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
              Generate Full Application
            </>
          )}
        </Button>
        {!bothReady && !loading && (
          <p className="text-sm text-muted-foreground">
            {!cv.text && !jd.text ? "Upload your CV and job description to get started" :
             !cv.text ? "Upload your CV to continue" : "Upload the job description to continue"}
          </p>
        )}
        {(cv.text || jd.text) && !loading && (
          <Button variant="ghost" size="sm" onClick={handleClear} className="text-muted-foreground">
            <X className="h-4 w-4 mr-1" /> Clear All
          </Button>
        )}
      </div>
    </div>
  );
};

function DropZone({
  label, icon, state, isDragOver, inputRef,
  onDragOver, onDragLeave, onDrop, onFileChange, onClear,
}: {
  label: string;
  icon: React.ReactNode;
  state: FileState;
  isDragOver: boolean;
  inputRef: React.RefObject<HTMLInputElement>;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
}) {
  const hasFile = state.text.length > 0;

  return (
    <Card
      className={`relative cursor-pointer transition-all duration-200 ${
        isDragOver ? "border-primary border-2 bg-primary/5 scale-[1.02]" :
        hasFile ? "border-success/40 bg-success/5" :
        state.error ? "border-destructive/40 bg-destructive/5" :
        "border-dashed border-2 border-muted-foreground/25 hover:border-primary/50 hover:bg-primary/5"
      }`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={() => !hasFile && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx"
        onChange={onFileChange}
        className="hidden"
      />
      <div className="flex flex-col items-center justify-center py-12 px-6 min-h-[200px]">
        {hasFile ? (
          <div className="text-center space-y-2">
            <CheckCircle2 className="h-10 w-10 text-success mx-auto" />
            <p className="font-semibold text-sm">{state.name}</p>
            <p className="text-xs text-muted-foreground">{Math.round(state.text.length / 100) / 10}k characters extracted</p>
            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onClear(); }} className="text-xs text-muted-foreground mt-1">
              <X className="h-3 w-3 mr-1" /> Remove
            </Button>
          </div>
        ) : (
          <div className="text-center space-y-3">
            <div className={`mx-auto rounded-full p-4 ${isDragOver ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
              {isDragOver ? <Upload className="h-8 w-8" /> : icon}
            </div>
            <div>
              <p className="font-semibold text-sm">{label}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {isDragOver ? "Drop file here" : "Drag & drop or click to browse"}
              </p>
              <p className="text-xs text-muted-foreground">PDF or DOCX · Max 2MB</p>
            </div>
            {state.error && (
              <p className="text-xs text-destructive font-medium">{state.error}</p>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

export default InputSection;
