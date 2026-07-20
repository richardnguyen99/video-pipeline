import { createFileRoute } from "@tanstack/react-router";

import HeroSection from "@/layout/home/hero-section";
import GenreSection from "@/layout/home/genre-section";

export const Route = createFileRoute("/")({ component: App });

function App() {
  return (
    <>
      <HeroSection />
      <GenreSection />
    </>
  );
}
