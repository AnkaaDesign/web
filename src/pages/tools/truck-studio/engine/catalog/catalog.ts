/* Catálogo do configurador: cenários (mapas) + fabricantes/modelos.
   ---------------------------------------------------------------------------
   Fonte única de verdade para os dois manifestos servidos:
     /environments/environments.json → cenários (HDRI, chão, preset de luz)
     /brands/trucks/brands.json      → fabricantes e seus modelos de caminhão

   Segue o mesmo padrão de vehicle/models.ts/loadManifests(): busca com fallback embutido
   e sonda de disponibilidade por HEAD. A diferença é que aqui NADA pode lançar:
   o seletor abre antes do 3D existir, então uma falha de rede tem de degradar
   para um catálogo mínimo — mas ainda utilizável — em vez de travar o boot. */
import { ENVIRONMENTS_DIR, TRUCK_BRANDS_DIR } from '../core/paths';

/* ---------------- tipos ----------------
   Eram @typedef JSDoc; agora são o contrato de verdade que o tsc verifica. Toda
   entrada sai do normalizador com TODOS os campos preenchidos, e é por isso que
   quase nada aqui é opcional: quem consome nunca precisa de `?? default`. */

export interface GroundDef {
  type: string;
  /** albedo sRGB, tileável; caminho absoluto */
  diffuse: string | null;
  /** mapa linear de rugosidade */
  rough: string | null;
  /** normal map OpenGL */
  normal: string | null;
  /** oclusão de ambiente — opcional na maioria dos conjuntos */
  ao: string | null;
  /** mapa de deslocamento */
  disp: string | null;
  /** tiling [u, v] na pista de 12 x 340 m */
  repeat: [number, number];
}

export interface CreditDef {
  source?: string;
  asset?: string;
  url?: string;
  author?: string;
  license?: string;
}

export interface EnvironmentDef {
  /** kebab-case, estável (vai para o localStorage) */
  id: string;
  /** título pt-BR do card */
  name: string;
  subtitle: string;
  /** imagem do card; caminho absoluto */
  thumb: string | null;
  /** equirect .hdr; null → céu procedural */
  hdri: string | null;
  ground: GroundDef;
  /** false → o HDRI é o céu */
  showSkyDome: boolean;
  /** manter pista/acostamento/grama procedurais */
  showRoad: boolean;
  /** radianos; alinha a estrada da foto com o +Z do 3D */
  envRotation: number;
  /** 0..1 → scene.backgroundBlurriness */
  backgroundBlur: number;
  /** um dos PRESET_ORDER de scene.ts */
  preset: string;
  timeOfDay: 'dia' | 'noite';
  /** override de renderer.toneMappingExposure */
  exposure: number;
  envIntensity: number;
  /* Blocos crus repassados a environment.ts, que valida e limita cada número.
     Duplicar essa validação aqui criaria duas fontes de verdade para os mesmos
     limites — o que NÃO pode é este normalizador descartá-los em silêncio. */
  grounded: RawBlock | null;
  nearGround: RawBlock | null;
  scatter: RawBlock[];
  roadside: RawBlock[];
  shadowCatcher: RawBlock | null;
  lamps: RawBlock | null;
  /** fundo LDR de alta resolução; ausente → environment.ts usa o próprio HDRI */
  backgroundImage: string | null;
  credit: CreditDef | null;
  /** preenchido pela sonda: false = HDRI ausente (degradado) */
  available: boolean;
}

export interface ModelDef {
  /** kebab-case, estável (vai para o localStorage) */
  id: string;
  /** ex.: 'S730 V8' */
  name: string;
  /** ex.: 'Highline · 6x4' */
  subtitle: string;
  /** foto do card; caminho absoluto */
  image: string | null;
  /** id em models/cabs.json → geometria 3D carregada */
  cab: string;
  /** tag de canto em pt-BR (ex.: 'Prévia') */
  note: string | null;
  /**
   * Existe geometria 3D para este modelo?
   *
   * AUTORADO no manifesto, não sondado: quem sabe se a cabine existe é
   * models/cabs.json, que este módulo de propósito não conhece — catalog.ts
   * responde "o que o usuário pode escolher", models.ts responde "o que o
   * carregador consegue montar". Um modelo indisponível continua LISTADO (o
   * seletor mostra o card marcado "Em breve"), mas não é clicável.
   */
  available: boolean;
}

export interface ManufacturerDef {
  id: string;
  name: string;
  /** logo do card; caminho absoluto */
  logo: string | null;
  /** cor da marca (anel de hover do card) */
  accent: string;
  /** sempre não-vazio (fabricante sem modelo é descartado) */
  models: ModelDef[];
  /**
   * preenchido pela sonda: false = logo ausente (DEGRADADO, não inutilizável —
   * o card renderiza só o nome e continua clicável).
   *
   * Não existe indisponibilidade em nível de FABRICANTE: quem ainda não saiu é
   * o caminhão, e é o card do modelo que diz isso. Ver ModelDef.available.
   */
  available: boolean;
}

export interface Choice {
  envId: string | null;
  manufacturerId: string | null;
  modelId: string | null;
}

/** Uma escolha já resolvida contra o catálogo — nenhum id é nulo. */
export interface ResolvedChoice {
  envId: string;
  manufacturerId: string;
  modelId: string;
}

export interface Catalog {
  environments: EnvironmentDef[];
  manufacturers: ManufacturerDef[];
  /** true depois que loadCatalog() resolveu */
  loaded: boolean;
  /** true se QUALQUER uma das listas veio do embutido */
  fallback: boolean;
}

/** Bloco de manifesto repassado cru: só environment.ts sabe lê-lo. */
export type RawBlock = Record<string, unknown>;
/** JSON ainda não validado. */
type Raw = Record<string, unknown>;

export const catalog: Catalog = {
  environments: [], manufacturers: [], loaded: false, fallback: false,
};

const CHOICE_KEY = 'truckstudio.choice.v1';

/* ---------------- fallbacks embutidos ---------------- */

/* UM cenário: exatamente o ambiente procedural que scene/scene.ts já sabe montar
   sozinho (sem HDRI, com céu e pista procedurais). Ou seja, o estúdio continua
   funcionando com ZERO assets baixados. */
const FALLBACK_ENVIRONMENTS: Raw[] = [{
  id: 'estudio',
  name: 'Estúdio',
  subtitle: 'Cenário procedural, sem downloads',
  thumb: null,
  hdri: null,
  ground: { type: 'asphalt', diffuse: null, rough: null, normal: null, repeat: [4, 60] },
  showSkyDome: true,
  showRoad: true,
  envRotation: 0,
  backgroundBlur: 0,
  preset: 'estudio',
  timeOfDay: 'dia',
  exposure: 1,
  envIntensity: 1,
  credit: null,
}];

/* Duas marcas com um modelo cada, apontando para as cabines que vehicle/models.ts já
   carrega. `image`/`logo` são null de propósito: o seletor TEM de tolerar
   imagem nula (renderiza só o texto) — nunca assuma URL de imagem aqui. */
const FALLBACK_MANUFACTURERS: Raw[] = [
  {
    id: 'scania', name: 'Scania', logo: null, accent: '#041E42',
    models: [{
      id: 'scania-s730', name: 'S730 V8', subtitle: 'Highline · 6x4',
      image: null, cab: 'scania', note: null,
    }],
  },
  {
    id: 'volvo', name: 'Volvo', logo: null, accent: '#1B365D',
    models: [{
      id: 'volvo-fh16-750', name: 'FH16 750', subtitle: 'Globetrotter XL · 6x4',
      image: null, cab: 'volvo', note: null,
    }],
  },
];

/* ---------------- helpers ---------------- */

/* Mensagem legível de um valor lançado. `catch (e)` é `unknown` sob strict, e o
   que chega aqui nem sempre é um Error (um reject de rede pode ser qualquer
   coisa) — então nunca leia `.message` às cegas. */
const errText = (e: unknown): string =>
  (e instanceof Error ? e.message : String(e));

/* Já é uma URL final? Então devolver intocado — os manifestos guardam
   caminhos absolutos ('/models/props/stone_01.glb'), e prefixar viraria lixo. */
const ABSOLUTE_RE = /^(?:https?:\/\/|data:|blob:|\/\/|\/)/i;

/**
 * Normaliza um caminho vindo de manifesto para URL servível.
 * Os manifestos são absolutos, então na prática isto é pass-through:
 * assetUrl('/environments/urbano/thumb.webp') → '/environments/urbano/thumb.webp'
 * Um caminho relativo remanescente é resolvido contra a raiz do site — vira um
 * 404 visível em vez de silenciosamente virar outra coisa.
 * Devolve '' para null/undefined — <img src=""> não carrega nada, enquanto
 * String(null) viraria a URL literal "null" e sujaria o console com um 404.
 * @param {string|null|undefined} path
 * @returns {string}
 */
export function assetUrl(path: string | null | undefined): string {
  if (path == null) return '';
  const p = String(path).trim();
  if (!p) return '';
  if (ABSOLUTE_RE.test(p)) return p;
  return '/' + p.replace(/^\.\//, '');
}

async function fetchJSON(url: string): Promise<Raw> {
  const r = await fetch(url, { cache: 'no-cache' });
  if (!r.ok) throw new Error(url + ' → ' + r.status);
  return r.json();
}

/* HEAD na URL final. Qualquer erro (rede, CORS, offline) conta como ausente. */
async function exists(path: string | null): Promise<boolean> {
  const url = assetUrl(path);
  if (!url) return false;
  try { return (await fetch(url, { method: 'HEAD' })).ok; }
  catch { return false; }
}

const str = (v: unknown, fallback = ''): string => (typeof v === 'string' && v.trim() ? v.trim() : fallback);
const nullableStr = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const num = (v: unknown, fallback: number): number => (Number.isFinite(v) ? v as number : fallback);
const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);
/* Arrays reprovam de propósito: todo bloco opcional do manifesto é um objeto de
   configuração, e um array aqui é erro de digitação, não dado válido. */
const obj = (v: unknown): RawBlock | null =>
  (v && typeof v === 'object' && !Array.isArray(v) ? v as RawBlock : null);
/* Listas de entradas (espalhamento, postes de beira). Devolve [] em vez de null
   para o consumidor poder iterar sem checar. */
const arr = (v: unknown): RawBlock[] =>
  (Array.isArray(v) ? v.filter((e): e is RawBlock => !!e && typeof e === 'object') : []);

/* ---------------- validação / normalização ----------------
   Manifesto é dado externo: valide, não confie. Toda entrada volta com TODOS os
   campos preenchidos, para nenhum consumidor precisar de `?? default`. */

function normalizeGround(raw: unknown): GroundDef {
  const g = (raw && typeof raw === 'object' ? raw : {}) as Raw;
  const rep = g.repeat;
  const repeat: [number, number] = Array.isArray(rep) && rep.length === 2
    && Number.isFinite(rep[0]) && Number.isFinite(rep[1])
    ? [rep[0], rep[1]] : [4, 60];
  return {
    type: str(g.type, 'asphalt'),
    diffuse: nullableStr(g.diffuse),
    rough: nullableStr(g.rough),
    normal: nullableStr(g.normal),
    /* Oclusão de ambiente e deslocamento: opcionais, e ausentes na maioria dos
       conjuntos. Precisam estar aqui pelo mesmo motivo de sempre — este
       normalizador é lista branca, então campo que não aparece some calado. */
    ao: nullableStr(g.ao),
    disp: nullableStr(g.disp),
    repeat,
  };
}

/** @returns {EnvironmentDef|null} null → entrada inutilizável, descartar. */
function normalizeEnvironment(input: unknown): EnvironmentDef | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as Raw;
  const id = nullableStr(raw.id);
  const name = nullableStr(raw.name);
  if (!id || !name) return null;
  const hdri = nullableStr(raw.hdri);
  const out: EnvironmentDef = {
    id,
    name,
    subtitle: str(raw.subtitle, ''),
    thumb: nullableStr(raw.thumb),
    hdri,
    ground: normalizeGround(raw.ground),
    /* sem HDRI o céu procedural é obrigatório, senão o fundo fica preto */
    showSkyDome: bool(raw.showSkyDome, !hdri),
    showRoad: bool(raw.showRoad, true),
    envRotation: num(raw.envRotation, 0),
    backgroundBlur: num(raw.backgroundBlur, 0),
    preset: str(raw.preset, 'ensolarado'),
    timeOfDay: raw.timeOfDay === 'noite' ? 'noite' : 'dia',
    exposure: num(raw.exposure, 1),
    envIntensity: num(raw.envIntensity, 1),
    /* Blocos do céu projetado no chão (GroundedSkybox), do receptor de sombra e
       dos postes de luz. Passam adiante como objetos crus de propósito:
       scene/environment.ts já valida e limita cada número, e duplicar essa validação
       aqui só criaria duas fontes de verdade para os mesmos limites. O que NÃO
       pode acontecer é esta função descartá-los em silêncio — este normalizador
       é uma lista branca, então um campo que não esteja aqui simplesmente
       desaparece e o recurso morre sem erro nenhum. */
    grounded: obj(raw.grounded),
    /* Disco de chão CG que cobre o campo próximo — é o que o usuário realmente
       olha, então perdê-lo aqui devolveria a foto esticada e borrada de perto.
       scene/environment.ts valida e limita cada número; aqui só não pode sumir. */
    nearGround: obj(raw.nearGround),
    /* Geometria de verdade em cima do chão — tufos, pedras, ervas, entulho — e as
       fileiras de beira de pista. É o que tira o aspecto "estático demais" do
       campo próximo, então some daqui = o recurso morre calado. */
    scatter: arr(raw.scatter),
    roadside: arr(raw.roadside),
    shadowCatcher: obj(raw.shadowCatcher),
    lamps: obj(raw.lamps),
    /* Fundo LDR de alta resolução: o chão visível vem daqui, a iluminação
       continua vindo do .hdr. Ausente → scene/environment.ts usa o próprio HDRI. */
    backgroundImage: nullableStr(raw.backgroundImage),
    credit: (raw.credit && typeof raw.credit === 'object' ? raw.credit : null) as CreditDef | null,
    available: true,                 // definido de verdade pela sonda mais abaixo
  };
  warnDroppedKeys(raw, out, envDropWarned, 'cenário "' + id + '"');
  return out;
}

/* Rede de segurança da lista branca.
   ---------------------------------------------------------------------------
   Esta função é uma LISTA BRANCA: campo do manifesto que não aparece acima é
   descartado em silêncio. Isso já derrubou três recursos inteiros sem gerar um
   único erro — `grounded`, depois `nearGround`, depois `scatter`/`roadside`. Em
   todos os casos o manifesto estava certo, o motor estava certo, e o dado
   simplesmente evaporava no meio.
   Então: se o manifesto traz uma chave que a saída normalizada não tem, avisa
   ALTO uma vez por chave. É barato (roda 3 vezes por boot) e transforma uma
   falha muda numa linha no console apontando exatamente para a correção. */
function warnDroppedKeys(raw: Raw, out: object, seen: Set<string>, label: string) {
  for (const key of Object.keys(raw)) {
    if (key in out || seen.has(key)) continue;
    seen.add(key);
    console.warn('[truck-studio] campo "' + key + '" do ' + label + ' foi DESCARTADO por'
      + ' normalizeEnvironment() em catalog/catalog.ts. A lista branca não o conhece —'
      + ' adicione-o lá, senão o recurso que depende dele nunca recebe o dado.');
  }
}
const envDropWarned = new Set<string>();

/** @returns {ModelDef|null} */
function normalizeModel(input: unknown, manufacturerId: string): ModelDef | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as Raw;
  const id = nullableStr(raw.id);
  const name = nullableStr(raw.name);
  if (!id || !name) return null;
  return {
    id,
    name,
    subtitle: str(raw.subtitle, ''),
    image: nullableStr(raw.image),
    /* sem `cab` explícito, o id do fabricante é o palpite certo em cabs.json */
    cab: str(raw.cab, manufacturerId),
    note: nullableStr(raw.note),
    /* Default TRUE: um manifesto antigo, sem o campo, continua com todos os
       modelos selecionáveis — exatamente o comportamento anterior. Só quem
       escreve `false` explicitamente vira "Em breve". */
    available: bool(raw.available, true),
  };
}

/** @returns {ManufacturerDef|null} */
function normalizeManufacturer(input: unknown): ManufacturerDef | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as Raw;
  const id = nullableStr(raw.id);
  const name = nullableStr(raw.name);
  if (!id || !name) return null;
  const models = (Array.isArray(raw.models) ? raw.models : [])
    .map((m: unknown) => normalizeModel(m, id))
    .filter((m): m is ModelDef => m !== null);
  /* fabricante sem modelo não tem passo 3 — seria um beco sem saída no seletor */
  if (!models.length) return null;
  return {
    id,
    name,
    logo: nullableStr(raw.logo),
    accent: str(raw.accent, '#3b82f6'),
    models,
    available: true,                 // definido de verdade pela sonda mais abaixo
  };
}

/* ---------------- carga ---------------- */

/* Promessa memoizada: studio.ts dá boot uma vez, mas o seletor pode reabrir e
   chamar loadCatalog() de novo — sem isto seriam 2 fetches e 2 sondas. */
let loading: Promise<Catalog> | null = null;

async function loadEnvironments() {
  try {
    const j = await fetchJSON(ENVIRONMENTS_DIR + 'environments.json');
    const list = (Array.isArray(j?.environments) ? j.environments : [])
      .map(normalizeEnvironment).filter((e): e is EnvironmentDef => e !== null);
    if (!list.length) throw new Error('environments.json sem entradas válidas');
    return { list, fallback: false };
  } catch (e: unknown) {
    console.warn('[manifest] environments.json indisponível — usando cenário procedural padrão.',
      errText(e));
    return { list: FALLBACK_ENVIRONMENTS.map(normalizeEnvironment).filter((e): e is EnvironmentDef => e !== null), fallback: true };
  }
}

async function loadManufacturers() {
  try {
    const j = await fetchJSON(TRUCK_BRANDS_DIR + 'brands.json');
    const list = (Array.isArray(j?.manufacturers) ? j.manufacturers : [])
      .map(normalizeManufacturer).filter((m): m is ManufacturerDef => m !== null);
    if (!list.length) throw new Error('brands.json sem fabricantes válidos');
    return { list, fallback: false };
  } catch (e: unknown) {
    console.warn('[manifest] brands.json indisponível — usando catálogo mínimo Scania/Volvo.',
      errText(e));
    return { list: FALLBACK_MANUFACTURERS.map(normalizeManufacturer).filter((m): m is ManufacturerDef => m !== null), fallback: true };
  }
}

/* Sonda de disponibilidade.
   ATENÇÃO: `available: false` significa DEGRADADO, não inutilizável.
   - cenário sem HDRI no servidor → continua listado; applyEnvironment cai no céu
     procedural e o passo 1 segue funcionando;
   - fabricante sem logo → card renderiza só o nome.
   Quem declara `hdri: null`/`logo: null` de propósito NÃO está degradado: não há
   asset faltando, então `available` fica true. */
async function probeAvailability(environments: EnvironmentDef[], manufacturers: ManufacturerDef[]) {
  await Promise.all([
    ...environments.map(async env => {
      env.available = env.hdri ? await exists(env.hdri) : true;
    }),
    ...manufacturers.map(async man => {
      man.available = man.logo ? await exists(man.logo) : true;
    }),
  ]);
}

async function doLoadCatalog() {
  /* em paralelo e independentes: brands.json quebrado não pode derrubar os cenários */
  const [envs, mans] = await Promise.all([loadEnvironments(), loadManufacturers()]);

  catalog.environments = envs.list;
  catalog.manufacturers = mans.list;
  catalog.fallback = envs.fallback || mans.fallback;

  try { await probeAvailability(catalog.environments, catalog.manufacturers); }
  catch (e: unknown) {
    /* a sonda é otimização de UI; nunca deve impedir o catálogo de carregar */
    console.warn('[manifest] sonda de disponibilidade falhou — assumindo tudo disponível.',
      errText(e));
  }

  catalog.loaded = true;
  return catalog;
}

/**
 * Carrega os dois manifestos (em paralelo), valida e cai no embutido em qualquer
 * falha. Idempotente: chamadas repetidas devolvem a MESMA promessa. Nunca lança.
 * @returns {Promise<Catalog>}
 */
export function loadCatalog() {
  /* NÃO marcar como `async`: um async function embrulha o retorno numa promessa
     NOVA a cada chamada, e o contrato é devolver a MESMA promessa memoizada. */
  if (!loading) {
    loading = doLoadCatalog().catch((e: unknown) => {
      /* rede de segurança: mesmo um bug aqui dentro tem de deixar o estúdio abrir */
      console.warn('[manifest] catálogo indisponível — usando embutidos.', errText(e));
      catalog.environments = FALLBACK_ENVIRONMENTS.map(normalizeEnvironment).filter((e): e is EnvironmentDef => e !== null);
      catalog.manufacturers = FALLBACK_MANUFACTURERS.map(normalizeManufacturer).filter((m): m is ManufacturerDef => m !== null);
      catalog.fallback = true;
      catalog.loaded = true;
      return catalog;
    });
  }
  return loading;
}

/* ---------------- consultas ---------------- */

/**
 * @param {string} id
 * @returns {EnvironmentDef|undefined}
 */
export function getEnvironment(id: string | null | undefined): EnvironmentDef | undefined {
  if (!id) return undefined;
  return catalog.environments.find(e => e.id === id);
}

/**
 * @param {string} id
 * @returns {ManufacturerDef|undefined}
 */
export function getManufacturer(id: string | null | undefined): ManufacturerDef | undefined {
  if (!id) return undefined;
  return catalog.manufacturers.find(m => m.id === id);
}

/**
 * Procura o modelo em TODOS os fabricantes — o id do modelo é global, então a
 * UI nunca precisa saber a marca antes de resolver um modelo salvo.
 * @param {string} modelId
 * @returns {{ model: ModelDef, manufacturer: ManufacturerDef }|null}
 */
export function getModel(modelId: string | null | undefined): { model: ModelDef; manufacturer: ManufacturerDef } | null {
  if (!modelId) return null;
  for (const manufacturer of catalog.manufacturers) {
    const model = manufacturer.models.find(m => m.id === modelId);
    if (model) return { model, manufacturer };
  }
  return null;
}

/**
 * Primeiro cenário DISPONÍVEL (senão o primeiro da lista), e o primeiro modelo
 * COM GEOMETRIA (senão o primeiro da lista). Preferir o disponível dos dois
 * lados evita abrir o estúdio já degradado quando só o cenário 1 ainda não foi
 * baixado — e, do lado do caminhão, evita cair num modelo "Em breve", que é o
 * default para onde toda escolha inválida acaba drenando (backfill no seletor,
 * resolveChoice no studio.ts).
 * @returns {Choice}
 */
export function defaultChoice(): Choice {
  const env = catalog.environments.find(e => e.available) || catalog.environments[0] || null;
  /* O fabricante é derivado do MODELO, não escolhido antes dele: pegar
     `manufacturers[0]` e depois procurar um modelo dentro dele devolveria uma
     escolha vazia sempre que o primeiro fabricante da lista fosse um que ainda
     não saiu. */
  let manufacturer: ManufacturerDef | null = null;
  let model: ModelDef | null = null;
  for (const man of catalog.manufacturers) {
    const hit = man.models.find((m) => m.available);
    if (hit) { manufacturer = man; model = hit; break; }
  }
  if (!model) {                      // catálogo inteiro sem geometria: degrade
    manufacturer = catalog.manufacturers[0] || null;
    model = manufacturer ? manufacturer.models[0] : null;
  }
  return {
    envId: env ? env.id : null,
    manufacturerId: manufacturer ? manufacturer.id : null,
    modelId: model ? model.id : null,
  };
}

/* ---------------- escolha persistida ---------------- */

/* O modelo é a fonte de verdade da marca: se `modelId` não pertence a
   `manufacturerId`, conserta a marca em vez de gravar uma contradição. */
function normalizeChoice(choice: unknown): ResolvedChoice | null {
  if (!choice || typeof choice !== 'object') return null;
  const c = choice as Raw;
  const found = getModel(nullableStr(c.modelId));
  if (!found) return null;
  /* Um modelo que PERDEU a geometria (o manifesto mudou embaixo de uma escolha
     já salva) é tão inválido quanto um id que sumiu: devolver null aqui é o que
     manda o studio.ts reabrir o seletor em vez de bootar num "Em breve". */
  if (!found.model.available) return null;
  const env = getEnvironment(nullableStr(c.envId));
  if (!env) return null;
  return { envId: env.id, manufacturerId: found.manufacturer.id, modelId: found.model.id };
}

/**
 * Grava a escolha. Normaliza antes (marca derivada do modelo) e ignora erros de
 * escrita — navegador em modo privado / quota estourada não pode quebrar o fluxo.
 * @param {Choice} choice
 * @returns {Choice|null} a escolha normalizada que foi gravada, ou null se inválida
 */
export function saveChoice(choice: Choice | null | undefined): ResolvedChoice | null {
  if (!catalog.loaded) {
    console.warn('[catalog] saveChoice antes de loadCatalog() — escolha ignorada.');
    return null;
  }
  const normalized = normalizeChoice(choice);
  if (!normalized) return null;
  try { localStorage.setItem(CHOICE_KEY, JSON.stringify({ v: 1, ...normalized })); }
  catch { /* modo privado / quota — a escolha ainda vale para esta sessão */ }
  return normalized;
}

/**
 * Lê a escolha salva e REVALIDA os ids contra o catálogo carregado agora: um
 * envId de antes de os assets mudarem tem de virar null (o chamador então abre o
 * seletor), nunca um boot quebrado.
 * @returns {Choice|null}
 */
export function loadChoice(): ResolvedChoice | null {
  if (!catalog.loaded) {
    console.warn('[catalog] loadChoice antes de loadCatalog() — nada a validar.');
    return null;
  }
  let raw: string | null = null;
  /* o acesso em si pode lançar (Safari/Firefox em modo privado), não só a escrita */
  try { raw = localStorage.getItem(CHOICE_KEY); }
  catch { return null; }
  if (!raw) return null;
  let parsed: unknown = null;
  try { parsed = JSON.parse(raw); }
  catch { return null; }
  return normalizeChoice(parsed);
}

/** Apaga a escolha salva (ex.: catálogo mudou e o usuário quer recomeçar). */
export function clearChoice() {
  try { localStorage.removeItem(CHOICE_KEY); }
  catch { /* ignore */ }
}
