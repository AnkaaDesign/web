import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  IconPercentage,
  IconCurrencyReal,
  IconSave,
  IconX,
  IconCalculator,
  IconInfo,
} from "@tabler/icons-react";
import { formatCurrency } from "../../../utils";
import { discountCreateSchema, discountUpdateSchema } from "../../../schemas";
import type {
  DiscountCreateFormData,
  DiscountUpdateFormData
} from "../../../schemas";
import type { Discount } from "../../../types";
import { Input } from "@/components/ui/input";

interface DiscountFormProps {
  initialData?: Discount;
  onSubmit: (data: DiscountCreateFormData | DiscountUpdateFormData) => void;
  onCancel?: () => void;
  isLoading?: boolean;
  grossSalary?: number; // For percentage calculation preview
  className?: string;
}

// Common discount types with predefined values
const DISCOUNT_PRESETS = [
  {
    id: "inss",
    label: "INSS",
    reference: "Contribuição INSS",
    type: "percentage" as const,
    percentage: 8.0,
    description: "Contribuição previdenciária"
  },
  {
    id: "irrf",
    label: "IRRF",
    reference: "Imposto de Renda",
    type: "percentage" as const,
    percentage: 7.5,
    description: "Imposto de Renda Retido na Fonte"
  },
  {
    id: "vale_transporte",
    label: "Vale Transporte",
    reference: "Vale Transporte",
    type: "percentage" as const,
    percentage: 6.0,
    description: "Desconto para vale transporte"
  },
  {
    id: "plano_saude",
    label: "Plano de Saúde",
    reference: "Plano de Saúde",
    type: "fixed" as const,
    fixedValue: 150.00,
    description: "Contribuição plano de saúde"
  },
  {
    id: "seguro_vida",
    label: "Seguro de Vida",
    reference: "Seguro de Vida",
    type: "fixed" as const,
    fixedValue: 25.00,
    description: "Seguro de vida em grupo"
  },
  {
    id: "other",
    label: "Outro",
    reference: "",
    type: "fixed" as const,
    description: "Desconto personalizado"
  }
];

export function DiscountForm({
  initialData,
  onSubmit,
  onCancel,
  isLoading,
  grossSalary = 0,
  className
}: DiscountFormProps) {
  const isEditing = !!initialData;
  const [discountType, setDiscountType] = useState<"percentage" | "fixed">(
    initialData?.percentage ? "percentage" : "fixed"
  );
  const [selectedPreset, setSelectedPreset] = useState<string>("other");

  // Form setup
  const form = useForm<DiscountCreateFormData | DiscountUpdateFormData>({
    resolver: zodResolver(isEditing ? discountUpdateSchema : discountCreateSchema),
    defaultValues: {
      reference: initialData?.reference || "",
      percentage: initialData?.percentage || undefined,
      fixedValue: initialData?.fixedValue || undefined,
    }
  });

  // Watch form values for preview calculation
  const watchedValues = form.watch();
  const currentPercentage = watchedValues.percentage;
  const currentFixedValue = watchedValues.fixedValue;

  // Calculate discount preview
  const discountPreview = React.useMemo(() => {
    if (discountType === "percentage" && currentPercentage && grossSalary > 0) {
      return (grossSalary * currentPercentage) / 100;
    }
    if (discountType === "fixed" && currentFixedValue) {
      return currentFixedValue;
    }
    return 0;
  }, [discountType, currentPercentage, currentFixedValue, grossSalary]);

  // Handle preset selection
  const handlePresetChange = (presetId: string) => {
    setSelectedPreset(presetId);
    const preset = DISCOUNT_PRESETS.find(p => p.id === presetId);

    if (preset && preset.id !== "other") {
      form.setValue("reference", preset.reference);
      setDiscountType(preset.type);

      if (preset.type === "percentage" && preset.percentage) {
        form.setValue("percentage", preset.percentage);
        form.setValue("fixedValue", undefined);
      } else if (preset.type === "fixed" && preset.fixedValue) {
        form.setValue("fixedValue", preset.fixedValue);
        form.setValue("percentage", undefined);
      }
    } else {
      // Reset form for custom discount
      form.setValue("reference", "");
      form.setValue("percentage", undefined);
      form.setValue("fixedValue", undefined);
    }
  };

  // Handle discount type change
  const handleDiscountTypeChange = (type: "percentage" | "fixed") => {
    setDiscountType(type);
    if (type === "percentage") {
      form.setValue("fixedValue", undefined);
    } else {
      form.setValue("percentage", undefined);
    }
  };

  const handleSubmit = (data: DiscountCreateFormData | DiscountUpdateFormData) => {
    // Ensure only one type of value is set
    if (discountType === "percentage") {
      onSubmit({ ...data, fixedValue: undefined });
    } else {
      onSubmit({ ...data, percentage: undefined });
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          {/* Preset Selection */}
          {!isEditing && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Tipo de Desconto</CardTitle>
                <CardDescription>
                  Selecione um tipo comum ou crie um desconto personalizado
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Select value={selectedPreset} onValueChange={handlePresetChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo de desconto" />
                  </SelectTrigger>
                  <SelectContent>
                    {DISCOUNT_PRESETS.map((preset) => (
                      <SelectItem key={preset.id} value={preset.id}>
                        <div className="flex flex-col">
                          <span>{preset.label}</span>
                          <span className="text-xs text-muted-foreground">
                            {preset.description}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          )}

          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Informações do Desconto</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="reference"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Referência</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Ex: INSS, Vale Transporte, Plano de Saúde"
                      />
                    </FormControl>
                    <FormDescription>
                      Nome ou descrição do desconto que aparecerá no contracheque
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Discount Type Selection */}
              <div className="space-y-3">
                <Label>Tipo de Desconto</Label>
                <RadioGroup
                  value={discountType}
                  onValueChange={(value) => handleDiscountTypeChange(value as "percentage" | "fixed")}
                  className="flex gap-6"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="percentage" id="percentage" />
                    <Label htmlFor="percentage" className="flex items-center gap-2">
                      <IconPercentage className="h-4 w-4" />
                      Percentual
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="fixed" id="fixed" />
                    <Label htmlFor="fixed" className="flex items-center gap-2">
                      <IconCurrencyReal className="h-4 w-4" />
                      Valor Fixo
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Percentage Input */}
              {discountType === "percentage" && (
                <FormField
                  control={form.control}
                  name="percentage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Percentual (%)</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            max="100"
                            placeholder="0.00"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)}
                          />
                          <IconPercentage className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                        </div>
                      </FormControl>
                      <FormDescription>
                        Percentual a ser descontado sobre o salário bruto
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Fixed Value Input */}
              {discountType === "fixed" && (
                <FormField
                  control={form.control}
                  name="fixedValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor Fixo</FormLabel>
                      <FormControl>
                        <Input
                          type="currency"
                          value={field.value || 0}
                          onChange={field.onChange}
                          placeholder="R$ 0,00"
                        />
                      </FormControl>
                      <FormDescription>
                        Valor fixo em reais a ser descontado
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </CardContent>
          </Card>

          {/* Preview Calculation */}
          {grossSalary > 0 && discountPreview > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <IconCalculator className="h-5 w-5" />
                  <CardTitle className="text-lg">Prévia do Cálculo</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>Salário Bruto:</span>
                    <span>{formatCurrency(grossSalary)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tipo de Desconto:</span>
                    <span>
                      {discountType === "percentage"
                        ? `${currentPercentage}% do salário bruto`
                        : "Valor fixo"
                      }
                    </span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-semibold text-red-600">
                    <span>Desconto Calculado:</span>
                    <span>-{formatCurrency(discountPreview)}</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span>Valor Restante:</span>
                    <span>{formatCurrency(grossSalary - discountPreview)}</span>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2">
                  <IconInfo className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-blue-700">
                    <p className="font-medium">Informação:</p>
                    <p>
                      Esta é apenas uma prévia. O cálculo final considerará todos os
                      descontos aplicados na ordem definida na folha de pagamento.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3">
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                <IconX className="h-4 w-4 mr-2" />
                Cancelar
              </Button>
            )}
            <Button type="submit" disabled={isLoading}>
              <IconSave className="h-4 w-4 mr-2" />
              {isLoading
                ? "Salvando..."
                : isEditing
                ? "Salvar Alterações"
                : "Adicionar Desconto"
              }
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}