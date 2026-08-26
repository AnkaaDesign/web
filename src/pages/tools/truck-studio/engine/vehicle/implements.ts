/* O CATÁLOGO DE IMPLEMENTOS — quem é carregado, como se chama, e o que ele TEM.
   ---------------------------------------------------------------------------
   Até 2026-08-18 existia UM implemento e o engine sabia o nome do arquivo dele:
   `loadTrailer()` pedia `trailer.glb` e `prefetchTrailerAssets()` repetia a
   string. O segundo implemento — o sobrechassi frigorífico gancheiro, ver
   `tools/implement-bake/README.md` — não cabe nesse desenho por três razões que
   não são de nome:

     · não tem PINO-REI  — não engata em quinta roda; ele é aparafusado no
       chassi de um caminhão RÍGIDO;
     · não tem RODAGEM   — quem roda é o caminhão. `attachFh16Wheels()` não tem
       o que trocar, e `runningTyres()` não tem bogie para medir;
     · não tem PATOLA    — nem placa de licenciamento própria: as duas são do
       cavalo/caminhão.

   Chamar `attachFh16Wheels()` num baú sem pneu não quebra (a função degrada),
   mas gasta um download de 646 kB e deixa um aviso no console a cada carga. E
   `buildLandingGear()` num baú sem patola inventa uma. O que decide não pode ser
   "tentar e ver": tem de ser DECLARADO, e é o que `has` faz.

   POR QUE UM MANIFESTO, E NÃO UMA LISTA AQUI
   ---------------------------------------------------------------------------
   Mesma razão de `brands.json`, `hitch.json` e `plates.json`: o catálogo
   descreve a ÁRVORE DE ASSETS, e a árvore é publicada sem passar por build do
   web (ver `core/paths.ts`). Um implemento novo assado num sábado entra
   copiando dois arquivos e editando o JSON ao lado deles.

   ⚠️ E POR QUE EXISTE UM PADRÃO EM CÓDIGO MESMO ASSIM: a árvore servida hoje
   NÃO tem `implements.json`, e `--delete` é proibido nela. Enquanto o deploy
   não sobe o arquivo, `implementsOf(null)` devolve o semirreboque de sempre,
   apontando para `trailer.glb` — que é o nome ANTIGO, ainda servido. Sem esse
   padrão, o primeiro deploy do web sem o deploy da árvore deixaria o estúdio
   sem implemento nenhum, com um 404 mudo (é o modo de falhar que
   `core/paths.ts` descreve por extenso).

   A CONVENÇÃO DE NOME DE ARQUIVO tem três eixos e está no README da bancada:
   `<semirreboque|sobrechassi>_<frigorifico|carga_seca>_<gancheiro|paleteiro>.glb`. */

/** Como o implemento se prende ao veículo. É o que decide a POSE, não a caixa. */
export type ImplementKind =
  /** Pino-rei na quinta roda de um cavalo mecânico. */
  | 'semirreboque'
  /** Aparafusado no chassi de um caminhão rígido. */
  | 'sobrechassi';

/** As peças que este implemento tem — o que é `false` não é sequer baixado. */
export interface ImplementParts {
  /** Rodagem própria (e portanto a troca por `wheel_fh16_v2.glb`). */
  wheels: boolean;
  /** Patola / pé de apoio. */
  landingGear: boolean;
  /** Pino-rei: entra no solver de engate. */
  kingpin: boolean;
  /** Placa de licenciamento própria, no porta-placa da traseira. */
  plate: boolean;
  /** Unidade de refrigeração na testeira. */
  thermoKing: boolean;
}

export interface ImplementDef {
  /** Estável, em kebab-case. É ele que vai para a URL e para o `localStorage`. */
  id: string;
  /** Nome cheio, como aparece na interface. */
  label: string;
  /** Nome curto para card e chip. */
  short: string;
  /** Arquivo em `models/vehicles/`, relativo a `VEHICLES_DIR`. */
  file: string;
  /** `*_meta.json` ao lado dele. Ausente = sem pino-rei nem contorno medido. */
  meta?: string;
  kind: ImplementKind;
  has: ImplementParts;
  /**
   * O trilho de TOPO deste baú é INOX, não galvanizado de usinagem.
   *
   * `splitTrailerHardware()` separa a família de inox por VÃO EM Z: peça curta é
   * ferragem (inox, `roughness 0.30`), peça longa é trilho e fica no acetinado
   * de 0,62 — a medição que justifica o corte está no cabeçalho de
   * `STAINLESS_RAIL_Z`, em `models.ts`, e ela foi tirada NO SEMIRREBOQUE.
   *
   * No sobrechassi o perfil superior das laterais é inox e o inferior é
   * galvanizado — e isso é diferença de PRODUTO, não erro de bake. Os dois baús
   * são do mesmo fabricante (a plaqueta Ibiporã está nos dois), em linhas
   * diferentes. Uma regra global apagaria a distinção nos dois sentidos: ou o
   * semirreboque ganha um trilho de topo espelhado que ele não tem, ou o
   * sobrechassi perde o dele.
   *
   * Com esta marca ligada, um trilho que morre na faixa do teto vira inox; o
   * trilho de piso e o friso de flanco continuam acetinados.
   */
  stainlessTopRail?: boolean;
  /** O trilho de topo deste bake traz os rebites MODELADOS (rebaixos de 2 mm) e
   *  não tem o filete da junta com a chapa branca. Ver `dressTopRail()`. */
  topRailDressing?: boolean;
  /**
   * Nome do material do PERFIL DE ARREMATE do baú (o quadro que corre o flanco
   * em cima e embaixo), como fonte de regex.
   *
   * DUAS medidas saem dele: o TOPO do perfil de baixo dá o batente da porta
   * (`measureSill()`), e a FACE DE BAIXO do de cima é onde a coluna de rebites
   * para (`measureTopRail()`). O padrão de `trailer-geometry.ts` é
   * `metal-galvanizado-mantido`, o nome NO SEMIRREBOQUE — e o sobrechassi não
   * tem esse material: nele o mesmo quadro é
   * `metal-estrutura-principal-padrao`, em segmentos de 3 m
   * (topo y 2,948…3,051 · base 0,214…0,309, os dois em |x| 1,199…1,310).
   *
   * Sem esta declaração `measureSill()` não acha perfil nenhum, avisa no
   * console e devolve a linha do piso — e a porta nasce DENTRO da cantoneira,
   * que é o defeito 4 do `tools/trailer-bench/PORTA-LATERAL-HANDOFF.md`.
   */
  frameMaterial?: string;
  /**
   * O perfil de BAIXO, quando ele não é o mesmo do de cima. Padrão:
   * `frameMaterial`. Ver `TrailerBodyOptions.sillMaterial` — no sobrechassi
   * usar o mesmo nome dos dois punha o batente a 250,5 mm em vez de 122,5.
   */
  sillMaterial?: string;
  /**
   * Este bake traz uma PORTA LATERAL de fábrica, e ela tem de sair.
   *
   * No semirreboque nenhuma porta vem assada — quem as põe é
   * `TrailerBody.setDoors()`, sob demanda, com o kit extraído da porta traseira
   * do próprio implemento. O sobrechassi vem com uma, e ela não é só
   * "a mais": a folha dela está **7,7 mm fora de fase** com a parede, o que a
   * faz ler errado E impede o flanco de virar chapa frisada. Ver
   * `removeBakedSideDoor()`.
   */
  bakedSideDoor?: boolean;
  /**
   * Este bake traz a marca do FABRICANTE do baú (plaquetas de flanco e a chapa
   * de recorte da traseira). O implemento é vendido pela Ankaa. Ver
   * `removeMakerBranding()`.
   */
  makerBranding?: boolean;
  /**
   * Neste bake a BANDA DE BAIXO do flanco veio com o material branco, e ela é
   * FRAME. Ver `fixLowFrameSkin()` — é o "a parte de baixo não mostra a
   * separação de chapa e frame metálico" do relato.
   */
  lowFrameSkin?: boolean;
  /** Reancorar a fita vertical de canto à régua do semirreboque — ver
   *  `fixCornerTape()`. */
  cornerTape?: boolean;
  /**
   * Refazer o TRILHO DE PISO do flanco pela régua do semirreboque — ver
   * `fixLowFrameRail()`.
   *
   * O perfil deste bake tem 140 mm onde o do semirreboque tem 210, e ainda está
   * 4,4 mm PARA DENTRO da pele. O pé dos dois já coincide (piso −82,5 mm), e é
   * essa coincidência que prova que é a mesma peça em dois comprimentos: o
   * conserto sobe o topo 70 mm e traz o perfil para a frente da chapa.
   */
  lowFrameRail?: boolean;
  /**
   * Este bake traz DUAS mangueiras traseiras e o produto tem UMA — ver
   * `removeExtraRearHose()`. O registro (a torneira de dreno) de cada uma fica.
   */
  singleRearHose?: boolean;
  /**
   * Este bake traz SETE tubos de 20 × 20 mm embutidos na parede, herdados do
   * implemento de origem — ver `removeStrayConduits()`. São os "caninhos" do
   * relato de 2026-08-19: eles só aparecem abaixo do perfil de piso, e a
   * contagem assimétrica (3 numa lateral, 2 na outra, 2 na frente) é o que os
   * identifica. O semirreboque não tem nenhum.
   */
  strayConduits?: boolean;
  /**
   * Este bake traz a estação de encosto da PORTA LATERAL de fábrica, e a porta
   * já saiu — ver `removeSideDoorCatches()`. Fica só a da porta traseira.
   */
  sideDoorCatches?: boolean;
  /**
   * Assentar a estação de encosto da porta traseira na FAIXA LISA do friso —
   * ver `seatFlankCatches()`. A de fábrica deste bake fica a cavalo do friso,
   * 16 a 21 mm acima do centro da faixa.
   */
  flankCatchOnFlat?: boolean;
  /**
   * Este implemento traz o PRÓPRIO SUB-CHASSI, e ele é fabricado no
   * comprimento do baú.
   *
   * Padrão pelo `kind`, como as peças de `has`: um SOBRECHASSI é aparafusado
   * na longarina de um rígido e leva o sobrequadro junto; um SEMIRREBOQUE
   * apoia no bogie e no pino-rei e o que está sob o piso dele é rodagem.
   *
   * Declarar continua valendo e ganha do padrão — é como entraria um
   * semirreboque cujo bake trouxesse o sobrequadro modelado, ou um
   * sobrechassi assado já sem ele.
   *
   * Ver `AssemblyRefs.subframe` em `trailer-assembly.ts`: sem esta marca, as
   * longarinas auxiliares, as travessas, as cartelas e o perfil corrido do
   * gancheiro ficam com o comprimento de fábrica enquanto o baú cresce.
   */
  subframe?: boolean;
  /**
   * Este implemento RECEBE a proteção lateral de `protecao_lateral_v1.glb`.
   *
   * Padrão pelo `kind`, e o padrão é o inverso do que parece: o SEMIRREBOQUE
   * NÃO recebe — ele já TEM a peça assada, e foi dele que ela foi extraída;
   * montá-la de novo seria duplicar a grade sobre ela mesma. Quem recebe é o
   * SOBRECHASSI, que não a tem.
   *
   * ⚠️ A peça é do BAÚ, não do caminhão: presa à raiz do implemento, ela herda
   * a inclinação da mesa da longarina, a posição e o comprimento. Ver
   * `vehicle/side-guard.ts`, que registra as duas versões erradas antes desta.
   */
  sideGuard?: boolean;
  /**
   * O `.glb` da unidade de refrigeração DESTE implemento, em `models/vehicles/`.
   *
   * Ausente = `thermoking.glb`, a unidade grande do semirreboque. O sobrechassi
   * veio com a sua, menor, no mesmo pacote do modelo — e uma unidade de
   * semirreboque numa testeira de 2,6 m fica fora de escala.
   */
  thermoKingFile?: string;
}

/* ------------------------------------------------------------------ *
 * O padrão de código — ver o ⚠️ do cabeçalho.
 * ------------------------------------------------------------------ */

/** O implemento que já estava no ar, com o NOME ANTIGO do arquivo.
 *  Renomear o asset é passo de deploy; o padrão daqui é a rede de segurança
 *  para o intervalo entre os dois deploys, e por isso ele aponta para o nome
 *  que a árvore servida tem HOJE. */
export const LEGACY_IMPLEMENT: ImplementDef = {
  id: 'semirreboque-frigorifico-paleteiro',
  label: 'Semirreboque frigorífico paleteiro',
  short: 'Paleteiro',
  file: 'trailer.glb',
  meta: 'trailer_meta.json',
  kind: 'semirreboque',
  has: { wheels: true, landingGear: true, kingpin: true, plate: true, thermoKing: true },
};

/* ------------------------------------------------------------------ *
 * Registro
 * ------------------------------------------------------------------ */

let catalog: readonly ImplementDef[] = [LEGACY_IMPLEMENT];
let currentId = LEGACY_IMPLEMENT.id;

/** Forma do `models/vehicles/implements.json`. */
interface ImplementManifest {
  implements?: unknown;
  default?: unknown;
}

/** Um campo que falta não derruba o implemento inteiro: ele cai no padrão da
 *  peça. O que NÃO pode faltar é `id` e `file` — sem eles não há o que carregar
 *  nem como referir. */
function parseOne(raw: unknown): ImplementDef | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === 'string' ? o.id.trim() : '';
  const file = typeof o.file === 'string' ? o.file.trim() : '';
  if (!id || !file) return null;
  const has = (o.has ?? {}) as Record<string, unknown>;
  const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);
  const kind: ImplementKind = o.kind === 'sobrechassi' ? 'sobrechassi' : 'semirreboque';
  /* O padrão de cada peça segue o TIPO, que é a informação que o manifesto não
     pode contradizer sem dizer: um semirreboque tem pino, rodagem e patola; um
     sobrechassi não tem nenhum dos três. Declarar peça a peça continua valendo
     e ganha do padrão — é como um sobrechassi com rodízio auxiliar entraria. */
  const semi = kind === 'semirreboque';
  return {
    id,
    file,
    label: typeof o.label === 'string' && o.label ? o.label : id,
    short: typeof o.short === 'string' && o.short ? o.short : (typeof o.label === 'string' ? o.label : id),
    meta: typeof o.meta === 'string' && o.meta ? o.meta : undefined,
    kind,
    has: {
      wheels: bool(has.wheels, semi),
      landingGear: bool(has.landingGear, semi),
      kingpin: bool(has.kingpin, semi),
      plate: bool(has.plate, semi),
      thermoKing: bool(has.thermoKing, true),
    },
    stainlessTopRail: bool(o.stainlessTopRail, false),
    topRailDressing: bool(o.topRailDressing, false),
    frameMaterial: typeof o.frameMaterial === 'string' && o.frameMaterial
      ? o.frameMaterial : undefined,
    sillMaterial: typeof o.sillMaterial === 'string' && o.sillMaterial
      ? o.sillMaterial : undefined,
    bakedSideDoor: bool(o.bakedSideDoor, false),
    makerBranding: bool(o.makerBranding, false),
    lowFrameSkin: bool(o.lowFrameSkin, false),
    cornerTape: bool(o.cornerTape, false),
    lowFrameRail: bool(o.lowFrameRail, false),
    singleRearHose: bool(o.singleRearHose, false),
    strayConduits: bool(o.strayConduits, false),
    sideDoorCatches: bool(o.sideDoorCatches, false),
    flankCatchOnFlat: bool(o.flankCatchOnFlat, false),
    /* Segue o TIPO, como `has`: sobrechassi leva sobrequadro, semirreboque
       leva rodagem. Ver `ImplementDef.subframe`. */
    subframe: bool(o.subframe, !semi),
    /* O semirreboque já tem a peça assada — ver `ImplementDef.sideGuard`. */
    sideGuard: bool(o.sideGuard, !semi),
    thermoKingFile: typeof o.thermoKingFile === 'string' && o.thermoKingFile
      ? o.thermoKingFile : undefined,
  };
}

/**
 * A regex do perfil da saia, ou `undefined` para o padrão de
 * `trailer-geometry.ts`.
 *
 * Uma fonte inválida no manifesto NÃO derruba a carga: cai no padrão e avisa.
 * O manifesto é editado à mão junto com o asset, e um parêntese sobrando ali
 * não pode custar o implemento inteiro.
 */
function reOf(src: string | undefined, campo: string, id: string): RegExp | undefined {
  if (!src) return undefined;
  try {
    return new RegExp(src, 'i');
  } catch (e: unknown) {
    console.warn('[implemento]', campo, 'inválido em', id, '—',
      (e as Error)?.message, '· cai no material padrão.');
    return undefined;
  }
}

/** O perfil de arremate (o quadro de cima e de baixo). */
export const frameRegexOf = (d: ImplementDef) => reOf(d.frameMaterial, 'frameMaterial', d.id);
/** O perfil de BAIXO, quando ele tem material próprio. */
export const sillRegexOf = (d: ImplementDef) => reOf(d.sillMaterial, 'sillMaterial', d.id);

/**
 * Instala o manifesto. `null` (ou um manifesto inútil) mantém o padrão de
 * código — nunca esvazia o catálogo, porque um catálogo vazio é um estúdio sem
 * implemento e nenhum erro na tela.
 */
export function setImplementCatalog(manifest: unknown): readonly ImplementDef[] {
  const m = (manifest ?? {}) as ImplementManifest;
  const list = Array.isArray(m.implements)
    ? m.implements.map(parseOne).filter((d): d is ImplementDef => !!d)
    : [];
  if (!list.length) {
    console.warn('[implemento] implements.json ausente ou vazio —',
      'catálogo de código:', LEGACY_IMPLEMENT.file);
    catalog = [LEGACY_IMPLEMENT];
    currentId = LEGACY_IMPLEMENT.id;
    return catalog;
  }
  catalog = list;
  const wanted = typeof m.default === 'string' ? m.default : '';
  /* A seleção corrente sobrevive a um recarregamento de manifesto quando o id
     ainda existe — senão o `default`, senão o primeiro. */
  currentId = list.some((d) => d.id === currentId) ? currentId
    : (list.some((d) => d.id === wanted) ? wanted : list[0].id);
  console.info('[implemento]', list.length, 'no catálogo · corrente:', currentId);
  return catalog;
}

/** Todos, na ordem do manifesto. */
export const getImplements = (): readonly ImplementDef[] => catalog;

/** Um, por id. `null` quando não existe — o chamador decide o que fazer. */
export const getImplement = (id: string): ImplementDef | null =>
  catalog.find((d) => d.id === id) ?? null;

/** O corrente. Nunca `null`: o catálogo nunca fica vazio. */
export const getCurrentImplement = (): ImplementDef =>
  getImplement(currentId) ?? catalog[0] ?? LEGACY_IMPLEMENT;

/**
 * Escolhe o corrente. Devolve `true` quando a escolha MUDOU.
 *
 * ⚠️ NÃO RECARREGA NADA. A troca de implemento tem de acontecer dentro da
 * orquestração de `studio.ts` — a mesma que solta a fusão (`releaseMerge()`),
 * baixa a cortina e refaz `applyMergeNow()` no fim. Recarregar daqui deixaria a
 * cena com a fusão do implemento ANTIGO de pé sobre malhas que não existem
 * mais, que é a armadilha descrita em [[studio-fusao-mede-balde-2026-08-16]].
 */
export function setCurrentImplement(id: string): boolean {
  if (!getImplement(id)) {
    console.warn('[implemento]', id, 'não está no catálogo — a escolha fica em', currentId);
    return false;
  }
  if (id === currentId) return false;
  currentId = id;
  return true;
}
