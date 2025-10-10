import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Combobox } from "@/components/ui/combobox";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { IconChevronDown, IconChevronRight, IconFilter, IconX } from "@tabler/icons-react";
import { CUT_STATUS, CUT_TYPE, CUT_ORIGIN } from "../../../../constants";
import { CUT_STATUS_LABELS, CUT_TYPE_LABELS, CUT_ORIGIN_LABELS } from "../../../../constants";
import type { CutGetManyFormData } from "../../../../schemas";
import type { DateRange } from "react-day-picker";

interface CutItemFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: Partial<CutGetManyFormData>;
  onFilterChange: (filters: Partial<CutGetManyFormData>) => void;
}

interface FilterSection {
  id: string;
  label: string;
  defaultOpen?: boolean;
}

const filterSections: FilterSection[] = [
  { id: "status", label: "Status e Tipo", defaultOpen: true },
  { id: "origin", label: "Origem", defaultOpen: true },
  { id: "dates", label: "Datas", defaultOpen: false },
];

export function CutItemFilters({ open, onOpenChange, filters, onFilterChange }: CutItemFiltersProps) {
  // Local state for form
  const [localFilters, setLocalFilters] = useState<Partial<CutGetManyFormData>>(filters);
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(filterSections.filter((s) => s.defaultOpen).map((s) => s.id)));

  // Sync local state with props
  useEffect(() => {
    setLocalFilters(filters);
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
  const handleStatusToggle = (status: CUT_STATUS) => {
    const currentStatuses = ((localFilters.where as any)?.status?.in || []) as CUT_STATUS[];
    const newStatuses = currentStatuses.includes(status) ? currentStatuses.filter((s) => s !== status) : [...currentStatuses, status];

    setLocalFilters({
      ...localFilters,
      where: {
        ...localFilters.where,
        status: newStatuses.length > 0 ? { in: newStatuses } : undefined,
      },
    });
  };

  // Handle type toggle
  const handleTypeToggle = (type: CUT_TYPE) => {
    const currentTypes = ((localFilters.where as any)?.type?.in || []) as CUT_TYPE[];
    const newTypes = currentTypes.includes(type) ? currentTypes.filter((t) => t !== type) : [...currentTypes, type];

    setLocalFilters({
      ...localFilters,
      where: {
        ...localFilters.where,
        type: newTypes.length > 0 ? { in: newTypes } : undefined,
      },
    });
  };

  // Handle origin change
  const handleOriginChange = (origin: string) => {
    const newWhere = { ...localFilters.where };
    if (origin === "all") {
      delete (newWhere as any).origin;
    } else {
      (newWhere as any).origin = origin;
    }

    setLocalFilters({
      ...localFilters,
      where: newWhere,
    });
  };

  // Apply filters
  const handleApply = () => {
    onFilterChange(localFilters);
    onOpenChange(false);
  };

  // Reset filters
  const handleReset = () => {
    setLocalFilters({});
  };

  // Count active filters
  const countActiveFilters = () => {
    let count = 0;
    const where = localFilters.where as any;

    if (where?.status?.in?.length) count += where.status.in.length;
    if (where?.type?.in?.length) count += where.type.in.length;
    if (where?.origin) count++;
    if (localFilters.createdAt) count++;

    return count;
  };

  const activeFilterCount = countActiveFilters();

  const currentStatuses = ((localFilters.where as any)?.status?.in || []) as CUT_STATUS[];
  const currentTypes = ((localFilters.where as any)?.type?.in || []) as CUT_TYPE[];
  const currentOrigin = (localFilters.where as any)?.origin || "all";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <IconFilter className="h-5 w-5" />
            Filtros de Cortes
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {activeFilterCount}
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription>Configure filtros para refinar a pesquisa de cortes</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
            {/* Status and Type Section */}
            <Collapsible open={openSections.has("status")} onOpenChange={() => toggleSection("status")}>
              <CollapsibleTrigger className="flex items-center justify-between w-full py-2 hover:bg-muted/50 rounded px-2 transition-colors">
                <h3 className="text-sm font-medium">Status e Tipo</h3>
                <div className="flex items-center gap-2">
                  {(currentStatuses.length + currentTypes.length) > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {currentStatuses.length + currentTypes.length}
                    </Badge>
                  )}
                  {openSections.has("status") ? <IconChevronDown className="h-4 w-4" /> : <IconChevronRight className="h-4 w-4" />}
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(CUT_STATUS_LABELS).map(([value, label]) => (
                      <label key={value} className="flex items-center space-x-2 cursor-pointer hover:bg-muted/50 p-2 rounded">
                        <Checkbox checked={currentStatuses.includes(value as CUT_STATUS)} onCheckedChange={() => handleStatusToggle(value as CUT_STATUS)} />
                        <span className="text-sm">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Tipo de Corte</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(CUT_TYPE_LABELS).map(([value, label]) => (
                      <label key={value} className="flex items-center space-x-2 cursor-pointer hover:bg-muted/50 p-2 rounded">
                        <Checkbox checked={currentTypes.includes(value as CUT_TYPE)} onCheckedChange={() => handleTypeToggle(value as CUT_TYPE)} />
                        <span className="text-sm">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            <Separator />

            {/* Origin Section */}
            <Collapsible open={openSections.has("origin")} onOpenChange={() => toggleSection("origin")}>
              <CollapsibleTrigger className="flex items-center justify-between w-full py-2 hover:bg-muted/50 rounded px-2 transition-colors">
                <h3 className="text-sm font-medium">Origem</h3>
                <div className="flex items-center gap-2">
                  {currentOrigin !== "all" && (
                    <Badge variant="secondary" className="text-xs">
                      1
                    </Badge>
                  )}
                  {openSections.has("origin") ? <IconChevronDown className="h-4 w-4" /> : <IconChevronRight className="h-4 w-4" />}
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Origem do Corte</Label>
                  <Combobox
                    value={currentOrigin}
                    onValueChange={handleOriginChange}
                    options={[
                      { value: "all", label: "Todas" },
                      { value: CUT_ORIGIN.PLAN, label: CUT_ORIGIN_LABELS[CUT_ORIGIN.PLAN] },
                      { value: CUT_ORIGIN.REQUEST, label: CUT_ORIGIN_LABELS[CUT_ORIGIN.REQUEST] },
                    ]}
                    placeholder="Selecionar origem..."
                    searchable={false}
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>

            <Separator />

            {/* Dates Section */}
            <Collapsible open={openSections.has("dates")} onOpenChange={() => toggleSection("dates")}>
              <CollapsibleTrigger className="flex items-center justify-between w-full py-2 hover:bg-muted/50 rounded px-2 transition-colors">
                <h3 className="text-sm font-medium">Datas</h3>
                <div className="flex items-center gap-2">
                  {localFilters.createdAt && (
                    <Badge variant="secondary" className="text-xs">
                      1
                    </Badge>
                  )}
                  {openSections.has("dates") ? <IconChevronDown className="h-4 w-4" /> : <IconChevronRight className="h-4 w-4" />}
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-2">
                <div className="space-y-2">
                  <DateTimeInput
                    mode="date-range"
                    value={{
                      from: localFilters.createdAt?.gte as Date | undefined,
                      to: localFilters.createdAt?.lte as Date | undefined,
                    }}
                    onChange={(dateRange: DateRange | null) => {
                      if (!dateRange || (!dateRange.from && !dateRange.to)) {
                        const { createdAt, ...rest } = localFilters;
                        setLocalFilters(rest);
                      } else {
                        setLocalFilters({
                          ...localFilters,
                          createdAt: {
                            gte: dateRange.from || undefined,
                            lte: dateRange.to || undefined,
                          },
                        });
                      }
                    }}
                    label="Data de Criação"
                    placeholder="Selecionar período..."
                    description="Filtra por período de criação do corte"
                    numberOfMonths={2}
                  />
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
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
