/* Catálogo do configurador: cenários (mapas) + fabricantes/modelos.
   ---------------------------------------------------------------------------
   Fonte única de verdade para os dois manifestos servidos, ambos RELATIVOS a
   `STUDIO_BASE` (a árvore é servida pela API — ver core/paths.ts):
     environments/environments.json → cenários (HDRI, chão, preset de luz)
     brands/trucks/brands.json      → fabricantes e seus modelos de caminhão

   Este módulo também hospeda `assetUrl()`, o único ponto do engine que sabe
   ONDE a árvore está hospedada. Mora aqui, e não em core/paths.ts, porque
   `exists()` e `fetchJSON()` — as duas primeiras coisas do boot a tocar a rede
   — precisam dele, e porque paths.ts é de propósito só declaração.

   Segue o mesmo padrão de vehicle/models.ts/loadManifests(): busca com fallback embutido
   e sonda de disponibilidade por HEAD. A diferença é que aqui NADA pode lançar:
   o seletor abre antes do 3D existir, então uma falha de rede tem de degradar
   para um catálogo mínimo — mas ainda utilizável — em vez de travar o boot. */
import { ENVIRONMENTS_DIR, TRUCK_BRANDS_DIR, STUDIO_BASE } from '../core/paths';
import { getColor, defaultColorId } from './colors';

/* ---------------- tipos ----------------
   Eram @typedef JSDoc; agora são o contrato de verdade que o tsc verifica. Toda
   entrada sai do normalizador com TODOS os campos preenchidos, e é por isso que
   quase nada aqui é opcional: quem consome nunca precisa de `?? default`. */

export interface GroundDef {
  type: string;
  /** albedo sRGB, tileável; caminho relativo à base — resolver com assetUrl() */
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
  /** imagem do card; caminho relativo à base — resolver com assetUrl() */
  thumb: string | null;
  /** equirect .hdr; null → céu procedural */
  hdri: string | null;
  ground: GroundDef;
  /**
   * Equirect de NOITE do mesmo local, para a dissolvência do céu.
   *
   * Ausente ⇒ a noite continua sendo o plate de dia escurecido, que é o
   * comportamento de sempre e o degrade correto: um cenário sem par não pode
   * ficar sem céu. Ver scene/skyblend.ts.
   */
  hdriNight: string | null;
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
  /** geometria 3D real do cenário; presente → nearGround/scatter/pista saem */
  set: RawBlock | null;
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

/**
 * Uma CONFIGURAÇÃO DE CHASSI de um modelo — `6x2`, `6x4`, `4x2`, `8x4`.
 *
 * POR QUE É UM TIPO PRÓPRIO, e não mais um sufixo no `subtitle`. Até aqui o
 * `brands.json` listava `scania-r500 "Highline · 6x2"`, `scania-s730
 * "Highline · 6x4"` e `scania-r450 "Highline · 4x2"` como três MODELOS irmãos
 * que apontavam para a mesma cabine e a mesma foto. Ou seja: a taxonomia
 * `marca → modelo × chassi` já existia, achatada numa lista só — e o preço era
 * três cards idênticos, dois deles `available:false`, e nenhum lugar onde
 * dizer que a rodagem muda.
 *
 * O passo do seletor é DIRIGIDO POR DADO: qualquer taxonomia válida
 * (`modelo` = nome comercial como S730, ou = geração como "Scania S 2016")
 * popula a etapa sem uma linha de código nova. O que o motor garante é só o
 * invariante: `ModelDef.chassis` NUNCA é vazio — ver `normalizeModel()`.
 */
export interface ChassisDef {
  /** kebab-case, estável (vai para o localStorage e para o caminho do render) */
  id: string;
  /** ex.: '6x4' */
  name: string;
  /** ex.: 'Trator · 3 eixos' */
  subtitle: string;
  /** foto/render do card; caminho relativo à base — resolver com assetUrl() */
  image: string | null;
  /**
   * **A GEOMETRIA DESTE CHASSI** — caminho do `.glb` relativo a `STUDIO_BASE`
   * (ex.: `models/trucks/daf_xd_6x4t_sl.glb`). Resolver com `assetUrl()`.
   *
   * SUBSTITUIU O `cab` E O `cabs.json` INTEIRO, e o motivo é que aquela
   * indireção guardava DADO DERIVADO. `cabs.json` era indexado por um id de
   * cabine e os valores dele eram PÓS-NORMALIZAÇÃO: traziam assados por dentro
   * o `CAB_FORWARD_GAP = 0.10` e a convenção "traseira da cabine em z=0". Isso
   * os tornava inúteis para o desktop (que normaliza noutro ponto) e os
   * invalidava silenciosamente a cada re-bake — sem erro nenhum, só um caminhão
   * no lugar errado.
   *
   * A forma limpa, e a mesma nos dois apps: **`file` diz QUAL geometria,
   * `hitch.json` diz ONDE ela vai** (`groundY`, `centerX`, `orientYaw` e o
   * bloco da quinta roda, todos em ESPAÇO CRU DO GLB, com uma impressão digital
   * sha256 por arquivo para que dado velho seja DETECTÁVEL em vez de
   * silenciosamente errado).
   *
   * Um chassi sem `file` resolvível **falha alto** em vez de cair na malha de
   * outra montadora: renderizar um Scania quando pediram um DAF é pior que um
   * erro. Ver `resolveChassisFile()` em studio.ts.
   *
   * `null` só é legítimo num chassi `available: false` ("Em breve").
   */
  file: string | null;
  /** tag de canto autoral, como em ModelDef.note */
  note: string | null;
  /** false → card visível, marcado "Em breve", e NÃO clicável */
  available: boolean;
  /**
   * IDS ANTIGOS QUE ESTA CONFIGURAÇÃO ABSORVEU — a ponte de migração.
   *
   * `modelId` passou a nomear a GERAÇÃO (`scania-s-2016`) e não mais a potência
   * comercial (`scania-s730`), porque potência não tem geometria: S730 e S650
   * são a mesma malha. A potência desceu para o rótulo do CHASSI, que é onde
   * ela de fato distingue um produto de outro.
   *
   * Consequência: todo `truckstudio.choice.v1` gravado antes disso guarda um
   * `modelId` que hoje não resolve. Sem esta lista, cada um deles derrubaria a
   * escolha inteira e mandaria o visitante de volta ao seletor completo.
   * Com ela, `scania-s730` resolve para `{modelId:'scania-s-2016',
   * chassisId:'6x4-s730'}` e a visita continua exatamente onde parou.
   *
   * Mora no MANIFESTO e não numa tabela no código pelo motivo de sempre: quem
   * sabe qual id virou qual é quem gerou o catálogo. Uma tabela aqui seria uma
   * segunda taxonomia, atualizada por outra pessoa, num arquivo que o gerador
   * não lê.
   */
  aliases: string[];
  /**
   * OVERRIDE dos materiais que aceitam tinta neste `.glb` — substrings de nome,
   * case-insensitive. `null` = não declarado → herda do modelo e, se ele também
   * não declarar, vale a DETECÇÃO de `isPaintableMaterial()` (vehicle/models.ts),
   * que pergunta pela assinatura do shader em vez do nome.
   *
   * Mora no CHASSI porque a geometria é do chassi (`file`): quem sabe como o
   * bake nomeou a lataria é o ARQUIVO, e dois chassis do mesmo modelo podem ter
   * vindo de bakes diferentes — o Iveco Stralis e o Scania Streamline mudam o
   * nome do material de corpo entre o 4x2 e o 6x2.
   *
   * A herança é resolvida por `paintMaterialsOf()`, pelo mesmo motivo que
   * `fileOf()` existe: guardá-la já resolvida aqui apagaria a diferença entre
   * "não declarou" e "declarou igual ao modelo".
   */
  paintMaterials: string[] | null;
}

/**
 * Um acabamento de fábrica — ver `ModelDef.finishes` para o porquê de existir.
 *
 * Deliberadamente MENOR que um `ChassisDef`: um acabamento não tem geometria
 * própria (`file`), não tem eixos e não tem `available` — se o modelo carrega,
 * o acabamento carrega, porque é o MESMO arquivo com os mapas de tinta
 * mantidos.
 */
export interface FinishDef {
  /** kebab-case, estável — vai para o `localStorage` junto com a escolha. */
  id: string;
  /** nome pt-BR do card, no lugar onde uma tinta poria o nome dela. */
  name: string;
  /** a linha de baixo do card: o que a tinta poria como acabamento e código. */
  subtitle: string;
  /** foto de catálogo, para o card enquanto não houver render da combinação. */
  image: string | null;
}

export interface ModelDef {
  /** kebab-case, estável (vai para o localStorage) */
  id: string;
  /** ex.: 'S730 V8' */
  name: string;
  /** ex.: 'Highline · 6x4' */
  subtitle: string;
  /** foto do card; caminho relativo à base — resolver com assetUrl() */
  image: string | null;
  /**
   * Geometria PADRÃO do modelo — o `.glb` que um chassi herda quando não
   * declara `file` próprio. Relativo a `STUDIO_BASE`; resolver com `assetUrl()`.
   *
   * Era `cab: string`, um id em `models/cabs.json`. Aquele arquivo foi
   * APOSENTADO — ver a nota longa em `ChassisDef.file`. Na taxonomia nova a
   * geometria é por CHASSI (um 4x2 não é um 6x4 com uma roda a menos), então
   * este campo é só o padrão de quem não se diferencia.
   */
  file: string | null;
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
  /**
   * EDIÇÃO ESPECIAL: a pintura é parte do produto, não uma escolha.
   *
   * Um S-Way Metallica, um FH da Iron Mark, um Actros de aniversário — o que os
   * define é justamente a película, e oferecer doze cores para ela seria
   * oferecer doze caminhões que não existem. Quem marca isto some com o passo
   * "Cor" do seletor, com o card de cor do canto e com o painel de tinta.
   *
   * É AUTORADO NO MANIFESTO, não inferido de `paintMaterials: []` no cabs.json.
   * Os dois costumam andar juntos, mas dizem coisas diferentes: `paintMaterials`
   * vazio é uma verdade sobre a GEOMETRIA ("nenhum material aceita tinta"), e
   * isto é uma verdade sobre o PRODUTO ("esta pintura é a identidade dele").
   * Uma cabine pode ter os dois estados separados — uma bake sem material de
   * tinta mapeado ainda é um caminhão comum, à espera de conserto, e não uma
   * edição especial. Inferir juntaria um defeito com uma decisão comercial.
   */
  specialEdition: boolean;
  /**
   * ACABAMENTOS DE FÁBRICA — uma película que o bake carrega e que a tinta não
   * sabe fazer. Cada um é UM CARD NO PASSO DA COR, ao lado das tintas.
   *
   * POR QUE NÃO É UM MODELO, e por que deixou de ser um.
   * -------------------------------------------------------------------------
   * O S-Way 480 Metallica era uma entrada de MODELO própria, ao lado do S-Way
   * 480 — dois cards para o mesmo caminhão, e o dono do produto leu isso como
   * o que é: "ele é um Iveco 480, deveria ser como se fosse uma cor".
   *
   * O que travava a correção era a crença de que os dois eram malhas
   * incompatíveis. Medido: no `iveco_metallica_4x2.glb` a película está ASSADA
   * no albedo da tinta — todo material `*_carpaint_color` traz um `map` chamado
   * `*_carpaint_color_assada`, enquanto no rip de fábrica esse material vem sem
   * textura. Derrubando SÓ esse mapa, o mesmo arquivo vira um S-Way liso e
   * pintável (verificado por render em `tools/trailer-bench/ivecoprobe.ts`),
   * e recolocando-o a película volta idêntica. Uma malha, dois produtos.
   *
   * Então um acabamento não troca de arquivo: ele diz "não pinte, deixe o bake
   * como está". Quem executa é `loadCab(..., paintMaterials: [])`, o mesmo
   * caminho que uma cabine sem material de tinta já usava — nada de novo no
   * carregador.
   *
   * O MAPA ASSADO É RECONHECIDO PELO NOME DA TEXTURA (`_assada`), não por lista
   * no manifesto: quem assou batizou, e um marcador que viaja dentro do asset
   * não pode ficar dessincronizado de um JSON. Ver `BAKED_FINISH_RE` em
   * vehicle/models.ts.
   *
   * Vazio = o modelo só tem tinta, que é o caso de todos os outros 20.
   */
  finishes: FinishDef[];
  /** Padrão de `ChassisDef.paintMaterials` para os chassis que não declaram o
   *  seu. `null` = ninguém declarou → vale a detecção por shader. */
  paintMaterials: string[] | null;
  /**
   * Configurações de chassi deste modelo. **SEMPRE não-vazio**, garantido pelo
   * normalizador: um modelo que não declara `chassis` recebe um sintético
   * `{ id: 'padrao' }`, para o passo do seletor nunca renderizar grade vazia.
   *
   * Um modelo com UM chassi só não custa um clique: o seletor tira o passo da
   * sequência e escolhe sozinho — ver `STEP_INDEX`/`seqFor()` em ui/selector.ts.
   */
  chassis: ChassisDef[];
}

export interface ManufacturerDef {
  id: string;
  name: string;
  /** logo do card; caminho relativo à base — resolver com assetUrl() */
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
  /** id em ModelDef.chassis — a configuração de eixos do cavalo mecânico */
  chassisId: string | null;
  /** id em catalog/colors.ts — a pintura do cavalo mecânico */
  colorId: string | null;
  /**
   * id em `ModelDef.finishes` — a película de fábrica, quando o usuário escolhe
   * uma em vez de uma tinta.
   *
   * MUTUAMENTE EXCLUSIVO COM `colorId` na INTENÇÃO, não no armazenamento: os
   * dois convivem no objeto porque o `colorId` continua valendo para o
   * IMPLEMENTO (o baú é pintável mesmo atrás de um cavalo com película) e
   * porque voltar de um acabamento para uma cor não pode ter perdido qual cor
   * era. Quem manda na cabine é este campo quando ele não é nulo.
   */
  finishId: string | null;
  /**
   * Os ACABAMENTOS do implemento — teto, paralamas, caixa e Thermo King —
   * quando algum foge do padrão. Ver `vehicle/trim.ts`.
   *
   * OPCIONAL, E É O PONTO: `trimChoice()` devolve `undefined` enquanto ninguém
   * mexer numa peça, então a escolha gravada de quem não usa esta funcionalidade
   * continua byte a byte a de antes dela existir — e `sameRig()` não vê
   * diferença onde não há.
   *
   * NÃO INVALIDA A ESCOLHA quando vem estranho, pela mesma regra que a cor
   * segue: um acabamento que não faz sentido é um campo a descartar, nunca um
   * motivo para reabrir o seletor inteiro.
   */
  trim?: TrimChoiceRaw;
}

/**
 * A forma GRAVADA de um acabamento. Deliberadamente frouxa e local a este
 * arquivo: `catalog.ts` valida JSON externo e não deve importar `vehicle/*` —
 * ele é o módulo que TODO o resto lê, e uma aresta para a geometria o
 * transformaria num nó de dependência do veículo. `vehicle/trim.ts` é quem dá
 * significado a estes campos; aqui eles são só "hex e booleano".
 */
export type TrimChoiceRaw = Record<string, { color?: string; visible?: boolean }>;

/** As quatro chaves que valem — lista branca, igual ao resto de normalizeChoice. */
const TRIM_KEYS_RAW = ['roof', 'fenders', 'box', 'thermoking'] as const;
const HEX_RE = /^#[0-9a-f]{6}$/i;

/**
 * Peneira os acabamentos gravados. `undefined` quando não sobra nada.
 *
 * Uma cor que não é hex de 6 dígitos é DESCARTADA em silêncio, e não corrigida:
 * o único consumidor é `THREE.Color`, que aceita quase tudo e falha calado no
 * resto — um `'vermelho'` viraria preto e o usuário veria a peça sumir em vez
 * de ver a escolha ser ignorada.
 */
function normalizeTrim(raw: unknown): TrimChoiceRaw | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const src = raw as Raw;
  const out: TrimChoiceRaw = {};
  let any = false;
  for (const key of TRIM_KEYS_RAW) {
    const v = src[key];
    if (!v || typeof v !== 'object') continue;
    const piece = v as Raw;
    const entry: { color?: string; visible?: boolean } = {};
    if (typeof piece.color === 'string' && HEX_RE.test(piece.color)) entry.color = piece.color;
    if (piece.visible === false) entry.visible = false;
    if (entry.color === undefined && entry.visible === undefined) continue;
    out[key] = entry;
    any = true;
  }
  return any ? out : undefined;
}

/** Uma escolha já resolvida contra o catálogo — nenhum id é nulo. */
export interface ResolvedChoice {
  envId: string;
  manufacturerId: string;
  modelId: string;
  chassisId: string;
  colorId: string;
  /** O ÚNICO campo que continua podendo ser nulo depois de resolvido, e é a
   *  diferença que ele carrega: "nenhum acabamento" é um estado válido — o
   *  normal, aliás —, enquanto "nenhuma cor" não é. */
  finishId: string | null;
  /** Ausente enquanto as quatro peças estiverem no padrão. Ver `Choice.trim`. */
  trim?: TrimChoiceRaw;
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

/* Miniatura do cenário Estúdio, desenhada e não baixada.
   ---------------------------------------------------------------------------
   Um SVG em `data:` é a única `thumb` honesta para um cenário que por definição
   não tem asset nenhum: pedir um .webp ao servidor para ilustrar "sem
   downloads" seria contradizer o próprio cartão, e `thumb: null` cairia na
   placa de iniciais, que lê como asset faltando. `assetUrl()` deixa `data:`
   passar intocado (ver ABSOLUTE_RE), então isto atravessa o pipeline normal.
   O desenho é o que a cena é: ciclorama sem emenda, key à esquerda em 45°,
   fill à direita, rim atrás, e a elipse de contato no chão. */
const STUDIO_THUMB = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200">'
  + '<defs>'
  + '<linearGradient id="c" x1="0" y1="0" x2="0" y2="1">'
  + '<stop offset="0" stop-color="#3a3d42"/><stop offset="0.62" stop-color="#55595f"/>'
  + '<stop offset="1" stop-color="#3d4045"/></linearGradient>'
  + '<radialGradient id="k" cx="0.3" cy="0.28" r="0.72">'
  + '<stop offset="0" stop-color="#ffffff" stop-opacity="0.30"/>'
  + '<stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient>'
  + '</defs>'
  + '<rect width="320" height="200" fill="url(#c)"/>'
  + '<rect width="320" height="200" fill="url(#k)"/>'
  + '<ellipse cx="160" cy="150" rx="86" ry="13" fill="#000" opacity="0.30"/>'
  + '<path d="M96 150V96h58l20 26h30v28Z" fill="#22c55e" opacity="0.92"/>'
  + '<circle cx="126" cy="150" r="11" fill="#15803d"/>'
  + '<circle cx="188" cy="150" r="11" fill="#15803d"/>'
  + '<path d="M44 44v112M276 44v112" stroke="#ffffff" stroke-opacity="0.18" stroke-width="2"/>'
  + '</svg>');

/* O cenário ESTÚDIO — e ele não é mais só o fallback.
   ---------------------------------------------------------------------------
   Ele nasceu aqui como rede de segurança ("se o manifesto cair, ainda dá para
   abrir o estúdio"), e ficou invisível para o usuário: só aparecia quando a
   rede quebrava. Mas ele é justamente o cenário certo para APRESENTAR TINTA —
   sem prédio, sem céu, sem contaminação de cor —, e custa zero byte.
   Por isso `ensureStudioEnvironment()` lá embaixo o ACRESCENTA à lista vinda
   do manifesto quando ela não o traz: é o terceiro cenário do seletor, ao lado
   de `distrito-industrial` e `armazem`, e não substitui nenhum dos dois.
   `showRoad:false` porque um ciclorama não tem pista, e `preset:'ciclorama'`
   porque o `estudio` já é do `armazem` — dois cenários com a mesma luz seriam
   o mesmo cenário com dois nomes. */
const STUDIO_ENVIRONMENT: Raw = {
  id: 'estudio',
  name: 'Estúdio',
  subtitle: 'Ciclorama neutro · luz controlada, sem downloads',
  thumb: STUDIO_THUMB,
  hdri: null,
  ground: { type: 'asphalt', diffuse: null, rough: null, normal: null, repeat: [4, 60] },
  showSkyDome: true,
  showRoad: false,
  envRotation: 0,
  backgroundBlur: 0,
  preset: 'ciclorama',
  timeOfDay: 'dia',
  exposure: 1,
  envIntensity: 1,
  credit: null,
};

/* UM cenário: exatamente o ambiente procedural que scene/scene.ts já sabe montar
   sozinho (sem HDRI, com céu procedural). Ou seja, o estúdio continua
   funcionando com ZERO assets baixados. */
const FALLBACK_ENVIRONMENTS: Raw[] = [STUDIO_ENVIRONMENT];

/* Duas marcas com um modelo cada, apontando DIRETO para os `.glb` de produção.
   `image`/`logo` são null de propósito: o seletor TEM de tolerar imagem nula
   (renderiza só o texto) — nunca assuma URL de imagem aqui.

   NA MESMA FORMA DO MANIFESTO, e isso é o ponto: `file` com o caminho do
   arquivo, exatamente como um `brands.json` de verdade escreveria. As quatro
   geometrias de produção herdadas (`scania.glb`, `volvo.glb`, `iveco.glb`,
   `iveco_sway_metallica.glb`) NÃO têm caminho especial em lugar nenhum do
   código — elas são apenas `file`s como quaisquer outros. Um segundo caminho
   para "os modelos antigos" seria a indireção do `cabs.json` voltando pela
   porta dos fundos. */
const FALLBACK_MANUFACTURERS: Raw[] = [
  {
    id: 'scania', name: 'Scania', logo: null, accent: '#041E42',
    models: [{
      id: 'scania-s730', name: 'S730 V8', subtitle: 'Highline · 6x4',
      image: null, file: 'models/vehicles/scania.glb', note: null,
    }],
  },
  {
    id: 'volvo', name: 'Volvo', logo: null, accent: '#1B365D',
    models: [{
      id: 'volvo-fh16-750', name: 'FH16 750', subtitle: 'Globetrotter XL · 6x4',
      image: null, file: 'models/vehicles/volvo.glb', note: null,
    }],
  },
];

/* ---------------- helpers ---------------- */

/* Mensagem legível de um valor lançado. `catch (e)` é `unknown` sob strict, e o
   que chega aqui nem sempre é um Error (um reject de rede pode ser qualquer
   coisa) — então nunca leia `.message` às cegas. */
const errText = (e: unknown): string =>
  (e instanceof Error ? e.message : String(e));

/* Já é uma URL final, de origem própria? Então devolver intocado.
   ---------------------------------------------------------------------------
   `/` NÃO ESTÁ MAIS NESTA LISTA, e essa é a mudança inteira. Enquanto a árvore
   do studio era servida por `web/public/`, um caminho de raiz de site já era a
   URL certa e passava direto. Com a árvore na API, um `/models/vehicles/x.glb`
   resolve contra a origem do WEB — que não tem mais os arquivos — e o resultado
   é um 404 mudo, porque quase todo carregador do engine degrada em silêncio.
   Deixar só os esquemas que são MESMO absolutos (`https?://`, `data:`, `blob:`
   e o protocol-relative `//`) faz todo o resto cair no prefixo. */
const ABSOLUTE_RE = /^(?:https?:\/\/|data:|blob:|\/\/)/i;

/* A base sem a barra inicial — usada só para detectar um caminho que JÁ a traz.
   Declarada antes de assetUrl() de propósito: o valor tem de estar pronto na
   primeira chamada, e um `const` depois da função ficaria na zona morta se
   alguém a chamasse durante a avaliação de módulo. */
const BASE_REL = STUDIO_BASE.replace(/^\/+/, '');

/**
 * Normaliza um caminho de manifesto (ou de `core/paths.ts`) para URL servível,
 * prefixando `STUDIO_BASE`.
 *
 * ESTE É O ÚNICO LUGAR DO CÓDIGO QUE SABE ONDE A ÁRVORE ESTÁ HOSPEDADA. Por
 * isso os manifestos guardam caminho RELATIVO: cada caminho absoluto que
 * existisse lá seria uma segunda declaração da hospedagem, num arquivo que o
 * tsc não lê e que só falha em produção.
 *
 *   assetUrl('environments/urbano/thumb.webp')
 *     → '/studio-assets/v1/environments/urbano/thumb.webp'
 *   assetUrl('https://cdn.exemplo/x.hdr')  → intocado
 *   assetUrl('data:image/png;base64,…')    → intocado
 *
 * A barra inicial é TOLERADA (e removida) de propósito: é rede de segurança de
 * migração. Um manifesto antigo, um `*_meta.json` que ninguém reescreveu ou uma
 * string esquecida em algum canto ainda resolve para o lugar certo em vez de
 * virar `//studio-assets/v1//x` (barra dupla, que alguns servidores tratam como
 * outro caminho) ou de apontar para a origem errada em silêncio.
 *
 * Devolve '' para null/undefined — `<img src="">` não carrega nada, enquanto
 * String(null) viraria a URL literal "null" e sujaria o console com um 404.
 *
 * **É IDEMPOTENTE**, e isso é contrato, não coincidência — ver a nota logo
 * abaixo da função.
 * @param {string|null|undefined} path
 * @returns {string}
 */
export function assetUrl(path: string | null | undefined): string {
  if (path == null) return '';
  const p = String(path).trim();
  if (!p) return '';
  if (ABSOLUTE_RE.test(p)) return p;
  /* `./x` e `/x` chegam ao mesmo lugar que `x`: a base é a raiz da árvore, não
     um diretório relativo ao documento — não existe "subir um nível" aqui. */
  let rel = p.replace(/^\.\//, '').replace(/^\/+/, '');
  /* Já traz a base? Então tirar, para recolocar exatamente uma vez. */
  if (BASE_REL && (rel === BASE_REL || rel.startsWith(BASE_REL + '/'))) {
    rel = rel.slice(BASE_REL.length).replace(/^\/+/, '');
  }
  return STUDIO_BASE + '/' + rel;
}

/* POR QUE A IDEMPOTÊNCIA É CONTRATO.
   ---------------------------------------------------------------------------
   `assetUrl(assetUrl(x)) === assetUrl(x)` tem de valer porque meia dúzia de
   módulos resolve a URL no CHAMADOR e entrega o resultado a um carregador que
   resolve de novo por dentro: `loadGLB()` (vehicle/models.ts) chama assetUrl no
   corpo, e scene/set.ts, scene/environment.ts e ui/preview.ts o chamam com URLs
   que já passaram por aqui. Sem idempotência, cada um desses caminhos vira
   `/studio-assets/v1/studio-assets/v1/…` — um 404, e mudo, porque esses
   carregadores degradam em silêncio por desenho.

   Antes, a propriedade saía de graça: `/` estava em ABSOLUTE_RE, e a saída
   começava com `/`. Tirar `/` de lá (que é o ponto desta mudança) MATOU essa
   garantia justamente no modo padrão, o same-origin — a saída
   `/studio-assets/v1/x` deixou de ser reconhecida como "já resolvida". Daí o
   teste explícito de BASE_REL acima: é ele que reconstrói a propriedade.

   Com base absoluta (`http://api…/studio-assets/v1`) a saída começa com
   `http://` e o ABSOLUTE_RE lá em cima já resolve o caso — mas depender só
   disso deixaria a idempotência valendo num modo e não no outro, que é a pior
   forma possível de um invariante existir. */

/* Os manifestos vivem DENTRO da árvore, então a URL deles se monta do mesmo
   jeito que a de qualquer asset: passar por assetUrl() é o que faz o próprio
   fetch do manifesto seguir a base. Sem isto, `environments.json` continuaria
   sendo buscado na origem do web enquanto tudo que ele aponta vem da API. */
async function fetchJSON(path: string): Promise<Raw> {
  const url = assetUrl(path);
  const r = await fetch(url, { cache: 'no-cache' });
  if (!r.ok) throw new Error(url + ' → ' + r.status);
  return r.json();
}

/* HEAD na URL final. Qualquer erro (rede, CORS, offline) conta como ausente.
   Recebe caminho de manifesto, não URL: assetUrl() é chamado AQUI e uma única
   vez — prefixar antes de chamar produziria dupla base. */
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
/* Lista de strings do manifesto (`paintMaterials`). Devolve `null` — e NÃO `[]` —
   quando a chave não existe, porque os dois estados dizem coisas diferentes:
   ausente = "herde / detecte"; `[]` = "esta geometria não tem lataria pintável",
   que é uma declaração legítima e não um bake por consertar. Colapsar os dois
   apagaria justamente a distinção que torna o campo útil. */
const strArr = (v: unknown): string[] | null =>
  (Array.isArray(v)
    ? v.filter((s): s is string => typeof s === 'string' && !!s.trim()).map((s) => s.trim())
    : null);

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
    /* SÓ com `hdri`: um plate de noite sozinho não tem par com que atravessar, e
       aceitá-lo faria skyblend.setSkyPair() devolver null a cada troca de hora. */
    hdriNight: hdri ? nullableStr(raw.hdriNight) : null,
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
    /* Set 3D. Quando presente, environment.ts desliga o disco procedural, o
       scatter e a pista: os três existem para simular o que o set traz de
       verdade, e mantê-los ligados sobrepõe um asfalto CG ao asfalto modelado.
       Cru de propósito, como os outros blocos — scene/set.ts é quem valida. */
    set: obj(raw.set),
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

/* Id do chassi sintético de um modelo que não declara nenhum. Constante porque
   ele vai para o localStorage e para o caminho do render — mudar a string
   invalidaria escolhas salvas e renders já produzidos. */
export const DEFAULT_CHASSIS_ID = 'padrao';

/** @returns {ChassisDef|null} null → entrada inutilizável, descartar. */
function normalizeChassis(input: unknown, model: Raw): ChassisDef | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as Raw;
  const id = nullableStr(raw.id);
  if (!id) return null;
  return {
    id,
    /* O id JÁ é legível ('6x4'), então ele é o nome padrão. Um `name` autoral
       ('6x4 Tractor') continua ganhando. */
    name: str(raw.name, id),
    subtitle: str(raw.subtitle, ''),
    image: nullableStr(raw.image),
    /* null e não o file do modelo: quem herda é o CONSUMIDOR (`chassis.file ??
       model.file`), e guardar a herança já resolvida aqui apagaria a diferença
       entre "não declarou" e "declarou igual ao modelo". */
    file: nullableStr(raw.file),
    note: nullableStr(raw.note),
    /* Herda a disponibilidade do MODELO por omissão: um modelo inteiro "Em
       breve" não pode ter chassis clicáveis por dentro. */
    available: bool(raw.available, bool(model.available, true)),
    aliases: (Array.isArray(raw.aliases) ? raw.aliases : [])
      .filter((a): a is string => typeof a === 'string' && !!a.trim())
      .map((a) => a.trim()),
    /* `null` e não o do modelo: a herança é do CONSUMIDOR
       (`paintMaterialsOf()`), exatamente como o `file` logo acima. */
    paintMaterials: strArr(raw.paintMaterials),
  };
}

/** @returns {ModelDef|null} */
/* `manufacturerId` saiu da assinatura junto com o `cabs.json`: ele existia só
   para o palpite `cab: raw.cab ?? manufacturerId`, que era justamente o que
   fazia um modelo sem geometria resolver para a malha de outra montadora. */
function normalizeModel(input: unknown): ModelDef | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as Raw;
  const id = nullableStr(raw.id);
  const name = nullableStr(raw.name);
  if (!id || !name) return null;
  /* INVARIANTE: a lista nunca sai vazia. Um manifesto anterior ao passo do
     chassi (ou um modelo que de fato só tem uma configuração) recebe o
     sintético, e todo consumidor — seletor, studio.ts, renders.ts — pode
     assumir `chassis[0]` sem checagem. O rótulo herda o subtítulo do modelo,
     que é justamente onde a configuração se escondia até aqui ('Highline · 6x4'). */
  const chassis = (Array.isArray(raw.chassis) ? raw.chassis : [])
    .map((c: unknown) => normalizeChassis(c, raw))
    .filter((c): c is ChassisDef => c !== null);
  if (!chassis.length) {
    chassis.push({
      id: DEFAULT_CHASSIS_ID,
      name: 'Padrão',
      subtitle: str(raw.subtitle, ''),
      image: nullableStr(raw.image),
      /* Herda a geometria do modelo: um chassi sintético existe justamente
         porque o manifesto não diferenciou nada, então ele É o modelo. */
      file: nullableStr(raw.file),
      note: null,
      available: bool(raw.available, true),
      aliases: [],
      /* O sintético É o modelo — herda a declaração dele, como herda o `file`. */
      paintMaterials: strArr(raw.paintMaterials),
    });
  }
  /* Um acabamento sem `id` ou sem `name` é ruído de manifesto e sai calado, do
     mesmo jeito que um chassi malformado: o passo da cor tem de continuar
     abrindo com as tintas. */
  const finishes: FinishDef[] = (Array.isArray(raw.finishes) ? raw.finishes : [])
    .map((f: unknown) => {
      const r = (f ?? {}) as Record<string, unknown>;
      const fid = str(r.id, '');
      const fname = str(r.name, '');
      if (!fid || !fname) return null;
      return {
        id: fid,
        name: fname,
        subtitle: str(r.subtitle, ''),
        image: nullableStr(r.image),
      };
    })
    .filter((f): f is FinishDef => f !== null);

  return {
    chassis,
    finishes,
    id,
    name,
    subtitle: str(raw.subtitle, ''),
    image: nullableStr(raw.image),
    /* Sem `file` explícito, NÃO se inventa um caminho. O palpite que existia
       aqui (`cab: raw.cab ?? manufacturerId`) era o que fazia um DAF sem
       geometria resolver para um id que não existe em lugar nenhum e cair, mais
       adiante, na malha de outra montadora. Um `null` honesto faz o carregador
       falhar alto — ver ChassisDef.file. */
    file: nullableStr(raw.file),
    note: nullableStr(raw.note),
    /* Default TRUE: um manifesto antigo, sem o campo, continua com todos os
       modelos selecionáveis — exatamente o comportamento anterior. Só quem
       escreve `false` explicitamente vira "Em breve". */
    available: bool(raw.available, true),
    /* Default FALSE pelo mesmo motivo: nenhum manifesto existente vira edição
       especial por omissão. */
    specialEdition: bool(raw.specialEdition, false),
    /* `null` = não declarado. O PADRÃO não mora aqui: catalog.ts diz o que o
       manifesto declarou, não o que o bake assume. */
    paintMaterials: strArr(raw.paintMaterials),
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
    .map((m: unknown) => normalizeModel(m))
    .filter((m): m is ModelDef => m !== null);
  /* fabricante sem modelo não tem passo 3 — seria um beco sem saída no seletor */
  if (!models.length) return null;
  return {
    id,
    name,
    logo: nullableStr(raw.logo),
    /* Verde do projeto (green-500), não o `blue-500` do tailwind que estava
       aqui: este é o accent de quem NÃO declarou o próprio, então ele tem de
       ser a cor da casa. As marcas que declaram (`#041E42` da Scania,
       `#0072CE` da DAF) continuam intocadas — identidade de terceiros. */
    accent: str(raw.accent, '#22c55e'),
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
    /* MANIFESTO ANTERIOR AO CONTRATO DE GEOMETRIA.
       ---------------------------------------------------------------------
       Um `brands.json` que não traz `file` em NENHUM chassi é de antes de a
       geometria passar a ser apontada pelo catálogo (quando ela vinha do
       `cabs.json`, hoje aposentado). Cada modelo dele resolveria para "sem
       geometria" e o estúdio não abriria nada.
       Isto é uma verdade sobre o MANIFESTO INTEIRO, não sobre um caminhão, e é
       por isso que a degradação é do manifesto inteiro: cai no catálogo
       embutido — que aponta para .glb de produção reais — em vez de adivinhar
       um caminho por modelo, que é exatamente o palpite que esta mudança
       removeu. Uma linha de aviso dizendo o que republicar, e o estúdio abre. */
    const anyFile = list.some((m) => m.models.some((mo) =>
      mo.file || mo.chassis.some((c) => c.file)));
    if (!anyFile) {
      console.warn('[manifest] brands.json não declara `chassis[].file` em nenhum modelo —'
        + ' é anterior ao contrato de geometria (o `cabs.json` foi aposentado).'
        + ' Usando o catálogo embutido. Republique a árvore de assets para'
        + ' restaurar o catálogo completo.');
      throw new Error('brands.json sem `file` — manifesto obsoleto');
    }
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

/* O ESTÚDIO SEMPRE EXISTE.
   Se o manifesto já o declara (o caminho desejado, e o que o desktop também vai
   ler), essa entrada ganha — ela pode trazer thumb de verdade, exposição
   ajustada, o que for. Se não, o motor o acrescenta: é um cenário sem asset
   nenhum, então oferecê-lo nunca pode falhar, e escondê-lo até o manifesto ser
   republicado seria esconder o cenário certo para julgar uma cor. */
function ensureStudioEnvironment(list: EnvironmentDef[]): EnvironmentDef[] {
  const declared = list.find((e) => e.id === STUDIO_ENVIRONMENT.id);
  if (declared) {
    /* A MINIATURA DESENHADA É DO MOTOR, e o manifesto não precisa carregá-la.
       Um data-uri de SVG dentro do JSON servido seria um kilobyte de markup
       repetido em cada resposta, ilegível na revisão e duplicado no desktop.
       Então o manifesto declarava `thumb: null` e QUEM PREENCHIA era aqui — e
       uma `thumb` de verdade, no dia em que alguém fotografasse o ciclorama,
       ganharia sem que nada disto mudasse.

       ESSE DIA CHEGOU (2026-08-10): o manifesto agora traz
       `environments/estudio/thumb.webp`, e este `if` deixou de disparar no
       caminho normal — o que é exatamente o desenho previsto, não uma linha
       morta. Ele continua sendo o que segura o cartão no ÚNICO estado em que
       ainda importa: manifesto fora do ar, quando `loadEnvironments()` cai em
       FALLBACK_ENVIRONMENTS e não existe servidor de onde buscar .webp
       nenhuma. Não troque STUDIO_THUMB pelo caminho do arquivo aqui: seria
       trocar uma miniatura que sempre desenha por um 404 mudo justamente na
       hora em que a rede é o problema. */
    if (!declared.thumb) declared.thumb = STUDIO_THUMB;
    return list;
  }
  const built = normalizeEnvironment(STUDIO_ENVIRONMENT);
  return built ? [...list, built] : list;
}

async function doLoadCatalog() {
  /* em paralelo e independentes: brands.json quebrado não pode derrubar os cenários */
  const [envs, mans] = await Promise.all([loadEnvironments(), loadManufacturers()]);

  catalog.environments = ensureStudioEnvironment(envs.list);
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
 * Um id de modelo ANTIGO → o par {modelId, chassisId} que o absorveu.
 *
 * A ponte de migração de `ChassisDef.aliases`. Um `scania-s730` gravado no
 * localStorage antes de `modelId` passar a nomear a geração resolve aqui para
 * `{scania-s-2016, 6x4-s730}` em vez de invalidar a escolha inteira.
 *
 * Varre o catálogo em vez de manter um índice: roda no máximo uma vez por boot
 * (só quando `getModel()` já falhou) sobre ~20 modelos × ~3 chassis. Um índice
 * seria uma segunda estrutura para manter em sincronia com a primeira.
 */
export function resolveAlias(oldId: string | null | undefined):
{ modelId: string; chassisId: string } | null {
  if (!oldId) return null;
  for (const man of catalog.manufacturers) {
    for (const model of man.models) {
      for (const chassis of model.chassis) {
        if (chassis.aliases.includes(oldId)) {
          return { modelId: model.id, chassisId: chassis.id };
        }
      }
    }
  }
  return null;
}

/**
 * O primeiro chassi DISPONÍVEL de um modelo (senão o primeiro da lista).
 * `chassis` nunca é vazio, então isto nunca devolve undefined para um modelo
 * que existe — ver o invariante em `normalizeModel()`.
 */
export function defaultChassis(model: ModelDef | null | undefined): ChassisDef | null {
  if (!model) return null;
  return model.chassis.find((c) => c.available) || model.chassis[0] || null;
}

/**
 * Resolve `{modelId, chassisId}` contra o catálogo. Um `chassisId` que não
 * existe MAIS (o manifesto mudou embaixo de uma escolha salva) cai no primeiro
 * disponível em vez de devolver null — o mesmo tratamento que a cor recebe, e
 * pelo mesmo motivo: um chassi ausente não invalida "qual caminhão mostrar".
 * @returns {{ model, manufacturer, chassis }|null}
 */
export function getChassis(modelId: string | null | undefined, chassisId: string | null | undefined) {
  const found = getModel(modelId);
  if (!found) return null;
  const chassis = found.model.chassis.find((c) => c.id === chassisId)
    || defaultChassis(found.model);
  return chassis ? { ...found, chassis } : null;
}

/**
 * A GEOMETRIA EFETIVA de um par modelo+chassi: o `file` do chassi ganha do
 * `file` do modelo. `null` quando nenhum dos dois declara nada — e nesse caso
 * quem chama tem de FALHAR, nunca escolher outra malha.
 */
export function fileOf(
  model: ModelDef, chassis: ChassisDef | null | undefined,
): string | null {
  return (chassis && chassis.file) || model.file || null;
}

/**
 * OS MATERIAIS PINTÁVEIS AUTORADOS de um par modelo+chassi — mesma cascata de
 * `fileOf()`, e de propósito: quem manda é o nível que declara a GEOMETRIA.
 *
 * `null` = ninguém declarou → quem carrega usa a detecção por shader
 * (`isPaintableMaterial()`, em vehicle/models.ts).
 *
 * `??` e NÃO `||`: um `[]` declarado é a verdade "nenhum material aceita tinta",
 * e `||` a transformaria de volta em "detecte" sem dizer nada — que é a classe
 * de bug que este campo existe para tornar declarável.
 */
export function paintMaterialsOf(
  model: ModelDef, chassis: ChassisDef | null | undefined,
  finishId?: string | null,
): string[] | null {
  /* ACABAMENTO ATIVO ⇒ NENHUM MATERIAL ACEITA TINTA, e é assim que ele é
     implementado inteiro. `loadCab()` já sabe o que fazer com uma lista vazia
     (não troca material nenhum, e diz no log), então uma película não precisa
     de um caminho novo no carregador — precisa de uma resposta diferente para
     a pergunta que ele já faz. Ver `ModelDef.finishes`. */
  if (finishId && model.finishes.some((f) => f.id === finishId)) return [];
  return (chassis ? chassis.paintMaterials : null) ?? model.paintMaterials ?? null;
}

/** O acabamento pedido, se ele existir NESTE modelo. `null` para tudo o mais —
 *  inclusive para um id que sobreviveu no localStorage a uma troca de modelo. */
export function finishOf(
  model: ModelDef | null | undefined, finishId: string | null | undefined,
): FinishDef | null {
  if (!model || !finishId) return null;
  return model.finishes.find((f) => f.id === finishId) ?? null;
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
  const chassis = defaultChassis(model);
  return {
    envId: env ? env.id : null,
    manufacturerId: manufacturer ? manufacturer.id : null,
    modelId: model ? model.id : null,
    chassisId: chassis ? chassis.id : null,
    colorId: defaultColorId(),
    /* Um visitante novo abre na TINTA, nunca num acabamento: a película é uma
       escolha deliberada, e abrir nela mostraria um caminhão de edição limitada
       como se fosse o padrão da linha. */
    finishId: null,
  };
}

/* ---------------- escolha persistida ---------------- */

/* O modelo é a fonte de verdade da marca: se `modelId` não pertence a
   `manufacturerId`, conserta a marca em vez de gravar uma contradição. */
function normalizeChoice(choice: unknown): ResolvedChoice | null {
  if (!choice || typeof choice !== 'object') return null;
  const c = choice as Raw;
  let wantedModel = nullableStr(c.modelId);
  let wantedChassis = nullableStr(c.chassisId);
  const wantedFinish = nullableStr(c.finishId);
  let found = getModel(wantedModel);
  if (!found) {
    /* MIGRAÇÃO. O id salvo pode ser um id COMERCIAL de antes de `modelId`
       passar a nomear a geração. Se algum chassi o reivindica, a escolha
       sobrevive inteira — e é o `chassisId` do alias que ganha, porque é ele
       que carrega a potência que o id antigo nomeava. */
    const alias = resolveAlias(wantedModel);
    if (alias) {
      wantedModel = alias.modelId;
      wantedChassis = alias.chassisId;
      found = getModel(wantedModel);
    }
  }
  /* Nada resolveu: devolver null é o que manda studio.ts REABRIR O SELETOR em
     vez de bootar numa escolha inventada. Uma seleção velha nunca prende o
     seletor — ela some, e o fluxo completo recomeça do primeiro passo. */
  if (!found) return null;
  /* Um modelo que PERDEU a geometria (o manifesto mudou embaixo de uma escolha
     já salva) é tão inválido quanto um id que sumiu: devolver null aqui é o que
     manda o studio.ts reabrir o seletor em vez de bootar num "Em breve". */
  if (!found.model.available) return null;
  const env = getEnvironment(nullableStr(c.envId));
  if (!env) return null;
  /* A cor NÃO invalida a escolha quando não resolve: uma escolha gravada antes
     de o passo da cor existir (ou apontando para uma cor que saiu da paleta)
     ainda diz qual caminhão e qual cenário mostrar, e reabrir o seletor inteiro
     por causa disso seria trocar um dado ausente por um usuário irritado. Cai
     na cor padrão, que é o mesmo que um visitante novo recebe. */
  const color = getColor(nullableStr(c.colorId));
  /* O CHASSI SEGUE A REGRA DA COR, NÃO A DO MODELO — de propósito, e é o que
     permite manter a chave `truckstudio.choice.v1` sem migração destrutiva.
     Uma escolha gravada ANTES de o passo do chassi existir não traz `chassisId`
     nenhum; invalidá-la por isso jogaria todo visitante que volta de volta para
     o seletor completo, para trocar um campo que ele nunca escolheu. Cai no
     primeiro disponível, que é exatamente o que um visitante novo recebe.
     Só bumpar para `.v2` se o número de eixos passar a mudar a GEOMETRIA
     carregada (`ChassisDef.cab`) — aí uma v1 apontaria para um conjunto que
     nunca existiu. */
  /* Um chassi que ainda existe mas PERDEU a geometria não entra como escolhido:
     o estúdio tentaria montar o que o catálogo diz que não há. Cai no primeiro
     disponível, igual a um visitante novo. */
  const exact = found.model.chassis.find((h) => h.id === wantedChassis);
  const chassis = exact && exact.available ? exact : defaultChassis(found.model);
  return {
    envId: env.id,
    manufacturerId: found.manufacturer.id,
    modelId: found.model.id,
    chassisId: chassis ? chassis.id : DEFAULT_CHASSIS_ID,
    colorId: color ? color.id : defaultColorId(),
    /* RESOLVIDO CONTRA O MODELO, e é o que impede um acabamento de sobreviver a
       uma troca de caminhão: o id fica no localStorage, e sem este filtro um
       S-Way com película escolhida viraria "Scania com película metallica" —
       um estado que `paintMaterialsOf()` leria como "não pinte" num caminhão
       que não tem outra coisa a mostrar. */
    finishId: finishOf(found.model, wantedFinish)?.id ?? null,
    /* Espalhado condicionalmente para a chave NÃO EXISTIR quando não há nada a
       gravar — `trim: undefined` sobreviveria ao `JSON.stringify` como campo
       ausente, mas apareceria em qualquer comparação de objetos feita antes
       disso, e `sameRig()` é exatamente uma dessas. */
    ...(normalizeTrim(c.trim) ? { trim: normalizeTrim(c.trim) } : {}),
  };
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
