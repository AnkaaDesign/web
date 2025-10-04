import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { MEASURE_UNIT, MEASURE_TYPE } from "../../constants";
import { MeasureInput } from "./measure-input";
import { MeasureDisplay } from "./measure-display";
import { UnitConverter } from "./unit-converter";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "./form";
import { Button } from "./button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./card";
import { Separator } from "./separator";

// Example form schema using measure inputs
const measureFormSchema = z.object({
  weight: z.object({
    value: z.number().positive("Peso deve ser positivo"),
    unit: z.nativeEnum(MEASURE_UNIT),
    measureType: z.nativeEnum(MEASURE_TYPE),
  }),
  dimensions: z.object({
    length: z.object({
      value: z.number().positive("Comprimento deve ser positivo"),
      unit: z.nativeEnum(MEASURE_UNIT),
      measureType: z.nativeEnum(MEASURE_TYPE),
    }),
    width: z.object({
      value: z.number().positive("Largura deve ser positiva"),
      unit: z.nativeEnum(MEASURE_UNIT),
      measureType: z.nativeEnum(MEASURE_TYPE),
    }),
    height: z.object({
      value: z.number().positive("Altura deve ser positiva"),
      unit: z.nativeEnum(MEASURE_UNIT),
      measureType: z.nativeEnum(MEASURE_TYPE),
    }),
  }),
  volume: z
    .object({
      value: z.number().positive("Volume deve ser positivo"),
      unit: z.nativeEnum(MEASURE_UNIT),
      measureType: z.nativeEnum(MEASURE_TYPE),
    })
    .optional(),
  quantity: z.object({
    value: z.number().positive("Quantidade deve ser positiva"),
    unit: z.nativeEnum(MEASURE_UNIT),
    measureType: z.nativeEnum(MEASURE_TYPE),
  }),
});

type MeasureFormData = z.infer<typeof measureFormSchema>;

interface MeasureFormProps {
  onSubmit?: (data: MeasureFormData) => void;
  defaultValues?: Partial<MeasureFormData>;
  className?: string;
  showConverter?: boolean;
}

export function MeasureForm({ onSubmit, defaultValues, className, showConverter = true }: MeasureFormProps) {
  const form = useForm<MeasureFormData>({
    resolver: zodResolver(measureFormSchema),
    defaultValues: {
      weight: {
        value: 1,
        unit: MEASURE_UNIT.KILOGRAM,
        measureType: MEASURE_TYPE.WEIGHT,
      },
      dimensions: {
        length: {
          value: 100,
          unit: MEASURE_UNIT.CENTIMETER,
          measureType: MEASURE_TYPE.LENGTH,
        },
        width: {
          value: 50,
          unit: MEASURE_UNIT.CENTIMETER,
          measureType: MEASURE_TYPE.LENGTH,
        },
        height: {
          value: 30,
          unit: MEASURE_UNIT.CENTIMETER,
          measureType: MEASURE_TYPE.LENGTH,
        },
      },
      volume: {
        value: 1,
        unit: MEASURE_UNIT.LITER,
        measureType: MEASURE_TYPE.VOLUME,
      },
      quantity: {
        value: 10,
        unit: MEASURE_UNIT.UNIT,
        measureType: MEASURE_TYPE.COUNT,
      },
      ...defaultValues,
    },
  });

  const handleSubmit = (data: MeasureFormData) => {
    onSubmit?.(data);
  };

  const watchedValues = form.watch();

  return (
    <div className={className}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          {/* Weight Section */}
          <Card>
            <CardHeader>
              <CardTitle>Peso</CardTitle>
              <CardDescription>Especifique o peso do item</CardDescription>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="weight"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Peso</FormLabel>
                    <FormControl>
                      <MeasureInput
                        value={field.value.value}
                        unit={field.value.unit}
                        measureType={field.value.measureType}
                        onChange={(measureValue) => field.onChange(measureValue)}
                        placeholder="Digite o peso"
                        showConversion
                        convertTo={MEASURE_UNIT.GRAM}
                        filterUnits={[MEASURE_UNIT.GRAM, MEASURE_UNIT.KILOGRAM]}
                      />
                    </FormControl>
                    <FormDescription>O peso será usado para cálculos de frete e estoque</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Display current weight value */}
              <div className="mt-4">
                <MeasureDisplay
                  value={watchedValues.weight.value}
                  unit={watchedValues.weight.unit}
                  measureType={watchedValues.weight.measureType}
                  showIcon
                  showConversions
                  conversionsTo={[MEASURE_UNIT.GRAM, MEASURE_UNIT.KILOGRAM]}
                  showTooltip
                />
              </div>
            </CardContent>
          </Card>

          {/* Dimensions Section */}
          <Card>
            <CardHeader>
              <CardTitle>Dimensões</CardTitle>
              <CardDescription>Especifique as dimensões do item (comprimento x largura x altura)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Length */}
                <FormField
                  control={form.control}
                  name="dimensions.length"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Comprimento</FormLabel>
                      <FormControl>
                        <MeasureInput
                          value={field.value.value}
                          unit={field.value.unit}
                          measureType={field.value.measureType}
                          onChange={(measureValue) => field.onChange(measureValue)}
                          placeholder="Comprimento"
                          filterUnits={[MEASURE_UNIT.MILLIMETER, MEASURE_UNIT.CENTIMETER, MEASURE_UNIT.METER]}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Width */}
                <FormField
                  control={form.control}
                  name="dimensions.width"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Largura</FormLabel>
                      <FormControl>
                        <MeasureInput
                          value={field.value.value}
                          unit={field.value.unit}
                          measureType={field.value.measureType}
                          onChange={(measureValue) => field.onChange(measureValue)}
                          placeholder="Largura"
                          filterUnits={[MEASURE_UNIT.MILLIMETER, MEASURE_UNIT.CENTIMETER, MEASURE_UNIT.METER]}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Height */}
                <FormField
                  control={form.control}
                  name="dimensions.height"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Altura</FormLabel>
                      <FormControl>
                        <MeasureInput
                          value={field.value.value}
                          unit={field.value.unit}
                          measureType={field.value.measureType}
                          onChange={(measureValue) => field.onChange(measureValue)}
                          placeholder="Altura"
                          filterUnits={[MEASURE_UNIT.MILLIMETER, MEASURE_UNIT.CENTIMETER, MEASURE_UNIT.METER]}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Display dimensions summary */}
              <div className="flex flex-wrap gap-2 p-3 bg-muted rounded-lg">
                <MeasureDisplay value={watchedValues.dimensions.length.value} unit={watchedValues.dimensions.length.unit} variant="badge" prefix="C:" />
                <span className="text-muted-foreground">×</span>
                <MeasureDisplay value={watchedValues.dimensions.width.value} unit={watchedValues.dimensions.width.unit} variant="badge" prefix="L:" />
                <span className="text-muted-foreground">×</span>
                <MeasureDisplay value={watchedValues.dimensions.height.value} unit={watchedValues.dimensions.height.unit} variant="badge" prefix="A:" />
              </div>
            </CardContent>
          </Card>

          {/* Volume Section */}
          <Card>
            <CardHeader>
              <CardTitle>Volume</CardTitle>
              <CardDescription>Volume do item (opcional - pode ser calculado automaticamente)</CardDescription>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="volume"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Volume</FormLabel>
                    <FormControl>
                      <MeasureInput
                        value={field.value?.value}
                        unit={field.value?.unit || MEASURE_UNIT.LITER}
                        measureType={field.value?.measureType || MEASURE_TYPE.VOLUME}
                        onChange={(measureValue) => field.onChange(measureValue)}
                        placeholder="Digite o volume"
                        showConversion
                        convertTo={MEASURE_UNIT.MILLILITER}
                        filterUnits={[MEASURE_UNIT.MILLILITER, MEASURE_UNIT.LITER]}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Quantity Section */}
          <Card>
            <CardHeader>
              <CardTitle>Quantidade</CardTitle>
              <CardDescription>Quantidade em estoque ou para processamento</CardDescription>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantidade</FormLabel>
                    <FormControl>
                      <MeasureInput
                        value={field.value.value}
                        unit={field.value.unit}
                        measureType={field.value.measureType}
                        onChange={(measureValue) => field.onChange(measureValue)}
                        placeholder="Digite a quantidade"
                        decimals={0}
                        step={1}
                        filterUnits={[MEASURE_UNIT.UNIT, MEASURE_UNIT.PAIR, MEASURE_UNIT.DOZEN, MEASURE_UNIT.HUNDRED, MEASURE_UNIT.PACKAGE, MEASURE_UNIT.BOX]}
                      />
                    </FormControl>
                    <FormDescription>Especifique a quantidade e unidade de medida</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Unit Converter */}
          {showConverter && (
            <>
              <Separator />
              <UnitConverter title="Conversor de Unidades" showCopyButton showHistory compact={false} />
            </>
          )}

          {/* Submit Button */}
          <div className="flex justify-end">
            <Button type="submit">Salvar Medidas</Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

// Example usage hook
export function useMeasureFormExample() {
  const handleSubmit = (data: MeasureFormData) => {
    // Example: Convert all measurements to standard units
    const standardizedData = {
      weightInKg: data.weight.unit === MEASURE_UNIT.KILOGRAM ? data.weight.value : data.weight.value / 1000,

      dimensionsInCm: {
        length:
          data.dimensions.length.unit === MEASURE_UNIT.CENTIMETER
            ? data.dimensions.length.value
            : data.dimensions.length.unit === MEASURE_UNIT.METER
              ? data.dimensions.length.value * 100
              : data.dimensions.length.value / 10,

        width:
          data.dimensions.width.unit === MEASURE_UNIT.CENTIMETER
            ? data.dimensions.width.value
            : data.dimensions.width.unit === MEASURE_UNIT.METER
              ? data.dimensions.width.value * 100
              : data.dimensions.width.value / 10,

        height:
          data.dimensions.height.unit === MEASURE_UNIT.CENTIMETER
            ? data.dimensions.height.value
            : data.dimensions.height.unit === MEASURE_UNIT.METER
              ? data.dimensions.height.value * 100
              : data.dimensions.height.value / 10,
      },

      volumeInLiters: data.volume?.unit === MEASURE_UNIT.LITER ? data.volume.value : data.volume?.value ? data.volume.value / 1000 : undefined,

      quantityInUnits:
        data.quantity.unit === MEASURE_UNIT.UNIT
          ? data.quantity.value
          : data.quantity.unit === MEASURE_UNIT.PAIR
            ? data.quantity.value * 2
            : data.quantity.unit === MEASURE_UNIT.DOZEN
              ? data.quantity.value * 12
              : data.quantity.value,
    };

    return standardizedData;
  };

  return { handleSubmit };
}
