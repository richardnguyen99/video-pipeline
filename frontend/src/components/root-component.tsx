import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { Outlet } from "@tanstack/react-router";

import { AuthStoreSync } from "@/components/auth/auth-store-sync";
import Header from "@/components/site-header";

export default function RootComponent() {
  return (
    <>
      <AuthStoreSync />

      <Header />

      <Outlet />

      {import.meta.env.DEV ? <ReactQueryDevtools buttonPosition="bottom-left" /> : null}
    </>
  );
}
