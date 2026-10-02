import { ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SettingsCard } from "@/layouts/user-profile/settings-shell";
import type { PublicUserProfile } from "@/queries/user-profile";
import type { UserProfile } from "@/libs/auth";

type ProfilePanelProps = {
  profile: PublicUserProfile;
  isOwner: boolean;
  authUser?: UserProfile | null;
};

export function ProfilePanel({ profile, isOwner, authUser }: ProfilePanelProps) {
  const displayName = (isOwner ? authUser?.display_name : null) ?? profile.display_name;
  const username = profile.username;
  const initials = displayName
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-hidden rounded-xl border border-border/60 bg-card/40">
        <div className="relative h-28 bg-linear-to-r from-violet-700 via-fuchsia-600 to-amber-400">
          <span className="absolute bottom-3 left-4 text-[10px] font-medium tracking-[0.2em] text-white/80 uppercase">
            {displayName} · Velvet / 2026
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-4 p-5">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
            {initials || "U"}
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold tracking-tight">{displayName}</h3>

            <p className="text-sm text-muted-foreground">
              @{username}
              {profile.location ? (
                <>
                  {" "}
                  <span aria-hidden>·</span> {profile.location}
                </>
              ) : null}
            </p>

            {profile.creator_tag ? <p className="mt-1 text-xs text-primary">{profile.creator_tag}</p> : null}
          </div>

          <Button type="button" variant="outline" size="sm" disabled={!isOwner}>
            View profile
            <ChevronRight className="size-4" aria-hidden />
          </Button>
        </div>
      </div>

      {isOwner ? (
        <SettingsCard
          title="Profile details"
          description="Keep your public information current."
          action={
            <Button type="button" size="sm">
              Save changes
            </Button>
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="display-name">Display name</Label>

              <Input id="display-name" defaultValue={displayName} autoComplete="nickname" />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="username">Username</Label>

              <Input id="username" defaultValue={username} autoComplete="username" />
            </div>

            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label htmlFor="bio">Bio</Label>

              <textarea
                id="bio"
                defaultValue={profile.bio}
                rows={3}
                className="border-input bg-background placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex w-full rounded-lg border px-3 py-2 text-sm outline-none focus-visible:ring-3"
              />
            </div>
          </div>
        </SettingsCard>
      ) : (
        <div className="rounded-xl border border-border/60 bg-card/40 p-5">
          <p className="text-sm font-medium">Public profile</p>

          <p className="mt-1 text-sm text-muted-foreground">
            Private settings, email, and account details are hidden from guests.
          </p>
        </div>
      )}
    </div>
  );
}
