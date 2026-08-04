import { IconReportMoney } from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PAINTING_STEP_KIND_LABELS } from "@/types";
import type { PaintingAnalysis } from "@/types";
import { formatCurrency, formatDateTime } from "@/utils";
import { formatMinutesLabel, formatNumber, materialDisplayLabel, toNumber } from "./common";

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 py-4">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-xl font-semibold">{value}</span>
      </CardContent>
    </Card>
  );
}

/** Resumo e composição do orçamento (a aprovação fica no header da página). */
export function BudgetTab({ analysis }: { analysis: PaintingAnalysis }) {
  const plan = analysis.plan;

  if (!plan) {
    return (
      <Card>
        <CardContent className="py-6">
          <EmptyState
            icon={<IconReportMoney className="h-10 w-10" />}
            title="Orçamento ainda não calculado"
            description="Processe a análise ou recalcule o plano na aba Análise."
          />
        </CardContent>
      </Card>
    );
  }

  const steps = plan.steps ?? [];
  const totalAreaM2 = (analysis.faces ?? []).reduce((sum, face) => sum + toNumber(face.areaM2), 0);

  // laborCost vem como string Decimal da API: sem toNumber, `+=` concatena strings e o total vira NaN.
  const laborByKind = steps.reduce<Map<string, { label: string; minutes: number; cost: number }>>((map, step) => {
    const entry = map.get(step.kind) ?? { label: PAINTING_STEP_KIND_LABELS[step.kind], minutes: 0, cost: 0 };
    entry.minutes += toNumber(step.minutes);
    entry.cost += toNumber(step.laborCost);
    map.set(step.kind, entry);
    return map;
  }, new Map());

  const materialsAggregated = steps
    .flatMap((step) => step.materials ?? [])
    .reduce<Map<string, { label: string; quantity: number; unit: string; cost: number; missingPrice: boolean }>>((map, material) => {
      const label = materialDisplayLabel(material.label);
      const entry = map.get(label) ?? { label, quantity: 0, unit: material.unit, cost: 0, missingPrice: false };
      entry.quantity += toNumber(material.quantity);
      entry.cost += toNumber(material.totalCost);
      entry.missingPrice = entry.missingPrice || (toNumber(material.unitPriceSnapshot) === 0 && toNumber(material.totalCost) === 0);
      map.set(label, entry);
      return map;
    }, new Map());

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Área total" value={`${formatNumber(totalAreaM2)} m²`} />
        <SummaryCard label="Horas de trabalho" value={formatMinutesLabel(toNumber(plan.totalMinutes))} />
        <SummaryCard label="Horas de espera" value={formatMinutesLabel(toNumber(plan.totalWaitMinutes))} />
        <SummaryCard label="Dias de produção" value={String(plan.totalDays)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Composição do Orçamento</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Detalhe</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell colSpan={3} className="bg-muted/40 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Mão de obra ({formatCurrency(toNumber(plan.laborRatePerHour))}/h)
                  </TableCell>
                </TableRow>
                {Array.from(laborByKind.values()).map((labor) => (
                  <TableRow key={labor.label}>
                    <TableCell>{labor.label}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{formatMinutesLabel(labor.minutes)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(labor.cost)}</TableCell>
                  </TableRow>
                ))}

                <TableRow>
                  <TableCell colSpan={3} className="bg-muted/40 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Materiais
                  </TableCell>
                </TableRow>
                {Array.from(materialsAggregated.values()).map((material) => (
                  <TableRow key={material.label}>
                    <TableCell>
                      {material.label}
                      {material.missingPrice && material.cost !== 0 && (
                        <Badge variant="red" size="sm" className="ml-2">
                          sem preço
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatNumber(material.quantity)} {material.unit}
                    </TableCell>
                    <TableCell className="text-right">
                      {material.missingPrice && material.cost === 0 ? (
                        <Badge variant="red" size="sm">
                          sem preço
                        </Badge>
                      ) : (
                        formatCurrency(material.cost)
                      )}
                    </TableCell>
                  </TableRow>
                ))}

                <TableRow>
                  <TableCell>Custos indiretos</TableCell>
                  <TableCell className="text-right" />
                  <TableCell className="text-right">{formatCurrency(toNumber(plan.indirectCost))}</TableCell>
                </TableRow>
                <TableRow className="font-semibold">
                  <TableCell>Custo total</TableCell>
                  <TableCell className="text-right" />
                  <TableCell className="text-right">{formatCurrency(toNumber(plan.totalCost))}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Margem de lucro</TableCell>
                  <TableCell className="text-right" />
                  {/* profitMarginPct é FRAÇÃO (0.35 = 35%) — multiplicar antes de exibir. */}
                  <TableCell className="text-right">{(toNumber(plan.profitMarginPct) * 100).toFixed(0)}%</TableCell>
                </TableRow>
                <TableRow className="bg-primary/10">
                  <TableCell className="text-base font-bold">Preço sugerido</TableCell>
                  <TableCell className="text-right" />
                  <TableCell className="text-right text-base font-bold">{formatCurrency(toNumber(plan.suggestedPrice))}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <span className="text-xs text-muted-foreground">
              {plan.priceSnapshotAt ? `Preços congelados em ${formatDateTime(plan.priceSnapshotAt)}` : "Preços ainda não congelados"}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
