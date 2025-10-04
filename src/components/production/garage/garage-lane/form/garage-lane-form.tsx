import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { type GarageLane } from "../../../../../types";
import { type GarageLaneCreateFormData, type GarageLaneUpdateFormData, garageLaneCreateSchema, garageLaneUpdateSchema } from "../../../../../schemas";
import { Button } from "@/components/ui/button";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { IconRoad, IconRuler2, IconMapPin } from "@tabler/icons-react";
import { GarageSelector } from "../garage-selector";
import { cn } from "@/lib/utils";

interface GarageLaneFormProps {
  garageLane?: GarageLane;
  garageId?: string; // Pre-selected garage ID
  onSubmit: (data: GarageLaneCreateFormData | GarageLaneUpdateFormData) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function GarageLaneForm({ garageLane, garageId, onSubmit, onCancel, isSubmitting }: GarageLaneFormProps) {
  const isEditing = !!garageLane;

  const form = useForm<GarageLaneCreateFormData | GarageLaneUpdateFormData>({
    resolver: zodResolver(isEditing ? garageLaneUpdateSchema : garageLaneCreateSchema),
    defaultValues: isEditing
      ? {
          garageId: garageLane.garageId,
          name: garageLane.name || "",
          width: garageLane.width,
          length: garageLane.length,
          xPosition: garageLane.xPosition,
          yPosition: garageLane.yPosition,
        }
      : {
          garageId: garageId || "",
          name: "",
          width: 0,
          length: 0,
          xPosition: 0,
          yPosition: 0,
        },
    mode: "onBlur", // Validate on blur for better UX
  });

  const { errors } = form.formState;

  const handleSubmit = form.handleSubmit(async (data: GarageLaneCreateFormData | GarageLaneUpdateFormData) => {
    await onSubmit(data);
  });

  return (
    <FormProvider {...form}>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Garage Selection */}
        <GarageSelector
          control={form.control}
          disabled={isEditing || !!garageId} // Disable if editing or garage is pre-selected
        />

        {/* Lane Name */}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                <IconRoad className="h-4 w-4 text-muted-foreground" />
                Nome da Faixa
              </FormLabel>
              <FormControl>
                <Input
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
                  placeholder="Digite o nome da faixa (opcional)"
                  className={cn("transition-all duration-200 ", form.formState.errors.name && "border-destructive focus:ring-destructive/20")}
                />
              </FormControl>
              <FormMessage />
              <p className="text-sm text-muted-foreground">Nome identificador da faixa (ex: Faixa A, Faixa Principal)</p>
            </FormItem>
          )}
        />

        {/* Dimensions Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Width */}
          <FormField
            control={form.control}
            name="width"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <IconRuler2 className="h-4 w-4 text-muted-foreground" />
                  Largura (metros)
                  <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <Input
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className={cn("transition-all duration-200 ", form.formState.errors.width && "border-destructive focus:ring-destructive/20")}
                    onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : 0)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Length */}
          <FormField
            control={form.control}
            name="length"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <IconRuler2 className="h-4 w-4 text-muted-foreground" />
                  Comprimento (metros)
                  <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <Input
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className={cn("transition-all duration-200 ", form.formState.errors.length && "border-destructive focus:ring-destructive/20")}
                    onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : 0)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Position Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* X Position */}
          <FormField
            control={form.control}
            name="xPosition"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <IconMapPin className="h-4 w-4 text-muted-foreground" />
                  Posição X (metros)
                  <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <Input
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className={cn("transition-all duration-200 ", form.formState.errors.xPosition && "border-destructive focus:ring-destructive/20")}
                    onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : 0)}
                  />
                </FormControl>
                <FormMessage />
                <p className="text-sm text-muted-foreground">Posição horizontal na garagem</p>
              </FormItem>
            )}
          />

          {/* Y Position */}
          <FormField
            control={form.control}
            name="yPosition"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <IconMapPin className="h-4 w-4 text-muted-foreground" />
                  Posição Y (metros)
                  <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <Input
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className={cn("transition-all duration-200 ", form.formState.errors.yPosition && "border-destructive focus:ring-destructive/20")}
                    onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : 0)}
                  />
                </FormControl>
                <FormMessage />
                <p className="text-sm text-muted-foreground">Posição vertical na garagem</p>
              </FormItem>
            )}
          />
        </div>

        {/* Form errors summary */}
        {Object.keys(errors).length > 0 && (
          <div className="bg-destructive/10 text-destructive rounded-lg p-3 text-sm">
            <p className="font-medium mb-1">Por favor, corrija os erros abaixo:</p>
            <ul className="list-disc list-inside space-y-1">
              {Object.entries(errors).map(([key, error]) => (
                <li key={key}>{error?.message}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting || (!form.formState.isDirty && isEditing)}>
            {isSubmitting ? "Salvando..." : isEditing ? "Atualizar" : "Criar"}
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}
