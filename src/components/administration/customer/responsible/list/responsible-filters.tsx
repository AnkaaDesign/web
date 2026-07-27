import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FilterDrawer } from "@/components/common/filters/ui/FilterDrawer";
import { Combobox } from "@/components/ui/combobox";
import type { ResponsibleGetManyFormData } from "@/types/responsible";
import {
  ResponsibleRole,
  RESPONSIBLE_ROLE_LABELS,
} from "@/types/responsible";

interface ResponsibleFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: Partial<ResponsibleGetManyFormData>;
  onFiltersChange: (filters: Partial<ResponsibleGetManyFormData>) => void;
  onClearFilters: () => void;
}

export function ResponsibleFilters({
  open,
  onOpenChange,
  filters,
  onFiltersChange,
  onClearFilters,
}: ResponsibleFiltersProps) {
  // Any-of semantics: picking Financeiro + Gestor de Frota lists every contact
  // holding either. Clearing the selection drops the key entirely so it never
  // reaches the API as an empty array.
  const handleRolesChange = (value: string | string[] | null | undefined) => {
    const selected = (Array.isArray(value) ? value : value ? [value] : []) as ResponsibleRole[];
    if (selected.length === 0) {
      const { roles: _roles, ...rest } = filters;
      onFiltersChange(rest);
    } else {
      onFiltersChange({ ...filters, roles: selected });
    }
  };

  const handleStatusChange = (value: string) => {
    if (value === "all") {
      const { isActive, ...rest } = filters;
      onFiltersChange(rest);
    } else {
      onFiltersChange({ ...filters, isActive: value === "true" });
    }
  };

  const handleClearAll = () => {
    onClearFilters();
    onOpenChange(false);
  };

  return (
    <FilterDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Filtros"
      description="Refine a lista de responsáveis usando os filtros abaixo"
      onApply={() => onOpenChange(false)}
      onReset={handleClearAll}
      applyLabel="Aplicar"
      resetLabel="Limpar filtros"
    >
          {/* Roles Filter */}
          <div className="space-y-2">
            <Label htmlFor="roles">Funções</Label>
            <Combobox
              mode="multiple"
              value={filters.roles ?? []}
              onValueChange={handleRolesChange}
              options={Object.values(ResponsibleRole).map((value) => ({
                value,
                label: RESPONSIBLE_ROLE_LABELS[value],
              }))}
              placeholder="Todas as funções"
              searchPlaceholder="Buscar função..."
              emptyText="Nenhuma função encontrada"
              minSearchLength={0}
            />
            {(filters.roles?.length ?? 0) > 0 && (
              <p className="text-xs text-muted-foreground">
                {filters.roles!.length} selecionada{filters.roles!.length === 1 ? "" : "s"}
              </p>
            )}
          </div>

          {/* Status Filter */}
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={
                filters.isActive === undefined
                  ? "all"
                  : filters.isActive
                  ? "true"
                  : "false"
              }
              onValueChange={handleStatusChange}
            >
              <SelectTrigger id="status">
                <SelectValue placeholder="Todos os status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="true">Ativos</SelectItem>
                <SelectItem value="false">Inativos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Company ID Filter (if needed) */}
          {filters.companyId && (
            <div className="space-y-2">
              <Label>Empresa</Label>
              <Input value={filters.companyId} disabled />
            </div>
          )}
    </FilterDrawer>
  );
}
