import { useEffect, useRef } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";

import { resolveAuth } from "@/libs/resolve-auth";

const GUEST_PATHS = new Set(["/sign-in", "/register"]);

/**
 * After hydration / hard reload, revalidate the session cookie and
 * enforce guest vs protected routes when layout ``beforeLoad`` did not
 * re-run on the client.
 */
export function AuthSessionSync() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const lastHandled = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function sync() {
      if (lastHandled.current === pathname) {
        return;
      }

      const auth = await resolveAuth();

      if (cancelled) {
        return;
      }

      lastHandled.current = pathname;

      if (auth.isAuthenticated && GUEST_PATHS.has(pathname)) {
        void navigate({ to: "/", replace: true });

        return;
      }

      if (!auth.isAuthenticated && pathname.startsWith("/account")) {
        void navigate({
          to: "/sign-in",
          search: { redirect: pathname },
          replace: true,
        });
      }
    }

    void sync();

    return () => {
      cancelled = true;
    };
  }, [pathname, navigate]);

  return null;
}
