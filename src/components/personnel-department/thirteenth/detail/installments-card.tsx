import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { IconCash, IconCheck, IconLoader2, IconFileText, IconCalendar } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useThirteenthPayFirst, useThirteenthPaySecond } from "../../../../hooks/personnel-department/use-thirteenths";
import { formatCurrency, formatDate } from "../../../../utils";
import type { Thirteenth } from "../../../../types/thirteenth";
import { canPayFirst, canPaySecond } from "../utils";
import { InstallmentRecibo } from "./installment-recibo";

interface InstallmentsCardProps {
  thirteenth: Thirteenth;
  /** Blocks pay actions (PAID/CANCELLED). */
  disabled?: boolean;
  className?: string;
}

function Money({ value }: { value: number | null | undefined }) {
  return <span className="tabular-nums font-medium">{value != null ? formatCurrency(value) : "-"}</span>;
}

export function InstallmentsCard({ thirteenth, disabled = false, className }: InstallmentsCardProps) {
  const payFirst = useThirteenthPayFirst();
  const paySecond = useThirteenthPaySecond();

  const [reciboInstallment, setReciboInstallment] = useState<1 | 2 | null>(null);
  const [confirmPay, setConfirmPay] = useState<1 | 2 | null>(null);

  const firstPayable = !disabled && canPayFirst(thirteenth);
  const secondPayable = !disabled && canPaySecond(thirteenth);

  const secondDeductions = (thirteenth.inss ?? 0) + (thirteenth.irrf ?? 0);

  const handleConfirmPay = async () => {
    try {
      if (confirmPay === 1) {
        await payFirst.mutateAsync({ id: thirteenth.id });
      } else if (confirmPay === 2) {
        await paySecond.mutateAsync({ id: thirteenth.id });
      }
      setConfirmPay(null);
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Error paying installment:", error);
      }
    }
  };

  const isPaying = payFirst.isPending || paySecond.isPending;

  return (
    <Card className={cn("shadow-sm border border-border", className)}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <IconCash className="h-5 w-5 text-muted-foreground" />
          Parcelas
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        {/* 1ª parcela */}
        <div className="rounded-lg border border-border p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">1ª Parcela</span>
              <Badge variant="secondary" className="text-[10px]">
                50% · sem descontos
              </Badge>
            </div>
            {thirteenth.firstInstallmentDate ? (
              <Badge variant="delivered" className="text-xs">
                Paga
              </Badge>
            ) : (
              <Badge variant="pending" className="text-xs">
                Pendente
              </Badge>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Valor líquido</span>
              <Money value={thirteenth.firstInstallment} />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1">
                <IconCalendar className="h-3.5 w-3.5" /> Vencimento
              </span>
              <span>até 30/Nov</span>
            </div>
            {thirteenth.firstInstallmentDate && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Pago em</span>
                <span>{formatDate(new Date(thirteenth.firstInstallmentDate))}</span>
              </div>
            )}
          </div>

          <div className="flex gap-2 mt-3">
            {firstPayable && (
              <Button size="sm" onClick={() => setConfirmPay(1)} disabled={isPaying}>
                <IconCheck className="h-4 w-4 mr-2" />
                Marcar como paga
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setReciboInstallment(1)} disabled={thirteenth.firstInstallment == null}>
              <IconFileText className="h-4 w-4 mr-2" />
              Recibo
            </Button>
          </div>
        </div>

        {/* 2ª parcela */}
        <div className="rounded-lg border border-border p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">2ª Parcela</span>
              <Badge variant="secondary" className="text-[10px]">
                INSS + IRRF · base exclusiva
              </Badge>
            </div>
            {thirteenth.secondInstallmentDate ? (
              <Badge variant="delivered" className="text-xs">
                Paga
              </Badge>
            ) : (
              <Badge variant="pending" className="text-xs">
                Pendente
              </Badge>
            )}
          </div>

          <div className="space-y-1.5">
            {secondDeductions > 0 && (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">(-) INSS</span>
                  <Money value={thirteenth.inss} />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">(-) IRRF</span>
                  <Money value={thirteenth.irrf} />
                </div>
              </>
            )}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Valor líquido</span>
              <Money value={thirteenth.secondInstallment} />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1">
                <IconCalendar className="h-3.5 w-3.5" /> Vencimento
              </span>
              <span>até 20/Dez</span>
            </div>
            {thirteenth.secondInstallmentDate && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Pago em</span>
                <span>{formatDate(new Date(thirteenth.secondInstallmentDate))}</span>
              </div>
            )}
          </div>

          <div className="flex gap-2 mt-3">
            {secondPayable && (
              <Button size="sm" onClick={() => setConfirmPay(2)} disabled={isPaying}>
                <IconCheck className="h-4 w-4 mr-2" />
                Marcar como paga
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setReciboInstallment(2)} disabled={thirteenth.secondInstallment == null}>
              <IconFileText className="h-4 w-4 mr-2" />
              Recibo
            </Button>
          </div>
          {!secondPayable && canPayFirst(thirteenth) && (
            <p className="text-xs text-muted-foreground mt-2">A 2ª parcela só pode ser paga após a 1ª.</p>
          )}
        </div>
      </CardContent>

      {/* Pay confirmation */}
      <AlertDialog open={confirmPay !== null} onOpenChange={(open) => !open && setConfirmPay(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar pagamento</AlertDialogTitle>
            <AlertDialogDescription>
              Marcar a {confirmPay === 1 ? "1ª" : "2ª"} parcela do 13º{thirteenth.user?.name ? ` de "${thirteenth.user.name}"` : ""} como paga?
              {confirmPay === 2 && " Esta ação conclui o 13º (status Pago)."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmPay} disabled={isPaying}>
              {isPaying ? <IconLoader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Recibo */}
      <InstallmentRecibo thirteenth={thirteenth} installment={reciboInstallment} onClose={() => setReciboInstallment(null)} />
    </Card>
  );
}
