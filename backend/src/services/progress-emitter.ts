// Simple typed event emitter for extraction progress
type ProgressListener = (data: ProgressEvent) => void;

export interface ProgressEvent {
  type: "progress" | "recipe_found" | "page_skipped" | "error" | "completed" | "paused" | "cost_update";
  jobId: string;
  cookbookId: string;
  data: Record<string, unknown>;
  timestamp: number;
}

class ProgressEmitter {
  private listeners = new Map<string, Set<ProgressListener>>();

  // Subscribe to progress for a specific job
  subscribe(jobId: string, listener: ProgressListener): () => void {
    if (!this.listeners.has(jobId)) {
      this.listeners.set(jobId, new Set());
    }
    this.listeners.get(jobId)!.add(listener);
    // Return unsubscribe function
    return () => {
      this.listeners.get(jobId)?.delete(listener);
      if (this.listeners.get(jobId)?.size === 0) {
        this.listeners.delete(jobId);
      }
    };
  }

  // Emit progress event
  emit(event: ProgressEvent): void {
    const listeners = this.listeners.get(event.jobId);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(event);
        } catch (e) {
          console.error("[SSE] Listener error:", e);
        }
      }
    }
  }

  // Check if anyone is listening
  hasListeners(jobId: string): boolean {
    return (this.listeners.get(jobId)?.size ?? 0) > 0;
  }
}

export const progressEmitter = new ProgressEmitter();
