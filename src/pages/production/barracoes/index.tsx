import { useState, useMemo, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeaderWithFavorite } from '@/components/ui/page-header-with-favorite';
import { PrivilegeRoute } from '@/components/navigation/privilege-route';
import { SECTOR_PRIVILEGES, routes, FAVORITE_PAGES, TASK_STATUS } from '@/constants';
import { usePageTracker } from '@/hooks/use-page-tracker';
import { usePrivileges } from '@/hooks/usePrivileges';
import { useTasks } from '@/hooks/useTask';
import { truckService } from '@/api-client';
import { GarageView } from '@/components/production/garage';
import type { GarageTruck } from '@/components/production/garage';
import { IconBuildingWarehouse, IconRefresh, IconDeviceFloppy, IconRestore } from '@tabler/icons-react';
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
  const queryClient = useQueryClient();

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
        return task.status === TASK_STATUS.IN_PRODUCTION || task.status === TASK_STATUS.PENDING;
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
      <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.PRODUCTION, SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.ADMIN]}>
        <div className="flex flex-col h-full space-y-6">
          <PageHeaderWithFavorite
            title="Barracões"
            icon={IconBuildingWarehouse}
            favoritePage={FAVORITE_PAGES.PRODUCAO_CRONOGRAMA_LISTAR}
            breadcrumbs={[
              { label: 'Inicio', href: routes.home },
              { label: 'Producao', href: routes.production.root },
              { label: 'Barracões' },
            ]}
          />

          <div className="flex-1 flex items-center justify-center">
            <Skeleton className="h-[550px] w-[600px] rounded-lg" />
          </div>
        </div>
      </PrivilegeRoute>
    );
  }

  if (error) {
    return (
      <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.PRODUCTION, SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.ADMIN]}>
        <div className="flex flex-col h-full space-y-4">
          <PageHeaderWithFavorite
            title="Barracões"
            icon={IconBuildingWarehouse}
            favoritePage={FAVORITE_PAGES.PRODUCAO_CRONOGRAMA_LISTAR}
            breadcrumbs={[
              { label: 'Inicio', href: routes.home },
              { label: 'Producao', href: routes.production.root },
              { label: 'Barracões' },
            ]}
          />
          <Alert variant="destructive">
            <AlertDescription>
              Erro ao carregar barracões. Por favor, tente novamente mais tarde.
              {error && (error as Error).message && (
                <div className="mt-2 text-sm">Detalhes: {(error as Error).message}</div>
              )}
            </AlertDescription>
          </Alert>
        </div>
      </PrivilegeRoute>
    );
  }

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.PRODUCTION, SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="flex flex-col h-full space-y-4">
        <div className="flex-shrink-0">
          <PageHeaderWithFavorite
            title="Barracões"
            icon={IconBuildingWarehouse}
            favoritePage={FAVORITE_PAGES.PRODUCAO_CRONOGRAMA_LISTAR}
            breadcrumbs={[
              { label: 'Inicio', href: routes.home },
              { label: 'Producao', href: routes.production.root },
              { label: 'Barracões' },
            ]}
            actions={[
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
        </div>

        {/* Main Content - fills available space with minimal padding */}
        <div className="flex-1 min-h-0 bg-card rounded-lg shadow-sm border border-border p-2">
          <GarageView
            trucks={garageTrucks}
            onTruckMove={canEditGaragePositions ? handleTruckMove : undefined}
            onTruckSwap={canEditGaragePositions ? handleTruckSwap : undefined}
            className={isUpdating ? 'opacity-50 pointer-events-none' : ''}
            readOnly={!canEditGaragePositions}
          />
        </div>
      </div>
    </PrivilegeRoute>
  );
}

export default GaragesPage;
