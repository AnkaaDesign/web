// Platform detection + native-app deep-link helpers.
//
// Used by the public /install landing page and the mobile-usage guard to decide
// which install flow to show and how to hand off into the native app.

import { APP_URI_SCHEME } from "@/config/deployment";

export type Platform = "ios" | "android" | "desktop";

/**
 * Chromium high-entropy Client Hints. Not yet in the default TS DOM lib, so we
 * model the small slice we use. Apple does NOT implement this API, so it is only
 * ever present on Android/desktop Chromium — never on iOS.
 */
interface UADataLike {
  readonly mobile?: boolean;
  readonly platform?: string;
}

/**
 * Detect the current platform.
 *
 * We consult Client Hints (`navigator.userAgentData`) BEFORE the UA string
 * because Chrome's "Request desktop site" mode rewrites the UA to a Linux
 * desktop string with no `Android`/`Mobile` token — which would otherwise make
 * a real Android phone look like a desktop and dump it on the QR-scan view.
 * Client Hints keep `platform: "Android"` / `mobile: true` even in that mode.
 *
 * iPadOS 13+ Safari reports a desktop ("Macintosh") user agent by default, so
 * we additionally treat a Mac-looking UA with a touch screen as iOS — that is
 * an iPad masquerading as desktop Safari, not a real Mac. (Safari has no Client
 * Hints, so that branch stays UA + touch based.)
 */
export function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "desktop";

  const ua = navigator.userAgent || "";
  const uaData = (navigator as Navigator & { userAgentData?: UADataLike }).userAgentData;

  // Client Hints first — survives "Request desktop site" on Android Chrome.
  if (uaData?.platform === "Android") return "android";

  // iPadOS-as-desktop-Safari fix.
  const isIPadOS = /Macintosh/.test(ua) && (navigator.maxTouchPoints ?? 0) > 1;

  if (/iPad|iPhone|iPod/.test(ua) || isIPadOS) return "ios";
  if (/Android/i.test(ua)) return "android";

  // Desktop-site mode strips the Android token but Client Hints still flag a
  // mobile form factor; treat that as Android (iOS never reaches here).
  if (uaData?.mobile === true) return "android";

  return "desktop";
}

/** Whether the visitor is on a phone/tablet (iOS or Android). */
export function isMobile(): boolean {
  return detectPlatform() !== "desktop";
}

/**
 * True only for genuine mobile Safari on iOS — the one browser where the
 * `itms-services://` over-the-air install actually works. Every iOS browser is
 * WebKit under the hood, so we identify real Safari by the presence of the
 * `Version/` token while excluding the known third-party browsers (Chrome =
 * CriOS, Firefox = FxiOS, Edge = EdgiOS, Opera = OPiOS, Google app = GSA) and
 * the common in-app webviews (Instagram, Facebook, WhatsApp, etc.).
 */
export function isIOSSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  if (detectPlatform() !== "ios") return false;

  const ua = navigator.userAgent || "";
  const isOtherBrowser = /(CriOS|FxiOS|EdgiOS|OPiOS|GSA|DuckDuckGo|YaBrowser)/i.test(ua);
  const isInAppWebView = /(FBAN|FBAV|FBIOS|Instagram|Line|Twitter|WhatsApp|LinkedIn|Snapchat|MicroMessenger|Pinterest|TikTok)/i.test(ua);
  const looksLikeSafari = /Safari/.test(ua) && /Version\//.test(ua);

  return looksLikeSafari && !isOtherBrowser && !isInAppWebView;
}

/** On iOS but NOT in Safari — the OTA install would fail here. */
export function isIOSNonSafari(): boolean {
  return detectPlatform() === "ios" && !isIOSSafari();
}

/**
 * Best-effort hand-off to Safari using the well-known `x-safari-` URL-scheme
 * escape. This reliably opens Safari from in-app webviews (Instagram, WhatsApp,
 * Gmail, etc.), which is by far the most common place install links land.
 *
 * Apple exposes no API to switch out of a full third-party browser like Chrome
 * or Firefox, so there it does nothing — callers must always also offer a
 * copy-link fallback with manual "open in Safari" instructions.
 */
export function openInSafari(url: string): void {
  if (typeof window === "undefined") return;
  window.location.href = `x-safari-${url}`;
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
