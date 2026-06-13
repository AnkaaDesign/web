import { useCallback, useEffect, useRef, useState } from "react";
import { FilterDrawer } from "@/components/common/filters/ui/FilterDrawer";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { IconFilter } from "@tabler/icons-react";
import type { MessageGetManyFormData } from "@/schemas/message";
import { getUsers } from "@/api-client/user";
import { getSectors } from "@/api-client/sector";
import { CONTRACT_STATUS } from "@/constants";

const STATUS_OPTIONS = [
  { value: "draft", label: "Rascunho" },
  { value: "active", label: "Ativa" },
  { value: "archived", label: "Arquivada" },
];

interface MessageFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: Partial<MessageGetManyFormData>;
  onFilterChange: (filters: Partial<MessageGetManyFormData>) => void;
}

export function MessageFilters({
  open,
  onOpenChange,
  filters,
  onFilterChange,
}: MessageFiltersProps) {
  const [localFilters, setLocalFilters] = useState(filters);
  // Cache resolved entities so already-selected chips render labels even before a search runs.
  const userCacheRef = useRef<Map<string, any>>(new Map());
  const sectorCacheRef = useRef<Map<string, any>>(new Map());

  useEffect(() => {
    if (open) setLocalFilters(filters);
  }, [open, filters]);

  // Async search for ACTIVE users only (excludes DISMISSED/inactive).
  const searchUsers = useCallback(
    async (search?: string, page: number = 1): Promise<{ data: any[]; hasMore: boolean }> => {
      const params: any = {
        orderBy: { name: "asc" },
        page,
        take: 50,
        // Active users only — filtered by current vínculo status.
        statuses: [CONTRACT_STATUS.ACTIVE],
      };
      if (search && search.trim()) {
        params.searchingFor = search.trim();
      }
      try {
        const response = await getUsers(params);
        const users = response.data || [];
        users.forEach((u: any) => userCacheRef.current.set(u.id, u));
        return { data: users, hasMore: response.meta?.hasNextPage || false };
      } catch {
        return { data: [], hasMore: false };
      }
    },
    [],
  );

  // Async search for sectors.
  const searchSectors = useCallback(
    async (search?: string, page: number = 1): Promise<{ data: any[]; hasMore: boolean }> => {
      const params: any = {
        orderBy: { name: "asc" },
        page,
        take: 50,
      };
      if (search && search.trim()) {
        params.searchingFor = search.trim();
      }
      try {
        const response = await getSectors(params);
        const sectors = response.data || [];
        sectors.forEach((s: any) => sectorCacheRef.current.set(s.id, s));
        return { data: sectors, hasMore: response.meta?.hasNextPage || false };
      } catch {
        return { data: [], hasMore: false };
      }
    },
    [],
  );

  const handleApply = () => {
    onFilterChange(localFilters);
    onOpenChange(false);
  };

  const handleClear = () => {
    const cleared = {};
    setLocalFilters(cleared);
    onFilterChange(cleared);
  };

  return (
    <FilterDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Filtros"
      titleIcon={<IconFilter className="h-5 w-5" />}
      description="Aplique filtros para refinar os resultados da busca"
      onApply={handleApply}
      onReset={handleClear}
      applyLabel="Aplicar Filtros"
      resetLabel="Limpar"
    >
      {/* Status Filter */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Status</Label>
        <Combobox
          mode="multiple"
          value={localFilters.status || []}
          onValueChange={(v) =>
            setLocalFilters({
              ...localFilters,
              status: Array.isArray(v) && v.length ? (v as any) : undefined,
            })
          }
          options={STATUS_OPTIONS}
          placeholder="Selecione o status"
          searchable={false}
          clearable
        />
      </div>

      {/* Recipients Filter */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Destinatários</Label>
        <Combobox<any>
          mode="multiple"
          async
          value={localFilters.recipientIds || []}
          onValueChange={(v) =>
            setLocalFilters({
              ...localFilters,
              recipientIds: Array.isArray(v) && v.length ? v : undefined,
            })
          }
          queryKey={["msg-filter-users"]}
          queryFn={searchUsers}
          minSearchLength={0}
          placeholder="Selecione os destinatários"
          emptyText="Nenhum usuário encontrado"
          clearable
          getOptionValue={(o: any) => o.id}
          getOptionLabel={(o: any) => o.name}
        />
      </div>

      {/* Sectors Filter */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Setores</Label>
        <Combobox<any>
          mode="multiple"
          async
          value={(localFilters as any).sectorIds || []}
          onValueChange={(v) =>
            setLocalFilters({
              ...localFilters,
              sectorIds: Array.isArray(v) && v.length ? v : undefined,
            } as any)
          }
          queryKey={["msg-filter-sectors"]}
          queryFn={searchSectors}
          minSearchLength={0}
          placeholder="Selecione os setores"
          emptyText="Nenhum setor encontrado"
          clearable
          getOptionValue={(o: any) => o.id}
          getOptionLabel={(o: any) => o.name}
        />
      </div>

      {/* Date Range Filter */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Período de Criação</Label>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">De</Label>
            <DateTimeInput
              mode="date"
              value={localFilters.createdAt?.gte ? new Date(localFilters.createdAt.gte) : undefined}
              onChange={(dateOrRange) => {
                const date =
                  dateOrRange && typeof dateOrRange === "object" && "from" in dateOrRange ? dateOrRange.from : dateOrRange;
                setLocalFilters((prev) => {
                  const next = { ...(prev.createdAt || {}) };
                  if (date) {
                    next.gte = (date as Date).toISOString();
                  } else {
                    delete next.gte;
                  }
                  const hasRange = next.gte || next.lte;
                  return { ...prev, createdAt: hasRange ? next : undefined };
                });
              }}
              hideLabel
              placeholder="Selecionar data inicial..."
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Até</Label>
            <DateTimeInput
              mode="date"
              value={localFilters.createdAt?.lte ? new Date(localFilters.createdAt.lte) : undefined}
              onChange={(dateOrRange) => {
                const date =
                  dateOrRange && typeof dateOrRange === "object" && "to" in dateOrRange ? dateOrRange.to : dateOrRange;
                setLocalFilters((prev) => {
                  const next = { ...(prev.createdAt || {}) };
                  if (date) {
                    next.lte = (date as Date).toISOString();
                  } else {
                    delete next.lte;
                  }
                  const hasRange = next.gte || next.lte;
                  return { ...prev, createdAt: hasRange ? next : undefined };
                });
              }}
              hideLabel
              placeholder="Selecionar data final..."
            />
          </div>
        </div>
      </div>
    </FilterDrawer>
  );
}
