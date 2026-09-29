import { QueryClientProvider, dehydrate, hydrate } from "@tanstack/react-query";
import { createRouter as createTanStackRouter } from "@tanstack/react-router";

import { NotFoundPage } from "@/components/not-found/not-found-page";
import { createQueryClient } from "@/libs/query-client";
import { parseSearch, stringifySearch } from "@/libs/search-params";
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

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    dehydrate: () => {
      return {
        queryClientState: dehydrate(queryClient),
      };
    },
    hydrate: (dehydrated) => {
      hydrate(queryClient, dehydrated.queryClientState);
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
