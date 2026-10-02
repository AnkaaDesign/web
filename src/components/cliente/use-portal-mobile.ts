// web/src/components/cliente/use-portal-mobile.ts
//
// O PORTAL ESTÁ NUM CELULAR? — abaixo do `md` do Tailwind (768 px).
//
// Não é detecção de aparelho: é a LARGURA, que é o que decide se uma tabela
// cabe. Um tablet em pé (768) já recebe a tabela; um desktop numa janela
// estreita recebe os cartões. `useSyncExternalStore` lê o `matchMedia` sem
// render extra e acompanha a rotação do aparelho.
import { useSyncExternalStore } from "react";

export const PORTAL_MOBILE_QUERY = "(max-width: 767px)";

function subscribe(onChange: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const media = window.matchMedia(PORTAL_MOBILE_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function snapshot(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia && window.matchMedia(PORTAL_MOBILE_QUERY).matches;
}

export function usePortalMobile(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}
