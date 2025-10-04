import React from "react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { paintFormulaCreateSchema, type PaintFormulaCreateFormData } from "../../../schemas";
import type { PaintFormula, Item } from "../../../types";
import { FormulaComponentsEditor } from "./formula-components-editor";
import { FormulaSampler } from "./formula-sampler";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { IconAlertCircle, IconInfoCircle, IconCircleCheck } from "@tabler/icons-react";

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
  }, [formulas.length, onFormulasChange, paintId]);

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
                ratio: c?.ratio || 0,
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

  // Calculate formula validation status
  const formulaValidation = React.useMemo(() => {
    const currentFormula = formulas[0];
    if (!currentFormula) return { isValid: false, errors: [], warnings: [] };

    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if description is provided
    if (!currentFormula.description || currentFormula.description.trim() === "") {
      errors.push("Descrição da fórmula é obrigatória");
    }

    // Check components
    const validComponents = currentFormula.components?.filter((c) => c.itemId && c.ratio > 0) || [];

    if (validComponents.length === 0) {
      warnings.push("Nenhum componente foi adicionado à fórmula");
    } else {
      // Check if ratios sum to 100%
      const totalRatio = validComponents.reduce((sum, c) => sum + c.ratio, 0);
      if (Math.abs(totalRatio - 100) > 0.01) {
        warnings.push(`Proporções somam ${totalRatio.toFixed(1)}% (ideal: 100%)`);
      }

      // Check for duplicate items
      const itemIds = validComponents.map((c) => c.itemId);
      const uniqueItemIds = new Set(itemIds);
      if (itemIds.length !== uniqueItemIds.size) {
        errors.push("Existem componentes duplicados na fórmula");
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      componentCount: validComponents.length,
      totalRatio: validComponents.reduce((sum, c) => sum + c.ratio, 0),
    };
  }, [formulas]);

  return (
    <FormProvider {...form}>
      <div className="space-y-6">
        {/* Formula Description */}
        <div className="space-y-2">
          <Label htmlFor="description">
            Descrição da Fórmula
            <span className="text-destructive ml-1">*</span>
          </Label>
          <Input
            id="description"
            placeholder="Ex: Fórmula Principal, Variação Clara, etc."
            {...form.register("description")}
            className={form.formState.errors.description ? "border-destructive" : ""}
          />
          {form.formState.errors.description && <p className="text-sm text-destructive">{form.formState.errors.description.message}</p>}
        </div>

        {/* Formula Status */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Label>Status da Fórmula</Label>
            {formulaValidation.isValid ? (
              <Badge variant="default" className="text-green-700 bg-green-100">
                <IconCircleCheck className="h-3 w-3 mr-1" />
                Válida
              </Badge>
            ) : (
              <Badge variant="destructive">
                <IconAlertCircle className="h-3 w-3 mr-1" />
                Incompleta
              </Badge>
            )}
          </div>

          {/* Validation Messages */}
          {formulaValidation.errors.length > 0 && (
            <Alert variant="destructive">
              <IconAlertCircle className="h-4 w-4" />
              <AlertDescription>
                <ul className="list-disc list-inside space-y-1">
                  {formulaValidation.errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {formulaValidation.warnings.length > 0 && (
            <Alert>
              <IconInfoCircle className="h-4 w-4" />
              <AlertDescription>
                <ul className="list-disc list-inside space-y-1">
                  {formulaValidation.warnings.map((warning, index) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Components Editor */}
        <div className="space-y-4">
          <Label>Componentes da Fórmula</Label>
          <div className="mt-4">
            <FormulaComponentsEditor availableItems={availableItems} />
          </div>
          {form.formState.errors.components && <p className="text-sm text-destructive mt-2">{form.formState.errors.components.message}</p>}
        </div>

        {/* Formula Sampler */}
        <div className="space-y-4">
          <FormulaSampler availableItems={availableItems} />
        </div>

        {/* Help Text */}
        <div className="pt-8">
          <p className="text-xs text-muted-foreground/70">
            Adicione os componentes da fórmula especificando suas proporções em porcentagem. Se não adicionar nenhum componente, a tinta será salva sem fórmula.
          </p>
        </div>
      </div>
    </FormProvider>
  );
}
