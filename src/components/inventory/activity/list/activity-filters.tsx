import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import type { ActivityGetManyFormData } from "../../../../schemas";
import { ACTIVITY_OPERATION, ACTIVITY_REASON, ACTIVITY_REASON_LABELS } from "../../../../constants";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { Combobox } from "@/components/ui/combobox";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { IconFilter, IconUserCheck, IconArrowsExchange, IconListDetails, IconUser, IconPackage, IconNumbers, IconCalendar, IconX } from "@tabler/icons-react";
import { getUsers, getItems } from "../../../../api-client";

interface ActivityFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: Partial<ActivityGetManyFormData>;
  onApply: (filters: Partial<ActivityGetManyFormData>) => void;
  onReset: () => void;
}

export const ActivityFilters = ({ open, onOpenChange, filters, onApply, onReset }: ActivityFiltersProps) => {
  const [localFilters, setLocalFilters] = useState<Partial<ActivityGetManyFormData>>(filters);

  // Create stable caches for fetched data
  const usersCacheRef = useRef<Map<string, { label: string; value: string }>>(new Map());
  const itemsCacheRef = useRef<Map<string, { label: string; value: string }>>(new Map());

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
    if (localFilters.showPaintProduction) count++;
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

  // Async query function for users
  const queryUsersFn = useCallback(async (searchTerm: string, page = 1) => {
    try {
      const response = await getUsers({
        orderBy: { name: "asc" },
        page: page,
        take: 50,
        where: searchTerm
          ? {
              OR: [
                { name: { contains: searchTerm, mode: "insensitive" } },
                { email: { contains: searchTerm, mode: "insensitive" } },
              ],
            }
          : undefined,
      });

      const users = response.data || [];
      const hasMore = response.meta?.hasNextPage || false;

      const options = users.map((user) => {
        const option = { label: user.name, value: user.id };
        usersCacheRef.current.set(user.id, option);
        return option;
      });

      return { data: options, hasMore };
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error fetching users:", error);
      }
      return { data: [], hasMore: false };
    }
  }, []);

  // Async query function for items
  const queryItemsFn = useCallback(async (searchTerm: string, page = 1) => {
    try {
      const response = await getItems({
        orderBy: { name: "asc" },
        page: page,
        take: 50,
        where: searchTerm
          ? {
              OR: [
                { name: { contains: searchTerm, mode: "insensitive" } },
                { uniCode: { contains: searchTerm, mode: "insensitive" } },
              ],
            }
          : undefined,
      });

      const items = response.data || [];
      const hasMore = response.meta?.hasNextPage || false;

      const options = items.map((item) => {
        const label = item.uniCode ? `${item.uniCode} - ${item.name}` : item.name;
        const option = { label, value: item.id };
        itemsCacheRef.current.set(item.id, option);
        return option;
      });

      return { data: options, hasMore };
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error fetching items:", error);
      }
      return { data: [], hasMore: false };
    }
  }, []);

  const reasonOptions = Object.values(ACTIVITY_REASON).map((reason: ACTIVITY_REASON) => ({
    value: reason,
    label: ACTIVITY_REASON_LABELS[reason],
  }));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
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
          </SheetTitle>
          <SheetDescription>Configure os filtros para refinar a lista de atividades.</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Attribution and Operation Filters */}
          <div className="grid grid-cols-2 gap-6">
            {/* Attribution Column */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <IconUserCheck className="h-4 w-4" />
                Atribuição
              </Label>
              <Combobox
                mode="single"
                options={[
                  { value: "ambos", label: "Ambos" },
                  { value: "com", label: "Com usuário atribuído" },
                  { value: "sem", label: "Sem usuário atribuído" },
                ]}
                value={
                  localFilters.hasUser === true ? "com" :
                  localFilters.hasUser === false ? "sem" :
                  "ambos"
                }
                onValueChange={(value) => {
                  const newFilters = { ...localFilters };
                  if (value === "com") {
                    newFilters.hasUser = true;
                  } else if (value === "sem") {
                    newFilters.hasUser = false;
                  } else {
                    delete newFilters.hasUser;
                  }
                  setLocalFilters(newFilters);
                }}
                placeholder="Selecione..."
                emptyText="Nenhuma opção encontrada"
                searchable={false}
              />
            </div>

            {/* Operation Column */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <IconArrowsExchange className="h-4 w-4" />
                Operação
              </Label>
              <Combobox
                mode="single"
                options={[
                  { value: "ambos", label: "Ambos" },
                  { value: "entrada", label: "Entrada" },
                  { value: "saida", label: "Saída" },
                ]}
                value={
                  localFilters.operations?.includes(ACTIVITY_OPERATION.INBOUND) && !localFilters.operations?.includes(ACTIVITY_OPERATION.OUTBOUND)
                    ? "entrada"
                    : localFilters.operations?.includes(ACTIVITY_OPERATION.OUTBOUND) && !localFilters.operations?.includes(ACTIVITY_OPERATION.INBOUND)
                      ? "saida"
                      : "ambos"
                }
                onValueChange={(value) => {
                  const newFilters = { ...localFilters };
                  if (value === "entrada") {
                    newFilters.operations = [ACTIVITY_OPERATION.INBOUND];
                  } else if (value === "saida") {
                    newFilters.operations = [ACTIVITY_OPERATION.OUTBOUND];
                  } else {
                    delete newFilters.operations;
                  }
                  setLocalFilters(newFilters);
                }}
                placeholder="Selecione..."
                emptyText="Nenhuma opção encontrada"
                searchable={false}
              />
            </div>
          </div>

          {/* Paint Production Filter */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="showPaintProduction" className="text-sm font-normal">
                Exibir atividades de produção de tinta
              </Label>
              <Switch
                id="showPaintProduction"
                checked={localFilters.showPaintProduction ?? false}
                onCheckedChange={(checked) =>
                  setLocalFilters({
                    ...localFilters,
                    showPaintProduction: checked ? true : undefined,
                  })
                }
              />
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
              async={true}
              queryKey={["users", "activity-filter"]}
              queryFn={queryUsersFn}
              initialOptions={[]}
              mode="multiple"
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
              minSearchLength={0}
              pageSize={50}
              debounceMs={300}
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
              async={true}
              queryKey={["items", "activity-filter"]}
              queryFn={queryItemsFn}
              initialOptions={[]}
              mode="multiple"
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
              minSearchLength={0}
              pageSize={50}
              debounceMs={300}
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
                  className="bg-transparent"
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
                  className="bg-transparent"
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

        <div className="flex gap-2 mt-6 pt-4 border-t">
          <Button variant="outline" onClick={handleClear} className="flex-1 flex items-center gap-2">
            <IconX className="h-4 w-4" />
            Limpar Tudo
          </Button>
          <Button onClick={handleApply} className="flex-1">Aplicar</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
