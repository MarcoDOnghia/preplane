import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileText, Sparkles, Loader2, X, CheckCircle2, Link2, Plus, Trash2 } from "lucide-react";
import { extractTextFromFile } from "@/lib/fileParser";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { CvDataModel } from "@/lib/cvDataModel";
import { aiParsedCvToModel } from "@/lib/cvDataModel";

interface InputSectionProps {
  onSubmit: (cvContent: string, jobDescription: string) => void;
  onClear?: () => void;
  onCvParsed?: (model: CvDataModel) => void;
  loading: boolean;
  loadingMessage: string;
}

interface SavedCv {
  id: string;
  name: string;
  parsed_text: string;
  created_at: string;
}

const MAX_SIZE = 2 * 1024 * 1024;
const MAX_CVS = 5;

const InputSection = ({ onSubmit, onClear, onCvParsed, loading, loadingMessage }: InputSectionProps) => {
  const { user } = useAuth();
  const [savedCvs, setSavedCvs] = useState<SavedCv[]>([]);
  const [selectedCvId, setSelectedCvId] = useState<string>("");
  const [cvText, setCvText] = useState("");
  const [cvName, setCvName] = useState("");
  const [uploading, setUploading] = useState(false);

  const [jdText, setJdText] = useState("");
  const [jdFile, setJdFile] = useState<{ text: string; name: string; error: string }>({ text: "", name: "", error: "" });
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [extracting, setExtracting] = useState(false);

  const cvInputRef = useRef<HTMLInputElement>(null);
  const jdInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Fetch saved CVs
  useEffect(() => {
    if (!user) return;
    const fetchCvs = async () => {
      const { data } = await supabase
        .from("cvs")
        .select("id, name, parsed_text, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (data) {
        setSavedCvs(data);
        if (data.length > 0 && !selectedCvId) {
          setSelectedCvId(data[0].id);
          setCvText(data[0].parsed_text);
          setCvName(data[0].name);
        }
      }
    };
    fetchCvs();
  }, [user]);

  // Handle CV selection
  const handleSelectCv = (cvId: string) => {
    setSelectedCvId(cvId);
    const cv = savedCvs.find((c) => c.id === cvId);
    if (cv) {
      setCvText(cv.parsed_text);
      setCvName(cv.name);
    }
  };

  // Upload new CV: extract text → call parse-cv → upload to storage → save to DB
  const handleUploadNewCv = async (file: File) => {
    if (savedCvs.length >= MAX_CVS) {
      toast({ title: "CV limit reached", description: `Remove a CV before adding new ones (${MAX_CVS} max).`, variant: "destructive" });
      return;
    }
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["pdf", "docx"].includes(ext || "")) {
      toast({ title: "Invalid format", description: "Only .pdf and .docx files", variant: "destructive" });
      return;
    }
    if (file.size > MAX_SIZE) {
      toast({ title: "Too large", description: "Max 2MB", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      // 1. Extract raw text client-side
      const rawText = await extractTextFromFile(file);

      // 2. Call parse-cv edge function for AI-structured parsing
      let aiModel: CvDataModel | null = null;
      try {
        const { data: parseData, error: parseError } = await supabase.functions.invoke("parse-cv", {
          body: { rawText },
        });
        if (parseError) throw parseError;
        if (parseData?.cvData) {
          aiModel = aiParsedCvToModel(parseData.cvData);
        }
      } catch (parseErr: any) {
        console.error("parse-cv failed, falling back to local parser:", parseErr);
        toast({ title: "AI parsing unavailable", description: "Using local parser instead.", variant: "default" });
      }

      // 3. Upload original file to storage bucket
      let fileUrl: string | null = null;
      try {
        const storagePath = `${user!.id}/${Date.now()}_${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("cvs")
          .upload(storagePath, file, { contentType: file.type, upsert: false });
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from("cvs").getPublicUrl(storagePath);
          fileUrl = urlData?.publicUrl || null;
        }
      } catch {
        // Storage upload is best-effort, don't block the flow
      }

      // 4. Insert row in cvs table
      const { data, error } = await supabase
        .from("cvs")
        .insert({
          user_id: user!.id,
          name: file.name,
          parsed_text: rawText,
          file_url: fileUrl,
        } as any)
        .select("id, name, parsed_text, created_at")
        .single();
      if (error) throw error;

      setSavedCvs((prev) => [data, ...prev]);
      setSelectedCvId(data.id);
      setCvText(data.parsed_text);
      setCvName(data.name);

      // 5. If AI model available, pass it up to pre-fill the ATS editor
      if (aiModel && onCvParsed) {
        onCvParsed(aiModel);
      }

      toast({ title: "CV saved!", description: `${file.name} added to your library.` });
    } catch (err: any) {
      toast({ title: "Parsing failed, try again", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (cvInputRef.current) cvInputRef.current.value = "";
    }
  };

  const handleDeleteCv = async (cvId: string) => {
    await supabase.from("cvs").delete().eq("id", cvId);
    setSavedCvs((prev) => prev.filter((c) => c.id !== cvId));
    if (selectedCvId === cvId) {
      const remaining = savedCvs.filter((c) => c.id !== cvId);
      if (remaining.length > 0) {
        setSelectedCvId(remaining[0].id);
        setCvText(remaining[0].parsed_text);
        setCvName(remaining[0].name);
      } else {
        setSelectedCvId("");
        setCvText("");
        setCvName("");
      }
    }
    toast({ title: "CV removed" });
  };

  const handleJdFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const ext = f.name.split(".").pop()?.toLowerCase();
    if (!["pdf", "docx"].includes(ext || "")) {
      setJdFile({ text: "", name: "", error: "Only .pdf and .docx" });
      return;
    }
    if (f.size > MAX_SIZE) {
      setJdFile({ text: "", name: "", error: "Max 2MB" });
      return;
    }
    try {
      const text = await extractTextFromFile(f);
      setJdFile({ text, name: f.name, error: "" });
      toast({ title: "JD parsed", description: `Extracted from ${f.name}` });
    } catch (err: any) {
      setJdFile({ text: "", name: "", error: err.message });
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
        toast({ title: "Job description extracted!" });
      } else {
        toast({ title: "Couldn't extract", description: "Try pasting manually.", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Extraction failed", description: err.message, variant: "destructive" });
    } finally {
      setExtracting(false);
    }
  };

  const effectiveJd = jdText.trim() || jdFile.text;
  const bothReady = cvText.length > 0 && effectiveJd.length > 0;

  const handleSubmit = () => {
    if (!cvText || !effectiveJd) {
      toast({ title: "Missing input", description: "Select a CV and provide a job description.", variant: "destructive" });
      return;
    }
    onSubmit(cvText, effectiveJd);
  };

  const handleClear = () => {
    setJdText("");
    setJdFile({ text: "", name: "", error: "" });
    setLinkedinUrl("");
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
          Select your CV + paste JD → Instant optimization
        </p>
      </div>

      {/* Two-column: CV Library (40%) | JD (60%) */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        {/* CV Library */}
        <div className="md:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-foreground">My CV Library</label>
            <span className="text-xs text-muted-foreground">{savedCvs.length}/{MAX_CVS} used</span>
          </div>

          {savedCvs.length > 0 ? (
            <div className="space-y-2">
              <Select value={selectedCvId} onValueChange={handleSelectCv}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a CV..." />
                </SelectTrigger>
                <SelectContent>
                  {savedCvs.map((cv) => (
                    <SelectItem key={cv.id} value={cv.id}>
                      <span className="flex items-center gap-2">
                        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                        {cv.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedCvId && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-primary">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>{cvName}</span>
                    <span className="text-muted-foreground">· {Math.round(cvText.length / 100) / 10}k chars</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground hover:text-destructive"
                    onClick={() => handleDeleteCv(selectedCvId)}
                  >
                    <Trash2 className="h-3 w-3 mr-1" /> Remove
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <Card className="border-dashed border-2 border-muted-foreground/25">
              <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
                <div className="mx-auto rounded-full p-3 bg-muted text-muted-foreground mb-3">
                  <FileText className="h-6 w-6" />
                </div>
                <p className="text-sm font-medium">No CVs yet</p>
                <p className="text-xs text-muted-foreground mt-1">Upload your first CV to get started</p>
              </div>
            </Card>
          )}

          {/* Upload new button */}
          <input
            ref={cvInputRef}
            type="file"
            accept=".pdf,.docx"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUploadNewCv(f); }}
            className="hidden"
          />
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs"
            onClick={() => cvInputRef.current?.click()}
            disabled={uploading || savedCvs.length >= MAX_CVS}
          >
            {uploading ? (
              <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Parsing with AI...</>
            ) : (
              <><Plus className="h-3 w-3 mr-1" /> Upload New PDF/Docx</>
            )}
          </Button>
        </div>

        {/* JD Column */}
        <div className="md:col-span-3 space-y-3">
          <label className="text-sm font-medium text-foreground">JD (Paste)</label>

          <Textarea
            value={jdText}
            onChange={(e) => setJdText(e.target.value)}
            placeholder="Paste full job description here..."
            className="min-h-[180px] text-sm resize-y"
            disabled={loading}
          />

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex items-center gap-2">
              <input
                ref={jdInputRef}
                type="file"
                accept=".pdf,.docx"
                onChange={handleJdFileUpload}
                className="hidden"
              />
              <Button variant="outline" size="sm" onClick={() => jdInputRef.current?.click()} disabled={loading} className="text-xs">
                <Upload className="h-3 w-3 mr-1" /> Upload PDF/Docx
              </Button>
              {jdFile.text && (
                <span className="text-xs text-primary flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> {jdFile.name}
                  <button onClick={() => { setJdFile({ text: "", name: "", error: "" }); if (jdInputRef.current) jdInputRef.current.value = ""; }} className="text-muted-foreground hover:text-destructive ml-1">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {jdFile.error && <span className="text-xs text-destructive">{jdFile.error}</span>}
            </div>

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
              <Button variant="outline" size="sm" onClick={handleExtractFromUrl} disabled={!linkedinUrl.trim() || extracting || loading} className="text-xs h-8">
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
            <><Loader2 className="h-5 w-5 mr-2 animate-spin" />{loadingMessage}</>
          ) : (
            <><Sparkles className="h-5 w-5 mr-2" />Generate Application Kit</>
          )}
        </Button>
        {!bothReady && !loading && (
          <p className="text-sm text-muted-foreground">
            {!cvText && !effectiveJd ? "Select a CV and provide a job description to start" :
             !cvText ? "Select or upload a CV to continue" : "Paste or upload a job description"}
          </p>
        )}
        {(cvText || effectiveJd) && !loading && (
          <Button variant="ghost" size="sm" onClick={handleClear} className="text-muted-foreground">
            <X className="h-4 w-4 mr-1" /> Clear JD
          </Button>
        )}
      </div>
    </div>
  );
};

export default InputSection;
