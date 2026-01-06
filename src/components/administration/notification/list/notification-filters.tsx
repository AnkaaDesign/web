import React from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Switch } from "@/components/ui/switch";
import type { NotificationGetManyFormData } from "@/schemas";
import {
  NOTIFICATION_TYPE,
  NOTIFICATION_IMPORTANCE,
  NOTIFICATION_CHANNEL,
  NOTIFICATION_TYPE_LABELS,
  NOTIFICATION_IMPORTANCE_LABELS,
  NOTIFICATION_CHANNEL_LABELS,
} from "@/constants";
import { IconFilter, IconX } from "@tabler/icons-react";
import type { DateRange } from "react-day-picker";

interface NotificationFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: Partial<NotificationGetManyFormData>;
  onFilterChange: (filters: Partial<NotificationGetManyFormData>) => void;
}

export function NotificationFilters({
  open,
  onOpenChange,
  filters,
  onFilterChange,
}: NotificationFiltersProps) {
  const handleTypeChange = (value: string) => {
    const types = value ? value.split(",").filter(Boolean) : [];
    onFilterChange({ ...filters, types });
  };

  const handleImportanceChange = (value: string) => {
    const importance = value ? value.split(",").filter(Boolean) : [];
    onFilterChange({ ...filters, importance });
  };

  const handleChannelChange = (value: string) => {
    const channels = value ? value.split(",").filter(Boolean) : [];
    onFilterChange({ ...filters, channels });
  };

  const handleStatusChange = (value: string) => {
    let sentAt: { isNull?: boolean; isNotNull?: boolean } | undefined;
    if (value === "sent") {
      sentAt = { isNotNull: true };
    } else if (value === "pending") {
      sentAt = { isNull: true };
    }
    onFilterChange({ ...filters, sentAt });
  };

  const handleUnreadChange = (checked: boolean) => {
    onFilterChange({ ...filters, unread: checked || undefined });
  };

  const handleDateRangeChange = (dateRange: DateRange | undefined) => {
    if (dateRange?.from || dateRange?.to) {
      onFilterChange({
        ...filters,
        createdAt: {
          ...(dateRange.from && { gte: dateRange.from }),
          ...(dateRange.to && { lte: dateRange.to }),
        },
      });
    } else {
      const { createdAt, ...rest } = filters;
      onFilterChange(rest);
    }
  };

  const handleClearFilters = () => {
    onFilterChange({
      searchingFor: filters.searchingFor,
    });
  };

  const getStatusValue = () => {
    if (filters.sentAt?.isNotNull) return "sent";
    if (filters.sentAt?.isNull) return "pending";
    return "";
  };

  const getDateRange = (): DateRange | undefined => {
    if (!filters.createdAt) return undefined;
    return {
      from: filters.createdAt.gte,
      to: filters.createdAt.lte,
    };
  };

  const hasActiveFilters =
    (filters.types?.length || 0) > 0 ||
    (filters.importance?.length || 0) > 0 ||
    (filters.channels?.length || 0) > 0 ||
    filters.sentAt !== undefined ||
    filters.unread !== undefined ||
    filters.createdAt !== undefined;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <IconFilter className="h-5 w-5" />
            Filtros de Notificações
          </SheetTitle>
          <SheetDescription>
            Configure os filtros para refinar a lista de notificações
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 py-6">
          {/* Type Filter */}
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Combobox
              value={filters.types?.join(",") || ""}
              onValueChange={handleTypeChange}
              options={[
                { value: "", label: "Todos os tipos" },
                ...Object.values(NOTIFICATION_TYPE).map((type) => ({
                  value: type,
                  label: NOTIFICATION_TYPE_LABELS[type],
                })),
              ]}
              placeholder="Selecione o tipo"
              searchable={false}
              clearable
            />
          </div>

          {/* Importance Filter */}
          <div className="space-y-2">
            <Label>Importância</Label>
            <Combobox
              value={filters.importance?.join(",") || ""}
              onValueChange={handleImportanceChange}
              options={[
                { value: "", label: "Todas" },
                ...Object.values(NOTIFICATION_IMPORTANCE).map((importance) => ({
                  value: importance,
                  label: NOTIFICATION_IMPORTANCE_LABELS[importance],
                })),
              ]}
              placeholder="Selecione a importância"
              searchable={false}
              clearable
            />
          </div>

          {/* Channel Filter */}
          <div className="space-y-2">
            <Label>Canal</Label>
            <Combobox
              value={filters.channels?.join(",") || ""}
              onValueChange={handleChannelChange}
              options={[
                { value: "", label: "Todos os canais" },
                ...Object.values(NOTIFICATION_CHANNEL).map((channel) => ({
                  value: channel,
                  label: NOTIFICATION_CHANNEL_LABELS[channel],
                })),
              ]}
              placeholder="Selecione o canal"
              searchable={false}
              clearable
            />
          </div>

          {/* Status Filter */}
          <div className="space-y-2">
            <Label>Status de Envio</Label>
            <Combobox
              value={getStatusValue()}
              onValueChange={handleStatusChange}
              options={[
                { value: "", label: "Todos" },
                { value: "sent", label: "Enviadas" },
                { value: "pending", label: "Pendentes" },
              ]}
              placeholder="Selecione o status"
              searchable={false}
              clearable
            />
          </div>

          {/* Unread Only Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Apenas Não Lidas</Label>
              <p className="text-sm text-muted-foreground">
                Mostrar apenas notificações não visualizadas
              </p>
            </div>
            <Switch
              checked={filters.unread || false}
              onCheckedChange={handleUnreadChange}
            />
          </div>

          {/* Date Range Filter */}
          <div className="space-y-2">
            <Label>Período de Criação</Label>
            <DateRangePicker
              dateRange={getDateRange()}
              onDateRangeChange={handleDateRangeChange}
              placeholder="Selecione o período"
            />
          </div>
        </div>

        <SheetFooter className="flex gap-2">
          {hasActiveFilters && (
            <Button variant="outline" onClick={handleClearFilters}>
              <IconX className="h-4 w-4 mr-2" />
              Limpar Filtros
            </Button>
          )}
          <Button onClick={() => onOpenChange(false)}>Aplicar</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
