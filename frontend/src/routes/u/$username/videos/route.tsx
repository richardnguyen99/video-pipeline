import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/u/$username/videos")({
  component: VideosLayout,
});

function VideosLayout() {
  return <Outlet />;
}
