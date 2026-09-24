import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext } from "@tanstack/react-router";

import appCss from "../styles/styles.css?url";
import RootComponent from "@/components/root-component";
import { AuthPendingShell } from "@/components/auth/auth-pending-shell";
import RootDocument from "@/components/root-document";
import type { AuthRouterContext } from "@/libs/auth-session";
import { loadAuthSession } from "@/libs/auth-session";

export type { AuthRouterContext };

export type RouterAppContext = {
  queryClient: QueryClient;
  auth: AuthRouterContext;
};

export const Route = createRootRouteWithContext<RouterAppContext>()({
  beforeLoad: async ({ context }): Promise<{ auth: AuthRouterContext }> => {
    const auth = await loadAuthSession(context.queryClient);

    return { auth };
  },
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "TanStack Start Starter",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  pendingComponent: AuthPendingShell,
  shellComponent: RootDocument,
  component: RootComponent,
});
