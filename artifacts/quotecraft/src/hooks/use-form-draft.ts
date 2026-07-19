import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";

interface UseFormDraftOptions<T> {
  /** Whether the form is currently visible/active (pass `open` for dialogs). */
  active?: boolean;
  /** The current form state to persist. */
  data: T;
  /** When true for the current data, the draft is removed instead of saved. */
  isEmpty?: (data: T) => boolean;
  /** Called with the saved draft (if any) when the form becomes active. */
  onRestore: (draft: T) => void;
  /**
   * Freshness guard: drafts saved before this time (ms epoch) are discarded
   * instead of restored. Pass the server record's updatedAt so a stale local
   * draft never overrides fresher server data.
   */
  ignoreBefore?: number;
}

interface DraftEnvelope<T> {
  v: 1;
  savedAt: number;
  data: T;
}

/**
 * Universal draft autosave (Bug #22). Persists form state to localStorage
 * (debounced) while the form is active, restores it — with a "Draft restored"
 * toast — when the form is next opened, and exposes clearDraft() for
 * submit/cancel/discard.
 */
export function useFormDraft<T>(
  key: string,
  { active = true, data, isEmpty, onRestore, ignoreBefore = 0 }: UseFormDraftOptions<T>,
): { clearDraft: () => void } {
  const json = JSON.stringify(data);

  const restoredRef = useRef(false);
  // Suppress autosave until the restore pass has completed (and briefly after
  // clearDraft so a pending debounce doesn't resurrect a cleared draft).
  const suppressRef = useRef(true);

  const dataRef = useRef(data);
  dataRef.current = data;
  const isEmptyRef = useRef(isEmpty);
  isEmptyRef.current = isEmpty;
  const onRestoreRef = useRef(onRestore);
  onRestoreRef.current = onRestore;
  const ignoreBeforeRef = useRef(ignoreBefore);
  ignoreBeforeRef.current = ignoreBefore;

  // Restore once each time the form becomes active.
  useEffect(() => {
    if (!active) {
      restoredRef.current = false;
      suppressRef.current = true;
      return;
    }
    if (restoredRef.current) return;
    restoredRef.current = true;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as DraftEnvelope<T>;
        if (
          parsed?.v === 1 &&
          typeof parsed.savedAt === "number" &&
          parsed.savedAt >= ignoreBeforeRef.current
        ) {
          onRestoreRef.current(parsed.data);
          toast.info("Draft restored");
        } else {
          // Stale (older than the server record) or unrecognized — discard.
          localStorage.removeItem(key);
        }
      }
    } catch {
      // Corrupt or inaccessible draft — start fresh.
      try {
        localStorage.removeItem(key);
      } catch {
        /* ignore */
      }
    }
    suppressRef.current = false;
  }, [active, key]);

  // Debounced autosave whenever the (serialized) form state changes.
  useEffect(() => {
    if (!active || suppressRef.current) return;
    const t = setTimeout(() => {
      if (suppressRef.current) return;
      try {
        if (isEmptyRef.current?.(dataRef.current)) {
          localStorage.removeItem(key);
        } else {
          const envelope: DraftEnvelope<T> = {
            v: 1,
            savedAt: Date.now(),
            data: dataRef.current,
          };
          localStorage.setItem(key, JSON.stringify(envelope));
        }
      } catch {
        /* storage full/unavailable — drafts are best-effort */
      }
    }, 400);
    return () => clearTimeout(t);
  }, [active, key, json]);

  const clearDraft = useCallback(() => {
    suppressRef.current = true;
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
    // Re-enable autosave for subsequent user edits.
    window.setTimeout(() => {
      if (restoredRef.current) suppressRef.current = false;
    }, 600);
  }, [key]);

  return { clearDraft };
}
