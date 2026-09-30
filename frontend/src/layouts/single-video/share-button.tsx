import { Share2 } from "lucide-react";

import { VideoActionButton } from "./video-action-button";

interface ShareButtonProps {
  className?: string;
}

export function ShareButton({ className }: ShareButtonProps) {
  function handleShare() {
    navigator.clipboard.writeText(window.location.href);
  }

  return (
    <VideoActionButton tooltip="Share" className={className} onClick={handleShare}>
      <Share2 className="size-4" />
      <span>Share</span>
    </VideoActionButton>
  );
}
