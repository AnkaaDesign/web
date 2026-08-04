import { useEffect, useRef } from "react";

import { getPaints, updatePaint } from "@/api-client/paint";

import { mountStudio, unmountStudio } from "./engine";
import { setColorProvider, setColorPersister, type PaintStudioConfig } from "./engine/catalog/colors";
import "./engine/core/studio.css";
import "./engine/ui/paint-panel.css";
import "./engine/ui/selector.css";
import "./engine/ui/loader.css";
import "./engine/ui/hud.css";

/**
 * Truck Studio — 3D truck configurator (three.js viewer + fabric.js livery
 * editor) for a Frigorífico Paleteiro semitrailer behind a selectable cab.
 *
 * Unlisted on purpose: reachable only at /ferramentas/teste while the feature
 * is being built. It is not in the navigation menu nor on the Ferramentas hub.
 *
 * Flow: the studio opens on a 3-step card selector — cenário → fabricante →
 * modelo — then an animated curtain covers the download and flies the chosen
 * truck's photo into a badge in the bottom-left corner, which is also how the
 * selector is reopened later. The pick is remembered, so a return visit goes
 * straight into the 3D view. All of that lives in the engine (ui/selector.ts +
 * ui/loader.ts + studio.ts); this page never sees a choice.
 *
 * The engine is vanilla TypeScript modules under ./engine — no React, no
 * Tailwind. It owns its own DOM subtree and survives route changes; this page
 * only hosts it. See engine/index.ts for the module map and engine/core/dom.ts
 * for why the subtree is built once and never destroyed.
 *
 * The four stylesheets are imported HERE rather than from the modules that own
 * them, and the order is load-bearing: studio.css declares the custom
 * properties and the `.hidden` rule the other three build on.
 */
/* `previewConfig` é COMPARTILHADO: a raiz dele é do gerador da miniatura 2D da
   cor e o estúdio mora sob `truckStudio` (ver previewConfigSchema em
   schemas/paint.ts). Um PUT que mandasse só `{ truckStudio }` apagaria as luzes
   e o effectIntensity do gerador, então o que veio no GET é guardado aqui e
   remontado no save. Chave = id do Paint. */
const previewConfigById = new Map<string, Record<string, unknown>>();

export const TruckStudioPage = () => {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    /* Ligado ANTES de mountStudio(): loadColors() memoiza a primeira chamada, e
       o seletor abre a tela de cor durante o boot. Registrar depois deixaria a
       primeira visita na paleta embutida.
       O contrato de colors.ts é que NADA aqui pode lançar — a lista embutida é
       o fallback, e doLoad() já trata a rejeição. */
    setColorProvider(async () => {
      previewConfigById.clear();
      const res = await getPaints({
        orderBy: { colorOrder: "asc" },
        include: { paintBrand: true },
        limit: 200,
      });
      return (res.data ?? []).map((p) => {
        const cfg = (p.previewConfig ?? null) as Record<string, unknown> | null;
        if (cfg) previewConfigById.set(p.id, cfg);
        return {
          id: p.id,
          name: p.name,
          hex: p.hex,
          /* O banco tem cinco acabamentos e o motor tem três; a conversão é de
             colors.ts, que mapeia MATTE/SATIN para 'solid'. Mandar o valor cru
             deixa a decisão num lugar só. */
          finish: p.finish,
          code: p.code ?? null,
          brand: p.paintBrand?.name ?? null,
          studio: cfg?.truckStudio ?? null,
        };
      });
    });

    /* O destino do "Aplicar" do painel de tinta. Uma linha de `Paint` já carrega
       `manufacturer`, então gravar na linha JÁ é gravar "aquela cor daquela
       montadora" — não faz falta chave de montadora dentro do JSON. */
    setColorPersister(async (colorId: string, studio: PaintStudioConfig) => {
      const kept = previewConfigById.get(colorId) ?? {};
      const next = { ...kept, truckStudio: studio };
      await updatePaint(colorId, { previewConfig: next } as never);
      previewConfigById.set(colorId, next);
    });

    void mountStudio(host);
    return () => {
      unmountStudio();
      setColorProvider(null);
      setColorPersister(null);
      previewConfigById.clear();
    };
  }, []);

  useEffect(() => {
    const previous = document.title;
    document.title = "Truck Studio | Ankaa";
    return () => {
      document.title = previous;
    };
  }, []);

  return <div ref={hostRef} className="h-full min-h-0" />;
};

export default TruckStudioPage;
