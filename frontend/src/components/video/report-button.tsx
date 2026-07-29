import { Flag } from "lucide-react";

import { VideoActionButton } from "./video-action-button";
import type { ReportReason } from "./report-dialog";
import { ReportDialog } from "./report-dialog";

export type { ReportReason };

interface ReportButtonProps {
  onClick: () => void;
  className?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  step: 1 | 2;
  reason: ReportReason | null;
  onSelectReason: (reason: ReportReason) => void;
  onBack: () => void;
}

export function ReportButton({
  onClick,
  className,
  open,
  onOpenChange,
  step,
  reason,
  onSelectReason,
  onBack,
}: ReportButtonProps) {
  return (
    <>
      <VideoActionButton tooltip="Report" className={className} onClick={onClick}>
        <Flag className="size-4" />
        <span>Report</span>
      </VideoActionButton>

      <ReportDialog
        open={open}
        onOpenChange={onOpenChange}
        step={step}
        reason={reason}
        onSelectReason={onSelectReason}
        onBack={onBack}
      />
    </>
  );
}
