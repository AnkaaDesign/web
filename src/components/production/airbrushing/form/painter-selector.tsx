import { useCallback, useMemo } from "react";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { getUsers } from "@/api-client";
import { SECTOR_PRIVILEGES } from "@/constants";

interface PainterSelectorProps {
  value?: string;
  onChange?: (userId: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  loading?: boolean;
  initialUser?: { id: string; name: string; email?: string | null };
}

/**
 * A controlled component for selecting an airbrushing painter.
 *
 * Painters are users whose sector has the AIRBRUSHING privilege.
 * They are usually third-party workers (often DISMISSED users), so this
 * selector intentionally does NOT filter by status/isActive.
 */
export function PainterSelector({
  value,
  onChange,
  placeholder = "Selecione o pintor",
  disabled = false,
  required = false,
  loading = false,
  initialUser,
}: PainterSelectorProps) {
  // Memoize initial options (used to display the current painter on edit forms)
  const initialOptions = useMemo<ComboboxOption[]>(() => {
    if (!initialUser) return [];
    return [
      {
        value: initialUser.id,
        label: initialUser.name,
        description: initialUser.email ?? undefined,
      },
    ];
  }, [initialUser]);

  // Async query function to fetch painters (users in sectors with AIRBRUSHING privilege)
  const queryPainters = useCallback(async (searchTerm: string, page = 1) => {
    try {
      const pageSize = 50;
      const response = await getUsers({
        take: pageSize,
        skip: (page - 1) * pageSize,
        where: {
          // Painters belong to sectors with the AIRBRUSHING privilege.
          // Do NOT filter by status/isActive: painters are usually dismissed users.
          sector: { privileges: SECTOR_PRIVILEGES.AIRBRUSHING },
          ...(searchTerm
            ? {
                OR: [
                  { name: { contains: searchTerm, mode: "insensitive" } },
                  { email: { contains: searchTerm, mode: "insensitive" } },
                  { cpf: { contains: searchTerm } },
                ],
              }
            : {}),
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
      const hasMore = page * pageSize < total;

      return {
        data: users.map((user) => ({
          value: user.id,
          label: user.name,
          description: user.email,
        })) as ComboboxOption[],
        hasMore,
        total,
      };
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Error fetching painters:", error);
      }
      return {
        data: [],
        hasMore: false,
      };
    }
  }, []);

  return (
    <Combobox
      async
      queryKey={["users", "painter-selector"]}
      queryFn={queryPainters}
      initialOptions={initialOptions}
      minSearchLength={0}
      pageSize={50}
      debounceMs={300}
      value={value}
      onValueChange={(newValue) => {
        // Handle both string and string[] cases, though we only use single mode
        const selectedValue = Array.isArray(newValue) ? newValue[0] : newValue;
        onChange?.(selectedValue === undefined ? null : selectedValue || null);
      }}
      placeholder={`${placeholder}${!required ? " (opcional)" : ""}`}
      emptyText={loading ? "Carregando pintores..." : "Nenhum pintor encontrado"}
      disabled={disabled || loading}
      searchable
      clearable={!required}
      className="w-full"
    />
  );
}
