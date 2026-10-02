import { Link } from "@tanstack/react-router";
import {
  Bell,
  CircleUserRound,
  Film,
  FolderKanban,
  LockKeyhole,
  Moon,
  ShieldCheck,
  UserRound,
  UsersRound,
} from "lucide-react";

import { cn } from "@/libs/utils";

export type SettingsNavKey =
  | "profile"
  | "videos"
  | "subscriptions"
  | "security"
  | "content-preference"
  | "notifications"
  | "privacy"
  | "blocked-accounts"
  | "deactivate";

type NavItem = {
  key: SettingsNavKey;
  label: string;
  icon: typeof CircleUserRound;
  ownerOnly?: boolean;
  danger?: boolean;
};

const NAV_ITEMS: Array<NavItem> = [
  { key: "profile", label: "Profile", icon: CircleUserRound },
  { key: "videos", label: "Videos", icon: Film },
  { key: "subscriptions", label: "Subscriptions", icon: UsersRound },
  { key: "security", label: "Security", icon: LockKeyhole, ownerOnly: true },
  {
    key: "content-preference",
    label: "Content preference",
    icon: FolderKanban,
    ownerOnly: true,
  },
  {
    key: "notifications",
    label: "Notifications",
    icon: Bell,
    ownerOnly: true,
  },
  { key: "privacy", label: "Privacy", icon: ShieldCheck, ownerOnly: true },
  {
    key: "blocked-accounts",
    label: "Blocked accounts",
    icon: UserRound,
    ownerOnly: true,
  },
];

type SettingsNavProps = {
  username: string;
  active: SettingsNavKey;
  isOwner: boolean;
};

export function SettingsNav({ username, active, isOwner }: SettingsNavProps) {
  const items = NAV_ITEMS.filter((item) => isOwner || !item.ownerOnly);

  return (
    <aside className="flex w-full flex-col gap-6 lg:w-56 lg:shrink-0">
      <div className="flex flex-col gap-1">
        <p className="px-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {isOwner ? "Account" : "Profile"}
        </p>

        <nav className="flex flex-col gap-0.5" aria-label="Account sections">
          {items.map((item) => {
            const Icon = item.icon;
            const selected = active === item.key;

            return (
              <Link
                key={item.key}
                to={
                  (
                    {
                      profile: "/u/$username",
                      videos: "/u/$username/videos",
                      subscriptions: "/u/$username/subscriptions",
                      security: "/u/$username/security",
                      "content-preference": "/u/$username/content-preference",
                      notifications: "/u/$username/notifications",
                      privacy: "/u/$username/privacy",
                      "blocked-accounts": "/u/$username/blocked-accounts",
                      deactivate: "/u/$username/deactivate",
                    } as const
                  )[item.key]
                }
                params={{ username }}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                  selected
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden />

                <span className="flex-1 truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {isOwner ? (
        <div className="flex flex-col gap-1">
          <p className="px-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">Danger zone</p>

          <Link
            to="/u/$username/deactivate"
            params={{ username }}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
              active === "deactivate"
                ? "bg-destructive/10 text-destructive"
                : "text-destructive/90 hover:bg-destructive/10",
            )}
          >
            <Moon className="size-4 shrink-0" aria-hidden />

            <span>Deactivate account</span>
          </Link>
        </div>
      ) : null}
    </aside>
  );
}
