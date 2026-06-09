/**
 * Notification Configuration Filters Component
 *
 * Filter sheet for notification configuration list with:
 * - Type filter (combobox)
 * - Importance filter (combobox)
 * - Status filter (combobox)
 */

import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { FilterDrawer } from "@/components/common/filters/ui/FilterDrawer";
import { Combobox } from "@/components/ui/combobox";
import { SECTOR_PRIVILEGES, SECTOR_PRIVILEGES_LABELS } from "@/constants";
import type { NotificationConfigurationQueryParams } from "@/types/notification-configuration";

// =====================
// Constants
// =====================

const TYPE_OPTIONS = [
  { value: "SYSTEM", label: "Sistema" },
  { value: "PRODUCTION", label: "Produção" },
  { value: "STOCK", label: "Estoque" },
  { value: "USER", label: "Usuário" },
  { value: "GENERAL", label: "Geral" },
];

const IMPORTANCE_OPTIONS = [
  { value: "LOW", label: "Baixa" },
  { value: "NORMAL", label: "Normal" },
  { value: "HIGH", label: "Alta" },
  { value: "URGENT", label: "Urgente" },
];

const STATUS_OPTIONS = [
  { value: "true", label: "Ativo" },
  { value: "false", label: "Inativo" },
];

// Sectors that receive the notification (targetRule.allowedSectors).
// Derived from the enum so every privilege (including PRODUCTION_MANAGER) is always present.
const SECTOR_OPTIONS = Object.values(SECTOR_PRIVILEGES)
  .map((value) => ({ value, label: SECTOR_PRIVILEGES_LABELS[value] || value }))
  .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));

// =====================
// Props Interface
// =====================

interface NotificationConfigurationFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: Partial<NotificationConfigurationQueryParams>;
  onFilterChange: (filters: Partial<NotificationConfigurationQueryParams>) => void;
}

// =====================
// Component
// =====================

export function NotificationConfigurationFilters({
  open,
  onOpenChange,
  filters,
  onFilterChange,
}: NotificationConfigurationFiltersProps) {
  // Local state for immediate UI updates
  const [localFilters, setLocalFilters] = useState(filters);

  // Sync local state with URL filters when modal opens
  useEffect(() => {
    if (open) {
      setLocalFilters(filters);
    }
  }, [open, filters]);

  const handleApplyFilters = () => {
    onFilterChange(localFilters);
    onOpenChange(false);
  };

  const handleResetFilters = () => {
    onFilterChange({});
    setLocalFilters({});
    onOpenChange(false);
  };

  const toArray = (value: string | string[] | null | undefined): string[] =>
    Array.isArray(value) ? value : value ? [value] : [];

  const handleTypeChange = (value: string | string[] | null | undefined) => {
    const arr = toArray(value);
    setLocalFilters((prev) => ({ ...prev, notificationType: arr.length ? (arr as any) : undefined }));
  };

  const handleImportanceChange = (value: string | string[] | null | undefined) => {
    const arr = toArray(value);
    setLocalFilters((prev) => ({ ...prev, importance: arr.length ? (arr as any) : undefined }));
  };

  const handleStatusChange = (value: string | string[] | null | undefined) => {
    const arr = toArray(value);
    setLocalFilters((prev) => ({
      ...prev,
      enabled: arr.length ? (arr.map((v) => v === "true") as any) : undefined,
    }));
  };

  const handleSectorChange = (value: string | string[] | null | undefined) => {
    const arr = toArray(value);
    setLocalFilters((prev) => ({ ...prev, allowedSectors: arr.length ? (arr as any) : undefined }));
  };

  return (
    <FilterDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Filtros de Configuração"
      description="Configure os filtros para encontrar configurações específicas"
      onApply={handleApplyFilters}
      onReset={handleResetFilters}
      applyLabel="Aplicar Filtros"
      resetLabel="Limpar"
    >
          {/* Type Filter */}
          <div className="space-y-2">
            <Label>Tipo de Notificação</Label>
            <Combobox
              mode="multiple"
              value={localFilters.notificationType || []}
              onValueChange={handleTypeChange}
              options={TYPE_OPTIONS}
              placeholder="Todos os tipos"
              searchPlaceholder="Buscar tipo..."
              emptyText="Nenhum tipo encontrado"
              clearable
            />
          </div>

          {/* Importance Filter */}
          <div className="space-y-2">
            <Label>Importância</Label>
            <Combobox
              mode="multiple"
              value={localFilters.importance || []}
              onValueChange={handleImportanceChange}
              options={IMPORTANCE_OPTIONS}
              placeholder="Todas as importâncias"
              searchPlaceholder="Buscar importância..."
              emptyText="Nenhuma importância encontrada"
              clearable
            />
          </div>

          {/* Sector Filter */}
          <div className="space-y-2">
            <Label>Setor</Label>
            <Combobox
              mode="multiple"
              value={localFilters.allowedSectors || []}
              onValueChange={handleSectorChange}
              options={SECTOR_OPTIONS}
              placeholder="Todos os setores"
              searchPlaceholder="Buscar setor..."
              emptyText="Nenhum setor encontrado"
              clearable
            />
          </div>

          {/* Status Filter */}
          <div className="space-y-2">
            <Label>Status</Label>
            <Combobox
              mode="multiple"
              value={(localFilters.enabled || []).map(String)}
              onValueChange={handleStatusChange}
              options={STATUS_OPTIONS}
              placeholder="Todos os status"
              searchPlaceholder="Buscar status..."
              emptyText="Nenhum status encontrado"
              clearable
            />
          </div>
    </FilterDrawer>
  );
}
