import { useCallback } from "react";
import { getUsers } from "../../../../api-client";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Badge } from "@/components/ui/badge";
import { USER_STATUS } from "../../../../constants";
import type { User } from "../../../../types";

interface UserSelectorDropdownProps {
  value?: string;
  onChange: (value: string | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  showPosition?: boolean;
}

export function UserSelectorDropdown({ value, onChange, placeholder = "Selecione um funcionário", disabled = false, showPosition = true }: UserSelectorDropdownProps) {
  // Async query function for the combobox
  const queryUsers = useCallback(async (searchTerm: string, page = 1) => {
    try {
      const queryParams: any = {
        orderBy: { name: "asc" },
        page: page,
        take: 50,
        where: {
          status: {
            in: [
              USER_STATUS.EXPERIENCE_PERIOD_1,
              USER_STATUS.EXPERIENCE_PERIOD_2,
              USER_STATUS.CONTRACTED
            ]
          }
        },
        include: {
          position: true,
          sector: true,
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
        description: showPosition && user.position ? user.position.name : undefined,
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
      console.error("Error fetching users:", error);
      return {
        data: [],
        hasMore: false,
      };
    }
  }, [showPosition]);

  return (
    <Combobox
      async={true}
      queryKey={["user-selector"]}
      queryFn={queryUsers}
      value={value}
      onValueChange={onChange}
      placeholder={placeholder}
      searchPlaceholder="Buscar funcionário..."
      emptyText="Nenhum funcionário encontrado"
      disabled={disabled}
      searchable={true}
      clearable={false}
      minSearchLength={0}
      pageSize={50}
      debounceMs={300}
      renderOption={(option: ComboboxOption) => (
        <div className="flex items-center justify-between w-full">
          <div className="flex flex-col">
            <span className="font-medium">{option.label}</span>
            {option.metadata?.department && <span className="text-xs text-muted-foreground">{option.metadata.department}</span>}
          </div>
          {option.description && (
            <Badge variant="outline" className="text-xs">
              {option.description}
            </Badge>
          )}
        </div>
      )}
    />
  );
}
