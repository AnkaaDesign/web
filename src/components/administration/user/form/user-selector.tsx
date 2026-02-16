import { useState, useMemo, useCallback } from "react";
import type { FieldValues } from "react-hook-form";
import { useWatch } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { getUsers, getUserById } from "../../../../api-client";
import { USER_STATUS, SECTOR_PRIVILEGES } from "../../../../constants";
import { useUserMutations } from "../../../../hooks";
import type { User } from "../../../../types";

interface UserSelectorProps<_T extends FieldValues = FieldValues> {
  control: any;
  name?: string;
  label?: string;
  disabled?: boolean;
  placeholder?: string;
  required?: boolean;
  initialUser?: User;
  /** Exclude users from sectors with these privileges */
  excludeSectorPrivileges?: SECTOR_PRIVILEGES[];
  /** Only include users from sectors with these privileges */
  includeSectorPrivileges?: SECTOR_PRIVILEGES[];
}

export function AdminUserSelector<_T extends FieldValues = FieldValues>({
  control,
  name = "userId",
  label = "Usuário",
  disabled,
  placeholder = "Selecione um usuário",
  required = false,
  initialUser,
  excludeSectorPrivileges,
  includeSectorPrivileges,
}: UserSelectorProps<_T>) {
  const [isCreating, setIsCreating] = useState(false);
  const { createAsync: createUserAsync } = useUserMutations();

  // Watch selected user ID from form state - persists across accordion unmount/remount
  const selectedUserId = useWatch({ control, name }) as string | undefined;

  // Fetch selected user details by ID - React Query cache persists across unmount/remount
  const { data: selectedUserData } = useQuery({
    queryKey: ["users", "selected-detail", selectedUserId],
    queryFn: async () => {
      if (!selectedUserId) return null;
      const response = await getUserById(selectedUserId, {
        select: { id: true, name: true },
      } as any);
      return response.data || null;
    },
    enabled: !!selectedUserId && selectedUserId !== initialUser?.id,
    staleTime: 5 * 60 * 1000,
  });

  // Memoize initial options - include selected user data for accordion remount scenarios
  const initialOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [];
    if (initialUser) {
      options.push({ value: initialUser.id, label: initialUser.name });
    }
    if (selectedUserData && selectedUserData.id !== initialUser?.id) {
      options.push({ value: selectedUserData.id, label: selectedUserData.name });
    }
    return options;
  }, [initialUser, selectedUserData?.id]);

  // Async query function for the combobox
  // Filter by isActive: true and specific statuses for admin user selection
  const queryUsers = useCallback(async (searchTerm: string, page = 1) => {
    try {
      const queryParams: any = {
        where: { isActive: true },
        statuses: [
          USER_STATUS.EXPERIENCE_PERIOD_1,
          USER_STATUS.EXPERIENCE_PERIOD_2,
          USER_STATUS.EFFECTED
        ],
        orderBy: { name: "asc" },
        page: page,
        take: 50,
        select: {
          id: true,
          name: true,
        },
      };

      // Only add searchingFor if there's a search term
      if (searchTerm && searchTerm.trim()) {
        queryParams.searchingFor = searchTerm.trim();
      }

      // Add sector privilege filters if provided
      if (excludeSectorPrivileges && excludeSectorPrivileges.length > 0) {
        queryParams.excludeSectorPrivileges = excludeSectorPrivileges;
      }
      if (includeSectorPrivileges && includeSectorPrivileges.length > 0) {
        queryParams.includeSectorPrivileges = includeSectorPrivileges;
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
  }, [excludeSectorPrivileges, includeSectorPrivileges]);

  const handleCreateUser = async (name: string) => {
    setIsCreating(true);
    try {
      const result = await createUserAsync({
        name,
        birth: new Date(), // Required field - set to current date by default
        status: USER_STATUS.EXPERIENCE_PERIOD_1,
        verified: false,
        performanceLevel: 0,
        isActive: true,
        isSectorLeader: false, // Required field
        email: null,
        phone: null,
        cpf: null,
        positionId: null,
        sectorId: null,
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
        <FormItem className="space-y-1">
          {label && (
            <FormLabel>
              {label} {required && <span className="text-red-500">*</span>}
            </FormLabel>
          )}
          <FormControl>
            <Combobox
              async={true}
              queryKey={["users", "active", name, excludeSectorPrivileges?.join(",") ?? "", includeSectorPrivileges?.join(",") ?? ""]}
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
              className="w-full"
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
