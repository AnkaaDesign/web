import React, { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { Separator } from "@/components/ui/separator";
import {
  IconFilter,
  IconCheck,
  IconTrash,
  IconBuilding,
  IconUsers,
  IconCalculator,
  IconCalendar,
} from "@tabler/icons-react";
import { useUsers } from "../../../hooks";
import { USER_STATUS } from "../../../constants";

interface BonusSimulationFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: {
    year: number;
    month: number;
    taskQuantity?: number;
    sectorIds?: string[];
    excludeUserIds?: string[];
  };
  onApply: (filters: any) => void;
  onReset: () => void;
  sectors: Array<{ id: string; name: string }>;
  users: Array<{ userId: string; userName: string; sectorName: string }>;
}

export function BonusSimulationFilters({
  open,
  onOpenChange,
  filters,
  onApply,
  onReset,
  sectors,
  users
}: BonusSimulationFiltersProps) {
  const [localFilters, setLocalFilters] = useState(filters);

  // Get all users for exclude filter
  const { data: allUsersData } = useUsers({
    include: { position: true, sector: true },
    where: {
      status: { not: USER_STATUS.DISMISSED },
      performanceLevel: { gt: 0 },
      position: { is: { bonifiable: true } }
    },
    orderBy: { name: "asc" },
    limit: 100,
  });

  const allUsers = allUsersData?.data || [];

  // Sync local filters when modal opens
  useEffect(() => {
    if (open) {
      setLocalFilters(filters);
    }
  }, [open, filters]);

  // Count active filters
  const totalActiveFilters = useMemo(() => {
    let count = 0;
    if (localFilters.sectorIds && localFilters.sectorIds.length > 0) count++;
    if (localFilters.excludeUserIds && localFilters.excludeUserIds.length > 0) count++;
    if (localFilters.taskQuantity !== undefined) count++;
    return count;
  }, [localFilters]);

  // Handle input changes
  const handleTaskQuantityChange = (value: string) => {
    const numValue = parseInt(value) || undefined;
    setLocalFilters(prev => ({ ...prev, taskQuantity: numValue }));
  };

  const handleSectorsChange = (selectedIds: string[]) => {
    setLocalFilters(prev => ({ ...prev, sectorIds: selectedIds }));
  };

  const handleExcludeUsersChange = (selectedIds: string[]) => {
    setLocalFilters(prev => ({ ...prev, excludeUserIds: selectedIds }));
  };

  const handlePeriodChange = (field: 'year' | 'month', value: string) => {
    const numValue = parseInt(value);
    if (!isNaN(numValue)) {
      setLocalFilters(prev => ({ ...prev, [field]: numValue }));
    }
  };

  const handleClear = () => {
    const clearedFilters = {
      year: new Date().getFullYear(),
      month: new Date().getMonth() + 1,
      taskQuantity: undefined,
      sectorIds: [],
      excludeUserIds: [],
    };
    setLocalFilters(clearedFilters);
  };

  const handleApply = () => {
    onApply(localFilters);
  };

  // Prepare sector options
  const sectorOptions = sectors.map(sector => ({
    value: sector.id,
    label: sector.name,
  }));

  // Prepare user options
  const userOptions = allUsers.map(user => ({
    value: user.id,
    label: `${user.name} (${user.sector?.name || 'Sem setor'})`,
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconFilter size={20} />
            Filtros de Simulação de Bonificação
            {totalActiveFilters > 0 && (
              <Badge variant="secondary" className="ml-2">
                {totalActiveFilters} ativos
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Configure os filtros para personalizar a simulação de bonificação
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[500px] mt-4">
          <div className="space-y-6">
            {/* Period Section */}
            <div>
              <Label className="text-sm font-medium mb-3 block flex items-center gap-2">
                <IconCalendar size={16} />
                Período de Referência
              </Label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Ano</Label>
                  <Input
                    type="number"
                    min="2020"
                    max="2030"
                    value={localFilters.year}
                    onChange={(e) => handlePeriodChange('year', e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Mês</Label>
                  <Input
                    type="number"
                    min="1"
                    max="12"
                    value={localFilters.month}
                    onChange={(e) => handlePeriodChange('month', e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Task Configuration Section */}
            <div>
              <Label className="text-sm font-medium mb-3 block flex items-center gap-2">
                <IconCalculator size={16} />
                Configuração de Tarefas
              </Label>
              <div>
                <Label className="text-xs text-muted-foreground">
                  Quantidade Total de Tarefas (deixe vazio para usar dados reais)
                </Label>
                <Input
                  type="number"
                  min="0"
                  placeholder="1200"
                  value={localFilters.taskQuantity || ''}
                  onChange={(e) => handleTaskQuantityChange(e.target.value)}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Se não especificado, será calculado automaticamente com base nas tarefas do período
                </p>
              </div>
            </div>

            <Separator />

            {/* Sector Filter Section */}
            <div>
              <Label className="text-sm font-medium mb-3 block flex items-center gap-2">
                <IconBuilding size={16} />
                Filtrar por Setores
              </Label>
              <Combobox
                mode="multiple"
                placeholder="Selecione os setores..."
                emptyText="Nenhum setor encontrado"
                options={sectorOptions}
                value={localFilters.sectorIds || []}
                onValueChange={handleSectorsChange}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {localFilters.sectorIds?.length || 0} setor(es) selecionado(s)
              </p>
            </div>

            <Separator />

            {/* User Exclusion Section */}
            <div>
              <Label className="text-sm font-medium mb-3 block flex items-center gap-2">
                <IconUsers size={16} />
                Excluir Usuários Específicos
              </Label>
              <Combobox
                mode="multiple"
                placeholder="Selecione usuários para excluir..."
                emptyText="Nenhum usuário encontrado"
                options={userOptions}
                value={localFilters.excludeUserIds || []}
                onValueChange={handleExcludeUsersChange}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {localFilters.excludeUserIds?.length || 0} usuário(s) excluído(s)
              </p>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={handleClear}
            className="gap-2"
            disabled={totalActiveFilters === 0}
          >
            <IconTrash size={16} />
            Limpar Filtros
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleApply} className="gap-2">
              <IconCheck size={16} />
              Aplicar Filtros
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}