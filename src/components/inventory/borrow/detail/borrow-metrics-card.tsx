import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IconClock, IconCalendarTime, IconAlertTriangle, IconCircleCheck, IconTrendingUp, IconCoins } from "@tabler/icons-react";
import type { Borrow } from "../../../../types";
import { BORROW_STATUS } from "../../../../constants";
import { getDaysBetween, formatRelativeTime, formatCurrency } from "../../../../utils";
import { cn } from "@/lib/utils";

interface BorrowMetricsCardProps {
  borrow: Borrow;
  className?: string;
}

interface MetricItemProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subValue?: string;
  color?: "default" | "success" | "warning" | "danger";
}

function MetricItem({ icon, label, value, subValue, color = "default" }: MetricItemProps) {
  const colorClasses = {
    default: "bg-primary/10 text-primary",
    success: "bg-green-100 text-green-600",
    warning: "bg-yellow-100 text-yellow-600",
    danger: "bg-red-100 text-red-600",
  };

  return (
    <div className="bg-muted/30 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <div className={cn("p-2 rounded-lg", colorClasses[color])}>{icon}</div>
        <div className="flex-1">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
          {subValue && <p className="text-sm text-muted-foreground mt-1">{subValue}</p>}
        </div>
      </div>
    </div>
  );
}

export function BorrowMetricsCard({ borrow, className }: BorrowMetricsCardProps) {
  const isReturned = borrow.status === BORROW_STATUS.RETURNED;

  // Calculate days borrowed
  const daysBorrowed = getDaysBetween(borrow.createdAt, borrow.returnedAt || new Date());

  // Calculate relative time
  const borrowedAgo = formatRelativeTime(borrow.createdAt);
  const returnedAgo = borrow.returnedAt ? formatRelativeTime(borrow.returnedAt) : null;

  // Calculate estimated value (if item has price)
  const estimatedValue = borrow.item?.prices?.[0]?.value ? borrow.quantity * borrow.item.prices[0].value : null;

  // Determine if overdue (example: over 30 days is considered overdue)
  const isOverdue = !isReturned && daysBorrowed > 30;

  return (
    <Card className={cn("shadow-sm border border-border", className)} level={1}>
      <CardHeader className="pb-6">
        <CardTitle className="flex items-center gap-3 text-xl">
          <div className="p-2 rounded-lg bg-primary/10">
            <IconTrendingUp className="h-5 w-5 text-primary" />
          </div>
          Métricas do Empréstimo
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Days Borrowed */}
          <MetricItem
            icon={<IconClock className="h-5 w-5" />}
            label="Tempo de Empréstimo"
            value={`${daysBorrowed} ${daysBorrowed === 1 ? "dia" : "dias"}`}
            subValue={isReturned ? "Finalizado" : "Em andamento"}
            color={isOverdue ? "warning" : "default"}
          />

          {/* Status Metric */}
          <MetricItem
            icon={isReturned ? <IconCircleCheck className="h-5 w-5" /> : <IconCalendarTime className="h-5 w-5" />}
            label="Status do Empréstimo"
            value={isReturned ? "Devolvido" : "Ativo"}
            subValue={isReturned ? (returnedAgo ?? undefined) : borrowedAgo}
            color={isReturned ? "success" : "default"}
          />

          {/* Overdue Alert (only for active borrows) */}
          {!isReturned && isOverdue && (
            <MetricItem icon={<IconAlertTriangle className="h-5 w-5" />} label="Atenção" value="Prazo Excedido" subValue={`Emprestado há mais de 30 dias`} color="danger" />
          )}

          {/* Estimated Value */}
          {estimatedValue && (
            <MetricItem
              icon={<IconCoins className="h-5 w-5" />}
              label="Valor Estimado"
              value={formatCurrency(estimatedValue)}
              subValue={`${borrow.quantity} × ${formatCurrency(borrow.item!.prices![0].value)}`}
              color="default"
            />
          )}
        </div>

        {/* Additional metrics for returned items */}
        {isReturned && borrow.returnedAt && (
          <div className="mt-6 pt-6 border-t border-border/50">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Emprestado em</p>
                <p className="text-base font-semibold text-foreground mt-1">{new Date(borrow.createdAt).toLocaleDateString("pt-BR")}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Devolvido em</p>
                <p className="text-base font-semibold text-foreground mt-1">{new Date(borrow.returnedAt).toLocaleDateString("pt-BR")}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Duração Total</p>
                <p className="text-base font-semibold text-foreground mt-1">
                  {daysBorrowed} {daysBorrowed === 1 ? "dia" : "dias"}
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
