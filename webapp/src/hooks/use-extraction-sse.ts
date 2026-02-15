import { useEffect, useRef, useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { resolveBackendUrl } from "@/lib/api";

interface UseExtractionSSEOptions {
  jobId: string | undefined;
  cookbookId: string;
  enabled: boolean;
}

export function useExtractionSSE({ jobId, cookbookId, enabled }: UseExtractionSSEOptions) {
  const queryClient = useQueryClient();
  const eventSourceRef = useRef<EventSource | null>(null);
  const [liveRecipes, setLiveRecipes] = useState<Array<{ title: string; page: number }>>([]);
  const [costData, setCostData] = useState<Record<string, unknown> | null>(null);
  const [connected, setConnected] = useState(false);

  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setConnected(false);
  }, []);

  useEffect(() => {
    if (!enabled || !jobId) {
      cleanup();
      return;
    }

    // Get auth token from localStorage
    const sessionStr = localStorage.getItem("optirecipe_session");
    let token = "";
    try {
      const session = sessionStr ? JSON.parse(sessionStr) : null;
      token = session?.session?.token || "";
    } catch {
      // Ignore parse errors
    }

    if (!token) return;

    // Construct SSE URL using the resolved backend URL
    const backendUrl = resolveBackendUrl();
    const url = `${backendUrl}/api/processing/stream/${jobId}?token=${encodeURIComponent(token)}`;

    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.addEventListener("connected", () => {
      setConnected(true);
    });

    eventSource.addEventListener("recipe_found", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        setLiveRecipes(prev => [...prev.slice(-50), { title: data.title, page: data.page }]);
        // Invalidate cookbook query to refresh recipe list
        queryClient.invalidateQueries({ queryKey: ["cookbook", cookbookId] });
      } catch {
        // Ignore parse errors
      }
    });

    eventSource.addEventListener("progress", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        // Update the cookbook query cache directly for instant progress updates
        queryClient.setQueryData(["cookbook", cookbookId], (old: unknown) => {
          if (!old || typeof old !== "object") return old;
          return {
            ...(old as Record<string, unknown>),
            processedPages: data.currentPage,
            totalRecipesFound: data.recipesExtracted,
          };
        });
      } catch {
        // Ignore parse errors
      }
    });

    eventSource.addEventListener("page_skipped", () => {
      // Just a notification, no action needed
    });

    eventSource.addEventListener("cost_update", (e: MessageEvent) => {
      try {
        setCostData(JSON.parse(e.data));
      } catch {
        // Ignore parse errors
      }
    });

    eventSource.addEventListener("completed", () => {
      queryClient.invalidateQueries({ queryKey: ["cookbook", cookbookId] });
      cleanup();
    });

    eventSource.addEventListener("paused", () => {
      queryClient.invalidateQueries({ queryKey: ["cookbook", cookbookId] });
    });

    eventSource.addEventListener("error", () => {
      // SSE error event - fall back to polling (no action needed, polling still runs)
    });

    eventSource.onerror = () => {
      // Connection lost - cleanup, polling will take over
      cleanup();
    };

    return cleanup;
  }, [enabled, jobId, cookbookId, cleanup, queryClient]);

  return { liveRecipes, costData, connected, cleanup };
}
