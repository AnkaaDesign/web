import { useState } from "react";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { useUsers, useUserMutations } from "../../../../hooks";
import { toast } from "@/components/ui/sonner";
import { USER_STATUS } from "../../../../constants";

interface UserSelectorProps<T extends FieldValues = FieldValues> {
  control: any;
  name?: string;
  label?: string;
  disabled?: boolean;
  placeholder?: string;
  required?: boolean;
}

export function AdminUserSelector<T extends FieldValues = FieldValues>({ 
  control, 
  name = "userId",
  label = "Usuário",
  disabled,
  placeholder = "Selecione um usuário",
  required = false
}: UserSelectorProps<T>) {
  const [isCreating, setIsCreating] = useState(false);

  const {
    data: users,
    isLoading,
    refetch,
  } = useUsers({
    statuses: [
      USER_STATUS.EXPERIENCE_PERIOD_1,
      USER_STATUS.EXPERIENCE_PERIOD_2,
      USER_STATUS.CONTRACTED
    ],
    orderBy: { name: "asc" },
    take: 100,
  });

  const { createAsync: createUserAsync } = useUserMutations();

  const userOptions =
    users?.data?.map((user) => ({
      value: user.id,
      label: user.name,
    })) || [];

  const handleCreateUser = async (name: string) => {
    setIsCreating(true);
    try {
      const result = await createUserAsync({
        name,
        status: USER_STATUS.EXPERIENCE_PERIOD_1,
        verified: false,
        performanceLevel: 0,
      });

      if (result.success && result.data) {
        toast.success("Usuário criado", `O usuário "${name}" foi criado com sucesso. Complete as informações restantes posteriormente.`);

        // Refetch users to update the list
        await refetch();

        // Return the newly created user ID
        return result.data.id;
      }
    } catch (error) {
      toast.error("Erro ao criar usuário", "Não foi possível criar o usuário. Tente novamente.");
      throw error;
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <FormField
      control={control as any>}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            {label} {required && <span className="text-red-500">*</span>}
          </FormLabel>
          <FormControl>
            <Combobox
              value={field.value || ""}
              onValueChange={field.onChange}
              options={userOptions}
              placeholder={placeholder}
              emptyText="Nenhum usuário encontrado"
              disabled={disabled || isLoading || isCreating}
              allowCreate={true}
              createLabel={(value) => `Criar usuário "${value}"`}
              onCreate={async (name) => {
                const newUserId = await handleCreateUser(name);
                if (newUserId) {
                  field.onChange(newUserId);
                }
              }}
              isCreating={isCreating}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}