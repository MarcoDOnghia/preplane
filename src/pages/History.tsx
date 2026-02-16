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
import { Trash2, Eye, FileText, Calendar, BarChart3, Target, TrendingUp, Search, ArrowUpDown, Briefcase, Globe, Mail, Users, UserCheck, MoreHorizontal } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ResultsSection from "@/components/ResultsSection";
import type { TailorResult } from "@/lib/types";

const STATUS_OPTIONS = [
  "preparing", "applied", "recruiter_screen", "phone_interview",
  "onsite_interview", "offer", "accepted", "rejected", "archived",
];

const STATUS_LABELS: Record<string, string> = {
  preparing: "Preparing",
  applied: "Applied",
  recruiter_screen: "Recruiter Screen",
  phone_interview: "Phone Interview",
  onsite_interview: "Onsite Interview",
  offer: "Offer",
  accepted: "Accepted",
  rejected: "Rejected",
  archived: "Archived",
};

const STATUS_COLORS: Record<string, string> = {
  preparing: "bg-muted text-muted-foreground",
  applied: "bg-primary/10 text-primary",
  recruiter_screen: "bg-yellow-500/10 text-yellow-600",
  phone_interview: "bg-yellow-500/10 text-yellow-600",
  onsite_interview: "bg-yellow-500/10 text-yellow-600",
  offer: "bg-amber-500/10 text-amber-600",
  accepted: "bg-success/10 text-success",
  rejected: "bg-destructive/10 text-destructive",
  archived: "bg-muted text-muted-foreground",
};

const METHOD_ICONS: Record<string, React.ElementType> = {
  company_website: Globe,
  linkedin: Briefcase,
  email: Mail,
  referral: Users,
  recruiter: UserCheck,
  other: MoreHorizontal,
};

const METHOD_LABELS: Record<string, string> = {
  company_website: "Website",
  linkedin: "LinkedIn",
  email: "Email",
  referral: "Referral",
  recruiter: "Recruiter",
  other: "Other",
};

const SORT_OPTIONS = [
  { value: "date_desc", label: "Newest First" },
  { value: "date_asc", label: "Oldest First" },
  { value: "ats_desc", label: "ATS Score (High)" },
  { value: "ats_asc", label: "ATS Score (Low)" },
];

const FILTER_STATUSES = ["all", "preparing", "applied", "interview", "offer", "rejected"];

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
  application_method: string | null;
  follow_up_date: string | null;
  created_at: string;
}

const History = () => {
  const { user, loading: authLoading } = useAuth();
  const [apps, setApps] = useState<AppRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApp, setSelectedApp] = useState<AppRow | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("date_desc");
  const { toast } = useToast();

  useEffect(() => {
    if (user) fetchApps();
  }, [user]);

  const fetchApps = async () => {
    const { data, error } = await supabase
      .from("applications")
      .select("id, job_title, company, tone, key_requirements, cv_suggestions, cover_letter, cover_letter_versions, ats_score, keywords_found, keywords_missing, formatting_issues, quick_wins, interview_questions, questions_to_ask, company_brief, status, applied_date, application_method, follow_up_date, created_at")
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
    if (status === "applied" && !apps.find((a) => a.id === id)?.applied_date) {
      updates.applied_date = new Date().toISOString();
    }
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

  const isInterviewStatus = (s: string) =>
    ["recruiter_screen", "phone_interview", "onsite_interview", "interview"].includes(s);

  const filteredApps = apps
    .filter((app) => {
      const s = app.status || "preparing";
      if (statusFilter === "all") return true;
      if (statusFilter === "interview") return isInterviewStatus(s);
      if (statusFilter === "offer") return s === "offer" || s === "accepted";
      return s === statusFilter;
    })
    .filter(
      (app) =>
        !searchQuery ||
        app.job_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.company.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      switch (sortBy) {
        case "date_asc":
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case "ats_desc":
          return (b.ats_score || 0) - (a.ats_score || 0);
        case "ats_asc":
          return (a.ats_score || 0) - (b.ats_score || 0);
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

  const appliedCount = apps.filter((a) => a.status !== "preparing" && a.status !== "archived").length;
  const interviewCount = apps.filter((a) => isInterviewStatus(a.status || "")).length;
  const offerCount = apps.filter((a) => a.status === "offer" || a.status === "accepted").length;
  const avgAts = apps.length > 0 ? Math.round(apps.reduce((sum, a) => sum + (a.ats_score || 0), 0) / apps.length) : 0;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="space-y-6">
          {/* Dashboard Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            {[
              { icon: FileText, value: apps.length, label: "Total", color: "text-primary" },
              { icon: Target, value: appliedCount, label: "Applied", color: "text-primary" },
              { icon: TrendingUp, value: interviewCount, label: "Interviews", color: "text-yellow-600" },
              { icon: BarChart3, value: offerCount, label: "Offers", color: "text-success" },
              { icon: BarChart3, value: avgAts, label: "Avg ATS", color: "text-primary" },
            ].map((stat, i) => (
              <Card key={i}>
                <CardContent className="pt-4 pb-4 flex items-center gap-3">
                  <stat.icon className={`h-7 w-7 ${stat.color}`} />
                  <div>
                    <p className="text-2xl font-bold">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Filters & Sort */}
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
                {FILTER_STATUSES.map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">
                    {s === "all" ? "All Statuses" : s === "interview" ? "Interviews" : s.charAt(0).toUpperCase() + s.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[170px]">
                <ArrowUpDown className="h-3 w-3 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
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
              {filteredApps.map((app) => {
                const MethodIcon = app.application_method ? METHOD_ICONS[app.application_method] : null;
                return (
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
                          {app.application_method && MethodIcon && (
                            <Badge variant="outline" className="text-xs gap-1">
                              <MethodIcon className="h-3 w-3" />
                              {METHOD_LABELS[app.application_method] || app.application_method}
                            </Badge>
                          )}
                          {app.follow_up_date && (
                            <Badge variant="outline" className="text-xs text-amber-600 border-amber-500/30">
                              Follow up: {new Date(app.follow_up_date).toLocaleDateString()}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <Select value={app.status || "preparing"} onValueChange={(v) => updateStatus(app.id, v)}>
                          <SelectTrigger className={`h-8 text-xs w-[140px] ${STATUS_COLORS[app.status || "preparing"] || ""}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map((s) => (
                              <SelectItem key={s} value={s} className="text-xs">
                                {STATUS_LABELS[s]}
                              </SelectItem>
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
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default History;
