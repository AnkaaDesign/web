import { useState, useEffect, useMemo } from "react";
import { type DateRange } from "react-day-picker";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  const { data: usersData } = useUsers({ limit: 100 });

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
    count += localFilters.entityTypes?.length || 0;
    count += localFilters.actions?.length || 0;
    count += localFilters.userIds?.length || 0;
    count += localFilters.createdAt ? 1 : 0;
    return count;
  }, [localFilters]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-2">
          <div className="flex items-center justify-between">
            <DialogTitle>Filtros do Histórico</DialogTitle>
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {activeFilterCount} {activeFilterCount === 1 ? "filtro ativo" : "filtros ativos"}
              </Badge>
            )}
          </div>
          <DialogDescription>Configure os filtros para visualizar o histórico de alterações</DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-auto px-6">
          <div className="space-y-6 pb-4">
            {/* Entity Types */}
            <div className="space-y-2">
              <Label>Tipos de Entidade</Label>
              <Combobox
                mode="multiple"
                options={entityOptions}
                value={localFilters.entityTypes || []}
                onValueChange={(value) => setLocalFilters({ ...localFilters, entityTypes: value.length > 0 ? value : undefined })}
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
                onValueChange={(value) => setLocalFilters({ ...localFilters, actions: value.length > 0 ? value : undefined })}
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
                onValueChange={(value) => setLocalFilters({ ...localFilters, userIds: value.length > 0 ? value : undefined })}
                placeholder="Selecione os usuários"
                searchPlaceholder="Buscar usuário..."
                emptyText="Nenhum usuário encontrado"
              />
            </div>

            {/* Date Range */}
            <div className="space-y-2">
              <Label>Data de Criação</Label>
              <DateTimeInput
                mode="date-range"
                value={{
                  from: localFilters.createdAt?.gte,
                  to: localFilters.createdAt?.lte,
                }}
                onChange={(range: DateRange | undefined) => {
                  if (range?.from || range?.to) {
                    setLocalFilters({
                      ...localFilters,
                      createdAt: {
                        ...(range.from && { gte: range.from }),
                        ...(range.to && { lte: range.to }),
                      },
                    });
                  } else {
                    const { createdAt, ...rest } = localFilters;
                    setLocalFilters(rest);
                  }
                }}
                placeholder="Selecione o período"
              />
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="p-6 pt-4 border-t">
          <div className="flex justify-between w-full">
            <Button variant="ghost" onClick={handleReset} disabled={activeFilterCount === 0}>
              Limpar Filtros
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button onClick={handleApply}>Aplicar Filtros</Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
