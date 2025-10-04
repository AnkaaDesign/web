import { useState, useCallback, useEffect, useMemo, forwardRef, useImperativeHandle } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import { AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { IconSelector, IconChevronUp, IconChevronDown } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { useUserMutations } from "../../../hooks/useUser";
import { useBonusSimulation } from "../../../hooks/payroll";
import { bonusKeys } from "../../../hooks/queryKeys";
import { formatCurrency, getCurrentPayrollPeriod } from "../../../utils";
import type { User } from "../../../types";

interface PerformanceLevelTableProps {
  users: User[];
  isLoading: boolean;
  error: any;
  visibleColumns: Set<string>;
  selectedUserIds: Set<string>;
  onSelectionChange: (selectedIds: Set<string>) => void;
  onDataChange?: (data: any) => void;
  onRefresh?: () => void;
  onPendingChangesUpdate?: (changes: Map<string, number>, modified: Set<string>) => void;
  className?: string;
  // Sorting props
  onSort?: (columnKey: string) => void;
  getSortDirection?: (columnKey: string) => "asc" | "desc" | null;
  getSortOrder?: (columnKey: string) => number | null;
}

export interface PerformanceLevelTableRef {
  saveAllChanges: () => void;
  revertAllChanges: () => void;
}

// Performance level selector with chevron buttons
interface PerformanceLevelSelectorProps {
  value: number;
  onChange: (value: number) => void;
  onBlur: () => void;
  userId: string;
  isModified?: boolean;
  className?: string;
}

function PerformanceLevelSelector({
  value,
  onChange,
  onBlur,
  userId,
  isModified,
  className,
}: PerformanceLevelSelectorProps) {
  const handleDecrease = () => {
    const newValue = Math.max(0, value - 1);
    if (newValue !== value) {
      onChange(newValue);
    }
  };

  const handleIncrease = () => {
    const newValue = Math.min(5, value + 1);
    if (newValue !== value) {
      onChange(newValue);
    }
  };

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={handleDecrease}
        disabled={value <= 0}
        className="h-7 w-7 p-0 hover:bg-muted"
        title="Diminuir nível"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <div
        className={cn(
          "flex items-center justify-center w-8 h-7 font-semibold text-sm",
          isModified ? "text-orange-600" : "text-foreground"
        )}
        title={`Nível de desempenho: ${value} (0-5)`}
      >
        {value}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={handleIncrease}
        disabled={value >= 5}
        className="h-7 w-7 p-0 hover:bg-muted"
        title="Aumentar nível"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}


export const PerformanceLevelTable = forwardRef<PerformanceLevelTableRef, PerformanceLevelTableProps>(({
  users,
  isLoading,
  error,
  visibleColumns,
  selectedUserIds,
  onSelectionChange,
  onDataChange,
  onRefresh,
  onPendingChangesUpdate,
  className,
  onSort,
  getSortDirection,
  getSortOrder
}, ref) => {
  const [modifiedUsers, setModifiedUsers] = useState<Set<string>>(new Set());
  const [pendingChanges, setPendingChanges] = useState<Map<string, number>>(new Map());
  const [userPerformanceLevels, setUserPerformanceLevels] = useState<Map<string, number>>(new Map());

  const queryClient = useQueryClient();
  const { update, updateAsync, isUpdating, updateMutation, batchUpdate } = useUserMutations();

  // Get current payroll period (26th-25th cycle)
  // If today is Sept 26th or later, this returns October
  const { year: currentYear, month: currentMonth } = getCurrentPayrollPeriod();

  // Use bonus simulation to get live bonus calculations
  // This uses the same endpoint as the bonus simulation page and the payroll detail page
  const { data: simulationData, isLoading: isLoadingBonuses, error: bonusError, refetch: refetchBonuses } = useBonusSimulation({
    year: currentYear,
    month: currentMonth,
  });

  // Initialize user performance levels from props
  useEffect(() => {
    const levels = new Map<string, number>();
    users.forEach(user => {
      levels.set(user.id, user.performanceLevel || 0);
    });
    setUserPerformanceLevels(levels);
  }, [users]);

  // Map bonus data by user ID from simulation data
  // When user changes performance level, we need to recalculate the bonus
  // The bonus is calculated using a matrix (position level × performance level)
  // We approximate the recalculation by scaling proportionally based on performance level change
  const bonusByUserId = useMemo(() => {
    const map = new Map<string, number>();

    if (simulationData?.data?.users && Array.isArray(simulationData.data.users)) {
      simulationData.data.users.forEach((simulationUser: any) => {
        if (!simulationUser.userId || simulationUser.bonusAmount == null) return;

        // Check if this user has a pending performance level change
        const currentPerformanceLevel = pendingChanges.get(simulationUser.userId);
        const originalPerformanceLevel = simulationUser.performanceLevel;

        if (currentPerformanceLevel != null && currentPerformanceLevel !== originalPerformanceLevel) {
          // User has a pending change - we need to estimate the new bonus
          // The bonus calculation uses a matrix where different performance levels have different multipliers
          // This is an approximation - the real calculation happens on the backend after saving

          // Performance level multipliers (approximate from the matrix)
          // Level 1 = 1x base, Level 2 = 2x base, Level 3 = 3x base, Level 4 = 3.5x base, Level 5 = 4x base
          const multipliers: Record<number, number> = {
            0: 0,
            1: 1.0,
            2: 2.0,
            3: 3.0,
            4: 3.5,
            5: 4.0,
          };

          const originalMultiplier = multipliers[originalPerformanceLevel] || 1.0;
          const newMultiplier = multipliers[currentPerformanceLevel] || 1.0;

          if (originalMultiplier > 0) {
            // Calculate the base bonus (without performance multiplier)
            const baseBonus = simulationUser.bonusAmount / originalMultiplier;
            // Apply the new performance multiplier
            const recalculatedBonus = baseBonus * newMultiplier;
            map.set(simulationUser.userId, Math.round(recalculatedBonus * 100) / 100);
          } else {
            map.set(simulationUser.userId, simulationUser.bonusAmount);
          }
        } else {
          // No pending change - use the original bonus from simulation
          map.set(simulationUser.userId, simulationUser.bonusAmount);
        }
      });
    }

    return map;
  }, [simulationData, pendingChanges]);

  // Use GLOBAL totals from simulation (all eligible users, not just visible ones)
  // This matches the payroll page which shows all users
  const totalBonusSum = useMemo(() => {
    return simulationData?.data?.summary?.totalBonusAmount || 0;
  }, [simulationData]);

  // Get average tasks per user from simulation summary (sector-wide average)
  const averageTasksPerUser = useMemo(() => {
    return simulationData?.data?.summary?.averageTasksPerUser || 0;
  }, [simulationData]);

  // Check if there are any modified users
  const hasModifiedUsers = modifiedUsers.size > 0;

  // Notify parent component of pending changes with debouncing
  useEffect(() => {
    if (!onPendingChangesUpdate) return;

    // Debounce the update to prevent rapid parent re-renders
    const timeoutId = setTimeout(() => {
      onPendingChangesUpdate(pendingChanges, modifiedUsers);
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [pendingChanges, modifiedUsers, onPendingChangesUpdate]);


  const handlePerformanceLevelChange = useCallback(
    (userId: string, newLevel: number) => {
      const user = users.find(u => u.id === userId);
      if (!user) return;

      // Mark as modified if different from original
      if (newLevel !== user.performanceLevel) {
        setModifiedUsers(prev => new Set(prev.add(userId)));
        setPendingChanges(prev => new Map(prev.set(userId, newLevel)));

        // Update the local performance levels for immediate bonus recalculation
        setUserPerformanceLevels(prev => new Map(prev.set(userId, newLevel)));
      } else {
        setModifiedUsers(prev => {
          const newSet = new Set(prev);
          newSet.delete(userId);
          return newSet;
        });
        setPendingChanges(prev => {
          const newMap = new Map(prev);
          newMap.delete(userId);
          return newMap;
        });

        // Reset to original performance level
        setUserPerformanceLevels(prev => new Map(prev.set(userId, user.performanceLevel)));
      }
    },
    [users]
  );

  const handlePerformanceLevelBlur = useCallback(
    async (userId: string) => {
      // Don't auto-save anymore, just keep the pending changes
      // Changes will be saved when the user clicks the Save button
    },
    []
  );

  // Save all pending changes
  const saveAllChanges = useCallback(async () => {
    if (pendingChanges.size === 0) return;

    const updates = Array.from(pendingChanges.entries()).map(([userId, performanceLevel]) => ({
      id: userId,
      data: { performanceLevel }
    }));

    try {
      // Use batch update if available, otherwise update one by one
      if (batchUpdate) {
        await batchUpdate.mutateAsync({ updates });
      } else {
        // Fallback to individual updates
        await Promise.all(
          updates.map(update =>
            updateAsync({
              id: update.id,
              data: update.data,
              include: undefined
            })
          )
        );
      }

      // Clear visual indicators after successful update
      setModifiedUsers(new Set());
      setPendingChanges(new Map());

      // Invalidate bonus queries to refetch with new performance levels
      queryClient.invalidateQueries({ queryKey: bonusKeys.all });
      refetchBonuses();

      // Manually refresh the list after successful update
      if (onRefresh) {
        onRefresh();
      }
    } catch (error) {
      // API client already shows error toasts, but we can add context if needed
      console.error("Failed to update performance levels:", error);
    }
  }, [pendingChanges, batchUpdate, updateAsync, queryClient, refetchBonuses, onRefresh]);

  // Revert all pending changes
  const revertAllChanges = useCallback(() => {
    setModifiedUsers(new Set());
    setPendingChanges(new Map());
    setUserPerformanceLevels(prev => {
      const newLevels = new Map(prev);
      users.forEach(user => {
        newLevels.set(user.id, user.performanceLevel || 0);
      });
      return newLevels;
    });
    toast.info("Alterações revertidas");
  }, [users]);

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    saveAllChanges,
    revertAllChanges
  }), [saveAllChanges, revertAllChanges]);

  // Helper function to render sort indicator
  const renderSortIndicator = (columnKey: string) => {
    if (!getSortDirection || !getSortOrder) return null;

    const sortDirection = getSortDirection(columnKey);
    const sortOrder = getSortOrder(columnKey);

    return (
      <div className="inline-flex items-center ml-1">
        {sortDirection === null && <IconSelector className="h-4 w-4 text-muted-foreground" />}
        {sortDirection === "asc" && <IconChevronUp className="h-4 w-4 text-foreground" />}
        {sortDirection === "desc" && <IconChevronDown className="h-4 w-4 text-foreground" />}
        {sortOrder !== null && sortOrder > 0 && <span className="text-xs ml-0.5">{sortOrder + 1}</span>}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="space-y-4">
          {[...Array(10)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <div className="flex items-center justify-center text-red-500 mb-2">
          <AlertCircle className="h-5 w-5 mr-2" />
          Erro ao carregar dados
        </div>
        <p className="text-sm text-gray-500">
          Tente recarregar a página ou contate o suporte técnico.
        </p>
      </div>
    );
  }

  if (!users || users.length === 0) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500">Nenhum colaborador encontrado.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg flex flex-col overflow-hidden h-full">
      {isUpdating && (
        <div className="absolute inset-0 bg-white/50 flex items-center justify-center z-10 rounded-lg">
          <div className="bg-white p-4 rounded-lg shadow-lg flex items-center space-x-2">
            <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
            <span className="text-sm">Salvando alterações...</span>
          </div>
        </div>
      )}

      {/* Fixed Header Table */}
      <div className="border-l border-r border-t border-border rounded-t-lg overflow-hidden">
        <Table className="w-full table-fixed">
          <TableHeader className="[&_tr]:border-b-0 [&_tr]:hover:bg-muted">
            <TableRow className="bg-muted hover:bg-muted even:bg-muted">
              {visibleColumns.has("payrollNumber") && (
                <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted w-32 p-0 !border-r-0">
                  {onSort ? (
                    <button
                      onClick={() => onSort("payrollNumber")}
                      className="flex items-center gap-1 w-full h-full min-h-[2.5rem] px-4 py-2 hover:bg-muted/80 transition-colors cursor-pointer text-left border-0 bg-transparent"
                    >
                      <span className="truncate">Nº FOLHA</span>
                      {renderSortIndicator("payrollNumber")}
                    </button>
                  ) : (
                    <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">
                      <span className="truncate">Nº FOLHA</span>
                    </div>
                  )}
                </TableHead>
              )}
              {visibleColumns.has("name") && (
                <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted p-0 !border-r-0">
                  {onSort ? (
                    <button
                      onClick={() => onSort("name")}
                      className="flex items-center gap-1 w-full h-full min-h-[2.5rem] px-4 py-2 hover:bg-muted/80 transition-colors cursor-pointer text-left border-0 bg-transparent"
                    >
                      <span className="truncate">NOME</span>
                      {renderSortIndicator("name")}
                    </button>
                  ) : (
                    <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">
                      <span className="truncate">NOME</span>
                    </div>
                  )}
                </TableHead>
              )}
              {visibleColumns.has("email") && (
                <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted w-48 p-0 !border-r-0">
                  {onSort ? (
                    <button
                      onClick={() => onSort("email")}
                      className="flex items-center gap-1 w-full h-full min-h-[2.5rem] px-4 py-2 hover:bg-muted/80 transition-colors cursor-pointer text-left border-0 bg-transparent"
                    >
                      <span className="truncate">EMAIL</span>
                      {renderSortIndicator("email")}
                    </button>
                  ) : (
                    <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">
                      <span className="truncate">EMAIL</span>
                    </div>
                  )}
                </TableHead>
              )}
              {visibleColumns.has("phone") && (
                <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted w-40 p-0 !border-r-0">
                  {onSort ? (
                    <button
                      onClick={() => onSort("phone")}
                      className="flex items-center gap-1 w-full h-full min-h-[2.5rem] px-4 py-2 hover:bg-muted/80 transition-colors cursor-pointer text-left border-0 bg-transparent"
                    >
                      <span className="truncate">TELEFONE</span>
                      {renderSortIndicator("phone")}
                    </button>
                  ) : (
                    <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">
                      <span className="truncate">TELEFONE</span>
                    </div>
                  )}
                </TableHead>
              )}
              {visibleColumns.has("position") && (
                <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted w-48 p-0 !border-r-0">
                  {onSort ? (
                    <button
                      onClick={() => onSort("position.name")}
                      className="flex items-center gap-1 w-full h-full min-h-[2.5rem] px-4 py-2 hover:bg-muted/80 transition-colors cursor-pointer text-left border-0 bg-transparent"
                    >
                      <span className="truncate">CARGO</span>
                      {renderSortIndicator("position.name")}
                    </button>
                  ) : (
                    <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">
                      <span className="truncate">CARGO</span>
                    </div>
                  )}
                </TableHead>
              )}
              {visibleColumns.has("sector") && (
                <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted w-40 p-0 !border-r-0">
                  {onSort ? (
                    <button
                      onClick={() => onSort("sector.name")}
                      className="flex items-center gap-1 w-full h-full min-h-[2.5rem] px-4 py-2 hover:bg-muted/80 transition-colors cursor-pointer text-left border-0 bg-transparent"
                    >
                      <span className="truncate">SETOR</span>
                      {renderSortIndicator("sector.name")}
                    </button>
                  ) : (
                    <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">
                      <span className="truncate">SETOR</span>
                    </div>
                  )}
                </TableHead>
              )}
              {visibleColumns.has("performanceLevel") && (
                <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted w-44 p-0 !border-r-0">
                  {onSort ? (
                    <button
                      onClick={() => onSort("performanceLevel")}
                      className="flex items-center gap-1 w-full h-full min-h-[2.5rem] px-4 py-2 hover:bg-muted/80 transition-colors cursor-pointer text-left border-0 bg-transparent"
                    >
                      <span className="truncate">DESEMPENHO (0-5)</span>
                      {renderSortIndicator("performanceLevel")}
                    </button>
                  ) : (
                    <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">
                      <span className="truncate">DESEMPENHO (0-5)</span>
                    </div>
                  )}
                </TableHead>
              )}
              {visibleColumns.has("bonus") && (
                <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted w-32 p-0 !border-r-0">
                  <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">
                    <span className="truncate">BONIFICAÇÃO</span>
                  </div>
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
        </Table>
      </div>

      {/* Scrollable Body Table */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden border-l border-r border-b border-border rounded-b-lg">
        <Table className="w-full table-fixed">
          <TableBody>
          {users.map((user, index) => {
            const isModified = modifiedUsers.has(user.id);
            const currentLevel = pendingChanges.get(user.id) ?? user.performanceLevel;

            return (
              <TableRow
                key={user.id}
                className={cn(
                  "cursor-pointer transition-colors border-b border-border h-10",
                  index % 2 === 1 && "bg-muted/10",
                  "hover:bg-muted/20",
                  isModified && "bg-yellow-50 hover:bg-yellow-100"
                )}
              >
                {visibleColumns.has("payrollNumber") && (
                  <TableCell className="w-32 p-0">
                    <div className="px-3 py-1.5 text-sm text-gray-600 font-medium truncate">
                      {user.payrollNumber || "—"}
                    </div>
                  </TableCell>
                )}
                {visibleColumns.has("name") && (
                  <TableCell className="p-0">
                    <div className="px-3 py-1.5 font-medium truncate">
                      {user.name}
                      {isModified && (
                        <span className="ml-2 inline-block w-2 h-2 bg-orange-600 rounded-full animate-pulse" title="Modificado" />
                      )}
                    </div>
                  </TableCell>
                )}
                {visibleColumns.has("email") && (
                  <TableCell className="w-48 p-0">
                    <div className="px-3 py-1.5 text-sm text-gray-600 truncate">
                      {user.email || "—"}
                    </div>
                  </TableCell>
                )}
                {visibleColumns.has("phone") && (
                  <TableCell className="w-40 p-0">
                    <div className="px-3 py-1.5 text-sm text-gray-600 truncate">
                      {user.phone || "—"}
                    </div>
                  </TableCell>
                )}
                {visibleColumns.has("position") && (
                  <TableCell className="w-48 p-0">
                    <div className="px-3 py-1.5 text-sm text-gray-600 truncate">
                      {user.position?.name || "—"}
                    </div>
                  </TableCell>
                )}
                {visibleColumns.has("sector") && (
                  <TableCell className="w-40 p-0">
                    <div className="px-3 py-1.5 text-sm text-gray-600 truncate">
                      {user.sector?.name || "—"}
                    </div>
                  </TableCell>
                )}
                {visibleColumns.has("performanceLevel") && (
                  <TableCell className="w-44 p-0">
                    <div className="px-3 py-1">
                      <PerformanceLevelSelector
                        value={currentLevel}
                        onChange={(newLevel) => handlePerformanceLevelChange(user.id, newLevel)}
                        onBlur={() => handlePerformanceLevelBlur(user.id)}
                        userId={user.id}
                        isModified={isModified}
                      />
                    </div>
                  </TableCell>
                )}
                {visibleColumns.has("bonus") && (
                  <TableCell className="w-32 p-0">
                    <div className="px-3 py-1.5 text-sm">
                      {isLoadingBonuses ? (
                        <Skeleton className="h-4 w-20" />
                      ) : bonusError ? (
                        <span className="text-red-500 text-xs" title={String(bonusError)}>Erro</span>
                      ) : (
                        <>
                          {bonusByUserId.has(user.id) && bonusByUserId.get(user.id)! > 0 ? (
                            <div className="flex items-center gap-1">
                              <span className={cn(
                                "font-medium transition-all duration-300",
                                isModified ? "text-orange-600 font-semibold" : "text-green-600"
                              )}>
                                {formatCurrency(bonusByUserId.get(user.id)!)}
                              </span>
                              {isModified && (
                                <span className="text-orange-600 text-xs" title="Valor será recalculado após salvar">
                                  *
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </>
                      )}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            );
          })}
          </TableBody>
        </Table>
      </div>

      {/* Summary and Info row */}
      {visibleColumns.has("bonus") && (totalBonusSum > 0 || averageTasksPerUser > 0) && (
        <div className={cn(
          "border-l border-r border-b border-border rounded-b-lg",
          hasModifiedUsers ? "bg-orange-50/50" : "bg-muted/30"
        )}>
          <div className="flex flex-col gap-2 px-4 py-3">
            {/* Average Tasks Per User */}
            {averageTasksPerUser > 0 && (
              <div className="flex items-center justify-between text-sm border-b border-border pb-2">
                <span className="font-medium text-muted-foreground">
                  Média de Tarefas por Colaborador:
                </span>
                <span className="font-semibold text-foreground">
                  {averageTasksPerUser.toFixed(2)} tarefas
                </span>
              </div>
            )}

            {/* Total Bonuses */}
            {totalBonusSum > 0 && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">Total de Bonificações:</span>
                  {hasModifiedUsers && (
                    <Badge variant="secondary" className="text-xs bg-orange-100">
                      {modifiedUsers.size} com alterações
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {hasModifiedUsers && (
                    <span className="text-xs text-orange-600 italic">
                      * Valores serão recalculados após salvar
                    </span>
                  )}
                  <span className={cn(
                    "font-bold text-lg",
                    hasModifiedUsers ? "text-orange-600" : "text-green-600"
                  )}>
                    {formatCurrency(totalBonusSum)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

PerformanceLevelTable.displayName = 'PerformanceLevelTable';