import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { IconReceipt, IconCalculator, IconPrinter, IconLoader2 } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "../../../../utils";
import type { Vacation, VacationRecibo } from "../../../../types/vacation";
import { useVacationCalculate } from "../../../../hooks/personnel-department/use-vacations";
import { generateVacationReciboPDF } from "../../../../utils/vacation-recibo-pdf-generator";

interface VacationReciboCardProps {
  vacation: Vacation;
  className?: string;
}

function Line({ label, amount, negative }: { label: string; amount: number; negative?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm border-b border-border/50 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-medium tabular-nums", negative ? "text-destructive" : "")}>
        {negative ? "- " : ""}
        {formatCurrency(amount)}
      </span>
    </div>
  );
}

/**
 * Build a display recibo from the persisted vacation fields so the card
 * hydrates on load (the recibo is auto-calculated at create time). A fresh
 * recalculation via the action replaces this with the server response.
 */
/** Coerce a possibly-string Decimal (or null/NaN) to a finite number. */
function toNum(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function reciboFromEntity(vacation: Vacation): VacationRecibo | null {
  if (vacation.baseRemuneration == null) return null;
  // Monetary fields arrive as strings (Prisma Decimal over JSON); coerce before
  // arithmetic, otherwise sums become string concatenation → NaN.
  const baseRemuneration = toNum(vacation.baseRemuneration);
  const oneThird = toNum(vacation.oneThird);
  const abonoAmount = toNum(vacation.abonoAmount);
  const inss = toNum(vacation.inss);
  const irrf = toNum(vacation.irrf);
  const abonoOneThird = 0; // not persisted separately on the entity
  const earnings = baseRemuneration + oneThird + abonoAmount + abonoOneThird;
  const discounts = inss + irrf;
  return {
    vacationId: vacation.id,
    userId: vacation.userId,
    vacationDays: Math.max(0, vacation.entitledDays - vacation.abonoPecuniarioDays),
    abonoPecuniarioDays: vacation.abonoPecuniarioDays,
    baseRemuneration,
    oneThird,
    abonoAmount,
    abonoOneThird,
    isDouble: vacation.isDouble,
    taxableBase: baseRemuneration + oneThird,
    inss,
    irrf,
    earnings,
    discounts,
    net: earnings - discounts,
    lines: [],
  };
}

export function VacationReciboCard({ vacation, className }: VacationReciboCardProps) {
  const calculate = useVacationCalculate();
  const [recalculated, setRecalculated] = useState<VacationRecibo | null>(null);

  // Hydrate from the persisted entity; a manual recalc overrides it.
  const persisted = useMemo(() => reciboFromEntity(vacation), [vacation]);
  const recibo = recalculated ?? persisted;

  const handleCalculate = async () => {
    try {
      const result = await calculate.mutateAsync(vacation.id);
      if (result.data?.recibo) {
        setRecalculated(result.data.recibo);
      }
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Error calculating vacation recibo:", error);
      }
    }
  };

  const handlePrint = () => {
    if (!recibo) return;
    generateVacationReciboPDF({
      recibo,
      employeeName: vacation.user?.name ?? "Colaborador",
      position: vacation.user?.position?.name,
      sector: vacation.user?.sector?.name,
      acquisitiveStart: vacation.acquisitiveStart,
      acquisitiveEnd: vacation.acquisitiveEnd,
      concessiveEnd: vacation.concessiveEnd,
      paymentDate: vacation.paymentDate,
    });
  };

  return (
    <Card className={cn("shadow-sm border border-border", className)}>
      <CardHeader className="pb-4 flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <IconReceipt className="h-5 w-5 text-muted-foreground" />
          Recibo de Férias
        </CardTitle>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleCalculate} disabled={calculate.isPending}>
            {calculate.isPending ? <IconLoader2 className="h-4 w-4 mr-2 animate-spin" /> : <IconCalculator className="h-4 w-4 mr-2" />}
            {recibo ? "Recalcular" : "Calcular"}
          </Button>
          {recibo && (
            <Button variant="default" size="sm" onClick={handlePrint}>
              <IconPrinter className="h-4 w-4 mr-2" />
              Imprimir
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        {!recibo ? (
          <p className="text-sm text-muted-foreground">
            Clique em <span className="font-medium">Calcular</span> para gerar o recibo de férias (férias + 1/3 + abono − INSS/IRRF), pagável separadamente da folha mensal.
          </p>
        ) : (
          <>
            {recibo.isDouble && (
              <Alert variant="destructive">
                <AlertDescription>Férias em dobro (art. 137): o período concessivo expirou — os valores foram dobrados.</AlertDescription>
              </Alert>
            )}

            <div>
              {recibo.lines && recibo.lines.length > 0 ? (
                recibo.lines.map((line, i) => <Line key={i} label={line.label} amount={Math.abs(line.amount)} negative={line.amount < 0} />)
              ) : (
                <>
                  <Line label={`Férias (${recibo.vacationDays} dias)`} amount={recibo.baseRemuneration} />
                  <Line label="1/3 Constitucional" amount={recibo.oneThird} />
                  {recibo.abonoPecuniarioDays > 0 && <Line label={`Abono Pecuniário (${recibo.abonoPecuniarioDays} dias)`} amount={recibo.abonoAmount} />}
                  {recibo.abonoOneThird > 0 && <Line label="1/3 sobre Abono" amount={recibo.abonoOneThird} />}
                  {recibo.inss > 0 && <Line label="INSS" amount={recibo.inss} negative />}
                  {recibo.irrf > 0 && <Line label="IRRF" amount={recibo.irrf} negative />}
                </>
              )}
            </div>

            <div className="space-y-1 rounded-md border border-border p-3 bg-muted/20">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total de Proventos</span>
                <span className="font-medium tabular-nums">{formatCurrency(recibo.earnings)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total de Descontos</span>
                <span className="font-medium tabular-nums text-destructive">- {formatCurrency(recibo.discounts)}</span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-border">
                <span className="font-semibold">Líquido a Receber</span>
                <span className="font-bold text-lg tabular-nums">
                  {formatCurrency(recibo.net)}
                  {recibo.isDouble && (
                    <Badge variant="destructive" className="ml-2 text-[10px] align-middle">
                      Dobro
                    </Badge>
                  )}
                </span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
