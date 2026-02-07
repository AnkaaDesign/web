import React from "react";
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
import type { RepresentativeGetManyFormData } from "@/types/representative";
import {
  RepresentativeRole,
  REPRESENTATIVE_ROLE_LABELS,
} from "@/types/representative";

interface RepresentativeFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: Partial<RepresentativeGetManyFormData>;
  onFiltersChange: (filters: Partial<RepresentativeGetManyFormData>) => void;
  onClearFilters: () => void;
}

export function RepresentativeFilters({
  open,
  onOpenChange,
  filters,
  onFiltersChange,
  onClearFilters,
}: RepresentativeFiltersProps) {
  const handleRoleChange = (value: string) => {
    if (value === "all") {
      const { role, ...rest } = filters;
      onFiltersChange(rest);
    } else {
      onFiltersChange({ ...filters, role: value as RepresentativeRole });
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
            Refine a lista de representantes usando os filtros abaixo
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
                {Object.entries(RepresentativeRole).map(([key, value]) => (
                  <SelectItem key={key} value={value}>
                    {REPRESENTATIVE_ROLE_LABELS[value]}
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

          {/* Customer ID Filter (if needed) */}
          {filters.customerId && (
            <div className="space-y-2">
              <Label>Cliente</Label>
              <Input value={filters.customerId} disabled />
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