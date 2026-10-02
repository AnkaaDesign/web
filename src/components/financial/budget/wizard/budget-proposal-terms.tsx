/**
 * OS PRAZOS DA PROPOSTA — validade, garantia, prazo de entrega e tarefas
 * simultâneas. Campos do ORÇAMENTO (comuns a todos os veículos).
 *
 * Moravam num passo próprio ("Informações"); a decisão do dono de 02/10/2026 os
 * pôs no passo Tarefa, ao lado do que identifica o trabalho.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";

import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ValidityField } from "@/components/financial/budget/validity";

const FORECAST_DAYS_OPTIONS = Array.from({ length: 30 }, (_, i) => ({
  value: String(i + 1),
  label: `${i + 1} ${i + 1 === 1 ? "dia" : "dias"}`,
}));

const GUARANTEE_OPTIONS = [
  { value: "5", label: "5 anos" },
  { value: "10", label: "10 anos" },
  { value: "15", label: "15 anos" },
  { value: "CUSTOM", label: "Personalizado" },
];

export function BudgetProposalTerms({ disabled }: { disabled?: boolean }) {
  const { control, setValue } = useFormContext();
  const expiresAt = useWatch({ control, name: "expiresAt" });
  const guaranteeYears = useWatch({ control, name: "guaranteeYears" });
  const customGuaranteeText = useWatch({ control, name: "customGuaranteeText" });
  const [showCustomGuarantee, setShowCustomGuarantee] = useState(false);

  // O texto personalizado gravado abre o campo dele.
  useEffect(() => {
    if (customGuaranteeText) setShowCustomGuarantee(true);
  }, [customGuaranteeText]);

  const guaranteeOption = useMemo(() => {
    if (customGuaranteeText || showCustomGuarantee) return "CUSTOM";
    return guaranteeYears ? String(guaranteeYears) : "";
  }, [guaranteeYears, customGuaranteeText, showCustomGuarantee]);

  const handleGuaranteeChange = useCallback(
    (value: string) => {
      if (value === "CUSTOM") {
        setShowCustomGuarantee(true);
        setValue("guaranteeYears", null, { shouldDirty: true });
      } else {
        setShowCustomGuarantee(false);
        setValue("customGuaranteeText", null, { shouldDirty: true });
        setValue("guaranteeYears", value ? Number(value) : null, { shouldDirty: true });
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

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <FormField
          control={control}
          name="expiresAt"
          render={() => (
            <FormItem>
              <FormLabel>
                Validade da Proposta <span className="text-destructive">*</span>
              </FormLabel>
              <FormControl>
                <ValidityField value={expiresAt} onChange={handleValidityChange} disabled={disabled} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormItem>
          <FormLabel>Período de Garantia</FormLabel>
          <FormControl>
            <Combobox
              value={guaranteeOption}
              onValueChange={(value) => {
                if (typeof value === "string") handleGuaranteeChange(value);
              }}
              disabled={disabled}
              options={GUARANTEE_OPTIONS}
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
                  onValueChange={(value) => field.onChange(value ? Number(value) : null)}
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
                  onChange={(value) => field.onChange(value ? Number(value) : null)}
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
                <Textarea
                  value={field.value || ""}
                  onChange={(value) => field.onChange(value || null)}
                  placeholder="Descreva as condições de garantia personalizadas..."
                  disabled={disabled}
                  rows={3}
                  className="bg-transparent"
                />
              </FormControl>
            </FormItem>
          )}
        />
      )}
    </div>
  );
}
