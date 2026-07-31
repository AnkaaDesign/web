/* Public surface of the Truck Studio engine.
   ---------------------------------------------------------------------------
   The page imports THIS and nothing else. Everything below is internal: the
   three.js scene, the fabric.js livery editor, the catalog, the DOM chrome.

   Layout of the engine, in dependency order:

     core/       the studio's own DOM subtree (template + scoped `$`). Owns no
                 behaviour; every other module reaches its markup through it.
     catalog/    the two manifests (cenários, fabricantes/modelos) and the
                 persisted choice. Validates external JSON; never throws.
     vehicle/    the truck itself — geometry loading and coupling (models),
                 the automotive paint shader (paint), the livery canvases.
     scene/      the world around it — renderer/rig/ground (scene), and the
                 pieces split out of it: textures, sky, lamps, presets, plate.
                 Plus environment (HDRI scenes), scatter and weather.
     ui/         the DOM chrome: sidebar, the 3-step selector, the loading
                 curtain and the lighting HUD. Each ships its own stylesheet.

   This file replaces the hand-written engine/main.d.ts the port shipped: the
   engine is TypeScript now, so its types are derived, not restated. */
export { mountStudio, unmountStudio } from './studio';
