import { useState } from "react";
import { format, addDays } from "date-fns";
import { CalendarIcon, CheckCircle2, Clock, Briefcase, Mail, Users, UserCheck, MoreHorizontal, Globe } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type Step = "ask" | "method" | "followup" | "done";

const APPLICATION_METHODS = [
  { value: "company_website", label: "Company Website", icon: Globe },
  { value: "linkedin", label: "LinkedIn Easy Apply", icon: Briefcase },
  { value: "email", label: "Email", icon: Mail },
  { value: "referral", label: "Referral", icon: Users },
  { value: "recruiter", label: "Recruiter", icon: UserCheck },
  { value: "other", label: "Other", icon: MoreHorizontal },
];

interface ApplicationTrackingModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: {
    status: string;
    applicationMethod?: string;
    appliedDate?: string;
    followUpDate?: string | null;
  }) => void;
  jobTitle: string;
  company: string;
}

const ApplicationTrackingModal = ({
  open,
  onClose,
  onSave,
  jobTitle,
  company,
}: ApplicationTrackingModalProps) => {
  const [step, setStep] = useState<Step>("ask");
  const [method, setMethod] = useState<string | null>(null);
  const [followUpDate, setFollowUpDate] = useState<Date | undefined>(addDays(new Date(), 14));

  const handleApplied = () => setStep("method");

  const handleSaveForLater = () => {
    onSave({ status: "preparing" });
    resetAndClose();
  };

  const handleMethodSelect = (m: string) => {
    setMethod(m);
    setStep("followup");
  };

  const handleFollowUpSave = (withReminder: boolean) => {
    onSave({
      status: "applied",
      applicationMethod: method!,
      appliedDate: new Date().toISOString(),
      followUpDate: withReminder && followUpDate ? followUpDate.toISOString() : null,
    });
    resetAndClose();
  };

  const resetAndClose = () => {
    setStep("ask");
    setMethod(null);
    setFollowUpDate(addDays(new Date(), 14));
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && resetAndClose()}>
      <DialogContent className="sm:max-w-md">
        {step === "ask" && (
          <>
            <DialogHeader>
              <DialogTitle>Did you apply for this job?</DialogTitle>
              <DialogDescription>
                {jobTitle} at {company}
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3 pt-2">
              <Button onClick={handleApplied} className="w-full gap-2">
                <CheckCircle2 className="h-4 w-4" /> Yes, I Applied ✓
              </Button>
              <Button variant="outline" onClick={handleSaveForLater} className="w-full gap-2">
                <Clock className="h-4 w-4" /> Save for Later 📋
              </Button>
            </div>
          </>
        )}

        {step === "method" && (
          <>
            <DialogHeader>
              <DialogTitle>How did you apply?</DialogTitle>
              <DialogDescription>Select the method you used to apply</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3 pt-2">
              {APPLICATION_METHODS.map((m) => (
                <Button
                  key={m.value}
                  variant="outline"
                  className="h-auto py-4 flex flex-col items-center gap-2"
                  onClick={() => handleMethodSelect(m.value)}
                >
                  <m.icon className="h-5 w-5 text-primary" />
                  <span className="text-xs">{m.label}</span>
                </Button>
              ))}
            </div>
          </>
        )}

        {step === "followup" && (
          <>
            <DialogHeader>
              <DialogTitle>Set a follow-up reminder?</DialogTitle>
              <DialogDescription>
                We'll remind you to follow up if you don't hear back
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !followUpDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {followUpDate ? format(followUpDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={followUpDate}
                    onSelect={setFollowUpDate}
                    disabled={(date) => date < new Date()}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
              <div className="flex gap-3">
                <Button onClick={() => handleFollowUpSave(true)} className="flex-1">
                  Set Reminder
                </Button>
                <Button variant="outline" onClick={() => handleFollowUpSave(false)} className="flex-1">
                  Skip
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ApplicationTrackingModal;
