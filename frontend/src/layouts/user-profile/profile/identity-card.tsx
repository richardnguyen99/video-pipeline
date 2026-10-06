import { AtSign, Link as LinkIcon } from "lucide-react";

import { resolveCountryDisplay } from "@/libs/country";
import type { UserBio } from "@/queries/user-bio";

type IdentityCardProps = {
  bio: UserBio;
  username: string;
  fullName: string;
  initials: string;
};

function ageFromDateOfBirth(dateOfBirth: string | null): number | null {
  if (dateOfBirth == null || dateOfBirth === "") {
    return null;
  }

  const birth = new Date(dateOfBirth);

  if (Number.isNaN(birth.getTime())) {
    return null;
  }

  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDelta = today.getMonth() - birth.getMonth();

  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }

  if (age < 0 || age > 150) {
    return null;
  }

  return age;
}

function buildMetaLine(bio: UserBio, username: string): string {
  const parts: Array<string> = [];
  const age = ageFromDateOfBirth(bio.date_of_birth);
  const demographics: Array<string> = [];

  if (age != null) {
    demographics.push(String(age));
  }

  if (bio.gender) {
    demographics.push(bio.gender);
  }

  if (demographics.length > 0) {
    parts.push(demographics.join(", "));
  }

  if (bio.country) {
    const countryLabel = resolveCountryDisplay(bio.country) ?? bio.country;
    parts.push(countryLabel);
  }

  if (parts.length === 0) {
    return username;
  }

  return `${username} · ${parts.join(" · ")}`;
}

export function IdentityCard({ bio, username, fullName, initials }: IdentityCardProps) {
  const metaLine = buildMetaLine(bio, username);

  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-card/40">
      <div className="relative h-28 bg-linear-to-r from-violet-700 via-fuchsia-600 to-amber-400">
        <span className="absolute bottom-3 left-4 text-[10px] font-medium tracking-[0.2em] text-white/80 uppercase">
          {fullName || username} · Velvet / 2026
        </span>
      </div>

      <div className="flex flex-wrap items-start gap-4 p-5">
        <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
          {initials || "U"}
        </div>

        <div className="min-w-0 flex-1 flex flex-col gap-1.5">
          {fullName ? <h3 className="text-base font-semibold tracking-tight">{fullName}</h3> : null}

          <p className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
            <AtSign className="size-3.5 shrink-0" aria-hidden />

            <span>{metaLine}</span>
          </p>

          {bio.link ? (
            <p className="flex flex-wrap items-center gap-1.5 text-sm">
              <LinkIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />

              <a
                href={bio.link}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate text-primary underline-offset-4 hover:underline"
              >
                {bio.link}
              </a>
            </p>
          ) : null}

          {bio.biography ? (
            <p className="mt-1 text-sm whitespace-pre-wrap text-foreground/90">{bio.biography}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
