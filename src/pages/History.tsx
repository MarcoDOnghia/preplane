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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Trash2, Eye, FileText, Calendar, BarChart3, Target, TrendingUp, Search,
  ArrowUpDown, Briefcase, Globe, Mail, Users, UserCheck, MoreHorizontal,
  ChevronDown, ChevronRight, Clock, Percent,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { addDays } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceStrict } from "date-fns";
import StatusUpdateDialog from "@/components/StatusUpdateDialog";
import ApplicationTimeline from "@/components/ApplicationTimeline";
import ApplicationDetailModal from "@/components/ApplicationDetailModal";
import RemindersBanner from "@/components/RemindersBanner";

const STATUS_OPTIONS = [
  "preparing", "applied", "recruiter_screen", "phone_interview",
  "onsite_interview", "offer", "accepted", "rejected", "archived",
];

const STATUS_LABELS: Record<string, string> = {
  preparing: "Preparing", applied: "Applied", recruiter_screen: "Recruiter Screen",
  phone_interview: "Phone Interview", onsite_interview: "Onsite Interview",
  offer: "Offer", accepted: "Accepted", rejected: "Rejected", archived: "Archived",
};

const STATUS_COLORS: Record<string, string> = {
  preparing: "bg-muted text-muted-foreground", applied: "bg-primary/10 text-primary",
  recruiter_screen: "bg-yellow-500/10 text-yellow-600", phone_interview: "bg-yellow-500/10 text-yellow-600",
  onsite_interview: "bg-yellow-500/10 text-yellow-600", offer: "bg-amber-500/10 text-amber-600",
  accepted: "bg-green-500/10 text-green-600", rejected: "bg-destructive/10 text-destructive",
  archived: "bg-muted text-muted-foreground",
};

const METHOD_ICONS: Record<string, React.ElementType> = {
  company_website: Globe, linkedin: Briefcase, email: Mail,
  referral: Users, recruiter: UserCheck, other: MoreHorizontal,
};

const METHOD_LABELS: Record<string, string> = {
  company_website: "Website", linkedin: "LinkedIn", email: "Email",
  referral: "Referral", recruiter: "Recruiter", other: "Other",
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
  salary_offered?: number | null;
  salary_currency?: string | null;
  offer_deadline?: string | null;
  rejection_stage?: string | null;
  rejection_reason?: string | null;
  interview_type?: string | null;
  interviewer_name?: string | null;
  scheduled_date?: string | null;
}

const History = () => {
  const { user, loading: authLoading } = useAuth();
  const [apps, setApps] = useState<AppRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("date_desc");
  const [expandedTimelines, setExpandedTimelines] = useState<Set<string>>(new Set());
  const [statusUpdateDialog, setStatusUpdateDialog] = useState<{ appId: string; newStatus: string } | null>(null);
  const [detailApp, setDetailApp] = useState<AppRow | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (user) fetchApps();
  }, [user]);

  const fetchApps = async () => {
    const { data, error } = await supabase
      .from("applications")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) setApps(data as AppRow[]);
    setLoading(false);
  };

  const deleteApp = async (id: string) => {
    const { error } = await supabase.from("applications").delete().eq("id", id);
    if (!error) {
      setApps((prev) => prev.filter((a) => a.id !== id));
      setDeleteConfirmId(null);
      toast({ title: "Deleted", description: "Application removed." });
    }
  };

  const createAutoReminder = async (appId: string, type: string, title: string, dueDate: Date) => {
    if (!user) return;
    await supabase.from("application_reminders").insert({
      application_id: appId,
      user_id: user.id,
      reminder_type: type,
      title,
      due_date: dueDate.toISOString(),
    });
  };

  const updateStatus = async (id: string, status: string, extra: Record<string, any>) => {
    const app = apps.find((a) => a.id === id);
    const oldStatus = app?.status || "preparing";
    const updates: any = { status, ...extra };
    if (status === "applied" && !app?.applied_date) {
      updates.applied_date = new Date().toISOString();
    }

    const { error } = await supabase.from("applications").update(updates).eq("id", id);
    if (!error) {
      if (user) {
        await supabase.from("application_timeline").insert({
          application_id: id,
          user_id: user.id,
          event_type: "status_change",
          from_status: oldStatus,
          to_status: status,
          metadata: extra,
        });

        // Auto-create contextual reminders
        if (status === "applied") {
          await createAutoReminder(id, "follow_up", `Follow up on ${app?.job_title || "application"} at ${app?.company || "company"}`, addDays(new Date(), 14));
        }
        if (["recruiter_screen", "phone_interview", "onsite_interview"].includes(status) && extra.scheduled_date) {
          const interviewDay = new Date(extra.scheduled_date);
          const dayBefore = addDays(interviewDay, -1);
          if (dayBefore > new Date()) {
            await createAutoReminder(id, "interview", `Interview tomorrow: ${app?.job_title || "role"} at ${app?.company || "company"}`, dayBefore);
          }
        }
        if (status === "offer" && extra.offer_deadline) {
          const deadline = new Date(extra.offer_deadline);
          const dayBefore = addDays(deadline, -1);
          if (dayBefore > new Date()) {
            await createAutoReminder(id, "offer_deadline", `Offer deadline tomorrow: ${app?.job_title || "role"} at ${app?.company || "company"}`, dayBefore);
          }
        }
      }
      setApps((prev) => prev.map((a) => (a.id === id ? { ...a, ...updates } : a)));
    }
  };

  const handleStatusChange = (appId: string, newStatus: string) => {
    const needsDialog = ["recruiter_screen", "phone_interview", "onsite_interview", "offer", "rejected"].includes(newStatus);
    if (needsDialog) {
      setStatusUpdateDialog({ appId, newStatus });
    } else {
      updateStatus(appId, newStatus, {});
    }
  };

  const handleStatusDialogSave = (extra: Record<string, any>) => {
    if (!statusUpdateDialog) return;
    updateStatus(statusUpdateDialog.appId, statusUpdateDialog.newStatus, extra);
    setStatusUpdateDialog(null);
  };

  const toggleTimeline = (id: string) => {
    setExpandedTimelines((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  const isInterviewStatus = (s: string) =>
    ["recruiter_screen", "phone_interview", "onsite_interview"].includes(s);

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
        case "date_asc": return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case "ats_desc": return (b.ats_score || 0) - (a.ats_score || 0);
        case "ats_asc": return (a.ats_score || 0) - (b.ats_score || 0);
        default: return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

  // Stats
  const appliedCount = apps.filter((a) => a.status !== "preparing" && a.status !== "archived").length;
  const interviewCount = apps.filter((a) => isInterviewStatus(a.status || "")).length;
  const offerCount = apps.filter((a) => a.status === "offer" || a.status === "accepted").length;
  const avgAts = apps.length > 0 ? Math.round(apps.reduce((sum, a) => sum + (a.ats_score || 0), 0) / apps.length) : 0;
  const responseRate = appliedCount > 0 ? Math.round(((interviewCount + offerCount) / appliedCount) * 100) : 0;
  const interviewRate = appliedCount > 0 ? Math.round((interviewCount / appliedCount) * 100) : 0;

  // Average time to first response
  const responseTimes = apps
    .filter((a) => a.applied_date && isInterviewStatus(a.status || ""))
    .map((a) => {
      const applied = new Date(a.applied_date!).getTime();
      const created = new Date(a.created_at).getTime();
      return Math.round((created - applied) / (1000 * 60 * 60 * 24));
    })
    .filter((d) => d > 0);
  const avgResponseDays = responseTimes.length > 0 ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) : 0;

  // Success rate by method
  const methodStats = apps.reduce((acc, a) => {
    if (!a.application_method) return acc;
    if (!acc[a.application_method]) acc[a.application_method] = { total: 0, responses: 0 };
    acc[a.application_method].total++;
    if (a.status && a.status !== "preparing" && a.status !== "applied" && a.status !== "archived") {
      acc[a.application_method].responses++;
    }
    return acc;
  }, {} as Record<string, { total: number; responses: number }>);

  const statusDialogApp = statusUpdateDialog ? apps.find((a) => a.id === statusUpdateDialog.appId) : null;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="space-y-6">
          {/* Reminders Banner */}
          <RemindersBanner userId={user.id} apps={apps.map((a) => ({ id: a.id, job_title: a.job_title, company: a.company }))} />

          {/* Dashboard Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {[
              { icon: FileText, value: apps.length, label: "Total", color: "text-primary" },
              { icon: Target, value: appliedCount, label: "Applied", color: "text-primary" },
              { icon: TrendingUp, value: interviewCount, label: "Interviews", color: "text-yellow-600" },
              { icon: BarChart3, value: offerCount, label: "Offers", color: "text-green-600" },
              { icon: BarChart3, value: avgAts, label: "Avg ATS", color: "text-primary" },
              { icon: Percent, value: `${responseRate}%`, label: "Response", color: "text-amber-600" },
              { icon: Clock, value: avgResponseDays > 0 ? `${avgResponseDays}d` : "—", label: "Avg Wait", color: "text-muted-foreground" },
            ].map((stat, i) => (
              <Card key={i}>
                <CardContent className="pt-3 pb-3 flex items-center gap-2">
                  <stat.icon className={`h-5 w-5 ${stat.color} shrink-0`} />
                  <div>
                    <p className="text-lg font-bold leading-none">{stat.value}</p>
                    <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Method Success Rates */}
          {Object.keys(methodStats).length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {Object.entries(methodStats).map(([method, stats]) => {
                const rate = stats.total > 0 ? Math.round((stats.responses / stats.total) * 100) : 0;
                return (
                  <Badge key={method} variant="outline" className="text-xs gap-1 py-1">
                    {METHOD_LABELS[method] || method}: {rate}% ({stats.responses}/{stats.total})
                  </Badge>
                );
              })}
            </div>
          )}

          {/* Filters & Sort */}
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by company or role..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
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
                <ArrowUpDown className="h-3 w-3 mr-1" /><SelectValue />
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
            <div className="grid gap-3">
              {filteredApps.map((app) => {
                const MethodIcon = app.application_method ? METHOD_ICONS[app.application_method] : null;
                const isExpanded = expandedTimelines.has(app.id);

                return (
                  <Collapsible key={app.id} open={isExpanded} onOpenChange={() => toggleTimeline(app.id)}>
                    <Card className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="space-y-1 flex-1 min-w-0">
                            <h3 className="font-semibold truncate">{app.job_title}</h3>
                            <p className="text-sm text-muted-foreground truncate">{app.company}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                              <Calendar className="h-3 w-3" />
                              {new Date(app.created_at).toLocaleDateString()}
                              {app.ats_score > 0 && (
                                <Badge variant="outline" className={`text-xs ${app.ats_score >= 80 ? "text-green-600 border-green-300" : app.ats_score >= 60 ? "text-yellow-600 border-yellow-300" : "text-destructive border-destructive/30"}`}>
                                  ATS: {app.ats_score}
                                </Badge>
                              )}
                              {app.application_method && MethodIcon && (
                                <Badge variant="outline" className="text-xs gap-1">
                                  <MethodIcon className="h-3 w-3" />
                                  {METHOD_LABELS[app.application_method] || app.application_method}
                                </Badge>
                              )}
                              {app.scheduled_date && (
                                <Badge variant="outline" className="text-xs text-primary border-primary/30">
                                  📅 {new Date(app.scheduled_date).toLocaleDateString()}
                                </Badge>
                              )}
                              {app.salary_offered && (
                                <Badge variant="outline" className="text-xs text-green-600 border-green-300">
                                  💰 {app.salary_currency || "USD"} {Number(app.salary_offered).toLocaleString()}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Select value={app.status || "preparing"} onValueChange={(v) => handleStatusChange(app.id, v)}>
                              <SelectTrigger className={`h-8 text-xs w-[130px] ${STATUS_COLORS[app.status || "preparing"] || ""}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {STATUS_OPTIONS.map((s) => (
                                  <SelectItem key={s} value={s} className="text-xs">{STATUS_LABELS[s]}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <CollapsibleTrigger asChild>
                              <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              </Button>
                            </CollapsibleTrigger>
                            <Button size="sm" variant="outline" onClick={() => setDetailApp(app)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeleteConfirmId(app.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        <CollapsibleContent className="pt-4 border-t mt-4">
                          <ApplicationTimeline applicationId={app.id} userId={user.id} />
                        </CollapsibleContent>
                      </CardContent>
                    </Card>
                  </Collapsible>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={(o) => !o && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Application?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the application and all its timeline events, notes, and reminders. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteConfirmId && deleteApp(deleteConfirmId)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Status Update Dialog */}
      {statusUpdateDialog && statusDialogApp && (
        <StatusUpdateDialog
          open={!!statusUpdateDialog}
          onClose={() => setStatusUpdateDialog(null)}
          newStatus={statusUpdateDialog.newStatus}
          onSave={handleStatusDialogSave}
          jobTitle={statusDialogApp.job_title}
          company={statusDialogApp.company}
        />
      )}

      {/* Application Detail Modal */}
      <ApplicationDetailModal
        open={!!detailApp}
        onClose={() => setDetailApp(null)}
        app={detailApp}
        userId={user.id}
      />
    </div>
  );
};

export default History;
