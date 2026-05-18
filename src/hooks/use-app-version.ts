import { useEffect, useRef } from "react";
import { toast } from "@/components/ui/sonner";

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

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
            description: "Recarregue a página para aplicar as atualizações.",
            duration: Infinity,
            action: {
              label: "Atualizar",
              onClick: () => window.location.reload(),
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
