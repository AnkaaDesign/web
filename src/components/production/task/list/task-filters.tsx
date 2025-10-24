import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
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
import { CustomerLogoDisplay } from "@/components/ui/avatar-display";

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
  const { data: customersData } = useCustomers({ orderBy: { fantasyName: "asc" }, include: { logo: true } });
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <IconFilter className="h-5 w-5" />
            Filtros de Tarefas
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {activeFilterCount} {activeFilterCount === 1 ? "ativo" : "ativos"}
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription>
            Filtre tarefas por status, entidades, datas, características e valores
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
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
                            <CustomerLogoDisplay
                              logo={customer.logo}
                              customerName={customer.fantasyName}
                              size="xs"
                              shape="rounded"
                            />
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
              <CollapsibleContent className="space-y-6 pt-2">
                {/* Data de Entrada */}
                <div className="space-y-3">
                  <div className="text-sm font-medium">Data de Entrada</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">De</Label>
                      <DateTimeInput
                        mode="date"
                        value={localFilters.entryDateRange?.from as Date | undefined}
                        onChange={(date: Date | null) => {
                          if (!date && !localFilters.entryDateRange?.to) {
                            const { entryDateRange, ...rest } = localFilters;
                            setLocalFilters(rest);
                          } else {
                            setLocalFilters({
                              ...localFilters,
                              entryDateRange: {
                                ...(date && { from: date }),
                                ...(localFilters.entryDateRange?.to && { to: localFilters.entryDateRange.to }),
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
                        value={localFilters.entryDateRange?.to as Date | undefined}
                        onChange={(date: Date | null) => {
                          if (!date && !localFilters.entryDateRange?.from) {
                            const { entryDateRange, ...rest } = localFilters;
                            setLocalFilters(rest);
                          } else {
                            setLocalFilters({
                              ...localFilters,
                              entryDateRange: {
                                ...(localFilters.entryDateRange?.from && { from: localFilters.entryDateRange.from }),
                                ...(date && { to: date }),
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

                {/* Prazo */}
                <div className="space-y-3">
                  <div className="text-sm font-medium">Prazo</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">De</Label>
                      <DateTimeInput
                        mode="date"
                        value={localFilters.termRange?.from as Date | undefined}
                        onChange={(date: Date | null) => {
                          if (!date && !localFilters.termRange?.to) {
                            const { termRange, ...rest } = localFilters;
                            setLocalFilters(rest);
                          } else {
                            setLocalFilters({
                              ...localFilters,
                              termRange: {
                                ...(date && { from: date }),
                                ...(localFilters.termRange?.to && { to: localFilters.termRange.to }),
                              },
                            });
                          }
                        }}
                        hideLabel
                        placeholder="Selecionar data inicial..."
                        context="due"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">Até</Label>
                      <DateTimeInput
                        mode="date"
                        value={localFilters.termRange?.to as Date | undefined}
                        onChange={(date: Date | null) => {
                          if (!date && !localFilters.termRange?.from) {
                            const { termRange, ...rest } = localFilters;
                            setLocalFilters(rest);
                          } else {
                            setLocalFilters({
                              ...localFilters,
                              termRange: {
                                ...(localFilters.termRange?.from && { from: localFilters.termRange.from }),
                                ...(date && { to: date }),
                              },
                            });
                          }
                        }}
                        hideLabel
                        placeholder="Selecionar data final..."
                        context="due"
                      />
                    </div>
                  </div>
                </div>

                {/* Data de Início */}
                <div className="space-y-3">
                  <div className="text-sm font-medium">Data de Início</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">De</Label>
                      <DateTimeInput
                        mode="date"
                        value={localFilters.startedDateRange?.from as Date | undefined}
                        onChange={(date: Date | null) => {
                          if (!date && !localFilters.startedDateRange?.to) {
                            const { startedDateRange, ...rest } = localFilters;
                            setLocalFilters(rest);
                          } else {
                            setLocalFilters({
                              ...localFilters,
                              startedDateRange: {
                                ...(date && { from: date }),
                                ...(localFilters.startedDateRange?.to && { to: localFilters.startedDateRange.to }),
                              },
                            });
                          }
                        }}
                        hideLabel
                        placeholder="Selecionar data inicial..."
                        context="start"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">Até</Label>
                      <DateTimeInput
                        mode="date"
                        value={localFilters.startedDateRange?.to as Date | undefined}
                        onChange={(date: Date | null) => {
                          if (!date && !localFilters.startedDateRange?.from) {
                            const { startedDateRange, ...rest } = localFilters;
                            setLocalFilters(rest);
                          } else {
                            setLocalFilters({
                              ...localFilters,
                              startedDateRange: {
                                ...(localFilters.startedDateRange?.from && { from: localFilters.startedDateRange.from }),
                                ...(date && { to: date }),
                              },
                            });
                          }
                        }}
                        hideLabel
                        placeholder="Selecionar data final..."
                        context="start"
                      />
                    </div>
                  </div>
                </div>

                {/* Data de Conclusão */}
                <div className="space-y-3">
                  <div className="text-sm font-medium">Data de Conclusão</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">De</Label>
                      <DateTimeInput
                        mode="date"
                        value={localFilters.finishedDateRange?.from as Date | undefined}
                        onChange={(date: Date | null) => {
                          if (!date && !localFilters.finishedDateRange?.to) {
                            const { finishedDateRange, ...rest } = localFilters;
                            setLocalFilters(rest);
                          } else {
                            setLocalFilters({
                              ...localFilters,
                              finishedDateRange: {
                                ...(date && { from: date }),
                                ...(localFilters.finishedDateRange?.to && { to: localFilters.finishedDateRange.to }),
                              },
                            });
                          }
                        }}
                        hideLabel
                        placeholder="Selecionar data inicial..."
                        context="end"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">Até</Label>
                      <DateTimeInput
                        mode="date"
                        value={localFilters.finishedDateRange?.to as Date | undefined}
                        onChange={(date: Date | null) => {
                          if (!date && !localFilters.finishedDateRange?.from) {
                            const { finishedDateRange, ...rest } = localFilters;
                            setLocalFilters(rest);
                          } else {
                            setLocalFilters({
                              ...localFilters,
                              finishedDateRange: {
                                ...(localFilters.finishedDateRange?.from && { from: localFilters.finishedDateRange.from }),
                                ...(date && { to: date }),
                              },
                            });
                          }
                        }}
                        hideLabel
                        placeholder="Selecionar data final..."
                        context="end"
                      />
                    </div>
                  </div>
                </div>

                {/* Data de Criação */}
                <div className="space-y-3">
                  <div className="text-sm font-medium">Data de Criação</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">De</Label>
                      <DateTimeInput
                        mode="date"
                        value={localFilters.createdAtRange?.from as Date | undefined}
                        onChange={(date: Date | null) => {
                          if (!date && !localFilters.createdAtRange?.to) {
                            const { createdAtRange, ...rest } = localFilters;
                            setLocalFilters(rest);
                          } else {
                            setLocalFilters({
                              ...localFilters,
                              createdAtRange: {
                                ...(date && { from: date }),
                                ...(localFilters.createdAtRange?.to && { to: localFilters.createdAtRange.to }),
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
                        value={localFilters.createdAtRange?.to as Date | undefined}
                        onChange={(date: Date | null) => {
                          if (!date && !localFilters.createdAtRange?.from) {
                            const { createdAtRange, ...rest } = localFilters;
                            setLocalFilters(rest);
                          } else {
                            setLocalFilters({
                              ...localFilters,
                              createdAtRange: {
                                ...(localFilters.createdAtRange?.from && { from: localFilters.createdAtRange.from }),
                                ...(date && { to: date }),
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

                {/* Data de Atualização */}
                <div className="space-y-3">
                  <div className="text-sm font-medium">Data de Atualização</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">De</Label>
                      <DateTimeInput
                        mode="date"
                        value={localFilters.updatedAtRange?.from as Date | undefined}
                        onChange={(date: Date | null) => {
                          if (!date && !localFilters.updatedAtRange?.to) {
                            const { updatedAtRange, ...rest } = localFilters;
                            setLocalFilters(rest);
                          } else {
                            setLocalFilters({
                              ...localFilters,
                              updatedAtRange: {
                                ...(date && { from: date }),
                                ...(localFilters.updatedAtRange?.to && { to: localFilters.updatedAtRange.to }),
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
                        value={localFilters.updatedAtRange?.to as Date | undefined}
                        onChange={(date: Date | null) => {
                          if (!date && !localFilters.updatedAtRange?.from) {
                            const { updatedAtRange, ...rest } = localFilters;
                            setLocalFilters(rest);
                          } else {
                            setLocalFilters({
                              ...localFilters,
                              updatedAtRange: {
                                ...(localFilters.updatedAtRange?.from && { from: localFilters.updatedAtRange.from }),
                                ...(date && { to: date }),
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
                      <Input type="number" placeholder="0,00" value={priceMin} onChange={(value) => setPriceMin(value as string)} onBlur={handlePriceRangeChange} step="0.01" min="0" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Máximo</Label>
                      <Input type="number" placeholder="0,00" value={priceMax} onChange={(value) => setPriceMax(value as string)} onBlur={handlePriceRangeChange} step="0.01" min="0" />
                    </div>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4 border-t">
            <Button variant="outline" onClick={handleReset} className="flex-1">
              <IconX className="h-4 w-4 mr-2" />
              Limpar filtros
            </Button>
            <Button onClick={handleApply} className="flex-1">
              Aplicar filtros
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
