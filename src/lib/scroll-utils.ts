import { useCallback } from 'react';

export interface ScrollToElementOptions {
  /**
   * Scroll behavior - 'smooth' for animated, 'auto' for instant
   */
  behavior?: ScrollBehavior;

  /**
   * Vertical alignment - where the element should align in the viewport
   */
  block?: ScrollLogicalPosition;

  /**
   * Horizontal alignment
   */
  inline?: ScrollLogicalPosition;

  /**
   * Additional offset from top (e.g., for fixed headers)
   * Can be a number (pixels) or a CSS selector to calculate from
   */
  offset?: number | string;

  /**
   * Delay before scrolling (to wait for animations)
   */
  delay?: number;

  /**
   * Callback fired after scroll completes
   */
  onComplete?: () => void;
}

/**
 * Checks if user prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Gets the height of an element by selector
 */
function getElementHeight(selector: string): number {
  const element = document.querySelector(selector);
  return element?.getBoundingClientRect().height ?? 0;
}

/**
 * Smooth scroll to element with automatic offset calculation for fixed headers
 * Handles accordion animations and layout shifts gracefully
 */
export function scrollToElement(
  target: string | HTMLElement,
  options: ScrollToElementOptions = {}
): void {
  const {
    behavior: requestedBehavior = 'smooth',
    block = 'start',
    inline = 'nearest',
    offset = 0,
    delay = 0,
    onComplete,
  } = options;

  // Respect user's motion preferences
  const behavior = prefersReducedMotion() ? 'auto' : requestedBehavior;

  const performScroll = () => {
    try {
      // Get the target element
      const element = typeof target === 'string'
        ? document.querySelector(target)
        : target;

      if (!element) {
        console.warn(`scrollToElement: Target element not found`, target);
        return;
      }

      // Calculate offset
      let scrollOffset = 0;
      if (typeof offset === 'number') {
        scrollOffset = offset;
      } else if (typeof offset === 'string') {
        scrollOffset = getElementHeight(offset);
      }

      // If we need offset, use manual calculation with scrollTo
      if (scrollOffset > 0) {
        const rect = element.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const targetPosition = rect.top + scrollTop - scrollOffset;

        window.scrollTo({
          top: targetPosition,
          behavior,
        });
      } else {
        // Use native scrollIntoView for best performance and browser optimization
        element.scrollIntoView({
          behavior,
          block,
          inline,
        });
      }

      // Call completion callback
      if (onComplete) {
        // Estimate scroll duration for smooth behavior (typically ~300-500ms)
        const scrollDuration = behavior === 'smooth' ? 500 : 0;
        setTimeout(onComplete, scrollDuration);
      }
    } catch (error) {
      console.error('scrollToElement: Scroll failed', error);
      // Fallback: try instant scroll
      try {
        const element = typeof target === 'string'
          ? document.querySelector(target)
          : target;
        element?.scrollIntoView(true);
      } catch (fallbackError) {
        console.error('scrollToElement: Fallback scroll also failed', fallbackError);
      }
    }
  };

  // Apply delay if specified (useful for waiting for accordion animations)
  if (delay > 0) {
    setTimeout(performScroll, delay);
  } else {
    // Use requestAnimationFrame for better coordination with rendering
    requestAnimationFrame(performScroll);
  }
}

/**
 * Hook for accordion scroll management
 * Specifically designed for Radix UI accordions with proper timing
 * Uses CSS scroll-margin-top for reliable positioning
 */
export function useAccordionScroll() {
  const scrollToAccordion = useCallback((accordionId: string) => {
    // Wait for accordion animation to complete and DOM to fully settle
    // Radix UI accordion animation: 200ms + buffer for layout shifts
    setTimeout(() => {
      const element = document.getElementById(`accordion-item-${accordionId}`);

      if (element) {
        try {
          // Check if user prefers reduced motion
          const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

          // Use native scrollIntoView which respects CSS scroll-margin-top
          // This is more reliable than manual calculation
          element.scrollIntoView({
            behavior: prefersReduced ? 'auto' : 'smooth',
            block: 'start',
            inline: 'nearest'
          });

          console.log('Scrolled to accordion:', accordionId);
        } catch (error) {
          console.error('Accordion scroll failed:', error);
          // Fallback to instant scroll
          try {
            element.scrollIntoView(true);
          } catch (fallbackError) {
            console.error('Fallback scroll also failed:', fallbackError);
          }
        }
      } else {
        console.warn('Accordion element not found:', `accordion-item-${accordionId}`);
      }
    }, 400); // Increased to 400ms to ensure complete animation and DOM stabilization
  }, []);

  return { scrollToAccordion };
}
