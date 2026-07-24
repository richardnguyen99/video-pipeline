import { createFileRoute } from "@tanstack/react-router";

import HeroSection from "@/layouts/home/hero-section";
import GenreSection from "@/layouts/home/genre-section";

export const Route = createFileRoute("/")({ component: App });

function App() {
  return (
    <>
      <HeroSection />
      <GenreSection />
    </>
  );
}
