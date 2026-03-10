import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Lightbulb, ArrowRight } from "lucide-react";

interface PowReminderModalProps {
  open: boolean;
  onClose: () => void;
  onStartPoW: () => void;
  onContinue: () => void;
}

const PowReminderModal = ({ open, onClose, onStartPoW, onContinue }: PowReminderModalProps) => {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Lightbulb className="h-6 w-6 text-primary" />
            One thing before you tailor
          </DialogTitle>
          <DialogDescription className="text-base leading-relaxed pt-2">
            Students who build a proof of work before tailoring their CV get significantly better results.
            Your proof of work gives the AI more context — and gives you something real to add to your CV.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col sm:flex-row gap-3 pt-4">
          <Button onClick={onStartPoW} className="flex-1 gap-2">
            Start with proof of work first
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={onContinue} className="flex-1">
            Continue to CV tailoring
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PowReminderModal;
