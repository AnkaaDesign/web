import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { type ParkingSpot } from "../../../../../types";
import { type ParkingSpotCreateFormData, type ParkingSpotUpdateFormData, parkingSpotCreateSchema, parkingSpotUpdateSchema } from "../../../../../schemas";
import { Button } from "@/components/ui/button";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { IconCar, IconRuler, IconTag } from "@tabler/icons-react";
import { GarageLaneSelector } from "../garage-lane-selector";
import { cn } from "@/lib/utils";

interface ParkingSpotFormProps {
  parkingSpot?: ParkingSpot;
  garageLaneId?: string; // Pre-selected garage lane ID
  garageId?: string; // Filter lanes by garage
  onSubmit: (data: ParkingSpotCreateFormData | ParkingSpotUpdateFormData) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function ParkingSpotForm({ parkingSpot, garageLaneId, garageId, onSubmit, onCancel, isSubmitting }: ParkingSpotFormProps) {
  const isEditing = !!parkingSpot;

  const form = useForm<ParkingSpotCreateFormData | ParkingSpotUpdateFormData>({
    resolver: zodResolver(isEditing ? parkingSpotUpdateSchema : parkingSpotCreateSchema),
    defaultValues: isEditing
      ? {
          garageLaneId: parkingSpot.garageLaneId,
          name: parkingSpot.name,
          length: parkingSpot.length,
        }
      : {
          garageLaneId: garageLaneId || "",
          name: "",
          length: 0,
        },
    mode: "onBlur", // Validate on blur for better UX
  });

  const { errors } = form.formState;

  const handleSubmit = form.handleSubmit(async (data: ParkingSpotCreateFormData | ParkingSpotUpdateFormData) => {
    await onSubmit(data);
  });

  return (
    <FormProvider {...form}>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Garage Lane Selection */}
        <GarageLaneSelector
          control={form.control}
          disabled={isEditing || !!garageLaneId} // Disable if editing or lane is pre-selected
          garageId={garageId}
        />

        {/* Spot Name */}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                <IconTag className="h-4 w-4 text-muted-foreground" />
                Nome/Número da Vaga
                <span className="text-destructive">*</span>
              </FormLabel>
              <FormControl>
                <Input
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
                  placeholder="Digite o nome ou número da vaga (ex: A1, B2, Vaga 001)"
                  className={cn("transition-all duration-200 ", form.formState.errors.name && "border-destructive focus:ring-destructive/20")}
                />
              </FormControl>
              <FormMessage />
              <p className="text-sm text-muted-foreground">Identificador único da vaga dentro da faixa</p>
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
                <IconRuler className="h-4 w-4 text-muted-foreground" />
                Comprimento (metros)
                <span className="text-destructive">*</span>
              </FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  className={cn("transition-all duration-200 ", form.formState.errors.length && "border-destructive focus:ring-destructive/20")}
                  onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : 0)}
                />
              </FormControl>
              <FormMessage />
              <p className="text-sm text-muted-foreground">Comprimento da vaga para acomodar o veículo</p>
            </FormItem>
          )}
        />

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
