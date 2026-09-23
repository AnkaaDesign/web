import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  IconAlertTriangle,
  IconLoader2,
  IconShoppingCartPlus,
} from "@tabler/icons-react";

import type { PaintPurchaseMode, PaintPurchasePlanItem } from "@/api-client/paint";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { DateTimeInput } from "@/components/ui/date-time-input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import { routes } from "@/constants";
import {
  useCanViewPrices,
  useCreatePaintPurchaseOrder,
  usePaintPurchasePreview,
  useSuppliers,
} from "@/hooks";
import { useDebounce } from "@/hooks/common/use-debounce";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/utils";

import { formatGrams, formatLiters, formatUnits } from "./format";

interface PaintPurchaseDialogProps {
  paintId: string | null;
  paintName: string;
  hex: string;
  volumeLiters: number;
  /** Devolve o volume editado aqui para o card e o planejador. */
  onVolumeChange?: (paintId: string, volume: number) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MODES: Array<{ value: PaintPurchaseMode; label: string; hint: string }> = [
  {
    value: "FULL",
    label: "Fórmula inteira",
    hint: "Tudo o que a fórmula consome neste volume, sem olhar o estoque.",
  },
  {
    value: "MISSING",
    label: "Apenas o que falta",
    hint: "Desconta o que já existe em estoque e pede só a diferença.",
  },
];

/** Por que esta linha não entra no pedido — dito na própria linha. */
function excludedReason(item: PaintPurchasePlanItem, mode: PaintPurchaseMode): string {
  if (!item.measured) return "sem medida de peso";
  if (mode === "MISSING") return "estoque cobre";
  return "quantidade zero";
}

export function PaintPurchaseDialog({
  paintId,
  paintName,
  hex,
  volumeLiters,
  onVolumeChange,
  open,
  onOpenChange,
}: PaintPurchaseDialogProps) {
  const navigate = useNavigate();
  const canViewPrices = useCanViewPrices();

  const [mode, setMode] = useState<PaintPurchaseMode>("FULL");
  const [volume, setVolume] = useState(volumeLiters);
  const [description, setDescription] = useState("");
  const [descriptionTouched, setDescriptionTouched] = useState(false);
  const [supplierId, setSupplierId] = useState<string | undefined>(undefined);
  const [supplierTouched, setSupplierTouched] = useState(false);
  const [forecast, setForecast] = useState<Date | null>(null);
  const [notes, setNotes] = useState("");

  // Reabrir é recomeçar: o diálogo guarda decisões de UM pedido.
  useEffect(() => {
    if (!open) return;
    setVolume(volumeLiters);
    setMode("FULL");
    setDescription("");
    setDescriptionTouched(false);
    setSupplierId(undefined);
    setSupplierTouched(false);
    setForecast(null);
    setNotes("");
    // Só ao ABRIR — o volume digitado aqui não pode ser reposto pelo prop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // O volume vale para a página inteira: o que se digita aqui é o mesmo número
  // do card e do quadro de componentes.
  useEffect(() => {
    if (!open || !paintId) return;
    if (volume === volumeLiters) return;
    onVolumeChange?.(paintId, volume);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [volume]);

  const debouncedVolume = useDebounce(volume, 350);
  const params = useMemo(
    () =>
      paintId && debouncedVolume > 0
        ? { paintId, volumeLiters: debouncedVolume, mode }
        : null,
    [paintId, debouncedVolume, mode],
  );

  const { data, isFetching } = usePaintPurchasePreview(open ? params : null);
  const plan = data?.success ? (data.data ?? null) : null;
  const planError = data && !data.success ? data.message : null;

  const { data: suppliersResponse } = useSuppliers({
    orderBy: { fantasyName: "asc" },
    take: 100,
  });
  const supplierOptions = useMemo(
    () =>
      (suppliersResponse?.data ?? []).map((s) => ({ value: s.id, label: s.fantasyName })),
    [suppliersResponse],
  );

  // Sugestões do servidor, até o operador dizer o contrário.
  useEffect(() => {
    if (!plan) return;
    if (!descriptionTouched) setDescription(plan.suggestedDescription);
    if (!supplierTouched && plan.suggestedSupplierId) setSupplierId(plan.suggestedSupplierId);
  }, [plan, descriptionTouched, supplierTouched]);

  const { mutateAsync, isPending } = useCreatePaintPurchaseOrder();

  const included = plan?.items.filter((i) => i.included) ?? [];
  const nothingToOrder = !!plan && included.length === 0;

  const handleSubmit = async () => {
    if (!paintId || !plan) return;
    try {
      const response = await mutateAsync({
        paintId,
        volumeLiters: debouncedVolume,
        mode,
        description: description.trim() || plan.suggestedDescription,
        supplierId: supplierId ?? null,
        forecast: forecast ? forecast.toISOString() : null,
        notes: notes.trim() ? notes.trim() : null,
      });
      if (!response.success || !response.data) {
        toast.error(response.message || "Não foi possível criar o pedido.");
        return;
      }
      const orderId = response.data.id;
      toast.success("Pedido criado", {
        description: `${included.length} ${included.length === 1 ? "componente" : "componentes"} de ${plan.paint.name}.`,
        action: {
          label: "Ver pedido",
          onClick: () => navigate(routes.inventory.orders.details(orderId)),
        },
      });
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || "Erro ao criar o pedido.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Sem foco automático: o Radix focaria o campo de volume, e um campo
          numérico focado nunca chega a formatar o valor que veio de fora — o
          diálogo abria mostrando "0" com a conta feita sobre 10,8 L. */}
      <DialogContent
        className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="space-y-1 border-b border-border/60 px-6 py-4">
          <DialogTitle className="flex items-center gap-3 text-base">
            <span
              className="h-6 w-6 flex-shrink-0 rounded-md shadow-sm ring-1 ring-border"
              style={{ backgroundColor: hex || "#888888" }}
            />
            <span className="truncate">Fazer pedido · {plan?.paint.name ?? paintName}</span>
          </DialogTitle>
          <DialogDescription>
            Os componentes saem da fórmula. Você diz o volume e as condições; a quantidade de
            cada item é calculada.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-4">
          {/* ---- o que pedir ---- */}
          <section className="grid gap-4 sm:grid-cols-[minmax(0,10rem)_1fr]">
            <div className="space-y-1.5">
              <Label htmlFor="purchase-volume" className="text-xs text-muted-foreground">
                Volume a produzir
              </Label>
              <div className="relative">
                <Input
                  id="purchase-volume"
                  type="decimal"
                  decimals={2}
                  min={0}
                  value={volume}
                  onChange={(v) => setVolume(typeof v === "number" ? v : Number(v) || 0)}
                  className="pr-8 text-right font-medium"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  L
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">O que entra no pedido</Label>
              <div className="flex gap-2">
                {MODES.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setMode(m.value)}
                    title={m.hint}
                    className={cn(
                      "flex-1 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                      mode === m.value
                        ? "border-primary bg-primary/10 font-medium text-foreground"
                        : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/60",
                    )}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* ---- prévia ---- */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">
                Componentes{" "}
                <span className="text-muted-foreground">
                  ({included.length}
                  {plan && plan.items.length !== included.length
                    ? ` de ${plan.items.length}`
                    : ""}
                  )
                </span>
              </h3>
              {isFetching ? (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <IconLoader2 className="h-3.5 w-3.5 animate-spin" />
                  calculando…
                </span>
              ) : null}
            </div>

            {planError ? (
              <p className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
                {planError}
              </p>
            ) : !plan ? (
              <Skeleton className="h-28 w-full rounded-lg" />
            ) : (
              <div className="overflow-x-auto rounded-lg bg-muted/30">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/40 text-[11px] uppercase text-muted-foreground">
                      <th className="px-3 py-2 text-left font-medium">Componente</th>
                      <th className="whitespace-nowrap px-3 py-2 text-right font-medium">
                        Necessário (g)
                      </th>
                      <th className="whitespace-nowrap px-3 py-2 text-right font-medium">
                        Necessário (un)
                      </th>
                      <th className="px-3 py-2 text-right font-medium">Estoque</th>
                      <th className="px-3 py-2 text-right font-medium">Pedir</th>
                      {canViewPrices ? (
                        <>
                          <th className="px-3 py-2 text-right font-medium">Un.</th>
                          <th className="px-3 py-2 text-right font-medium">Total</th>
                        </>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {plan.items.map((item) => (
                      <tr key={item.itemId} className={cn(!item.included && "opacity-55")}>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "inline-block h-2 w-2 flex-shrink-0 rounded-full",
                                !item.measured
                                  ? "bg-amber-500"
                                  : item.included
                                    ? "bg-green-500"
                                    : "bg-muted-foreground/40",
                              )}
                            />
                            <span className="truncate font-medium">{item.itemName}</span>
                            {item.uniCode ? (
                              <span className="flex-shrink-0 text-xs text-muted-foreground">
                                {item.uniCode}
                              </span>
                            ) : null}
                          </div>
                          <span className="ml-4 text-xs text-muted-foreground">
                            {item.ratio.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%
                            {item.packageLabel ? ` · ${item.packageLabel}` : ""}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-muted-foreground">
                          {formatGrams(item.requiredGrams)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-muted-foreground">
                          {item.requiredUnits != null ? formatUnits(item.requiredUnits) : "—"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-muted-foreground">
                          {formatUnits(item.availableUnits)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                          {item.included ? (
                            <span className="font-semibold text-foreground">
                              {item.quantity.toLocaleString("pt-BR", {
                                maximumFractionDigits: 2,
                              })}{" "}
                              un
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {excludedReason(item, plan.mode)}
                            </span>
                          )}
                        </td>
                        {canViewPrices ? (
                          <>
                            <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-muted-foreground">
                              {item.unitPrice > 0 ? formatCurrency(item.unitPrice) : "—"}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 text-right font-medium tabular-nums">
                              {item.included && item.totalPrice > 0
                                ? formatCurrency(item.totalPrice)
                                : "—"}
                            </td>
                          </>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {plan?.warnings.length ? (
              <ul className="space-y-1 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                {plan.warnings.map((w) => (
                  <li key={w} className="flex gap-2">
                    <IconAlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            ) : null}

            {plan && plan.supplierCount > 1 ? (
              <p className="text-xs text-muted-foreground">
                Os componentes vêm de {plan.supplierCount} fornecedores diferentes. O pedido sai
                com o fornecedor escolhido abaixo — separe em dois se precisar.
              </p>
            ) : null}
          </section>

          {/* ---- condições do pedido ---- */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Dados do pedido</h3>
            <div className="space-y-1.5">
              <Label htmlFor="purchase-description" className="text-xs text-muted-foreground">
                Descrição
              </Label>
              <Input
                id="purchase-description"
                value={description}
                onChange={(v) => {
                  setDescription(typeof v === "string" ? v : String(v ?? ""));
                  setDescriptionTouched(true);
                }}
                placeholder={plan?.suggestedDescription ?? "Descrição do pedido"}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Fornecedor</Label>
                <Combobox
                  value={supplierId ?? ""}
                  onValueChange={(value) => {
                    const v = Array.isArray(value) ? value[0] : value;
                    setSupplierId(v || undefined);
                    setSupplierTouched(true);
                  }}
                  options={supplierOptions}
                  placeholder="Opcional"
                  emptyText="Nenhum fornecedor encontrado"
                  clearable
                  className="w-full"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Previsão de entrega</Label>
                <DateTimeInput
                  mode="date"
                  value={forecast}
                  onChange={(d) => setForecast((d as Date | null) ?? null)}
                  placeholder="Opcional"
                  showClearButton
                  hideLabel
                  className="w-full"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="purchase-notes" className="text-xs text-muted-foreground">
                Observações
              </Label>
              <Textarea
                id="purchase-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Opcional"
                rows={2}
              />
            </div>
          </section>
        </div>

        <DialogFooter className="flex-row items-center justify-between gap-3 border-t border-border/60 px-6 py-3">
          <div className="min-w-0 text-sm">
            {plan ? (
              <span className="text-muted-foreground">
                {formatLiters(plan.volumeLiters)} ·{" "}
                <span className="font-medium text-foreground">
                  {included.length} {included.length === 1 ? "item" : "itens"}
                </span>
                {canViewPrices && plan.totals.totalPrice > 0 ? (
                  <>
                    {" · "}
                    <span className="font-semibold text-foreground">
                      {formatCurrency(plan.totals.totalPrice)}
                    </span>
                  </>
                ) : null}
              </span>
            ) : null}
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isPending || isFetching || !plan || nothingToOrder}
            >
              {isPending ? (
                <IconLoader2 className="h-4 w-4 animate-spin" />
              ) : (
                <IconShoppingCartPlus className="h-4 w-4" />
              )}
              {nothingToOrder ? "Nada a pedir" : "Criar pedido"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
