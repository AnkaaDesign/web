import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { IconX } from "@tabler/icons-react";
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle>Filtros</SheetTitle>
          <SheetDescription>
            Refine a lista de responsáveis usando os filtros abaixo
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
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
        </div>

        <SheetFooter className="mt-8">
          <Button variant="outline" onClick={handleClearAll}>
            <IconX className="mr-2 h-4 w-4" />
            Limpar filtros
          </Button>
          <Button onClick={() => onOpenChange(false)}>Aplicar</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
