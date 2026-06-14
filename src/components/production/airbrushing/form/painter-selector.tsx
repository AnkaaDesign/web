import { useCallback, useMemo } from "react";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Badge } from "@/components/ui/badge";
import { getUsers } from "@/api-client";
import { SECTOR_PRIVILEGES, CONTRACT_STATUS } from "@/constants";

interface PainterSelectorProps {
  value?: string;
  onChange?: (userId: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  loading?: boolean;
  initialUser?: { id: string; name: string; email?: string | null; currentContractStatus?: string | null };
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
        metadata: { status: initialUser.currentContractStatus ?? undefined },
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
          sector: { is: { privileges: SECTOR_PRIVILEGES.AIRBRUSHING } },
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
          status: true,
          currentContractStatus: true,
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
          metadata: { status: user.currentContractStatus },
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

  // Render painter options with a "Desligado" badge for dismissed users
  // (they stay selectable so they can still be paid, but should be visually flagged)
  const renderPainterOption = useCallback((option: ComboboxOption) => {
    const isDismissed = option.metadata?.status === CONTRACT_STATUS.TERMINATED;
    return (
      <div className="flex items-center justify-between gap-2 w-full">
        <div className="flex flex-col min-w-0">
          <span className="truncate">{option.label}</span>
          {option.description && <span className="text-xs text-muted-foreground truncate">{option.description}</span>}
        </div>
        {isDismissed && (
          <Badge variant="secondary" className="flex-shrink-0">
            Desligado
          </Badge>
        )}
      </div>
    );
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
      renderOption={renderPainterOption}
      disabled={disabled || loading}
      searchable
      clearable={!required}
      className="w-full"
    />
  );
}
