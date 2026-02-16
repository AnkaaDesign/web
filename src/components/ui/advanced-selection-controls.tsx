import React, { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  IconChevronDown,
  IconX,
  IconFilter,
  IconFilterCheck,
  IconSelectAll,
  IconRefresh,
  IconEye,
  IconEyeOff,
  IconInfoCircle,
  IconSquare,
  IconSquareCheck,
  IconSquareMinus,
  IconKeyboard,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import type { SelectionStats } from "@/hooks/common/use-advanced-table-selection";

interface AdvancedSelectionControlsProps {
  selectionStats: SelectionStats;
  onSelectAll: () => void;
  onSelectAllFiltered: () => void;
  onSelectAllAcrossPages: () => void;
  onDeselectAll: () => void;
  onInvertSelection: () => void;
  onInvertSelectionFiltered: () => void;
  onShowSelectedOnly: (value: boolean) => void;
  showSelectedOnly: boolean;
  totalCount?: number;
  filteredCount?: number;
  className?: string;
  compact?: boolean;
  showKeyboardHints?: boolean;
  disabled?: boolean;
}

export function AdvancedSelectionControls({
  selectionStats,
  onSelectAll,
  onSelectAllFiltered,
  onSelectAllAcrossPages,
  onDeselectAll,
  onInvertSelection,
  onInvertSelectionFiltered,
  onShowSelectedOnly,
  showSelectedOnly,
  totalCount,
  filteredCount,
  className,
  compact = false,
  showKeyboardHints = true,
  disabled = false,
}: AdvancedSelectionControlsProps) {
  const [showStats, setShowStats] = useState(false);

  // Selection state indicators
  const selectionState = useMemo(() => {
    const { selectedCount, currentPageCount: _currentPageCount, allCurrentPageSelected, someCurrentPageSelected } = selectionStats;

    if (selectedCount === 0) {
      return {
        icon: <IconSquare className="h-4 w-4" />,
        state: "none" as const,
        label: "Nenhum selecionado",
        color: "muted",
      };
    }

    if (allCurrentPageSelected && selectionStats.selectionMode === "page") {
      return {
        icon: <IconSquareCheck className="h-4 w-4" />,
        state: "all" as const,
        label: "Todos na página",
        color: "primary",
      };
    }

    if (someCurrentPageSelected) {
      return {
        icon: <IconSquareMinus className="h-4 w-4" />,
        state: "partial" as const,
        label: "Seleção parcial",
        color: "warning",
      };
    }

    return {
      icon: <IconSquareCheck className="h-4 w-4" />,
      state: "selected" as const,
      label: "Itens selecionados",
      color: "primary",
    };
  }, [selectionStats]);

  // Quick selection modes
  const selectionModes = useMemo(
    () => [
      {
        id: "page",
        label: "Página atual",
        description: `Selecionar todos os ${selectionStats.currentPageCount} itens desta página`,
        action: onSelectAll,
        selected: selectionStats.allCurrentPageSelected,
        count: selectionStats.currentPageCount,
        shortcut: "Ctrl+A",
      },
      {
        id: "filtered",
        label: "Resultados filtrados",
        description: `Selecionar todos os ${filteredCount || 0} itens dos resultados atuais`,
        action: onSelectAllFiltered,
        selected: selectionStats.allFilteredSelected,
        count: filteredCount || 0,
        shortcut: "Ctrl+Shift+A",
        disabled: !filteredCount || filteredCount === selectionStats.currentPageCount,
      },
      {
        id: "all",
        label: "Todos os itens",
        description: `Selecionar todos os ${totalCount || 0} itens do dataset`,
        action: onSelectAllAcrossPages,
        selected: selectionStats.selectionMode === "all",
        count: totalCount || 0,
        shortcut: "Ctrl+Alt+A",
        disabled: !totalCount || totalCount === selectionStats.currentPageCount,
      },
    ],
    [selectionStats, filteredCount, totalCount, onSelectAll, onSelectAllFiltered, onSelectAllAcrossPages],
  );

  const handleModeSelect = useCallback(
    (mode: (typeof selectionModes)[0]) => {
      if (mode.selected) {
        onDeselectAll();
      } else {
        mode.action();
      }
    },
    [onDeselectAll],
  );

  // Smart select all based on context
  const handleSmartSelectAll = useCallback(() => {
    if (selectionStats.selectedCount === 0) {
      // No selection: select current page
      onSelectAll();
    } else if (selectionStats.allCurrentPageSelected && filteredCount && filteredCount > selectionStats.currentPageCount) {
      // All current page selected: select all filtered
      onSelectAllFiltered();
    } else if (selectionStats.allFilteredSelected && totalCount && totalCount > (filteredCount || 0)) {
      // All filtered selected: select all across pages
      onSelectAllAcrossPages();
    } else {
      // Has selection: deselect all
      onDeselectAll();
    }
  }, [selectionStats, filteredCount, totalCount, onSelectAll, onSelectAllFiltered, onSelectAllAcrossPages, onDeselectAll]);

  if (compact) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        {/* Compact selection indicator */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSmartSelectAll}
              disabled={disabled}
              className={cn("h-8 px-2 gap-1", selectionStats.selectedCount > 0 && "text-primary")}
            >
              {selectionState.icon}
              <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                {selectionStats.selectedCount}
              </Badge>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-xs">
              <div>{selectionState.label}</div>
              {showKeyboardHints && <div className="text-muted-foreground mt-1">Clique para alternar seleção</div>}
            </div>
          </TooltipContent>
        </Tooltip>

        {/* Show selected only toggle */}
        {selectionStats.selectedCount > 0 && (
          <Button variant={showSelectedOnly ? "default" : "outline"} size="sm" onClick={() => onShowSelectedOnly(!showSelectedOnly)} disabled={disabled} className="h-8 px-2 gap-1">
            {showSelectedOnly ? <IconEye className="h-3 w-3" /> : <IconEyeOff className="h-3 w-3" />}
            <span className="sr-only">{showSelectedOnly ? "Mostrar todos" : "Mostrar apenas selecionados"}</span>
          </Button>
        )}
      </div>
    );
  }

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            {selectionState.icon}
            Controles de Seleção
            {showKeyboardHints && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <IconKeyboard className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-xs space-y-1">
                    <div>
                      <kbd>Ctrl+Clique</kbd> - Alternar item
                    </div>
                    <div>
                      <kbd>Shift+Clique</kbd> - Selecionar intervalo
                    </div>
                    <div>
                      <kbd>Ctrl+A</kbd> - Selecionar página
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            )}
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setShowStats(!showStats)} className="h-auto p-1">
            <IconInfoCircle className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Current selection status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant={selectionStats.selectedCount > 0 ? "default" : "secondary"} className="gap-1">
              {selectionState.icon}
              {selectionStats.selectedCount} selecionado(s)
            </Badge>
            {selectionStats.selectionMode !== "page" && (
              <Badge variant="outline" className="text-xs">
                {selectionStats.selectionMode === "all" ? "Todas as páginas" : "Filtrados"}
              </Badge>
            )}
          </div>

          {selectionStats.selectedCount > 0 && (
            <Button variant="ghost" size="sm" onClick={onDeselectAll} disabled={disabled} className="h-auto px-2 py-1 text-xs">
              <IconX className="h-3 w-3 mr-1" />
              Limpar
            </Button>
          )}
        </div>

        {/* Selection modes */}
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Modos de Seleção</div>
          <div className="grid gap-2">
            {selectionModes.map((mode) => (
              <div
                key={mode.id}
                className={cn(
                  "flex items-center justify-between p-2 rounded-md border transition-colors",
                  mode.selected && "bg-primary/5 border-primary/20",
                  mode.disabled && "opacity-50 cursor-not-allowed",
                  !mode.disabled && "hover:bg-muted/50 cursor-pointer",
                )}
                onClick={() => !mode.disabled && !disabled && handleModeSelect(mode)}
              >
                <div className="flex items-center gap-2">
                  <Checkbox checked={mode.selected} disabled={mode.disabled || disabled} className="h-4 w-4" />
                  <div>
                    <div className="text-sm font-medium">{mode.label}</div>
                    <div className="text-xs text-muted-foreground">{mode.description}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                    {mode.count}
                  </Badge>
                  {showKeyboardHints && mode.shortcut && <kbd className="text-xs bg-muted px-1 rounded">{mode.shortcut}</kbd>}
                </div>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Additional actions */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onInvertSelection} disabled={disabled || selectionStats.currentPageCount === 0} className="gap-2">
            <IconRefresh className="h-3 w-3" />
            Inverter Página
          </Button>

          {filteredCount && filteredCount > selectionStats.currentPageCount && (
            <Button variant="outline" size="sm" onClick={onInvertSelectionFiltered} disabled={disabled} className="gap-2">
              <IconRefresh className="h-3 w-3" />
              Inverter Filtrados
            </Button>
          )}

          {selectionStats.selectedCount > 0 && (
            <Button
              variant={showSelectedOnly ? "default" : "outline"}
              size="sm"
              onClick={() => onShowSelectedOnly(!showSelectedOnly)}
              disabled={disabled}
              className="gap-2 ml-auto"
            >
              {showSelectedOnly ? <IconFilterCheck className="h-3 w-3" /> : <IconFilter className="h-3 w-3" />}
              {showSelectedOnly ? "Mostrar Todos" : "Mostrar Selecionados"}
            </Button>
          )}
        </div>

        {/* Detailed stats */}
        {showStats && (
          <>
            <Separator />
            <div className="space-y-2 text-xs">
              <div className="font-medium text-muted-foreground uppercase tracking-wide">Estatísticas Detalhadas</div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex justify-between">
                  <span>Página atual:</span>
                  <span className="font-medium">
                    {selectionStats.selectedCurrentPageCount}/{selectionStats.currentPageCount}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Total selecionado:</span>
                  <span className="font-medium">{selectionStats.selectedCount}</span>
                </div>
                {filteredCount && (
                  <div className="flex justify-between">
                    <span>Filtrados:</span>
                    <span className="font-medium">{filteredCount}</span>
                  </div>
                )}
                {totalCount && (
                  <div className="flex justify-between">
                    <span>Total geral:</span>
                    <span className="font-medium">{totalCount}</span>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// Table header checkbox with advanced selection modes
interface AdvancedTableHeaderCheckboxProps {
  selectionStats: SelectionStats;
  onSelectAll: () => void;
  onSelectAllFiltered: () => void;
  onSelectAllAcrossPages: () => void;
  onDeselectAll: () => void;
  totalCount?: number;
  filteredCount?: number;
  className?: string;
  showDropdown?: boolean;
  disabled?: boolean;
}

export function AdvancedTableHeaderCheckbox({
  selectionStats,
  onSelectAll,
  onSelectAllFiltered,
  onSelectAllAcrossPages,
  onDeselectAll,
  totalCount,
  filteredCount,
  className,
  showDropdown = true,
  disabled = false,
}: AdvancedTableHeaderCheckboxProps) {
  const isChecked = selectionStats.allCurrentPageSelected;
  const isIndeterminate = selectionStats.someCurrentPageSelected && !selectionStats.allCurrentPageSelected;

  // Create stable ref callbacks
  const checkboxRef = React.useRef<HTMLButtonElement>(null);
  const checkboxRef2 = React.useRef<HTMLButtonElement>(null);

  // Use effect to set indeterminate state instead of inline callback ref
  React.useEffect(() => {
    if (checkboxRef.current) {
      (checkboxRef.current as unknown as HTMLInputElement).indeterminate = isIndeterminate;
    }
  }, [isIndeterminate]);

  React.useEffect(() => {
    if (checkboxRef2.current) {
      (checkboxRef2.current as unknown as HTMLInputElement).indeterminate = isIndeterminate;
    }
  }, [isIndeterminate]);

  const handleMainCheckbox = useCallback(() => {
    if (isChecked) {
      onDeselectAll();
    } else {
      onSelectAll();
    }
  }, [isChecked, onSelectAll, onDeselectAll]);

  if (!showDropdown) {
    return (
      <Checkbox
        ref={checkboxRef}
        checked={isChecked}
        onCheckedChange={handleMainCheckbox}
        disabled={disabled}
        className={cn("border-neutral-500 dark:border-neutral-300", className)}
        aria-label="Selecionar todos os itens visíveis"
      />
    );
  }

  return (
    <div className={cn("flex items-center", className)}>
      <Checkbox
        ref={checkboxRef2}
        checked={isChecked}
        onCheckedChange={handleMainCheckbox}
        disabled={disabled}
        className="border-neutral-500 dark:border-neutral-300"
        aria-label="Selecionar todos os itens visíveis"
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 ml-1" disabled={disabled} aria-label="Opções de seleção">
            <IconChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel>Selecionar itens</DropdownMenuLabel>

          <DropdownMenuItem onClick={onSelectAll} disabled={disabled} className="gap-2">
            <IconSquareCheck className="h-4 w-4" />
            <div>
              <div>Página atual ({selectionStats.currentPageCount})</div>
              <div className="text-xs text-muted-foreground">Selecionar todos os itens desta página</div>
            </div>
          </DropdownMenuItem>

          {filteredCount && filteredCount > selectionStats.currentPageCount && (
            <DropdownMenuItem onClick={onSelectAllFiltered} disabled={disabled} className="gap-2">
              <IconFilter className="h-4 w-4" />
              <div>
                <div>Resultados filtrados ({filteredCount})</div>
                <div className="text-xs text-muted-foreground">Selecionar todos os itens dos resultados atuais</div>
              </div>
            </DropdownMenuItem>
          )}

          {totalCount && totalCount > (filteredCount || selectionStats.currentPageCount) && (
            <DropdownMenuItem onClick={onSelectAllAcrossPages} disabled={disabled} className="gap-2">
              <IconSelectAll className="h-4 w-4" />
              <div>
                <div>Todos os itens ({totalCount})</div>
                <div className="text-xs text-muted-foreground">Selecionar todos os itens do dataset</div>
              </div>
            </DropdownMenuItem>
          )}

          {selectionStats.selectedCount > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDeselectAll} disabled={disabled} className="gap-2 text-destructive">
                <IconX className="h-4 w-4" />
                Limpar seleção ({selectionStats.selectedCount})
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
