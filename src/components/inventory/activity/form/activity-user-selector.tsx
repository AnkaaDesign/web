import { useMemo } from "react";
import type { User } from "../../../../types";
import { USER_STATUS } from "../../../../constants";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { cn } from "@/lib/utils";

interface ActivityUserSelectorProps {
  value?: string;
  onChange: (value: string | undefined) => void;
  users: User[];
  placeholder?: string;
  size?: "default" | "sm";
  className?: string;
  disabled?: boolean;
}

export const ActivityUserSelector = ({
  value,
  onChange,
  users,
  placeholder = "Selecione um usuário",
  size = "default",
  className,
  disabled = false,
}: ActivityUserSelectorProps) => {
  // Filter and sort users: contracted/experience period first, then by name
  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      // Active users (contracted or experience period) first
      const aIsActive = a.status === USER_STATUS.CONTRACTED ||
                        a.status === USER_STATUS.EXPERIENCE_PERIOD_1 ||
                        a.status === USER_STATUS.EXPERIENCE_PERIOD_2;
      const bIsActive = b.status === USER_STATUS.CONTRACTED ||
                        b.status === USER_STATUS.EXPERIENCE_PERIOD_1 ||
                        b.status === USER_STATUS.EXPERIENCE_PERIOD_2;

      if (aIsActive && !bIsActive) {
        return -1;
      }
      if (!aIsActive && bIsActive) {
        return 1;
      }
      // Then sort by name
      return a.name.localeCompare(b.name, "pt-BR");
    });
  }, [users]);

  // Convert users to ComboboxOption format with enhanced labels
  const options: ComboboxOption[] = useMemo(() => {
    return sortedUsers.map((user) => {
      const parts = [user.name];

      // Add sector if available
      if (user.sector?.name) {
        parts.push(user.sector.name);
      }

      // Add status indicator for dismissed users
      if (user.status === USER_STATUS.DISMISSED) {
        parts.push("(Desligado)");
      }

      return {
        value: user.id,
        label: parts.join(" - "),
      };
    });
  }, [sortedUsers]);

  return (
    <Combobox
      options={options}
      value={value}
      onValueChange={onChange}
      placeholder={placeholder}
      emptyText="Nenhum usuário encontrado"
      searchable={true}
      disabled={disabled}
      className={cn(
        // Ensure consistent height and alignment with other form controls
        size === "sm" ? "h-8" : "h-10",
        // Add consistent focus and hover states to match Select component
        "transition-all",
        className,
      )}
    />
  );
};
