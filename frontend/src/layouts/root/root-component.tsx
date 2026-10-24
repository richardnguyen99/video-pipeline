import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { Outlet, useRouterState } from "@tanstack/react-router";

import { AuthStoreSync } from "@/layouts/auth/auth-store-sync";
import Footer from "@/layouts/root/footer";
import Header from "@/layouts/root/site-header";

function isStudioPath(pathname: string): boolean {
  return pathname === "/studio" || pathname.startsWith("/studio/");
}

export default function RootComponent() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const hideChrome = isStudioPath(pathname);

  return (
    <>
      <AuthStoreSync />

      {hideChrome ? null : <Header />}

      <Outlet />

      {hideChrome ? null : <Footer />}

      {import.meta.env.DEV ? <ReactQueryDevtools buttonPosition="bottom-left" /> : null}
    </>
  );
}
