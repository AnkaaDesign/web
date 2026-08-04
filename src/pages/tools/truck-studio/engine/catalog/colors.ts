/* Catálogo de CORES do configurador.
   ---------------------------------------------------------------------------
   A cor deixou de ser um `<input type="color">` na sidebar e virou um PASSO do
   seletor: depois do modelo, um grid de cards com o cavalo já renderizado em
   cada cor. Este módulo é a fonte de verdade de quais cores existem.

   Sobre a base de dados: as cores de verdade são a tabela `Paint` da API
   (id, name, hex, finish, code, paintBrand, colorOrder — ver
   prisma/schema.prisma), e é para lá que isto vai apontar. Hoje o estúdio NÃO
   está conectado, então a lista embutida abaixo é o que aparece — e ela foi
   escrita com os MESMOS campos do banco, para a ligação depois ser um mapper de
   dez linhas e não uma refatoração.

   Como ligar quando a API entrar (sem quebrar a regra do engine de não importar
   `@/`): a página React chama setColorProvider() antes de mountStudio() —

     import { setColorProvider } from './engine/catalog/colors';
     setColorProvider(async () => (await getPaints({ orderBy: { colorOrder: 'asc' } }))
       .data.map(p => ({ id: p.id, name: p.name, hex: p.hex,
                         finish: FINISH_FROM_API[p.finish], code: p.code ?? null,
                         brand: p.paintBrand?.name ?? null })));

   — e loadColors() passa a servir o banco, caindo na lista embutida se a
   chamada falhar. Mesmo contrato de catalog.ts: NADA aqui pode lançar, porque o
   seletor abre antes de qualquer 3D existir. */
import type { PaintFinish, PaintParams } from '../vehicle/paint';

/**
 * Ajuste de renderização gravado para ESTA cor.
 *
 * É `previewConfig.truckStudio` do `Paint` (ver previewConfigSchema em
 * web/src/schemas/paint.ts, que é quem valida). Parcial de propósito: o painel
 * grava só o que foi mexido, e o que faltar cai no default do acabamento.
 *
 * Declarado aqui, e não importado de `@/schemas/paint`, porque o motor não
 * importa `@/` — é o que o mantém montável fora do app (harness.html) e o que
 * impede o estúdio de arrastar o barrel de schemas do Ankaa para dentro do
 * bundle da página.
 */
export type PaintStudioConfig = Partial<PaintParams>;

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
   * Ajuste de renderização gravado para esta cor, ou null quando ninguém
   * ajustou ainda (e aí valem os defaults do acabamento em vehicle/paint.ts).
   */
  studio: PaintStudioConfig | null;
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
   Enquanto a API não entra. Ordem = `colorOrder`: neutros primeiro (é o que
   mais sai), depois as cores de marca. */
/* `studio` entra como null em todas: ajuste de renderização é dado do banco, e
   uma paleta de emergência (API fora, provedor não ligado) não é lugar para
   números afinados à mão — sem ajuste gravado o motor usa os defaults do
   acabamento, que é exatamente o comportamento que se quer no fallback. */
const BUILTIN: PaintColorDef[] = ([
  { id: 'branco-geada', name: 'Branco Geada', hex: '#eef1f5', finish: 'solid', code: 'BR-100', brand: null },
  { id: 'branco-perola', name: 'Branco Pérola', hex: '#e6e4dd', finish: 'pearl', code: 'BR-220', brand: null },
  { id: 'prata-polar', name: 'Prata Polar', hex: '#b9bec6', finish: 'metallic', code: 'PR-410', brand: null },
  { id: 'grafite', name: 'Grafite', hex: '#4b5058', finish: 'metallic', code: 'GF-520', brand: null },
  { id: 'preto-onix', name: 'Preto Ônix', hex: '#15171c', finish: 'solid', code: 'PT-010', brand: null },
  { id: 'vermelho-ankaa', name: 'Vermelho Ankaa', hex: '#c8102e', finish: 'solid', code: 'VM-300', brand: null },
  { id: 'vermelho-rubi', name: 'Vermelho Rubi', hex: '#8d1524', finish: 'pearl', code: 'VM-360', brand: null },
  { id: 'azul-ankaa', name: 'Azul Ankaa', hex: '#1b365d', finish: 'metallic', code: 'AZ-600', brand: null },
  { id: 'azul-oceano', name: 'Azul Oceano', hex: '#2f77bd', finish: 'metallic', code: 'AZ-640', brand: null },
  { id: 'verde-mata', name: 'Verde Mata', hex: '#1f5d3a', finish: 'metallic', code: 'VD-700', brand: null },
  { id: 'amarelo-ambar', name: 'Amarelo Âmbar', hex: '#f0b31c', finish: 'solid', code: 'AM-800', brand: null },
  { id: 'laranja-solar', name: 'Laranja Solar', hex: '#e2621b', finish: 'solid', code: 'LR-820', brand: null },
] as Omit<PaintColorDef, 'studio'>[]).map((c) => ({ ...c, studio: null }));

/* ---------------- estado ---------------- */

/** A lista viva. Preenchida por loadColors(); nunca vazia depois do boot. */
export const colors: PaintColorDef[] = [];
/** true quando a lista veio do embutido (API ausente ou provedor não ligado). */
export let colorsAreFallback = true;

/** Provedor injetado pela aplicação; ver o cabeçalho. */
export type ColorProvider = () => Promise<unknown>;
let provider: ColorProvider | null = null;

/** Liga a lista de cores a uma fonte externa (a API). Chame ANTES de mountStudio(). */
export function setColorProvider(fn: ColorProvider | null) {
  provider = typeof fn === 'function' ? fn : null;
  loading = null;                       // uma troca de fonte invalida o memo
}

/* ---------------- gravação do ajuste ----------------
   O painel de tinta grava o ajuste NA COR, e a cor é uma linha de `Paint` — que
   já carrega `manufacturer`, então uma linha já É "aquela cor daquela
   montadora" e não faz falta chave nenhuma dentro do JSON.

   Mesma inversão do provedor, e pelo mesmo motivo: quem sabe falar com a API é
   a página React (que pode importar `@/api-client`), não o motor. O motor só
   declara o buraco. Sem persistidor ligado o painel continua funcionando ao
   vivo — só não tem onde salvar, e diz isso. */
export type ColorPersister = (colorId: string, studio: PaintStudioConfig) => Promise<void>;
let persister: ColorPersister | null = null;

/** Liga o botão "Aplicar" do painel de tinta a um destino. */
export function setColorPersister(fn: ColorPersister | null) {
  persister = typeof fn === 'function' ? fn : null;
}

/** @returns {boolean} true quando há onde gravar — o painel usa para habilitar "Aplicar". */
export const canPersistColors = () => persister !== null;

/**
 * Grava o ajuste de renderização desta cor e atualiza a lista viva.
 *
 * A lista é atualizada ANTES do await de propósito: o painel já está mostrando
 * o resultado ao vivo, e deixar `colors` discordando do que está na tela até a
 * rede responder é o que faria reabrir o seletor "desfazer" o ajuste. Se a
 * gravação falhar o valor anterior volta, e o erro sobe para quem chamou
 * mostrar — engolir aqui daria um "Aplicado" para algo que não foi.
 *
 * @throws se não houver persistidor ligado, ou se a API recusar.
 */
export async function saveColorStudio(colorId: string, studio: PaintStudioConfig): Promise<void> {
  const entry = colors.find((c) => c.id === colorId);
  if (!entry) throw new Error('Cor não está na paleta carregada.');
  if (!persister) throw new Error('Sem destino para gravar: o estúdio não está ligado na API.');
  const previous = entry.studio;
  entry.studio = studio;
  try {
    await persister(colorId, studio);
  } catch (e: unknown) {
    entry.studio = previous;
    throw e;
  }
}

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const str = (v: unknown): string | null =>
  (typeof v === 'string' && v.trim() ? v.trim() : null);

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
  /* O ajuste não invalida a cor: um `truckStudio` corrompido (editado à mão no
     banco, gravado por uma versão anterior do painel) tem de degradar para "sem
     ajuste" e deixar o card na paleta, não sumir com a cor da tela. Quem
     valida de verdade é o zod no PUT — aqui só se checa que é objeto. */
  const rawStudio = raw.studio;
  const studio = rawStudio && typeof rawStudio === 'object' && !Array.isArray(rawStudio)
    ? rawStudio as PaintStudioConfig
    : null;
  return { id, name, hex, finish, code: str(raw.code), brand: str(raw.brand), studio };
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
