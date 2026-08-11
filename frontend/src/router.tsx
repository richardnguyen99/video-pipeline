import { createRouter as createTanStackRouter } from "@tanstack/react-router";

import { parseSearch, stringifySearch } from "@/libs/search-params";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    parseSearch,
    stringifySearch,
  });

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
