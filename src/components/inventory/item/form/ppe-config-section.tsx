import React from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { IconShieldCheck, IconCertificate, IconRuler } from "@tabler/icons-react";
import { PpeTypeSelector } from "./ppe-type-selector";
import { PpeSizeSelector } from "./ppe-size-selector";
import { PpeDeliveryModeSelector } from "./ppe-delivery-mode-selector";
import { PpeDeliveryQuantityInput } from "./ppe-delivery-quantity-input";
import { MEASURE_TYPE, MEASURE_UNIT } from "../../../../constants";
import { ppeSizeToNumeric, numericToPpeSize } from "@/utils/ppe-size-helpers";
import type { ItemCreateFormData, ItemUpdateFormData } from "../../../../schemas";

type FormData = ItemCreateFormData | ItemUpdateFormData;

interface PpeConfigSectionProps {
  disabled?: boolean;
  required?: boolean;
}

export function PpeConfigSection({ disabled, required }: PpeConfigSectionProps) {
  const form = useFormContext<FormData>();
  const { setValue, getValues } = form;

  // Watch the PPE type and measures for the configuration
  const ppeType = useWatch({
    control: form.control,
    name: "ppeType",
  });

  const measures = useWatch({
    control: form.control,
    name: "measures",
  });

  // Get current PPE size from measures array
  const getCurrentPpeSize = (): string | null => {
    if (!measures || !Array.isArray(measures)) return null;
    const sizeMeasure = measures.find((m: any) => m.measureType === MEASURE_TYPE.SIZE);
    if (!sizeMeasure) return null;

    // Check if it's a letter size (stored in unit) or numeric size (stored in value)
    if (sizeMeasure.unit && sizeMeasure.unit !== MEASURE_UNIT.UNIT) {
      // Letter size like P, M, G, GG - stored as unit
      return sizeMeasure.unit;
    } else if (sizeMeasure.value) {
      // Numeric size like 36, 38, 40 - stored as value
      return numericToPpeSize(sizeMeasure.value) || `SIZE_${sizeMeasure.value}`;
    }

    return null;
  };

  // Set PPE size by updating measures array
  const setPpeSize = (newSize: string | null) => {
    const currentMeasures = getValues("measures") || [];
    const otherMeasures = currentMeasures.filter((m: any) => m.measureType !== MEASURE_TYPE.SIZE);

    if (newSize) {
      let sizeMeasure: any = {
        measureType: MEASURE_TYPE.SIZE,
      };

      // Check if it's a letter size (P, M, G, GG, XG) or numeric size
      if (["P", "M", "G", "GG", "XG"].includes(newSize)) {
        // Letter size - store as unit, value is null
        sizeMeasure.value = null;
        sizeMeasure.unit = newSize;
      } else {
        // Numeric size - store as value, unit is null
        const numericValue = ppeSizeToNumeric(newSize);
        if (numericValue) {
          sizeMeasure.value = numericValue;
          sizeMeasure.unit = null;
        } else {
          // If not in mapping, try to extract numeric value directly
          const sizeMatch = newSize.match(/SIZE_(\d+)/);
          if (sizeMatch) {
            sizeMeasure.value = parseInt(sizeMatch[1]);
            sizeMeasure.unit = null;
          }
        }
      }

      if (sizeMeasure.value !== undefined || sizeMeasure.unit !== undefined) {
        setValue("measures", [...otherMeasures, sizeMeasure]);
      }
    } else {
      // Remove size measure
      setValue("measures", otherMeasures);
    }
  };

  // Clear size when PPE type changes
  const prevPpeTypeRef = React.useRef(ppeType);
  React.useEffect(() => {
    if (prevPpeTypeRef.current && prevPpeTypeRef.current !== ppeType) {
      // PPE type changed, clear the size
      setPpeSize(null);
    }
    prevPpeTypeRef.current = ppeType;
  }, [ppeType]);

  return (
    <Card className="bg-transparent">
      <CardHeader>
        <CardTitle>Configuração de EPI</CardTitle>
        <CardDescription>Configure as propriedades do equipamento de proteção individual (EPI)</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* CA, Type and Size - same row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* CA Input */}
            <FormField
              control={form.control}
              name="ppeCA"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <IconCertificate className="h-4 w-4" />
                    Certificado de Aprovação (CA)
                  </FormLabel>
                  <FormControl>
                    <Input
                      value={field.value || ""}
                      onChange={(value) => {
                        field.onChange(value);
                      }}
                      name={field.name}
                      onBlur={field.onBlur}
                      ref={field.ref}
                      placeholder="Digite o número do CA"
                      disabled={disabled}
                      transparent={true}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Type */}
            <PpeTypeSelector name="ppeType" disabled={disabled} required={required} />

            {/* Size */}
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                <IconRuler className="h-4 w-4" />
                Tamanho
                {/* Size is optional for OUTROS type */}
                {required && ppeType && ppeType !== "OTHERS" && <span className="text-destructive ml-1">*</span>}
              </FormLabel>
              <PpeSizeSelector
                name="__ppeSize" // Virtual field name
                ppeType={ppeType}
                disabled={disabled || !ppeType}
                required={required && ppeType !== "OTHERS"}
                value={getCurrentPpeSize()}
                onValueChange={setPpeSize}
              />
              <FormMessage />
            </FormItem>
          </div>

          {/* Delivery Configuration */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <PpeDeliveryModeSelector name="ppeDeliveryMode" disabled={disabled} required={required} />
            <PpeDeliveryQuantityInput name="ppeStandardQuantity" disabled={disabled} required={required} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
