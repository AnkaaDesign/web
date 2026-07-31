import { useEffect, useRef } from "react";

import { mountStudio, unmountStudio } from "./engine";
import "./engine/core/studio.css";
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
export const TruckStudioPage = () => {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    void mountStudio(host);
    return () => unmountStudio();
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
