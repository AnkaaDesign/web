import { FilterDrawer } from "@/components/common/filters/ui/FilterDrawer";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { UserSelector } from "@/components/ui/user-selector";
import { DateTimeInput } from "@/components/ui/date-time-input";
import type { NotificationGetManyFormData } from "@/schemas";
import {
  NOTIFICATION_TYPE,
  NOTIFICATION_IMPORTANCE,
  NOTIFICATION_CHANNEL,
  NOTIFICATION_TYPE_LABELS,
  NOTIFICATION_IMPORTANCE_LABELS,
  NOTIFICATION_CHANNEL_LABELS,
} from "@/constants";
import { IconFilter } from "@tabler/icons-react";

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

  const handleReadStatusChange = (value: string | string[] | null | undefined) => {
    const statusValue = Array.isArray(value) ? value[0] : value;
    let unread: boolean | undefined;
    if (statusValue === "unread") unread = true;
    else if (statusValue === "read") unread = false;
    else unread = undefined;
    onFilterChange({ ...filters, unread });
  };

  const getReadStatusValue = () => {
    if (filters.unread === true) return "unread";
    if (filters.unread === false) return "read";
    return "";
  };

  const handleCreatedAtChange = (key: "gte" | "lte", date: Date | undefined) => {
    const nextCreatedAt = {
      ...(filters.createdAt?.gte && { gte: filters.createdAt.gte }),
      ...(filters.createdAt?.lte && { lte: filters.createdAt.lte }),
    };
    if (date) {
      nextCreatedAt[key] = date;
    } else {
      delete nextCreatedAt[key];
    }
    if (nextCreatedAt.gte || nextCreatedAt.lte) {
      onFilterChange({ ...filters, createdAt: nextCreatedAt });
    } else {
      const { createdAt, ...rest } = filters;
      onFilterChange(rest);
    }
  };

  const handleUserChange = (userId: string | null) => {
    onFilterChange({ ...filters, userId: userId || undefined });
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

  const hasActiveFilters =
    (filters.types?.length || 0) > 0 ||
    (filters.importance?.length || 0) > 0 ||
    (filters.channels?.length || 0) > 0 ||
    filters.status !== undefined ||
    filters.unread !== undefined ||
    filters.userId !== undefined ||
    filters.createdAt !== undefined;

  return (
    <FilterDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Filtros de Notificações"
      titleIcon={<IconFilter className="h-5 w-5" />}
      description="Configure os filtros para refinar a lista de notificações"
      onApply={() => onOpenChange(false)}
      onReset={handleClearFilters}
      showReset={hasActiveFilters}
      applyLabel="Aplicar"
      resetLabel="Limpar Filtros"
    >
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

          {/* Reading Status Filter */}
          <div className="space-y-2">
            <Label>Status de Leitura</Label>
            <Combobox
              value={getReadStatusValue()}
              onValueChange={handleReadStatusChange}
              options={[
                { value: "", label: "Todas" },
                { value: "unread", label: "Não lidas" },
                { value: "read", label: "Lidas" },
              ]}
              placeholder="Selecione o status de leitura"
              searchable={false}
              clearable
            />
          </div>

          {/* Date Range Filter */}
          <div className="space-y-3">
            <Label>Período de Criação</Label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">De</Label>
                <DateTimeInput
                  mode="date"
                  value={filters.createdAt?.gte}
                  onChange={(v) => {
                    const d = v instanceof Date ? v : v && typeof v === "object" && "from" in v ? v.from : undefined;
                    handleCreatedAtChange("gte", d ?? undefined);
                  }}
                  hideLabel
                  placeholder="Data inicial..."
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Até</Label>
                <DateTimeInput
                  mode="date"
                  value={filters.createdAt?.lte}
                  onChange={(v) => {
                    const d = v instanceof Date ? v : v && typeof v === "object" && "to" in v ? v.to : undefined;
                    handleCreatedAtChange("lte", d ?? undefined);
                  }}
                  hideLabel
                  placeholder="Data final..."
                />
              </div>
            </div>
          </div>
    </FilterDrawer>
  );
}
