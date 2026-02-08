import { useEffect, useState } from "react";

interface ScrollbarInfo {
  width: number;
  type: "overlay" | "classic" | "unknown";
  isOverlay: boolean;
}

/**
 * Hook to detect scrollbar width and type on the current system
 * Returns detailed information about the scrollbar including width and type
 */
export function useScrollbarWidth(): ScrollbarInfo {
  const [scrollbarInfo, setScrollbarInfo] = useState<ScrollbarInfo>({
    width: 0,
    type: "unknown",
    isOverlay: true,
  });

  useEffect(() => {
    const detectScrollbar = (): ScrollbarInfo => {
      // Method 1: Check CSS environment variable support
      if (window.matchMedia("(overflow-inline: overlay)").matches) {
        return { width: 0, type: "overlay", isOverlay: true };
      }

      if (window.matchMedia("(overflow-inline: scroll)").matches) {
        // Classic scrollbar detected via media query
        const width = measureScrollbarWidth();
        return { width, type: "classic", isOverlay: false };
      }

      // Method 2: Feature detection using scrollbar-gutter
      const testElement = document.createElement("div");
      testElement.style.cssText = `
        position: absolute;
        top: -9999px;
        width: 100px;
        height: 100px;
        overflow: auto;
        scrollbar-gutter: stable;
      `;
      document.body.appendChild(testElement);

      document.body.removeChild(testElement);

      // Method 3: Direct measurement with enhanced detection
      const scrollbarWidth = measureScrollbarWidth();

      // Enhanced detection logic
      if (scrollbarWidth === 0) {
        return { width: 0, type: "overlay", isOverlay: true };
      }

      // Check for platform-specific behaviors
      const platform = navigator.platform.toLowerCase();
      const isMac = platform.includes("mac");
      const isIOS = /ipad|iphone|ipod/.test(navigator.userAgent.toLowerCase());

      // On macOS, scrollbars might still report a width even when overlay
      if ((isMac || isIOS) && scrollbarWidth <= 15) {
        // Additional check: create a scrollable element and check if it affects layout
        const layoutTest = performLayoutTest();
        if (!layoutTest) {
          return { width: 0, type: "overlay", isOverlay: true };
        }
      }

      return {
        width: scrollbarWidth,
        type: "classic",
        isOverlay: false,
      };
    };

    const measureScrollbarWidth = (): number => {
      // Create container with forced scrollbar
      const outer = document.createElement("div");
      outer.style.cssText = `
        visibility: hidden;
        overflow: scroll;
        width: 100px;
        height: 100px;
        position: absolute;
        top: -9999px;
        -ms-overflow-style: scrollbar;
        scrollbar-width: auto;
      `;

      // Ensure scrollbar appears
      const inner = document.createElement("div");
      inner.style.cssText = "width: 200px; height: 200px;";
      outer.appendChild(inner);
      document.body.appendChild(outer);

      // Force layout
      outer.offsetHeight;

      // Calculate scrollbar width
      const scrollbarWidth = outer.offsetWidth - outer.clientWidth;

      // Clean up
      document.body.removeChild(outer);

      return scrollbarWidth;
    };

    const performLayoutTest = (): boolean => {
      // Test if scrollbar affects layout
      const container = document.createElement("div");
      container.style.cssText = `
        position: absolute;
        top: -9999px;
        width: 100px;
        height: 100px;
        overflow: hidden;
      `;

      const content = document.createElement("div");
      content.style.cssText = "width: 100%; height: 200px;";
      container.appendChild(content);
      document.body.appendChild(container);

      const widthBefore = content.offsetWidth;
      container.style.overflow = "scroll";
      const widthAfter = content.offsetWidth;

      document.body.removeChild(container);

      return widthBefore !== widthAfter;
    };

    // Initial detection
    const info = detectScrollbar();
    setScrollbarInfo(info);

    // Re-detect on window resize or zoom
    const handleChange = () => {
      const newInfo = detectScrollbar();
      if (newInfo.width !== info.width || newInfo.type !== info.type) {
        setScrollbarInfo(newInfo);
      }
    };

    window.addEventListener("resize", handleChange);

    // Listen for preference changes
    const mediaQuery = window.matchMedia("(overflow-inline: overlay), (overflow-inline: scroll)");
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleChange);
    } else if (mediaQuery.addListener) {
      // Fallback for older browsers
      mediaQuery.addListener(handleChange);
    }

    return () => {
      window.removeEventListener("resize", handleChange);
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener("change", handleChange);
      } else if (mediaQuery.removeListener) {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, []);

  return scrollbarInfo;
}

/**
 * Simple hook that returns just the scrollbar width for backward compatibility
 */
export function useScrollbarWidthSimple(): number {
  const { width } = useScrollbarWidth();
  return width;
}
