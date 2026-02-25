import { useState, useMemo, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/ui/page-header';
import { PrivilegeRoute } from '@/components/navigation/privilege-route';
import { SECTOR_PRIVILEGES, routes, FAVORITE_PAGES, TASK_STATUS } from '@/constants';
import { usePageTracker } from '@/hooks/common/use-page-tracker';
import { usePrivileges } from '@/hooks/common/use-privileges';
import { useTasks } from '@/hooks/production/use-task';
import { batchUpdateSpots, requestMovement } from '@/api-client';
import { getNextDaysForForecast } from '@/utils/business-days';
import { GarageView, SingleGarageView, TruckDetailModal } from '@/components/production/garage';
import type { GarageTruck } from '@/components/production/garage';
import { IconDeviceFloppy, IconRestore } from '@tabler/icons-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/common/use-toast';

// Type for pending changes
interface PendingChange {
  truckId: string;
  taskId: string;
  oldSpot: string | null;
  newSpot: string | null;
}

const DAY_NAMES_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function GaragesPage() {
  const [pendingChanges, setPendingChanges] = useState<Map<string, PendingChange>>(new Map());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'overview' | 'single-garage'>('overview');
  const [selectedGarage, setSelectedGarage] = useState<'B1' | 'B2' | 'B3' | 'YARD_WAIT'>('B1');
  const queryClient = useQueryClient();

  // Generate next 5 forecast days (today + 4 business days) — same as single view
  const next5Days = useMemo(() => getNextDaysForForecast(new Date(), 5), []);

  const isToday = useCallback((date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const check = new Date(date);
    check.setHours(0, 0, 0, 0);
    return check.getTime() === today.getTime();
  }, []);



  // Track page access
  usePageTracker({
    title: 'Barracões',
    icon: 'warehouse',
  });

  // Check privileges
  const { isAdmin, isTeamLeader, canAccess } = usePrivileges();
  const { toast } = useToast();
  const canDirectMove = isAdmin || isTeamLeader || canAccess([SECTOR_PRIVILEGES.LOGISTIC]);
  const canRequestMovement = canAccess([SECTOR_PRIVILEGES.PRODUCTION]) && !canDirectMove;
  const canEditGaragePositions = canDirectMove || canRequestMovement;

  // Movement request state (for production managers)
  const [movementRequest, setMovementRequest] = useState<{
    taskId: string;
    truckId: string;
    taskName: string;
    fromSpot: string | null;
    toSpot: string | null;
  } | null>(null);

  // Fetch tasks with trucks for garage display
  // OR logic: include tasks where truck has a spot (any status), OR not completed with forecastDate <= maxCalendarDate
  const todayStr = useMemo(() => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d.toISOString();
  }, []);

  // Max calendar date: last day shown in the date tabs (for fetching future forecast trucks)
  const maxCalendarDateStr = useMemo(() => {
    const lastDay = next5Days[next5Days.length - 1];
    const d = new Date(lastDay);
    d.setHours(23, 59, 59, 999);
    return d.toISOString();
  }, [next5Days]);

  const { data: tasksResponse, isLoading, error, refetch } = useTasks({
    page: 1,
    limit: 200,
    where: {
      truck: { isNot: null },
      OR: [
        // Trucks with a garage spot assigned (any status, including completed)
        { truck: { spot: { not: null } } },
        // Non-completed trucks with forecastDate <= maxCalendarDate (for patio display including future forecast)
        {
          status: { in: [TASK_STATUS.PREPARATION, TASK_STATUS.WAITING_PRODUCTION, TASK_STATUS.IN_PRODUCTION] },
          forecastDate: { lte: maxCalendarDateStr },
        },
        // Non-completed trucks that already arrived (have entryDate) but may not have forecastDate
        {
          status: { in: [TASK_STATUS.PREPARATION, TASK_STATUS.WAITING_PRODUCTION, TASK_STATUS.IN_PRODUCTION] },
          entryDate: { lte: todayStr },
        },
      ],
    },
    select: {
      id: true,
      name: true,
      status: true,
      serialNumber: true,
      forecastDate: true,
      finishedAt: true,
      entryDate: true,
      term: true,
      truck: {
        select: {
          id: true,
          spot: true,
          leftSideLayout: {
            select: {
              layoutSections: {
                select: {
                  width: true,
                },
              },
            },
          },
          rightSideLayout: {
            select: {
              layoutSections: {
                select: {
                  width: true,
                },
              },
            },
          },
        },
      },
      generalPainting: {
        select: {
          hex: true,
        },
      },
      sector: {
        select: {
          id: true,
          name: true,
        },
      },
      serviceOrders: {
        select: {
          id: true,
          status: true,
          type: true,
          description: true,
        },
      },
    },
  });

  // Update truck spots mutation - uses batch API for single transaction
  const updateTruckMutation = useMutation({
    mutationFn: async (updates: PendingChange[]) => {
      // Convert to batch format and update all trucks in single API call
      const batchUpdates = updates.map((change) => ({
        truckId: change.truckId,
        spot: change.newSpot,
      }));
      return batchUpdateSpots(batchUpdates);
    },
    onSuccess: async () => {
      // Toast is already shown by api client
      // Wait for refetch to complete BEFORE clearing pending changes
      // This prevents flicker where trucks briefly show original positions
      await queryClient.invalidateQueries({ queryKey: ['tasks'] });
      await refetch();
      // Only clear pending changes after fresh data is loaded
      setPendingChanges(new Map());
    },
  });

  // Transform tasks to garage trucks format with CORRECT length calculation
  // Filter tasks that have a truck with a layout defined
  // Display logic:
  // - Has spot → display in that spot (garage) - can be completed or not
  // - No spot AND forecastDate <= today AND not completed → display in patio
  const garageTrucks = useMemo(() => {
    if (!tasksResponse?.data) {
      return [];
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Status priority for deduplication: active tasks take precedence over completed/cancelled
    const STATUS_PRIORITY: Record<string, number> = {
      [TASK_STATUS.IN_PRODUCTION]: 1,
      [TASK_STATUS.WAITING_PRODUCTION]: 2,
      [TASK_STATUS.PREPARATION]: 3,
      [TASK_STATUS.COMPLETED]: 4,
      [TASK_STATUS.CANCELLED]: 5,
    };

    const isGarageSpot = (spot: string | null) =>
      !!spot && /^B\d_F\d_V\d$/.test(spot);

    const filtered = tasksResponse.data.filter((task) => {
      // Must have a truck
      if (!task.truck) return false;

      const truck = task.truck as any;
      const spot = truck?.spot as string | null;

      // If truck has a garage spot (B1_F1_V1, etc.), always include it
      // (even if completed or without layout — use default length)
      if (isGarageSpot(spot)) {
        return true;
      }

      // YARD_EXIT trucks are physically in the exit yard — always include
      // (show regardless of status or dates, until physically removed)
      if (spot === 'YARD_EXIT') {
        return true;
      }

      // YARD_WAIT trucks still need date/status checks below
      // (trucks without dates or completed trucks should not clutter the yard)

      // Yard trucks: include if forecastDate <= maxCalendarDate OR entryDate <= today, AND status is not COMPLETED
      // The GarageView calendar filter handles per-day visibility
      const forecastDate = (task as any).forecastDate;
      const entryDate = (task as any).entryDate;
      if (!forecastDate && !entryDate) return false;

      // Must not have COMPLETED status for yard display
      if (task.status === TASK_STATUS.COMPLETED) return false;

      // Show if truck already arrived (entryDate)
      if (entryDate) {
        const entry = new Date(entryDate);
        entry.setHours(0, 0, 0, 0);
        if (entry <= today) return true;
      }

      // Include trucks with forecastDate up to the max calendar day
      // (calendar filter in GarageView will handle per-day display)
      if (forecastDate) {
        const forecast = new Date(forecastDate);
        forecast.setHours(0, 0, 0, 0);
        const maxDay = new Date(next5Days[next5Days.length - 1]);
        maxDay.setHours(0, 0, 0, 0);
        return forecast <= maxDay;
      }

      return false;
    });

    // Deduplicate: when multiple trucks share the same spot (stale data from old logic),
    // keep only the most active task and move others to patio (null spot)
    const spotOwners = new Map<string, typeof filtered[0]>();
    const demotedTaskIds = new Set<string>();

    for (const task of filtered) {
      const truck = task.truck as any;
      const spot = truck?.spot;
      // Skip deduplication for null spots and yard spots (multiple trucks allowed)
      if (!spot || spot === 'YARD_WAIT' || spot === 'YARD_EXIT') continue;

      const existing = spotOwners.get(spot);
      if (!existing) {
        spotOwners.set(spot, task);
      } else {
        // Compare priorities: lower number = higher priority (more active)
        const existingPriority = STATUS_PRIORITY[existing.status] ?? 99;
        const newPriority = STATUS_PRIORITY[task.status] ?? 99;
        if (newPriority < existingPriority) {
          // New task is more active - demote the existing one
          demotedTaskIds.add(existing.id);
          spotOwners.set(spot, task);
        } else {
          // Existing task is more active or same - demote the new one
          demotedTaskIds.add(task.id);
        }
      }
    }

    return filtered.map((task): GarageTruck => {
      const truck = task.truck as any;

      // Get layout sections from leftSideLayout or rightSideLayout
      const layout = truck?.leftSideLayout || truck?.rightSideLayout;
      const layoutSections = layout?.layoutSections || [];

      // Calculate truck length from layout sections
      const sectionsSum = layoutSections.reduce(
        (sum: number, section: { width: number }) => sum + (section.width || 0),
        0
      );

      // Add cabin if needed - two-tier system based on truck body length
      // < 7m body: 2.0m cabin (small trucks)
      // 7-10m body: 2.4m cabin (larger trucks)
      // >= 10m body: no cabin (semi-trailers)
      const CABIN_THRESHOLD_SMALL = 7;
      const CABIN_THRESHOLD_LARGE = 10;
      const CABIN_LENGTH_SMALL = 2.0;
      const CABIN_LENGTH_LARGE = 2.4;
      let truckLength = 10; // Default 10m if no sections
      if (sectionsSum > 0) {
        if (sectionsSum < CABIN_THRESHOLD_SMALL) {
          truckLength = sectionsSum + CABIN_LENGTH_SMALL;
        } else if (sectionsSum < CABIN_THRESHOLD_LARGE) {
          truckLength = sectionsSum + CABIN_LENGTH_LARGE;
        } else {
          truckLength = sectionsSum;
        }
      }

      // Check if there's a pending change for this truck
      const pendingChange = pendingChanges.get(truck?.id);
      // Demoted trucks (duplicates at same spot) go to yard wait
      const isDemoted = demotedTaskIds.has(task.id);
      // Trucks without a spot default to YARD_WAIT (arriving trucks)
      const dbSpot = truck?.spot || 'YARD_WAIT';
      const currentSpot = pendingChange
        ? pendingChange.newSpot
        : isDemoted
          ? 'YARD_WAIT'
          : dbSpot;

      return {
        id: task.id,
        truckId: truck?.id,
        spot: currentSpot,
        taskName: task.name,
        serialNumber: (task as any).serialNumber || null,
        paintHex: (task.generalPainting as any)?.hex || null,
        length: truckLength,
        originalLength: sectionsSum > 0 ? sectionsSum : undefined, // Original length without cabin
        entryDate: (task as any).entryDate || null,
        term: (task as any).term || null,
        forecastDate: (task as any).forecastDate || null,
        finishedAt: (task as any).finishedAt || null,
        layoutInfo: layoutSections.length > 0 ? `${layoutSections.length} seções` : null,
        artworkInfo: null, // Can be enhanced later with artwork file count
        sectorId: (task as any).sector?.id || null,
        sectorName: (task as any).sector?.name || null,
        serviceOrders: (task as any).serviceOrders || [],
      };
    });
  }, [tasksResponse, pendingChanges]);

  // Handle truck movement (add to pending changes, don't save yet)
  const handleTruckMove = useCallback(
    (taskId: string, newSpot: string | null) => {
      // Find the task to get truck data
      const task = tasksResponse?.data?.find((t) => t.id === taskId);
      if (!task?.truck) return;

      const truck = task.truck as any;
      const truckId = truck.id;
      const originalSpot = truck.spot || null;

      // Production managers can only request movement, not directly move
      if (canRequestMovement) {
        setMovementRequest({
          taskId,
          truckId,
          taskName: task.name || '',
          fromSpot: originalSpot,
          toSpot: newSpot,
        });
        return;
      }

      // If moving back to original DB position, remove the pending change
      if (originalSpot === newSpot) {
        setPendingChanges((prev) => {
          const newMap = new Map(prev);
          newMap.delete(truckId);
          return newMap;
        });
        return;
      }

      // Add to pending changes
      setPendingChanges((prev) => {
        const newMap = new Map(prev);
        newMap.set(truckId, {
          truckId,
          taskId,
          oldSpot: originalSpot,
          newSpot,
        });
        return newMap;
      });
    },
    [tasksResponse, canRequestMovement]
  );

  // Handle truck swap (both trucks in a single state update)
  const handleTruckSwap = useCallback(
    (task1Id: string, spot1: string, task2Id: string, spot2: string | null) => {
      // Find both tasks
      const task1 = tasksResponse?.data?.find((t) => t.id === task1Id);
      const task2 = tasksResponse?.data?.find((t) => t.id === task2Id);

      if (!task1?.truck || !task2?.truck) return;

      const truck1 = task1.truck as any;
      const truck2 = task2.truck as any;

      // Update both in a single state update
      setPendingChanges((prev) => {
        const newMap = new Map(prev);

        // Add truck1 change (always add for swap, comparing with original DB spot)
        if (truck1.spot !== spot1) {
          newMap.set(truck1.id, {
            truckId: truck1.id,
            taskId: task1Id,
            oldSpot: truck1.spot || null,
            newSpot: spot1,
          });
        } else {
          // New spot matches original, so no change needed
          newMap.delete(truck1.id);
        }

        // Add truck2 change (always add for swap, comparing with original DB spot)
        if (truck2.spot !== spot2) {
          newMap.set(truck2.id, {
            truckId: truck2.id,
            taskId: task2Id,
            oldSpot: truck2.spot || null,
            newSpot: spot2,
          });
        } else {
          // New spot matches original, so no change needed
          newMap.delete(truck2.id);
        }

        return newMap;
      });
    },
    [tasksResponse]
  );

  // Save all pending changes
  const handleSaveChanges = useCallback(() => {
    if (pendingChanges.size === 0) return;
    const updates = Array.from(pendingChanges.values());
    updateTruckMutation.mutate(updates);
  }, [pendingChanges, updateTruckMutation]);

  // Restore all pending changes
  const handleRestoreChanges = useCallback(() => {
    setPendingChanges(new Map());
  }, []);

  // Handle garage select (switch to single-garage view)
  const handleGarageSelect = useCallback((garageId: 'B1' | 'B2' | 'B3' | 'YARD_WAIT' | 'YARD_EXIT') => {
    // YARD_EXIT doesn't have a single view mode
    if (garageId === 'YARD_EXIT') return;
    setSelectedGarage(garageId as 'B1' | 'B2' | 'B3' | 'YARD_WAIT');
    setViewMode('single-garage');
  }, []);

  // Handle back from single-garage view
  const handleBackToOverview = useCallback(() => {
    setViewMode('overview');
  }, []);

  // Handle truck click to open detail modal
  const handleTruckClick = useCallback((taskId: string) => {
    setSelectedTaskId(taskId);
    setIsDetailModalOpen(true);
  }, []);

  // Handle rejected move (sector-garage mismatch)
  const handleMoveRejected = useCallback((reason: string) => {
    toast({
      title: 'Movimentação não permitida',
      description: reason,
      variant: 'warning',
    });
  }, [toast]);

  // Handle movement request confirmation
  const handleConfirmMovementRequest = useCallback(async () => {
    if (!movementRequest) return;
    try {
      await requestMovement(movementRequest);
      toast({
        title: 'Solicitação enviada',
        description: 'A equipe de logística foi notificada sobre a movimentação.',
      });
    } catch {
      toast({
        title: 'Erro',
        description: 'Não foi possível enviar a solicitação.',
        variant: 'error',
      });
    }
    setMovementRequest(null);
  }, [movementRequest, toast]);

  const hasPendingChanges = pendingChanges.size > 0;
  const isUpdating = updateTruckMutation.isPending;

  if (isLoading) {
    return (
      <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.PRODUCTION, SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.LOGISTIC, SECTOR_PRIVILEGES.COMMERCIAL, SECTOR_PRIVILEGES.ADMIN]}>
        <div className="h-full flex flex-col px-4 pt-4">
          <PageHeader
            title="Barracões"
            breadcrumbs={[
              { label: 'Inicio', href: routes.home },
              { label: 'Producao', href: routes.production.root },
              { label: 'Barracões' },
            ]}
            favoritePage={FAVORITE_PAGES.PRODUCAO_GARAGENS_LISTAR}
          />
          <div className="flex-1 overflow-y-auto pb-6">
            <div className="mt-4 space-y-4">
              <div className="bg-card rounded-lg shadow-sm border border-border p-2 flex items-center justify-center" style={{ height: '700px' }}>
                <Skeleton className="h-[550px] w-full rounded-lg" />
              </div>
            </div>
          </div>
        </div>
      </PrivilegeRoute>
    );
  }

  if (error) {
    return (
      <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.PRODUCTION, SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.LOGISTIC, SECTOR_PRIVILEGES.COMMERCIAL, SECTOR_PRIVILEGES.ADMIN]}>
        <div className="h-full flex flex-col px-4 pt-4">
          <PageHeader
            title="Barracões"
            breadcrumbs={[
              { label: 'Inicio', href: routes.home },
              { label: 'Producao', href: routes.production.root },
              { label: 'Barracões' },
            ]}
            favoritePage={FAVORITE_PAGES.PRODUCAO_GARAGENS_LISTAR}
          />
          <div className="flex-1 overflow-y-auto pb-6">
            <div className="mt-4 space-y-4">
              <div className="bg-card rounded-lg shadow-sm border border-border p-2" style={{ height: '700px' }}>
                <Alert variant="destructive">
                  <AlertDescription>
                    Erro ao carregar barracões. Por favor, tente novamente mais tarde.
                    {error && (error as Error).message && (
                      <div className="mt-2 text-sm">Detalhes: {(error as Error).message}</div>
                    )}
                  </AlertDescription>
                </Alert>
              </div>
            </div>
          </div>
        </div>
      </PrivilegeRoute>
    );
  }

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.PRODUCTION, SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.LOGISTIC, SECTOR_PRIVILEGES.COMMERCIAL, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="h-full flex flex-col px-4 pt-4">
        <PageHeader
          title="Barracões"
          breadcrumbs={[
            { label: 'Inicio', href: routes.home },
            { label: 'Producao', href: routes.production.root },
            { label: 'Barracões' },
          ]}
          favoritePage={FAVORITE_PAGES.PRODUCAO_GARAGENS_LISTAR}
          actions={[
            // Garage selector tabs (single-garage mode)
            ...(viewMode === 'single-garage'
              ? [
                  {
                    key: 'garage-tabs',
                    label: (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={handleBackToOverview}
                          className="px-3 py-1.5 text-sm font-medium rounded-md transition-colors bg-muted/50 text-muted-foreground hover:bg-muted"
                        >
                          ← Geral
                        </button>
                        <div className="flex gap-1 ml-1">
                          {([
                            { id: 'YARD_WAIT', label: 'Espera' },
                            { id: 'B1', label: 'B1' },
                            { id: 'B2', label: 'B2' },
                            { id: 'B3', label: 'B3' },
                          ] as const).map(({ id, label }) => (
                            <button
                              key={id}
                              onClick={() => setSelectedGarage(id)}
                              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                                selectedGarage === id
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) as any,
                  },
                ]
              : []),
            ...(viewMode === 'overview'
              ? [
                  {
                    key: 'date-tabs',
                    label: (
                      <div className="flex gap-1">
                        {next5Days.map((day, index) => {
                          const selected = selectedDate.toDateString() === day.toDateString();
                          const d = day.getDate().toString().padStart(2, '0');
                          const m = (day.getMonth() + 1).toString().padStart(2, '0');
                          const label = isToday(day) ? `Hoje` : `${DAY_NAMES_SHORT[day.getDay()]} ${d}/${m}`;
                          return (
                            <button
                              key={index}
                              onClick={() => setSelectedDate(day)}
                              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                                selected
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    ) as any,
                  },
                ]
              : []),
            ...(hasPendingChanges
              ? [
                  {
                    key: 'restore',
                    label: 'Restaurar',
                    icon: IconRestore,
                    onClick: handleRestoreChanges,
                    variant: 'outline' as const,
                    disabled: isUpdating,
                  },
                  {
                    key: 'save',
                    label: `Salvar (${pendingChanges.size})`,
                    icon: IconDeviceFloppy,
                    onClick: handleSaveChanges,
                    variant: 'default' as const,
                    disabled: isUpdating,
                  },
                ]
              : []),
          ]}
        />

        {/* Scrollable Content - flex container to fill remaining space */}
        <div className="flex-1 flex flex-col overflow-hidden pb-6">
          <div className="flex-1 mt-4">
            <div className="bg-card rounded-lg shadow-sm border border-border p-2 h-full">
              {viewMode === 'overview' ? (
                <GarageView
                  trucks={garageTrucks}
                  onTruckMove={canEditGaragePositions ? handleTruckMove : undefined}
                  onTruckSwap={canEditGaragePositions ? handleTruckSwap : undefined}
                  onTruckClick={handleTruckClick}
                  onGarageSelect={handleGarageSelect}
                  onMoveRejected={handleMoveRejected}
                  className={isUpdating ? 'opacity-50 pointer-events-none' : ''}
                  readOnly={!canEditGaragePositions}
                  viewMode="week"
                  selectedDate={selectedDate}
                />
              ) : (
                <SingleGarageView
                  garageId={selectedGarage}
                  trucks={garageTrucks}
                  onTruckMove={canEditGaragePositions ? handleTruckMove : undefined}
                  onTruckSwap={canEditGaragePositions ? handleTruckSwap : undefined}
                  onTruckClick={handleTruckClick}
                  className={isUpdating ? 'opacity-50 pointer-events-none' : ''}
                  readOnly={!canEditGaragePositions}
                />
              )}
            </div>
          </div>
        </div>

        {/* Truck Detail Modal */}
        <TruckDetailModal
          taskId={selectedTaskId}
          open={isDetailModalOpen}
          onOpenChange={setIsDetailModalOpen}
        />

        {/* Movement Request Confirmation Dialog */}
        <AlertDialog open={!!movementRequest} onOpenChange={(open) => !open && setMovementRequest(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Solicitar Movimentação</AlertDialogTitle>
              <AlertDialogDescription>
                Deseja solicitar a movimentação do caminhão &quot;{movementRequest?.taskName}&quot;?
                A equipe de logística será notificada.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmMovementRequest}>
                Solicitar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </PrivilegeRoute>
  );
}

export default GaragesPage;
