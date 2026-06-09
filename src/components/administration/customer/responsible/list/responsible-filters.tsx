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
  const handleRoleChange = (value: string) => {
    if (value === "all") {
      const { role, ...rest } = filters;
      onFiltersChange(rest);
    } else {
      onFiltersChange({ ...filters, role: value as ResponsibleRole });
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
          {/* Role Filter */}
          <div className="space-y-2">
            <Label htmlFor="role">Função</Label>
            <Select
              value={filters.role || "all"}
              onValueChange={handleRoleChange}
            >
              <SelectTrigger id="role">
                <SelectValue placeholder="Todas as funções" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as funções</SelectItem>
                {Object.entries(ResponsibleRole).map(([key, value]) => (
                  <SelectItem key={key} value={value}>
                    {RESPONSIBLE_ROLE_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
