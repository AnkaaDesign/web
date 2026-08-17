/**
 * DeferredReloadHandler
 *
 * `chunk-reload.ts` recovers from a post-deploy stale chunk by reloading the
 * document. That reload is silent and unconditional, so when it fired while a
 * form was filled in, the work was simply gone. It now defers to this component
 * whenever `hasUnsavedWork()` is true: the user gets a persistent toast and
 * decides when to reload.
 */

import { useEffect } from "react";
import { toast } from "@/components/ui/sonner";
import {
  DEFERRED_RELOAD_EVENT,
  hasUnsavedWork,
  type DeferredReloadDetail,
} from "@/lib/dirty-forms";

const DEFERRED_RELOAD_TOAST_ID = "deferred-reload";

export function DeferredReloadHandler(): null {
  useEffect(() => {
    const handler = (event: Event) => {
      const { reason } = (event as CustomEvent<DeferredReloadDetail>).detail ?? {};

      toast.warning("Atualização pendente", {
        id: DEFERRED_RELOAD_TOAST_ID,
        description:
          reason === "stale-chunk"
            ? "Uma nova versão do sistema foi publicada. Termine e salve o que está fazendo — algumas telas só abrem após recarregar."
            : "Uma nova versão do sistema foi publicada. Termine e salve o que está fazendo antes de recarregar.",
        duration: Infinity,
        action: {
          label: "Recarregar",
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
    };

    window.addEventListener(DEFERRED_RELOAD_EVENT, handler);
    return () => window.removeEventListener(DEFERRED_RELOAD_EVENT, handler);
  }, []);

  return null;
}
