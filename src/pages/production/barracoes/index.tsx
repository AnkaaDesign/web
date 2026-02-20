import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/ui/page-header';
import { PrivilegeRoute } from '@/components/navigation/privilege-route';
import { SECTOR_PRIVILEGES, routes, FAVORITE_PAGES, TASK_STATUS } from '@/constants';
import { usePageTracker } from '@/hooks/common/use-page-tracker';
import { usePrivileges } from '@/hooks/common/use-privileges';
import { useTasks } from '@/hooks/production/use-task';
import { batchUpdateSpots } from '@/api-client';
import { GarageView, TruckDetailModal } from '@/components/production/garage';
import type { GarageTruck } from '@/components/production/garage';
import { IconDeviceFloppy, IconRestore } from '@tabler/icons-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';

// Type for pending changes
interface PendingChange {
  truckId: string;
  taskId: string;
  oldSpot: string | null;
  newSpot: string | null;
}

const DAY_NAMES = ['Domingo', 'Segunda-Feira', 'Terça-Feira', 'Quarta-Feira', 'Quinta-Feira', 'Sexta-Feira', 'Sábado'];

export function GaragesPage() {
  const [pendingChanges, setPendingChanges] = useState<Map<string, PendingChange>>(new Map());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const datePickerTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const queryClient = useQueryClient();

  // Generate next 5 days for date picker
  const next5Days = useMemo(() => {
    const days: Date[] = [];
    const today = new Date();
    for (let i = 0; i < 5; i++) {
      const day = new Date(today);
      day.setDate(today.getDate() + i);
      days.push(day);
    }
    return days;
  }, []);

  const isToday = useCallback((date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const check = new Date(date);
    check.setHours(0, 0, 0, 0);
    return check.getTime() === today.getTime();
  }, []);

  // Format date as "Segunda-Feira - 24/08"
  const formatDateFull = useCallback((date: Date) => {
    const dayName = DAY_NAMES[date.getDay()];
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${dayName} - ${day}/${month}`;
  }, []);

  // Format date for the header display - "Hoje - 19/02" or "Segunda-Feira - 24/08"
  const formatDateForHeader = useCallback((date: Date) => {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    if (isToday(date)) return `Hoje - ${day}/${month}`;
    return formatDateFull(date);
  }, [isToday, formatDateFull]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (datePickerTimeoutRef.current) {
        clearTimeout(datePickerTimeoutRef.current);
      }
    };
  }, []);

  // Track page access
  usePageTracker({
    title: 'Barracões',
    icon: 'warehouse',
  });

  // Check privileges - only ADMIN, LOGISTIC, or team leaders can edit positions
  const { isAdmin, isTeamLeader, canAccess } = usePrivileges();
  const canEditGaragePositions = isAdmin || isTeamLeader || canAccess([SECTOR_PRIVILEGES.LOGISTIC]);

  // Fetch tasks with trucks for garage display
  // OR logic: include tasks where truck has a spot (any status), OR not completed with forecastDate <= today
  const todayStr = useMemo(() => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d.toISOString();
  }, []);

  const { data: tasksResponse, isLoading, error, refetch } = useTasks({
    page: 1,
    limit: 50,
    where: {
      truck: { isNot: null },
      OR: [
        // Trucks with a garage spot assigned (any status, including completed)
        { truck: { spot: { not: null } } },
        // Non-completed trucks with forecastDate <= today (for patio display)
        {
          status: { in: [TASK_STATUS.PREPARATION, TASK_STATUS.WAITING_PRODUCTION, TASK_STATUS.IN_PRODUCTION] },
          forecastDate: { lte: todayStr },
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

    return tasksResponse.data
      .filter((task) => {
        // Must have a truck
        if (!task.truck) return false;

        const truck = task.truck as any;

        // If truck has a spot assigned in a garage, always include it
        // (even if completed or without layout — use default length)
        if (truck?.spot) {
          return true;
        }

        // For patio/unassigned trucks: must have a layout defined (for dimensions)
        const layout = truck?.leftSideLayout || truck?.rightSideLayout;
        const layoutSections = layout?.layoutSections || [];
        if (layoutSections.length === 0) return false;

        // For patio: only include if forecastDate <= today OR entryDate <= today, AND status is not COMPLETED
        const forecastDate = (task as any).forecastDate;
        const entryDate = (task as any).entryDate;
        if (!forecastDate && !entryDate) return false;

        // Must not have COMPLETED status for patio display
        if (task.status === TASK_STATUS.COMPLETED) return false;

        // Show if truck already arrived (entryDate) or is expected (forecastDate)
        if (entryDate) {
          const entry = new Date(entryDate);
          entry.setHours(0, 0, 0, 0);
          if (entry <= today) return true;
        }

        if (forecastDate) {
          const forecast = new Date(forecastDate);
          forecast.setHours(0, 0, 0, 0);
          return forecast <= today;
        }

        return false;
      })
      .map((task): GarageTruck => {
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
        const currentSpot = pendingChange ? pendingChange.newSpot : (truck?.spot || null);

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
      const oldSpot = truck.spot || null;

      // Don't add if spot didn't change
      if (oldSpot === newSpot) return;

      // Add to pending changes
      setPendingChanges((prev) => {
        const newMap = new Map(prev);
        newMap.set(truckId, {
          truckId,
          taskId,
          oldSpot,
          newSpot,
        });
        return newMap;
      });
    },
    [tasksResponse]
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

  // Handle truck click to open detail modal
  const handleTruckClick = useCallback((taskId: string) => {
    setSelectedTaskId(taskId);
    setIsDetailModalOpen(true);
  }, []);

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
            {
              key: 'date-picker',
              label: (
                <div
                  className="relative"
                  onMouseEnter={() => {
                    if (datePickerTimeoutRef.current) {
                      clearTimeout(datePickerTimeoutRef.current);
                      datePickerTimeoutRef.current = null;
                    }
                    setShowDatePicker(true);
                  }}
                  onMouseLeave={() => {
                    datePickerTimeoutRef.current = setTimeout(() => {
                      setShowDatePicker(false);
                    }, 150);
                  }}
                >
                  <button className="h-9 px-4 text-sm font-medium rounded-lg border border-border bg-transparent text-foreground hover:bg-muted/30 transition-colors">
                    {formatDateForHeader(selectedDate)}
                  </button>

                  {showDatePicker && (
                    <div
                      className="absolute top-full right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[220px]"
                      style={{ zIndex: 9999 }}
                    >
                      {next5Days.map((day, index) => {
                        const selected = selectedDate.toDateString() === day.toDateString();
                        return (
                          <button
                            key={index}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDate(day);
                              setShowDatePicker(false);
                              if (datePickerTimeoutRef.current) {
                                clearTimeout(datePickerTimeoutRef.current);
                                datePickerTimeoutRef.current = null;
                              }
                            }}
                            className={`w-full px-4 py-2 text-left text-sm transition-colors block ${
                              selected
                                ? 'bg-primary/10 text-primary font-medium'
                                : 'text-foreground hover:bg-muted/30'
                            }`}
                          >
                            {isToday(day) ? `Hoje - ${day.getDate().toString().padStart(2, '0')}/${(day.getMonth() + 1).toString().padStart(2, '0')}` : formatDateFull(day)}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) as any,
            },
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
              <GarageView
                trucks={garageTrucks}
                onTruckMove={canEditGaragePositions ? handleTruckMove : undefined}
                onTruckSwap={canEditGaragePositions ? handleTruckSwap : undefined}
                onTruckClick={handleTruckClick}
                className={isUpdating ? 'opacity-50 pointer-events-none' : ''}
                readOnly={!canEditGaragePositions}
                viewMode="week"
                selectedDate={selectedDate}
              />
            </div>
          </div>
        </div>

        {/* Truck Detail Modal */}
        <TruckDetailModal
          taskId={selectedTaskId}
          open={isDetailModalOpen}
          onOpenChange={setIsDetailModalOpen}
        />
      </div>
    </PrivilegeRoute>
  );
}

export default GaragesPage;
