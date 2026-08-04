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
                 the automotive paint shader (paint), and the livery in two
                 layers: `livery` owns the fabric canvases, the CanvasTextures,
                 the panel photo/window and the real-world centimetre scale;
                 `livery-doc` owns the document model on top of them — image
                 assets, webfonts, undo/redo, the align/distribute geometry,
                 side mirroring and persistence.
     scene/      the world around it — renderer/rig/ground (scene), and the
                 pieces split out of it: textures, sky, lamps, presets, plate.
                 Plus environment (HDRI scenes), scatter and weather.
     ui/         the DOM chrome: the topbar/view controls (chrome), the card
                 selector — cenário, fabricante, modelo e COR —, the offscreen
                 renderer that draws the cabs onto those cards (preview), the
                 loading curtain and the lighting HUD. Plus the livery editor's
                 own interface: `livery-editor` (modal, toolbar, contextual
                 inspector, layers, keyboard) and `livery-guides` (snapping
                 overlay and the centimetre rulers). Each ships its own
                 stylesheet.

   One import cycle exists on purpose: vehicle/livery imports initLiveryEditor()
   from ui/livery-editor so studio.ts keeps a single entry point, and that module
   imports the canvases back. It is safe because nothing in the ui module touches
   a vehicle/livery binding during module evaluation — only inside functions.
   Keep it that way, or the boot dies on a temporal-dead-zone ReferenceError.

   This file replaces the hand-written engine/main.d.ts the port shipped: the
   engine is TypeScript now, so its types are derived, not restated. */
export { mountStudio, unmountStudio } from './studio';
