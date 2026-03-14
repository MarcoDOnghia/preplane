import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Clock, DollarSign } from "lucide-react";
import { exportCoverLetter, exportCvSuggestions } from "@/lib/exportDoc";
import ApplicationTimeline from "./ApplicationTimeline";
import type { TailorResult } from "@/lib/types";
import { sanitizeDisplayText } from "@/lib/sanitizeText";

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
  job_description?: string;
  cv_content?: string;
}

interface ApplicationDetailModalProps {
  open: boolean;
  onClose: () => void;
  app: AppRow | null;
  userId: string;
}

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

const ApplicationDetailModal = ({ open, onClose, app, userId }: ApplicationDetailModalProps) => {
  if (!app) return null;

  const result: TailorResult = {
    keyRequirements: (app.key_requirements as string[]) || [],
    cvSuggestions: (app.cv_suggestions as any[]) || [],
    coverLetter: app.cover_letter || "",
    coverLetterVersions: (app.cover_letter_versions as any[]) || [],
    atsAnalysis: {
      score: app.ats_score || 0,
      keywordsFound: (app.keywords_found as string[]) || [],
      keywordsMissing: (app.keywords_missing as string[]) || [],
      formattingIssues: (app.formatting_issues as string[]) || [],
      quickWins: (app.quick_wins as string[]) || [],
    },
    interviewQuestions: [],
    questionsToAsk: [],
    companyBrief: "",
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3 flex-wrap">
            <DialogTitle className="text-xl">{app.job_title}</DialogTitle>
            <Badge variant="outline">{STATUS_LABELS[app.status || "preparing"]}</Badge>
          </div>
          <DialogDescription>{app.company}</DialogDescription>
        </DialogHeader>

        {/* Quick meta info */}
        <div className="flex flex-wrap gap-3 text-sm">
          {app.ats_score > 0 && (
            <Badge variant="outline" className={app.ats_score >= 80 ? "text-green-600 border-green-300" : app.ats_score >= 60 ? "text-yellow-600 border-yellow-300" : "text-destructive border-destructive/30"}>
              Match: {app.ats_score}
            </Badge>
          )}
          {app.salary_offered && (
            <Badge variant="outline" className="gap-1">
              <DollarSign className="h-3 w-3" />
              {app.salary_currency || "USD"} {Number(app.salary_offered).toLocaleString()}
            </Badge>
          )}
          {app.scheduled_date && (
            <Badge variant="outline" className="gap-1">
              <Clock className="h-3 w-3" />
              Scheduled: {new Date(app.scheduled_date).toLocaleDateString()}
            </Badge>
          )}
        </div>

        <Tabs defaultValue="timeline" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="cv">CV & Cover</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
          </TabsList>

          <TabsContent value="timeline" className="mt-4">
            <ApplicationTimeline applicationId={app.id} userId={userId} />
          </TabsContent>

          <TabsContent value="cv" className="mt-4 space-y-4">
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={() => exportCvSuggestions(result.cvSuggestions, app.job_title)}>
                <Download className="h-4 w-4 mr-1" /> CV Suggestions
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportCoverLetter(result.coverLetter, app.job_title)}>
                <Download className="h-4 w-4 mr-1" /> Cover Letter
              </Button>
            </div>
            {result.cvSuggestions.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-base">CV Suggestions ({result.cvSuggestions.length})</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {result.cvSuggestions.slice(0, 5).map((s, i) => (
                    <div key={i} className="border-b last:border-0 pb-3">
                      <p className="text-sm font-medium">{sanitizeDisplayText(s.section)}</p>
                      <p className="text-xs text-muted-foreground mt-1">"{sanitizeDisplayText(s.suggested)}"</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
            {result.coverLetter && (
              <Card>
                <CardHeader><CardTitle className="text-base">Cover Letter</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed whitespace-pre-line line-clamp-[20]">{result.coverLetter}</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="details" className="mt-4 space-y-4">
            <Card>
              <CardContent className="pt-4 space-y-3">
                <DetailRow label="Status" value={STATUS_LABELS[app.status || "preparing"]} />
                <DetailRow label="Created" value={new Date(app.created_at).toLocaleDateString()} />
                {app.applied_date && <DetailRow label="Applied" value={new Date(app.applied_date).toLocaleDateString()} />}
                {app.interview_type && <DetailRow label="Interview Type" value={app.interview_type} />}
                {app.interviewer_name && <DetailRow label="Interviewer" value={app.interviewer_name} />}
                {app.rejection_stage && <DetailRow label="Rejected At" value={app.rejection_stage} />}
                {app.rejection_reason && <DetailRow label="Rejection Reason" value={app.rejection_reason} />}
                {app.offer_deadline && <DetailRow label="Offer Deadline" value={new Date(app.offer_deadline).toLocaleDateString()} />}
              </CardContent>
            </Card>
            {result.keyRequirements.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-base">Key Requirements</CardTitle></CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {result.keyRequirements.map((r, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">{r}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

export default ApplicationDetailModal;
