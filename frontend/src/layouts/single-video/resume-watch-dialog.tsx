import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatPlayerTime } from "@/layouts/single-video/player/format-time";

type ResumeWatchDialogProps = {
  open: boolean;
  positionSeconds: number;
  onResume: () => void;
  onStartOver: () => void;
  onOpenChange: (open: boolean) => void;
};

export function ResumeWatchDialog({
  open,
  positionSeconds,
  onResume,
  onStartOver,
  onOpenChange,
}: ResumeWatchDialogProps) {
  const timeLabel = formatPlayerTime(positionSeconds);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader className="border-0 px-5 pt-5 pb-0">
          <DialogTitle>Resume watching?</DialogTitle>
        </DialogHeader>

        <div className="px-5 py-3">
          <DialogDescription>
            You left off at <span className="font-medium text-foreground">{timeLabel}</span>. Continue from there or
            start over from the beginning.
          </DialogDescription>
        </div>

        <DialogFooter className="gap-2 border-0 px-5 pb-5">
          <Button type="button" variant="outline" onClick={onStartOver}>
            Start over
          </Button>

          <Button type="button" onClick={onResume}>
            Resume
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
