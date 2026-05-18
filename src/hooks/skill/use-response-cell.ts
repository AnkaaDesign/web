// hooks/skill/use-response-cell.ts
//
// Per-cell autosave hook for the leader matrix. Manages local optimistic
// state for ONE response (entryId + topicId), debounces server writes, and
// preserves the user's intent across rapid clicks.
//
// Race-condition guard rails:
//   - Local state is canonical until the active (entryId, topicId) pair
//     changes. Server cache refreshes never overwrite local; only mount /
//     navigation between cells re-seeds from props.
//   - Debounced flush reads the LATEST values via a ref, so rapid clicks
//     coalesce into a single mutation with the user's final choice.
//   - If the user is still typing/clicking when an earlier flush is mid-
//     flight, a new flush is scheduled for the next idle window.

import { useCallback, useEffect, useRef, useState } from "react";
import { useBatchUpsertResponses } from "./use-assessment-entry";

const DEBOUNCE_MS = 350;

interface UseResponseCellOpts {
  entryId: string;
  topicId: string;
  savedScore: number | null;
  savedJustification: string;
  disabled?: boolean;
  onError?: (err: Error) => void;
}

interface UseResponseCellResult {
  score: number | null;
  justification: string;
  isSaving: boolean;
  isDirty: boolean;
  setScore: (next: number) => void;
  setJustification: (next: string) => void;
  flushNow: () => Promise<void>;
}

export function useResponseCell({
  entryId,
  topicId,
  savedScore,
  savedJustification,
  disabled,
  onError,
}: UseResponseCellOpts): UseResponseCellResult {
  const [score, setScoreState] = useState<number | null>(savedScore);
  const [justification, setJustificationState] = useState<string>(savedJustification);
  const [isDirty, setIsDirty] = useState(false);

  // Re-seed local state ONLY when the cell identity changes (different entry
  // or different topic). Saved-prop changes from cache refresh after a save
  // do NOT trigger a re-seed — local stays canonical so an in-flight click
  // can't be clobbered by an arriving server snapshot.
  useEffect(() => {
    setScoreState(savedScore);
    setJustificationState(savedJustification);
    setIsDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryId, topicId]);

  // Latest-value ref so the debounced timer reads the user's final intent
  // even when many setStates happen before it fires.
  const latestRef = useRef({ score, justification });
  useEffect(() => {
    latestRef.current = { score, justification };
  }, [score, justification]);

  const upsert = useBatchUpsertResponses(entryId);
  const upsertRef = useRef(upsert);
  upsertRef.current = upsert;

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflightRef = useRef(false);
  const trailingRef = useRef(false);

  const performFlush = useCallback(async () => {
    if (disabled) return;
    const { score: s, justification: j } = latestRef.current;
    if (s == null) return; // no score yet → nothing to persist
    if (inflightRef.current) {
      trailingRef.current = true; // re-flush after the in-flight one settles
      return;
    }
    inflightRef.current = true;
    try {
      await upsertRef.current.mutateAsync({
        responses: [
          {
            topicId,
            score: s,
            justification: j.trim() ? j.trim() : null,
          },
        ],
      });
      // If the user touched the cell again while we were saving, queue
      // another flush so the trailing edit reaches the server.
      const stillDirty =
        latestRef.current.score !== s || latestRef.current.justification !== j;
      if (!stillDirty) setIsDirty(false);
    } catch (err: any) {
      // Rollback local to last-known-saved values.
      setScoreState(savedScore);
      setJustificationState(savedJustification);
      setIsDirty(false);
      onError?.(err instanceof Error ? err : new Error(String(err)));
    } finally {
      inflightRef.current = false;
      if (trailingRef.current) {
        trailingRef.current = false;
        // Schedule a follow-up; debounce protects us from runaway loops.
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => void performFlush(), DEBOUNCE_MS);
      }
    }
  }, [topicId, disabled, savedScore, savedJustification, onError]);

  const schedule = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void performFlush(), DEBOUNCE_MS);
  }, [performFlush]);

  const setScore = useCallback(
    (next: number) => {
      if (disabled) return;
      setScoreState(next);
      setIsDirty(true);
      schedule();
    },
    [disabled, schedule],
  );

  const setJustification = useCallback(
    (next: string) => {
      if (disabled) return;
      setJustificationState(next);
      setIsDirty(true);
      schedule();
    },
    [disabled, schedule],
  );

  const flushNow = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    await performFlush();
  }, [performFlush]);

  // Cleanup on unmount: clear pending timer (any in-flight mutation will
  // still resolve via react-query; we just stop scheduling new ones).
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return {
    score,
    justification,
    isSaving: upsert.isPending || inflightRef.current,
    isDirty,
    setScore,
    setJustification,
    flushNow,
  };
}
