/**
 * Fonte única de verdade para os caminhos de `public/`.
 *
 * Tudo que mora em `public/` é servido cru na raiz do site (`/`), então o
 * caminho é uma URL pública — não um import resolvido pelo bundler. Isso quer
 * dizer que o TypeScript NÃO acusa nada quando um arquivo é movido: a única
 * proteção contra 404 silencioso é todo mundo apontar para as constantes daqui.
 *
 * **Ao mover algo dentro de `public/`, edite SÓ este arquivo.**
 *
 * Layout de `public/` (ver `public/README.md` para a convenção completa):
 *
 * - raiz          → contrato da plataforma web: arquivos que o navegador, o SO
 *                   ou o service worker buscam por convenção em `/`. Nunca
 *                   engordar essa lista.
 * - `branding/`   → identidade visual da empresa (espelha `assets/branding/` do Flutter)
 * - `icons/`      → favicons e ícones de PWA/app
 * - `messages/`   → arte dos blocos decoradores do editor de Mensagens
 *                   (espelha `assets/messages/` do Flutter — mesmos nomes de arquivo)
 * - `ghs/`        → pictogramas de perigo GHS usados pela FISPQ
 * - `vendor/`     → assets de runtime de terceiros (worker do pdf.js, decoder Draco)
 * - `models/`     → geometria 3D (`vehicles/`, `props/`)
 * - `textures/`   → mapas de material (chão PBR + normal maps de tinta), plano
 * - `environments/` → cenários do Truck Studio (HDRI + céu + thumb)
 * - `brands/trucks/` → logos e fotos das montadoras (`TruckManufacturer`)
 */

/* ------------------------------------------------------------------ *
 * Raiz — contrato da plataforma. Não mover.
 * ------------------------------------------------------------------ */

/**
 * Arquivos que precisam continuar na raiz de `public/`:
 *
 * - `favicon.ico` — o navegador busca `/favicon.ico` sozinho em contextos sem
 *   HTML (404 do nginx, favorito, aba restaurada), fora do `<link>` do index.
 * - `site.webmanifest` — `start_url`/`scope` são `/`; manifesto na raiz é o
 *   caminho testado por todos os instaladores de PWA.
 * - `firebase-messaging-sw.js` — o escopo de um service worker é limitado ao
 *   diretório dele. Fora da raiz, ele só controlaria `/vendor/*` e as
 *   notificações em background parariam de funcionar.
 * - `.well-known/` — caminho fixado por RFC 8615 (App Links / Universal Links).
 */
export const ROOT_ASSETS = {
  favicon: "/favicon.ico",
  webmanifest: "/site.webmanifest",
  serviceWorker: "/firebase-messaging-sw.js",
} as const;

/* ------------------------------------------------------------------ *
 * Marca
 * ------------------------------------------------------------------ */

export const BRAND_ASSETS = {
  /** Logotipo Ankaa. Também embutido nos e-mails pela API — ver nota abaixo. */
  logo: "/branding/logo.png",
  /** Assinatura digitalizada do diretor comercial, usada no PDF do Orçamento. */
  directorSignature: "/branding/sergio-signature.webp",
} as const;

/**
 * ⚠️ `BRAND_ASSETS.logo` é uma URL PÚBLICA replicada fora deste repositório:
 *
 * - `api/src/templates/email-templates.ts` → `EMAIL_LOGO_URL`
 * - `api/src/templates/signature-emails.ts` → `LOGO_URL`
 *
 * Ambas montam `${WEB_APP_URL}/branding/logo.png`. Ao mexer no caminho, mexa
 * nos dois lados E publique o web ANTES da API, senão os e-mails novos apontam
 * para um arquivo que ainda não existe.
 */

/* ------------------------------------------------------------------ *
 * Ícones (favicon / PWA)
 * ------------------------------------------------------------------ */

export const ICON_ASSETS = {
  favicon16: "/icons/favicon-16x16.png",
  favicon32: "/icons/favicon-32x32.png",
  appleTouch: "/icons/apple-touch-icon.png",
  androidChrome192: "/icons/android-chrome-192x192.png",
  androidChrome512: "/icons/android-chrome-512x512.png",
} as const;

/**
 * ⚠️ Estes caminhos também aparecem em dois arquivos que o bundler não
 * enxerga como código: `index.html` (`<link rel="icon">`, `apple-touch-icon`,
 * `og:image`) e `public/site.webmanifest` (`icons[].src`). Mantenha os três
 * em sincronia.
 */

/* ------------------------------------------------------------------ *
 * Mensagens — arte dos blocos decoradores
 * ------------------------------------------------------------------ */

/**
 * Faixas de cabeçalho/rodapé do editor de Mensagens, indexadas pela
 * `DecoratorVariant` que o bloco guarda no banco.
 *
 * O banco persiste o NOME da variante (`'footer-wave-dark'`), nunca o caminho —
 * então mover os arquivos não exige migração, só editar este mapa.
 *
 * Os nomes de arquivo são idênticos aos de `assets/messages/` no Flutter (lá
 * são `.png` em vez de `.webp`), para que os dois renderizadores continuem
 * legíveis lado a lado.
 */
export const MESSAGE_DECORATOR_ASSETS = {
  /** Logo recortado 394×156, sem margem transparente — NÃO é full-bleed (spec §6). */
  "header-logo": "/messages/header-logo-compact.webp",
  "header-logo-stripes": "/messages/header-logo-stripes.webp",
  "footer-wave-dark": "/messages/footer-wave-dark.webp",
  "footer-wave-logo": "/messages/footer-wave-logo.webp",
  "footer-diagonal-stripes": "/messages/footer-diagonal-stripes.webp",
  "footer-wave-gold": "/messages/footer-wave-gold.webp",
  "footer-geometric": "/messages/footer-geometric.webp",
} as const;

/**
 * `messages/header-logo.webp` é o logo ORIGINAL, sem recorte — nenhum código do
 * web aponta para ele hoje (o `header-logo` renderizado é o `-compact`). Ele
 * continua versionado por ser a arte-fonte do `assets/messages/header-logo.png`
 * do Flutter. Não apague sem trocar o lado do Flutter também.
 */

/* ------------------------------------------------------------------ *
 * Terceiros
 * ------------------------------------------------------------------ */

export const VENDOR_ASSETS = {
  /**
   * Worker do pdf.js, copiado de `pdfjs-dist`. Os cMaps continuam vindo da
   * unpkg (`cMapUrl`), então este arquivo não tem irmãos — pode andar sozinho.
   */
  pdfWorker: "/vendor/pdf.worker.min.js",
  /**
   * Decoder Draco (Google), consumido pelo `DRACOLoader` do three.js via
   * `setDecoderPath()`. É um DIRETÓRIO, não um arquivo: o loader escolhe entre
   * `draco_decoder.js` e `draco_decoder.wasm` em runtime conforme o navegador,
   * então a barra final é obrigatória.
   */
  dracoDecoderDir: "/vendor/draco/",
} as const;

/* ------------------------------------------------------------------ *
 * Texturas
 * ------------------------------------------------------------------ */

/**
 * Normal maps do acabamento de tinta.
 *
 * Hoje só o preview 2D do cadastro lê estes arquivos
 * (`painting/effects/paint-finish-config.ts`). Ficam em `textures/` — e não em
 * `models/` nem sob o Truck Studio — porque quando a cena 3D trocar os color
 * pickers pelo catálogo real de tintas, os mesmos arquivos vão alimentar os
 * DOIS renderizadores.
 *
 * Convivem no mesmo `textures/`, plano, que os conjuntos PBR do chão: o nome do
 * arquivo já diz de que família é (`asphalt_nor` vs `metallic_nor`), e separar
 * por consumidor seria agrupar por feature — o oposto do resto de `public/`.
 * A nomenclatura `<material>_<mapa>` é a mesma dos vizinhos.
 *
 * ⚠️ O Flutter ainda usa os nomes antigos em `mobile-flutter/assets/paint/`
 * (`metallic-normal-map.jpg`, `pearl-normal-map.jpg`). Os dois lados
 * divergiram; renomear lá é uma edição de `paint_preview_renderer.dart`.
 */
export const PAINT_TEXTURE_ASSETS = {
  metallicNormal: "/textures/metallic_nor.jpg",
  pearlNormal: "/textures/pearl_nor.jpg",
} as const;

/**
 * Havia um terceiro arquivo, `flake.jpg` (769 kB), sobreposto em "screen" sobre
 * metálico/perolizado. Foi descartado em 2026-07-31. O renderizador já tinha um
 * caminho procedural (`addSparkleParticles`) como fallback de carga falha, e
 * esse virou o único — ver `canvas-normal-map-renderer.tsx`.
 */

/* ------------------------------------------------------------------ *
 * Truck Studio — geometria, texturas de solo, cenários, montadoras
 * ------------------------------------------------------------------ */

/**
 * Diretórios que o engine do Truck Studio consome.
 *
 * São DIRETÓRIOS (barra final) e não arquivos: o conteúdo é escolhido em
 * runtime pelos manifestos servidos (`environments.json`, `brands.json`,
 * `props.json`, `cabs.json`), que guardam caminhos **absolutos** a partir da
 * raiz do site. `assetUrl()` (engine/catalog/catalog.ts) deixa passar qualquer
 * caminho que já comece com `/`, então manifesto e código apontam para o mesmo
 * lugar sem prefixo intermediário.
 *
 * O engine importa isto via `engine/core/paths.ts` — o único ponto em que ele
 * toca no código do app. Ao mover qualquer um destes diretórios, ajuste aqui E
 * reescreva os caminhos dentro dos manifestos correspondentes.
 */
export const STUDIO_ASSETS = {
  /** Cabines, carretas e o baú refrigerado, mais os `*_meta.json` e `cabs.json`. */
  vehiclesDir: "/models/vehicles/",
  /** Objetos de cenário espalhados pela cena (`props.json` + um `.glb` por id). */
  propsDir: "/models/props/",
  /** Todas as texturas de material: conjuntos PBR do chão, macro_noise e os normal maps de tinta. */
  texturesDir: "/textures/",
  /** Um subdiretório por cenário (`sky.hdr`, `sky.jpg`, `thumb.webp`) + `environments.json`. */
  environmentsDir: "/environments/",
  /** Um subdiretório por montadora (`logo.webp`, `logo-light.webp`, `models/*.webp`) + `brands.json`. */
  truckBrandsDir: "/brands/trucks/",
} as const;

/**
 * ⚠️ `models/vehicles/scania.fbx` tem 44 MB e **é baixado em runtime** — é a
 * cabine `scania` E a `daf` (`cabs.json`, `format: "fbx-scania"`). Não é arte
 * de origem esquecida no deploy; apagar quebra duas das seis montadoras.
 */
