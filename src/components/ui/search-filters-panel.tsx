import React, { useState, useCallback, useMemo } from "react";
import { Button } from "./button";
import { Input } from "./input";
import { Label } from "./label";
import { Switch } from "./switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Badge } from "./badge";
import { Separator } from "./separator";
import { Checkbox } from "./checkbox";
import {
  IconFilter,
  IconX,
  IconChevronDown,
  IconDeviceFloppy,
  IconCheck,
  IconClock,
  IconCalendar,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import type { UseAdvancedSearchReturn } from "@/hooks/common/use-advanced-search";
import {
  type FilterIndicator,
  extractActiveFilters,
  countActiveFilters,
  type FilterCondition,
  type FilterGroup,
  type FilterDefinition,
  type FilterFieldDefinition,
  createFilterPreset,
  LocalStorageFilterPresets,
} from "@/utils/table-filter-utils";

interface SearchFiltersPanelProps<TFilters extends Record<string, any> = Record<string, any>> {
  /** Search hook return object */
  searchHook: UseAdvancedSearchReturn<TFilters>;
  /** Available filter field definitions */
  filterFields?: FilterFieldDefinition[];
  /** Available filter presets */
  presets?: FilterDefinition[];
  /** Enable saving custom filters */
  enablePresets?: boolean;
  /** Show active filter indicators */
  showActiveFilters?: boolean;
  /** Show search/filter count */
  showCount?: boolean;
  /** Custom filter renderer */
  renderFilter?: (field: FilterFieldDefinition, onRemove: () => void) => React.ReactNode;
  /** Lookup data for entity resolution */
  lookupData?: Record<string, Array<{ id: string; name?: string; fantasyName?: string; label?: string }>>;
  /** Additional class names */
  className?: string;
  /** Panel title */
  title?: string;
}

/**
 * Comprehensive search and filters panel
 */
export function SearchFiltersPanel<TFilters extends Record<string, any> = Record<string, any>>({
  searchHook,
  filterFields = [],
  presets = [],
  enablePresets = true,
  showActiveFilters = true,
  showCount = true,
  renderFilter,
  lookupData = {},
  className,
  title = "Busca e Filtros",
}: SearchFiltersPanelProps<TFilters>) {
  const { tableState } = searchHook;
  const { filters: filtersObject, hasActiveFilters } = tableState.state;
  const { setFilters, clearAllFilters } = tableState.filters;
  const filters = filtersObject;

  // Local state
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string>("");
  const [presetName, setPresetName] = useState("");
  const [showPresetForm, setShowPresetForm] = useState(false);

  // Filter presets storage
  const presetStorage = useMemo(() => new LocalStorageFilterPresets(), []);

  // Extract active filter indicators
  const activeFilters = useMemo(() => {
    return extractActiveFilters({
      filters,
      onRemoveFilter: (key: string) => {
        const newFilters = { ...filters } as Record<string, any>;
        delete newFilters[key];
        setFilters(newFilters as Partial<TFilters>);
      },
      lookupData,
    });
  }, [filters, setFilters, lookupData]);

  // Count of active filters
  const activeFilterCount = useMemo(() => {
    return countActiveFilters(filters);
  }, [filters]);

  // Build quick filter buttons for common cases
  const quickFilters = useMemo(() => {
    const common = [
      {
        label: "Ativos",
        filter: { status: "ACTIVE" },
        icon: <IconCheck className="h-3 w-3" />,
      },
      {
        label: "Hoje",
        filter: { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
        icon: <IconCalendar className="h-3 w-3" />,
      },
      {
        label: "Esta semana",
        filter: {
          createdAt: {
            gte: new Date(new Date().setDate(new Date().getDate() - 7)),
          },
        },
        icon: <IconClock className="h-3 w-3" />,
      },
    ];

    return common.filter((filter) => {
      // Only show applicable quick filters based on available fields
      return Object.keys(filter.filter).some((key) => filterFields.some((field) => field.key === key));
    });
  }, [filterFields]);

  // Handle preset application
  const handleApplyPreset = useCallback(
    async (presetId: string) => {
      const preset = await presetStorage.loadPreset(presetId);
      if (preset) {
        // Convert filter definition to filters format
        // This is a simplified conversion - in a real app you'd need proper conversion logic
        const newFilters: Partial<TFilters> = {};

        preset.groups.forEach((group) => {
          group.conditions.forEach((condition) => {
            newFilters[condition.field as keyof TFilters] = condition.value;
          });
        });

        setFilters(newFilters);
        setSelectedPreset(presetId);
        setIsOpen(false);
      }
    },
    [presetStorage, setFilters],
  );

  // Handle preset saving
  const handleSavePreset = useCallback(async () => {
    if (!presetName.trim()) return;

    try {
      // Convert current filters to filter definition
      const conditions: FilterCondition[] = Object.entries(filters).map(([key, value]) => ({
        field: key,
        operator: "equals" as const,
        value,
        dataType: "string" as const,
      }));

      const filterGroup: FilterGroup = {
        conditions,
        operator: "AND",
      };

      const preset = createFilterPreset(presetName.trim(), [filterGroup]);
      await presetStorage.savePreset(preset);

      setPresetName("");
      setShowPresetForm(false);
      // You might want to refresh presets list here
    } catch (error) {
      console.error("Failed to save preset:", error);
    }
  }, [presetName, filters, presetStorage]);

  // Handle quick filter application
  const handleQuickFilter = useCallback(
    (filterData: Record<string, any>) => {
      setFilters({ ...filters, ...filterData });
    },
    [filters, setFilters],
  );

  // Remove individual filter
  const handleRemoveFilter = useCallback((indicator: FilterIndicator) => {
    indicator.onRemove();
  }, []);

  return (
    <div className={cn("search-filters-panel", className)}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant={hasActiveFilters ? "default" : "outline"} size="sm" className="relative">
            <IconFilter className="h-4 w-4 mr-2" />
            {title}
            {showCount && activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-2 h-5 text-xs">
                {activeFilterCount}
              </Badge>
            )}
            <IconChevronDown className="h-3 w-3 ml-1" />
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-96 p-0" align="start">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium">{title}</h4>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearAllFilters} className="text-xs text-muted-foreground">
                  Limpar todos
                </Button>
              )}
            </div>

            {/* Quick Filters */}
            {quickFilters.length > 0 && (
              <div className="mb-4">
                <Label className="text-xs text-muted-foreground mb-2 block">Filtros rápidos</Label>
                <div className="flex flex-wrap gap-2">
                  {quickFilters.map((filter, index) => (
                    <Button key={index} variant="outline" size="sm" onClick={() => handleQuickFilter(filter.filter)} className="h-7 text-xs">
                      {filter.icon}
                      <span className="ml-1">{filter.label}</span>
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Filter Presets */}
            {enablePresets && (
              <div className="mb-4">
                <Label className="text-xs text-muted-foreground mb-2 block">Filtros salvos</Label>
                <div className="space-y-2">
                  <Select value={selectedPreset} onValueChange={handleApplyPreset}>
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder="Selecionar filtro salvo..." />
                    </SelectTrigger>
                    <SelectContent>
                      {presets.map((preset) => (
                        <SelectItem key={preset.id} value={preset.id}>
                          <div className="flex items-center gap-2">
                            <span>{preset.name}</span>
                            {preset.description && <span className="text-xs text-muted-foreground">({preset.description})</span>}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {hasActiveFilters && (
                    <div className="flex gap-2">
                      {!showPresetForm ? (
                        <Button variant="outline" size="sm" onClick={() => setShowPresetForm(true)} className="h-7 text-xs flex-1">
                          <IconDeviceFloppy className="h-3 w-3 mr-1" />
                          Salvar filtros atuais
                        </Button>
                      ) : (
                        <>
                          <Input
                            placeholder="Nome do filtro..."
                            value={presetName}
                            onChange={(value) => setPresetName(value as string)}
                            className="h-7 text-xs flex-1"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                handleSavePreset();
                              } else if (e.key === "Escape") {
                                setShowPresetForm(false);
                                setPresetName("");
                              }
                            }}
                          />
                          <Button variant="outline" size="sm" onClick={handleSavePreset} disabled={!presetName.trim()} className="h-7 text-xs">
                            <IconCheck className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setShowPresetForm(false);
                              setPresetName("");
                            }}
                            className="h-7 text-xs"
                          >
                            <IconX className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Advanced Filters */}
            {filterFields.length > 0 && (
              <div className="mb-4">
                <Label className="text-xs text-muted-foreground mb-2 block">Filtros avançados</Label>
                <div className="space-y-3">
                  {filterFields.map((field) => (
                    <div key={field.key}>
                      {renderFilter ? (
                        renderFilter(field, () => {
                          const newFilters = { ...filters } as Record<string, any>;
                          delete newFilters[field.key];
                          setFilters(newFilters as Partial<TFilters>);
                        })
                      ) : (
                        <DefaultFilterRenderer
                          field={field}
                          value={(filters as Record<string, any>)[field.key]}
                          onChange={(value) => {
                            if (value === undefined || value === null || value === "") {
                              const newFilters = { ...filters } as Record<string, any>;
                              delete newFilters[field.key];
                              setFilters(newFilters as Partial<TFilters>);
                            } else {
                              setFilters({ ...filters, [field.key]: value } as Partial<TFilters>);
                            }
                          }}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Separator className="my-4" />

            {/* Active Filters */}
            {showActiveFilters && activeFilters.length > 0 && (
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Filtros ativos ({activeFilters.length})</Label>
                <div className="flex flex-wrap gap-2">
                  {activeFilters.map((indicator) => (
                    <Badge key={indicator.id} variant="secondary" className="flex items-center gap-1 text-xs pr-1">
                      {indicator.icon}
                      <span>
                        {indicator.label}: {indicator.value}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveFilter(indicator)}
                        className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground ml-1"
                      >
                        <IconX className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

// Default filter renderer for different field types
interface DefaultFilterRendererProps {
  field: FilterFieldDefinition;
  value: any;
  onChange: (value: any) => void;
}

function DefaultFilterRenderer({ field, value, onChange }: DefaultFilterRendererProps) {
  switch (field.dataType) {
    case "string":
      return (
        <div className="space-y-1">
          <Label className="text-xs">{field.label}</Label>
          <Input type="text" placeholder={`Filtrar por ${field.label.toLowerCase()}...`} value={value || ""} onChange={(value) => onChange(value as string)} className="h-8 text-xs" />
        </div>
      );

    case "number":
      return (
        <div className="space-y-1">
          <Label className="text-xs">{field.label}</Label>
          <Input
            type="number"
            placeholder={`Filtrar por ${field.label.toLowerCase()}...`}
            value={value || ""}
            onChange={(val) => onChange(val ? Number(val) : undefined)}
            className="h-8 text-xs"
          />
        </div>
      );

    case "boolean":
      return (
        <div className="flex items-center space-x-2">
          <Switch checked={value === true} onCheckedChange={(checked) => onChange(checked ? true : undefined)} />
          <Label className="text-xs">{field.label}</Label>
        </div>
      );

    case "select":
      return (
        <div className="space-y-1">
          <Label className="text-xs">{field.label}</Label>
          <Select value={value || ""} onValueChange={(val) => onChange(val || undefined)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder={`Selecionar ${field.label.toLowerCase()}...`} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todos</SelectItem>
              {field.options?.map((option) => (
                <SelectItem key={String(option.value)} value={String(option.value)}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );

    case "multiSelect":
      const selectedValues = Array.isArray(value) ? value : [];
      return (
        <div className="space-y-1">
          <Label className="text-xs">{field.label}</Label>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {field.options?.map((option) => (
              <div key={String(option.value)} className="flex items-center space-x-2">
                <Checkbox
                  checked={selectedValues.includes(option.value)}
                  onCheckedChange={(checked) => {
                    const newValues = checked ? [...selectedValues, option.value] : selectedValues.filter((v) => v !== option.value);
                    onChange(newValues.length > 0 ? newValues : undefined);
                  }}
                />
                <Label className="text-xs">{option.label}</Label>
              </div>
            ))}
          </div>
        </div>
      );

    case "date":
    case "dateRange":
      return (
        <div className="space-y-1">
          <Label className="text-xs">{field.label}</Label>
          <Input
            type="date"
            value={value instanceof Date ? value.toISOString().split("T")[0] : value || ""}
            onChange={(val) => onChange(val ? new Date(val as string) : undefined)}
            className="h-8 text-xs"
          />
        </div>
      );

    default:
      return (
        <div className="space-y-1">
          <Label className="text-xs">{field.label}</Label>
          <Input
            placeholder={`Filtrar por ${field.label.toLowerCase()}...`}
            value={String(value || "")}
            onChange={(val) => onChange(val || undefined)}
            className="h-8 text-xs"
          />
        </div>
      );
  }
}
