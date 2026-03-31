import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  ClipboardCheck, Plus, Star, Trash2, Loader2, ChevronDown, ChevronRight, ThumbsUp, AlertTriangle,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface FeedbackRecord {
  id: string;
  interview_date: string;
  interviewer_name: string | null;
  interview_type: string;
  questions_asked: { question: string; wasAsked: boolean }[];
  unexpected_questions: string[];
  self_rating: number;
  went_well: string | null;
  improvement_notes: string | null;
  overall_notes: string | null;
  created_at: string;
}

interface InterviewFeedbackProps {
  applicationId: string;
  userId: string;
  predictedQuestions?: string[];
}

const INTERVIEW_TYPES = [
  { value: "general", label: "General" },
  { value: "phone", label: "Phone Screen" },
  { value: "technical", label: "Technical" },
  { value: "behavioral", label: "Behavioral" },
  { value: "case_study", label: "Case Study" },
  { value: "panel", label: "Panel" },
  { value: "final", label: "Final Round" },
];

const InterviewFeedback = ({ applicationId, userId, predictedQuestions = [] }: InterviewFeedbackProps) => {
  const [feedbacks, setFeedbacks] = useState<FeedbackRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Form state
  const [interviewDate, setInterviewDate] = useState(new Date().toISOString().split("T")[0]);
  const [interviewerName, setInterviewerName] = useState("");
  const [interviewType, setInterviewType] = useState("general");
  const [questionsChecked, setQuestionsChecked] = useState<Record<number, boolean>>(
    Object.fromEntries(predictedQuestions.map((_, i) => [i, false]))
  );
  const [newUnexpectedQ, setNewUnexpectedQ] = useState("");
  const [unexpectedQuestions, setUnexpectedQuestions] = useState<string[]>([]);
  const [selfRating, setSelfRating] = useState(3);
  const [wentWell, setWentWell] = useState("");
  const [improvementNotes, setImprovementNotes] = useState("");
  const [overallNotes, setOverallNotes] = useState("");

  const { toast } = useToast();

  useEffect(() => {
    fetchFeedbacks();
  }, [applicationId]);

  const fetchFeedbacks = async () => {
    const { data, error } = await supabase
      .from("interview_feedback")
      .select("*")
      .eq("application_id", applicationId)
      .order("interview_date", { ascending: false });

    if (!error && data) setFeedbacks(data as unknown as FeedbackRecord[]);
    setLoading(false);
  };

  const resetForm = () => {
    setInterviewDate(new Date().toISOString().split("T")[0]);
    setInterviewerName("");
    setInterviewType("general");
    setQuestionsChecked(Object.fromEntries(predictedQuestions.map((_, i) => [i, false])));
    setUnexpectedQuestions([]);
    setNewUnexpectedQ("");
    setSelfRating(3);
    setWentWell("");
    setImprovementNotes("");
    setOverallNotes("");
  };

  const saveFeedback = async () => {
    setSaving(true);
    try {
      const questionsAsked = predictedQuestions.map((q, i) => ({
        question: q,
        wasAsked: !!questionsChecked[i],
      }));

      const { data, error } = await supabase
        .from("interview_feedback")
        .insert({
          user_id: userId,
          application_id: applicationId,
          interview_date: interviewDate,
          interviewer_name: interviewerName ? sanitizeInput(interviewerName) : null,
          interview_type: interviewType,
          questions_asked: questionsAsked,
          unexpected_questions: unexpectedQuestions.map(q => sanitizeInput(q)),
          self_rating: selfRating,
          went_well: wentWell ? sanitizeInput(wentWell) : null,
          improvement_notes: improvementNotes ? sanitizeInput(improvementNotes) : null,
          overall_notes: overallNotes ? sanitizeInput(overallNotes) : null,
        })
        .select()
        .single();

      if (error) throw error;

      setFeedbacks((prev) => [data as unknown as FeedbackRecord, ...prev]);
      setShowForm(false);
      resetForm();
      toast({ title: "Feedback saved" });

      // Record on timeline
      await supabase.from("application_timeline").insert({
        application_id: applicationId,
        user_id: userId,
        event_type: "interview_feedback",
        note: `Logged ${INTERVIEW_TYPES.find((t) => t.value === interviewType)?.label || interviewType} interview feedback (${selfRating}/5)${interviewerName ? ` with ${interviewerName}` : ""}`,
      });
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const deleteFeedback = async (id: string) => {
    const { error } = await supabase.from("interview_feedback").delete().eq("id", id);
    if (!error) setFeedbacks((prev) => prev.filter((f) => f.id !== id));
  };

  const addUnexpectedQuestion = () => {
    if (!newUnexpectedQ.trim()) return;
    setUnexpectedQuestions((prev) => [...prev, newUnexpectedQ.trim()]);
    setNewUnexpectedQ("");
  };

  const renderStars = (rating: number, interactive = false) => (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!interactive}
          onClick={() => interactive && setSelfRating(n)}
          className={`${interactive ? "cursor-pointer hover:scale-110" : "cursor-default"} transition-transform`}
        >
          <Star
            className={`h-5 w-5 ${n <= rating ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground/30"}`}
          />
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      {!showForm ? (
        <Button variant="outline" onClick={() => setShowForm(true)} className="w-full">
          <ClipboardCheck className="h-4 w-4 mr-2" /> Log Interview Feedback
        </Button>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-primary" />
              Log Interview Feedback
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Meta */}
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Interview Date</Label>
                <Input type="date" value={interviewDate} onChange={(e) => setInterviewDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Interviewer Name</Label>
                <Input placeholder="e.g. John Smith" value={interviewerName} onChange={(e) => setInterviewerName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Interview Type</Label>
                <Select value={interviewType} onValueChange={setInterviewType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {INTERVIEW_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Predicted questions checklist */}
            {predictedQuestions.length > 0 && (
              <div className="space-y-2">
                <Label>Predicted Questions — Check the ones they actually asked</Label>
                <div className="space-y-2 max-h-[200px] overflow-y-auto border rounded-md p-3">
                  {predictedQuestions.map((q, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <Checkbox
                        id={`pq-${i}`}
                        checked={!!questionsChecked[i]}
                        onCheckedChange={(checked) =>
                          setQuestionsChecked((prev) => ({ ...prev, [i]: !!checked }))
                        }
                      />
                      <label htmlFor={`pq-${i}`} className="text-sm leading-tight cursor-pointer">
                        {q}
                      </label>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {Object.values(questionsChecked).filter(Boolean).length} of {predictedQuestions.length} predicted correctly
                </p>
              </div>
            )}

            {/* Unexpected questions */}
            <div className="space-y-2">
              <Label>Questions Not Anticipated</Label>
              {unexpectedQuestions.map((q, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs flex-1 justify-start font-normal">
                    <AlertTriangle className="h-3 w-3 mr-1 shrink-0" /> {q}
                  </Badge>
                  <Button
                    size="sm" variant="ghost" className="h-6 w-6 p-0"
                    onClick={() => setUnexpectedQuestions((prev) => prev.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              <div className="flex gap-2">
                <Input
                  placeholder="Add a question they asked that you didn't expect..."
                  value={newUnexpectedQ}
                  onChange={(e) => setNewUnexpectedQ(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addUnexpectedQuestion()}
                />
                <Button size="sm" variant="outline" onClick={addUnexpectedQuestion}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Self rating */}
            <div className="space-y-1.5">
              <Label>Self Performance Rating</Label>
              {renderStars(selfRating, true)}
            </div>

            {/* Text areas */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1">
                  <ThumbsUp className="h-3 w-3" /> What Went Well
                </Label>
                <Textarea
                  placeholder="Things you nailed..."
                  value={wentWell}
                  onChange={(e) => setWentWell(e.target.value)}
                  className="min-h-[80px]"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Areas to Improve
                </Label>
                <Textarea
                  placeholder="Topics to study for next time..."
                  value={improvementNotes}
                  onChange={(e) => setImprovementNotes(e.target.value)}
                  className="min-h-[80px]"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Overall Notes</Label>
              <Textarea
                placeholder="General thoughts, vibes, next steps..."
                value={overallNotes}
                onChange={(e) => setOverallNotes(e.target.value)}
                className="min-h-[60px]"
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={saveFeedback} disabled={saving}>
                {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</> : "Save Feedback"}
              </Button>
              <Button variant="ghost" onClick={() => { setShowForm(false); resetForm(); }}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Past feedback entries */}
      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : feedbacks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Past Feedback ({feedbacks.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {feedbacks.map((fb) => {
              const isExpanded = expandedId === fb.id;
              const askedCount = Array.isArray(fb.questions_asked)
                ? fb.questions_asked.filter((q: any) => q.wasAsked).length
                : 0;
              const totalPredicted = Array.isArray(fb.questions_asked) ? fb.questions_asked.length : 0;

              return (
                <Collapsible key={fb.id} open={isExpanded} onOpenChange={() => setExpandedId(isExpanded ? null : fb.id)}>
                  <div className="border rounded-lg p-3">
                    <CollapsibleTrigger className="w-full">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-sm">
                          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          <span className="font-medium">
                            {new Date(fb.interview_date).toLocaleDateString()}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {INTERVIEW_TYPES.find((t) => t.value === fb.interview_type)?.label || fb.interview_type}
                          </Badge>
                          {fb.interviewer_name && (
                            <span className="text-xs text-muted-foreground">with {fb.interviewer_name}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {renderStars(fb.self_rating)}
                          <Button
                            size="sm" variant="ghost" className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                            onClick={(e) => { e.stopPropagation(); deleteFeedback(fb.id); }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </CollapsibleTrigger>

                    <CollapsibleContent className="mt-3 space-y-3 pt-3 border-t">
                      {totalPredicted > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">
                            Predicted Questions: {askedCount}/{totalPredicted} asked
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {fb.questions_asked.map((q: any, i: number) => (
                              <Badge key={i} variant={q.wasAsked ? "default" : "secondary"} className="text-xs font-normal">
                                {q.wasAsked ? "✓" : "✗"} {q.question.slice(0, 50)}{q.question.length > 50 ? "…" : ""}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {Array.isArray(fb.unexpected_questions) && fb.unexpected_questions.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">Unexpected Questions</p>
                          <ul className="space-y-1">
                            {fb.unexpected_questions.map((q: string, i: number) => (
                              <li key={i} className="text-sm flex items-start gap-1">
                                <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0 text-yellow-500" /> {q}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {fb.went_well && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">What Went Well</p>
                          <p className="text-sm">{fb.went_well}</p>
                        </div>
                      )}
                      {fb.improvement_notes && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">Areas to Improve</p>
                          <p className="text-sm">{fb.improvement_notes}</p>
                        </div>
                      )}
                      {fb.overall_notes && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">Overall Notes</p>
                          <p className="text-sm">{fb.overall_notes}</p>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Logged {formatDistanceToNow(new Date(fb.created_at), { addSuffix: true })}
                      </p>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default InterviewFeedback;
