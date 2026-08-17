import { useEffect, useRef } from "react";
import { toast } from "@/components/ui/sonner";
import { hasUnsavedWork } from "@/lib/dirty-forms";

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const VERSION_TOAST_ID = "app-version-available";

export function useAppVersion() {
  const loadedHash = useRef<string>(typeof __APP_HASH__ !== "undefined" ? __APP_HASH__ : "dev");
  const toastShown = useRef(false);

  useEffect(() => {
    if (loadedHash.current === "dev") return;

    async function checkVersion() {
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) return;
        const { hash } = await res.json();
        if (hash && hash !== loadedHash.current && !toastShown.current) {
          toastShown.current = true;
          toast.info("Nova versão disponível", {
            id: VERSION_TOAST_ID,
            description: "Recarregue a página para aplicar as atualizações.",
            duration: Infinity,
            action: {
              label: "Atualizar",
              // The toast sits on screen for as long as the tab lives, so this
              // button gets clicked while a form is half-filled — a deploy
              // mid-shift is routine. Reloading here threw away a 25-minute
              // budget once. Warn first; `beforeunload` alone is not enough,
              // since the browser only shows its prompt after a user gesture
              // and its wording gives no hint of what is at stake.
              onClick: () => {
                if (
                  hasUnsavedWork() &&
                  !window.confirm(
                    "Há alterações não salvas nesta página. Recarregar agora vai descartá-las.\n\nRecarregar mesmo assim?",
                  )
                ) {
                  return;
                }
                window.location.reload();
              },
            },
          });
        }
      } catch {
        // ignore network errors
      }
    }

    const id = setInterval(checkVersion, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);
}
