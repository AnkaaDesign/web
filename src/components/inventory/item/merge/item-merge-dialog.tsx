import { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { IconAlertTriangle, IconArrowRight, IconCheck, IconLoader2, IconChevronLeft, IconTrash, IconShieldCheck, IconRulerMeasure } from "@tabler/icons-react";
import type { Item } from "../../../../types";
import { formatCurrency } from "../../../../utils";
import { useCanViewPrices } from "../../../../hooks";
import { MeasureDisplayCompact } from "../common/measure-display";

interface ItemMergeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: Item[];
  onMerge: (targetItemId: string, resolutions: Record<string, any>) => Promise<void>;
}

type WizardStep = 1 | 2 | 3;

const STEPS: Array<{ n: WizardStep; label: string }> = [
  { n: 1, label: "Manter" },
  { n: 2, label: "Conflitos" },
  { n: 3, label: "Revisar" },
];

// User-owned scalar fields the backend can actually apply (mirrors
// ALLOWED_MERGE_FIELDS in the API merge() + itemMergeConflictsSchema). Each
// conflict is resolved by picking which item's value wins (default: the kept
// item). Derived/forced fields (quantity, totalPrice, monthlyConsumption,
// reorder thresholds) are NOT here — the server computes them.
interface ResolvableField {
  field: string; // payload key
  label: string;
  get: (item: Item) => any; // value sent to the API
  display: (item: Item) => string; // human-readable label
  priceField?: boolean; // hidden when the user can't view prices
}

const RESOLVABLE_FIELDS: ResolvableField[] = [
  { field: "name", label: "Nome", get: (i) => i.name, display: (i) => i.name },
  { field: "uniCode", label: "Código", get: (i) => i.uniCode, display: (i) => i.uniCode ?? "—" },
  { field: "categoryId", label: "Categoria", get: (i) => i.categoryId, display: (i) => (i as any).category?.name ?? "—" },
  { field: "supplierId", label: "Fornecedor", get: (i) => i.supplierId, display: (i) => (i as any).supplier?.fantasyName ?? (i as any).supplier?.corporateName ?? "—" },
  { field: "boxQuantity", label: "Qtd. por caixa", get: (i) => i.boxQuantity, display: (i) => i.boxQuantity?.toString() ?? "—" },
  { field: "estimatedLeadTime", label: "Lead time", get: (i) => i.estimatedLeadTime, display: (i) => (i.estimatedLeadTime != null ? `${i.estimatedLeadTime} dias` : "—") },
  { field: "shouldAssignToUser", label: "Atribuir ao usuário", get: (i) => i.shouldAssignToUser, display: (i) => (i.shouldAssignToUser ? "Sim" : "Não") },
  { field: "isActive", label: "Ativo", get: (i) => i.isActive, display: (i) => (i.isActive ? "Sim" : "Não") },
  { field: "ppeType", label: "Tipo de EPI", get: (i) => i.ppeType, display: (i) => (i.ppeType ?? "—") },
  { field: "ppeCA", label: "CA do EPI", get: (i) => i.ppeCA, display: (i) => (i.ppeCA ?? "—") },
  { field: "ppeDeliveryMode", label: "Modo de entrega EPI", get: (i) => i.ppeDeliveryMode, display: (i) => (i.ppeDeliveryMode ?? "—") },
  { field: "ppeStandardQuantity", label: "Qtd. padrão EPI", get: (i) => i.ppeStandardQuantity, display: (i) => i.ppeStandardQuantity?.toString() ?? "—" },
  { field: "icms", label: "ICMS (%)", get: (i) => i.icms, display: (i) => (i.icms != null ? `${i.icms}%` : "—"), priceField: true },
  { field: "ipi", label: "IPI (%)", get: (i) => i.ipi, display: (i) => (i.ipi != null ? `${i.ipi}%` : "—"), priceField: true },
];

// Stable signature of an item's measures so we can detect divergence.
function measureSignature(item: Item): string {
  const ms = ((item as any).measures ?? []) as Array<{ measureType: string; value: number | null; unit: string | null }>;
  return ms
    .map((m) => `${m.measureType}:${m.value ?? ""}:${m.unit ?? ""}`)
    .sort()
    .join("|");
}

function latestPriceOf(item: Item): { value: number; createdAt: string } | null {
  const p = (item as any).prices?.[0];
  return p ? { value: p.value, createdAt: p.createdAt } : null;
}

export function ItemMergeDialog({ open, onOpenChange, items, onMerge }: ItemMergeDialogProps) {
  const canViewPrices = useCanViewPrices();
  const [step, setStep] = useState<WizardStep>(1);
  const [targetItemId, setTargetItemId] = useState<string>("");
  // field -> chosen itemId whose value wins (default: target)
  const [fieldResolutions, setFieldResolutions] = useState<Map<string, string>>(new Map());
  const [selectedBrandIds, setSelectedBrandIds] = useState<string[]>([]);
  const [brandsCustomized, setBrandsCustomized] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const targetItem = useMemo(() => items.find((i) => i.id === targetItemId) ?? null, [items, targetItemId]);
  const sourceItems = useMemo(() => items.filter((i) => i.id !== targetItemId), [items, targetItemId]);

  // Scalar conflicts: resolvable fields whose value differs across items.
  const conflicts = useMemo(() => {
    if (items.length < 2) return [];
    return RESOLVABLE_FIELDS.filter((f) => canViewPrices || !f.priceField).filter((f) => {
      const distinct = new Set(items.map((i) => JSON.stringify(f.get(i) ?? null)));
      return distinct.size > 1;
    });
  }, [items, canViewPrices]);

  // Measure divergence (data-loss surface). Source measures that differ from the
  // kept item's are discarded server-side; flag them so the user sees the loss.
  const measureConflict = useMemo(() => {
    if (!targetItem) return null;
    const targetSig = measureSignature(targetItem);
    const diverging = sourceItems.filter((s) => measureSignature(s) !== targetSig && ((s as any).measures?.length ?? 0) > 0);
    return diverging.length > 0 ? diverging : null;
  }, [targetItem, sourceItems]);

  // All brands across the items (union is the merge default).
  const allBrands = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    for (const i of items) for (const b of ((i as any).brands ?? []) as Array<{ id: string; name: string }>) map.set(b.id, b);
    return [...map.values()];
  }, [items]);

  // Resulting current price = newest price across all merged items.
  const mergedLatestPrice = useMemo(() => {
    const prices = items.map(latestPriceOf).filter(Boolean) as Array<{ value: number; createdAt: string }>;
    if (prices.length === 0) return null;
    return prices.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0].value;
  }, [items]);

  const finalQuantity = useMemo(() => items.reduce((sum, i) => sum + (i.quantity || 0), 0), [items]);

  // Reset the wizard whenever it (re)opens. Target defaults to the first ACTIVE
  // item (never silently items[0]) and is always shown highlighted.
  useEffect(() => {
    if (open) {
      const def = items.find((i) => i.isActive) ?? items[0];
      setTargetItemId(def?.id ?? "");
      setStep(1);
      setFieldResolutions(new Map());
      setSelectedBrandIds(allBrands.map((b) => b.id));
      setBrandsCustomized(false);
      setConfirmDelete(false);
      setIsLoading(false);
    }
    // allBrands is derived from items; intentionally not a dep to avoid resets on memo identity
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, items]);

  const resolvedValueDisplay = (f: ResolvableField) => {
    const chosenId = fieldResolutions.get(f.field) ?? targetItemId;
    const chosen = items.find((i) => i.id === chosenId) ?? targetItem;
    return chosen ? f.display(chosen) : "—";
  };

  const handleMerge = async () => {
    if (!targetItemId || !confirmDelete || isLoading) return;
    setIsLoading(true);
    try {
      const resolvedData: Record<string, any> = {};
      for (const f of conflicts) {
        const chosenId = fieldResolutions.get(f.field) ?? targetItemId;
        const chosen = items.find((i) => i.id === chosenId);
        if (chosen) resolvedData[f.field] = f.get(chosen);
      }
      // Only send brands when the user customized the set; otherwise let the
      // server auto-union all source brands into the target.
      if (brandsCustomized) resolvedData.brands = selectedBrandIds;

      await onMerge(targetItemId, resolvedData);
      onOpenChange(false);
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.error("Merge failed:", error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const goNext = () => setStep((s) => (s < 3 ? ((s + 1) as WizardStep) : s));
  const goBack = () => setStep((s) => (s > 1 ? ((s - 1) as WizardStep) : s));

  const brandsDiffer = allBrands.length > 0 && items.some((i) => ((i as any).brands?.length ?? 0) !== allBrands.length);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Mesclar Itens</DialogTitle>
          <DialogDescription>
            Consolide {items.length} itens em um único. O item mantido recebe todas as quantidades, preços, movimentações, pedidos e histórico dos demais, que
            são excluídos permanentemente.
          </DialogDescription>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center justify-center gap-2 px-2">
          {STEPS.map((s, idx) => (
            <div key={s.n} className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full border text-sm font-semibold transition-colors",
                    step === s.n && "border-primary bg-primary text-primary-foreground",
                    step > s.n && "border-green-600 bg-green-600 text-white",
                    step < s.n && "border-border bg-muted text-muted-foreground",
                  )}
                >
                  {step > s.n ? <IconCheck className="h-4 w-4" /> : s.n}
                </div>
                <span className={cn("text-sm font-medium", step === s.n ? "text-foreground" : "text-muted-foreground")}>{s.label}</span>
              </div>
              {idx < STEPS.length - 1 && <div className={cn("h-px w-8", step > s.n ? "bg-green-600" : "bg-border")} />}
            </div>
          ))}
        </div>

        <ScrollArea className="max-h-[58vh] pr-4">
          <div className="space-y-6">
            {/* STEP 1 — Choose the item to keep */}
            {step === 1 && (
              <div className="space-y-3">
                <Label className="text-base font-semibold">Qual item será mantido?</Label>
                <p className="text-sm text-muted-foreground">
                  O item em verde <strong>permanecerá</strong>. Todos os outros serão consolidados nele e depois excluídos permanentemente.
                </p>
                <RadioGroup value={targetItemId} onValueChange={setTargetItemId} className="gap-2">
                  {items.map((item) => {
                    const isTarget = item.id === targetItemId;
                    const price = latestPriceOf(item);
                    return (
                      <label
                        key={item.id}
                        htmlFor={`target-${item.id}`}
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors",
                          isTarget ? "border-green-500 bg-green-50 ring-1 ring-green-400/50 dark:bg-green-950/20" : "border-border hover:bg-muted/50",
                        )}
                      >
                        <RadioGroupItem value={item.id} id={`target-${item.id}`} className="mt-1" />
                        <div className="flex flex-1 flex-col gap-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className={cn("font-medium", !isTarget && "text-muted-foreground")}>{item.name}</span>
                            {isTarget ? (
                              <Badge variant="success" className="shrink-0">
                                <IconCheck className="mr-1 h-3 w-3" />
                                Mantido
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="shrink-0 opacity-80">
                                <IconTrash className="mr-1 h-3 w-3" />
                                Será removido
                              </Badge>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 text-xs">
                            {item.uniCode && <Badge variant="secondary">{item.uniCode}</Badge>}
                            <Badge variant="outline">Qtd: {item.quantity}</Badge>
                            {canViewPrices && price && <Badge variant="outline">{formatCurrency(price.value)}</Badge>}
                            {(item as any).category?.name && <Badge variant="outline">{(item as any).category.name}</Badge>}
                            {((item as any).measures?.length ?? 0) > 0 && <MeasureDisplayCompact item={item} className="text-muted-foreground" />}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </RadioGroup>
              </div>
            )}

            {/* STEP 2 — Resolve real (server-applied) conflicts */}
            {step === 2 && (
              <div className="space-y-4">
                {conflicts.length === 0 && !brandsDiffer && !measureConflict ? (
                  <div className="flex items-center gap-3 rounded-lg border border-green-300 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950/20">
                    <IconCheck className="h-5 w-5 text-green-600 dark:text-green-400" />
                    <p className="text-sm">Nenhum conflito de campos. Os dados serão transferidos diretamente para o item mantido.</p>
                  </div>
                ) : (
                  <>
                    {conflicts.length > 0 && (
                      <>
                        <div className="flex items-center gap-2">
                          <IconAlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                          <h3 className="text-base font-semibold">Campos divergentes</h3>
                        </div>
                        <p className="text-sm text-muted-foreground">Escolha qual valor manter em cada campo. O padrão é o valor do item mantido.</p>
                        {conflicts.map((f) => (
                          <div key={f.field} className="space-y-2 rounded-lg border border-border bg-muted/20 p-4">
                            <Label className="text-sm font-semibold">{f.label}</Label>
                            <RadioGroup
                              value={fieldResolutions.get(f.field) ?? targetItemId}
                              onValueChange={(itemId) => setFieldResolutions((prev) => new Map(prev).set(f.field, itemId))}
                            >
                              {items.map((item) => (
                                <div key={item.id} className="flex items-center gap-2">
                                  <RadioGroupItem value={item.id} id={`${f.field}-${item.id}`} />
                                  <Label htmlFor={`${f.field}-${item.id}`} className="flex cursor-pointer items-center gap-2 text-sm font-normal">
                                    <span className="text-muted-foreground">{item.id === targetItemId ? "Mantido" : item.name}:</span>
                                    <Badge variant="outline">{f.display(item)}</Badge>
                                  </Label>
                                </div>
                              ))}
                            </RadioGroup>
                          </div>
                        ))}
                      </>
                    )}

                    {/* Brands (union, customizable) */}
                    {allBrands.length > 0 && (
                      <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-4">
                        <Label className="text-sm font-semibold">Marcas</Label>
                        <p className="text-xs text-muted-foreground">Por padrão, as marcas de todos os itens são unidas. Desmarque para remover.</p>
                        {allBrands.map((b) => (
                          <div key={b.id} className="flex items-center gap-2">
                            <Checkbox
                              id={`brand-${b.id}`}
                              checked={selectedBrandIds.includes(b.id)}
                              onCheckedChange={(checked) => {
                                setBrandsCustomized(true);
                                setSelectedBrandIds((prev) => (checked ? [...new Set([...prev, b.id])] : prev.filter((id) => id !== b.id)));
                              }}
                            />
                            <Label htmlFor={`brand-${b.id}`} className="cursor-pointer text-sm font-normal">
                              {b.name}
                            </Label>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Measure divergence — informational warning; resolved in review */}
                    {measureConflict && (
                      <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/20">
                        <IconRulerMeasure className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
                        <p className="text-sm">
                          As medidas dos itens diferem. As do <strong>item mantido</strong> serão preservadas e as divergentes descartadas (detalhes na revisão).
                          Isso costuma indicar que são produtos diferentes — confirme antes de mesclar.
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* STEP 3 — Review disposal + confirm */}
            {step === 3 && targetItem && (
              <div className="space-y-5">
                {/* Disposal: keep vs remove */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto_1fr] md:items-stretch">
                  {/* Kept */}
                  <div className="space-y-2 rounded-lg border border-green-300 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950/20">
                    <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                      <IconShieldCheck className="h-5 w-5" />
                      <span className="text-sm font-semibold uppercase tracking-wide">Será mantido</span>
                    </div>
                    <p className="font-semibold">{resolvedValueDisplay(RESOLVABLE_FIELDS[0])}</p>
                    <div className="flex flex-wrap gap-1.5 text-sm">
                      <Badge variant="outline">Qtd. final: {finalQuantity}</Badge>
                      {canViewPrices && mergedLatestPrice != null && <Badge variant="outline">{formatCurrency(mergedLatestPrice)}</Badge>}
                    </div>
                    {((targetItem as any).measures?.length ?? 0) > 0 && (
                      <div className="text-xs text-muted-foreground">
                        Medidas mantidas: <MeasureDisplayCompact item={targetItem} />
                      </div>
                    )}
                  </div>

                  <div className="hidden items-center justify-center md:flex">
                    <IconArrowRight className="h-6 w-6 text-muted-foreground" />
                  </div>

                  {/* Removed */}
                  <div className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
                    <div className="flex items-center gap-2 text-destructive">
                      <IconTrash className="h-5 w-5" />
                      <span className="text-sm font-semibold uppercase tracking-wide">Serão removidos ({sourceItems.length})</span>
                    </div>
                    <ul className="space-y-1.5">
                      {sourceItems.map((item) => (
                        <li key={item.id} className="flex items-center justify-between gap-2 text-sm">
                          <span className="font-medium line-through decoration-destructive/50">{item.name}</span>
                          <div className="flex shrink-0 gap-1.5">
                            {item.uniCode && <Badge variant="secondary">{item.uniCode}</Badge>}
                            <Badge variant="outline">Qtd: {item.quantity}</Badge>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Quantity breakdown — read-only, always summed */}
                <div className="space-y-1.5 rounded-lg border border-border bg-muted/20 p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold">Quantidade (sempre somada)</span>
                  </div>
                  <div className="space-y-1 text-sm">
                    {items.map((item) => (
                      <div key={item.id} className="flex justify-between text-muted-foreground">
                        <span>{item.id === targetItemId ? `${item.name} (mantido)` : item.name}</span>
                        <span>{item.id === targetItemId ? item.quantity : `+ ${item.quantity}`}</span>
                      </div>
                    ))}
                    <div className="flex justify-between border-t border-border pt-1 font-semibold">
                      <span>Quantidade final</span>
                      <span>{finalQuantity}</span>
                    </div>
                  </div>
                </div>

                {/* Measure-loss warning */}
                {measureConflict && (
                  <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/20">
                    <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
                      <IconRulerMeasure className="h-5 w-5" />
                      <span className="text-sm font-semibold">Medidas divergentes serão descartadas</span>
                    </div>
                    <ul className="space-y-1 text-sm">
                      {measureConflict.map((item) => (
                        <li key={item.id} className="flex items-center gap-2 text-muted-foreground">
                          <span className="line-through decoration-amber-500/60">{item.name}:</span>
                          <MeasureDisplayCompact item={item} />
                        </li>
                      ))}
                    </ul>
                    <p className="text-xs text-amber-700 dark:text-amber-300">Verifique se realmente são o mesmo produto antes de continuar.</p>
                  </div>
                )}

                {/* Irreversibility confirmation */}
                <div className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
                  <div className="flex items-center gap-2 text-destructive">
                    <IconAlertTriangle className="h-5 w-5" />
                    <p className="text-sm font-semibold">Esta ação é irreversível.</p>
                  </div>
                  <label htmlFor="confirm-delete" className="flex cursor-pointer items-start gap-3">
                    <Checkbox id="confirm-delete" checked={confirmDelete} onCheckedChange={(c) => setConfirmDelete(c === true)} className="mt-0.5" />
                    <span className="text-sm">
                      Confirmo a exclusão permanente {sourceItems.length === 1 ? "do item" : `dos ${sourceItems.length} itens`}:
                      <span className="mt-1 block font-medium">{sourceItems.map((i) => i.name).join(" · ")}</span>
                    </span>
                  </label>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <Button variant="outline" onClick={step === 1 ? () => onOpenChange(false) : goBack} disabled={isLoading}>
            {step === 1 ? (
              "Cancelar"
            ) : (
              <>
                <IconChevronLeft className="h-4 w-4" />
                Voltar
              </>
            )}
          </Button>

          {step < 3 ? (
            <Button onClick={goNext} disabled={step === 1 && !targetItemId}>
              Próximo
              <IconArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button variant="destructive" onClick={handleMerge} disabled={isLoading || !confirmDelete || !targetItemId}>
              {isLoading ? (
                <>
                  <IconLoader2 className="h-4 w-4 animate-spin" />
                  Mesclando...
                </>
              ) : (
                <>
                  <IconCheck className="h-4 w-4" />
                  Mesclar {sourceItems.length} {sourceItems.length === 1 ? "item" : "itens"}
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
