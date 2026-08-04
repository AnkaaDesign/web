import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useUpdatePaintingStep, useUpdatePaintingStepMaterial, useUpdatePaintingStepTask } from "@/hooks";
import type { PaintingProductionStep } from "@/types";
import { formatCurrency } from "@/utils";
import { PaintSwatch, formatMinutesLabel, formatNumber } from "../common";

/** Decimais do Prisma podem chegar como string — coerção única na entrada da tabela. */
const toFinite = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/** "53,24 m² ÷ 2,13 L" vira "25 m²/L" — o quanto rende cada unidade do insumo. */
function yieldLabel(basisQuantity: number | null | undefined, basisUnit: string | null | undefined, quantity: number, unit: string): string {
  if (!basisQuantity || !basisUnit || quantity <= 0) return "—";
  return `${formatNumber(basisQuantity / quantity)} ${basisUnit}/${unit}`;
}

interface StepCostTableProps {
  step: PaintingProductionStep;
  laborRatePerHour: number | null;
}

/**
 * Composição de custo do passo: UMA lista só (material e mão de obra lado a lado,
 * por isso a coluna se chama "Descrição"), todas as linhas com a mesma altura.
 *
 * As colunas contam a conta inteira: o RENDIMENTO do insumo, a BASE daquele serviço
 * e só então a quantidade consumida e o valor — ex.: Intercap rende 25 m²/L, este
 * passo tem 53,24 m² de chapa, logo consome 2,13 L.
 */
export function StepCostTable({ step, laborRatePerHour }: StepCostTableProps) {
  const updateStepMutation = useUpdatePaintingStep();
  const updateTaskMutation = useUpdatePaintingStepTask();
  const updateMaterialMutation = useUpdatePaintingStepMaterial();

  const materials = [...(step.materials ?? [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const tasks = [...(step.tasks ?? [])].sort((a, b) => a.position - b.position);
  const waitMinutes = toFinite(step.waitMinutes);
  const rate = laborRatePerHour != null ? toFinite(laborRatePerHour) : null;
  const laborCost = toFinite(step.laborCost);
  const stepTotal = laborCost + toFinite(step.materialCost);

  // Rascunho por linha: material e mão de obra usam o MESMO controle, então a
  // coluna Qtd. fica alinhada e tudo é editável — não só o tempo.
  const [draft, setDraft] = useState<Record<string, number>>({});
  useEffect(() => {
    setDraft({});
  }, [step.id]);

  const valueOf = (id: string, persisted: number) => draft[id] ?? persisted;

  const QuantityCell = ({ id, persisted, onCommit }: { id: string; persisted: number; onCommit: (value: number) => void }) => (
    <TableCell className="py-1.5">
      <div className="flex justify-end">
        <Input
          type="number"
          min={0}
          step={0.01}
          value={valueOf(id, persisted)}
          onChange={(value) => setDraft((current) => ({ ...current, [id]: typeof value === "number" ? value : Number(value) || 0 }))}
          onBlur={() => {
            const next = draft[id];
            if (next === undefined || next === persisted || next < 0) return;
            onCommit(next);
          }}
          className="h-7 w-24 text-right tabular-nums"
        />
      </div>
    </TableCell>
  );

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="overflow-x-auto">
          <Table className="min-w-[860px]">
            <TableHeader>
              <TableRow>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right">Rendimento</TableHead>
                <TableHead className="text-right">Base</TableHead>
                <TableHead className="text-right">Qtd.</TableHead>
                <TableHead className="w-14">Un.</TableHead>
                <TableHead className="text-right">Valor unit.</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {materials.map((material) => {
                const quantity = toFinite(material.quantity);
                const missingPrice = toFinite(material.unitPriceSnapshot) === 0;
                return (
                  <TableRow key={material.id} className="h-11">
                    <TableCell className="py-1.5">
                      <span className="inline-flex items-center gap-1.5">
                        {material.paint && <PaintSwatch hex={material.paint.hex} />}
                        {material.label}
                        {material.sizeLabel ? <span className="text-xs text-muted-foreground">({material.sizeLabel})</span> : null}
                        {missingPrice && (
                          <Badge variant="red" size="sm">
                            sem preço
                          </Badge>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="py-1.5 text-right tabular-nums text-muted-foreground">
                      {yieldLabel(material.basisQuantity, material.basisUnit, quantity, material.unit)}
                    </TableCell>
                    <TableCell className="py-1.5 text-right tabular-nums text-muted-foreground">
                      {material.basisQuantity ? `${formatNumber(toFinite(material.basisQuantity))} ${material.basisUnit ?? ""}` : "—"}
                    </TableCell>
                    <QuantityCell
                      id={material.id}
                      persisted={quantity}
                      onCommit={(value) => updateMaterialMutation.mutate({ materialId: material.id, data: { quantity: value } })}
                    />
                    <TableCell className="py-1.5 text-muted-foreground">{material.unit}</TableCell>
                    <TableCell className="py-1.5 text-right tabular-nums">
                      {missingPrice ? "—" : formatCurrency(toFinite(material.unitPriceSnapshot))}
                    </TableCell>
                    <TableCell className="py-1.5 text-right tabular-nums">
                      {missingPrice ? "—" : formatCurrency(toFinite(material.totalCost))}
                    </TableCell>
                  </TableRow>
                );
              })}

              {tasks.map((task) => {
                const minutes = valueOf(task.id, toFinite(task.minutes));
                const total = rate != null ? (minutes / 60) * rate : 0;
                return (
                  <TableRow key={task.id} className="h-11">
                    <TableCell className="py-1.5">
                      {task.label}
                    </TableCell>
                    <TableCell className="py-1.5 text-right tabular-nums text-muted-foreground">
                      {task.basisQuantity > 0 && minutes > 0 ? `${formatNumber(task.basisQuantity / minutes)} ${task.basisUnit ?? ""}/min` : "—"}
                    </TableCell>
                    <TableCell className="py-1.5 text-right tabular-nums text-muted-foreground">
                      {task.basisQuantity > 0 ? `${formatNumber(task.basisQuantity)} ${task.basisUnit ?? ""}` : "—"}
                    </TableCell>
                    <QuantityCell
                      id={task.id}
                      persisted={toFinite(task.minutes)}
                      onCommit={(value) => updateTaskMutation.mutate({ taskId: task.id, data: { minutes: value } })}
                    />
                    <TableCell className="py-1.5 text-muted-foreground">min</TableCell>
                    <TableCell className="py-1.5 text-right tabular-nums">{rate != null && rate > 0 ? `${formatCurrency(rate)}/h` : "—"}</TableCell>
                    <TableCell className="py-1.5 text-right tabular-nums">{formatCurrency(total)}</TableCell>
                  </TableRow>
                );
              })}

              {/* Passo sem sub-tarefas: uma linha única com os minutos do passo. */}
              {tasks.length === 0 && (
                <TableRow className="h-11">
                  <TableCell className="py-1.5">Execução do passo</TableCell>
                  <TableCell className="py-1.5 text-right text-muted-foreground">—</TableCell>
                  <TableCell className="py-1.5 text-right tabular-nums text-muted-foreground">
                    {step.quantity ? `${formatNumber(toFinite(step.quantity))} ${step.quantityUnit ?? ""}` : "—"}
                  </TableCell>
                  <QuantityCell
                    id={step.id}
                    persisted={toFinite(step.minutes)}
                    onCommit={(value) => updateStepMutation.mutate({ stepId: step.id, data: { minutes: value } })}
                  />
                  <TableCell className="py-1.5 text-muted-foreground">min</TableCell>
                  <TableCell className="py-1.5 text-right tabular-nums">{rate != null && rate > 0 ? `${formatCurrency(rate)}/h` : "—"}</TableCell>
                  <TableCell className="py-1.5 text-right tabular-nums">{formatCurrency(laborCost)}</TableCell>
                </TableRow>
              )}

              <TableRow className="h-11 font-semibold">
                <TableCell colSpan={6} className="py-1.5 text-right">
                  Total do passo
                  {waitMinutes > 0 ? (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">+{formatMinutesLabel(waitMinutes)} de espera</span>
                  ) : null}
                </TableCell>
                <TableCell className="py-1.5 text-right tabular-nums">{formatCurrency(stepTotal)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
