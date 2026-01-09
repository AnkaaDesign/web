import { useState, useMemo, useCallback } from "react";
import type { FieldValues } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { getUsers } from "../../../../api-client";
import { toast } from "@/components/ui/sonner";
import { USER_STATUS } from "../../../../constants";
import { useUserMutations } from "../../../../hooks";
import type { User } from "../../../../types";

interface UserSelectorProps<T extends FieldValues = FieldValues> {
  control: any;
  name?: string;
  label?: string;
  disabled?: boolean;
  placeholder?: string;
  required?: boolean;
  initialUser?: User;
}

export function AdminUserSelector<T extends FieldValues = FieldValues>({
  control,
  name = "userId",
  label = "Usuário",
  disabled,
  placeholder = "Selecione um usuário",
  required = false,
  initialUser,
}: UserSelectorProps<T>) {
  const [isCreating, setIsCreating] = useState(false);
  const { createAsync: createUserAsync } = useUserMutations();

  // Memoize initial options
  const initialOptions = useMemo(() => {
    if (!initialUser) return [];
    return [{
      value: initialUser.id,
      label: initialUser.name,
    }];
  }, [initialUser]);

  // Async query function for the combobox
  const queryUsers = useCallback(async (searchTerm: string, page = 1) => {
    try {
      const queryParams: any = {
        statuses: [
          USER_STATUS.EXPERIENCE_PERIOD_1,
          USER_STATUS.EXPERIENCE_PERIOD_2,
          USER_STATUS.EFFECTED
        ],
        orderBy: { name: "asc" },
        page: page,
        take: 50,
      };

      // Only add searchingFor if there's a search term
      if (searchTerm && searchTerm.trim()) {
        queryParams.searchingFor = searchTerm.trim();
      }

      const response = await getUsers(queryParams);
      const users = response.data || [];
      const hasMore = response.meta?.hasNextPage || false;

      // Convert users to options format
      const options = users.map((user) => ({
        value: user.id,
        label: user.name,
      }));

      return {
        data: options,
        hasMore: hasMore,
      };
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error fetching users:", error);
      }
      return {
        data: [],
        hasMore: false,
      };
    }
  }, []);

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
        // Return the newly created user ID
        return result.data.id;
      }
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error creating user:", error);
      }
      throw error;
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <FormField
      control={control as any}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            {label} {required && <span className="text-red-500">*</span>}
          </FormLabel>
          <FormControl>
            <Combobox
              async={true}
              queryKey={["users", "active", name]}
              queryFn={queryUsers}
              initialOptions={initialOptions}
              value={field.value || ""}
              onValueChange={field.onChange}
              placeholder={placeholder}
              emptyText="Nenhum usuário encontrado"
              disabled={disabled || isCreating}
              clearable={!required}
              searchable={true}
              allowCreate={true}
              createLabel={(value) => `Criar usuário "${value}"`}
              onCreate={async (name) => {
                const newUserId = await handleCreateUser(name);
                if (newUserId) {
                  field.onChange(newUserId);
                }
              }}
              isCreating={isCreating}
              minSearchLength={0}
              pageSize={50}
              debounceMs={300}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
