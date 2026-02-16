import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import Header from "@/components/Header";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Trash2, Eye, FileText, Calendar, BarChart3, Target, TrendingUp, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ResultsSection from "@/components/ResultsSection";
import type { TailorResult } from "@/lib/types";

const STATUS_OPTIONS = ["preparing", "applied", "interview", "offer", "rejected", "archived"];
const STATUS_COLORS: Record<string, string> = {
  preparing: "bg-muted text-muted-foreground",
  applied: "bg-primary/10 text-primary",
  interview: "bg-yellow-500/10 text-yellow-600",
  offer: "bg-success/10 text-success",
  rejected: "bg-destructive/10 text-destructive",
  archived: "bg-muted text-muted-foreground",
};

interface AppRow {
  id: string;
  job_title: string;
  company: string;
  tone: string;
  key_requirements: any;
  cv_suggestions: any;
  cover_letter: string;
  cover_letter_versions: any;
  ats_score: number;
  keywords_found: any;
  keywords_missing: any;
  formatting_issues: any;
  quick_wins: any;
  interview_questions: any;
  questions_to_ask: any;
  company_brief: string;
  status: string;
  applied_date: string | null;
  created_at: string;
}

const History = () => {
  const { user, loading: authLoading } = useAuth();
  const [apps, setApps] = useState<AppRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApp, setSelectedApp] = useState<AppRow | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    if (user) fetchApps();
  }, [user]);

  const fetchApps = async () => {
    const { data, error } = await supabase
      .from("applications")
      .select("id, job_title, company, tone, key_requirements, cv_suggestions, cover_letter, cover_letter_versions, ats_score, keywords_found, keywords_missing, formatting_issues, quick_wins, interview_questions, questions_to_ask, company_brief, status, applied_date, created_at")
      .order("created_at", { ascending: false });

    if (!error && data) setApps(data as AppRow[]);
    setLoading(false);
  };

  const deleteApp = async (id: string) => {
    const { error } = await supabase.from("applications").delete().eq("id", id);
    if (!error) {
      setApps((prev) => prev.filter((a) => a.id !== id));
      if (selectedApp?.id === id) setSelectedApp(null);
      toast({ title: "Deleted", description: "Application removed from history." });
    }
  };

  const updateStatus = async (id: string, status: string) => {
    const updates: any = { status };
    if (status === "applied") updates.applied_date = new Date().toISOString();
    const { error } = await supabase.from("applications").update(updates).eq("id", id);
    if (!error) {
      setApps((prev) => prev.map((a) => (a.id === id ? { ...a, ...updates } : a)));
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  if (selectedApp) {
    const result: TailorResult = {
      keyRequirements: (selectedApp.key_requirements as string[]) || [],
      cvSuggestions: (selectedApp.cv_suggestions as any[]) || [],
      coverLetter: selectedApp.cover_letter || "",
      coverLetterVersions: (selectedApp.cover_letter_versions as any[]) || [],
      atsAnalysis: {
        score: selectedApp.ats_score || 0,
        keywordsFound: (selectedApp.keywords_found as string[]) || [],
        keywordsMissing: (selectedApp.keywords_missing as string[]) || [],
        formattingIssues: (selectedApp.formatting_issues as string[]) || [],
        quickWins: (selectedApp.quick_wins as string[]) || [],
      },
      interviewQuestions: (selectedApp.interview_questions as any[]) || [],
      questionsToAsk: (selectedApp.questions_to_ask as string[]) || [],
      companyBrief: selectedApp.company_brief || "",
    };

    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8 max-w-6xl space-y-6">
          <Button variant="ghost" onClick={() => setSelectedApp(null)}>
            ← Back to History
          </Button>
          <ResultsSection result={result} jobTitle={selectedApp.job_title} />
        </main>
      </div>
    );
  }

  const filteredApps = apps.filter((app) => {
    const matchesStatus = statusFilter === "all" || app.status === statusFilter;
    const matchesSearch =
      !searchQuery ||
      app.job_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.company.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const appliedCount = apps.filter((a) => a.status !== "preparing" && a.status !== "archived").length;
  const interviewCount = apps.filter((a) => a.status === "interview" || a.status === "offer").length;
  const avgAts = apps.length > 0 ? Math.round(apps.reduce((sum, a) => sum + (a.ats_score || 0), 0) / apps.length) : 0;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="space-y-6">
          {/* Dashboard Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4 pb-4 flex items-center gap-3">
                <FileText className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{apps.length}</p>
                  <p className="text-xs text-muted-foreground">Total Applications</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4 flex items-center gap-3">
                <Target className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{appliedCount}</p>
                  <p className="text-xs text-muted-foreground">Applied</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4 flex items-center gap-3">
                <TrendingUp className="h-8 w-8 text-success" />
                <div>
                  <p className="text-2xl font-bold">
                    {appliedCount > 0 ? Math.round((interviewCount / appliedCount) * 100) : 0}%
                  </p>
                  <p className="text-xs text-muted-foreground">Response Rate</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4 flex items-center gap-3">
                <BarChart3 className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{avgAts}</p>
                  <p className="text-xs text-muted-foreground">Avg ATS Score</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by company or role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Application List */}
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
          ) : filteredApps.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium">No applications found</h3>
                <p className="text-muted-foreground mt-1">
                  {apps.length === 0 ? "Tailor your first application and it will appear here." : "Try adjusting your filters."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredApps.map((app) => (
                <Card key={app.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="flex items-center justify-between p-5">
                    <div className="space-y-1 flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{app.job_title}</h3>
                      <p className="text-sm text-muted-foreground truncate">{app.company}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                        <Calendar className="h-3 w-3" />
                        {new Date(app.created_at).toLocaleDateString()}
                        {app.ats_score > 0 && (
                          <Badge variant="outline" className={`text-xs ${app.ats_score >= 80 ? "text-success border-success/30" : app.ats_score >= 60 ? "text-yellow-600 border-yellow-500/30" : "text-destructive border-destructive/30"}`}>
                            ATS: {app.ats_score}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Select value={app.status} onValueChange={(v) => updateStatus(app.id, v)}>
                        <SelectTrigger className={`h-8 text-xs w-[120px] ${STATUS_COLORS[app.status] || ""}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((s) => (
                            <SelectItem key={s} value={s} className="capitalize text-xs">{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button size="sm" variant="outline" onClick={() => setSelectedApp(app)}>
                        <Eye className="h-4 w-4 mr-1" /> View
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => deleteApp(app.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default History;
