import { TASK_QUOTE_STATUS, TASK_QUOTE_STATUS_LABELS, TASK_QUOTE_STATUS_ORDER } from "@/constants";
import type { TASK_QUOTE_STATUS as QuoteStatus } from "@/types/budget";

/**
 * O CICLO DO ORÇAMENTO INTEIRO, na ORDEM DE ATENÇÃO — derivado, nunca transcrito.
 *
 * ⚠️ Existe porque três telas escreviam a própria lista de estados À MÃO, e as
 * três ficaram para trás quando o enum cresceu de cinco para oito em 20/09/2026:
 * o seletor de status da revisão do orçamento (que passou a não oferecer
 * `IN_NEGOTIATION` — a transição que a feature inteira existe para permitir) e o
 * filtro do funil de vendas (que passou a não conseguir filtrar por requisição).
 * Nenhum dos dois deu erro de compilação: uma lista positiva de strings continua
 * válida quando o enum ganha membro, e o que falha é a TELA.
 *
 * A ordem é a de `TASK_QUOTE_STATUS_ORDER`, que é a de AÇÃO PENDENTE e não a
 * cronológica — a mesma em que a lista de Orçamentos desenha as linhas, para que
 * o operador leia o seletor na ordem em que já lê a tabela.
 */
export const QUOTE_STATUSES_IN_ORDER: QuoteStatus[] = (Object.values(TASK_QUOTE_STATUS) as QuoteStatus[])
  .slice()
  .sort((a, b) => TASK_QUOTE_STATUS_ORDER[a] - TASK_QUOTE_STATUS_ORDER[b]);

/** Os mesmos estados já como opções `{ value, label }`, para combobox e filtro. */
export const QUOTE_STATUS_OPTIONS_IN_ORDER: Array<{ value: string; label: string }> =
  QUOTE_STATUSES_IN_ORDER.map((value) => ({ value: value as string, label: TASK_QUOTE_STATUS_LABELS[value] }));

/**
 * DE QUAIS ESTADOS voltar para `PENDING` é uma REJEIÇÃO — e não um avanço.
 *
 * ⚠️ O teste era `próximo === PENDING && atual !== PENDING`, em dois lugares
 * (a revisão do orçamento e o seletor do detalhe da tarefa). Era verdade
 * enquanto os únicos caminhos até `PENDING` vinham de DEPOIS dele. O portal abriu
 * dois que vêm de ANTES — `REQUESTED → PENDING` (requisição que vai direto para
 * assinatura, quando o cliente não tem vendedor intermediário) e
 * `PRE_APPROVED → PENDING` (o vendedor pré-aprovou e o documento sai) —, e os
 * dois são o caminho FELIZ. Com a forma antiga, mandar uma requisição para
 * assinatura abria um diálogo intitulado "Rejeitar Orçamento" exigindo o motivo
 * da rejeição, e gravava esse motivo no changelog do orçamento.
 *
 * A lista é POSITIVA e nomeia os três de onde `PENDING` é mesmo um passo atrás,
 * para que um estado novo nasça sendo "avanço" — que é o lado seguro: pedir um
 * motivo que ninguém tem trava o fluxo; deixar de pedir um motivo apenas perde
 * uma anotação.
 */
const REVERTS_INTO_PENDING: QuoteStatus[] = ["EXPIRED", "SIGNED", "APPROVED"];

/** Esta transição precisa do motivo da rejeição? */
export function isQuoteRejection(from: QuoteStatus | string | null | undefined, to: QuoteStatus | string): boolean {
  if (to !== TASK_QUOTE_STATUS.PENDING) return false;
  return !!from && REVERTS_INTO_PENDING.includes(from as QuoteStatus);
}
