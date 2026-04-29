import { useEffect, useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import {
  IconFlask,
  IconRefresh,
  IconAlertTriangle,
  IconBucket,
  IconDroplet,
  IconBrandSpeedtest,
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
import { Combobox } from "@/components/ui/combobox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { routes } from "@/constants";
import { formatCurrency } from "@/utils";

import { usePaintTypes } from "@/hooks";
import { useItemCategories } from "@/hooks";
import { usePaint, usePaintFormulasByPaintId } from "@/hooks";

import { MEASURE_TYPE, MEASURE_UNIT, PAINT_TYPE_ENUM } from "@/constants";
import { UNIT_CONVERSION_FACTORS } from "@/types";
import type { Paint, Item, PaintType, PaintFormula } from "@/types";

import {
  computeSlotVolumes,
  computeTotalCost,
  computeCostPerLiter,
  type SlotInput,
} from "@/utils/paint-mix-math";

import { PaintMixPaintSelector } from "@/components/tools/paint-mix-calculator/paint-mix-paint-selector";
import { CategoryItemSelector } from "@/components/tools/paint-mix-calculator/category-item-selector";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_TOTAL_LITERS = 1;
const DEFAULT_PAINT_RATIO = 3;
const DEFAULT_CATALYST_RATIO = 1;
const DEFAULT_THINNER_RATIO = 1;

// Category names. We accept both singular and plural for "Diluente"/"Diluentes"
// because the user mentioned "Diluentes" but existing data may use either form.
const CATEGORY_NAMES = {
  CATALYST: ["Endurecedor", "Endurecedores"],
  THINNER: ["Diluente", "Diluentes"],
  VARNISH: ["Verniz", "Vernizes"],
} as const;

// ---------------------------------------------------------------------------
// Form types
// ---------------------------------------------------------------------------

type MixMode = "paint" | "varnish";

interface MixFormValues {
  mode: MixMode;
  paintTypeId: string | null;
  paintId: string | null;
  varnishItemId: string | null;
  catalystItemId: string | null;
  thinnerItemId: string | null;
  paintRatio: number;
  catalystRatio: number;
  thinnerRatio: number;
  totalLiters: number;
}

const DEFAULT_VALUES: MixFormValues = {
  mode: "paint",
  paintTypeId: null,
  paintId: null,
  varnishItemId: null,
  catalystItemId: null,
  thinnerItemId: null,
  paintRatio: DEFAULT_PAINT_RATIO,
  catalystRatio: DEFAULT_CATALYST_RATIO,
  thinnerRatio: DEFAULT_THINNER_RATIO,
  totalLiters: DEFAULT_TOTAL_LITERS,
};

// ---------------------------------------------------------------------------
// Helpers (domain-aware)
// ---------------------------------------------------------------------------

/**
 * Latest unit price for an item (price for ONE inventory unit/package). Tries
 * the virtual `item.price` (computed current unit price), then `monetaryValues[0].value`,
 * then `prices[0].value`. Never falls back to `totalPrice` — that's the whole
 * inventory value (qty × unit price), not a per-unit price.
 */
const getItemUnitPrice = (item: Item | null): number | null => {
  if (!item) return null;
  if (typeof item.price === "number" && Number.isFinite(item.price)) {
    return item.price;
  }
  const fromMonetary = item.monetaryValues?.[0]?.value;
  if (typeof fromMonetary === "number" && Number.isFinite(fromMonetary)) {
    return fromMonetary;
  }
  const fromPrices = item.prices?.[0]?.value;
  if (typeof fromPrices === "number" && Number.isFinite(fromPrices)) {
    return fromPrices;
  }
  return null;
};

/**
 * Volume of one inventory unit in liters, derived from the Item's VOLUME
 * measure. Returns null when no volume measure is present, when the unit isn't
 * a volume unit, or when conversion factors aren't available.
 */
const getItemVolumeInLiters = (item: Item | null): number | null => {
  if (!item || !item.measures || item.measures.length === 0) return null;
  const volumeMeasure = item.measures.find(
    (m) => m.measureType === MEASURE_TYPE.VOLUME && m.unit && m.value != null,
  );
  if (!volumeMeasure || volumeMeasure.unit == null || volumeMeasure.value == null) {
    return null;
  }
  const factor = UNIT_CONVERSION_FACTORS[volumeMeasure.unit as MEASURE_UNIT];
  if (!factor || factor.baseUnit !== MEASURE_UNIT.MILLILITER) return null;
  // value × factor → milliliters; /1000 → liters.
  const milliliters = volumeMeasure.value * factor.factor;
  if (!Number.isFinite(milliliters) || milliliters <= 0) return null;
  return milliliters / 1000;
};

/**
 * Price per liter for an inventory item: unit price ÷ unit volume in liters.
 * Returns null when either piece is missing.
 */
const getItemPricePerLiter = (item: Item | null): number | null => {
  const price = getItemUnitPrice(item);
  const liters = getItemVolumeInLiters(item);
  if (price == null || liters == null || liters <= 0) return null;
  return price / liters;
};

/**
 * Coerce a value that may be a number, string, or Decimal-like to a number.
 * Returns null if it can't be parsed to a finite number.
 */
const toNumberOrNull = (raw: unknown): number | null => {
  if (raw == null) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw === "string") {
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  // Some API layers return Prisma Decimal as { toString(): string }
  if (typeof raw === "object" && raw !== null && "toString" in raw) {
    const n = Number((raw as { toString(): string }).toString());
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

/**
 * Latest formula's price-per-liter from a list of PaintFormulas. Sorts client-
 * side by createdAt desc so we don't depend on the API supporting orderBy
 * inside the include shape.
 */
const getLatestPaintPricePerLiter = (
  formulas: PaintFormula[] | null | undefined,
): number | null => {
  if (!formulas || formulas.length === 0) return null;
  const sorted = [...formulas].sort((a, b) => {
    const ta = new Date(a.createdAt).getTime();
    const tb = new Date(b.createdAt).getTime();
    return tb - ta;
  });
  const latest = sorted[0];
  if (!latest) return null;
  return toNumberOrNull((latest as { pricePerLiter?: unknown }).pricePerLiter);
};

const formatLiters = (value: number): string =>
  value.toLocaleString("pt-BR", { maximumFractionDigits: 3 });

const formatMl = (value: number): string =>
  value.toLocaleString("pt-BR", { maximumFractionDigits: 0 });

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function PaintMixCalculatorPage() {
  const form = useForm<MixFormValues>({
    defaultValues: DEFAULT_VALUES,
    mode: "onChange",
  });

  const { control, watch, setValue, reset } = form;

  // ---- Watched values ----
  const mode = watch("mode");
  const paintTypeId = watch("paintTypeId");
  const paintId = watch("paintId");
  const varnishItemId = watch("varnishItemId");
  const catalystItemId = watch("catalystItemId");
  const thinnerItemId = watch("thinnerItemId");
  const paintRatio = watch("paintRatio");
  const catalystRatio = watch("catalystRatio");
  const thinnerRatio = watch("thinnerRatio");
  const totalLiters = watch("totalLiters");

  // ---- Selected entities (mirrored from selectors so we can compute) ----
  const [varnishItem, setVarnishItem] = useState<Item | null>(null);
  const [catalystItem, setCatalystItem] = useState<Item | null>(null);
  const [thinnerItem, setThinnerItem] = useState<Item | null>(null);

  // ---- Categories: resolve names → IDs once, then pass to selectors ----
  const allCategoryNames = useMemo(
    () => [
      ...CATEGORY_NAMES.CATALYST,
      ...CATEGORY_NAMES.THINNER,
      ...CATEGORY_NAMES.VARNISH,
    ],
    [],
  );

  const { data: categoriesResponse, isLoading: categoriesLoading } =
    useItemCategories({
      where: { name: { in: allCategoryNames, mode: "insensitive" } },
      take: 50,
    } as any);

  const categories = categoriesResponse?.data ?? [];

  const matchByName = (names: readonly string[]): string[] => {
    const lower = names.map((n) => n.toLowerCase());
    return categories
      .filter((c) => lower.includes(c.name.toLowerCase()))
      .map((c) => c.id);
  };

  const catalystCategoryIds = useMemo(
    () => matchByName(CATEGORY_NAMES.CATALYST),
    [categories],
  );
  const thinnerCategoryIds = useMemo(
    () => matchByName(CATEGORY_NAMES.THINNER),
    [categories],
  );
  const varnishCategoryIds = useMemo(
    () => matchByName(CATEGORY_NAMES.VARNISH),
    [categories],
  );

  // ---- Paint types (only relevant in paint mode) ----
  const { data: paintTypesResponse, isLoading: paintTypesLoading } =
    usePaintTypes({
      orderBy: { name: "asc" },
      take: 200,
    });
  const paintTypes: PaintType[] = paintTypesResponse?.data ?? [];

  const selectedPaintType = useMemo(
    () => paintTypes.find((p) => p.id === paintTypeId) ?? null,
    [paintTypes, paintTypeId],
  );

  // Catalyst (Endurecedor) only applies to paint types that need a hardener.
  // Lacquer and Polyester are single-component for our purposes — hide it.
  const showCatalyst = useMemo(() => {
    if (mode === "varnish") return true;
    if (!selectedPaintType) return true;
    const t = selectedPaintType.type;
    return t !== PAINT_TYPE_ENUM.LACQUER && t !== PAINT_TYPE_ENUM.POLYESTER;
  }, [mode, selectedPaintType]);

  // Clear catalyst selection when it gets hidden so it doesn't linger in state.
  useEffect(() => {
    if (!showCatalyst && (catalystItemId !== null || catalystItem !== null)) {
      setValue("catalystItemId", null);
      setCatalystItem(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCatalyst]);

  // ---- Selected paint detail (for name, type, brand display) ----
  const { data: paintDetailResponse } = usePaint(paintId ?? "", {
    enabled: mode === "paint" && !!paintId,
    include: {
      paintType: true,
      paintBrand: true,
    },
  } as any);
  const paint: Paint | null = paintDetailResponse?.data ?? null;

  // ---- Selected paint's formulas (separate query — more reliable than
  // relying on `include: { formulas: true }` honoring all scalar fields). ----
  const { data: paintFormulasResponse } = usePaintFormulasByPaintId(
    paintId ?? "",
    { orderBy: { createdAt: "desc" }, limit: 50 } as any,
    { enabled: mode === "paint" && !!paintId },
  );
  const paintFormulas: PaintFormula[] =
    paintFormulasResponse?.data ?? [];

  // ---- Reset dependent state when mode changes ----
  useEffect(() => {
    if (mode === "paint") {
      // Switching to paint clears varnish selection
      if (varnishItemId !== null) setValue("varnishItemId", null);
      setVarnishItem(null);
    } else {
      // Switching to varnish clears paint selection
      if (paintTypeId !== null) setValue("paintTypeId", null);
      if (paintId !== null) setValue("paintId", null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // ---- Reset paint selection when paint type changes ----
  useEffect(() => {
    if (mode !== "paint") return;
    if (paintId !== null) setValue("paintId", null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paintTypeId]);

  // ---- Math: build slots from current state ----
  const slotConfigs = useMemo(() => {
    const mainLabel = mode === "paint" ? "Tinta" : "Verniz";
    const mainPricePerLiter =
      mode === "paint"
        ? getLatestPaintPricePerLiter(paintFormulas)
        : getItemPricePerLiter(varnishItem);
    const mainEntityName =
      mode === "paint"
        ? paint?.name ?? null
        : varnishItem?.name ?? null;
    const mainSelected =
      mode === "paint" ? !!paintId : !!varnishItemId;
    // Diagnostic: only computed for item-based slots (varnish/catalyst/thinner)
    const mainUnitPrice =
      mode === "paint" ? null : getItemUnitPrice(varnishItem);
    const mainUnitVolumeL =
      mode === "paint" ? null : getItemVolumeInLiters(varnishItem);

    const slots = [
      {
        key: "main",
        label: mainLabel,
        entityName: mainEntityName,
        ratio: Number(paintRatio) || 0,
        pricePerLiter: mainPricePerLiter,
        selected: mainSelected,
        unitPrice: mainUnitPrice,
        unitVolumeL: mainUnitVolumeL,
      },
    ];
    if (showCatalyst) {
      slots.push({
        key: "catalyst",
        label: "Catalisador",
        entityName: catalystItem?.name ?? null,
        ratio: Number(catalystRatio) || 0,
        pricePerLiter: getItemPricePerLiter(catalystItem),
        selected: !!catalystItemId,
        unitPrice: getItemUnitPrice(catalystItem),
        unitVolumeL: getItemVolumeInLiters(catalystItem),
      });
    }
    slots.push({
      key: "thinner",
      label: "Diluente",
      entityName: thinnerItem?.name ?? null,
      ratio: Number(thinnerRatio) || 0,
      pricePerLiter: getItemPricePerLiter(thinnerItem),
      selected: !!thinnerItemId,
      unitPrice: getItemUnitPrice(thinnerItem),
      unitVolumeL: getItemVolumeInLiters(thinnerItem),
    });
    return slots;
  }, [
    mode,
    paint,
    paintId,
    paintFormulas,
    varnishItem,
    varnishItemId,
    catalystItem,
    catalystItemId,
    thinnerItem,
    thinnerItemId,
    paintRatio,
    catalystRatio,
    thinnerRatio,
    showCatalyst,
  ]);

  const slotMath = useMemo(() => {
    const inputs: SlotInput[] = slotConfigs.map((s) => ({
      ratio: s.ratio,
      pricePerLiter: s.pricePerLiter,
    }));
    return computeSlotVolumes(inputs, Number(totalLiters) || 0);
  }, [slotConfigs, totalLiters]);

  const totalCost = computeTotalCost(slotMath);
  const costPerLiter = computeCostPerLiter(
    totalCost,
    Number(totalLiters) || 0,
  );

  // ---- Warnings ----
  const warnings = useMemo(() => {
    const list: string[] = [];
    const sumRatio =
      (Number(paintRatio) || 0) +
      (Number(catalystRatio) || 0) +
      (Number(thinnerRatio) || 0);
    if (sumRatio <= 0) list.push("Defina pelo menos uma proporção maior que zero.");
    if (Number(totalLiters) <= 0)
      list.push("Volume final precisa ser maior que zero.");
    if (
      mode === "paint" &&
      paintId &&
      paintFormulas.length === 0
    ) {
      list.push(
        "A tinta selecionada não possui fórmula cadastrada — preço por litro não pode ser calculado.",
      );
    }
    slotConfigs.forEach((s) => {
      if (s.selected && s.pricePerLiter == null) {
        // For the main slot in paint mode, the failure cause is the formula
        // (no formula or no pricePerLiter). For item-based slots it's price or
        // volume measure on the cadastro.
        if (s.key === "main" && mode === "paint") {
          list.push(
            `${s.label}: não foi possível calcular o preço por litro — a tinta selecionada não possui fórmula com preço cadastrado.`,
          );
        } else {
          list.push(
            `${s.label}: não foi possível calcular o preço por litro (sem preço ou sem medida de volume cadastrada).`,
          );
        }
      }
    });
    return list;
  }, [
    slotConfigs,
    paintRatio,
    catalystRatio,
    thinnerRatio,
    totalLiters,
    mode,
    paintId,
    paintFormulas,
  ]);

  // ---- Paint type options ----
  const paintTypeOptions = useMemo(
    () =>
      paintTypes.map((p) => ({
        value: p.id,
        label: p.name,
      })),
    [paintTypes],
  );

  // ---- Handlers ----
  const handleClear = () => {
    reset(DEFAULT_VALUES);
    setVarnishItem(null);
    setCatalystItem(null);
    setThinnerItem(null);
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="h-full flex flex-col px-4 pt-4">
      <div className="flex-shrink-0">
        <PageHeader
          title="Calculadora de Mistura"
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
          {/* Row 1, left: Mode */}
          <Card className="lg:col-span-3">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">1. Tipo de Mistura</CardTitle>
                <CardDescription>
                  O que você quer calcular?
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Controller
                  control={control}
                  name="mode"
                  render={({ field }) => (
                    <RadioGroup
                      value={field.value}
                      onValueChange={(v) => field.onChange(v as MixMode)}
                      className="grid grid-cols-2 gap-3"
                    >
                      <ModeOption
                        value="paint"
                        active={field.value === "paint"}
                        icon={<IconBucket className="h-5 w-5" stroke={1.5} />}
                        title="Tinta"
                        description="Mistura com base em uma tinta"
                      />
                      <ModeOption
                        value="varnish"
                        active={field.value === "varnish"}
                        icon={<IconDroplet className="h-5 w-5" stroke={1.5} />}
                        title="Verniz"
                        description="Mistura com base em verniz"
                      />
                    </RadioGroup>
                  )}
                />
              </CardContent>
            </Card>

            {/* Row 1, right: Proportion + Volume */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">3. Proporção e Volume</CardTitle>
                <CardDescription>
                  Proporção em partes inteiras e volume final em litros
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div
                  className={cn(
                    "grid gap-2",
                    showCatalyst ? "grid-cols-4" : "grid-cols-3",
                  )}
                >
                  <RatioField
                    label={mode === "paint" ? "Tinta" : "Verniz"}
                    name="paintRatio"
                    control={control}
                  />
                  {showCatalyst && (
                    <RatioField
                      label="Catalisador"
                      name="catalystRatio"
                      control={control}
                    />
                  )}
                  <RatioField
                    label="Diluente"
                    name="thinnerRatio"
                    control={control}
                  />
                  <div className="space-y-1">
                    <Label
                      htmlFor="total-liters"
                      className="text-xs text-muted-foreground"
                    >
                      Volume final
                    </Label>
                    <Controller
                      control={control}
                      name="totalLiters"
                      render={({ field }) => (
                        <div className="relative">
                          <Input
                            id="total-liters"
                            type="decimal"
                            decimals={3}
                            min={0}
                            value={field.value}
                            onChange={(v) =>
                              field.onChange(
                                typeof v === "number" ? v : Number(v) || 0,
                              )
                            }
                            onBlur={field.onBlur}
                            name={field.name}
                            placeholder="1"
                            className="pr-7 text-center"
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                            L
                          </span>
                        </div>
                      )}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Row 2, left: Components */}
            <Card className="lg:col-span-3">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">2. Componentes</CardTitle>
                <CardDescription>
                  Selecione os itens que farão parte da mistura
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {mode === "paint" ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="paint-type">Tipo de Tinta</Label>
                      <Controller
                        control={control}
                        name="paintTypeId"
                        render={({ field }) => (
                          <Combobox
                            options={paintTypeOptions}
                            value={field.value || ""}
                            onValueChange={(v) =>
                              field.onChange(typeof v === "string" && v ? v : null)
                            }
                            placeholder={
                              paintTypesLoading
                                ? "Carregando tipos..."
                                : "Selecione o tipo de tinta"
                            }
                            disabled={paintTypesLoading}
                            loading={paintTypesLoading}
                            searchable
                            clearable
                          />
                        )}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Tinta</Label>
                      <Controller
                        control={control}
                        name="paintId"
                        render={({ field }) => (
                          <PaintMixPaintSelector
                            value={field.value}
                            onValueChange={(v) => field.onChange(v)}
                            paintTypeId={paintTypeId}
                            placeholder="Selecione a tinta..."
                          />
                        )}
                      />
                    </div>
                  </>
                ) : (
                  <div className="space-y-2">
                    <Label>Verniz</Label>
                    <Controller
                      control={control}
                      name="varnishItemId"
                      render={({ field }) => (
                        <CategoryItemSelector
                          value={field.value}
                          onValueChange={(v, item) => {
                            field.onChange(v);
                            setVarnishItem(item);
                          }}
                          categoryIds={varnishCategoryIds}
                          categoriesLoading={categoriesLoading}
                          placeholder="Selecione o verniz..."
                          emptyLabel="Verniz"
                        />
                      )}
                    />
                  </div>
                )}

                {showCatalyst && (
                  <div className="space-y-2">
                    <Label>Catalisador (Endurecedor)</Label>
                    <Controller
                      control={control}
                      name="catalystItemId"
                      render={({ field }) => (
                        <CategoryItemSelector
                          value={field.value}
                          onValueChange={(v, item) => {
                            field.onChange(v);
                            setCatalystItem(item);
                          }}
                          categoryIds={catalystCategoryIds}
                          categoriesLoading={categoriesLoading}
                          placeholder="Selecione o catalisador..."
                          emptyLabel="Endurecedor"
                        />
                      )}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Diluente</Label>
                  <Controller
                    control={control}
                    name="thinnerItemId"
                    render={({ field }) => (
                      <CategoryItemSelector
                        value={field.value}
                        onValueChange={(v, item) => {
                          field.onChange(v);
                          setThinnerItem(item);
                        }}
                        categoryIds={thinnerCategoryIds}
                        categoriesLoading={categoriesLoading}
                        placeholder="Selecione o diluente..."
                        emptyLabel="Diluente"
                      />
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Row 2, right: Result */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <IconBrandSpeedtest className="h-5 w-5" />
                  Resultado
                </CardTitle>
                <CardDescription>Resumo da mistura</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {slotConfigs.map((slot, index) => {
                  const result = slotMath[index];
                  return (
                    <div
                      key={slot.key}
                      className="rounded-md bg-muted/40 p-3 space-y-1"
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-sm font-medium">{slot.label}</span>
                        <span className="text-sm font-semibold">
                          {result ? `${formatLiters(result.volumeLiters)} L` : "0 L"}
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
                        <span className="truncate">
                          {slot.entityName ?? "—"}
                        </span>
                        <span>
                          {result ? `${formatMl(result.volumeMl)} ml` : "0 ml"}
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between gap-2 text-xs">
                        <span className="text-muted-foreground">
                          {slot.pricePerLiter != null
                            ? `${formatCurrency(slot.pricePerLiter)} / L`
                            : "Preço/L: —"}
                        </span>
                        <span className="font-medium">
                          {result?.cost != null
                            ? formatCurrency(result.cost)
                            : "—"}
                        </span>
                      </div>
                      {(slot.unitPrice != null || slot.unitVolumeL != null) && (
                        <div className="flex items-baseline justify-between gap-2 text-[11px] text-muted-foreground/80">
                          <span>
                            Cadastro:{" "}
                            {slot.unitPrice != null
                              ? formatCurrency(slot.unitPrice)
                              : "—"}{" "}
                            /{" "}
                            {slot.unitVolumeL != null
                              ? `${formatLiters(slot.unitVolumeL)} L`
                              : "sem volume"}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}

                <div className="border-t border-border pt-3 space-y-2">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm text-muted-foreground">
                      Volume total
                    </span>
                    <span className="text-lg font-semibold">
                      {formatLiters(Number(totalLiters) || 0)} L
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm text-muted-foreground">
                      Custo total
                    </span>
                    <span className="text-lg font-semibold">
                      {totalCost != null ? formatCurrency(totalCost) : "—"}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm text-muted-foreground">
                      Custo por litro
                    </span>
                    <span className="text-base font-semibold">
                      {costPerLiter != null
                        ? `${formatCurrency(costPerLiter)} / L`
                        : "—"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {warnings.length > 0 && (
              <Card
                className={cn(
                  "lg:col-span-5 border-amber-500/40 bg-amber-50/40 dark:bg-amber-950/10",
                )}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <IconAlertTriangle className="h-4 w-4 text-amber-600" />
                    Atenção
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1 text-xs text-muted-foreground list-disc pl-4">
                    {warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface ModeOptionProps {
  value: string;
  active: boolean;
  icon: React.ReactNode;
  title: string;
  description: string;
}

function ModeOption({ value, active, icon, title, description }: ModeOptionProps) {
  return (
    <label
      className={cn(
        "relative flex items-start gap-3 rounded-md border p-3 cursor-pointer transition-colors",
        active
          ? "border-primary bg-primary/5"
          : "border-border bg-transparent hover:bg-muted/40",
      )}
    >
      <RadioGroupItem
        value={value}
        id={`mode-${value}`}
        className="mt-1"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-medium">{title}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
    </label>
  );
}

interface RatioFieldProps {
  label: string;
  name: "paintRatio" | "catalystRatio" | "thinnerRatio";
  control: any;
}

function RatioField({ label, name, control }: RatioFieldProps) {
  return (
    <div className="space-y-1">
      <Label htmlFor={`ratio-${name}`} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Input
            id={`ratio-${name}`}
            type="integer"
            min={0}
            value={field.value}
            onChange={(v) =>
              field.onChange(typeof v === "number" ? v : Number(v) || 0)
            }
            onBlur={field.onBlur}
            name={field.name}
            placeholder="0"
            className="text-center"
          />
        )}
      />
    </div>
  );
}

export default PaintMixCalculatorPage;
