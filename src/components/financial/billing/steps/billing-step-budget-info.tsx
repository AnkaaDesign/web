import type { ReactNode } from "react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import {
  ApprovedLayoutPicker,
  type LayoutOption,
} from "@/components/financial/common/approved-layout-picker";
import { IconCalendar } from "@tabler/icons-react";
import type { FileWithPreview } from "@/components/common/file/file-uploader";
import { ValidityField } from "@/components/financial/budget/validity";

const GUARANTEE_OPTIONS = [
  { value: "5", label: "5 anos" },
  { value: "10", label: "10 anos" },
  { value: "15", label: "15 anos" },
  { value: "CUSTOM", label: "Personalizado" },
] as const;

const FORECAST_DAYS_OPTIONS = Array.from({ length: 30 }, (_, i) => ({
  value: String(i + 1),
  label: `${i + 1} ${i + 1 === 1 ? "dia" : "dias"}`,
}));

interface BillingStepBudgetInfoProps {
  disabled?: boolean;
  layoutFiles: FileWithPreview[];
  onLayoutFilesChange: (files: FileWithPreview[]) => void;
  // The task's layout files — the pool the approved layout is chosen from.
  layouts?: LayoutOption[];
  /**
   * Substitui o seletor quando o orçamento tem UM LAYOUT PARA CADA VEÍCULO: aqui o
   * seletor só sabe o compartilhado, e a API recusa trocar o layout de um orçamento
   * por veículo pelo caminho antigo. O aviso manda para a tela do orçamento.
   */
  layoutNotice?: ReactNode;
}

export function BillingStepBudgetInfo({
  disabled,
  layoutFiles,
  onLayoutFilesChange,
  layouts,
  layoutNotice,
}: BillingStepBudgetInfoProps) {
  const { control, setValue } = useFormContext();
  const [showCustomGuarantee, setShowCustomGuarantee] = useState(false);

  const quoteExpiresAt = useWatch({ control, name: "expiresAt" });
  const guaranteeYears = useWatch({ control, name: "guaranteeYears" });
  const customGuaranteeText = useWatch({ control, name: "customGuaranteeText" });


  useEffect(() => {
    if (customGuaranteeText) setShowCustomGuarantee(true);
  }, [customGuaranteeText]);

  const currentGuaranteeOption = useMemo(() => {
    if (customGuaranteeText) return "CUSTOM";
    if (guaranteeYears) return guaranteeYears.toString();
    return "";
  }, [guaranteeYears, customGuaranteeText]);

  const handleGuaranteeOptionChange = useCallback(
    (value: string) => {
      if (value === "CUSTOM") {
        setShowCustomGuarantee(true);
        setValue("guaranteeYears", null);
      } else {
        setShowCustomGuarantee(false);
        setValue("customGuaranteeText", null);
        setValue("guaranteeYears", value ? Number(value) : null);
      }
    },
    [setValue],
  );

  // `shouldDirty`: o Salvar grava pelo `dirtyFields`, e sem ele trocar SÓ a
  // validade não mandava nada — zero prorrogações registradas em 120 dias (até
  // 25/09/2026).
  const handleValidityChange = useCallback(
    (next: Date) => setValue("expiresAt", next, { shouldDirty: true }),
    [setValue],
  );

  const handleLayoutFileChange = useCallback(
    (files: FileWithPreview[]) => {
      onLayoutFilesChange(files);
      const ids = files
        .map((f) => (f as any).uploadedFileId || f.id)
        .filter(Boolean)
        .slice(0, 2);
      setValue("layoutFileIds", ids, { shouldDirty: true });
    },
    [setValue, onLayoutFilesChange],
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <IconCalendar className="h-4 w-4 text-muted-foreground" />
            Prazos e Garantia
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <FormField
              control={control}
              name="expiresAt"
              render={() => (
                <FormItem>
                  <FormLabel>Validade da Proposta</FormLabel>
                  <FormControl>
                    <ValidityField
                      value={quoteExpiresAt}
                      onChange={handleValidityChange}
                      disabled={disabled}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormItem>
              <FormLabel>Período de Garantia</FormLabel>
              <FormControl>
                <Combobox
                  value={currentGuaranteeOption}
                  onValueChange={(value) => {
                    if (typeof value === "string")
                      handleGuaranteeOptionChange(value);
                  }}
                  disabled={disabled}
                  options={GUARANTEE_OPTIONS.map((opt) => ({
                    value: opt.value,
                    label: opt.label,
                  }))}
                  placeholder="Selecione"
                  emptyText="Nenhuma opção"
                />
              </FormControl>
            </FormItem>

            <FormField
              control={control}
              name="customForecastDays"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Prazo de Entrega</FormLabel>
                  <FormControl>
                    <Combobox
                      value={field.value ? String(field.value) : ""}
                      onValueChange={(value) =>
                        field.onChange(value ? Number(value) : null)
                      }
                      disabled={disabled}
                      options={FORECAST_DAYS_OPTIONS}
                      placeholder="Auto"
                      emptyText="Nenhuma opção"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={control}
              name="simultaneousTasks"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tarefas Simultâneas</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      {...field}
                      value={field.value ?? ""}
                      onChange={(val) =>
                        field.onChange(val ? Number(val) : null)
                      }
                      disabled={disabled}
                      placeholder="1-100"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {showCustomGuarantee && (
            <FormField
              control={control}
              name="customGuaranteeText"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Texto Personalizado de Garantia</FormLabel>
                  <FormControl>
                    <textarea
                      {...field}
                      value={field.value || ""}
                      placeholder="Descreva as condições de garantia personalizadas..."
                      disabled={disabled}
                      rows={3}
                      className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          )}
        </CardContent>
      </Card>

      {layoutNotice ?? (
        <ApprovedLayoutPicker
          layouts={layouts}
          layoutFiles={layoutFiles}
          onChange={handleLayoutFileChange}
          disabled={disabled}
        />
      )}
    </div>
  );
}
