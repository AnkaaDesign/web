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
import { UserSelector } from "@/components/ui/user-selector";
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
  filters: Partial<NotificationGetManyFormData> & { status?: string; userId?: string };
  onFilterChange: (filters: Partial<NotificationGetManyFormData> & { status?: string; userId?: string }) => void;
  onUserSelect?: (user: { id: string; name: string } | null) => void;
  selectedUser?: { id: string; name: string } | null;
}

export function NotificationFilters({
  open,
  onOpenChange,
  filters,
  onFilterChange,
  onUserSelect,
  selectedUser,
}: NotificationFiltersProps) {
  const handleTypeChange = (value: string | string[] | null | undefined) => {
    const types = Array.isArray(value) ? value : [];
    onFilterChange({ ...filters, types });
  };

  const handleImportanceChange = (value: string | string[] | null | undefined) => {
    const importance = Array.isArray(value) ? value : [];
    onFilterChange({ ...filters, importance });
  };

  const handleChannelChange = (value: string | string[] | null | undefined) => {
    const channels = Array.isArray(value) ? value : [];
    onFilterChange({ ...filters, channels });
  };

  const handleStatusChange = (value: string | string[] | null | undefined) => {
    const statusValue = Array.isArray(value) ? value[0] : value;
    const status = statusValue || undefined;
    onFilterChange({ ...filters, status });
  };

  const handleUnreadChange = (checked: boolean) => {
    onFilterChange({ ...filters, unread: checked || undefined });
  };

  const handleUserChange = (userId: string | null) => {
    onFilterChange({ ...filters, userId: userId || undefined });
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
    onUserSelect?.(null);
  };

  const getStatusValue = () => {
    const status = filters.status;
    if (status === "sent") return "sent";
    if (status === "pending") return "pending";
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
    filters.status !== undefined ||
    filters.unread !== undefined ||
    filters.userId !== undefined ||
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
          {/* Type Filter - Multi-select */}
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Combobox
              mode="multiple"
              value={filters.types || []}
              onValueChange={handleTypeChange}
              options={Object.values(NOTIFICATION_TYPE).map((type) => ({
                value: type,
                label: NOTIFICATION_TYPE_LABELS[type],
              }))}
              placeholder="Selecione os tipos"
              searchable={false}
              clearable
            />
          </div>

          {/* Importance Filter - Multi-select */}
          <div className="space-y-2">
            <Label>Importância</Label>
            <Combobox
              mode="multiple"
              value={filters.importance || []}
              onValueChange={handleImportanceChange}
              options={Object.values(NOTIFICATION_IMPORTANCE).map((importance) => ({
                value: importance,
                label: NOTIFICATION_IMPORTANCE_LABELS[importance],
              }))}
              placeholder="Selecione as importâncias"
              searchable={false}
              clearable
            />
          </div>

          {/* Channel Filter - Multi-select */}
          <div className="space-y-2">
            <Label>Canal</Label>
            <Combobox
              mode="multiple"
              value={filters.channels || []}
              onValueChange={handleChannelChange}
              options={Object.values(NOTIFICATION_CHANNEL).map((channel) => ({
                value: channel,
                label: NOTIFICATION_CHANNEL_LABELS[channel],
              }))}
              placeholder="Selecione os canais"
              searchable={false}
              clearable
            />
          </div>

          {/* Target User Filter */}
          <div className="space-y-2">
            <Label>Destinatário</Label>
            <UserSelector
              value={filters.userId || ""}
              onChange={(userId) => {
                handleUserChange(userId);
                if (!userId) {
                  onUserSelect?.(null);
                }
              }}
              placeholder="Buscar usuário"
              initialUser={selectedUser || undefined}
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
