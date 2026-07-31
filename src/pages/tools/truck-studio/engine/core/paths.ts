/* Caminhos públicos do studio — a ÚNICA porta entre o engine e o app.
   ---------------------------------------------------------------------------
   O resto do engine é um port autocontido: não importa nada de `@/`. Este
   módulo é a exceção deliberada, e existe para que os diretórios servidos
   tenham UMA definição em todo o repositório — `src/config/assets.ts` — em vez
   de uma cópia aqui e outra em cada manifesto.

   Por que não um `ASSET_BASE` único, como era quando tudo vivia em
   `/truck-studio/`: os assets deixaram de morar sob um prefixo comum. Cabines
   são geometria (`/models/vehicles/`), o chão é textura (`/textures/`)
   e o decoder Draco é dependência de terceiros (`/vendor/draco/`, ao lado do
   worker do pdf.js). Um prefixo só não descreve mais nada de útil — cada
   família tem o seu, e os manifestos servidos guardam caminhos absolutos.

   Consequência prática: `assetUrl()` (../catalog/catalog.ts) devolve qualquer
   caminho iniciado por `/` intocado, então manifesto e código convergem para a
   mesma URL sem ninguém prefixar nada. */
import { STUDIO_ASSETS, VENDOR_ASSETS } from '@/config/assets';

/** `/models/vehicles/` — cabines, carreta, baú, `cabs.json`, `*_meta.json`. */
export const VEHICLES_DIR = STUDIO_ASSETS.vehiclesDir;

/** `/models/props/` — `props.json` e um `.glb` por prop espalhado na cena. */
export const PROPS_DIR = STUDIO_ASSETS.propsDir;

/** `/textures/` — conjuntos PBR do chão, `macro_noise.webp` e os normal maps de tinta. */
export const TEXTURES_DIR = STUDIO_ASSETS.texturesDir;

/** `/environments/` — um diretório por cenário + `environments.json`. */
export const ENVIRONMENTS_DIR = STUDIO_ASSETS.environmentsDir;

/** `/brands/trucks/` — um diretório por montadora + `brands.json`. */
export const TRUCK_BRANDS_DIR = STUDIO_ASSETS.truckBrandsDir;

/** `/vendor/draco/` — diretório (não arquivo) exigido por `DRACOLoader.setDecoderPath`. */
export const DRACO_DECODER_DIR = VENDOR_ASSETS.dracoDecoderDir;
