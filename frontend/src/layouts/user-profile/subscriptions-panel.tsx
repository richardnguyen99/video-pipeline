import { Button } from "@/components/ui/button";
import { SettingsCard } from "@/layouts/user-profile/settings-shell";
import type { FollowedCreator } from "@/queries/user-profile";

type SubscriptionsPanelProps = {
  creators: Array<FollowedCreator>;
  isOwner: boolean;
};

export function SubscriptionsPanel({ creators, isOwner }: SubscriptionsPanelProps) {
  return (
    <SettingsCard
      title="Followed creators"
      description="Keep up with creators and actresses you do not want to miss."
      action={
        isOwner ? (
          <Button type="button" size="sm">
            Manage
          </Button>
        ) : null
      }
    >
      <div className="flex flex-col gap-1">
        {creators.map((creator) => (
          <div key={creator.id} className="flex items-center gap-3 rounded-lg px-1 py-2">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
              {creator.initials}
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{creator.name}</p>

              <p className="text-xs text-muted-foreground">
                {creator.role} · {isOwner ? "Following" : "Public profile"}
              </p>
            </div>

            <Button type="button" variant="outline" size="sm">
              View profile
            </Button>
          </div>
        ))}
      </div>
    </SettingsCard>
  );
}
