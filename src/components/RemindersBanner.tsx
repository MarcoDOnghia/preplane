import { useEffect, useState } from "react";
import { formatDistanceToNow, isPast, isFuture, addDays } from "date-fns";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { CalendarIcon, Bell, Check, Plus, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface Reminder {
  id: string;
  application_id: string;
  reminder_type: string;
  title: string;
  due_date: string;
  is_done: boolean;
}

interface AppInfo {
  id: string;
  job_title: string;
  company: string;
}

interface RemindersBannerProps {
  userId: string;
  apps: AppInfo[];
}

const REMINDER_TYPES = [
  { value: "follow_up", label: "Follow-up" },
  { value: "interview", label: "Interview" },
  { value: "offer_deadline", label: "Offer Deadline" },
  { value: "custom", label: "Custom" },
];

const RemindersBanner = ({ userId, apps }: RemindersBannerProps) => {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState("follow_up");
  const [newDate, setNewDate] = useState<Date | undefined>(addDays(new Date(), 3));
  const [newAppId, setNewAppId] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    fetchReminders();
  }, [userId]);

  const fetchReminders = async () => {
    const { data } = await supabase
      .from("application_reminders")
      .select("*")
      .eq("user_id", userId)
      .eq("is_done", false)
      .order("due_date", { ascending: true });
    if (data) setReminders(data);
  };

  const markDone = async (id: string) => {
    await supabase.from("application_reminders").update({ is_done: true }).eq("id", id);
    setReminders((prev) => prev.filter((r) => r.id !== id));
    toast({ title: "Reminder completed" });
  };

  const addReminder = async () => {
    if (!newTitle.trim() || !newAppId || !newDate) return;
    const { error } = await supabase.from("application_reminders").insert({
      application_id: newAppId,
      user_id: userId,
      reminder_type: newType,
      title: newTitle.trim(),
      due_date: newDate.toISOString(),
    });
    if (!error) {
      setShowAddDialog(false);
      setNewTitle("");
      setNewType("follow_up");
      setNewDate(addDays(new Date(), 3));
      setNewAppId("");
      fetchReminders();
      toast({ title: "Reminder added" });
    }
  };

  const activeReminders = reminders.filter((r) => !r.is_done);
  const overdueCount = activeReminders.filter((r) => isPast(new Date(r.due_date))).length;

  if (activeReminders.length === 0) {
    return (
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4 mr-1" /> Add Reminder
        </Button>
        <AddReminderDialog
          open={showAddDialog}
          onClose={() => setShowAddDialog(false)}
          apps={apps}
          newTitle={newTitle}
          setNewTitle={setNewTitle}
          newType={newType}
          setNewType={setNewType}
          newDate={newDate}
          setNewDate={setNewDate}
          newAppId={newAppId}
          setNewAppId={setNewAppId}
          onSave={addReminder}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-sm">Upcoming Reminders</h3>
          {overdueCount > 0 && <Badge variant="destructive" className="text-xs">{overdueCount} overdue</Badge>}
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {activeReminders.slice(0, 6).map((r) => {
          const isOverdue = isPast(new Date(r.due_date));
          const app = apps.find((a) => a.id === r.application_id);
          return (
            <Card key={r.id} className={cn("transition-all", isOverdue && "border-destructive/50")}>
              <CardContent className="p-3 flex items-start justify-between gap-2">
                <div className="space-y-0.5 min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">
                    {isOverdue ? "⚠️" : "⏰"} {r.title}
                  </p>
                  {app && <p className="text-xs text-muted-foreground truncate">{app.company}</p>}
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {isOverdue
                      ? `Overdue by ${formatDistanceToNow(new Date(r.due_date))}`
                      : `In ${formatDistanceToNow(new Date(r.due_date))}`}
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => markDone(r.id)} className="shrink-0">
                  <Check className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <AddReminderDialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        apps={apps}
        newTitle={newTitle}
        setNewTitle={setNewTitle}
        newType={newType}
        setNewType={setNewType}
        newDate={newDate}
        setNewDate={setNewDate}
        newAppId={newAppId}
        setNewAppId={setNewAppId}
        onSave={addReminder}
      />
    </div>
  );
};

function AddReminderDialog({
  open, onClose, apps, newTitle, setNewTitle, newType, setNewType, newDate, setNewDate, newAppId, setNewAppId, onSave,
}: {
  open: boolean;
  onClose: () => void;
  apps: AppInfo[];
  newTitle: string;
  setNewTitle: (v: string) => void;
  newType: string;
  setNewType: (v: string) => void;
  newDate: Date | undefined;
  setNewDate: (v: Date | undefined) => void;
  newAppId: string;
  setNewAppId: (v: string) => void;
  onSave: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Reminder</DialogTitle>
          <DialogDescription>Set a reminder for an application</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Application</Label>
            <Select value={newAppId} onValueChange={setNewAppId}>
              <SelectTrigger><SelectValue placeholder="Select application" /></SelectTrigger>
              <SelectContent>
                {apps.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.job_title} – {a.company}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={newType} onValueChange={setNewType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {REMINDER_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Title</Label>
            <Input placeholder="e.g. Follow up with recruiter" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Due Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !newDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {newDate ? format(newDate, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={newDate} onSelect={setNewDate} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>
          <Button onClick={onSave} className="w-full" disabled={!newTitle.trim() || !newAppId || !newDate}>Add Reminder</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { RemindersBanner };
export default RemindersBanner;
