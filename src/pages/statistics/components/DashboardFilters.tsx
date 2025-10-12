/**
 * Dashboard Filters Component
 *
 * Global filters sidebar for dashboard with:
 * - Date range filter
 * - Sector filter
 * - Status filters
 * - Quick presets
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IconFilter, IconX } from "@tabler/icons-react";
import { getDateRangePresets } from "../utils/dashboard-helpers";

export interface DashboardFiltersProps {
  onApplyFilters?: (filters: DashboardFilterValues) => void;
  onClearFilters?: () => void;
}

export interface DashboardFilterValues {
  dateRange?: string;
  sector?: string;
  status?: string;
}

/**
 * Dashboard Filters Component
 */
export function DashboardFilters({
  onApplyFilters,
  onClearFilters,
}: DashboardFiltersProps) {
  const [filters, setFilters] = useState<DashboardFilterValues>({
    dateRange: "last30days",
  });

  const dateRangePresets = getDateRangePresets();

  const handleFilterChange = (key: keyof DashboardFilterValues, value: string) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
  };

  const handleApply = () => {
    onApplyFilters?.(filters);
  };

  const handleClear = () => {
    setFilters({ dateRange: "last30days" });
    onClearFilters?.();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IconFilter className="h-5 w-5" />
          Filtros
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Date Range Filter */}
        <div className="space-y-2">
          <Label>Período</Label>
          <Select
            value={filters.dateRange}
            onValueChange={(value) => handleFilterChange("dateRange", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecionar período" />
            </SelectTrigger>
            <SelectContent>
              {dateRangePresets.map((preset) => (
                <SelectItem key={preset.value} value={preset.value}>
                  {preset.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Sector Filter */}
        <div className="space-y-2">
          <Label>Setor</Label>
          <Select
            value={filters.sector}
            onValueChange={(value) => handleFilterChange("sector", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Todos os setores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os setores</SelectItem>
              <SelectItem value="pintura">Pintura</SelectItem>
              <SelectItem value="producao">Produção</SelectItem>
              <SelectItem value="estoque">Estoque</SelectItem>
              <SelectItem value="administracao">Administração</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Status Filter */}
        <div className="space-y-2">
          <Label>Status</Label>
          <Select
            value={filters.status}
            onValueChange={(value) => handleFilterChange("status", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Todos os status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Ativo</SelectItem>
              <SelectItem value="pending">Pendente</SelectItem>
              <SelectItem value="completed">Concluído</SelectItem>
              <SelectItem value="cancelled">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-4">
          <Button onClick={handleApply} className="flex-1">
            Aplicar
          </Button>
          <Button onClick={handleClear} variant="outline">
            <IconX className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
