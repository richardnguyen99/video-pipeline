import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, X } from "lucide-react";

import {
  actressMultiFilterConfig,
  directorMultiFilterConfig,
  genreMultiFilterConfig,
  labelMultiFilterConfig,
  makerMultiFilterConfig,
  seriesMultiFilterConfig,
} from "@/components/entity-multi-filter/configs";
import { EntityMultiFilter } from "@/components/entity-multi-filter/index";
import type { EntityMultiFilterConfig } from "@/components/entity-multi-filter/index";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { SettingsCard } from "@/layouts/user-profile/settings-shell";
import { getApiErrorMessage } from "@/libs/auth";
import {
  clearContentPreferences,
  contentPreferenceQueryKeys,
  myContentPreferencesQueryOptions,
  removeContentPreference,
  upsertContentPreference,
} from "@/queries/content-preference";
import type {
  ContentPreferenceCreateRequest,
  ContentPreferenceItem,
  ContentPreferenceListResponse,
  PreferenceEntityType,
  PreferencePolarity,
} from "@/queries/content-preference";

const ENTITY_SECTIONS = [
  {
    type: "actress" as const,
    label: "Actresses",
    config: actressMultiFilterConfig,
  },
  {
    type: "maker" as const,
    label: "Makers",
    config: makerMultiFilterConfig,
  },
  {
    type: "genre" as const,
    label: "Genres",
    config: genreMultiFilterConfig,
  },
  {
    type: "series" as const,
    label: "Series",
    config: seriesMultiFilterConfig,
  },
  {
    type: "label" as const,
    label: "Labels",
    config: labelMultiFilterConfig,
  },
  {
    type: "director" as const,
    label: "Directors",
    config: directorMultiFilterConfig,
  },
] as const;

type PreferenceSectionProps = {
  polarity: PreferencePolarity;
  title: string;
  description: string;
  items: Array<ContentPreferenceItem>;
};

function PreferenceSection({ polarity, title, description, items }: PreferenceSectionProps) {
  const queryClient = useQueryClient();

  const upsertMutation = useMutation({
    mutationFn: (payload: ContentPreferenceCreateRequest) => upsertContentPreference(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: contentPreferenceQueryKeys.me(),
      });
    },
    onError: (error) => {
      toast.add({
        type: "error",
        title: "Could not save preference",
        description: getApiErrorMessage(error),
        timeout: 4000,
      });
    },
  });

  const removeMutation = useMutation({
    mutationFn: ({ entityType, entityId }: { entityType: PreferenceEntityType; entityId: number }) =>
      removeContentPreference(entityType, entityId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: contentPreferenceQueryKeys.me(),
      });
    },
    onError: (error) => {
      toast.add({
        type: "error",
        title: "Could not remove preference",
        description: getApiErrorMessage(error),
        timeout: 4000,
      });
    },
  });

  const clearMutation = useMutation({
    mutationFn: () => clearContentPreferences(polarity),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: contentPreferenceQueryKeys.me(),
      });
      toast.add({
        type: "success",
        title: `${title} cleared`,
        timeout: 3000,
      });
    },
    onError: (error) => {
      toast.add({
        type: "error",
        title: "Could not clear preferences",
        description: getApiErrorMessage(error),
        timeout: 4000,
      });
    },
  });

  const byType = useMemo(() => {
    const map = new Map<PreferenceEntityType, Array<ContentPreferenceItem>>();

    for (const section of ENTITY_SECTIONS) {
      map.set(section.type, []);
    }

    for (const item of items) {
      const list = map.get(item.entity_type);

      if (list != null) {
        list.push(item);
      }
    }

    return map;
  }, [items]);

  const pending = upsertMutation.isPending || removeMutation.isPending || clearMutation.isPending;

  return (
    <SettingsCard
      title={title}
      description={description}
      action={
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={items.length === 0 || pending}
          onClick={() => {
            clearMutation.mutate();
          }}
        >
          {clearMutation.isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Clearing…
            </>
          ) : (
            "Clear all"
          )}
        </Button>
      }
    >
      <div className="flex flex-col gap-6">
        {ENTITY_SECTIONS.map((section) => {
          const sectionItems = byType.get(section.type) ?? [];
          const selectedIds = sectionItems.map((item) => item.entity_id);

          return (
            <div key={section.type} className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">{section.label}</p>

                <EntityMultiFilter
                  selected={selectedIds}
                  config={section.config as unknown as EntityMultiFilterConfig}
                  onChange={(nextIds) => {
                    const added = nextIds.filter((id) => !selectedIds.includes(id));
                    const removed = selectedIds.filter((id) => !nextIds.includes(id));

                    for (const entityId of added) {
                      upsertMutation.mutate({
                        polarity,
                        entity_type: section.type,
                        entity_id: entityId,
                      });
                    }

                    for (const entityId of removed) {
                      removeMutation.mutate({
                        entityType: section.type,
                        entityId,
                      });
                    }
                  }}
                />
              </div>

              {sectionItems.length > 0 ? (
                <div className="flex flex-wrap gap-2" aria-label={`${title} ${section.label}`}>
                  {sectionItems.map((item) => (
                    <Badge key={item.id} variant="secondary" className="gap-1 pr-1">
                      {item.entity_name ?? `${section.type} #${item.entity_id}`}

                      <button
                        type="button"
                        className="rounded-full p-0.5 hover:bg-muted"
                        aria-label={`Remove ${item.entity_name ?? item.entity_id}`}
                        disabled={pending}
                        onClick={() => {
                          removeMutation.mutate({
                            entityType: item.entity_type,
                            entityId: item.entity_id,
                          });
                        }}
                      >
                        <X className="size-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No {section.label.toLowerCase()} selected.</p>
              )}
            </div>
          );
        })}
      </div>
    </SettingsCard>
  );
}

type ContentPreferencePanelProps = {
  initialPreferences?: ContentPreferenceListResponse | null;
};

export function ContentPreferencePanel({ initialPreferences = null }: ContentPreferencePanelProps) {
  const { data, isError, error } = useQuery({
    ...myContentPreferencesQueryOptions(),
    ...(initialPreferences != null ? { initialData: initialPreferences } : {}),
  });

  if (!data) {
    if (isError) {
      return (
        <p className="text-sm text-destructive" role="alert">
          {getApiErrorMessage(error)}
        </p>
      );
    }

    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Loading preferences…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PreferenceSection
        polarity="interest"
        title="Interests"
        description="Entities you enjoy. Recommendations and discovery can favor actresses, makers, genres, series, labels, and directors you add here."
        items={data.interests}
      />

      <PreferenceSection
        polarity="dislike"
        title="Dislikes"
        description="Entities you would rather see less often. These can be used to de-prioritize or filter matching videos."
        items={data.dislikes}
      />
    </div>
  );
}
