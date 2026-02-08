import React, { useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  IconChevronDown,
  IconX,
  IconCheck,
  IconTrash,
  IconEdit,
  IconDownload,
  IconShare,
  IconCopy,
  IconArchive,
  IconRestore,
  IconAlertTriangle,
  IconLoader2,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import type { SelectionStats } from "@/hooks/common/use-advanced-table-selection";

export interface BulkAction {
  id: string;
  label: string;
  icon?: React.ReactNode;
  variant?: "default" | "destructive" | "secondary" | "outline";
  disabled?: boolean;
  requiresConfirmation?: boolean;
  confirmationTitle?: string;
  confirmationDescription?: string;
  hidden?: boolean;
  group?: string;
  shortcut?: string;
  maxSelection?: number;
  minSelection?: number;
  action: (selectedIds: string[]) => Promise<void> | void;
}

export interface BulkActionGroup {
  id: string;
  label: string;
  actions: BulkAction[];
}

export interface BulkActionProgress {
  completed: number;
  total: number;
  currentItem?: string;
  errors: Array<{ id: string; error: string }>;
}

interface BulkActionsBarProps {
  selectedIds: string[];
  selectionStats: SelectionStats;
  actions: BulkAction[];
  onDeselectAll: () => void;
  onShowSelectedOnly?: () => void;
  showSelectedOnly?: boolean;
  className?: string;
  position?: "top" | "bottom" | "sticky";
  showProgress?: boolean;
  compact?: boolean;
  maxWidth?: number;
}

export function BulkActionsBar({
  selectedIds,
  selectionStats,
  actions,
  onDeselectAll,
  onShowSelectedOnly,
  showSelectedOnly = false,
  className,
  position = "top",
  showProgress = true,
  compact = false,
  maxWidth,
}: BulkActionsBarProps) {
  const [isExecuting, setIsExecuting] = useState(false);
  const [currentAction, setCurrentAction] = useState<BulkAction | null>(null);
  const [confirmAction, setConfirmAction] = useState<BulkAction | null>(null);
  const [progress, setProgress] = useState<BulkActionProgress | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Filter and group actions
  const availableActions = useMemo(() => {
    return actions.filter((action) => {
      if (action.hidden) return false;
      if (action.minSelection && selectedIds.length < action.minSelection) return false;
      if (action.maxSelection && selectedIds.length > action.maxSelection) return false;
      return true;
    });
  }, [actions, selectedIds.length]);

  const groupedActions = useMemo(() => {
    const groups: Record<string, BulkAction[]> = {};
    const ungrouped: BulkAction[] = [];

    availableActions.forEach((action) => {
      if (action.group) {
        if (!groups[action.group]) groups[action.group] = [];
        groups[action.group].push(action);
      } else {
        ungrouped.push(action);
      }
    });

    return { groups, ungrouped };
  }, [availableActions]);

  // Execute bulk action with progress tracking
  const executeAction = useCallback(
    async (action: BulkAction) => {
      if (isExecuting || selectedIds.length === 0) return;

      setIsExecuting(true);
      setCurrentAction(action);

      if (showProgress && selectedIds.length > 1) {
        setProgress({
          completed: 0,
          total: selectedIds.length,
          errors: [],
        });
      }

      try {
        if (action.action.constructor.name === "AsyncFunction") {
          // Handle async action with progress tracking
          let completed = 0;
          const errors: Array<{ id: string; error: string }> = [];

          for (const id of selectedIds) {
            try {
              if (showProgress) {
                setProgress((prev) =>
                  prev
                    ? {
                        ...prev,
                        currentItem: id,
                        completed,
                      }
                    : null,
                );
              }

              // For demo purposes, we're calling the action for each ID
              // In real implementation, you might want to batch the operations
              await action.action([id]);
              completed++;

              if (showProgress) {
                setProgress((prev) =>
                  prev
                    ? {
                        ...prev,
                        completed,
                      }
                    : null,
                );
              }

              // Small delay for better UX on fast operations
              if (selectedIds.length > 5) {
                await new Promise((resolve) => setTimeout(resolve, 50));
              }
            } catch (error) {
              errors.push({
                id,
                error: error instanceof Error ? error.message : "Unknown error",
              });
            }
          }

          if (errors.length > 0) {
            setProgress((prev) => (prev ? { ...prev, errors } : null));
            // Keep progress visible for a moment to show errors
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }
        } else {
          // Handle synchronous action
          await action.action(selectedIds);
        }
      } catch (error) {
        if (process.env.NODE_ENV !== 'production') {
          console.error("Bulk action failed:", error);
        }
        if (showProgress) {
          setProgress({
            completed: 0,
            total: selectedIds.length,
            errors: [{ id: "general", error: error instanceof Error ? error.message : "Action failed" }],
          });
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      } finally {
        setIsExecuting(false);
        setCurrentAction(null);
        setProgress(null);
      }
    },
    [isExecuting, selectedIds, showProgress],
  );

  const handleActionClick = useCallback(
    (action: BulkAction) => {
      if (action.requiresConfirmation) {
        setConfirmAction(action);
        setShowConfirmDialog(true);
      } else {
        executeAction(action);
      }
    },
    [executeAction],
  );

  const handleConfirmAction = useCallback(() => {
    if (confirmAction) {
      executeAction(confirmAction);
    }
    setShowConfirmDialog(false);
    setConfirmAction(null);
  }, [confirmAction, executeAction]);

  // Don't render if no items are selected
  if (selectedIds.length === 0) return null;

  const progressPercentage = progress ? (progress.completed / progress.total) * 100 : 0;

  const containerClasses = cn(
    "bg-primary text-primary-foreground shadow-sm rounded-lg border",
    position === "sticky" && "sticky top-4 z-50",
    position === "bottom" && "fixed bottom-4 left-4 right-4 z-50",
    compact && "py-2 px-3",
    !compact && "p-4",
    className,
  );

  const contentStyle = maxWidth ? { maxWidth, margin: "0 auto" } : undefined;

  return (
    <>
      <Card className={containerClasses} style={contentStyle}>
        <CardContent className={cn("p-0", compact ? "space-y-2" : "space-y-3")}>
          {/* Progress bar */}
          {progress && showProgress && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>
                  {currentAction?.label} ({progress.completed}/{progress.total})
                </span>
                <span>{Math.round(progressPercentage)}%</span>
              </div>
              <Progress value={progressPercentage} className="h-2" />
              {progress.currentItem && <div className="text-xs opacity-80">Processando: {progress.currentItem}</div>}
              {progress.errors.length > 0 && (
                <Alert variant="destructive" className="text-xs">
                  <IconAlertTriangle className="h-3 w-3" />
                  <AlertDescription>{progress.errors.length} erro(s) encontrado(s)</AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Selection info and actions */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-primary-foreground/20 text-primary-foreground">
                  {selectedIds.length}
                </Badge>
                <span className={cn("font-medium", compact ? "text-sm" : "text-base")}>{selectedIds.length === 1 ? "item selecionado" : "itens selecionados"}</span>
              </div>

              {selectionStats.selectionMode !== "page" && (
                <Badge variant="outline" className="border-primary-foreground/20 text-primary-foreground text-xs">
                  {selectionStats.selectionMode === "all" ? "Todas as páginas" : "Filtrados"}
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Quick actions */}
              {onShowSelectedOnly && (
                <Button
                  variant={showSelectedOnly ? "secondary" : "outline"}
                  size={compact ? "sm" : "default"}
                  onClick={onShowSelectedOnly}
                  className="text-primary-foreground border-primary-foreground/20"
                >
                  {showSelectedOnly ? "Mostrar todos" : "Mostrar selecionados"}
                </Button>
              )}

              {/* Primary actions */}
              {groupedActions.ungrouped.slice(0, 2).map((action) => (
                <Button
                  key={action.id}
                  variant={action.variant || "secondary"}
                  size={compact ? "sm" : "default"}
                  onClick={() => handleActionClick(action)}
                  disabled={action.disabled || isExecuting}
                  className="gap-2"
                >
                  {isExecuting && currentAction?.id === action.id ? <IconLoader2 className="h-4 w-4 animate-spin" /> : action.icon}
                  {!compact && action.label}
                </Button>
              ))}

              {/* More actions dropdown */}
              {(groupedActions.ungrouped.length > 2 || Object.keys(groupedActions.groups).length > 0) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size={compact ? "sm" : "default"} className="border-primary-foreground/20 text-primary-foreground" disabled={isExecuting}>
                      <IconChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    {/* Remaining ungrouped actions */}
                    {groupedActions.ungrouped.slice(2).map((action) => (
                      <DropdownMenuItem key={action.id} onClick={() => handleActionClick(action)} disabled={action.disabled || isExecuting} className="gap-2">
                        {action.icon}
                        {action.label}
                        {action.shortcut && <kbd className="ml-auto text-xs">{action.shortcut}</kbd>}
                      </DropdownMenuItem>
                    ))}

                    {/* Grouped actions */}
                    {Object.entries(groupedActions.groups).map(([groupName, groupActions]) => (
                      <React.Fragment key={groupName}>
                        {groupedActions.ungrouped.length > 2 && <DropdownMenuSeparator />}
                        <DropdownMenuLabel>{groupName}</DropdownMenuLabel>
                        {groupActions.map((action) => (
                          <DropdownMenuItem key={action.id} onClick={() => handleActionClick(action)} disabled={action.disabled || isExecuting} className="gap-2">
                            {action.icon}
                            {action.label}
                            {action.shortcut && <kbd className="ml-auto text-xs">{action.shortcut}</kbd>}
                          </DropdownMenuItem>
                        ))}
                      </React.Fragment>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              <Separator orientation="vertical" className="h-6 bg-primary-foreground/20" />

              {/* Deselect all */}
              <Button
                variant="ghost"
                size={compact ? "sm" : "default"}
                onClick={onDeselectAll}
                className="text-primary-foreground hover:bg-primary-foreground/10"
                disabled={isExecuting}
              >
                <IconX className="h-4 w-4" />
                {!compact && "Limpar"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmAction?.confirmationTitle || `Confirmar ${confirmAction?.label}`}</DialogTitle>
            <DialogDescription>
              {confirmAction?.confirmationDescription || `Tem certeza que deseja executar a ação "${confirmAction?.label}" em ${selectedIds.length} item(s) selecionado(s)?`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)} disabled={isExecuting}>
              Cancelar
            </Button>
            <Button variant={confirmAction?.variant || "default"} onClick={handleConfirmAction} disabled={isExecuting} className="gap-2">
              {isExecuting ? <IconLoader2 className="h-4 w-4 animate-spin" /> : confirmAction?.icon || <IconCheck className="h-4 w-4" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Predefined bulk actions for common use cases
export const createCommonBulkActions = (
  onDelete?: (ids: string[]) => Promise<void>,
  onEdit?: (ids: string[]) => Promise<void>,
  onExport?: (ids: string[]) => Promise<void>,
  onArchive?: (ids: string[]) => Promise<void>,
): BulkAction[] => {
  const actions: BulkAction[] = [];

  if (onEdit) {
    actions.push({
      id: "edit",
      label: "Editar",
      icon: <IconEdit className="h-4 w-4" />,
      variant: "secondary",
      maxSelection: 1,
      action: onEdit,
    });
  }

  if (onExport) {
    actions.push({
      id: "export",
      label: "Exportar",
      icon: <IconDownload className="h-4 w-4" />,
      variant: "outline",
      action: onExport,
    });
  }

  if (onArchive) {
    actions.push({
      id: "archive",
      label: "Arquivar",
      icon: <IconArchive className="h-4 w-4" />,
      variant: "secondary",
      requiresConfirmation: true,
      group: "Gerenciar",
      action: onArchive,
    });
  }

  if (onDelete) {
    actions.push({
      id: "delete",
      label: "Excluir",
      icon: <IconTrash className="h-4 w-4" />,
      variant: "destructive",
      requiresConfirmation: true,
      confirmationTitle: "Confirmar Exclusão",
      confirmationDescription: "Esta ação não pode ser desfeita.",
      group: "Gerenciar",
      action: onDelete,
    });
  }

  return actions;
};
