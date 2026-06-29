import { useCallback, useMemo } from "react";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { getUsers } from "@/api-client";
import { CONTRACT_STATUS } from "@/constants";

interface UserSelectorProps {
  value?: string;
  onChange?: (userId: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  showEmail?: boolean;
  loading?: boolean;
  initialUser?: { id: string; name: string; email?: string };
  /**
   * Extra `where` conditions merged into the user query (e.g. restrict to CLT
   * for payroll/bonus). Omit to keep the default "any active account" behaviour
   * used by stock/message selectors.
   */
  additionalWhere?: Record<string, unknown>;
}

/**
 * A controlled component for selecting a user.
 * Used in forms where a user needs to be selected from an async dropdown.
 *
 * @example
 * ```tsx
 * <UserSelector
 *   value={selectedUserId}
 *   onChange={setSelectedUserId}
 *   placeholder="Select a user"
 * />
 * ```
 */
export function UserSelector({
  value,
  onChange,
  placeholder = "Selecione um usuário",
  disabled = false,
  required = false,
  showEmail = false,
  loading = false,
  initialUser,
  additionalWhere,
}: UserSelectorProps) {
  // Stable key fragment so different filters (e.g. CLT-only) cache separately.
  const whereKey = useMemo(() => (additionalWhere ? JSON.stringify(additionalWhere) : ""), [additionalWhere]);
  // Memoize initial options
  const initialOptions = useMemo<ComboboxOption[]>(() => {
    if (!initialUser) return [];
    return [{
      value: initialUser.id,
      label: showEmail && initialUser.email ? `${initialUser.name} (${initialUser.email})` : initialUser.name,
      description: initialUser.email,
    }];
  }, [initialUser, showEmail]);

  // Async query function to fetch users
  const queryUsers = useCallback(async (searchTerm: string, page = 1) => {
    try {
      const pageSize = 50;
      const response = await getUsers({
        take: pageSize,
        skip: (page - 1) * pageSize,
        where: {
          currentContractStatus: CONTRACT_STATUS.ACTIVE,
          ...additionalWhere,
          ...(searchTerm ? {
            OR: [
              { name: { contains: searchTerm, mode: "insensitive" } },
              { email: { contains: searchTerm, mode: "insensitive" } },
              { cpf: { contains: searchTerm } },
            ],
          } : {}),
        },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          email: true,
        },
      });

      const users = response.data || [];
      const total = response.meta?.totalRecords || 0;
      const hasMore = (page * pageSize) < total;

      return {
        data: users.map((user) => ({
          value: user.id,
          label: showEmail && user.email ? `${user.name} (${user.email})` : user.name,
          description: user.email,
        })) as ComboboxOption[],
        hasMore,
        total,
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
  }, [showEmail, additionalWhere]);

  return (
    <Combobox
      async
      queryKey={["users", "selector", showEmail ? "with-email" : "name-only", whereKey]}
      queryFn={queryUsers}
      initialOptions={initialOptions}
      minSearchLength={0}
      pageSize={50}
      debounceMs={300}
      value={value}
      onValueChange={(newValue) => {
        // Handle both string and string[] cases, though we only use single mode
        const selectedValue = Array.isArray(newValue) ? newValue[0] : newValue;
        onChange?.(selectedValue === undefined ? null : (selectedValue || null));
      }}
      placeholder={`${placeholder}${!required ? " (opcional)" : ""}`}
      emptyText={loading ? "Carregando usuários..." : "Nenhum usuário encontrado"}
      disabled={disabled || loading}
      searchable
      clearable={!required}
      className="w-full"
    />
  );
}
