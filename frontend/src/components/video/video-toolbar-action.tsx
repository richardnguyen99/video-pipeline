import { useState } from "react";

import { LikeDislikeButtons } from "./like-dislike-button";
import { MoreActionsMenu } from "./more-action-menu";
import { PlaylistSaveButton } from "./playlist-save-button";
import { ReportButton } from "./report-button";
import type { ReportReason } from "./report-button";
import { ShareButton } from "./share-button";

const IS_AUTHENTICATED = true;

export function VideoToolbarActions() {
  const [reportOpen, setReportOpen] = useState(false);
  const [reportStep, setReportStep] = useState<1 | 2>(1);
  const [reportReason, setReportReason] = useState<ReportReason | null>(null);

  const openReport = () => {
    setReportStep(1);
    setReportReason(null);
    setReportOpen(true);
  };
  return (
    <div className="flex items-center gap-2">
      <LikeDislikeButtons isAuthenticated={IS_AUTHENTICATED} />

      <div className="hidden items-center gap-2 md:flex">
        <PlaylistSaveButton isAuthenticated={IS_AUTHENTICATED} />
        <ShareButton />
        <ReportButton
          onClick={openReport}
          open={reportOpen}
          onOpenChange={setReportOpen}
          step={reportStep}
          reason={reportReason}
          onSelectReason={(r) => {
            setReportReason(r);
            if (r === "metadata") setReportStep(2);
            else setReportOpen(false);
          }}
          onBack={() => setReportStep(1)}
        />
      </div>

      <div className="md:hidden">
        <MoreActionsMenu isAuthenticated={IS_AUTHENTICATED} onReport={openReport} />
      </div>
    </div>
  );
}
