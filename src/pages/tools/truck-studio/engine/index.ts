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
                 `trim` is the four configurable pieces — roof, fenders,
                 kitchen box and Thermo King. Three of them carry their OWN
                 paint (the box lost its colour on 2026-08-13, by request) and
                 two can be dropped from the product. Per-piece paint is why
                 `paint` exports a PaintInstance class rather than the module
                 singleton it used to be: the uniform block has to be per-coat,
                 or every material writes the same colour. `trim` never touches
                 localStorage or the catalog; it publishes changes and studio.ts
                 persists them, the same edge `onTrailerPanelsRebuilt` uses.
     scene/      the world around it — renderer/rig/ground (scene), and the
                 pieces split out of it: textures, sky, lamps, presets. Plus
                 environment (the HDRI/scenery manifests), set (the modelled 3D
                 scenery those manifests name), weather (rain), probe (the local
                 reflection cubemap the chrome mirrors), capture (the
                 high-resolution PNG export) and record (the video one).
                 `capture` and `record` are siblings that do OPPOSITE things and
                 must not be merged: capture renders to its own render target and
                 never touches the live canvas, which is what buys it 7680×4320
                 and an alpha channel; record can only read the COMPOSED canvas,
                 because that is all `captureStream()` sees. See record.ts's
                 header — that one constraint explains every difference between
                 them.
                 `plate` and `scatter` are gone: they belonged to the photo-backed
                 scenarios deleted on 2026-08-03 — see ARCHITECTURE.md.
     ui/         the DOM chrome: the topbar/view controls (chrome), the card
                 selector — cenário, fabricante, modelo e COR —, the offscreen
                 renderer that draws the cabs onto those cards (preview), the
                 loading curtain, the lighting HUD and `trim-panel` (the
                 collapsible CONFIGURAÇÕES card: per-piece colour pickers, which
                 items ship with the implement, and whether the scene shows the
                 whole rig, only the tractor or only the implement). Plus the
                 livery editor's
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
export { mountStudio, unmountStudio, setTrailerDims } from './studio';
/* O baú é paramétrico: `setTrailerDims({ height, length })` regenera a parte
   branca (frisos reais empilhados, não uma chapa esticada), acompanha o resto do
   conjunto, recorta as chapas de arte de novo e refaz o engate. A LARGURA não
   entra: é padrão 2,60 m. Ver engine/vehicle/trailer-rig.ts. */
export type { TrailerDims } from './vehicle/models';

/* ---------------- medidas do implemento ----------------
   O editor de plotagem passou a EDITAR AS MEDIDAS: altura e comprimento do baú
   e as portas de cada face, na mesma tela em que a arte é desenhada. Alterar
   uma medida redimensiona o baú de verdade (a mesma `setTrailerDims` acima) e
   recompõe a REPRESENTAÇÃO 2D do painel — faixa refletiva, cantoneira e vãos de
   porta —, derivada por engine/vehicle/livery-layers.ts, o arquivo ESPELHADO
   com o truck-studio-desktop e mantido idêntico dos dois lados.

   Essa representação NÃO vai para a textura do baú: as três peças já existem
   como geometria no modelo, e desenhá-las de novo as duplicaria. O que o
   editor manda para o 3D continua sendo só a ARTE. Ver o cabeçalho de
   engine/vehicle/livery-structure.ts.

   O QUE ESTA SUPERFÍCIE SERVE, e para quem:

   `importImplementLayout` / `exportImplementLayout` são a costura com
   `components/production/implement-measure/implement-measure-form.tsx`, que
   continua sendo a FONTE DA VERDADE das medidas e não é tocado por aqui. Eles
   falam o formato daquele formulário — altura em metros, seções em que a porta
   é `isDoor` com `doorHeight` — para que a página React possa empurrar um
   layout salvo para dentro do estúdio e ler de volta o que foi editado nele,
   sem que nenhum dos dois lados precise conhecer as entranhas do outro.

   `registerLiveryArt` é o ponto de extensão dos SVGs que ainda não existem: as
   faixas refletivas, os frames metálicos e as portas entram hoje como
   placeholders com a caixa certa e viram arte real com UMA chamada, sem
   nenhuma outra mudança de código. Ver o cabeçalho de
   engine/vehicle/livery-structure.ts. */
export {
  getImplementMeasures, setImplementMeasures,
  importImplementLayout, exportImplementLayout, checkSideWidths,
  onMeasuresChanged,
  addDoor, removeDoor, updateDoor, setDoorsFor, getDoors,
  registerLiveryArt, unregisterLiveryArt, registeredLiveryArt, describeStructure,
  sideToKey, keyToSide, STRUCTURE_KEYS,
} from './vehicle/livery-structure';
export type {
  ImplementMeasures, ImplementLayout, ImplementLayoutSection,
  StructureKey, MeasureSide, DoorSpec, LiverySource,
} from './vehicle/livery-structure';
