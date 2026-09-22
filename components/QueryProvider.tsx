"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * TanStack Query, scoped to the screen that needs it (D154).
 *
 * **Not in the root layout.** One screen caches on the client today; putting a
 * provider around the whole app would ship the library into every bundle,
 * including the static landing page and the store, which are deliberately
 * server-rendered and must stay that way.
 *
 * **The client is made inside `useState`**, which is the documented way to do
 * this in a React tree that can re-render: a client constructed in the render
 * body is a new cache on every render, so the first refetch throws the previous
 * one away and nothing is ever actually cached.
 */
export default function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // The roster does not change while somebody reads it, and this
            // screen is a long sitting of small corrections — so a minute of
            // staleness costs nothing and saves a refetch per keystroke of
            // navigation.
            staleTime: 60_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
