/* Catálogo de CORES do configurador.
   ---------------------------------------------------------------------------
   A cor deixou de ser um `<input type="color">` na sidebar e virou um PASSO do
   seletor: depois do modelo, um grid de cards com o cavalo já renderizado em
   cada cor. Este módulo é a fonte de verdade de quais cores existem.

   Sobre a base de dados: as cores de verdade são a tabela `Paint` da API
   (id, name, hex, finish, code, paintBrand, colorOrder — ver
   prisma/schema.prisma), e o estúdio ESTÁ ligado nela. Quem faz a ligação é a
   página React (../../index.tsx), que chama setColorProvider() na avaliação do
   módulo — antes de mountStudio() — com uma consulta getPaints() de verdade.

   Ela mora LÁ, e não aqui, porque o engine não importa `@/`: ele conhece só o
   contrato `ColorProvider` (uma função que devolve uma promessa de qualquer
   coisa), e este módulo valida o que chegar. A lista embutida abaixo continua
   existindo e continua sendo servida quando o provedor falha, devolve vazio ou
   não foi ligado — o que também é o caso de qualquer uso do engine fora desta
   página. Ela foi escrita com os MESMOS campos do banco, que é o que tornou a
   ligação um mapper de dez linhas em vez de uma refatoração.

   Mesmo contrato de catalog.ts: NADA aqui pode lançar, porque o seletor abre
   antes de qualquer 3D existir. */
import type { PaintFinish } from '../vehicle/paint';

/** Uma cor do catálogo — espelho do `Paint` da API, só com o que a UI usa. */
export interface PaintColorDef {
  /** estável: vai para o localStorage junto com a escolha */
  id: string;
  /** nome pt-BR do card */
  name: string;
  /** hex sRGB do basecoat */
  hex: string;
  /**
   * Família de acabamento. O banco tem cinco (SOLID, METALLIC, PEARL, MATTE,
   * SATIN) e o motor de tinta tem três — MATTE/SATIN não têm shader próprio
   * ainda e são mapeadas para 'solid' na conversão, nunca inventadas aqui.
   */
  finish: PaintFinish;
  /** código do fabricante da tinta, quando houver */
  code: string | null;
  /** marca da tinta (PaintBrand.name) */
  brand: string | null;
  /**
   * MONTADORA do caminhão a que esta tinta pertence, no id do catálogo
   * (`scania`, `volvo`, `daf`, `iveco`, `mb`, `vw`) — o mesmo id de
   * `brands.json`, NÃO o enum do banco.
   *
   * A tradução do enum (`MERCEDES_BENZ` → `mb`, `VOLKSWAGEN` → `vw`) acontece
   * do lado do provedor, em ../../index.tsx, porque é lá que se pode importar
   * `@/constants`. O engine só vê o id do catálogo e nunca precisa conhecer o
   * banco — é a mesma fronteira que mantém este módulo sem `@/`.
   *
   * `null` = tinta do catálogo geral, não amarrada a uma montadora.
   */
  manufacturer: string | null;
  /**
   * AJUSTE CURADO desta tinta, quando o setor de pintura fez um.
   *
   * A tabela `Paint` tem uma coluna `previewConfig` que o gerador de amostra 2D
   * usa para desenhar a pastilha de cor: luzes coloridas, cor de flip e cor de
   * cintilância. Hoje 107 das 522 tintas têm uma. O estúdio 3D IGNORAVA isso e
   * derivava o flop do próprio hex por fórmula (ver vehicle/paint.ts), o que dá
   * um resultado plausível para uma tinta qualquer e ERRADO para uma tinta
   * medida: o `Verde Saiph` da Mercedes vira amarelo no ângulo por causa de uma
   * luz `#c7e52e` no ajuste dela, e nenhuma fórmula sobre `#70b725` chega lá.
   *
   * `null` = sem ajuste; a derivação por fórmula continua valendo, que é o
   * comportamento certo para as 415 tintas sem curadoria.
   */
  effect: PaintEffect | null;
}

/**
 * A parte do `previewConfig` do banco que o shader 3D sabe usar.
 *
 * Deliberadamente MENOR que o JSON do banco: aquele descreve um desenho 2D
 * (posição e espalhamento de cada luz num plano), e nada disso tem tradução num
 * material PBR sobre geometria. O que sobrevive à travessia é a INTENÇÃO
 * CROMÁTICA — para que cor a tinta vira no ângulo, de que cor é o cintilo, e
 * quão forte é o efeito.
 */
export interface PaintEffect {
  /** cor do flop/interferência no ângulo rasante (o "amarelo" do Saiph) */
  flip: string | null;
  /** cor do floco metálico/mica */
  flake: string | null;
  /** 0..1 — quanto do efeito entra (o `effectIntensity` do banco, normalizado) */
  intensity: number;
  /** face medida no laboratório; sobrepõe `hex` NA RENDERIZAÇÃO, nunca no card */
  color?: string | null;
  /** acabamento medido; sobrepõe `finish` quando a receita discorda do catálogo */
  recipeFinish?: string | null;
  /* ---- campos da RECEITA DO paint-lab, quando o ajuste veio de lá ----
     O laboratório (`paint-lab.html`) salva o conjunto PBR inteiro. Estes campos
     são opcionais porque a outra fonte — o `previewConfig` do gerador 2D — não
     tem como preenchê-los: ela descreve luzes num plano, não um material.
     Ausente ⇒ o padrão do acabamento decide, como sempre decidiu. */
  metalness?: number;
  roughness?: number;
  /** 0..1; o estúdio converte para clearcoatRoughness */
  gloss?: number;
  pearlAmount?: number;
  /** quão rápido o flop viaja com o ângulo */
  pearlTravel?: number;
  flakeAmount?: number;
  /** células por metro do ruído de floco */
  flakeDensity?: number;
  peel?: number;
  peelScale?: number;
  peelDetail?: number;
  pearlMid?: string | null;
  flakeTilt?: number;
  flakeGloss?: number;
}

/** Como a API nomeia os acabamentos → como paint.ts os chama. */
export const FINISH_FROM_API: Record<string, PaintFinish> = {
  SOLID: 'solid', METALLIC: 'metallic', PEARL: 'pearl',
  /* Sem shader próprio: um fosco/acetinado renderizado como perolizado seria
     pior do que renderizado como sólido, que é do que ele mais se aproxima. */
  MATTE: 'solid', SATIN: 'solid',
};

/** Rótulo pt-BR do acabamento — usado no subtítulo do card. */
export const FINISH_LABEL: Record<PaintFinish, string> = {
  solid: 'Sólida', metallic: 'Metálica', pearl: 'Perolizada',
};

/* ---------------- lista embutida ----------------
   A rede de segurança, não o caminho normal: é o que aparece quando a API não
   responde, devolve vazio ou não há provedor ligado. Ordem = `colorOrder`:
   neutros primeiro (é o que mais sai), depois as cores de marca. */
const BUILTIN: PaintColorDef[] = [
  { id: 'branco-geada', name: 'Branco Geada', hex: '#eef1f5', finish: 'solid', code: 'BR-100', brand: null, manufacturer: null, effect: null },
  { id: 'branco-perola', name: 'Branco Pérola', hex: '#e6e4dd', finish: 'pearl', code: 'BR-220', brand: null, manufacturer: null, effect: null },
  { id: 'prata-polar', name: 'Prata Polar', hex: '#b9bec6', finish: 'metallic', code: 'PR-410', brand: null, manufacturer: null, effect: null },
  { id: 'grafite', name: 'Grafite', hex: '#4b5058', finish: 'metallic', code: 'GF-520', brand: null, manufacturer: null, effect: null },
  { id: 'preto-onix', name: 'Preto Ônix', hex: '#15171c', finish: 'solid', code: 'PT-010', brand: null, manufacturer: null, effect: null },
  { id: 'vermelho-ankaa', name: 'Vermelho Ankaa', hex: '#c8102e', finish: 'solid', code: 'VM-300', brand: null, manufacturer: null, effect: null },
  { id: 'vermelho-rubi', name: 'Vermelho Rubi', hex: '#8d1524', finish: 'pearl', code: 'VM-360', brand: null, manufacturer: null, effect: null },
  { id: 'azul-ankaa', name: 'Azul Ankaa', hex: '#1b365d', finish: 'metallic', code: 'AZ-600', brand: null, manufacturer: null, effect: null },
  { id: 'azul-oceano', name: 'Azul Oceano', hex: '#2f77bd', finish: 'metallic', code: 'AZ-640', brand: null, manufacturer: null, effect: null },
  { id: 'verde-mata', name: 'Verde Mata', hex: '#1f5d3a', finish: 'metallic', code: 'VD-700', brand: null, manufacturer: null, effect: null },
  { id: 'amarelo-ambar', name: 'Amarelo Âmbar', hex: '#f0b31c', finish: 'solid', code: 'AM-800', brand: null, manufacturer: null, effect: null },
  { id: 'laranja-solar', name: 'Laranja Solar', hex: '#e2621b', finish: 'solid', code: 'LR-820', brand: null, manufacturer: null, effect: null },
];

/* ---------------- estado ---------------- */

/** A lista viva. Preenchida por loadColors(); nunca vazia depois do boot. */
export const colors: PaintColorDef[] = [];
/** true quando a lista veio do embutido (API fora do ar ou provedor não ligado). */
export let colorsAreFallback = true;

/** Provedor injetado pela aplicação; ver o cabeçalho. */
export type ColorProvider = () => Promise<unknown>;
let provider: ColorProvider | null = null;

/** Liga a lista de cores a uma fonte externa (a API). Chame ANTES de mountStudio(). */
export function setColorProvider(fn: ColorProvider | null) {
  provider = typeof fn === 'function' ? fn : null;
  loading = null;                       // uma troca de fonte invalida o memo
}

/* ---------------- gravar a receita de volta na tinta ----------------
   O caminho inverso do provedor, e pela mesma razão de ser: quem sabe falar com
   a API é ../../index.tsx (é React e pode importar `@/`); o engine não pode, e é
   isso que o mantém portátil. Aqui fica só o buraco onde a função entra.

   O FORMATO É O DO LABORATÓRIO. A receita gravada é o objeto `PaintParams`
   inteiro, com os nomes que `paint-lab.html` usa — que são os mesmos que
   `paintEffectFrom()` (em index.tsx) lê de volta, reconhecendo a receita pelo
   marcador `pearlFlip`. É o que fecha o ciclo: o que este painel salva é
   exatamente o que o estúdio carrega na próxima vez, sem tradução no meio. */
export type ColorPersister = (colorId: string, recipe: Record<string, unknown>) => Promise<void>;
let persister: ColorPersister | null = null;

export function setColorPersister(fn: ColorPersister | null) {
  persister = typeof fn === 'function' ? fn : null;
}

/** Sem provedor não há linha de `Paint` para gravar — o painel esconde o
 *  "Aplicar" em vez de oferecer um botão que não faz nada. */
export const canPersistColors = () => persister !== null && !colorsAreFallback;

/**
 * Grava a receita como padrão desta cor.
 *
 * Atualiza a lista EM MEMÓRIA antes de devolver, e não só o banco: a mesma cor
 * será reaplicada a cada troca de cabine (studio.ts, applyColor) a partir de
 * `colors[]`. Sem isto o veículo voltaria ao ajuste velho no próximo clique e o
 * usuário veria a gravação "não pegar" — com o banco já correto.
 */
export async function saveColorRecipe(colorId: string, recipe: Record<string, unknown>) {
  if (!persister) throw new Error('Sem fonte de tintas: nada a gravar.');
  await persister(colorId, recipe);
  /* A mesma tradução que `paintEffectFrom()` faz ao ler do banco, porque é o
     mesmo salto: a receita chama `pearlFlip`/`flakeColor`/`finish`, e o
     PaintEffect chama `flip`/`flake`/`recipeFinish`. `intensity: 1` porque uma
     receita já traz as amplitudes em cada campo — não há um ganho global. */
  const c = colors.find(x => x.id === colorId);
  if (c) c.effect = normalizeEffect({
    ...recipe,
    flip: recipe.pearlFlip ?? null,
    flake: recipe.flakeColor ?? null,
    recipeFinish: recipe.finish ?? null,
    intensity: 1,
  });
}

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const str = (v: unknown): string | null =>
  (typeof v === 'string' && v.trim() ? v.trim() : null);

/* O ajuste curado, validado com o mesmo rigor do resto: uma cor inválida vira
   `null` e cai na derivação por fórmula, nunca numa cor inventada. */
function normalizeEffect(input: unknown): PaintEffect | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as Record<string, unknown>;
  const hex = (v: unknown): string | null => {
    const h = str(v);
    return h && HEX_RE.test(h) ? h : null;
  };
  const flip = hex(raw.flip);
  const flake = hex(raw.flake);
  if (!flip && !flake) return null;          // nada aproveitável
  const n = Number(raw.intensity);
  const num = (v: unknown): number | undefined => {
    const x = Number(v);
    return Number.isFinite(x) ? x : undefined;
  };
  return {
    flip, flake,
    color: hex(raw.color),
    recipeFinish: str(raw.recipeFinish),
    intensity: Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0.6,
    metalness: num(raw.metalness), roughness: num(raw.roughness),
    gloss: num(raw.gloss),
    pearlAmount: num(raw.pearlAmount), pearlTravel: num(raw.pearlTravel),
    flakeAmount: num(raw.flakeAmount), flakeDensity: num(raw.flakeDensity),
    peel: num(raw.peel), peelScale: num(raw.peelScale),
    peelDetail: num(raw.peelDetail), pearlMid: hex(raw.pearlMid),
    flakeTilt: num(raw.flakeTilt), flakeGloss: num(raw.flakeGloss),
  };
}

/* Dado externo: valide, não confie. Uma entrada sem id/nome/hex válido é
   descartada em vez de virar um card que pinta o caminhão de preto. */
function normalize(input: unknown): PaintColorDef | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as Record<string, unknown>;
  const id = str(raw.id);
  const name = str(raw.name);
  const hex = str(raw.hex);
  if (!id || !name || !hex || !HEX_RE.test(hex)) return null;
  const rawFinish = str(raw.finish) || '';
  const finish: PaintFinish =
    FINISH_FROM_API[rawFinish.toUpperCase()]
    || (rawFinish === 'metallic' || rawFinish === 'pearl' || rawFinish === 'solid'
      ? rawFinish as PaintFinish
      : 'solid');
  /* Minúsculo por contrato: o provedor manda o id do catálogo, mas um `SCANIA`
     vindo de qualquer outra fonte não pode virar uma montadora desconhecida e
     esvaziar a paleta em silêncio. */
  const man = str(raw.manufacturer);
  return {
    id, name, hex, finish,
    code: str(raw.code), brand: str(raw.brand),
    manufacturer: man ? man.toLowerCase() : null,
    effect: normalizeEffect(raw.effect),
  };
}

let loading: Promise<PaintColorDef[]> | null = null;

async function doLoad(): Promise<PaintColorDef[]> {
  if (provider) {
    try {
      const raw = await provider();
      const list = (Array.isArray(raw) ? raw : []).map(normalize)
        .filter((c): c is PaintColorDef => c !== null);
      if (list.length) {
        colors.splice(0, colors.length, ...list);
        colorsAreFallback = false;
        return colors;
      }
      console.warn('[cores] provedor devolveu lista vazia — usando a paleta embutida.');
    } catch (e: unknown) {
      console.warn('[cores] provedor falhou — usando a paleta embutida.',
        e instanceof Error ? e.message : String(e));
    }
  }
  colors.splice(0, colors.length, ...BUILTIN);
  colorsAreFallback = true;
  return colors;
}

/**
 * Carrega a paleta. Idempotente (devolve a MESMA promessa) e nunca lança.
 * @returns {Promise<PaintColorDef[]>}
 */
export function loadColors(): Promise<PaintColorDef[]> {
  if (!loading) loading = doLoad();
  return loading;
}

/* ---------------- consultas ---------------- */

/**
 * A paleta de UMA montadora.
 *
 * POR QUE FILTRAR NO CLIENTE em vez de consultar por montadora: a tabela `Paint`
 * tem 522 linhas, das quais só 77 estão amarradas a uma montadora (Volvo 26,
 * Scania 23, Mercedes 11, VW 9, DAF 7, Iveco 1). Setenta e sete linhas cabem numa
 * consulta só, no boot, junto do catálogo — e a partir daí trocar de montadora no
 * seletor é síncrono. Uma consulta por montadora colocaria uma ida à rede no meio
 * da navegação do seletor, que é exatamente onde ela mais aparece.
 *
 * Sem correspondência ⇒ devolve a paleta inteira em vez de uma lista vazia. Um
 * passo de cor vazio não tem leitura possível: o usuário não sabe se a montadora
 * não tem tinta cadastrada ou se algo quebrou.
 */
export function colorsFor(manufacturerId: string | null | undefined): PaintColorDef[] {
  if (!manufacturerId) return colors;
  const id = String(manufacturerId).toLowerCase();
  const mine = colors.filter((c) => c.manufacturer === id);
  return mine.length ? mine : colors;
}

/** A cor padrão DENTRO da paleta de uma montadora — a primeira, por `colorOrder`. */
export function defaultColorFor(manufacturerId: string | null | undefined): PaintColorDef {
  const list = colorsFor(manufacturerId);
  return list[0] || defaultColor();
}

/** @returns {PaintColorDef|undefined} */
export function getColor(id: string | null | undefined): PaintColorDef | undefined {
  if (!id) return undefined;
  return colors.find((c) => c.id === id);
}

/* A primeira da lista. Nos catálogos escritos por gente a primeira é a mais
   vendida, e é um branco/prata — que é exatamente o que se quer mostrar a quem
   ainda não escolheu nada. Antes de loadColors() a lista está vazia, então cai
   no primeiro embutido em vez de devolver null e deixar o boot sem cor. */
export function defaultColor(): PaintColorDef {
  return colors[0] || BUILTIN[0];
}

/** @returns {string} id da cor padrão — o que defaultChoice() grava. */
export function defaultColorId(): string {
  return defaultColor().id;
}
