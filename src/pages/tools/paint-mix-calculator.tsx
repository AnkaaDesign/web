import { useEffect, useMemo } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import {
  IconFlask,
  IconPlus,
  IconTrash,
  IconRefresh,
  IconAlertTriangle,
} from "@tabler/icons-react";

import { PageHeader } from "@/components/ui/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { routes } from "@/constants";
import { formatCurrency } from "@/utils";
import { cn } from "@/lib/utils";

import { usePaintTypes, useItems } from "@/hooks";
import type { PaintType, Item } from "@/types";

import {
  findPresetForPaintType,
  type MixSlot,
} from "@/constants/paint-mix-presets";
import {
  computeSlotVolumes,
  computeTotalCost,
  computeCostPerLiter,
  sumSlotVolumes,
  type SlotInput,
} from "@/utils/paint-mix-math";

// ---------------------------------------------------------------------------
// Form types
// ---------------------------------------------------------------------------

interface MixFormSlot {
  /** Stable id used as React key (preset slot id, or generated for custom). */
  slotKey: string;
  /** pt-BR label shown in the UI (editable for custom rows). */
  label: string;
  /** Selected component item id (from PaintType.componentItems), or "". */
  itemId: string;
  /** Ratio for this slot. */
  ratio: number;
  /** Keywords used to bubble matching items to the top. */
  itemNameKeywords: string[];
}

interface MixFormValues {
  paintTypeId: string;
  totalLiters: number;
  slots: MixFormSlot[];
}

const DEFAULT_TOTAL_LITERS = 1;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const itemUnitPrice = (item: Item | undefined): number | null => {
  if (!item) return null;
  const fromPrices = item.prices?.[0]?.value;
  if (typeof fromPrices === "number" && Number.isFinite(fromPrices)) {
    return fromPrices;
  }
  if (typeof item.price === "number" && Number.isFinite(item.price)) {
    return item.price;
  }
  return null;
};

const sortItemsForSlot = (items: Item[], keywords: string[]): Item[] => {
  if (keywords.length === 0) {
    return [...items].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }
  const lowerKeywords = keywords.map((k) => k.toLowerCase());
  const matches: Item[] = [];
  const others: Item[] = [];
  for (const it of items) {
    const lower = it.name.toLowerCase();
    if (lowerKeywords.some((k) => lower.includes(k))) {
      matches.push(it);
    } else {
      others.push(it);
    }
  }
  matches.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  others.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  return [...matches, ...others];
};

const buildSlotsFromPreset = (preset: { slots: MixSlot[] }): MixFormSlot[] =>
  preset.slots.map((s) => ({
    slotKey: s.id,
    label: s.label,
    itemId: "",
    ratio: s.defaultRatio,
    itemNameKeywords: s.itemNameKeywords,
  }));

const generateCustomSlotKey = () =>
  `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function PaintMixCalculatorPage() {
  const form = useForm<MixFormValues>({
    defaultValues: {
      paintTypeId: "",
      totalLiters: DEFAULT_TOTAL_LITERS,
      slots: buildSlotsFromPreset(findPresetForPaintType(null)),
    },
    mode: "onChange",
  });

  const { control, watch, setValue, reset, getValues } = form;

  const fieldArray = useFieldArray({
    control,
    name: "slots",
    keyName: "_rhfId",
  });

  // ---- Watched values ----
  const paintTypeId = watch("paintTypeId");
  const totalLiters = watch("totalLiters");
  const slots = watch("slots");

  // ---- Paint types ----
  const {
    data: paintTypesResponse,
    isLoading: isLoadingPaintTypes,
    error: paintTypesError,
  } = usePaintTypes({
    orderBy: { name: "asc" },
    include: { componentItems: true },
    limit: 200,
  });

  const paintTypes: PaintType[] = paintTypesResponse?.data ?? [];

  const selectedPaintType = useMemo<PaintType | undefined>(
    () => paintTypes.find((p) => p.id === paintTypeId),
    [paintTypes, paintTypeId],
  );

  // ---- Component items for the selected paint type (with prices) ----
  // The PaintType list query may return componentItems with only id+name.
  // Re-fetch the full Item rows including `prices` so we can compute cost.
  const componentItemIds = useMemo(
    () => selectedPaintType?.componentItems?.map((i) => i.id) ?? [],
    [selectedPaintType],
  );

  const {
    data: itemsResponse,
    isLoading: isLoadingItems,
    error: itemsError,
  } = useItems(
    {
      where: { id: { in: componentItemIds } },
      include: { prices: true, category: true, measures: true },
      limit: 500,
      orderBy: { name: "asc" },
    },
    { enabled: componentItemIds.length > 0 },
  );

  const componentItems: Item[] = itemsResponse?.data ?? [];

  // ---- React to paint type changes: rebuild slot defaults ----
  useEffect(() => {
    if (!selectedPaintType) return;
    const preset = findPresetForPaintType(selectedPaintType.name);
    // Only rebuild slots if the user hasn't customised — i.e. the current
    // slots are still the previous preset shape with no items selected.
    const current = getValues("slots");
    const noneSelected = current.every((s) => !s.itemId);
    if (noneSelected) {
      reset(
        {
          ...getValues(),
          paintTypeId: selectedPaintType.id,
          slots: buildSlotsFromPreset(preset),
        },
        { keepDirty: false },
      );
    }
    // Intentionally not depending on getValues/reset (stable from RHF).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPaintType?.id]);

  // ---- Math: compute per-slot volumes / costs ----
  const slotMath = useMemo(() => {
    const inputs: SlotInput[] = (slots ?? []).map((s) => {
      const item = componentItems.find((it) => it.id === s.itemId);
      return {
        ratio: Number(s.ratio) || 0,
        pricePerLiter: itemUnitPrice(item),
      };
    });
    const results = computeSlotVolumes(inputs, Number(totalLiters) || 0);
    return { inputs, results };
  }, [slots, componentItems, totalLiters]);

  const totalCost = computeTotalCost(slotMath.results);
  const costPerLiter = computeCostPerLiter(totalCost, Number(totalLiters) || 0);
  const totalVolumeCheck = sumSlotVolumes(slotMath.results);

  // ---- Handlers ----
  const handleClear = () => {
    reset({
      paintTypeId: "",
      totalLiters: DEFAULT_TOTAL_LITERS,
      slots: buildSlotsFromPreset(findPresetForPaintType(null)),
    });
  };

  const handleAddCustomSlot = () => {
    fieldArray.append({
      slotKey: generateCustomSlotKey(),
      label: "Componente",
      itemId: "",
      ratio: 1,
      itemNameKeywords: [],
    });
  };

  const handleRemoveSlot = (index: number) => {
    if (fieldArray.fields.length <= 1) return;
    fieldArray.remove(index);
  };

  // ---- Paint type options ----
  const paintTypeOptions: ComboboxOption[] = paintTypes.map((p) => ({
    value: p.id,
    label: p.name,
  }));

  // ---- Item options per slot (sorted; keyword-matched first) ----
  const optionsForSlot = (keywords: string[]): ComboboxOption[] => {
    if (componentItems.length === 0) return [];
    const sorted = sortItemsForSlot(componentItems, keywords);
    return sorted.map((it) => {
      const price = itemUnitPrice(it);
      return {
        value: it.id,
        label: it.name,
        description:
          price != null ? `${formatCurrency(price)} / L` : "Sem preço cadastrado",
      };
    });
  };

  const showItemsLoading = isLoadingItems && componentItemIds.length > 0;
  const componentSectionDisabled = !selectedPaintType;

  return (
    <div className="h-full flex flex-col px-4 pt-4">
      <div className="flex-shrink-0">
        <PageHeader
          title="Calculadora de Mistura"
          subtitle="Cálculo de proporção e custo de mistura de tintas"
          icon={IconFlask}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Ferramentas", href: routes.tools.root },
            { label: "Calculadora de Mistura" },
          ]}
          actions={[
            {
              key: "clear",
              label: "Limpar",
              icon: IconRefresh,
              onClick: handleClear,
              variant: "outline",
              group: "secondary",
            },
          ]}
        />
      </div>

      <div className="flex-1 overflow-y-auto pb-6">
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Configuration column */}
          <div className="lg:col-span-3 space-y-4">
            {/* Step 1: Paint Type */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">1. Tipo de Tinta</CardTitle>
                <CardDescription>
                  Selecione o tipo de tinta para sugerir a proporção e os componentes
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Label htmlFor="paint-mix-type">Tipo de Tinta</Label>
                <Controller
                  control={control}
                  name="paintTypeId"
                  render={({ field }) => (
                    <Combobox
                      options={paintTypeOptions}
                      value={field.value}
                      onValueChange={(v) => field.onChange(typeof v === "string" ? v : "")}
                      placeholder={
                        isLoadingPaintTypes
                          ? "Carregando tipos de tinta..."
                          : "Selecione o tipo de tinta"
                      }
                      disabled={isLoadingPaintTypes}
                      loading={isLoadingPaintTypes}
                      searchable
                      clearable
                    />
                  )}
                />
                {paintTypesError && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <IconAlertTriangle className="h-3.5 w-3.5" />
                    Erro ao carregar tipos de tinta.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Step 2: Final volume */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">2. Volume Final</CardTitle>
                <CardDescription>
                  Quantidade total de tinta pronta que você precisa preparar
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Label htmlFor="paint-mix-total">Volume final (L)</Label>
                <Controller
                  control={control}
                  name="totalLiters"
                  render={({ field }) => (
                    <div className="relative">
                      <Input
                        id="paint-mix-total"
                        type="decimal"
                        decimals={3}
                        min={0}
                        value={field.value}
                        onChange={(v) =>
                          field.onChange(typeof v === "number" ? v : Number(v) || 0)
                        }
                        onBlur={field.onBlur}
                        name={field.name}
                        placeholder="1,000"
                        className="pr-10"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                        L
                      </span>
                    </div>
                  )}
                />
              </CardContent>
            </Card>

            {/* Step 3: Components */}
            <Card>
              <CardHeader className="pb-3 flex-row items-start justify-between gap-4 space-y-0">
                <div className="space-y-1">
                  <CardTitle className="text-lg">3. Componentes</CardTitle>
                  <CardDescription>
                    Defina a proporção de cada componente. Volumes e custos são
                    recalculados automaticamente.
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddCustomSlot}
                  disabled={componentSectionDisabled}
                >
                  <IconPlus className="h-4 w-4 mr-1" />
                  Adicionar
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {componentSectionDisabled && (
                  <p className="text-sm text-muted-foreground">
                    Selecione um tipo de tinta para configurar os componentes.
                  </p>
                )}

                {!componentSectionDisabled && showItemsLoading && (
                  <p className="text-sm text-muted-foreground">
                    Carregando componentes do tipo de tinta...
                  </p>
                )}

                {!componentSectionDisabled && itemsError && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <IconAlertTriangle className="h-4 w-4" />
                    Erro ao carregar componentes.
                  </p>
                )}

                {!componentSectionDisabled &&
                  !showItemsLoading &&
                  componentItems.length === 0 &&
                  componentItemIds.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      Este tipo de tinta não possui componentes cadastrados.
                    </p>
                  )}

                {fieldArray.fields.map((fieldItem, index) => {
                  const slot = slots?.[index];
                  if (!slot) return null;
                  const result = slotMath.results[index];
                  const itemOptions = optionsForSlot(slot.itemNameKeywords);
                  const selectedItem = componentItems.find((it) => it.id === slot.itemId);
                  const unitPrice = itemUnitPrice(selectedItem);

                  return (
                    <div
                      key={fieldItem._rhfId}
                      className={cn(
                        "rounded-md border border-border p-3 space-y-3",
                        "bg-muted/20",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <Controller
                          control={control}
                          name={`slots.${index}.label`}
                          render={({ field }) => (
                            <Input
                              type="text"
                              value={field.value}
                              onChange={(v) =>
                                field.onChange(typeof v === "string" ? v : String(v ?? ""))
                              }
                              onBlur={field.onBlur}
                              name={field.name}
                              className="h-8 max-w-[220px] font-semibold"
                              placeholder="Nome do componente"
                            />
                          )}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveSlot(index)}
                          disabled={fieldArray.fields.length <= 1}
                          aria-label="Remover componente"
                        >
                          <IconTrash className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                        {/* Item picker */}
                        <div className="md:col-span-7 space-y-1">
                          <Label className="text-xs text-muted-foreground">
                            Item de inventário
                          </Label>
                          <Controller
                            control={control}
                            name={`slots.${index}.itemId`}
                            render={({ field }) => (
                              <Combobox
                                options={itemOptions}
                                value={field.value}
                                onValueChange={(v) =>
                                  field.onChange(typeof v === "string" ? v : "")
                                }
                                placeholder={
                                  componentItems.length === 0
                                    ? "Sem componentes disponíveis"
                                    : "Selecione um item"
                                }
                                disabled={componentItems.length === 0 || showItemsLoading}
                                searchable
                                clearable
                              />
                            )}
                          />
                        </div>

                        {/* Ratio */}
                        <div className="md:col-span-2 space-y-1">
                          <Label className="text-xs text-muted-foreground">
                            Proporção
                          </Label>
                          <Controller
                            control={control}
                            name={`slots.${index}.ratio`}
                            render={({ field }) => (
                              <Input
                                type="decimal"
                                decimals={2}
                                min={0}
                                value={field.value}
                                onChange={(v) =>
                                  field.onChange(typeof v === "number" ? v : Number(v) || 0)
                                }
                                onBlur={field.onBlur}
                                name={field.name}
                                placeholder="0"
                              />
                            )}
                          />
                        </div>

                        {/* Volume */}
                        <div className="md:col-span-3 space-y-1">
                          <Label className="text-xs text-muted-foreground">
                            Volume
                          </Label>
                          <div className="flex h-9 items-center justify-end rounded-md border border-input bg-background/40 px-3 text-sm">
                            {result
                              ? `${result.volumeLiters.toLocaleString("pt-BR", {
                                  maximumFractionDigits: 3,
                                })} L`
                              : "0 L"}
                          </div>
                          <p className="text-[11px] text-muted-foreground text-right">
                            {result ? `${result.volumeMl.toLocaleString("pt-BR")} ml` : "0 ml"}
                          </p>
                        </div>
                      </div>

                      {/* Cost line */}
                      <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border/60 pt-2">
                        <span>
                          Preço unitário:{" "}
                          {unitPrice != null
                            ? `${formatCurrency(unitPrice)} / L`
                            : "—"}
                        </span>
                        <span className="font-medium text-foreground">
                          Subtotal:{" "}
                          {result?.cost != null
                            ? formatCurrency(result.cost)
                            : "—"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          {/* Result column */}
          <Card className="lg:col-span-2 lg:sticky lg:top-4 self-start w-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Resultado</CardTitle>
              <CardDescription>Resumo da mistura</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-md bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Volume total</p>
                <p className="text-2xl font-semibold">
                  {totalVolumeCheck.toLocaleString("pt-BR", {
                    maximumFractionDigits: 3,
                  })}{" "}
                  L
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Conferência: deve coincidir com o volume final solicitado.
                </p>
              </div>

              <div className="rounded-md bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Custo total</p>
                <p className="text-2xl font-semibold">
                  {totalCost != null ? formatCurrency(totalCost) : "—"}
                </p>
                {totalCost == null && (
                  <p className="text-[11px] text-muted-foreground">
                    Selecione todos os componentes (com preço) para calcular o custo.
                  </p>
                )}
              </div>

              <div className="rounded-md bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">
                  Custo por litro da mistura
                </p>
                <p className="text-xl font-semibold">
                  {costPerLiter != null
                    ? `${formatCurrency(costPerLiter)} / L`
                    : "—"}
                </p>
              </div>

              <p className="text-[11px] text-muted-foreground">
                Os preços assumem o valor cadastrado no item como preço por litro.
                Caso o item esteja em outra unidade, o custo precisa ser ajustado
                manualmente.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default PaintMixCalculatorPage;
