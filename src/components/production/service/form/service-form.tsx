import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { type Service } from "../../../../types";
import { type ServiceCreateFormData, type ServiceUpdateFormData, serviceCreateSchema, serviceUpdateSchema } from "../../../../schemas";
import { Button } from "@/components/ui/button";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { IconFileDescription } from "@tabler/icons-react";

interface ServiceFormProps {
  service?: Service;
  onSubmit: (data: ServiceCreateFormData | ServiceUpdateFormData) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function ServiceForm({ service, onSubmit, onCancel, isSubmitting }: ServiceFormProps) {
  const isEditing = !!service;

  const form = useForm<ServiceCreateFormData | ServiceUpdateFormData>({
    resolver: zodResolver(isEditing ? serviceUpdateSchema : serviceCreateSchema),
    mode: "onChange", // Enable real-time validation
    defaultValues: isEditing
      ? {
          description: service.description,
        }
      : {
          description: "",
        },
  });

  const handleSubmit = form.handleSubmit(async (data: ServiceCreateFormData | ServiceUpdateFormData) => {
    await onSubmit(data);
  });

  return (
    <FormProvider {...form}>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Service Description */}
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                <IconFileDescription className="h-4 w-4 text-muted-foreground" />
                Descrição do Serviço
                <span className="text-destructive">*</span>
              </FormLabel>
              <FormControl>
                <Textarea
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
                  placeholder="Digite a descrição detalhada do serviço"
                  rows={4}
                  className="resize-none transition-all duration-200 "
                />
              </FormControl>
              <FormMessage />
              <p className="text-sm text-muted-foreground">Esta descrição será exibida ao selecionar serviços para uma tarefa</p>
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting || !form.formState.isValid}>
            {isSubmitting ? "Salvando..." : isEditing ? "Atualizar" : "Criar"}
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}
