import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { type Garage } from "../../../../types";
import { type GarageCreateFormData, type GarageUpdateFormData, garageCreateSchema, garageUpdateSchema } from "../../../../schemas";
import { Button } from "@/components/ui/button";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { IconBuilding, IconFileDescription, IconRuler2, IconMapPin } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

interface GarageFormProps {
  garage?: Garage;
  onSubmit: (data: GarageCreateFormData | GarageUpdateFormData) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function GarageForm({ garage, onSubmit, onCancel, isSubmitting }: GarageFormProps) {
  const isEditing = !!garage;

  const form = useForm<GarageCreateFormData | GarageUpdateFormData>({
    resolver: zodResolver(isEditing ? garageUpdateSchema : garageCreateSchema),
    defaultValues: isEditing
      ? {
          name: garage.name,
          width: garage.width,
          length: garage.length,
          description: garage.description || "",
          location: garage.location || "",
        }
      : {
          name: "",
          width: 0,
          length: 0,
          description: "",
          location: "",
        },
    mode: "onBlur", // Validate on blur for better UX
  });

  const { isValid, errors } = form.formState;

  const handleSubmit = form.handleSubmit(async (data: GarageCreateFormData | GarageUpdateFormData) => {
    await onSubmit(data);
  });

  return (
    <FormProvider {...form}>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Garage Name */}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                <IconBuilding className="h-4 w-4 text-muted-foreground" />
                Nome da Garagem
                <span className="text-destructive">*</span>
              </FormLabel>
              <FormControl>
                <Input
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
                  placeholder="Digite o nome da garagem"
                  className={cn("transition-all duration-200 ", form.formState.errors.name && "border-destructive focus:ring-destructive/20")}
                />
              </FormControl>
              <FormMessage />
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
                    {...field}
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
              </FormItem>
            )}
          />
        </div>

        {/* Location */}
        <FormField
          control={form.control}
          name="location"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                <IconMapPin className="h-4 w-4 text-muted-foreground" />
                Localização
              </FormLabel>
              <FormControl>
                <Input
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
                  placeholder="Digite a localização da garagem (ex: Setor A, Área Industrial)"
                  className={cn("transition-all duration-200 ", form.formState.errors.location && "border-destructive focus:ring-destructive/20")}
                />
              </FormControl>
              <FormMessage />
              <p className="text-sm text-muted-foreground">Informações sobre onde a garagem está localizada</p>
            </FormItem>
          )}
        />

        {/* Description */}
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                <IconFileDescription className="h-4 w-4 text-muted-foreground" />
                Descrição
              </FormLabel>
              <FormControl>
                <Textarea
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
                  placeholder="Digite uma descrição da garagem (finalidade, características especiais, etc.)"
                  rows={3}
                  className={cn("resize-none transition-all duration-200 ", form.formState.errors.description && "border-destructive focus:ring-destructive/20")}
                />
              </FormControl>
              <FormMessage />
              <p className="text-sm text-muted-foreground">Informações adicionais sobre a garagem</p>
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
