import { useSuspenseQuery } from "@tanstack/react-query";

import { BioForm } from "@/layouts/user-profile/profile/bio-form";
import { IdentityCard } from "@/layouts/user-profile/profile/identity-card";
import type { UserProfile } from "@/libs/auth";
import type { PublicUserProfile } from "@/queries/user-profile";
import { publicUserBioQueryOptions } from "@/queries/user-bio";

type PanelBodyProps = {
  profile: PublicUserProfile;
  isOwner: boolean;
  authUser?: UserProfile | null;
};

function initialsFromName(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function PanelBody({ profile, isOwner, authUser }: PanelBodyProps) {
  const { data: bio } = useSuspenseQuery(publicUserBioQueryOptions(profile.username));
  const username = profile.username;
  const fullName = bio.full_name ?? (isOwner ? authUser?.display_name : null) ?? profile.display_name;
  const initials = initialsFromName(fullName || username);

  return (
    <div className="flex flex-col gap-4">
      <IdentityCard bio={bio} username={username} fullName={fullName || ""} initials={initials} />

      {isOwner ? <BioForm key={`${username}-${bio.updated_at ?? "empty"}`} bio={bio} username={username} /> : null}
    </div>
  );
}
