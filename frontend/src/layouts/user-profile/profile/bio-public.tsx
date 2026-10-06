import { SettingsCard } from "@/layouts/user-profile/settings-shell";
import { resolveCountryDisplay } from "@/libs/country";
import type { UserBio } from "@/queries/user-bio";

type BioPublicProps = {
  bio: UserBio;
};

export function BioPublic({ bio }: BioPublicProps) {
  const rows: Array<{ label: string; value: string }> = [];

  if (bio.full_name) {
    rows.push({ label: "Full name", value: bio.full_name });
  }

  if (bio.date_of_birth) {
    rows.push({ label: "Date of birth", value: bio.date_of_birth });
  }

  if (bio.country) {
    rows.push({
      label: "Country",
      value: resolveCountryDisplay(bio.country) ?? bio.country,
    });
  }

  if (bio.gender) {
    rows.push({ label: "Gender", value: bio.gender });
  }

  if (bio.link) {
    rows.push({ label: "Link", value: bio.link });
  }

  const hasContent = rows.length > 0 || Boolean(bio.biography);

  if (!hasContent) {
    return (
      <div className="rounded-xl border border-border/60 bg-card/40 p-5">
        <p className="text-sm font-medium">Public profile</p>

        <p className="mt-1 text-sm text-muted-foreground">This user has not shared a biography yet.</p>
      </div>
    );
  }

  return (
    <SettingsCard title="Biography" description="Public information this user has chosen to share.">
      <div className="flex flex-col gap-4">
        {rows.length > 0 ? (
          <dl className="grid gap-3 sm:grid-cols-2">
            {rows.map((row) => (
              <div key={row.label} className="flex flex-col gap-0.5">
                <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{row.label}</dt>

                <dd className="text-sm">
                  {row.label === "Link" ? (
                    <a
                      href={row.value}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {row.value}
                    </a>
                  ) : (
                    row.value
                  )}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}

        {bio.biography ? <p className="text-sm text-foreground/90">{bio.biography.replace(/[\r\n]+/g, " ")}</p> : null}
      </div>
    </SettingsCard>
  );
}
