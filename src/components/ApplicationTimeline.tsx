import { useEffect, useState } from "react";
import { format, formatDistanceStrict } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageSquarePlus, Clock, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TimelineEvent {
  id: string;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  metadata: any;
  note: string | null;
  created_at: string;
}

interface Note {
  id: string;
  content: string;
  created_at: string;
}

interface ApplicationTimelineProps {
  applicationId: string;
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

const STATUS_DOT_COLORS: Record<string, string> = {
  preparing: "bg-muted-foreground",
  applied: "bg-primary",
  recruiter_screen: "bg-yellow-500",
  phone_interview: "bg-yellow-500",
  onsite_interview: "bg-yellow-500",
  offer: "bg-amber-500",
  accepted: "bg-green-500",
  rejected: "bg-destructive",
  archived: "bg-muted-foreground",
};

const ApplicationTimeline = ({ applicationId, userId }: ApplicationTimelineProps) => {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState("");
  const [showNoteInput, setShowNoteInput] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, [applicationId]);

  const fetchData = async () => {
    const [timelineRes, notesRes] = await Promise.all([
      supabase.from("application_timeline").select("*").eq("application_id", applicationId).order("created_at", { ascending: true }),
      supabase.from("application_notes").select("*").eq("application_id", applicationId).order("created_at", { ascending: true }),
    ]);
    if (timelineRes.data) setEvents(timelineRes.data);
    if (notesRes.data) setNotes(notesRes.data);
  };

  const addNote = async () => {
    if (!newNote.trim()) return;
    const { error } = await supabase.from("application_notes").insert({
      application_id: applicationId,
      user_id: userId,
      content: sanitizeInput(newNote),
    });
    if (!error) {
      setNewNote("");
      setShowNoteInput(false);
      fetchData();
      toast({ title: "Note added" });
    }
  };

  // Merge events and notes into a single sorted timeline
  const allItems = [
    ...events.map((e) => ({ type: "event" as const, data: e, date: e.created_at })),
    ...notes.map((n) => ({ type: "note" as const, data: n, date: n.created_at })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (allItems.length === 0 && !showNoteInput) {
    return (
      <div className="flex items-center justify-between py-2">
        <p className="text-sm text-muted-foreground">No timeline events yet.</p>
        <Button variant="ghost" size="sm" onClick={() => setShowNoteInput(true)}>
          <MessageSquarePlus className="h-4 w-4 mr-1" /> Add Note
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      <div className="relative pl-6">
        {/* Vertical line */}
        <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-border" />

        {allItems.map((item, i) => {
          const prevDate = i > 0 ? allItems[i - 1].date : null;
          const elapsed = prevDate ? formatDistanceStrict(new Date(item.date), new Date(prevDate)) : null;

          if (item.type === "event") {
            const e = item.data as TimelineEvent;
            const dotColor = e.to_status ? STATUS_DOT_COLORS[e.to_status] || "bg-primary" : "bg-primary";
            return (
              <div key={`e-${e.id}`} className="relative pb-4">
                <div className={`absolute -left-6 top-1.5 h-3 w-3 rounded-full ${dotColor} ring-2 ring-background z-10`} />
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">
                      {e.to_status ? STATUS_LABELS[e.to_status] || e.to_status : "Created"}
                    </span>
                    {elapsed && (
                      <Badge variant="outline" className="text-[10px] gap-1">
                        <Clock className="h-2.5 w-2.5" /> {elapsed}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{format(new Date(e.created_at), "MMM d, yyyy 'at' h:mm a")}</p>
                  {e.note && <p className="text-xs text-muted-foreground italic mt-1">"{e.note}"</p>}
                  {e.metadata && Object.keys(e.metadata).length > 0 && (
                    <div className="flex gap-1 flex-wrap mt-1">
                      {e.metadata.interview_type && <Badge variant="secondary" className="text-[10px]">{e.metadata.interview_type}</Badge>}
                      {e.metadata.interviewer_name && <Badge variant="secondary" className="text-[10px]">with {e.metadata.interviewer_name}</Badge>}
                      {e.metadata.salary_offered && <Badge variant="secondary" className="text-[10px]">{e.metadata.salary_currency || "USD"} {Number(e.metadata.salary_offered).toLocaleString()}</Badge>}
                    </div>
                  )}
                </div>
              </div>
            );
          } else {
            const n = item.data as Note;
            return (
              <div key={`n-${n.id}`} className="relative pb-4">
                <div className="absolute -left-6 top-1.5 h-3 w-3 rounded-full bg-accent ring-2 ring-background z-10" />
                <div className="bg-accent/30 rounded-md p-2">
                  <p className="text-sm">{n.content}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{format(new Date(n.created_at), "MMM d, yyyy 'at' h:mm a")}</p>
                </div>
              </div>
            );
          }
        })}
      </div>

      {showNoteInput ? (
        <div className="flex gap-2 mt-2">
          <Input placeholder="Add a note..." value={newNote} onChange={(e) => setNewNote(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addNote()} className="text-sm" />
          <Button size="sm" onClick={addNote} disabled={!newNote.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <Button variant="ghost" size="sm" onClick={() => setShowNoteInput(true)} className="mt-1">
          <MessageSquarePlus className="h-4 w-4 mr-1" /> Add Note
        </Button>
      )}
    </div>
  );
};

export default ApplicationTimeline;
