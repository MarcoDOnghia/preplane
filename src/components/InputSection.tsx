import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileText, Sparkles, Trash2, Loader2 } from "lucide-react";
import { extractTextFromFile } from "@/lib/fileParser";
import { sampleCV, sampleJobDescription } from "@/lib/sampleData";
import { useToast } from "@/hooks/use-toast";
import type { Tone } from "@/lib/types";

interface InputSectionProps {
  onSubmit: (cvContent: string, jobDescription: string, tone: Tone) => void;
  onClear?: () => void;
  loading: boolean;
  loadingMessage: string;
}

const InputSection = ({ onSubmit, onClear, loading, loadingMessage }: InputSectionProps) => {
  const [cvText, setCvText] = useState("");
  const [jobDesc, setJobDesc] = useState("");
  const [tone, setTone] = useState<Tone>("professional");
  const [fileName, setFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await extractTextFromFile(file);
      setCvText(text);
      setFileName(file.name);
      toast({ title: "File parsed", description: `Extracted text from ${file.name}` });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleSubmit = () => {
    if (!cvText.trim() || !jobDesc.trim()) {
      toast({ title: "Missing input", description: "Please provide both your CV and a job description.", variant: "destructive" });
      return;
    }
    onSubmit(cvText, jobDesc, tone);
  };

  const handleClear = () => {
    setCvText("");
    setJobDesc("");
    setTone("professional");
    setFileName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    onClear?.();
  };

  const loadSample = () => {
    setCvText(sampleCV);
    setJobDesc(sampleJobDescription);
    toast({ title: "Sample loaded", description: "Demo CV and job description loaded." });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Tailor Your Application</h2>
          <p className="text-muted-foreground mt-1">Upload your CV and paste the job description to get started</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadSample}>
          Try Demo
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CV Input */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Your CV
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx"
                onChange={handleFileUpload}
                className="hidden"
                id="cv-upload"
              />
              <Button
                variant="outline"
                className="w-full"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                {fileName || "Upload .pdf or .docx"}
              </Button>
            </div>
            <div className="relative">
              <Label htmlFor="cv-text" className="text-xs text-muted-foreground">
                Or paste your CV text below
              </Label>
              <Textarea
                id="cv-text"
                value={cvText}
                onChange={(e) => setCvText(e.target.value)}
                placeholder="Paste your CV content here..."
                className="min-h-[280px] mt-1 text-sm"
              />
            </div>
          </CardContent>
        </Card>

        {/* Job Description */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Job Description
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label htmlFor="tone" className="text-xs text-muted-foreground">
                Cover letter tone
              </Label>
              <Select value={tone} onValueChange={(v) => setTone(v as Tone)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="enthusiastic">Enthusiastic</SelectItem>
                  <SelectItem value="creative">Creative</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="job-desc" className="text-xs text-muted-foreground">
                Paste the job description
              </Label>
              <Textarea
                id="job-desc"
                value={jobDesc}
                onChange={(e) => setJobDesc(e.target.value)}
                placeholder="Paste the job description here..."
                className="min-h-[280px] mt-1 text-sm"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button onClick={handleSubmit} disabled={loading} size="lg" className="flex-1 max-w-xs">
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {loadingMessage}
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              Tailor My Application
            </>
          )}
        </Button>
        <Button variant="outline" onClick={handleClear} disabled={loading}>
          <Trash2 className="h-4 w-4 mr-1" />
          Clear All
        </Button>
      </div>
    </div>
  );
};

export default InputSection;
