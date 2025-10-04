import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Combobox } from "@/components/ui/combobox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useSectors, useCustomers, useUsers } from "../../../../hooks";
import type { TaskGetManyFormData } from "../../../../schemas";
import { TASK_STATUS, TASK_STATUS_LABELS } from "../../../../constants";
import { IconChevronDown, IconChevronRight, IconFilter, IconX } from "@tabler/icons-react";
import { DateTimeInput } from "@/components/ui/date-time-input";
import type { DateRange } from "react-day-picker";

interface TaskFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: Partial<TaskGetManyFormData>;
  onFilterChange: (filters: Partial<TaskGetManyFormData>) => void;
}

interface FilterSection {
  id: string;
  label: string;
  defaultOpen?: boolean;
}

const filterSections: FilterSection[] = [
  { id: "status", label: "Status e Comissão", defaultOpen: true },
  { id: "entities", label: "Entidades", defaultOpen: true },
  { id: "dates", label: "Datas", defaultOpen: false },
  { id: "characteristics", label: "Características", defaultOpen: false },
  { id: "values", label: "Valores", defaultOpen: false },
];

export function TaskFilters({ open, onOpenChange, filters, onFilterChange }: TaskFiltersProps) {
  // Load entity data
  const { data: sectorsData } = useSectors({ orderBy: { name: "asc" } });
  const { data: customersData } = useCustomers({ orderBy: { fantasyName: "asc" } });
  const { data: usersData } = useUsers({ orderBy: { name: "asc" } });

  const sectors = sectorsData?.data || [];
  const customers = customersData?.data || [];
  const users = usersData?.data || [];

  // Local state for form
  const [localFilters, setLocalFilters] = useState<Partial<TaskGetManyFormData>>(filters);
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(filterSections.filter((s) => s.defaultOpen).map((s) => s.id)));

  // Price range state
  const [priceMin, setPriceMin] = useState<string>("");
  const [priceMax, setPriceMax] = useState<string>("");

  // Sync local state with props
  useEffect(() => {
    setLocalFilters(filters);
    setPriceMin(filters.priceRange?.from?.toString() || "");
    setPriceMax(filters.priceRange?.to?.toString() || "");
  }, [filters]);

  // Toggle section
  const toggleSection = (sectionId: string) => {
    const newOpenSections = new Set(openSections);
    if (newOpenSections.has(sectionId)) {
      newOpenSections.delete(sectionId);
    } else {
      newOpenSections.add(sectionId);
    }
    setOpenSections(newOpenSections);
  };

  // Handle status toggle
  const handleStatusToggle = (status: TASK_STATUS) => {
    const currentStatuses = localFilters.status || [];
    const newStatuses = currentStatuses.includes(status) ? currentStatuses.filter((s: TASK_STATUS) => s !== status) : [...currentStatuses, status];

    setLocalFilters({
      ...localFilters,
      status: newStatuses.length > 0 ? newStatuses : undefined,
    });
  };


  // Handle sector toggle
  const handleSectorToggle = (sectorId: string) => {
    const currentSectors = localFilters.sectorIds || [];
    const newSectors = currentSectors.includes(sectorId) ? currentSectors.filter((id: string) => id !== sectorId) : [...currentSectors, sectorId];

    setLocalFilters({
      ...localFilters,
      sectorIds: newSectors.length > 0 ? newSectors : undefined,
    });
  };

  // Handle customer toggle
  const handleCustomerToggle = (customerId: string) => {
    const currentCustomers = localFilters.customerIds || [];
    const newCustomers = currentCustomers.includes(customerId) ? currentCustomers.filter((id: string) => id !== customerId) : [...currentCustomers, customerId];

    setLocalFilters({
      ...localFilters,
      customerIds: newCustomers.length > 0 ? newCustomers : undefined,
    });
  };

  // Handle assignee toggle
  const handleAssigneeToggle = (userId: string) => {
    const currentAssignees = localFilters.assigneeIds || [];
    const newAssignees = currentAssignees.includes(userId) ? currentAssignees.filter((id: string) => id !== userId) : [...currentAssignees, userId];

    setLocalFilters({
      ...localFilters,
      assigneeIds: newAssignees.length > 0 ? newAssignees : undefined,
    });
  };

  // Handle boolean filter change
  const handleBooleanChange = (key: keyof TaskGetManyFormData, value: boolean | undefined) => {
    setLocalFilters({
      ...localFilters,
      [key]: value,
    });
  };

  // Handle price range change
  const handlePriceRangeChange = () => {
    const min = priceMin ? parseFloat(priceMin) : undefined;
    const max = priceMax ? parseFloat(priceMax) : undefined;

    if (min !== undefined || max !== undefined) {
      setLocalFilters({
        ...localFilters,
        priceRange: { from: min, to: max },
      });
    } else {
      const { priceRange, ...rest } = localFilters;
      setLocalFilters(rest);
    }
  };

  // Apply filters
  const handleApply = () => {
    handlePriceRangeChange();
    onFilterChange(localFilters);
    onOpenChange(false);
  };

  // Reset filters
  const handleReset = () => {
    setLocalFilters({});
    setPriceMin("");
    setPriceMax("");
  };

  // Count active filters
  const countActiveFilters = () => {
    let count = 0;
    if (localFilters.status?.length) count += localFilters.status.length;
    if (localFilters.sectorIds?.length) count += localFilters.sectorIds.length;
    if (localFilters.customerIds?.length) count += localFilters.customerIds.length;
    if (localFilters.priceRange) count++;

    // Count boolean filters
    const booleanKeys = [
      "isOverdue",
      "isActive",
      "isCompleted",
      "hasSector",
      "hasCustomer",
      "hasTruck",
      "hasObservation",
      "hasArtworks",
      "hasPaints",
      "hasCommissions",
      "hasServices",
      "hasAirbrushing",
    ] as const;

    booleanKeys.forEach((key) => {
      if (localFilters[key] !== undefined) count++;
    });

    // Count date ranges
    const dateKeys = ["entryDateRange", "termRange", "startedDateRange", "finishedDateRange", "createdAt", "updatedAt"] as const;

    dateKeys.forEach((key) => {
      if (localFilters[key]) count++;
    });

    return count;
  };

  const activeFilterCount = countActiveFilters();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <IconFilter className="h-5 w-5" />
            Filtros de Tarefas
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {activeFilterCount} {activeFilterCount === 1 ? "ativo" : "ativos"}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6">
          <div className="space-y-4 py-4">
            {/* Status Section */}
            <Collapsible open={openSections.has("status")} onOpenChange={() => toggleSection("status")}>
              <CollapsibleTrigger className="flex items-center justify-between w-full py-2 hover:bg-muted/50 rounded px-2 transition-colors">
                <h3 className="text-sm font-medium">Status</h3>
                <div className="flex items-center gap-2">
                  {(localFilters.status?.length || 0) > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {(localFilters.status?.length || 0)}
                    </Badge>
                  )}
                  {openSections.has("status") ? <IconChevronDown className="h-4 w-4" /> : <IconChevronRight className="h-4 w-4" />}
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Status da Tarefa</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.values(TASK_STATUS).map((status) => (
                      <label key={status} className="flex items-center space-x-2 cursor-pointer hover:bg-muted/50 p-2 rounded">
                        <Checkbox checked={localFilters.status?.includes(status) || false} onCheckedChange={() => handleStatusToggle(status)} />
                        <span className="text-sm">{TASK_STATUS_LABELS[status]}</span>
                      </label>
                    ))}
                  </div>
                </div>

              </CollapsibleContent>
            </Collapsible>

            <Separator />

            {/* Entities Section */}
            <Collapsible open={openSections.has("entities")} onOpenChange={() => toggleSection("entities")}>
              <CollapsibleTrigger className="flex items-center justify-between w-full py-2 hover:bg-muted/50 rounded px-2 transition-colors">
                <h3 className="text-sm font-medium">Entidades</h3>
                <div className="flex items-center gap-2">
                  {(localFilters.sectorIds?.length || 0) + (localFilters.customerIds?.length || 0) + (localFilters.assigneeIds?.length || 0) > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {(localFilters.sectorIds?.length || 0) + (localFilters.customerIds?.length || 0) + (localFilters.assigneeIds?.length || 0)}
                    </Badge>
                  )}
                  {openSections.has("entities") ? <IconChevronDown className="h-4 w-4" /> : <IconChevronRight className="h-4 w-4" />}
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-2">
                <Tabs defaultValue="sectors" className="w-full">
                  <TabsList className="grid grid-cols-3 w-full">
                    <TabsTrigger value="sectors">
                      Setores
                      {localFilters.sectorIds?.length ? (
                        <Badge variant="secondary" className="ml-2 text-xs">
                          {localFilters.sectorIds.length}
                        </Badge>
                      ) : null}
                    </TabsTrigger>
                    <TabsTrigger value="customers">
                      Clientes
                      {localFilters.customerIds?.length ? (
                        <Badge variant="secondary" className="ml-2 text-xs">
                          {localFilters.customerIds.length}
                        </Badge>
                      ) : null}
                    </TabsTrigger>
                    <TabsTrigger value="assignees">
                      Responsáveis
                      {localFilters.assigneeIds?.length ? (
                        <Badge variant="secondary" className="ml-2 text-xs">
                          {localFilters.assigneeIds.length}
                        </Badge>
                      ) : null}
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="sectors" className="mt-4">
                    <div className="space-y-2">
                      {localFilters.sectorIds?.length && localFilters.sectorIds.length > 0 && (
                        <Button variant="outline" size="sm" onClick={() => setLocalFilters({ ...localFilters, sectorIds: undefined })} className="w-full text-xs">
                          <IconX className="h-3 w-3 mr-1" />
                          Limpar seleção
                        </Button>
                      )}
                      <ScrollArea className="h-[200px] border rounded-md p-2">
                        <div className="space-y-1">
                          {sectors.map((sector) => (
                            <label key={sector.id} className="flex items-center space-x-2 cursor-pointer hover:bg-muted/50 p-2 rounded">
                              <Checkbox checked={localFilters.sectorIds?.includes(sector.id) || false} onCheckedChange={() => handleSectorToggle(sector.id)} />
                              <span className="text-sm truncate">{sector.name}</span>
                            </label>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  </TabsContent>

                  <TabsContent value="customers" className="mt-4">
                    <ScrollArea className="h-[200px] border rounded-md p-2">
                      <div className="space-y-1">
                        {customers.map((customer) => (
                          <label key={customer.id} className="flex items-center space-x-2 cursor-pointer hover:bg-muted/50 p-2 rounded">
                            <Checkbox checked={localFilters.customerIds?.includes(customer.id) || false} onCheckedChange={() => handleCustomerToggle(customer.id)} />
                            <span className="text-sm truncate">{customer.fantasyName}</span>
                          </label>
                        ))}
                      </div>
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="assignees" className="mt-4">
                    <ScrollArea className="h-[200px] border rounded-md p-2">
                      <div className="space-y-1">
                        {users.map((user) => (
                          <label key={user.id} className="flex items-center space-x-2 cursor-pointer hover:bg-muted/50 p-2 rounded">
                            <Checkbox checked={localFilters.assigneeIds?.includes(user.id) || false} onCheckedChange={() => handleAssigneeToggle(user.id)} />
                            <span className="text-sm truncate">{user.name}</span>
                          </label>
                        ))}
                      </div>
                    </ScrollArea>
                  </TabsContent>
                </Tabs>
              </CollapsibleContent>
            </Collapsible>

            <Separator />

            {/* Dates Section */}
            <Collapsible open={openSections.has("dates")} onOpenChange={() => toggleSection("dates")}>
              <CollapsibleTrigger className="flex items-center justify-between w-full py-2 hover:bg-muted/50 rounded px-2 transition-colors">
                <h3 className="text-sm font-medium">Datas</h3>
                <div className="flex items-center gap-2">{openSections.has("dates") ? <IconChevronDown className="h-4 w-4" /> : <IconChevronRight className="h-4 w-4" />}</div>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-2">
                <div className="grid grid-cols-1 gap-4">
                  <DateTimeInput
                    mode="date-range"
                    value={{
                      from: localFilters.entryDateRange?.from as Date | undefined,
                      to: localFilters.entryDateRange?.to as Date | undefined,
                    }}
                    onChange={(dateRange: DateRange | null) => {
                      if (!dateRange || (!dateRange.from && !dateRange.to)) {
                        const { entryDateRange, ...rest } = localFilters;
                        setLocalFilters(rest);
                      } else {
                        setLocalFilters({
                          ...localFilters,
                          entryDateRange: {
                            from: dateRange.from || undefined,
                            to: dateRange.to || undefined,
                          },
                        });
                      }
                    }}
                    label="Data de Entrada"
                    placeholder="Selecionar período..."
                    description="Filtra por período de entrada da tarefa"
                    numberOfMonths={2}
                  />

                  <DateTimeInput
                    mode="date-range"
                    value={{
                      from: localFilters.termRange?.from as Date | undefined,
                      to: localFilters.termRange?.to as Date | undefined,
                    }}
                    onChange={(dateRange: DateRange | null) => {
                      if (!dateRange || (!dateRange.from && !dateRange.to)) {
                        const { termRange, ...rest } = localFilters;
                        setLocalFilters(rest);
                      } else {
                        setLocalFilters({
                          ...localFilters,
                          termRange: {
                            from: dateRange.from || undefined,
                            to: dateRange.to || undefined,
                          },
                        });
                      }
                    }}
                    label="Prazo"
                    placeholder="Selecionar período..."
                    description="Filtra por prazo de conclusão da tarefa"
                    context="due"
                    numberOfMonths={2}
                  />

                  <DateTimeInput
                    mode="date-range"
                    value={{
                      from: localFilters.startedDateRange?.from as Date | undefined,
                      to: localFilters.startedDateRange?.to as Date | undefined,
                    }}
                    onChange={(dateRange: DateRange | null) => {
                      if (!dateRange || (!dateRange.from && !dateRange.to)) {
                        const { startedDateRange, ...rest } = localFilters;
                        setLocalFilters(rest);
                      } else {
                        setLocalFilters({
                          ...localFilters,
                          startedDateRange: {
                            from: dateRange.from || undefined,
                            to: dateRange.to || undefined,
                          },
                        });
                      }
                    }}
                    label="Data de Início"
                    placeholder="Selecionar período..."
                    description="Filtra por período de início da tarefa"
                    context="start"
                    numberOfMonths={2}
                  />

                  <DateTimeInput
                    mode="date-range"
                    value={{
                      from: localFilters.finishedDateRange?.from as Date | undefined,
                      to: localFilters.finishedDateRange?.to as Date | undefined,
                    }}
                    onChange={(dateRange: DateRange | null) => {
                      if (!dateRange || (!dateRange.from && !dateRange.to)) {
                        const { finishedDateRange, ...rest } = localFilters;
                        setLocalFilters(rest);
                      } else {
                        setLocalFilters({
                          ...localFilters,
                          finishedDateRange: {
                            from: dateRange.from || undefined,
                            to: dateRange.to || undefined,
                          },
                        });
                      }
                    }}
                    label="Data de Conclusão"
                    placeholder="Selecionar período..."
                    description="Filtra por período de conclusão da tarefa"
                    context="end"
                    numberOfMonths={2}
                  />

                  <DateTimeInput
                    mode="date-range"
                    value={{
                      from: localFilters.createdAtRange?.from as Date | undefined,
                      to: localFilters.createdAtRange?.to as Date | undefined,
                    }}
                    onChange={(dateRange: DateRange | null) => {
                      if (!dateRange || (!dateRange.from && !dateRange.to)) {
                        const { createdAtRange, ...rest } = localFilters;
                        setLocalFilters(rest);
                      } else {
                        setLocalFilters({
                          ...localFilters,
                          createdAtRange: {
                            from: dateRange.from || undefined,
                            to: dateRange.to || undefined,
                          },
                        });
                      }
                    }}
                    label="Data de Criação"
                    placeholder="Selecionar período..."
                    description="Filtra por período de criação da tarefa"
                    numberOfMonths={2}
                  />

                  <DateTimeInput
                    mode="date-range"
                    value={{
                      from: localFilters.updatedAtRange?.from as Date | undefined,
                      to: localFilters.updatedAtRange?.to as Date | undefined,
                    }}
                    onChange={(dateRange: DateRange | null) => {
                      if (!dateRange || (!dateRange.from && !dateRange.to)) {
                        const { updatedAtRange, ...rest } = localFilters;
                        setLocalFilters(rest);
                      } else {
                        setLocalFilters({
                          ...localFilters,
                          updatedAtRange: {
                            from: dateRange.from || undefined,
                            to: dateRange.to || undefined,
                          },
                        });
                      }
                    }}
                    label="Data de Atualização"
                    placeholder="Selecionar período..."
                    description="Filtra por período de atualização da tarefa"
                    numberOfMonths={2}
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>

            <Separator />

            {/* Characteristics Section */}
            <Collapsible open={openSections.has("characteristics")} onOpenChange={() => toggleSection("characteristics")}>
              <CollapsibleTrigger className="flex items-center justify-between w-full py-2 hover:bg-muted/50 rounded px-2 transition-colors">
                <h3 className="text-sm font-medium">Características</h3>
                <div className="flex items-center gap-2">
                  {openSections.has("characteristics") ? <IconChevronDown className="h-4 w-4" /> : <IconChevronRight className="h-4 w-4" />}
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Situação</Label>
                    <Combobox
                      value={
                        localFilters.isActive === true
                          ? "active"
                          : localFilters.isActive === false
                            ? "inactive"
                            : localFilters.isCompleted === true
                              ? "completed"
                              : localFilters.isOverdue === true
                                ? "overdue"
                                : "all"
                      }
                      onValueChange={(value) => {
                        const newFilters = { ...localFilters };
                        delete newFilters.isActive;
                        delete newFilters.isCompleted;
                        delete newFilters.isOverdue;

                        switch (value) {
                          case "active":
                            newFilters.isActive = true;
                            break;
                          case "inactive":
                            newFilters.isActive = false;
                            break;
                          case "completed":
                            newFilters.isCompleted = true;
                            break;
                          case "overdue":
                            newFilters.isOverdue = true;
                            break;
                        }

                        setLocalFilters(newFilters);
                      }}
                      options={[
                        { label: "Todas", value: "all" },
                        { label: "Ativas", value: "active" },
                        { label: "Inativas", value: "inactive" },
                        { label: "Finalizadas", value: "completed" },
                        { label: "Atrasadas", value: "overdue" },
                      ]}
                      placeholder="Todas"
                      searchable={false}
                    />
                  </div>

                  {[
                    { key: "hasSector", label: "Tem setor" },
                    { key: "hasCustomer", label: "Tem cliente" },
                    { key: "hasTruck", label: "Tem caminhão" },
                    { key: "hasObservation", label: "Tem observação" },
                    { key: "hasArtworks", label: "Tem artes" },
                    { key: "hasPaints", label: "Tem tintas" },
                    { key: "hasCommissions", label: "Tem comissões" },
                    { key: "hasServices", label: "Tem serviços" },
                    { key: "hasAirbrushing", label: "Tem aerografia" },
                    { key: "hasBudget", label: "Tem orçamento" },
                    { key: "hasNfe", label: "Tem NFe" },
                    { key: "hasReceipt", label: "Tem recibo" },
                    { key: "hasAssignee", label: "Tem responsável" },
                  ].map(({ key, label }) => {
                    const filterValue = (localFilters as any)[key];
                    return (
                      <div key={key} className="space-y-2">
                        <Label>{label}</Label>
                        <Combobox
                          value={filterValue === true ? "yes" : filterValue === false ? "no" : "all"}
                          onValueChange={(value) => {
                            handleBooleanChange(key as keyof TaskGetManyFormData, value === "yes" ? true : value === "no" ? false : undefined);
                          }}
                          options={[
                            { label: "Todos", value: "all" },
                            { label: "Sim", value: "yes" },
                            { label: "Não", value: "no" },
                          ]}
                          placeholder="Todos"
                          searchable={false}
                        />
                      </div>
                    );
                  })}
                </div>
              </CollapsibleContent>
            </Collapsible>

            <Separator />

            {/* Values Section */}
            <Collapsible open={openSections.has("values")} onOpenChange={() => toggleSection("values")}>
              <CollapsibleTrigger className="flex items-center justify-between w-full py-2 hover:bg-muted/50 rounded px-2 transition-colors">
                <h3 className="text-sm font-medium">Valores</h3>
                <div className="flex items-center gap-2">
                  {localFilters.priceRange && (
                    <Badge variant="secondary" className="text-xs">
                      1
                    </Badge>
                  )}
                  {openSections.has("values") ? <IconChevronDown className="h-4 w-4" /> : <IconChevronRight className="h-4 w-4" />}
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Faixa de Valor</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Mínimo</Label>
                      <Input type="number" placeholder="0,00" value={priceMin} onChange={(e) => setPriceMin(e.target.value)} onBlur={handlePriceRangeChange} step="0.01" min="0" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Máximo</Label>
                      <Input type="number" placeholder="0,00" value={priceMax} onChange={(e) => setPriceMax(e.target.value)} onBlur={handlePriceRangeChange} step="0.01" min="0" />
                    </div>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t">
          <Button variant="outline" onClick={handleReset}>
            Limpar filtros
          </Button>
          <Button onClick={handleApply}>Aplicar filtros</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
