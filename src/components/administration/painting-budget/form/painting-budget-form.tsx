import { useEffect, useMemo } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { IconInfoCircle, IconRuler, IconTruck } from "@tabler/icons-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { FormInput } from "@/components/ui/form-input";
import { Combobox } from "@/components/ui/combobox";
import { usePaintingConfig } from "@/hooks";
import {
  PAINTING_SERVICE_CONTEXT_LABELS,
  PAINTING_SUBSTRATE_LABELS,
  type PaintingServiceContext,
  type PaintingSubstrate,
} from "../../../../types";

/** Campo numérico opcional: vazio vira null em vez de 0 (senão `.positive()` reprova). */
const blankToNull = (value: unknown) =>
  value === "" || value === null || value === undefined || (typeof value === "number" && Number.isNaN(value)) ? null : value;
const requiredCm = z.preprocess(
  blankToNull,
  z.coerce.number({ required_error: "Obrigatório." }).positive("Informe um valor maior que zero."),
);

export const paintingBudgetFormSchema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório."),
  serviceContext: z.enum(["NEW_IMPLEMENT", "REFORM"]),
  substrate: z.enum(["CHAPA_FRISOS", "ISOPLASTIC", "SIDER_LONA", "OUTRO"]),
  paintSystemKey: z.string().nullish(),
  // ÚNICAS medidas: largura, teto, chassi e frames são inferidos a partir delas,
  // e é o comprimento que calibra a escala das artes — por isso são obrigatórias.
  lengthCm: requiredCm,
  heightCm: requiredCm,
});

export type PaintingBudgetFormData = z.infer<typeof paintingBudgetFormSchema>;

const SERVICE_CONTEXT_OPTIONS = (Object.keys(PAINTING_SERVICE_CONTEXT_LABELS) as PaintingServiceContext[]).map((value) => ({
  value,
  label: PAINTING_SERVICE_CONTEXT_LABELS[value],
}));
const SUBSTRATE_OPTIONS = (Object.keys(PAINTING_SUBSTRATE_LABELS) as PaintingSubstrate[]).map((value) => ({
  value,
  label: PAINTING_SUBSTRATE_LABELS[value],
}));

const SUBSTRATE_HINTS: Record<PaintingSubstrate, string> = {
  CHAPA_FRISOS: "Baú de carga seca — chapa metálica com frisos.",
  ISOPLASTIC: "Isoplastic — baú liso; corte mais fácil, mas exige lixamento nas janelas do adesivo.",
  SIDER_LONA: "Lona de sider — pintura com a linha vinílica, processo próprio.",
  OUTRO: "Baú refrigerado — traz o aparelho Thermo King na desmontagem e no lixamento.",
};

interface PaintingBudgetFormProps {
  mode: "create" | "update";
  onSubmit: (data: PaintingBudgetFormData) => void | Promise<void>;
  isSubmitting?: boolean;
  defaultValues?: Partial<PaintingBudgetFormData>;
  onFormStateChange?: (state: { isValid: boolean; isDirty: boolean }) => void;
}

/** Largura padrão de implemento rodoviário — espelha a regra IMPLEMENT_DEFAULTS da API. */
const INFERRED_WIDTH_CM = 260;
const fmt = (value: number) => value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function PaintingBudgetForm({ mode: _mode, onSubmit, isSubmitting, defaultValues, onFormStateChange }: PaintingBudgetFormProps) {
  const form = useForm<PaintingBudgetFormData>({
    resolver: zodResolver(paintingBudgetFormSchema),
    defaultValues: {
      name: "",
      serviceContext: "NEW_IMPLEMENT",
      substrate: "CHAPA_FRISOS",
      paintSystemKey: null,
      lengthCm: undefined as unknown as number,
      heightCm: undefined as unknown as number,
      ...defaultValues,
    },
    mode: "onBlur",
    reValidateMode: "onChange",
    shouldFocusError: true,
    criteriaMode: "firstError",
  });

  const { isValid, isDirty } = form.formState;
  useEffect(() => {
    onFormStateChange?.({ isValid, isDirty });
  }, [isValid, isDirty, onFormStateChange]);

  const serviceContext = form.watch("serviceContext");
  const substrate = form.watch("substrate");
  const lengthCm = form.watch("lengthCm");
  const heightCm = form.watch("heightCm");

  const { data: configResponse } = usePaintingConfig();
  const paintSystemOptions = useMemo(
    () =>
      (configResponse?.data?.paintSystems ?? [])
        .filter((system) => system.active)
        .map((system) => ({ value: system.key, label: system.label })),
    [configResponse?.data?.paintSystems],
  );

  // Pré-seleciona o sistema padrão (regra DEFAULT_PAINT_SYSTEM) para o usuário ver
  // qual será usado, em vez de descobrir só no alerta do plano.
  const defaultSystemKey = configResponse?.data?.rules?.find((rule) => rule.key === "DEFAULT_PAINT_SYSTEM")?.params?.key;
  useEffect(() => {
    if (typeof defaultSystemKey !== "string" || !defaultSystemKey) return;
    if (form.getValues("paintSystemKey")) return;
    if (!paintSystemOptions.some((option) => option.value === defaultSystemKey)) return;
    form.setValue("paintSystemKey", defaultSystemKey);
  }, [defaultSystemKey, paintSystemOptions, form]);

  // Mesma inferência da API: largura padrão, teto = comprimento × largura.
  const width = configResponse?.data?.rules?.find((rule) => rule.key === "IMPLEMENT_DEFAULTS")?.params?.widthCm;
  const widthCm = typeof width === "number" && width > 0 ? width : INFERRED_WIDTH_CM;
  const hasMeasures = !!lengthCm && !!heightCm;
  const sideArea = hasMeasures ? (2 * lengthCm! * heightCm!) / 10_000 : 0;
  const endsArea = hasMeasures ? (2 * widthCm * heightCm!) / 10_000 : 0;
  const roofArea = hasMeasures ? (lengthCm! * widthCm) / 10_000 : 0;

  return (
    <FormProvider {...form}>
      <form id="painting-budget-form" onSubmit={form.handleSubmit(onSubmit)} className="container mx-auto max-w-6xl">
        <button id="painting-budget-form-submit" type="submit" className="hidden" disabled={isSubmitting}>
          Submit
        </button>
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconInfoCircle className="h-5 w-5 text-muted-foreground" />
                Informações Básicas
              </CardTitle>
              <CardDescription>Identificação do orçamento de pintura</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-6">
                <FormInput<PaintingBudgetFormData> name="name" label="Nome" placeholder="Ex.: AVGLOG — baú 14,70m" required disabled={isSubmitting} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconTruck className="h-5 w-5 text-muted-foreground" />
                Implemento e Serviço
              </CardTitle>
              <CardDescription>Se há pintura geral e qual é a cor final saem da própria arte — aqui só o que a arte não conta</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="serviceContext"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Contexto do serviço<span className="text-destructive ml-1">*</span>
                      </FormLabel>
                      <FormControl>
                        <Combobox
                          options={SERVICE_CONTEXT_OPTIONS}
                          value={field.value}
                          onValueChange={field.onChange}
                          placeholder="Selecione o contexto"
                          disabled={isSubmitting}
                          clearable={false}
                          searchable={false}
                        />
                      </FormControl>
                      <FormDescription>
                        {serviceContext === "REFORM"
                          ? "Reforma prefixa remoção de adesivos/refletivas antigas e vedação PU."
                          : "Implemento novo — o plano começa na desmontagem e na preparação."}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="substrate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Substrato<span className="text-destructive ml-1">*</span>
                      </FormLabel>
                      <FormControl>
                        <Combobox
                          options={SUBSTRATE_OPTIONS}
                          value={field.value}
                          onValueChange={field.onChange}
                          placeholder="Selecione o substrato"
                          disabled={isSubmitting}
                          clearable={false}
                          searchable={false}
                        />
                      </FormControl>
                      <FormDescription>{SUBSTRATE_HINTS[substrate]}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="paintSystemKey"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Sistema de pintura</FormLabel>
                      <FormControl>
                        <Combobox
                          options={paintSystemOptions}
                          value={field.value ?? ""}
                          onValueChange={field.onChange}
                          placeholder="Selecione o sistema"
                          disabled={isSubmitting}
                          searchable={false}
                        />
                      </FormControl>
                      <FormDescription>
                        Define o esquema de demãos, a catálise e a diluição. Só é usado se a arte indicar pintura geral.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconRuler className="h-5 w-5 text-muted-foreground" />
                Medidas do Implemento
              </CardTitle>
              <CardDescription>Em centímetros. Largura, teto, chassi e frames são inferidos a partir destas duas</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <FormInput<PaintingBudgetFormData> name="lengthCm" type="number" label="Comprimento (cm)" required disabled={isSubmitting} />
                <FormInput<PaintingBudgetFormData> name="heightCm" type="number" label="Altura (cm)" required disabled={isSubmitting} />
              </div>

              {hasMeasures && (
                <div className="mt-6 rounded-lg border border-border bg-muted/30 p-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Inferido a partir das medidas</p>
                  <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Largura</p>
                      <p className="font-medium tabular-nums">{widthCm} cm</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Laterais</p>
                      <p className="font-medium tabular-nums">{fmt(sideArea)} m²</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Traseira + frente</p>
                      <p className="font-medium tabular-nums">{fmt(endsArea)} m²</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Teto</p>
                      <p className="font-medium tabular-nums">{fmt(roofArea)} m²</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </form>
    </FormProvider>
  );
}
