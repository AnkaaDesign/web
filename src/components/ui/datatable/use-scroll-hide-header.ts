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
  // Timestamp until which state toggles are suppressed. Collapsing/revealing the header
  // reflows the scroll container (the header is a flex sibling of the scroller, so the
  // scroller grows/shrinks by the header's height) and the browser re-clamps scrollTop,
  // emitting SYNTHETIC scroll events mid-transition. Riding those out prevents the
  // toggle from ping-ponging itself.
  const settleUntil = useRef(0);

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
      // Suppress further toggles until the collapse/reveal animation settles (the CSS
      // grid-rows transition is 200ms); the reflow it causes must not flip us back.
      settleUntil.current = performance.now() + 260;
    };

    const update = () => {
      ticking.current = false;
      const y = scroller.scrollTop;

      // Inside the post-toggle settling window: track position but don't change state,
      // so the transition's own scrollTop re-clamp can't ping-pong the header.
      if (performance.now() < settleUntil.current) {
        lastY.current = y;
        return;
      }

      // At the very bottom a dynamic-height virtualizer can shrink scrollHeight, and the
      // browser then clamps scrollTop UP a few px. That is NOT a user scroll-up, so don't
      // reveal the header on it — only reveal on a deliberate upward scroll away from the end.
      const atBottom = y + scroller.clientHeight >= scroller.scrollHeight - 2;
      if (y < threshold) {
        setHidden(false); // near the top: always shown
      } else if (y > lastY.current + delta) {
        // Only hide if the content will STILL overflow after the header collapses. The
        // header is currently shown, so its offsetHeight is exactly how much the scroll
        // container grows when it collapses. If hiding would leave less than `threshold`
        // of scroll range, the browser would clamp scrollTop back toward the top and we'd
        // immediately re-reveal — an infinite hide/show loop on short (barely-scrollable)
        // pages. Requiring ≥ threshold of remaining range keeps scrollTop above the reveal
        // point after the collapse, so the header stays put.
        const roomAfterHide = scroller.scrollHeight - scroller.clientHeight - header.offsetHeight;
        if (roomAfterHide >= threshold) setHidden(true);
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
