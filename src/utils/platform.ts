// Platform detection + native-app deep-link helpers.
//
// Used by the public /install landing page and the mobile-usage guard to decide
// which install flow to show and how to hand off into the native app.

import { APP_URI_SCHEME } from "@/config/deployment";

export type Platform = "ios" | "android" | "desktop";

/**
 * Detect the current platform from the user agent.
 *
 * iPadOS 13+ Safari reports a desktop ("Macintosh") user agent by default, so
 * we additionally treat a Mac-looking UA with a touch screen as iOS — that is
 * an iPad masquerading as desktop Safari, not a real Mac.
 */
export function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "desktop";

  const ua = navigator.userAgent || "";

  // iPadOS-as-desktop-Safari fix.
  const isIPadOS = /Macintosh/.test(ua) && (navigator.maxTouchPoints ?? 0) > 1;

  if (/iPad|iPhone|iPod/.test(ua) || isIPadOS) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

/** Whether the visitor is on a phone/tablet (iOS or Android). */
export function isMobile(): boolean {
  return detectPlatform() !== "desktop";
}

/**
 * Attempt to open the native app at a given in-app path using the custom URL
 * scheme (signing-independent, e.g. `ankaadesign://producao/123`).
 *
 * Browsers offer no reliable "did it open?" signal, so we use the well-known
 * visibility-timeout heuristic: if the app launches, the browser tab is
 * backgrounded and `visibilitychange` fires. If after ~1.2s the tab is still
 * visible, the app almost certainly is not installed and we invoke `onFail`.
 *
 * Note: HTTPS universal links (https://ankaadesign.com.br/...) are resolved by
 * the OS only when the app is installed; when it is not, they would just reload
 * the website (and bounce back here via the guard). We therefore use the custom
 * scheme for the explicit user-gesture hand-off and leave universal-link
 * interception to the OS, which keeps this loop-free and robust.
 */
export function openNativeApp(path = "", onFail?: () => void): void {
  if (typeof window === "undefined") return;

  const cleanPath = String(path).replace(/^\/+/, "");
  const schemeUrl = `${APP_URI_SCHEME}://${cleanPath}`;

  let appLaunched = false;
  const onVisibilityChange = () => {
    if (document.visibilityState === "hidden") appLaunched = true;
  };

  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("pagehide", onVisibilityChange);
  window.addEventListener("blur", onVisibilityChange);

  // Fire the scheme via the user gesture.
  window.location.href = schemeUrl;

  window.setTimeout(() => {
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener("pagehide", onVisibilityChange);
    window.removeEventListener("blur", onVisibilityChange);

    if (!appLaunched && document.visibilityState === "visible") {
      onFail?.();
    }
  }, 1200);
}

/**
 * Build the HTTPS universal link for an in-app path, e.g.
 * `https://ankaadesign.com.br/producao/123`. Exposed for completeness / future
 * use; the OS handles interception when the app is installed.
 */
export function universalLink(path = "", domain = "ankaadesign.com.br"): string {
  const cleanPath = String(path).replace(/^\/+/, "");
  return `https://${domain}/${cleanPath}`;
}
