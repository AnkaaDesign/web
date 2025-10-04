import { useState, useEffect, useMemo } from "react";
import type { ActivityGetManyFormData } from "../../../../schemas";
import { ACTIVITY_OPERATION, ACTIVITY_REASON, ACTIVITY_REASON_LABELS } from "../../../../constants";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { Combobox } from "@/components/ui/combobox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { IconFilter, IconUserCheck, IconArrowsExchange, IconListDetails, IconUser, IconPackage, IconNumbers, IconCalendar, IconX } from "@tabler/icons-react";
import { useUsers, useItems } from "../../../../hooks";

interface ActivityFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: Partial<ActivityGetManyFormData>;
  onApply: (filters: Partial<ActivityGetManyFormData>) => void;
  onReset: () => void;
}

export const ActivityFilters = ({ open, onOpenChange, filters, onApply, onReset }: ActivityFiltersProps) => {
  const [localFilters, setLocalFilters] = useState<Partial<ActivityGetManyFormData>>(filters);

  // Load data for comboboxes
  const { data: usersData } = useUsers({ orderBy: { name: "asc" } });
  const { data: itemsData } = useItems({ orderBy: { name: "asc" } });

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (localFilters.hasUser !== undefined) count++;
    if (localFilters.operations?.length) count++;
    if (localFilters.reasons?.length) count++;
    if (localFilters.userIds?.length) count++;
    if (localFilters.itemIds?.length) count++;
    if (localFilters.quantityRange?.min || localFilters.quantityRange?.max) count++;
    if (localFilters.createdAt?.gte || localFilters.createdAt?.lte) count++;
    return count;
  }, [localFilters]);

  // Sync localFilters with parent filters when modal opens
  useEffect(() => {
    if (open) {
      setLocalFilters(filters);
    }
  }, [open, filters]);

  const handleApply = () => {
    onApply(localFilters);
    onOpenChange(false);
  };

  const handleClear = () => {
    const clearedFilters: Partial<ActivityGetManyFormData> = {
      limit: filters.limit,
    };
    setLocalFilters(clearedFilters);
    // Immediately apply cleared filters
    onApply(clearedFilters);
    onReset();
  };

  // Transform data for comboboxes
  const userOptions =
    usersData?.data?.map((user: { id: string; name: string }) => ({
      value: user.id,
      label: user.name,
    })) || [];

  const itemOptions =
    itemsData?.data?.map((item: { id: string; name: string; uniCode: string | null }) => ({
      value: item.id,
      label: item.uniCode ? `${item.uniCode} - ${item.name}` : item.name,
    })) || [];

  const reasonOptions = Object.values(ACTIVITY_REASON).map((reason: ACTIVITY_REASON) => ({
    value: reason,
    label: ACTIVITY_REASON_LABELS[reason],
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] h-[70vh] max-h-[700px] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconFilter className="h-5 w-5" />
            Atividades - Filtros
            {activeFilterCount > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="secondary" className="ml-2 cursor-pointer hover:bg-destructive hover:text-destructive-foreground transition-colors" onClick={handleClear}>
                      {activeFilterCount}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Clique para limpar todos os filtros</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </DialogTitle>
          <DialogDescription>Configure os filtros para refinar a lista de atividades.</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-8 py-4">
          {/* Attribution and Operation Filters */}
          <div className="grid grid-cols-2 gap-6">
            {/* Attribution Column */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <IconUserCheck className="h-4 w-4" />
                Atribuição
              </Label>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="hasUser"
                    checked={localFilters.hasUser === true}
                    onCheckedChange={(checked) =>
                      setLocalFilters({
                        ...localFilters,
                        hasUser: checked ? true : undefined,
                      })
                    }
                  />
                  <Label htmlFor="hasUser" className="text-sm font-normal cursor-pointer">
                    Com usuário atribuído
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="noUser"
                    checked={localFilters.hasUser === false}
                    onCheckedChange={(checked) =>
                      setLocalFilters({
                        ...localFilters,
                        hasUser: checked ? false : undefined,
                      })
                    }
                  />
                  <Label htmlFor="noUser" className="text-sm font-normal cursor-pointer">
                    Sem usuário atribuído
                  </Label>
                </div>
              </div>
            </div>

            {/* Operation Column */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <IconArrowsExchange className="h-4 w-4" />
                Operação
              </Label>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="inbound"
                    checked={localFilters.operations?.includes(ACTIVITY_OPERATION.INBOUND) ?? false}
                    onCheckedChange={(checked) => {
                      const currentOps = localFilters.operations || [];
                      if (checked) {
                        setLocalFilters({
                          ...localFilters,
                          operations: [...currentOps, ACTIVITY_OPERATION.INBOUND],
                        });
                      } else {
                        const newOps = currentOps.filter((op: string) => op !== ACTIVITY_OPERATION.INBOUND);
                        setLocalFilters({
                          ...localFilters,
                          operations: newOps.length > 0 ? newOps : undefined,
                        });
                      }
                    }}
                  />
                  <Label htmlFor="inbound" className="text-sm font-normal cursor-pointer">
                    Entrada
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="outbound"
                    checked={localFilters.operations?.includes(ACTIVITY_OPERATION.OUTBOUND) ?? false}
                    onCheckedChange={(checked) => {
                      const currentOps = localFilters.operations || [];
                      if (checked) {
                        setLocalFilters({
                          ...localFilters,
                          operations: [...currentOps, ACTIVITY_OPERATION.OUTBOUND],
                        });
                      } else {
                        const newOps = currentOps.filter((op: string) => op !== ACTIVITY_OPERATION.OUTBOUND);
                        setLocalFilters({
                          ...localFilters,
                          operations: newOps.length > 0 ? newOps : undefined,
                        });
                      }
                    }}
                  />
                  <Label htmlFor="outbound" className="text-sm font-normal cursor-pointer">
                    Saída
                  </Label>
                </div>
              </div>
            </div>
          </div>

          {/* Reason Filter */}
          <div className="grid gap-2">
            <Label className="flex items-center gap-2">
              <IconListDetails className="h-4 w-4" />
              Motivo da Atividade
            </Label>
            <Combobox
              mode="multiple"
              options={reasonOptions}
              value={localFilters.reasons || []}
              onValueChange={(value) =>
                setLocalFilters({
                  ...localFilters,
                  reasons: value.length > 0 ? (value as ACTIVITY_REASON[]) : undefined,
                })
              }
              placeholder="Selecione os motivos..."
              emptyText="Nenhum motivo encontrado"
              searchPlaceholder="Buscar motivos..."
            />
            {localFilters.reasons && localFilters.reasons.length > 0 && (
              <div className="text-xs text-muted-foreground">
                {localFilters.reasons.length} motivo{localFilters.reasons.length !== 1 ? "s" : ""} selecionado{localFilters.reasons.length !== 1 ? "s" : ""}
              </div>
            )}
          </div>

          {/* Users Filter */}
          <div className="grid gap-2">
            <Label className="flex items-center gap-2">
              <IconUser className="h-4 w-4" />
              Usuários
            </Label>
            <Combobox
              mode="multiple"
              options={userOptions}
              value={localFilters.userIds || []}
              onValueChange={(value) =>
                setLocalFilters({
                  ...localFilters,
                  userIds: value.length > 0 ? value : undefined,
                })
              }
              placeholder="Selecione usuários..."
              emptyText="Nenhum usuário encontrado"
              searchPlaceholder="Buscar usuários..."
            />
            {localFilters.userIds && localFilters.userIds.length > 0 && (
              <div className="text-xs text-muted-foreground">
                {localFilters.userIds.length} usuário{localFilters.userIds.length !== 1 ? "s" : ""} selecionado{localFilters.userIds.length !== 1 ? "s" : ""}
              </div>
            )}
          </div>

          {/* Items Filter */}
          <div className="grid gap-2">
            <Label className="flex items-center gap-2">
              <IconPackage className="h-4 w-4" />
              Itens
            </Label>
            <Combobox
              mode="multiple"
              options={itemOptions}
              value={localFilters.itemIds || []}
              onValueChange={(value) =>
                setLocalFilters({
                  ...localFilters,
                  itemIds: value.length > 0 ? value : undefined,
                })
              }
              placeholder="Selecione itens..."
              emptyText="Nenhum item encontrado"
              searchPlaceholder="Buscar itens..."
            />
            {localFilters.itemIds && localFilters.itemIds.length > 0 && (
              <div className="text-xs text-muted-foreground">
                {localFilters.itemIds.length} iten{localFilters.itemIds.length !== 1 ? "s" : ""} selecionado{localFilters.itemIds.length !== 1 ? "s" : ""}
              </div>
            )}
          </div>

          {/* Quantity Range Filter */}
          <div className="grid gap-2">
            <Label className="flex items-center gap-2">
              <IconNumbers className="h-4 w-4" />
              Quantidade
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Mínimo</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Quantidade mínima"
                  value={localFilters.quantityRange?.min || ""}
                  onChange={(e) => {
                    const value = e.target.value ? parseFloat(e.target.value) : undefined;
                    const currentRange = localFilters.quantityRange || {};
                    const newRange = { ...currentRange, min: value };
                    setLocalFilters({
                      ...localFilters,
                      quantityRange: newRange.min === undefined && newRange.max === undefined ? undefined : newRange,
                    });
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Máximo</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Quantidade máxima"
                  value={localFilters.quantityRange?.max || ""}
                  onChange={(e) => {
                    const value = e.target.value ? parseFloat(e.target.value) : undefined;
                    const currentRange = localFilters.quantityRange || {};
                    const newRange = { ...currentRange, max: value };
                    setLocalFilters({
                      ...localFilters,
                      quantityRange: newRange.min === undefined && newRange.max === undefined ? undefined : newRange,
                    });
                  }}
                />
              </div>
            </div>
          </div>

          {/* Created Date Range Filter */}
          <div className="grid gap-2">
            <Label className="flex items-center gap-2">
              <IconCalendar className="h-4 w-4" />
              Data de Criação
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Data inicial</Label>
                <DateTimeInput
                  type="datetime-local"
                  value={localFilters.createdAt?.gte || undefined}
                  onChange={(value) =>
                    setLocalFilters({
                      ...localFilters,
                      createdAt: {
                        ...localFilters.createdAt,
                        gte: value || undefined,
                      },
                    })
                  }
                  placeholder="Selecione a data inicial"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Data final</Label>
                <DateTimeInput
                  type="datetime-local"
                  value={localFilters.createdAt?.lte || undefined}
                  onChange={(value) =>
                    setLocalFilters({
                      ...localFilters,
                      createdAt: {
                        ...localFilters.createdAt,
                        lte: value || undefined,
                      },
                    })
                  }
                  placeholder="Selecione a data final"
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClear} className="flex items-center gap-2">
            <IconX className="h-4 w-4" />
            Limpar Tudo
          </Button>
          <Button onClick={handleApply}>Aplicar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
