import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

interface PowIncludeModalProps {
  open: boolean;
  onClose: () => void;
  onInclude: () => void;
  onSkip: () => void;
  role: string;
}

const PowIncludeModal = ({ open, onClose, onInclude, onSkip, role }: PowIncludeModalProps) => {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-primary" />
            Include your proof of work?
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed pt-2">
            We noticed you completed a proof of work for <strong>{role}</strong>. Want to add it to your CV?
            It'll appear as a Projects section.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-3 pt-3">
          <Button onClick={onInclude} className="flex-1">Yes, include it</Button>
          <Button variant="outline" onClick={onSkip} className="flex-1">No thanks</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PowIncludeModal;
