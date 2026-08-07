import { useState } from "react";
import { Flag } from "lucide-react";

import { ActressReportDialog } from "@/components/actress/actress-report-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/libs/utils";

interface ActressReportButtonProps {
  className?: string;
}

export function ActressReportButton({ className }: ActressReportButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="destructive"
        size="sm"
        className={cn(className, "cursor-pointer")}
        onClick={() => setOpen(true)}
      >
        <Flag className="size-4" />
        Report
      </Button>
      <ActressReportDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
