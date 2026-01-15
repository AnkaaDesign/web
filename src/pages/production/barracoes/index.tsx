import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/ui/page-header';
import { PrivilegeRoute } from '@/components/navigation/privilege-route';
import { SECTOR_PRIVILEGES, routes, FAVORITE_PAGES, TASK_STATUS } from '@/constants';
import { usePageTracker } from '@/hooks/use-page-tracker';
import { usePrivileges } from '@/hooks/usePrivileges';
import { useTasks } from '@/hooks/useTask';
import { truckService } from '@/api-client';
import { GarageView } from '@/components/production/garage';
import type { GarageTruck } from '@/components/production/garage';
import { IconRefresh, IconDeviceFloppy, IconRestore } from '@tabler/icons-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';

// Type for pending changes
interface PendingChange {
  truckId: string;
  taskId: string;
  oldSpot: string | null;
  newSpot: string;
}

export function GaragesPage() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<Map<string, PendingChange>>(new Map());
  const [viewMode, setViewMode] = useState<'all' | 'week'>('all');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
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

  // Format date for display
  const formatDate = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);

    if (date.getTime() === today.getTime()) return 'Hoje';

    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${day}/${month}`;
  };

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

  // Fetch active tasks with trucks AND their layouts for dimensions
  const { data: tasksResponse, isLoading, error, refetch } = useTasks({
    page: 1,
    limit: 100,
    include: {
      truck: {
        include: {
          leftSideLayout: {
            include: {
              layoutSections: true,
            },
          },
          rightSideLayout: {
            include: {
              layoutSections: true,
            },
          },
        },
      },
      generalPainting: true,
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
      return truckService.batchUpdateSpots(batchUpdates);
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
  // Filter only tasks that are IN_PRODUCTION or PENDING and have a truck
  const garageTrucks = useMemo(() => {
    if (!tasksResponse?.data) {
      return [];
    }

    return tasksResponse.data
      .filter((task) => {
        // Only include tasks with trucks and status IN_PRODUCTION or PENDING
        if (!task.truck) return false;
        return task.status === TASK_STATUS.IN_PRODUCTION || task.status === TASK_STATUS.WAITING_PRODUCTION;
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

        // Add cabin if needed (trucks < 10m get 1.8m cabin - average Brazilian truck cab)
        const CABIN_THRESHOLD = 10;
        const CABIN_LENGTH = 1.8;
        const truckLength = sectionsSum > 0
          ? (sectionsSum < CABIN_THRESHOLD ? sectionsSum + CABIN_LENGTH : sectionsSum)
          : 10; // Default 10m if no sections

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
        };
      });
  }, [tasksResponse, pendingChanges]);

  // Handle truck movement (add to pending changes, don't save yet)
  const handleTruckMove = useCallback(
    (taskId: string, newSpot: string) => {
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
    (task1Id: string, spot1: string, task2Id: string, spot2: string) => {
      // Find both tasks
      const task1 = tasksResponse?.data?.find((t) => t.id === task1Id);
      const task2 = tasksResponse?.data?.find((t) => t.id === task2Id);

      if (!task1?.truck || !task2?.truck) return;

      const truck1 = task1.truck as any;
      const truck2 = task2.truck as any;

      // Update both in a single state update
      setPendingChanges((prev) => {
        const newMap = new Map(prev);

        // Get current spots (considering pending changes)
        const truck1CurrentSpot = prev.get(truck1.id)?.newSpot ?? truck1.spot;
        const truck2CurrentSpot = prev.get(truck2.id)?.newSpot ?? truck2.spot;

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

  // Handle refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    setPendingChanges(new Map()); // Clear pending changes on refresh
    await refetch();
    setIsRefreshing(false);
  };

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
            // View mode selector as custom action with React element label
            {
              key: 'view-mode',
              label: (
                <div className="flex gap-1.5 items-center relative">
                  <div className="flex rounded-lg border border-border overflow-visible">
                    <button
                      onClick={() => setViewMode('all')}
                      className={`h-9 px-4 text-xs font-medium transition-opacity duration-200 ${
                        viewMode === 'all'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-transparent text-foreground hover:bg-muted/30'
                      }`}
                    >
                      Grade
                    </button>
                    <div
                      className="relative"
                      onMouseEnter={() => {
                        // Clear any pending close timeout
                        if (datePickerTimeoutRef.current) {
                          clearTimeout(datePickerTimeoutRef.current);
                          datePickerTimeoutRef.current = null;
                        }
                        setShowDatePicker(true);
                      }}
                      onMouseLeave={() => {
                        // Delay closing to prevent flicker
                        datePickerTimeoutRef.current = setTimeout(() => {
                          setShowDatePicker(false);
                        }, 150);
                      }}
                    >
                      <button
                        className={`h-9 px-4 text-xs font-medium transition-opacity duration-200 border-l border-border ${
                          viewMode === 'week'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-transparent text-foreground hover:bg-muted/30'
                        }`}
                      >
                        Calendário
                      </button>

                      {/* Date picker dropdown */}
                      {showDatePicker && (
                        <div
                          className="absolute top-full right-0 bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[120px]"
                          style={{ zIndex: 9999 }}
                        >
                          {next5Days.map((day, index) => (
                            <button
                              key={index}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedDate(day);
                                setViewMode('week');
                                setShowDatePicker(false);
                                if (datePickerTimeoutRef.current) {
                                  clearTimeout(datePickerTimeoutRef.current);
                                  datePickerTimeoutRef.current = null;
                                }
                              }}
                              className="w-full px-4 py-2 text-left text-xs text-foreground hover:bg-muted/30 transition-colors block"
                            >
                              {formatDate(day)}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
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
            {
              key: 'refresh',
              label: 'Atualizar',
              icon: IconRefresh,
              onClick: handleRefresh,
              variant: 'outline' as const,
              disabled: isRefreshing || isUpdating,
            },
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
                className={isUpdating ? 'opacity-50 pointer-events-none' : ''}
                readOnly={!canEditGaragePositions}
                viewMode={viewMode}
                selectedDate={selectedDate}
              />
            </div>
          </div>
        </div>
      </div>
    </PrivilegeRoute>
  );
}

export default GaragesPage;
