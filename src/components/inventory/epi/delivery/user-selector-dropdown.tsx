import { useUsers } from "../../../../hooks";
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
  // Fetch active users (experience period and contracted)
  const { data: usersResponse, isLoading } = useUsers({
    statuses: [
      USER_STATUS.EXPERIENCE_PERIOD_1,
      USER_STATUS.EXPERIENCE_PERIOD_2,
      USER_STATUS.CONTRACTED
    ],
    include: {
      position: true,
      sector: true,
    },
    take: 100, // Increased limit since we're doing client-side filtering
  });

  const users = usersResponse?.data || [];

  // Format users for combobox
  const options: ComboboxOption[] = users.map((user: User) => ({
    value: user.id,
    label: user.name,
    description: showPosition && user.position ? user.position.name : undefined,
    metadata: {
      department: user.sector?.name,
      position: user.position?.name,
    },
  }));

  return (
    <Combobox
      options={options}
      value={value}
      onValueChange={onChange}
      placeholder={placeholder}
      searchPlaceholder="Buscar funcionário..."
      emptyText="Nenhum funcionário encontrado"
      disabled={disabled || isLoading}
      searchable={true}
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
      clearable={false}
    />
  );
}
