/**
 * Fonte única de verdade para os caminhos de assets servidos — os de `public/`
 * e a árvore do Truck Studio, que hoje mora na API.
 *
 * Tudo que mora em `public/` é servido cru na raiz do site (`/`), então o
 * caminho é uma URL pública — não um import resolvido pelo bundler. Isso quer
 * dizer que o TypeScript NÃO acusa nada quando um arquivo é movido: a única
 * proteção contra 404 silencioso é todo mundo apontar para as constantes daqui.
 *
 * **Ao mover algo dentro de `public/`, edite SÓ este arquivo.**
 *
 * O mesmo raciocínio vale — e vale MAIS FORTE — para a árvore do Truck Studio:
 * ela deixou de ser servida pelo web e passou a ser servida pela API sob
 * `STUDIO_ASSETS_BASE`. Um caminho errado ali não é só um 404 silencioso: é um
 * 404 contra a ORIGEM ERRADA, que em produção nem sequer tem os arquivos.
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
 * - `textures/`   → **só** os dois normal maps de tinta (`PAINT_TEXTURE_ASSETS`);
 *                   o resto do diretório mudou para a API junto com o studio
 *
 * Fora de `public/`, servido pela API sob `STUDIO_ASSETS_BASE`:
 *
 * - `models/vehicles/` → geometria 3D das cabines
 * - `textures/`        → conjuntos PBR de chão + `macro_noise.webp`
 * - `environments/`    → cenários do Truck Studio (HDRI + céu + thumb)
 * - `brands/trucks/`   → logos e fotos das montadoras (`TruckManufacturer`)
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
   *
   * **NÃO foi junto para a API** quando a árvore do studio mudou. É dependência
   * de BUILD vendorizada — irmã do worker do pdf.js logo acima, não arte de
   * cena. São ~200 kB versionados, e o `.wasm` é código executado no contexto
   * da página: mantê-lo na mesma origem evita a discussão de CSP/CORS que
   * carregar WebAssembly de outro host abriria. Continua absoluto de raiz de
   * site (`/vendor/…`) de propósito — não passa por `assetUrl()`.
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
 * Conviviam no mesmo `textures/`, plano, que os conjuntos PBR do chão: o nome
 * do arquivo já diz de que família é (`asphalt_nor` vs `metallic_nor`), e
 * separar por consumidor seria agrupar por feature — o oposto do resto de
 * `public/`. A nomenclatura `<material>_<mapa>` é a mesma dos vizinhos.
 *
 * ⚠️ **Estes DOIS arquivos continuam em `web/public/textures/`** mesmo depois de
 * o resto de `textures/` ter migrado para a API (ver `STUDIO_ASSETS_BASE`
 * abaixo). O consumidor aqui é o preview de acabamento do cadastro de Tinta —
 * uma tela EM PRODUÇÃO que não tem nada a ver com o Truck Studio e não pode
 * passar a depender de a API estar servindo a árvore do estúdio. São 2 arquivos
 * pequenos; o motivo de a árvore do studio ter saído (300 MB) não se aplica.
 * A duplicação de nome de diretório é intencional e o `_nor` no fim do nome é o
 * que continua dizendo a qual família cada arquivo pertence.
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
 * Onde a árvore de assets do Truck Studio está HOSPEDADA.
 *
 * Ela não mora mais em `web/public/`. São ~300 MB de geometria, HDRI e mapas
 * PBR — acima do limite de 100 MB por arquivo do GitHub e, somados aos 446 MB
 * que `public/` chegou a ter, um clone que ninguém quer. Quem serve isso agora
 * é a API, sob este prefixo.
 *
 * **A VERSÃO ESTÁ NA BASE, NÃO NO NOME DOS ARQUIVOS** (`/studio-assets/v1/…`).
 * Content-hash em 400+ arquivos obrigaria a reescrever todos os manifestos a
 * cada bake. Com um diretório de versão:
 *
 * - `Cache-Control: immutable` fica seguro (a URL nunca muda de conteúdo);
 * - a virada é atômica (`v1` inteiro → `v2` inteiro, sem estado misto);
 * - o rollback é trocar UMA variável de ambiente.
 *
 * Modos (ver `.env.example`):
 *
 * - `/studio-assets/v1` (padrão) → mesma origem da página. Em dev, o proxy do
 *   `vite.config.ts` encaminha para a API; em produção, o nginx faz o mesmo.
 *   Mesma origem = sem CORS, sem preflight, sem canvas contaminado.
 * - `https://api.exemplo.com.br/studio-assets/v1` → origem absoluta da API.
 *   Exige CORS na API (o three.js pede `crossOrigin=anonymous` por padrão).
 * - `http://localhost:8080` → servidor estático qualquer, para trabalhar offline.
 *
 * Sem barra no fim: `STUDIO_ASSETS` já traz o separador em cada diretório.
 */
export const STUDIO_ASSETS_BASE: string = (() => {
  const raw: unknown =
    typeof import.meta !== "undefined" ? import.meta.env?.VITE_STUDIO_ASSETS_BASE : undefined;
  const v = (typeof raw === "string" ? raw : "").trim().replace(/\/+$/, "");
  /* Um valor que sobra VAZIO — variável em branco, ou literalmente "/" — não é
     "mesma origem, raiz do site": é a base sumindo, e todo assetUrl() passaria
     a devolver `/models/…` contra a origem do web, que não tem os arquivos.
     Cai no padrão, que é o caminho que o proxy do vite e o nginx conhecem. */
  return v || "/studio-assets/v1";
})();

/**
 * Diretórios que o engine do Truck Studio consome, **relativos a
 * `STUDIO_ASSETS_BASE`**.
 *
 * São DIRETÓRIOS (barra final) e não arquivos: o conteúdo é escolhido em
 * runtime pelos manifestos servidos (`environments.json`, `brands.json`,
 * `cabs.json`), que guardam caminhos **relativos** — `models/vehicles/x.glb`,
 * nunca `/models/vehicles/x.glb`.
 *
 * Por que relativos, e por que isso é o ponto do desenho todo: enquanto os
 * manifestos guardavam caminho absoluto de raiz de site, cada um deles era uma
 * segunda declaração de ONDE a árvore está hospedada — dado que o tsc não lê e
 * que só falha em runtime. Agora existe UM lugar que sabe disso (`assetUrl()`,
 * em `engine/catalog/catalog.ts`, que prefixa a base), e mover a árvore inteira
 * é editar `VITE_STUDIO_ASSETS_BASE`.
 *
 * Consequência que vale repetir: **caminho relativo aqui NÃO é caminho de raiz
 * de site.** Concatenar um destes diretórios e entregar o resultado direto a um
 * `fetch`/`new Image()`/loader do three.js resolve contra a origem do WEB, que
 * não tem mais os arquivos. Tudo tem de passar por `assetUrl()`.
 *
 * O engine importa isto via `engine/core/paths.ts` — o único ponto em que ele
 * toca no código do app. Ao mover qualquer um destes diretórios, ajuste aqui E
 * reescreva os caminhos dentro dos manifestos correspondentes.
 */
export const STUDIO_ASSETS = {
  /** Cabines, carretas e o baú refrigerado, mais os `*_meta.json` e `cabs.json`. */
  vehiclesDir: "models/vehicles/",
  /** Conjuntos PBR do chão + `macro_noise.webp`. (Os normal maps de tinta NÃO estão aqui — ver `PAINT_TEXTURE_ASSETS`.) */
  texturesDir: "textures/",
  /** Um subdiretório por cenário (`sky.hdr`, `sky.jpg`, `thumb.webp`) + `environments.json`. */
  environmentsDir: "environments/",
  /** Um subdiretório por montadora (`logo.webp`, `logo-light.webp`, `models/*.webp`) + `brands.json`. */
  truckBrandsDir: "brands/trucks/",
} as const;

/**
 * ⚠️ `models/vehicles/scania.fbx` tem 44 MB e **é baixado em runtime** — é a
 * cabine `scania` E a `daf` (`cabs.json`, `format: "fbx-scania"`). Não é arte
 * de origem esquecida no deploy; apagar quebra duas das seis montadoras. Ele é
 * sozinho o maior motivo de a árvore ter saído do git.
 */
