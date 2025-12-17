import { useFormContext } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getEconomicActivities, createEconomicActivity } from "@/api-client/economic-activity";
import { toast } from "sonner";
import type { CustomerCreateFormData, CustomerUpdateFormData } from "@/schemas/customer";

export function EconomicActivitySelect() {
  const form = useFormContext<CustomerCreateFormData | CustomerUpdateFormData>();
  const queryClient = useQueryClient();

  const { mutateAsync: createActivity, isPending: isCreating } = useMutation({
    mutationFn: createEconomicActivity,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["economic-activities"] });
    },
    onError: (error: any) => {
      console.error("Error creating economic activity:", error);
    },
  });

  const handleCreate = async (searchTerm: string) => {
    try {
      // Parse CNAE code from search term (format: "1234-5/67 - Description")
      const codeMatch = searchTerm.match(/^(\d{4}-?\d\/?\d{2})/);
      const code = codeMatch ? codeMatch[1].replace(/[^\d]/g, "") : searchTerm;

      const result = await createActivity({
        code: code,
        description: searchTerm,
      });

      form.setValue("economicActivityId", result.data.id, { shouldDirty: true, shouldValidate: true });
    } catch (error) {
      // Error handled by mutation
    }
  };

  return (
    <FormField
      control={form.control}
      name="economicActivityId"
      render={({ field }) => (
        <FormItem>
          <FormLabel>CNAE (Atividade Econômica)</FormLabel>
          <Combobox
            value={field.value || undefined}
            onValueChange={field.onChange}
            async
            queryKey={["economic-activities"]}
            queryFn={async (searchTerm: string) => {
              const response = await getEconomicActivities({
                where: searchTerm
                  ? {
                      OR: [
                        { code: { contains: searchTerm } },
                        { description: { contains: searchTerm, mode: "insensitive" } },
                      ],
                    }
                  : undefined,
                take: 20,
                orderBy: { code: "asc" },
              });

              return {
                data: response.data.map((activity) => ({
                  value: activity.id,
                  label: `${activity.code} - ${activity.description}`,
                  metadata: activity,
                })),
                hasMore: false,
              };
            }}
            allowCreate
            onCreate={handleCreate}
            createLabel={(value) => `Criar CNAE "${value}"`}
            isCreating={isCreating}
            placeholder="Buscar por código ou descrição"
            searchPlaceholder="Digite o código ou descrição..."
            emptyText="Nenhuma atividade encontrada"
            minSearchLength={0}
            searchable={true}
            clearable={true}
          />
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
