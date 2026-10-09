import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { PlaylistsPage } from "@/layouts/user-profile/playlists";
import { useResolvedOwner } from "@/layouts/user-profile/use-user-settings";
import { useAuthStore } from "@/stores/auth-store";

const playlistsSearchSchema = z.object({
  visibility: z.enum(["all", "public", "restricted", "private"]).optional().catch(undefined),
  ownership: z.enum(["all", "mine", "others"]).optional().catch(undefined),
  sort: z.enum(["created", "videos"]).optional().catch(undefined),
});

export type PlaylistsSearchParams = z.infer<typeof playlistsSearchSchema>;

export const Route = createFileRoute("/u/$username/playlists/")({
  validateSearch: playlistsSearchSchema,
  component: UserPlaylistsRoute,
});

function UserPlaylistsRoute() {
  const { username } = Route.useParams();
  const search = Route.useSearch();
  const { isOwner } = useResolvedOwner(username);
  const accessToken = useAuthStore((state) => state.accessToken);
  const isRestoring = useAuthStore((state) => state.isRestoring);

  const enabled = isOwner ? !isRestoring && accessToken != null && accessToken.length > 0 : !isRestoring;

  return (
    <PlaylistsPage
      enabled={enabled}
      isOwner={isOwner}
      username={username}
      visibility={search.visibility ?? "all"}
      ownership={search.ownership ?? "all"}
      sort={search.sort ?? "created"}
    />
  );
}
