import React from "react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { paintFormulaCreateSchema, type PaintFormulaCreateFormData } from "../../../schemas";
import type { PaintFormula, Item } from "../../../types";
import { FormulaComponentsEditor } from "./formula-components-editor";
import { FormulaSampler } from "./formula-sampler";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface FormulaManagerProps {
  formulas: PaintFormula[];
  onFormulasChange: (formulas: PaintFormula[]) => void;
  paintId?: string;
  availableItems?: Item[];
}

export function FormulaManager({ formulas, onFormulasChange, paintId, availableItems = [] }: FormulaManagerProps) {
  // Ensure we always have at least one formula ready
  React.useEffect(() => {
    if (formulas.length === 0) {
      const newFormula = {
        id: `temp-${Date.now()}`,
        description: "Fórmula Principal",
        paintId: paintId || "",
        density: 1.0,
        pricePerLiter: 0,
        components: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as PaintFormula;
      onFormulasChange([newFormula]);
    }
  }, []);

  // In update mode, don't pre-fill formula fields - they should be empty for adding new formulas
  const form = useForm<PaintFormulaCreateFormData>({
    resolver: zodResolver(paintFormulaCreateSchema),
    defaultValues: {
      description: "Fórmula Principal",
      paintId: paintId || "",
      components: [], // Always start with empty components for new formulas
    },
  });

  // Auto-update formula when form values change
  React.useEffect(() => {
    const subscription = form.watch((data) => {
      if (formulas.length > 0) {
        const updatedFormula = {
          ...formulas[0],
          description: data.description || "Fórmula Principal",
          components:
            data.components?.map((c, index) => {
              const component = {
                id: formulas[0].components?.[index]?.id || `temp-comp-${Date.now()}-${index}`,
                itemId: c?.itemId || "",
                formulaPaintId: formulas[0].id || "",
                ratio: 0, // Ratio will be calculated from weightInGrams on the backend
                weight: c?.weightInGrams || 0,
                createdAt: formulas[0].components?.[index]?.createdAt || new Date(),
                updatedAt: new Date(),
              };
              return component;
            }) || [],
        };

        onFormulasChange([updatedFormula]);
      }
    });

    return () => subscription.unsubscribe();
  }, [form.watch, formulas, onFormulasChange]);

  return (
    <FormProvider {...form}>
      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="description">Descrição da Fórmula</Label>
          {/* @ts-expect-error - form register onChange type mismatch */}
          <Input id="description" placeholder="Ex: Fórmula Principal, Variação Clara, etc." {...form.register("description")} />
          {form.formState.errors.description && <p className="text-sm text-destructive">{form.formState.errors.description.message}</p>}
        </div>

        <div className="space-y-4">
          <Label>Componentes da Fórmula</Label>
          <div className="mt-4">
            <FormulaComponentsEditor availableItems={availableItems} />
          </div>
          {form.formState.errors.components && <p className="text-sm text-destructive mt-2">{form.formState.errors.components.message}</p>}
        </div>

        <div className="space-y-4">
          <FormulaSampler availableItems={availableItems} />
        </div>

        <div className="pt-8">
          <p className="text-xs text-muted-foreground/70">Adicione os componentes da fórmula. Se não adicionar nenhum componente, a tinta será salva sem fórmula.</p>
        </div>
      </div>
    </FormProvider>
  );
}
