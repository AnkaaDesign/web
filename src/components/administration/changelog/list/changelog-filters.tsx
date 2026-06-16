import { useState, useEffect, useMemo } from "react";
import { IconFilter } from "@tabler/icons-react";
import { FilterDrawer } from "@/components/common/filters/ui/FilterDrawer";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { CHANGE_LOG_ENTITY_TYPE, CHANGE_LOG_ENTITY_TYPE_LABELS, CHANGE_LOG_ACTION, CHANGE_LOG_ACTION_LABELS } from "../../../../constants";
import { useUsers } from "../../../../hooks";

// Define props interface directly to avoid import issues
interface ChangelogFiltersProps {
  isOpen: boolean;
  onClose: () => void;
  filters: Record<string, any>;
  onFiltersChange: (filters: Record<string, any>) => void;
  onReset: () => void;
}

export function ChangelogFilters({ isOpen, onClose, filters, onFiltersChange, onReset }: ChangelogFiltersProps) {
  const [localFilters, setLocalFilters] = useState(filters);
  const { data: usersData } = useUsers({
    limit: 100,
    isActive: true,
  });

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  const entityOptions = useMemo(() => {
    return Object.values(CHANGE_LOG_ENTITY_TYPE).map((type) => ({
      value: type,
      label: CHANGE_LOG_ENTITY_TYPE_LABELS[type] || type,
    }));
  }, []);

  const actionOptions = useMemo(() => {
    return Object.values(CHANGE_LOG_ACTION).map((action) => ({
      value: action,
      label: CHANGE_LOG_ACTION_LABELS[action] || action,
    }));
  }, []);

  const userOptions = useMemo(() => {
    if (!usersData?.data) return [];
    return usersData.data.map((user) => ({
      value: user.id,
      label: user.name || user.email || "Usuário sem nome",
    }));
  }, [usersData]);

  const handleApply = () => {
    // Remove empty arrays and undefined values
    const cleanedFilters = Object.entries(localFilters).reduce(
      (acc, [key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value) && value.length === 0) {
            return acc;
          }
          acc[key] = value;
        }
        return acc;
      },
      {} as Record<string, any>,
    );

    onFiltersChange(cleanedFilters);
    onClose();
  };

  const handleReset = () => {
    setLocalFilters({});
    onReset();
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    count += (localFilters.entityTypes?.length ?? 0);
    count += (localFilters.actions?.length ?? 0);
    count += (localFilters.userIds?.length ?? 0);
    count += localFilters.createdAt ? 1 : 0;
    return count;
  }, [localFilters]);

  return (
    <FilterDrawer
      open={isOpen}
      onOpenChange={onClose}
      title="Filtros do Histórico"
      titleIcon={<IconFilter className="h-5 w-5" />}
      description="Configure os filtros para visualizar o histórico de alterações"
      activeFilterCount={activeFilterCount}
      onApply={handleApply}
      onReset={handleReset}
      applyLabel="Aplicar Filtros"
      resetLabel="Limpar Filtros"
    >
            {/* Entity Types */}
            <div className="space-y-2">
              <Label>Tipos de Entidade</Label>
              <Combobox
                mode="multiple"
                options={entityOptions}
                value={localFilters.entityTypes || []}
                onValueChange={(value) => {
                  if (value) {
                    setLocalFilters({ ...localFilters, entityTypes: value.length > 0 ? value : undefined });
                  }
                }}
                placeholder="Selecione os tipos de entidade"
                searchPlaceholder="Buscar tipo..."
                emptyText="Nenhum tipo encontrado"
              />
            </div>

            {/* Action Types */}
            <div className="space-y-2">
              <Label>Tipos de Ação</Label>
              <Combobox
                mode="multiple"
                options={actionOptions}
                value={localFilters.actions || []}
                onValueChange={(value) => {
                  if (value) {
                    setLocalFilters({ ...localFilters, actions: value.length > 0 ? value : undefined });
                  }
                }}
                placeholder="Selecione as ações"
                searchPlaceholder="Buscar ação..."
                emptyText="Nenhuma ação encontrada"
              />
            </div>

            {/* Users */}
            <div className="space-y-2">
              <Label>Usuários</Label>
              <Combobox
                mode="multiple"
                options={userOptions}
                value={localFilters.userIds || []}
                onValueChange={(value) => {
                  if (value) {
                    setLocalFilters({ ...localFilters, userIds: value.length > 0 ? value : undefined });
                  }
                }}
                placeholder="Selecione os usuários"
                searchPlaceholder="Buscar usuário..."
                emptyText="Nenhum usuário encontrado"
              />
            </div>

            {/* Date Range */}
            <div className="space-y-3">
              <div className="text-sm font-medium">Data de Criação</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">De</Label>
                  <DateTimeInput
                    mode="date"
                    value={localFilters.createdAt?.gte}
                    onChange={(date) => {
                      const dateValue = date instanceof Date ? date : null;
                      if (!dateValue && !localFilters.createdAt?.lte) {
                        const { createdAt, ...rest } = localFilters;
                        setLocalFilters(rest);
                      } else {
                        setLocalFilters({
                          ...localFilters,
                          createdAt: {
                            ...(dateValue && { gte: dateValue }),
                            ...(localFilters.createdAt?.lte && { lte: localFilters.createdAt.lte }),
                          },
                        });
                      }
                    }}
                    hideLabel
                    placeholder="Selecionar data inicial..."
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Até</Label>
                  <DateTimeInput
                    mode="date"
                    value={localFilters.createdAt?.lte}
                    onChange={(date) => {
                      const dateValue = date instanceof Date ? date : null;
                      if (!dateValue && !localFilters.createdAt?.gte) {
                        const { createdAt, ...rest } = localFilters;
                        setLocalFilters(rest);
                      } else {
                        setLocalFilters({
                          ...localFilters,
                          createdAt: {
                            ...(localFilters.createdAt?.gte && { gte: localFilters.createdAt.gte }),
                            ...(dateValue && { lte: dateValue }),
                          },
                        });
                      }
                    }}
                    hideLabel
                    placeholder="Selecionar data final..."
                  />
                </div>
              </div>
            </div>
    </FilterDrawer>
  );
}
