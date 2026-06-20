import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Termination } from "../../../../types/termination";
import { ItemsCard } from "./items-card";
import { PaymentCard } from "./payment-card";

interface CalculationPaymentCardProps {
  termination: Termination;
  /** True when the termination is COMPLETED/CANCELLED — blocks every mutation. */
  disabled?: boolean;
  className?: string;
}

/**
 * Etapas de Cálculo/Pagamento: as Verbas Rescisórias e o Pagamento formam UM
 * único card, empilhados (verbas em cima, pagamento embaixo) com um divisor
 * horizontal — lê-se como uma só seção e cabe ao lado do Resumo (meia largura).
 */
export function CalculationPaymentCard({ termination, disabled = false, className }: CalculationPaymentCardProps) {
  return (
    <Card className={cn("flex flex-col overflow-hidden", className)}>
      <ItemsCard termination={termination} disabled={disabled} bare />
      <div className="border-t border-border" />
      <PaymentCard termination={termination} disabled={disabled} bare />
    </Card>
  );
}
