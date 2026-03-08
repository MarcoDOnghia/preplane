import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  CloudUpload, FileText, Rocket, Loader2, X, CheckCircle2, Link2, PlusCircle,
  Trash2, FolderOpen, MoreVertical, Lightbulb, Wand2, Info
} from "lucide-react";
import { extractTextFromFile } from "@/lib/fileParser";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { CvDataModel } from "@/lib/cvDataModel";
import { aiParsedCvToModel, parseCvToModel } from "@/lib/cvDataModel";

interface InputSectionProps {
  onSubmit: (cvContent: string, jobDescription: string) => void;
  onClear?: () => void;
  onCvParsed?: (model: CvDataModel) => void;
  loading: boolean;
  loadingMessage: string;
  initialJd?: string;
}

interface SavedCv {
  id: string;
  name: string;
  parsed_text: string;
  created_at: string;
}

const MAX_SIZE = 2 * 1024 * 1024;
const MAX_CVS = 5;

const InputSection = ({ onSubmit, onClear, onCvParsed, loading, loadingMessage, initialJd }: InputSectionProps) => {
  const { user } = useAuth();
  const [savedCvs, setSavedCvs] = useState<SavedCv[]>([]);
  const [selectedCvId, setSelectedCvId] = useState<string>("");
  const [cvText, setCvText] = useState("");
  const [cvName, setCvName] = useState("");
  const [uploading, setUploading] = useState(false);

  const [jdText, setJdText] = useState(initialJd || "");
  const [jdFile, setJdFile] = useState<{ text: string; name: string; error: string }>({ text: "", name: "", error: "" });
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [extracting, setExtracting] = useState(false);

  const cvInputRef = useRef<HTMLInputElement>(null);
  const jdInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const parseAndNotify = useCallback(async (rawText: string) => {
    if (!rawText || !onCvParsed) return;
    try {
      const { data: parseData, error: parseError } = await supabase.functions.invoke("parse-cv", {
        body: { rawText },
      });
      if (!parseError && parseData?.cvData) {
        const aiModel = aiParsedCvToModel(parseData.cvData);
        const hasContent = aiModel.name.length > 0 || aiModel.experience.length > 0 || aiModel.education.length > 0 || aiModel.skills.length > 0;
        if (hasContent) { onCvParsed(aiModel); return; }
      }
    } catch {}
    try { const model = parseCvToModel(rawText); onCvParsed(model); } catch {}
  }, [onCvParsed]);

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
          parseAndNotify(data[0].parsed_text);
        }
      }
    };
    fetchCvs();
  }, [user]);

  const handleSelectCv = (cvId: string) => {
    setSelectedCvId(cvId);
    const cv = savedCvs.find((c) => c.id === cvId);
    if (cv) {
      setCvText(cv.parsed_text);
      setCvName(cv.name);
      parseAndNotify(cv.parsed_text);
    }
  };

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
      let rawText: string;
      try { rawText = await extractTextFromFile(file); } catch (err) { throw err; }

      if (!rawText || rawText.trim().length < 20) {
        throw new Error("Could not extract text from file. Please try a different format.");
      }

      let aiModel: CvDataModel | null = null;
      try {
        const { data: parseData, error: parseError } = await supabase.functions.invoke("parse-cv", {
          body: { rawText },
        });
        if (parseError) throw parseError;
        if (parseData?.cvData) {
          aiModel = aiParsedCvToModel(parseData.cvData);
          const hasContent = aiModel.name.length > 0 || aiModel.experience.length > 0 || aiModel.education.length > 0 || aiModel.skills.length > 0;
          if (!hasContent) aiModel = null;
        }
      } catch {
        toast({ title: "AI parsing unavailable", description: "Using local parser instead.", variant: "default" });
      }

      if (!aiModel) {
        aiModel = parseCvToModel(rawText);
        aiModel = parseCvToModel(rawText);
      }

      let fileUrl: string | null = null;
      try {
        const storagePath = `${user!.id}/${Date.now()}_${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("cvs")
          .upload(storagePath, file, { contentType: file.type, upsert: false });
        if (!uploadError) fileUrl = storagePath;
      } catch {}

      const { data, error } = await supabase
        .from("cvs")
        .insert({ user_id: user!.id, name: file.name, parsed_text: rawText, file_url: fileUrl } as any)
        .select("id, name, parsed_text, created_at")
        .single();
      if (error) throw error;

      setSavedCvs((prev) => [data, ...prev]);
      setSelectedCvId(data.id);
      setCvText(data.parsed_text);
      setCvName(data.name);

      if (aiModel && onCvParsed) onCvParsed(aiModel);
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
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Left column — CV Library */}
      <div className="lg:col-span-4 space-y-6">
        {/* CV Library card */}
        <div className="bg-white rounded-xl border border-[#F97316]/5 shadow-sm overflow-hidden">
          {/* Header */}
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-[#F97316]" />
              <span className="font-bold text-slate-900">CV Library</span>
              <span className="text-xs text-slate-400 ml-1">{savedCvs.length}/{MAX_CVS}</span>
            </div>
            <input
              ref={cvInputRef}
              type="file"
              accept=".pdf,.docx"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUploadNewCv(f); }}
              className="hidden"
            />
            <button
              onClick={() => cvInputRef.current?.click()}
              disabled={uploading || savedCvs.length >= MAX_CVS}
              className="text-[#F97316] hover:text-orange-600 disabled:opacity-40 transition-colors"
            >
              <PlusCircle className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4 space-y-3">
            {/* Upload area */}
            <div
              onClick={() => cvInputRef.current?.click()}
              className="border-2 border-dashed border-[#F97316]/20 rounded-xl p-6 text-center hover:bg-[#F97316]/5 transition-colors cursor-pointer group"
            >
              {uploading ? (
                <Loader2 className="w-8 h-8 text-[#F97316] mx-auto mb-2 animate-spin" />
              ) : (
                <CloudUpload className="w-8 h-8 text-[#F97316] mx-auto mb-2 group-hover:scale-110 transition-transform" />
              )}
              <p className="text-sm font-medium text-slate-700">
                {uploading ? "Parsing with AI..." : "Upload New CV"}
              </p>
              <p className="text-xs text-slate-400 mt-1">PDF, DOCX up to 2MB</p>
            </div>

            {/* CV list */}
            {savedCvs.map((cv) => {
              const isActive = cv.id === selectedCvId;
              return (
                <div
                  key={cv.id}
                  onClick={() => handleSelectCv(cv.id)}
                  className={`rounded-xl p-3 flex items-center gap-3 cursor-pointer transition-colors ${
                    isActive
                      ? "bg-[#F97316]/5 border border-[#F97316]/10"
                      : "hover:bg-slate-50 border border-transparent"
                  }`}
                >
                  <div className={`p-2 rounded-lg shrink-0 ${isActive ? "bg-[#F97316]/20" : "bg-slate-100"}`}>
                    <FileText className={`w-5 h-5 ${isActive ? "text-[#F97316]" : "text-slate-500"}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900 truncate">{cv.name}</p>
                    <p className="text-xs text-slate-500">
                      {new Date(cv.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteCv(cv.id); }}
                    className="text-slate-400 hover:text-red-500 transition-colors shrink-0"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>
              );
            })}

            {savedCvs.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-2">No CVs yet — upload your first one above.</p>
            )}
          </div>
        </div>

        {/* Pro Tip card */}
        <div className="bg-[#F97316] rounded-xl p-6 text-white shadow-lg shadow-[#F97316]/20 relative overflow-hidden">
          <p className="font-bold mb-2">Pro Tip</p>
          <p className="text-sm text-white/90">
            Tailor your CV for each role — generic applications get filtered out. Even small changes to your summary and skills section can dramatically improve your match score.
          </p>
          <Lightbulb className="w-24 h-24 text-white/10 absolute -bottom-4 -right-4 rotate-12" />
        </div>
      </div>

      {/* Right column — Tailor your CV */}
      <div className="lg:col-span-8">
        <div className="bg-white rounded-xl border border-[#F97316]/5 shadow-sm h-full flex flex-col">
          {/* Header */}
          <div className="p-8 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="bg-[#F97316]/10 p-2 rounded-lg">
                <Wand2 className="w-5 h-5 text-[#F97316]" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900">Tailor your CV</h2>
            </div>
            <p className="text-slate-500 mt-1 text-sm">Paste a job description and get AI-powered suggestions to improve your match.</p>
          </div>

          {/* Body */}
          <div className="p-8 flex-1 flex flex-col gap-6">
            <div>
              <label className="text-sm font-semibold text-slate-700 mb-2 block">Job Description or URL</label>
              <Textarea
                value={jdText}
                onChange={(e) => setJdText(e.target.value)}
                placeholder="Paste full job description here..."
                className="w-full min-h-[300px] p-6 rounded-xl border-slate-200 bg-slate-50 focus:ring-2 focus:ring-[#F97316] focus:border-transparent resize-none text-slate-700 placeholder:text-slate-400"
                disabled={loading}
              />
            </div>

            {/* URL extract */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                  placeholder="LinkedIn / job URL (optional)"
                  className="pl-9 h-10 text-sm border-slate-200 bg-slate-50 focus:ring-2 focus:ring-[#F97316] focus:border-transparent"
                  disabled={loading || extracting}
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExtractFromUrl}
                disabled={!linkedinUrl.trim() || extracting || loading}
                className="text-sm h-10 border-slate-200"
              >
                {extracting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Extract"}
              </Button>
            </div>

            {/* Bottom action row */}
            <div className="pt-4 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-sm text-slate-500">
                {cvName ? (
                  <>
                    <Info className="w-4 h-4 text-[#F97316]" />
                    <span>Using: <strong className="text-slate-900">{cvName}</strong></span>
                  </>
                ) : (
                  <span className="text-slate-400">Select or upload a CV first</span>
                )}
              </div>

              <div className="flex items-center gap-3">
                {(cvText || effectiveJd) && !loading && (
                  <button onClick={handleClear} className="text-sm text-slate-400 hover:text-slate-600 flex items-center gap-1">
                    <X className="h-4 w-4" /> Clear JD
                  </button>
                )}
                <button
                  onClick={handleSubmit}
                  disabled={loading || !bothReady}
                  className="px-8 py-4 bg-[#F97316] hover:bg-orange-600 text-white rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-[#F97316]/25 hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {loading ? (
                    <><Loader2 className="w-5 h-5 animate-spin" />{loadingMessage}</>
                  ) : (
                    <><Rocket className="w-5 h-5" />Tailor My CV</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InputSection;
