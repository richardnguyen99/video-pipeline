import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/videos")({
  component: VideoLayout,
});

function VideoLayout() {
  return (
    <div className="min-h-screen pt-16">
      <Outlet />
    </div>
  );
}
