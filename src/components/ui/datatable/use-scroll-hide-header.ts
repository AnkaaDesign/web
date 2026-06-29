import { useEffect, useRef, type RefObject } from "react";

interface UseScrollHideHeaderOptions {
  /** The scroll container to watch (the table body viewport). */
  scrollRef: RefObject<HTMLElement | null>;
  /** The header wrapper to collapse/reveal. */
  headerRef: RefObject<HTMLElement | null>;
  /** Pixels scrolled past before hiding is allowed. */
  threshold?: number;
  /** Minimum downward delta before hiding (debounces jitter). */
  delta?: number;
  enabled?: boolean;
}

/**
 * Hide-on-scroll-down / reveal-on-scroll-up for a page header, done the
 * performant way: a rAF-throttled scroll listener that mutates a single
 * `data-hidden` attribute on the header element via ref. There is ZERO React
 * state per scroll tick, so the (potentially huge) table below NEVER re-renders
 * while scrolling — the animation is pure CSS (`transform` + `max-height`).
 *
 * This is the deliberate fix for the janky `production/preparation.tsx` pattern,
 * which called `setState` on every scroll event and re-rendered its tables.
 */
export function useScrollHideHeader({
  scrollRef,
  headerRef,
  threshold = 24,
  delta = 6,
  enabled = true,
}: UseScrollHideHeaderOptions) {
  const lastY = useRef(0);
  const hidden = useRef(false);
  const ticking = useRef(false);

  useEffect(() => {
    const scroller = scrollRef.current;
    const header = headerRef.current;
    if (!scroller || !header) return;

    // When disabled, keep the header visible and skip the listener entirely.
    header.dataset.hidden = "false";
    if (!enabled) return;

    const setHidden = (next: boolean) => {
      if (next === hidden.current) return;
      hidden.current = next;
      header.dataset.hidden = next ? "true" : "false";
    };

    const update = () => {
      ticking.current = false;
      const y = scroller.scrollTop;
      // At the very bottom a dynamic-height virtualizer can shrink scrollHeight, and the
      // browser then clamps scrollTop UP a few px. That is NOT a user scroll-up, so don't
      // reveal the header on it — only reveal on a deliberate upward scroll away from the end.
      const atBottom = y + scroller.clientHeight >= scroller.scrollHeight - 2;
      if (y < threshold) {
        setHidden(false); // near the top: always shown
      } else if (y > lastY.current + delta) {
        setHidden(true); // scrolling down past the delta
      } else if (y < lastY.current - delta && !atBottom) {
        setHidden(false); // deliberate scroll-up (ignoring the bottom-clamp bounce)
      }
      lastY.current = y;
    };

    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(update);
    };

    lastY.current = scroller.scrollTop;
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => scroller.removeEventListener("scroll", onScroll);
  }, [scrollRef, headerRef, threshold, delta, enabled]);
}
