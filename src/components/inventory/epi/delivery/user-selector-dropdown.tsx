import { useCallback } from "react";
import { getUsers } from "../../../../api-client";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import type { User } from "../../../../types";

interface UserSelectorDropdownProps {
  value?: string;
  onChange: (value: string | string[] | null | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function UserSelectorDropdown({ value, onChange, placeholder = "Selecione um funcionário", disabled = false }: UserSelectorDropdownProps) {
  // Async query function for the combobox
  // Filter by isActive: true to only show active users for EPI delivery
  const queryUsers = useCallback(async (searchTerm: string, page = 1) => {
    try {
      const queryParams: any = {
        orderBy: { name: "asc" },
        page: page,
        take: 50,
        where: {
          isActive: true
        },
        select: {
          id: true,
          name: true,
          position: {
            select: {
              id: true,
              name: true,
            },
          },
          sector: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      };

      // Only add searchingFor if there's a search term
      if (searchTerm && searchTerm.trim()) {
        queryParams.searchingFor = searchTerm.trim();
      }

      const response = await getUsers(queryParams);
      const users = response.data || [];
      const hasMore = response.meta?.hasNextPage || false;

      // Convert users to options format
      const options: ComboboxOption[] = users.map((user: User) => ({
        value: user.id,
        label: user.name,
        metadata: {
          department: user.sector?.name,
          position: user.position?.name,
        },
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

  const handleValueChange = (value: string | string[] | null | undefined) => {
    if (Array.isArray(value) || value === null) return;
    onChange(value);
  };

  return (
    <Combobox
      async={true}
      queryKey={["user-selector"]}
      queryFn={queryUsers}
      value={value}
      onValueChange={handleValueChange}
      placeholder={placeholder}
      searchPlaceholder="Buscar funcionário..."
      emptyText="Nenhum funcionário encontrado"
      disabled={disabled}
      searchable={true}
      clearable={false}
      minSearchLength={0}
      pageSize={50}
      debounceMs={300}
      renderOption={(option: ComboboxOption, isSelected: boolean) => (
        <div className="flex items-center justify-between w-full">
          <div className="flex flex-col">
            <span className="font-medium">{option.label}</span>
            {option.metadata?.department && (
              <span className={isSelected ? "text-xs text-accent-foreground/80" : "text-xs text-muted-foreground group-hover:text-white"}>
                {option.metadata.department}
              </span>
            )}
          </div>
        </div>
      )}
    />
  );
}
