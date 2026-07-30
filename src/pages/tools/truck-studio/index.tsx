import { useEffect, useRef } from "react";

import { mountStudio, unmountStudio } from "./engine/main.js";
import "./studio.css";

/**
 * Truck Studio — 3D truck configurator (three.js viewer + fabric.js livery
 * editor) for a Frigorífico Paleteiro semitrailer behind a selectable cab.
 *
 * Unlisted on purpose: reachable only at /ferramentas/teste while the feature
 * is being built. It is not in the navigation menu nor on the Ferramentas hub.
 *
 * The 3D engine is vanilla ES modules under ./engine (a port of the standalone
 * truck-studio app). It owns its own DOM subtree and survives route changes —
 * this page only hosts it. See engine/dom.js for why.
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
