import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IconGift, IconCheck, IconClock } from "@tabler/icons-react";
import { useThirteenths } from "../../hooks/personnel-department/use-thirteenths";
import { formatCurrency, formatDate } from "../../utils";
import { THIRTEENTH_STATUS_LABELS, THIRTEENTH_STATUS } from "../../constants";
import type { Thirteenth } from "../../types/thirteenth";

interface CollaboratorThirteenthCardProps {
  userId: string;
  className?: string;
}

const statusVariant = (status: THIRTEENTH_STATUS): "delivered" | "pending" | "secondary" | "outline" => {
  switch (status) {
    case THIRTEENTH_STATUS.PAID:
      return "delivered";
    case THIRTEENTH_STATUS.FIRST_PAID:
    case THIRTEENTH_STATUS.SECOND_PAID:
      return "secondary";
    case THIRTEENTH_STATUS.CANCELLED:
      return "outline";
    default:
      return "pending";
  }
};

function InstallmentRow({
  label,
  value,
  date,
}: {
  label: string;
  value: number | null;
  date: Date | string | null;
}) {
  const paid = !!date;
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground flex items-center gap-1.5">
        {paid ? (
          <IconCheck className="h-3.5 w-3.5 text-green-600" />
        ) : (
          <IconClock className="h-3.5 w-3.5" />
        )}
        {label}
        {paid && date ? ` · paga em ${formatDate(new Date(date))}` : " · pendente"}
      </span>
      <span className="tabular-nums font-medium">{value != null ? formatCurrency(value) : "-"}</span>
    </div>
  );
}

/**
 * 13º Salário — read-only per-employee view of the colaborador's gratificação
 * natalina records. The engine (and financeiro forecast) handle generation;
 * this section only surfaces the records and their parcelas. Pagamento das
 * parcelas continua na tela própria do 13º / folha.
 */
export function CollaboratorThirteenthCard({ userId, className }: CollaboratorThirteenthCardProps) {
  const { data, isLoading } = useThirteenths({
    where: { userId },
    orderBy: { year: "desc" },
    limit: 20,
  });

  const records = (data?.data ?? []) as Thirteenth[];

  return (
    <Card className={className}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <IconGift className="h-5 w-5 text-muted-foreground" />
          13º Salário
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-4">Carregando...</p>
        ) : records.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            Nenhum registro de 13º para este colaborador. A geração é feita pela rotina anual de 13º.
          </p>
        ) : (
          <div className="space-y-3">
            {records.map((t) => {
              const total = (t.firstInstallment ?? 0) + (t.secondInstallment ?? 0);
              return (
                <div key={t.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{t.year}</span>
                      <Badge variant="secondary" className="text-[10px]">
                        {t.avos}/12 avos
                      </Badge>
                    </div>
                    <Badge variant={statusVariant(t.status)} className="text-xs">
                      {THIRTEENTH_STATUS_LABELS[t.status] ?? t.status}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <InstallmentRow label="1ª parcela" value={t.firstInstallment} date={t.firstInstallmentDate} />
                    <InstallmentRow label="2ª parcela" value={t.secondInstallment} date={t.secondInstallmentDate} />
                    <div className="flex items-center justify-between text-sm pt-1.5 mt-1.5 border-t border-border/50">
                      <span className="text-muted-foreground">Total</span>
                      <span className="tabular-nums font-semibold">{formatCurrency(total)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
