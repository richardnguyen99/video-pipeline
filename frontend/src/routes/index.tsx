import { createFileRoute } from "@tanstack/react-router";

import HeroSection from "@/layouts/home/hero-section";
import CategorySection from "@/layouts/home/category-section";
import { MembershipBanner } from "@/layouts/home/membership-banner";

export const Route = createFileRoute("/")({ component: App });

function App() {
  return (
    <>
      <HeroSection />
      <CategorySection />
      <MembershipBanner />
    </>
  );
}
