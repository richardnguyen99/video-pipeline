import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/u/$username/playlists")({
  component: PlaylistsLayout,
});

function PlaylistsLayout() {
  return <Outlet />;
}
