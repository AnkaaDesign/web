import { useState, useEffect } from "react";
import { IconFilter } from "@tabler/icons-react";

import { WARNING_SEVERITY, WARNING_SEVERITY_LABELS, WARNING_CATEGORY, WARNING_CATEGORY_LABELS, USER_STATUS } from "../../../../constants";
import { useUsers } from "../../../../hooks";

import { FilterDrawer } from "@/components/common/filters/ui/FilterDrawer";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { MultiSelect } from "@/components/ui/multi-select";

interface WarningFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (filters: {
    severities?: WARNING_SEVERITY[];
    categories?: WARNING_CATEGORY[];
    isActive?: boolean;
    collaboratorIds?: string[];
    supervisorIds?: string[];
    witnessIds?: string[];
  }) => void;
  currentSeverities?: WARNING_SEVERITY[];
  currentCategories?: WARNING_CATEGORY[];
  currentIsActive?: boolean;
  currentCollaboratorIds?: string[];
  currentSupervisorIds?: string[];
  currentWitnessIds?: string[];
}

export function WarningFilters({
  open,
  onOpenChange,
  onApply,
  currentSeverities = [],
  currentCategories = [],
  currentIsActive,
  currentCollaboratorIds = [],
  currentSupervisorIds = [],
  currentWitnessIds = [],
}: WarningFiltersProps) {
  const [severities, setSeverities] = useState<string[]>(currentSeverities);
  const [categories, setCategories] = useState<string[]>(currentCategories);
  // Status as multi-select: 'active' and/or 'resolved'
  const [statuses, setStatuses] = useState<string[]>(
    currentIsActive === undefined ? [] : currentIsActive ? ["active"] : ["resolved"],
  );
  const [collaboratorIds, setCollaboratorIds] = useState<string[]>(currentCollaboratorIds);
  const [supervisorIds, setSupervisorIds] = useState<string[]>(currentSupervisorIds);
  const [witnessIds, setWitnessIds] = useState<string[]>(currentWitnessIds);

  // Load active users only for multi-select (exclude dismissed/inactive)
  const { data: usersData } = useUsers({
    limit: 100,
    orderBy: { name: "asc" },
    statuses: [USER_STATUS.EXPERIENCE_PERIOD_1, USER_STATUS.EXPERIENCE_PERIOD_2, USER_STATUS.EFFECTED],
  });
  const users = usersData?.data || [];

  useEffect(() => {
    setSeverities(currentSeverities);
    setCategories(currentCategories);
    setStatuses(currentIsActive === undefined ? [] : currentIsActive ? ["active"] : ["resolved"]);
    setCollaboratorIds(currentCollaboratorIds);
    setSupervisorIds(currentSupervisorIds);
    setWitnessIds(currentWitnessIds);
  }, [currentSeverities, currentCategories, currentIsActive, currentCollaboratorIds, currentSupervisorIds, currentWitnessIds]);

  // Map status multi-select to isActive output:
  // only 'active' -> true; only 'resolved' -> false; both or none -> undefined
  const resolveIsActive = (sel: string[]): boolean | undefined => {
    const hasActive = sel.includes("active");
    const hasResolved = sel.includes("resolved");
    if (hasActive && !hasResolved) return true;
    if (hasResolved && !hasActive) return false;
    return undefined;
  };

  const handleApply = () => {
    onApply({
      severities: severities.length > 0 ? (severities as WARNING_SEVERITY[]) : undefined,
      categories: categories.length > 0 ? (categories as WARNING_CATEGORY[]) : undefined,
      isActive: resolveIsActive(statuses),
      collaboratorIds: collaboratorIds.length > 0 ? collaboratorIds : undefined,
      supervisorIds: supervisorIds.length > 0 ? supervisorIds : undefined,
      witnessIds: witnessIds.length > 0 ? witnessIds : undefined,
    });
  };

  const handleClear = () => {
    setSeverities([]);
    setCategories([]);
    setStatuses([]);
    setCollaboratorIds([]);
    setSupervisorIds([]);
    setWitnessIds([]);
    onApply({});
  };

  return (
    <FilterDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Filtrar Advertências"
      titleIcon={<IconFilter className="h-5 w-5" />}
      description="Filtre as advertências por severidade, categoria ou status"
      onApply={handleApply}
      onReset={handleClear}
      applyLabel="Aplicar Filtros"
      resetLabel="Limpar Filtros"
    >
          <div className="space-y-2">
            <Label htmlFor="severity">Severidade</Label>
            <Combobox
              mode="multiple"
              value={severities}
              onValueChange={(value) => setSeverities(Array.isArray(value) ? value : [])}
              options={Object.entries(WARNING_SEVERITY_LABELS).map(([key, label]: [string, string]) => ({
                value: key,
                label: label,
              }))}
              placeholder="Todas as severidades"
              emptyText="Nenhuma severidade encontrada"
              searchable={false}
              clearable
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Categoria</Label>
            <Combobox
              mode="multiple"
              value={categories}
              onValueChange={(value) => setCategories(Array.isArray(value) ? value : [])}
              options={Object.entries(WARNING_CATEGORY_LABELS).map(([key, label]: [string, string]) => ({
                value: key,
                label: label,
              }))}
              placeholder="Todas as categorias"
              emptyText="Nenhuma categoria encontrada"
              searchable={false}
              clearable
            />
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Combobox
              mode="multiple"
              value={statuses}
              onValueChange={(value) => setStatuses(Array.isArray(value) ? value : [])}
              options={[
                { value: "active", label: "Ativas" },
                { value: "resolved", label: "Resolvidas" },
              ]}
              placeholder="Todos os status"
              emptyText="Nenhum status encontrado"
              searchable={false}
              clearable
            />
          </div>

          <div className="space-y-2">
            <Label>Colaboradores</Label>
            <MultiSelect
              options={users.map((user) => ({ value: user.id, label: user.name }))}
              selected={collaboratorIds}
              onChange={setCollaboratorIds}
              placeholder={users.length === 0 ? "Carregando..." : "Selecione os colaboradores"}
              disabled={users.length === 0}
            />
          </div>

          <div className="space-y-2">
            <Label>Supervisores</Label>
            <MultiSelect
              options={users.map((user) => ({ value: user.id, label: user.name }))}
              selected={supervisorIds}
              onChange={setSupervisorIds}
              placeholder={users.length === 0 ? "Carregando..." : "Selecione os supervisores"}
              disabled={users.length === 0}
            />
          </div>

          <div className="space-y-2">
            <Label>Testemunhas</Label>
            <MultiSelect
              options={users.map((user) => ({ value: user.id, label: user.name }))}
              selected={witnessIds}
              onChange={setWitnessIds}
              placeholder={users.length === 0 ? "Carregando..." : "Selecione as testemunhas"}
              disabled={users.length === 0}
            />
          </div>
    </FilterDrawer>
  );
}
