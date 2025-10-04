/**
 * Comprehensive scrollbar detection utilities
 */

export interface ScrollbarCapabilities {
  type: "overlay" | "classic" | "unknown";
  width: number;
  supportsGutter: boolean;
  supportsOverlay: boolean;
  platform: "mac" | "windows" | "linux" | "mobile" | "unknown";
}

/**
 * Detect platform from user agent and navigator
 */
function detectPlatform(): ScrollbarCapabilities["platform"] {
  const ua = navigator.userAgent.toLowerCase();
  const platform = navigator.platform?.toLowerCase() || "";

  if (/ipad|iphone|ipod|android/.test(ua)) return "mobile";
  if (platform.includes("mac") || /macintosh/.test(ua)) return "mac";
  if (platform.includes("win") || /windows/.test(ua)) return "windows";
  if (platform.includes("linux") || /linux/.test(ua)) return "linux";

  return "unknown";
}

/**
 * Check if browser supports CSS scrollbar-gutter property
 */
function checkScrollbarGutterSupport(): boolean {
  const testEl = document.createElement("div");
  testEl.style.scrollbarGutter = "stable";
  return testEl.style.scrollbarGutter === "stable";
}

/**
 * Check if browser supports overlay scrollbars via CSS
 */
function checkOverlaySupport(): boolean {
  // Method 1: Check overflow: overlay support (deprecated but still works in some browsers)
  const testEl = document.createElement("div");
  testEl.style.overflow = "overlay";
  const supportsOverflowOverlay = testEl.style.overflow === "overlay";

  // Method 2: Check media query support
  const supportsMediaQuery = window.matchMedia("(overflow-inline: overlay)").matches;

  return supportsOverflowOverlay || supportsMediaQuery;
}

/**
 * Measure actual scrollbar width
 */
function measureScrollbarWidth(): number {
  const outer = document.createElement("div");
  const inner = document.createElement("div");

  outer.style.cssText = `
    position: absolute;
    top: -9999px;
    left: -9999px;
    width: 100px;
    height: 100px;
    overflow: scroll;
    -ms-overflow-style: scrollbar;
  `;

  inner.style.cssText = "width: 100%; height: 200px;";

  outer.appendChild(inner);
  document.body.appendChild(outer);

  // Force layout calculation
  const scrollbarWidth = outer.offsetWidth - outer.clientWidth;

  document.body.removeChild(outer);

  return scrollbarWidth;
}

/**
 * Enhanced detection using multiple methods
 */
export function detectScrollbarCapabilities(): ScrollbarCapabilities {
  const platform = detectPlatform();
  const supportsGutter = checkScrollbarGutterSupport();
  const supportsOverlay = checkOverlaySupport();

  // Check media queries first (most reliable)
  if (window.matchMedia("(overflow-inline: overlay)").matches) {
    return {
      type: "overlay",
      width: 0,
      supportsGutter,
      supportsOverlay: true,
      platform,
    };
  }

  if (window.matchMedia("(overflow-inline: scroll)").matches) {
    const width = measureScrollbarWidth();
    return {
      type: "classic",
      width,
      supportsGutter,
      supportsOverlay,
      platform,
    };
  }

  // Fallback to measurement-based detection
  const width = measureScrollbarWidth();

  // Platform-specific detection logic
  if (platform === "mac" || platform === "mobile") {
    // On macOS and mobile, check if scrollbar affects layout
    const testContainer = document.createElement("div");
    const testContent = document.createElement("div");

    testContainer.style.cssText = `
      position: absolute;
      top: -9999px;
      width: 100px;
      height: 100px;
      overflow: hidden;
    `;

    testContent.style.cssText = "width: 100%; height: 200px;";
    testContainer.appendChild(testContent);
    document.body.appendChild(testContainer);

    const widthHidden = testContent.offsetWidth;
    testContainer.style.overflow = "scroll";
    const widthScroll = testContent.offsetWidth;

    document.body.removeChild(testContainer);

    // If width doesn't change, it's an overlay scrollbar
    if (widthHidden === widthScroll) {
      return {
        type: "overlay",
        width: 0,
        supportsGutter,
        supportsOverlay,
        platform,
      };
    }
  }

  // Default to classic scrollbar
  return {
    type: width === 0 ? "overlay" : "classic",
    width,
    supportsGutter,
    supportsOverlay,
    platform,
  };
}

/**
 * Get CSS custom properties for scrollbar values
 */
export function getScrollbarCSSVariables(capabilities: ScrollbarCapabilities): Record<string, string> {
  return {
    "--scrollbar-width": `${capabilities.width}px`,
    "--scrollbar-type": capabilities.type,
    "--scrollbar-gutter-support": capabilities.supportsGutter ? "1" : "0",
    "--scrollbar-overlay-support": capabilities.supportsOverlay ? "1" : "0",
  };
}

/**
 * Apply scrollbar CSS variables to an element or :root
 */
export function applyScrollbarVariables(element: HTMLElement = document.documentElement, capabilities?: ScrollbarCapabilities): void {
  const caps = capabilities || detectScrollbarCapabilities();
  const vars = getScrollbarCSSVariables(caps);

  Object.entries(vars).forEach(([key, value]) => {
    element.style.setProperty(key, value);
  });
}

/**
 * Utility to determine if scrollbar compensation is needed
 */
export function needsScrollbarCompensation(capabilities?: ScrollbarCapabilities): boolean {
  const caps = capabilities || detectScrollbarCapabilities();
  return caps.type === "classic" && caps.width > 0;
}

/**
 * Get recommended CSS classes based on scrollbar capabilities
 */
export function getScrollbarClasses(capabilities?: ScrollbarCapabilities): string[] {
  const caps = capabilities || detectScrollbarCapabilities();
  const classes: string[] = [];

  if (caps.type === "overlay") {
    classes.push("has-overlay-scrollbar");
  } else {
    classes.push("has-classic-scrollbar");
  }

  if (caps.supportsGutter) {
    classes.push("supports-scrollbar-gutter");
  }

  classes.push(`platform-${caps.platform}`);

  return classes;
}
