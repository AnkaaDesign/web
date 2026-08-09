/* Caminhos dos assets do studio — a ÚNICA porta entre o engine e o app.
   ---------------------------------------------------------------------------
   O resto do engine é um port autocontido: não importa nada de `@/`. Este
   módulo é a exceção deliberada, e existe para que os diretórios servidos
   tenham UMA definição em todo o repositório — `src/config/assets.ts` — em vez
   de uma cópia aqui e outra em cada manifesto.

   ATENÇÃO — MUDOU: os diretórios abaixo são RELATIVOS, não absolutos de raiz
   de site. A árvore de assets do studio (~300 MB) saiu de `web/public/` e é
   servida pela API sob `STUDIO_BASE` (`/studio-assets/v1` por padrão). Um
   `VEHICLES_DIR + 'x.glb'` entregue direto a um `fetch`, a um `new Image()` ou
   a um loader do three.js resolve contra a origem do WEB, que não tem mais os
   arquivos — e o sintoma é um 404 mudo, porque quase todo carregador daqui
   degrada em silêncio por desenho.

   Regra: TUDO que sai daqui passa por `assetUrl()` (../catalog/catalog.ts)
   antes de virar requisição. É `assetUrl()` que prefixa `STUDIO_BASE`, e é o
   único lugar do código que sabe onde a árvore está hospedada. Os manifestos
   servidos guardam caminhos relativos pelo mesmo motivo — assim manifesto e
   código convergem para a mesma URL sem ninguém repetir a base.

   Por que não um `ASSET_BASE` de feature, como era quando tudo vivia em
   `/truck-studio/`: aquele prefixo agrupava por FEATURE o que o resto de
   `public/` agrupa por TIPO, e a estrutura por tipo sobreviveu à mudança — ela
   é a que está espelhada dentro de `STUDIO_BASE`. O que `STUDIO_BASE` é, e
   `ASSET_BASE` não era, é uma declaração de HOSPEDAGEM: responde "em que
   servidor", não "de que feature". Por isso ele pode ter uma versão dentro
   (`/v1`) e ser trocado por variável de ambiente.

   A única exceção é `DRACO_DECODER_DIR`: continua absoluto e continua no web —
   é dependência de build vendorizada, não asset de cena. Ver `VENDOR_ASSETS`. */
import { STUDIO_ASSETS, STUDIO_ASSETS_BASE, VENDOR_ASSETS } from '@/config/assets';

/**
 * Raiz de onde a árvore do studio é servida — sem barra no fim
 * (`/studio-assets/v1`, ou uma origem absoluta da API).
 *
 * Exportado para quem precisa da base NUA: uma sonda de saúde, uma mensagem de
 * erro que diga contra qual host o download falhou, ou um `<link rel=preconnect>`
 * montado em runtime. Para montar URL de asset, use `assetUrl()` — não
 * concatene isto à mão, ou a normalização de barras vira sua responsabilidade.
 */
export const STUDIO_BASE = STUDIO_ASSETS_BASE;

/** `models/vehicles/` — cavalos, carreta, baú, `hitch.json`, `*_meta.json`.
 *  Relativo a `STUDIO_BASE`. (`cabs.json` foi aposentado — a geometria vem de
 *  `chassis[].file` no brands.json e o posicionamento de `hitch.json`.) */
export const VEHICLES_DIR = STUDIO_ASSETS.vehiclesDir;

/** `textures/` — conjuntos PBR do chão e `macro_noise.webp`. Relativo a `STUDIO_BASE`. */
export const TEXTURES_DIR = STUDIO_ASSETS.texturesDir;

/** `environments/` — um diretório por cenário + `environments.json`. Relativo a `STUDIO_BASE`. */
export const ENVIRONMENTS_DIR = STUDIO_ASSETS.environmentsDir;

/** `brands/trucks/` — um diretório por montadora + `brands.json`. Relativo a `STUDIO_BASE`. */
export const TRUCK_BRANDS_DIR = STUDIO_ASSETS.truckBrandsDir;

/**
 * `renders/` — renders pré-produzidos dos cards + `renders.json`.
 * Relativo a `STUDIO_BASE`.
 *
 * Layout: `renders/trucks/<manufacturerId>/<modelId>/<chassisId>/<colorId>.webp`.
 * Quem monta essas URLs é `catalog/renders.ts`, sempre por `assetUrl()`.
 */
export const RENDERS_DIR = STUDIO_ASSETS.rendersDir;

/**
 * `/vendor/draco/` — diretório (não arquivo) exigido por `DRACOLoader.setDecoderPath`.
 *
 * ABSOLUTO e servido pelo WEB, ao contrário de todos os outros daqui: NÃO passe
 * por `assetUrl()`. Ver a nota em `VENDOR_ASSETS.dracoDecoderDir`.
 */
export const DRACO_DECODER_DIR = VENDOR_ASSETS.dracoDecoderDir;
