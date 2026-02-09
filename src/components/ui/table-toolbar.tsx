import { useState, useMemo, useRef, useCallback } from "react";
import {
  IconSearch,
  IconFilter,
  IconFilterOff,
  IconColumns,
  IconRefresh,
  IconStar,
  IconStarFilled,
  IconLayout,
  IconLayoutGrid,
  IconEye,
  IconX,
  IconPlus,
  IconTrash,
  IconAdjustments,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { BaseExportPopover } from "@/components/ui/export-popover";
import type { ExportColumn, ExportFormat } from "@/components/ui/export-popover";
import { FilterIndicators } from "@/components/ui/filter-indicator";
import { ShowSelectedToggle } from "@/components/ui/show-selected-toggle";
import { getHeaderText } from "@/components/ui/column-visibility-utils";

export type TableDensity = "compact" | "normal" | "comfortable";

export interface TableColumn {
  key: string;
  header: string;
  defaultVisible?: boolean;
  resizable?: boolean;
  sortable?: boolean;
}

export interface FilterConfig {
  key: string;
  label: string;
  component: React.ReactNode;
  icon?: React.ReactNode;
}

export interface ActiveFilter {
  key: string;
  label: string;
  value: string;
  onRemove: () => void;
  icon?: React.ReactNode;
}

export interface PresetConfig {
  id: string;
  name: string;
  filters: Record<string, any>;
  columns?: Set<string>;
  isDefault?: boolean;
}

export interface SelectionAction {
  key: string;
  label: string;
  icon: React.ReactNode;
  variant?: "default" | "destructive";
  onClick: (selectedIds: Set<string>) => void;
  disabled?: boolean;
}

export interface ViewOption {
  key: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}

/**
 * TableToolbar - A comprehensive toolbar component for data tables
 *
 * Features:
 * - Search with debouncing
 * - Advanced filtering with filter badges
 * - Column visibility management
 * - Selection actions for bulk operations
 * - Export functionality (CSV, Excel, PDF)
 * - View options and density control
 * - Preset management for saved filter combinations
 * - Show selected only toggle
 * - Responsive design with proper ARIA attributes
 *
 * @example
 * ```tsx
 * <TableToolbar
 *   searchValue={searchValue}
 *   onSearchChange={setSearchValue}
 *   selectedItems={selectedItems}
 *   filters={filterConfigs}
 *   activeFilters={activeFilters}
 *   columns={columns}
 *   visibleColumns={visibleColumns}
 *   onColumnsChange={setVisibleColumns}
 *   exportData={data}
 *   exportColumns={exportColumns}
 *   onExport={handleExport}
 *   entityName="usuário"
 *   entityNamePlural="usuários"
 * />
 * ```
 */
export interface TableToolbarProps<T extends { id: string }> {
  // Search functionality
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  enableSearch?: boolean;
  searchDebounceMs?: number;

  // Selection functionality
  selectedItems?: Set<string>;
  selectionActions?: SelectionAction[];
  showSelectedOnly?: boolean;
  onShowSelectedOnlyChange?: (value: boolean) => void;

  // Filter functionality
  filters?: FilterConfig[];
  activeFilters?: ActiveFilter[];
  onClearAllFilters?: () => void;
  enableFilters?: boolean;

  // Column visibility
  columns?: TableColumn[];
  visibleColumns?: Set<string>;
  onColumnsChange?: (columns: Set<string>) => void;
  columnStorageKey?: string;

  // View options
  density?: TableDensity;
  onDensityChange?: (density: TableDensity) => void;
  viewOptions?: ViewOption[];

  // Export functionality
  enableExport?: boolean;
  exportData?: T[];
  exportColumns?: ExportColumn<T>[];
  onExport?: (format: ExportFormat, items: T[], columns: ExportColumn<T>[]) => Promise<void>;
  onFetchAllItems?: () => Promise<T[]>;
  totalRecords?: number;
  entityName?: string;
  entityNamePlural?: string;

  // Preset management
  presets?: PresetConfig[];
  currentPreset?: string;
  onPresetChange?: (presetId: string) => void;
  onPresetSave?: (name: string, filters: Record<string, any>, columns?: Set<string>) => void;
  onPresetDelete?: (presetId: string) => void;
  enablePresets?: boolean;

  // General
  className?: string;
  title?: string;
  subtitle?: string;
  refreshAction?: () => void;
  customActions?: React.ReactNode;
}

export function TableToolbar<T extends { id: string }>({
  // Search props
  searchValue,
  onSearchChange,
  searchPlaceholder = "Buscar...",
  enableSearch = true,
  searchDebounceMs: _searchDebounceMs = 300,

  // Selection props
  selectedItems = new Set(),
  selectionActions = [],
  showSelectedOnly = false,
  onShowSelectedOnlyChange,

  // Filter props
  filters = [],
  activeFilters = [],
  onClearAllFilters,
  enableFilters = true,

  // Column props
  columns = [],
  visibleColumns = new Set(),
  onColumnsChange,
  columnStorageKey: _columnStorageKey,

  // View props
  density = "normal",
  onDensityChange,
  viewOptions = [],

  // Export props
  enableExport = true,
  exportData = [],
  exportColumns = [],
  onExport,
  onFetchAllItems,
  totalRecords = 0,
  entityName = "item",
  entityNamePlural = "itens",

  // Preset props
  presets = [],
  currentPreset,
  onPresetChange,
  onPresetSave,
  onPresetDelete,
  enablePresets = false,

  // General props
  className,
  title,
  subtitle,
  refreshAction,
  customActions,
}: TableToolbarProps<T>) {
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false);
  const [columnPopoverOpen, setColumnPopoverOpen] = useState(false);
  const [presetPopoverOpen, setPresetPopoverOpen] = useState(false);
  const [newPresetName, setNewPresetName] = useState("");
  const [columnSearchQuery, setColumnSearchQuery] = useState("");

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filter columns based on search
  const filteredColumns = useMemo(() => {
    if (!columnSearchQuery) return columns;
    return columns.filter((col) => getHeaderText(col.header).toLowerCase().includes(columnSearchQuery.toLowerCase()));
  }, [columns, columnSearchQuery]);

  // Column visibility handlers
  const handleColumnToggle = useCallback(
    (columnKey: string, checked: boolean) => {
      if (!onColumnsChange) return;

      const newVisible = new Set(visibleColumns);
      if (checked) {
        newVisible.add(columnKey);
      } else {
        newVisible.delete(columnKey);
      }
      onColumnsChange(newVisible);
    },
    [visibleColumns, onColumnsChange],
  );

  const handleSelectAllColumns = useCallback(() => {
    if (!onColumnsChange) return;
    onColumnsChange(new Set(columns.map((col) => col.key)));
  }, [columns, onColumnsChange]);

  const handleDeselectAllColumns = useCallback(() => {
    if (!onColumnsChange) return;
    onColumnsChange(new Set());
  }, [onColumnsChange]);

  const handleResetColumns = useCallback(() => {
    if (!onColumnsChange) return;
    const defaultColumns = new Set(columns.filter((col) => col.defaultVisible).map((col) => col.key));
    onColumnsChange(defaultColumns);
  }, [columns, onColumnsChange]);

  // Preset handlers
  const handlePresetSave = useCallback(() => {
    if (!onPresetSave || !newPresetName.trim()) return;

    const currentFilters = activeFilters.reduce(
      (acc, filter) => {
        acc[filter.key] = filter.value;
        return acc;
      },
      {} as Record<string, any>,
    );

    onPresetSave(newPresetName.trim(), currentFilters, visibleColumns);
    setNewPresetName("");
    setPresetPopoverOpen(false);
  }, [onPresetSave, newPresetName, activeFilters, visibleColumns]);

  const getCurrentPresetConfig = useMemo(() => {
    return presets.find((p) => p.id === currentPreset);
  }, [presets, currentPreset]);

  // Render density options
  const densityOptions = [
    { key: "compact" as TableDensity, label: "Compacto", icon: IconLayoutGrid },
    { key: "normal" as TableDensity, label: "Normal", icon: IconLayout },
    { key: "comfortable" as TableDensity, label: "Confortável", icon: IconEye },
  ];

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header section */}
      {(title || subtitle || refreshAction || customActions) && (
        <div className="flex items-center justify-between">
          <div>
            {title && <h2 className="text-lg font-semibold text-foreground">{title}</h2>}
            {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-2">
            {refreshAction && (
              <Button variant="outline" size="default" onClick={refreshAction} className="gap-2">
                <IconRefresh className="h-4 w-4" />
                Atualizar
              </Button>
            )}
            {customActions}
          </div>
        </div>
      )}

      {/* Main toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search input */}
        {enableSearch && (
          <div className="relative flex-1 min-w-[250px]">
            <IconSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              ref={searchInputRef}
              type="text"
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={(value) => onSearchChange(String(value))}
              className="pl-10 pr-10"
            />
            {searchValue && (
              <button
                type="button"
                onClick={() => {
                  onSearchChange("");
                  searchInputRef.current?.focus();
                }}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <IconX className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        {/* Filter button */}
        {enableFilters && filters.length > 0 && (
          <Popover open={filterPopoverOpen} onOpenChange={setFilterPopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant={activeFilters.length > 0 ? "default" : "outline"} size="default" className="gap-2">
                {activeFilters.length > 0 ? <IconFilter className="h-4 w-4" /> : <IconFilterOff className="h-4 w-4" />}
                Filtros
                {activeFilters.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 min-w-0">
                    {activeFilters.length}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="start">
              <div className="p-4 border-b">
                <h4 className="font-medium text-sm mb-3">Filtros</h4>
                <div className="space-y-3">
                  {filters.map((filter) => (
                    <div key={filter.key} className="space-y-2">
                      <Label className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                        {filter.icon}
                        {filter.label}
                      </Label>
                      {filter.component}
                    </div>
                  ))}
                </div>
              </div>
              {activeFilters.length > 0 && onClearAllFilters && (
                <div className="p-4 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      onClearAllFilters();
                      setFilterPopoverOpen(false);
                    }}
                    className="w-full"
                  >
                    <IconFilterOff className="h-4 w-4 mr-2" />
                    Limpar todos os filtros
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>
        )}

        {/* Column visibility */}
        {columns.length > 0 && onColumnsChange && (
          <Popover open={columnPopoverOpen} onOpenChange={setColumnPopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="default" className="gap-2">
                <IconColumns className="h-4 w-4" />
                Colunas ({visibleColumns.size}/{columns.length})
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
              <div className="p-4 border-b">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-sm">Gerenciar Colunas</h4>
                  <Button variant="ghost" size="sm" onClick={handleResetColumns} className="h-7 px-2 text-xs">
                    <IconRefresh className="h-3 w-3 mr-1" />
                    Restaurar
                  </Button>
                </div>

                <div className="relative mb-3">
                  <IconSearch className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input type="text" placeholder="Buscar coluna..." value={columnSearchQuery} onChange={(value) => setColumnSearchQuery(String(value))} className="pl-9 h-9" />
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleSelectAllColumns} className="flex-1 h-7 text-xs">
                    Todas
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleDeselectAllColumns} className="flex-1 h-7 text-xs">
                    Nenhuma
                  </Button>
                </div>
              </div>

              <ScrollArea className="h-[300px]">
                <div className="space-y-1 p-1">
                  {filteredColumns.map((column) => (
                    <Label key={column.key} className="flex items-center space-x-2 p-2 hover:bg-accent rounded-md cursor-pointer">
                      <Checkbox checked={visibleColumns.has(column.key)} onCheckedChange={(checked) => handleColumnToggle(column.key, !!checked)} />
                      <span className="flex-1 text-sm">{column.header}</span>
                    </Label>
                  ))}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>
        )}

        {/* View options */}
        {viewOptions.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="default" className="gap-2">
                <IconEye className="h-4 w-4" />
                Visualização
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {viewOptions.map((option) => (
                <DropdownMenuItem key={option.key} onClick={option.onClick} className="gap-2">
                  <option.icon className="h-4 w-4" />
                  {option.label}
                  {option.active && <IconEye className="h-4 w-4 ml-auto" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Density control */}
        {onDensityChange && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="default" className="gap-2">
                <IconAdjustments className="h-4 w-4" />
                Densidade
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {densityOptions.map((option) => (
                <DropdownMenuItem key={option.key} onClick={() => onDensityChange(option.key)} className="gap-2">
                  <option.icon className="h-4 w-4" />
                  {option.label}
                  {density === option.key && <IconEye className="h-4 w-4 ml-auto" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Preset management */}
        {enablePresets && (
          <Popover open={presetPopoverOpen} onOpenChange={setPresetPopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant={currentPreset ? "default" : "outline"} size="default" className="gap-2">
                <IconStar className="h-4 w-4" />
                Presets
                {currentPreset && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                    {getCurrentPresetConfig?.name || currentPreset}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
              <div className="p-4 border-b">
                <h4 className="font-medium text-sm mb-3">Presets de Filtros</h4>

                {/* Save new preset */}
                <div className="space-y-2 mb-4">
                  <Input type="text" placeholder="Nome do novo preset..." value={newPresetName} onChange={(value) => setNewPresetName(String(value))} className="h-8" />
                  <Button size="sm" onClick={handlePresetSave} disabled={!newPresetName.trim()} className="w-full">
                    <IconPlus className="h-4 w-4 mr-2" />
                    Salvar Preset Atual
                  </Button>
                </div>

                <Separator className="my-3" />

                {/* Preset list */}
                <div className="space-y-1">
                  {presets.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Nenhum preset salvo</p>
                  ) : (
                    presets.map((preset) => (
                      <div key={preset.id} className="flex items-center gap-2 p-2 rounded-md hover:bg-accent">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            onPresetChange?.(preset.id);
                            setPresetPopoverOpen(false);
                          }}
                          className="flex-1 justify-start gap-2"
                        >
                          {preset.isDefault ? <IconStarFilled className="h-4 w-4 text-yellow-500" /> : <IconStar className="h-4 w-4" />}
                          {preset.name}
                        </Button>

                        {!preset.isDefault && onPresetDelete && (
                          <Button variant="ghost" size="sm" onClick={() => onPresetDelete(preset.id)} className="h-7 w-7 p-0 text-destructive hover:text-destructive">
                            <IconTrash className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* Export */}
        {enableExport && exportColumns && exportColumns.length > 0 && onExport && (
          <BaseExportPopover
            currentItems={exportData}
            totalRecords={totalRecords}
            selectedItems={selectedItems}
            visibleColumns={visibleColumns}
            exportColumns={exportColumns}
            onExport={onExport}
            onFetchAllItems={onFetchAllItems}
            entityName={entityName}
            entityNamePlural={entityNamePlural}
          />
        )}

        {/* Show selected toggle */}
        {selectedItems.size > 0 && onShowSelectedOnlyChange && (
          <ShowSelectedToggle showSelectedOnly={showSelectedOnly} onToggle={onShowSelectedOnlyChange} selectionCount={selectedItems.size} />
        )}
      </div>

      {/* Selection actions */}
      {selectedItems.size > 0 && selectionActions.length > 0 && (
        <div className="flex items-center gap-2 p-3 bg-accent/50 rounded-lg border">
          <span className="text-sm font-medium">
            {selectedItems.size} {selectedItems.size === 1 ? entityName : entityNamePlural} selecionado{selectedItems.size === 1 ? "" : "s"}:
          </span>
          {selectionActions.map((action) => (
            <Button key={action.key} variant={action.variant || "default"} size="sm" onClick={() => action.onClick(selectedItems)} disabled={action.disabled} className="gap-2">
              {action.icon}
              {action.label}
            </Button>
          ))}
        </div>
      )}

      {/* Active filters */}
      {activeFilters.length > 0 && <FilterIndicators filters={activeFilters} onClearAll={onClearAllFilters} className="mb-2" />}
    </div>
  );
}
