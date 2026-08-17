/**
 * Registro global de trabalho não salvo.
 *
 * Existe porque duas rotinas recarregam o documento por conta própria: a
 * recuperação de chunk obsoleto (`chunk-reload.ts`) e o aviso de nova versão
 * (`use-app-version.ts`). Nenhuma das duas enxerga o estado de um formulário,
 * e um deploy no meio do expediente é rotina aqui — o resultado foi um
 * orçamento de 25 minutos recarregado embaixo do usuário enquanto ele salvava.
 *
 * `useUnsavedChangesGuard` registra enquanto o formulário está sujo; quem
 * recarrega consulta `hasUnsavedWork()` antes de puxar o gatilho.
 */

const dirtyForms = new Set<object>();

/** Marca que existe trabalho não salvo associado a `token`. */
export function registerDirtyForm(token: object): void {
  dirtyForms.add(token);
}

/** Remove `token` do registro (salvo, descartado ou desmontado). */
export function unregisterDirtyForm(token: object): void {
  dirtyForms.delete(token);
}

/** True quando qualquer formulário montado tem alterações não salvas. */
export function hasUnsavedWork(): boolean {
  return dirtyForms.size > 0;
}

/**
 * Evento disparado quando um reload automático foi SUPRIMIDO porque havia
 * trabalho não salvo. `App` escuta e transforma num toast com ação explícita,
 * para o usuário decidir a hora de recarregar.
 */
export const DEFERRED_RELOAD_EVENT = "ankaa:reload-deferred";

export interface DeferredReloadDetail {
  /** Motivo técnico, para o texto do aviso. */
  reason: "stale-chunk" | "new-version";
}

export function emitDeferredReload(reason: DeferredReloadDetail["reason"]): void {
  window.dispatchEvent(
    new CustomEvent<DeferredReloadDetail>(DEFERRED_RELOAD_EVENT, { detail: { reason } }),
  );
}
