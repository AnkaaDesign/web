import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { BILLING_STATUS_LABELS } from "@/constants";
import type { BILLING_STATUS } from "@/types/budget";

interface BillingStatusBadgeProps {
  status: BILLING_STATUS;
  className?: string;
  size?: "default" | "sm" | "lg";
  /** Para `PARTIAL`: quantas parcelas já foram pagas. */
  paidCount?: number;
  /** Para `PARTIAL`: quantas parcelas existem. */
  totalCount?: number;
}

/**
 * O ESTADO DA COBRANÇA — badge PRÓPRIO, e não o do orçamento.
 *
 * Os dois enums têm valores com o mesmo nome (`PENDING`, `APPROVED`,
 * `CANCELLED`) querendo dizer coisas diferentes, e valores que só existem de um
 * lado (`OVERDUE`, `PARTIAL`, `SETTLED` aqui; `SIGNED`, `EXPIRED` lá). Enquanto
 * a lista de Faturamento desenhava `QuoteStatusBadge`, ela mostrava a fase do
 * CONTRATO onde o financeiro precisa ver a fase do PAGAMENTO — e depois do
 * encolhimento do enum do orçamento mostraria "Aprovado" em todas as linhas.
 *
 * ⚠️ As cores são as do ciclo do dinheiro e não repetem as do orçamento por
 * acaso: `OVERDUE` é o único vermelho do sistema que significa atraso de
 * pagamento.
 */
export function BillingStatusBadge({ status, className, size = "default", paidCount, totalCount }: BillingStatusBadgeProps) {
  // SEIS ESTADOS, SEIS CORES. Nenhuma se repete, porque quem varre esta lista procura por COR
  // antes de ler o rótulo — e duas situações da mesma cor são duas situações que se confundem.
  const variants: Record<BILLING_STATUS, string> = {
    // O ÚNICO vermelho desta escala: há dinheiro atrasado, e só o cliente pagando resolve.
    OVERDUE: "destructive",
    // A cobrança está montada e ainda não foi aprovada — a ação é NOSSA.
    PENDING: "pending",
    // Aprovada e cobrada: fatura, boleto e nota saíram; esperando pagar.
    APPROVED: "processing",
    // Entrando dinheiro. Ciano e não o azul de `inProgress`: `APPROVED` já ocupa o azul, e "cobrei"
    // e "recebi metade" são as duas situações que o financeiro mais precisa distinguir de relance.
    PARTIAL: "cyan",
    SETTLED: "completed",
    // ⚠️ CINZA, e NÃO o vermelho que `QuoteStatusBadge` usa para orçamento cancelado.
    //
    // Divergir é deliberado: numa lista de dinheiro, vermelho tem de querer dizer "atrasado" e nada
    // além disso. Pintando cancelado de vermelho, procurar o que está em atraso passa a devolver
    // também os registros mortos — que é o oposto do que a cor existe para fazer. Cobrança
    // cancelada é inerte, e cinza é o que diz isso.
    CANCELLED: "inactive",
  };

  // Normaliza a caixa: um payload antigo com "settled" ainda resolve para um
  // rótulo em vez de vazar o valor cru na tela.
  const normalized = (typeof status === "string" ? status.toUpperCase() : status) as BILLING_STATUS;
  const label = BILLING_STATUS_LABELS[normalized] ?? "Desconhecido";
  const variant = variants[normalized] ?? "secondary";

  // "Parcial" sozinho não diz o tamanho da falta: 1/6 e 5/6 são situações
  // diferentes para quem cobra.
  const displayLabel =
    normalized === "PARTIAL" && paidCount != null && totalCount != null ? `Parcial (${paidCount}/${totalCount})` : label;

  return (
    <Badge variant={variant as any} size={size} className={cn("font-medium whitespace-nowrap", className)}>
      {displayLabel}
    </Badge>
  );
}
