import { QueryClientProvider, dehydrate, hydrate } from "@tanstack/react-query";
import { createRouter as createTanStackRouter } from "@tanstack/react-router";

import { NotFoundPage } from "@/components/not-found/not-found-page";
import type { UserProfile } from "@/libs/auth";
import { readIdentityUsername } from "@/libs/auth-identity-cookie";
import { createQueryClient } from "@/libs/query-client";
import { parseSearch, stringifySearch } from "@/libs/search-params";
import { authMeQueryOptions } from "@/queries/auth";
import { useAuthStore } from "@/stores/auth-store";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  const queryClient = createQueryClient();

  const router = createTanStackRouter({
    routeTree,
    context: {
      queryClient,
      auth: {
        isAuthenticated: false,
        user: null,
        isReady: false,
      },
    },
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    defaultNotFoundComponent: NotFoundPage,
    parseSearch,
    stringifySearch,

    dehydrate: () => {
      return {
        queryClientState: dehydrate(queryClient),
      };
    },
    hydrate: (dehydrated) => {
      if (dehydrated?.queryClientState != null) {
        hydrate(queryClient, dehydrated.queryClientState);

        const ssrUser = queryClient.getQueryData<UserProfile | null>(authMeQueryOptions.queryKey);

        if (ssrUser != null) {
          useAuthStore.getState().setUser(ssrUser);
          useAuthStore.getState().setRestoring(false);

          return;
        }
      }

      const identityUsername = readIdentityUsername();

      if (identityUsername != null && identityUsername.length > 0) {
        useAuthStore.getState().setUser({
          id: "",
          username: identityUsername,
          email: "",
          display_name: null,
          is_active: true,
          email_verified: false,
          created_at: "",
          updated_at: "",
        });
        useAuthStore.getState().setRestoring(true);

        return;
      }

      useAuthStore.getState().setRestoring(true);
    },
    Wrap: ({ children }) => {
      return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    },
  });

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
