import { useMemo, useCallback } from "react";
import type { User } from "../../../../types";
import { USER_STATUS } from "../../../../constants";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { cn } from "@/lib/utils";
import { getUsers } from "../../../../api-client";

interface ActivityUserSelectorProps {
  value?: string;
  onChange: (value: string | undefined) => void;
  users?: User[];
  placeholder?: string;
  size?: "default" | "sm";
  className?: string;
  disabled?: boolean;
  initialUser?: User;
}

export const ActivityUserSelector = ({
  value,
  onChange,
  users,
  placeholder = "Selecione um usuário",
  size = "default",
  className,
  disabled = false,
  initialUser,
}: ActivityUserSelectorProps) => {
  // Memoize initialOptions with stable dependency
  const initialOptions = useMemo(() => {
    if (!initialUser) return [];

    const parts = [initialUser.name];
    if (initialUser.sector?.name) {
      parts.push(initialUser.sector.name);
    }
    if (initialUser.status === USER_STATUS.DISMISSED) {
      parts.push("(Desligado)");
    }

    return [{
      value: initialUser.id,
      label: parts.join(" - "),
    }];
  }, [initialUser?.id]);

  // Async query function for Combobox with pagination
  const queryFn = useCallback(async (searchTerm: string, page: number = 1) => {
    const pageSize = 50;
    const response = await getUsers({
      take: pageSize,
      skip: (page - 1) * pageSize,
      where: {
        isActive: true,
        ...(searchTerm ? {
          OR: [
            { name: { contains: searchTerm, mode: "insensitive" } },
            { email: { contains: searchTerm, mode: "insensitive" } },
          ],
        } : {}),
      },
      orderBy: [
        { status: "asc" }, // Active users first
        { name: "asc" },
      ],
      include: {
        sector: true,
      },
    });

    const usersData = response.data || [];
    const total = response.total || 0;
    const hasMore = (page * pageSize) < total;

    return {
      data: usersData.map((user) => {
        const parts = [user.name];
        if (user.sector?.name) {
          parts.push(user.sector.name);
        }
        if (user.status === USER_STATUS.DISMISSED) {
          parts.push("(Desligado)");
        }

        return {
          value: user.id,
          label: parts.join(" - "),
        };
      }),
      hasMore,
      total,
    };
  }, []);

  return (
    <Combobox
      async
      queryKey={["users", "activity-selector"]}
      queryFn={queryFn}
      initialOptions={initialOptions}
      minSearchLength={0}
      pageSize={50}
      debounceMs={300}
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
