import { Suspense } from "react";

import { BioFallback } from "@/layouts/user-profile/profile/bio-fallback";
import { PanelBody } from "@/layouts/user-profile/profile/panel-body";
import type { UserProfile } from "@/libs/auth";
import type { PublicUserProfile } from "@/queries/user-profile";

type PanelProps = {
  profile: PublicUserProfile;
  isOwner: boolean;
  authUser?: UserProfile | null;
};

export function Panel(props: PanelProps) {
  return (
    <Suspense fallback={<BioFallback />}>
      <PanelBody {...props} />
    </Suspense>
  );
}
