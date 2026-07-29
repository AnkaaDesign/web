/**
 * "O que mudou no orçamento" — a lista que explica uma coleta de assinaturas
 * invalidada.
 *
 * UM COMPONENTE, DUAS PELES
 * ------------------------------------------------------------------------
 * A mesma informação aparece em quatro lugares, e dois deles não são o app:
 *
 *   · detalhe da tarefa e detalhe do orçamento (tema do app, claro/escuro);
 *   · faturamento (idem);
 *   · página pública do orçamento (`/cliente/orcamento/:id`) — uma FOLHA, clara
 *     por definição, com a tipografia do documento impresso;
 *   · cerimônia de assinatura (`/cliente/assinar/:token`) — também clara.
 *
 * Duplicar o componente para as páginas públicas seria garantir que as duas
 * versões divergissem no primeiro ajuste. Por isso `variant`: `app` usa os
 * tokens do tema (`text-muted-foreground`, `bg-muted/50`) e `paper` usa cinzas
 * fixos, porque as páginas públicas rodam dentro de `force-light` e um token de
 * tema ali sairia branco no branco.
 *
 * O QUE A LISTA PRECISA RESPONDER
 * ------------------------------------------------------------------------
 * "Alteração em: serviços" não diz nada. Cada linha aqui responde três coisas de
 * uma vez: em QUE mudou (o serviço, o responsável), o que era ANTES e o que é
 * AGORA. Quando a diferença é dinheiro, o valor da variação vem junto — é a
 * primeira pergunta de quem lê ("ficou mais caro quanto?") e deixá-la para a
 * subtração mental do leitor é o mesmo que não responder.
 *
 * MATERIAL PRIMEIRO, COSMÉTICO RECOLHIDO
 * ------------------------------------------------------------------------
 * Só as alterações materiais derrubam assinaturas. As cosméticas (grafia de um
 * nome, nome fantasia do cliente) ficam atrás de um "ver mais": são ruído para
 * quem quer entender por que a assinatura caiu, mas escondê-las por completo
 * seria omitir parte do que mudou no documento. Ver
 * `api/.../services/quote-diff.ts`, que é quem classifica.
 *
 * DINHEIRO E A PREFERÊNCIA DE VISIBILIDADE
 * ------------------------------------------------------------------------
 * Os valores chegam do servidor já formatados em pt-BR (uma fonte só para web,
 * Flutter e e-mail). Isso os deixa fora do alcance de `formatCurrency`, que é
 * quem respeita a preferência "ocultar preços" — então a redação é feita aqui,
 * por cima do texto pronto. Sem isto, um usuário com preços ocultos veria o
 * orçamento inteiro reaparecer dentro do aviso de invalidação.
 */

import { useMemo, useState } from "react";
import {
  IconArrowNarrowRight,
  IconChevronDown,
  IconChevronRight,
  IconCirclePlus,
  IconCircleMinus,
  IconPencilMinus,
} from "@tabler/icons-react";
import { usePricingVisible } from "@/hooks/common/use-pricing-visible";

// =============================================================================
// Tipos — espelham api/src/modules/common/signature/services/quote-diff.ts
// =============================================================================

export type QuoteChangeSeverity = "MATERIAL" | "COSMETIC";
export type QuoteChangeKind = "ADDED" | "REMOVED" | "CHANGED";
export type QuoteChangeGroup =
  | "SERVICES"
  | "TOTALS"
  | "PAYMENT"
  | "GUARANTEE"
  | "SCHEDULE"
  | "VALIDITY"
  | "LAYOUT"
  | "PARTIES"
  | "VEHICLE"
  | "SIGNERS"
  | "DOCUMENT";

export interface QuoteChange {
  key: string;
  severity: QuoteChangeSeverity;
  kind: QuoteChangeKind;
  group: QuoteChangeGroup;
  label: string;
  subject: string | null;
  before: string | null;
  after: string | null;
  /** Variação em reais, com sinal. Só onde a diferença é dinheiro de verdade. */
  amountDelta?: number;
}

const GROUP_LABEL: Record<QuoteChangeGroup, string> = {
  SERVICES: "Serviços",
  TOTALS: "Valores",
  PAYMENT: "Pagamento",
  GUARANTEE: "Garantia",
  SCHEDULE: "Prazo",
  VALIDITY: "Validade",
  LAYOUT: "Layout",
  PARTIES: "Contratante",
  VEHICLE: "Veículo",
  SIGNERS: "Responsáveis",
  DOCUMENT: "Documento",
};

// =============================================================================
// Pele
// =============================================================================

type Variant = "app" | "paper";

interface Skin {
  muted: string;
  strong: string;
  rule: string;
  rowBg: string;
  groupLabel: string;
  positive: string;
  negative: string;
  neutral: string;
}

const SKINS: Record<Variant, Skin> = {
  app: {
    muted: "text-muted-foreground",
    strong: "text-foreground",
    rule: "border-border",
    rowBg: "bg-muted/40",
    groupLabel: "text-muted-foreground",
    // Verde/vermelho são o SINAL da variação, não a gravidade: um total que
    // baixou é verde mesmo tendo invalidado a coleta. Quem diz "isto derrubou
    // assinaturas" é o cartão que embrulha esta lista.
    positive: "text-green-600 dark:text-green-500",
    negative: "text-red-600 dark:text-red-400",
    neutral: "text-amber-600 dark:text-amber-500",
  },
  paper: {
    muted: "text-gray-500",
    strong: "text-gray-900",
    rule: "border-gray-200",
    rowBg: "bg-gray-50",
    groupLabel: "text-gray-500",
    positive: "text-green-700",
    negative: "text-red-700",
    neutral: "text-amber-700",
  },
};

// =============================================================================
// Dinheiro
// =============================================================================

/** "R$ 13.500,00", "R$13500,00" e afins — o suficiente para redigir com segurança. */
const MONEY_RE = /R\$\s?-?[\d.]+(?:,\d{2})?/g;

function redactMoney(value: string | null, visible: boolean): string | null {
  if (!value || visible) return value;
  return value.replace(MONEY_RE, "R$ ••••••");
}

function formatDelta(delta: number): string {
  const sign = delta > 0 ? "+" : "−";
  const abs = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Math.abs(delta));
  return `${sign}${abs}`;
}

// =============================================================================
// Linha
// =============================================================================

function ChangeRow({
  change,
  skin,
  pricesVisible,
}: {
  change: QuoteChange;
  skin: Skin;
  pricesVisible: boolean;
}) {
  const before = redactMoney(change.before, pricesVisible);
  const after = redactMoney(change.after, pricesVisible);
  const hasDelta = typeof change.amountDelta === "number" && change.amountDelta !== 0;

  const Icon =
    change.kind === "ADDED"
      ? IconCirclePlus
      : change.kind === "REMOVED"
        ? IconCircleMinus
        : IconPencilMinus;

  const iconTone =
    change.kind === "ADDED" ? skin.positive : change.kind === "REMOVED" ? skin.negative : skin.neutral;

  return (
    <div className={`flex items-start gap-2.5 rounded-lg px-3 py-2 ${skin.rowBg}`}>
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${iconTone}`} />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          {/* O assunto é o título quando existe: o leitor procura o SERVIÇO na
              lista, não o nome do campo. Sem assunto (valor total, validade), o
              rótulo do campo assume o papel de título. */}
          <span className={`text-sm font-medium ${skin.strong}`}>
            {change.subject ?? change.label}
          </span>
          {hasDelta && pricesVisible && (
            <span
              className={`shrink-0 text-sm font-semibold tabular-nums ${
                change.amountDelta! > 0 ? skin.negative : skin.positive
              }`}
              /* Vermelho para o que SOBE e verde para o que desce: quem lê esta
                 lista é o pagador (ou quem vai justificá-la a ele), e para o
                 pagador a alta é a má notícia. */
              title={change.amountDelta! > 0 ? "Aumento no orçamento" : "Redução no orçamento"}
            >
              {formatDelta(change.amountDelta!)}
            </span>
          )}
        </div>

        {change.subject && <p className={`text-xs ${skin.muted}`}>{change.label}</p>}

        {(before || after) && (
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
            {before && (
              <span className={`${skin.muted} ${after ? "line-through" : ""} break-all`}>{before}</span>
            )}
            {before && after && (
              <IconArrowNarrowRight className={`h-3.5 w-3.5 shrink-0 ${skin.muted}`} />
            )}
            {after && <span className={`font-medium ${skin.strong} break-all`}>{after}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Lista
// =============================================================================

function groupChanges(changes: QuoteChange[]): Array<[QuoteChangeGroup, QuoteChange[]]> {
  const map = new Map<QuoteChangeGroup, QuoteChange[]>();
  // A ordem de inserção é a que o servidor mandou, e ela já é a ordem de leitura
  // (serviços, valores, condições…). Reordenar aqui só recriaria essa regra num
  // segundo lugar, com uma chance a mais de as duas discordarem.
  for (const c of changes) {
    const list = map.get(c.group);
    if (list) list.push(c);
    else map.set(c.group, [c]);
  }
  return [...map.entries()];
}

export function QuoteChangeList({
  changes,
  variant = "app",
  className = "",
}: {
  changes: QuoteChange[];
  variant?: Variant;
  className?: string;
}) {
  // A preferência "ocultar valores" é do OPERADOR e vale dentro do app. Na
  // folha do cliente ela não se aplica — a página inteira é o orçamento, com os
  // preços impressos —, e deixá-la valer ali faria o aviso de alteração aparecer
  // redigido só porque quem abriu o link usa o mesmo navegador do sistema.
  const appPricesVisible = usePricingVisible();
  const pricesVisible = variant === "paper" || appPricesVisible;
  const [showCosmetic, setShowCosmetic] = useState(false);
  const skin = SKINS[variant];

  const { material, cosmetic } = useMemo(
    () => ({
      material: changes.filter(c => c.severity === "MATERIAL"),
      cosmetic: changes.filter(c => c.severity === "COSMETIC"),
    }),
    [changes],
  );

  if (!changes.length) return null;

  const groups = groupChanges(material);

  return (
    <div className={`space-y-3 ${className}`}>
      {groups.map(([group, items]) => (
        <div key={group} className="space-y-1.5">
          <p
            className={`text-[11px] font-semibold uppercase tracking-wide ${skin.groupLabel}`}
          >
            {GROUP_LABEL[group]}
          </p>
          {items.map(c => (
            <ChangeRow key={c.key} change={c} skin={skin} pricesVisible={pricesVisible} />
          ))}
        </div>
      ))}

      {cosmetic.length > 0 && (
        <div className={`border-t pt-2 ${skin.rule}`}>
          <button
            type="button"
            onClick={() => setShowCosmetic(v => !v)}
            className={`flex items-center gap-1 text-xs ${skin.muted} hover:underline`}
          >
            {showCosmetic ? (
              <IconChevronDown className="h-3.5 w-3.5" />
            ) : (
              <IconChevronRight className="h-3.5 w-3.5" />
            )}
            {cosmetic.length === 1
              ? "1 alteração que não muda a proposta"
              : `${cosmetic.length} alterações que não mudam a proposta`}
          </button>
          {showCosmetic && (
            <div className="mt-2 space-y-1.5">
              {cosmetic.map(c => (
                <ChangeRow key={c.key} change={c} skin={skin} pricesVisible={pricesVisible} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Resumo de uma linha: quantas alterações materiais e quanto o total se moveu.
 *
 * A variação sai da linha do TOTAL, nunca da soma dos deltas: subtotal, total e
 * cada serviço trazem o seu próprio delta, e somá-los contaria o mesmo dinheiro
 * três vezes.
 */
export function summarizeQuoteChanges(changes: QuoteChange[]): {
  materialCount: number;
  cosmeticCount: number;
  totalDelta: number | null;
} {
  const material = changes.filter(c => c.severity === "MATERIAL");
  const total = changes.find(c => c.key === "total");
  return {
    materialCount: material.length,
    cosmeticCount: changes.length - material.length,
    totalDelta: typeof total?.amountDelta === "number" ? total.amountDelta : null,
  };
}

/** Rótulo curto para cabeçalhos: "3 alterações · +R$ 1.500,00". */
export function quoteChangesHeadline(changes: QuoteChange[], pricesVisible = true): string {
  const { materialCount, totalDelta } = summarizeQuoteChanges(changes);
  const count = materialCount === 1 ? "1 alteração" : `${materialCount} alterações`;
  if (totalDelta === null || totalDelta === 0 || !pricesVisible) return count;
  return `${count} · ${formatDelta(totalDelta)}`;
}
