import { useState, useMemo, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  IconRefresh,
  IconShield,
  IconTrash,
  IconAlertTriangle,
  IconFilter,
} from "@tabler/icons-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { ShowSelectedToggle } from "@/components/ui/show-selected-toggle";
import { useAuth } from "@/contexts/auth-context";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { hasPrivilege } from "@/utils/user";
import { routes } from "@/constants/routes";
import { SECTOR_PRIVILEGES } from "@/constants/enums";
import {
  useThrottlerStats,
  useThrottlerKeys,
  useBlockedKeys,
  useThrottlerMutations,
} from "@/hooks/common/use-throttler";
import { ThrottlerKeysTable } from "@/components/server/throttler/throttler-keys-table";
import { ThrottlerFilters } from "@/components/server/throttler/throttler-filters";
import type { ThrottlerFiltersData } from "@/components/server/throttler/throttler-filters";
import { useTableState } from "@/hooks/common/use-table-state";
import type { ThrottlerKey, BlockedKey } from "@/api-client/throttler";
import { debounce } from "lodash";

export function RateLimitingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Check admin privileges
  const isAdmin = user?.sector?.privileges
    ? hasPrivilege(user as any, SECTOR_PRIVILEGES.ADMIN)
    : false;

  // Track page access
  usePageTracker({
    title: "Rate Limiting",
    icon: "shield",
  });

  // Redirect if not admin
  useEffect(() => {
    if (!isAdmin && user) {
      navigate(routes.home);
    }
  }, [isAdmin, user, navigate]);

  // State
  const [searchTerm, setSearchTerm] = useState("");
  const [displaySearchText, setDisplaySearchText] = useState("");
  const [showBlockedOnly, setShowBlockedOnly] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<ThrottlerFiltersData>({
    controllers: [],
    identifiers: [],
    throttlerNames: [],
    onlyBlocked: false,
  });
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [clearAction, setClearAction] = useState<{
    type: "all" | "blocked" | "selected";
    keys?: (ThrottlerKey | BlockedKey)[];
  } | null>(null);

  // Data fetching with auto-refresh every 10 seconds
  const {
    data: stats,
    isLoading: statsLoading,
    refetch: refetchStats,
  } = useThrottlerStats();

  const {
    data: allKeysResponse,
    isLoading: keysLoading,
    refetch: refetchKeys,
  } = useThrottlerKeys(undefined, 1000); // Get up to 1000 keys

  const {
    data: blockedKeysResponse,
    isLoading: blockedKeysLoading,
    refetch: refetchBlocked,
  } = useBlockedKeys();

  // Mutations
  const {
    clearKeys,
    clearSpecificKey,
    clearBlockedKeys,
  } = useThrottlerMutations();

  // Combine all keys and blocked keys
  const allKeys = useMemo(() => {
    const throttlerKeys = allKeysResponse?.data || [];
    const blockedKeys = blockedKeysResponse?.data || [];

    // Merge, avoiding duplicates
    const keyMap = new Map<string, ThrottlerKey | BlockedKey>();

    throttlerKeys.forEach((key) => {
      keyMap.set(key.key, key);
    });

    blockedKeys.forEach((key) => {
      keyMap.set(key.key, { ...key, isBlocked: true } as any);
    });

    return Array.from(keyMap.values());
  }, [allKeysResponse, blockedKeysResponse]);

  // Extract unique values for filters
  const availableControllers = useMemo(() => {
    const controllers = new Set<string>();
    allKeys.forEach((key) => {
      if (key.controller) {
        controllers.add(key.controller);
      }
    });
    return Array.from(controllers).sort();
  }, [allKeys]);

  const availableIdentifiers = useMemo(() => {
    const identifiers = new Set<string>();
    allKeys.forEach((key) => {
      if (key.identifier) {
        identifiers.add(key.identifier);
      }
    });
    return Array.from(identifiers).sort();
  }, [allKeys]);

  const availableThrottlers = useMemo(() => {
    const throttlers = new Set<string>();
    allKeys.forEach((key) => {
      if (key.throttlerName) {
        throttlers.add(key.throttlerName);
      }
    });
    return Array.from(throttlers).sort();
  }, [allKeys]);

  // Debounced search
  const debouncedSearch = useMemo(
    () =>
      debounce((value: string) => {
        setSearchTerm(value);
      }, 300),
    []
  );

  const handleSearchChange = (value: string) => {
    setDisplaySearchText(value);
    debouncedSearch(value);
  };

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      debouncedSearch.cancel();
    };
  }, [debouncedSearch]);

  // Auto-refresh data every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      refetchStats();
      refetchKeys();
      refetchBlocked();
    }, 10000);

    return () => clearInterval(interval);
  }, [refetchStats, refetchKeys, refetchBlocked]);

  // Get table state for selected items functionality
  const { selectionCount, showSelectedOnly, toggleShowSelectedOnly } = useTableState({
    defaultPageSize: 40,
    resetSelectionOnPageChange: false,
  });

  // Handle clear actions
  const openClearDialog = (
    type: "all" | "blocked" | "selected",
    keys?: (ThrottlerKey | BlockedKey)[]
  ) => {
    setClearAction({ type, keys });
    setClearDialogOpen(true);
  };

  const handleClearKeys = (keys: (ThrottlerKey | BlockedKey)[]) => {
    openClearDialog("selected", keys);
  };

  const confirmClearAction = async () => {
    if (!clearAction) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("[RateLimiting] No clearAction set!");
      }
      return;
    }

    try {
      switch (clearAction.type) {
        case "all":
          await clearKeys.mutateAsync();
          break;
        case "blocked":
          await clearBlockedKeys.mutateAsync();
          break;
        case "selected":
          if (clearAction.keys && clearAction.keys.length > 0) {
            // Clear keys one by one (API client handles toasts)
            await Promise.all(
              clearAction.keys.map((key) => {
                return clearSpecificKey.mutateAsync(key.key);
              })
            );
          }
          break;
      }

      // Refresh data
      await refetchStats();
      await refetchKeys();
      await refetchBlocked();
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("[RateLimiting] Error clearing keys:", err);
        console.error("[RateLimiting] Error details:", {
          message: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
          clearAction,
        });
      }
    } finally {
      setClearDialogOpen(false);
      setClearAction(null);
    }
  };

  const handleRefresh = () => {
    refetchStats();
    refetchKeys();
    refetchBlocked();
  };

  const handleFilterChange = (filters: ThrottlerFiltersData) => {
    setAdvancedFilters(filters);
    // Also update the showBlockedOnly toggle
    setShowBlockedOnly(filters.onlyBlocked || false);
  };

  const hasActiveFilters = useMemo(() => {
    const result = (
      (advancedFilters.controllers?.length || 0) > 0 ||
      (advancedFilters.identifiers?.length || 0) > 0 ||
      (advancedFilters.throttlerNames?.length || 0) > 0
    );
    return result;
  }, [advancedFilters]);

  const totalFilterCount = useMemo(() => {
    const count = (
      (advancedFilters.controllers?.length || 0) +
      (advancedFilters.identifiers?.length || 0) +
      (advancedFilters.throttlerNames?.length || 0)
    );
    return count;
  }, [advancedFilters]);

  const isClearAllDisabled = useMemo(() => {
    const disabled = !stats?.data?.totalKeys || stats.data.totalKeys === 0;
    return Boolean(disabled);
  }, [stats]);

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="flex flex-col h-full overflow-hidden space-y-4">
      <PageHeader
        title="Rate Limiting"
        icon={IconShield}
        breadcrumbs={[
          { label: "Início", href: routes.home },
          { label: "Servidor", href: routes.server.root },
          { label: "Rate Limiting" },
        ]}
        actions={[
          {
            key: "refresh",
            label: "Atualizar",
            icon: IconRefresh as any,
            onClick: handleRefresh,
            variant: "outline" as const,
          },
          {
            key: "clear-all",
            label: "Limpar Tudo",
            icon: IconTrash as any,
            onClick: () => {
              openClearDialog("all");
            },
            variant: "destructive" as const,
            disabled: isClearAllDisabled,
          },
        ]}
      />

      <div className="flex-1 flex flex-col min-h-0">
        <Card className="flex-1 flex flex-col shadow-sm border border-border overflow-hidden">
          <CardContent className="flex-1 flex flex-col p-4 space-y-4 min-h-0 overflow-hidden">
          {/* Stats Overview */}
          {!statsLoading && stats?.data ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="border rounded-lg p-4">
                <div className="text-sm text-muted-foreground mb-1">Total de Chaves</div>
                <div className="text-2xl font-bold">{stats.data.totalKeys}</div>
              </div>
              <div className="border rounded-lg p-4">
                <div className="text-sm text-muted-foreground mb-1">Chaves Ativas</div>
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {stats.data.activeKeys}
                </div>
              </div>
              <div className="border rounded-lg p-4">
                <div className="text-sm text-muted-foreground mb-1">Chaves Bloqueadas</div>
                <div className="text-2xl font-bold text-red-600 dark:text-red-400 flex items-center gap-2">
                  {stats.data.blockedKeys > 0 ? (
                    <IconAlertTriangle className="h-5 w-5" />
                  ) : null}
                  {stats.data.blockedKeys}
                </div>
              </div>
            </div>
          ) : null}

          {/* Search and controls */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <TableSearchInput
              ref={searchInputRef}
              value={displaySearchText}
              onChange={handleSearchChange}
              placeholder="Buscar por endpoint, usuário, IP..."
              isPending={displaySearchText !== searchTerm}
            />
            <div className="flex gap-2">
              <ShowSelectedToggle
                showSelectedOnly={showSelectedOnly}
                onToggle={toggleShowSelectedOnly}
                selectionCount={selectionCount}
              />
              <Button
                variant={hasActiveFilters ? "default" : "outline"}
                size="default"
                onClick={() => setFiltersOpen(true)}
                className="group"
              >
                <IconFilter className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                <span className="text-foreground">
                  Filtros
                  {hasActiveFilters ? ` (${totalFilterCount})` : ""}
                </span>
              </Button>
              <Button
                variant={showBlockedOnly ? "default" : "outline"}
                size="default"
                onClick={() => setShowBlockedOnly(!showBlockedOnly)}
                className="group"
              >
                <IconAlertTriangle className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                <span className="text-foreground">Apenas Bloqueados</span>
              </Button>
            </div>
          </div>

          {/* Table */}
          <div className="flex-1 min-h-0">
            <ThrottlerKeysTable
              keys={allKeys}
              isLoading={keysLoading || blockedKeysLoading}
              onClearKeys={handleClearKeys}
              filters={{
                searchingFor: searchTerm,
                showBlockedOnly,
                controllers: advancedFilters.controllers,
                identifiers: advancedFilters.identifiers,
                throttlerNames: advancedFilters.throttlerNames,
              }}
              className="h-full"
            />
          </div>
        </CardContent>
      </Card>
      </div>

      {/* Advanced Filters Modal */}
      <ThrottlerFilters
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        filters={advancedFilters}
        onFilterChange={handleFilterChange}
        availableControllers={availableControllers}
        availableIdentifiers={availableIdentifiers}
        availableThrottlers={availableThrottlers}
      />

      {/* Confirmation Dialog */}
      <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {clearAction?.type === "all"
                ? "Limpar todas as chaves"
                : clearAction?.type === "blocked"
                  ? "Desbloquear todas as chaves"
                  : `Limpar ${clearAction?.keys?.length || 0} chave(s)`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {clearAction?.type === "all"
                ? "Tem certeza que deseja limpar TODAS as chaves de throttler? Esta ação não pode ser desfeita."
                : clearAction?.type === "blocked"
                  ? "Tem certeza que deseja desbloquear todas as chaves bloqueadas? Isso permitirá novas requisições desses usuários/IPs."
                  : `Tem certeza que deseja limpar ${clearAction?.keys?.length || 0} chave(s) selecionada(s)? Esta ação não pode ser desfeita.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmClearAction}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {clearAction?.type === "all"
                ? "Limpar Tudo"
                : clearAction?.type === "blocked"
                  ? "Desbloquear"
                  : "Limpar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
