/**
 * Notification Configuration Filters Component
 *
 * Filter sheet for notification configuration list with:
 * - Type filter (combobox)
 * - Importance filter (combobox)
 * - Status filter (combobox)
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Combobox } from "@/components/ui/combobox";
import type { NotificationConfigurationQueryParams } from "@/types/notification-configuration";

// =====================
// Constants
// =====================

const TYPE_OPTIONS = [
  { value: "TASK", label: "Tarefas" },
  { value: "ORDER", label: "Pedidos" },
  { value: "SERVICE_ORDER", label: "Ordens de Serviço" },
  { value: "STOCK", label: "Estoque" },
  { value: "PPE", label: "EPI" },
  { value: "VACATION", label: "Férias" },
  { value: "WARNING", label: "Advertências" },
  { value: "CUT", label: "Recortes" },
  { value: "SYSTEM", label: "Sistema" },
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

  const handleTypeChange = (value: string | string[] | null | undefined) => {
    setLocalFilters((prev) => ({
      ...prev,
      notificationType: value ? (value as any) : undefined,
    }));
  };

  const handleImportanceChange = (value: string | string[] | null | undefined) => {
    setLocalFilters((prev) => ({
      ...prev,
      importance: value ? (value as any) : undefined,
    }));
  };

  const handleStatusChange = (value: string | string[] | null | undefined) => {
    setLocalFilters((prev) => ({
      ...prev,
      enabled: value ? value === "true" : undefined,
    }));
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:w-[400px]">
        <SheetHeader>
          <SheetTitle>Filtros de Configuração</SheetTitle>
          <SheetDescription>
            Configure os filtros para encontrar configurações específicas
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Type Filter */}
          <div className="space-y-2">
            <Label>Tipo de Notificação</Label>
            <Combobox
              value={localFilters.notificationType || undefined}
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
              value={localFilters.importance || undefined}
              onValueChange={handleImportanceChange}
              options={IMPORTANCE_OPTIONS}
              placeholder="Todas as importâncias"
              searchPlaceholder="Buscar importância..."
              emptyText="Nenhuma importância encontrada"
              clearable
            />
          </div>

          {/* Status Filter */}
          <div className="space-y-2">
            <Label>Status</Label>
            <Combobox
              value={
                localFilters.enabled === undefined
                  ? undefined
                  : String(localFilters.enabled)
              }
              onValueChange={handleStatusChange}
              options={STATUS_OPTIONS}
              placeholder="Todos os status"
              searchPlaceholder="Buscar status..."
              emptyText="Nenhum status encontrado"
              clearable
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 justify-end mt-8">
          <Button variant="outline" onClick={handleResetFilters}>
            Limpar
          </Button>
          <Button onClick={handleApplyFilters}>Aplicar Filtros</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
