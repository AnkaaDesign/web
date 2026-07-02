import { useEffect, useRef } from "react";

export const IS_MAC = typeof navigator !== "undefined" && /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent);

const isTypingTarget = (target: EventTarget | null): boolean => {
  const element = target as HTMLElement | null;
  if (!element) return false;
  if (element.isContentEditable) return true;
  const tag = element.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
};

/**
 * Fires the callback on Shift+F — guarded so typing a capital "F" inside any
 * input/textarea/contenteditable never triggers it. Ctrl/Cmd+K also toggles
 * (works even while typing, since it's not a printable key).
 */
export function useSpotlightShortcut(onTrigger: () => void, enabled = true) {
  const callbackRef = useRef(onTrigger);
  callbackRef.current = onTrigger;

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl/Cmd+K — direct toggle, safe in any context
      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        callbackRef.current();
        return;
      }

      // Shift+F — only outside editable fields (otherwise it's just typing "F")
      if (event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey && event.key.toLowerCase() === "f") {
        if (event.repeat || isTypingTarget(event.target)) return;
        event.preventDefault();
        callbackRef.current();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled]);
}
