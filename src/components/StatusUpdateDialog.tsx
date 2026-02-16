import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, Phone, Video, Building2, DollarSign } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface StatusUpdateDialogProps {
  open: boolean;
  onClose: () => void;
  newStatus: string;
  onSave: (data: Record<string, any>) => void;
  jobTitle: string;
  company: string;
}

const STATUS_LABELS: Record<string, string> = {
  recruiter_screen: "Recruiter Screen",
  phone_interview: "Phone Interview",
  onsite_interview: "Onsite Interview",
  offer: "Offer",
  rejected: "Rejected",
};

const INTERVIEW_TYPES = [
  { value: "phone", label: "Phone", icon: Phone },
  { value: "video", label: "Video", icon: Video },
  { value: "in_person", label: "In-Person", icon: Building2 },
];

const REJECTION_STAGES = [
  "Application Review",
  "Recruiter Screen",
  "Phone Interview",
  "Technical Interview",
  "Onsite Interview",
  "Final Round",
  "After Offer",
];

const StatusUpdateDialog = ({ open, onClose, newStatus, onSave, jobTitle, company }: StatusUpdateDialogProps) => {
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>();
  const [interviewType, setInterviewType] = useState<string>("");
  const [interviewerName, setInterviewerName] = useState("");
  const [salaryOffered, setSalaryOffered] = useState("");
  const [salaryCurrency, setSalaryCurrency] = useState("USD");
  const [offerDeadline, setOfferDeadline] = useState<Date | undefined>();
  const [rejectionStage, setRejectionStage] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");

  const reset = () => {
    setScheduledDate(undefined);
    setInterviewType("");
    setInterviewerName("");
    setSalaryOffered("");
    setSalaryCurrency("USD");
    setOfferDeadline(undefined);
    setRejectionStage("");
    setRejectionReason("");
  };

  const handleSave = () => {
    const data: Record<string, any> = {};

    if (newStatus === "recruiter_screen" || newStatus === "phone_interview" || newStatus === "onsite_interview") {
      if (scheduledDate) data.scheduled_date = scheduledDate.toISOString();
      if (interviewType) data.interview_type = interviewType;
      if (interviewerName) data.interviewer_name = interviewerName;
    }

    if (newStatus === "offer") {
      if (salaryOffered) data.salary_offered = parseFloat(salaryOffered);
      data.salary_currency = salaryCurrency;
      if (offerDeadline) data.offer_deadline = offerDeadline.toISOString();
    }

    if (newStatus === "rejected") {
      if (rejectionStage) data.rejection_stage = rejectionStage;
      if (rejectionReason) data.rejection_reason = rejectionReason;
    }

    onSave(data);
    reset();
    onClose();
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const needsDialog = ["recruiter_screen", "phone_interview", "onsite_interview", "offer", "rejected"].includes(newStatus);
  if (!needsDialog) return null;

  const isInterview = ["recruiter_screen", "phone_interview", "onsite_interview"].includes(newStatus);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {newStatus === "rejected" ? "Application Rejected" : `${STATUS_LABELS[newStatus] || newStatus}`}
          </DialogTitle>
          <DialogDescription>{jobTitle} at {company}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Interview fields */}
          {isInterview && (
            <>
              {newStatus !== "recruiter_screen" && (
                <div className="space-y-2">
                  <Label>Interview Type</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {INTERVIEW_TYPES.map((t) => (
                      <Button
                        key={t.value}
                        type="button"
                        variant={interviewType === t.value ? "default" : "outline"}
                        size="sm"
                        className="gap-1.5"
                        onClick={() => setInterviewType(t.value)}
                      >
                        <t.icon className="h-4 w-4" />
                        {t.label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>When is it scheduled?</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !scheduledDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {scheduledDate ? format(scheduledDate, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={scheduledDate} onSelect={setScheduledDate} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Who are you meeting with? (optional)</Label>
                <Input placeholder="e.g. Sarah from Engineering" value={interviewerName} onChange={(e) => setInterviewerName(e.target.value)} />
              </div>
            </>
          )}

          {/* Offer fields */}
          {newStatus === "offer" && (
            <>
              <div className="space-y-2">
                <Label>Salary Offered</Label>
                <div className="flex gap-2">
                  <Select value={salaryCurrency} onValueChange={setSalaryCurrency}>
                    <SelectTrigger className="w-[90px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["USD", "EUR", "GBP", "CAD", "AUD"].map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="relative flex-1">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input type="number" placeholder="e.g. 120000" value={salaryOffered} onChange={(e) => setSalaryOffered(e.target.value)} className="pl-9" />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Response Deadline</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !offerDeadline && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {offerDeadline ? format(offerDeadline, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={offerDeadline} onSelect={setOfferDeadline} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
            </>
          )}

          {/* Rejection fields */}
          {newStatus === "rejected" && (
            <>
              <div className="space-y-2">
                <Label>At what stage were you rejected?</Label>
                <Select value={rejectionStage} onValueChange={setRejectionStage}>
                  <SelectTrigger><SelectValue placeholder="Select stage" /></SelectTrigger>
                  <SelectContent>
                    {REJECTION_STAGES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Reason given (optional)</Label>
                <Textarea placeholder="e.g. They went with a more experienced candidate..." value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} rows={3} />
              </div>
            </>
          )}

          <div className="flex gap-3 pt-2">
            <Button onClick={handleSave} className="flex-1">Save Details</Button>
            <Button variant="outline" onClick={handleClose} className="flex-1">Skip</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default StatusUpdateDialog;
