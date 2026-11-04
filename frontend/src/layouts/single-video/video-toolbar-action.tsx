import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";

import { LikeDislikeButtons } from "./like-dislike-button";
import { MoreActionsMenu } from "./more-action-menu";
import { PlaylistSaveButton } from "./playlist-save-button";
import { ReportButton } from "./report-button";
import type { ReportReason } from "./report-button";
import { ShareButton } from "./share-button";

interface VideoToolbarActionsProps {
  videoId: number;
  likes?: number;
  dislikes?: number;
  publicId?: string | null;
  uploaderId?: string | null;
}

export function VideoToolbarActions({
  videoId,
  likes = 0,
  dislikes = 0,
  publicId = null,
  uploaderId = null,
}: VideoToolbarActionsProps) {
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = user != null;
  const isOwner =
    isAuthenticated && publicId != null && publicId.length > 0 && uploaderId != null && user.id === uploaderId;

  const [reportOpen, setReportOpen] = useState(false);
  const [reportStep, setReportStep] = useState<1 | 2>(1);
  const [reportReason, setReportReason] = useState<ReportReason | null>(null);
  const [playlistMobileOpen, setPlaylistMobileOpen] = useState(false);

  function openReport() {
    setReportStep(1);
    setReportReason(null);
    setReportOpen(true);
  }

  return (
    <div className="flex items-center gap-2">
      <LikeDislikeButtons videoId={videoId} likes={likes} dislikes={dislikes} />

      {isOwner ? (
        <Button
          nativeButton={false}
          variant="secondary"
          size="sm"
          className="h-9 gap-1.5 rounded-full px-3"
          render={<Link to="/studio/uploads/$uploadId" params={{ uploadId: publicId }} />}
        >
          <Upload className="size-3.5" aria-hidden />
          Manage upload
        </Button>
      ) : null}

      <div className="hidden items-center gap-2 md:flex">
        <PlaylistSaveButton videoId={videoId} isAuthenticated={isAuthenticated} />

        <ShareButton />

        <ReportButton
          onClick={openReport}
          open={reportOpen}
          onOpenChange={setReportOpen}
          step={reportStep}
          reason={reportReason}
          onSelectReason={(r) => {
            setReportReason(r);

            if (r === "metadata") {
              setReportStep(2);
            } else {
              setReportOpen(false);
            }
          }}
          onBack={() => setReportStep(1)}
        />
      </div>

      <div className="md:hidden">
        <MoreActionsMenu
          isAuthenticated={isAuthenticated}
          onReport={openReport}
          onSaveToPlaylist={() => setPlaylistMobileOpen(true)}
        />

        <PlaylistSaveButton
          videoId={videoId}
          isAuthenticated={isAuthenticated}
          mobileOpen={playlistMobileOpen}
          onMobileOpenChange={setPlaylistMobileOpen}
        />
      </div>
    </div>
  );
}
