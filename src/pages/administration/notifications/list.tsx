/**
 * Notification List Page
 *
 * Table-based view for managing notifications with:
 * - Searchable table with sorting
 * - URL-persisted filters
 * - Filter drawer for advanced filtering
 * - Clickable filter badges (matching item list pattern)
 * - Bulk actions support via context menu
 */

import { PageHeader } from "@/components/ui/page-header";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { FAVORITE_PAGES, routes } from "../../../constants";
import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { FilterIndicators } from "@/components/ui/filter-indicator";
import { NotificationTable } from "@/components/administration/notification/list/notification-table";
import { NotificationFilters } from "@/components/administration/notification/list/notification-filters";
import { extractActiveFilters, createFilterRemover } from "@/components/administration/notification/list/filter-utils";
import { useTableFilters } from "@/hooks/common/use-table-filters";
import {
  IconPlus,
  IconFilter,
  IconQrcode,
  IconBrandWhatsapp,
  IconPlugConnected,
  IconPlugOff,
  IconAlertCircle,
  IconRefresh,
} from "@tabler/icons-react";
import type { NotificationGetManyFormData } from "@/schemas";
import type { Notification } from "@/types";
import { useUser } from "@/hooks";
import { whatsAppService, type WhatsAppStatus } from "@/api-client/services/notification.service";
import { useCurrentUser } from "@/hooks/common/use-auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

// Notification page filter type
interface NotificationPageFilters {
  types?: string[];
  importance?: string[];
  channels?: string[];
  status?: string;
  unread?: boolean;
  userId?: string;
  createdAt?: { gte?: Date; lte?: Date };
}

// WhatsApp QR Code Component
const WhatsAppQRCard = () => {
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();

  const isAdmin = currentUser?.sector?.privileges?.includes("ADMIN") ||
                  currentUser?.sector?.privileges?.includes("SUPER_ADMIN");

  const {
    data: statusData,
    isLoading: statusLoading,
    error: statusError,
  } = useQuery({
    queryKey: ["whatsapp-status"],
    queryFn: async () => {
      const response = await whatsAppService.getWhatsAppStatus();
      return response.data;
    },
    enabled: !!isAdmin,
    refetchInterval: (query) => {
      const actualData = query?.state?.data;
      const status = actualData?.data?.status;
      if (status === "CONNECTING") return 2000;
      if (status === "QR_READY") return 30000;
      return false;
    },
  });

  const shouldFetchQR = statusData?.data?.status === "QR_READY" || statusData?.data?.status === "CONNECTING";

  const {
    data: qrData,
    isLoading: qrLoading,
    refetch: refetchQR,
  } = useQuery({
    queryKey: ["whatsapp-qr"],
    queryFn: async () => {
      const response = await whatsAppService.getWhatsAppQR();
      return response.data;
    },
    enabled: shouldFetchQR,
    refetchInterval: (query) => {
      const status = statusData?.data?.status;
      const hasQR = query?.state?.data?.data?.qr;
      if (status === "CONNECTING" && !hasQR) return 3000;
      return false;
    },
  });

  const reconnectMutation = useMutation({
    mutationFn: async () => await whatsAppService.reconnect(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-qr"] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-status"] });
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: async () => await whatsAppService.regenerateQR(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-qr"] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-status"] });
      refetchQR();
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: whatsAppService.disconnect,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-status"] });
    },
  });

  if (!isAdmin) return null;

  const getStatusBadge = (status: WhatsAppStatus) => {
    switch (status) {
      case "AUTHENTICATED":
      case "READY":
        return (
          <Badge variant="default" className="flex items-center gap-1 bg-green-600">
            <IconPlugConnected className="h-3 w-3" />
            Conectado
          </Badge>
        );
      case "QR_READY":
      case "CONNECTING":
        return (
          <Badge variant="secondary" className="flex items-center gap-1">
            <IconQrcode className="h-3 w-3" />
            Aguardando QR
          </Badge>
        );
      case "AUTH_FAILURE":
        return (
          <Badge variant="destructive" className="flex items-center gap-1">
            <IconAlertCircle className="h-3 w-3" />
            Falha
          </Badge>
        );
      default:
        return (
          <Badge variant="destructive" className="flex items-center gap-1">
            <IconPlugOff className="h-3 w-3" />
            Desconectado
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <IconBrandWhatsapp className="h-5 w-5 text-green-600" />
          <span className="font-medium">WhatsApp Business</span>
        </div>
        {statusData?.data?.status && getStatusBadge(statusData.data.status)}
      </div>

      {statusLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : statusError ? (
        <Alert variant="destructive">
          <AlertDescription>Erro ao carregar status</AlertDescription>
        </Alert>
      ) : statusData?.data?.status === "DISCONNECTED" || statusData?.data?.status === "AUTH_FAILURE" ? (
        <div className="flex flex-col items-center gap-3 py-4">
          <IconPlugOff className="h-10 w-10 text-muted-foreground" />
          <Button size="sm" onClick={() => reconnectMutation.mutate()} disabled={reconnectMutation.isPending}>
            {reconnectMutation.isPending ? "Conectando..." : "Conectar"}
          </Button>
        </div>
      ) : statusData?.data?.status === "QR_READY" || statusData?.data?.status === "CONNECTING" ? (
        <div className="flex flex-col items-center gap-3 py-2">
          {qrLoading ? (
            <div className="flex flex-col items-center gap-2">
              <Skeleton className="h-40 w-40" />
              <p className="text-sm text-muted-foreground">Carregando QR Code...</p>
            </div>
          ) : !qrData?.data?.qr ? (
            <div className="flex flex-col items-center gap-2">
              <div className="h-40 w-40 flex items-center justify-center border rounded bg-muted/30">
                <div className="flex flex-col items-center gap-2">
                  <IconRefresh className="h-8 w-8 text-muted-foreground animate-spin" />
                  <p className="text-xs text-muted-foreground text-center">Gerando QR Code...</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Aguarde enquanto o QR Code é gerado
              </p>
            </div>
          ) : (
            <>
              <div className="p-2 bg-white rounded border">
                <img
                  src={qrData.data.qr.startsWith("data:") ? qrData.data.qr : `data:image/png;base64,${qrData.data.qr}`}
                  alt="QR Code"
                  className="h-40 w-40"
                />
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Escaneie o QR Code com o WhatsApp
              </p>
              <Button size="sm" variant="outline" onClick={() => regenerateMutation.mutate()} disabled={regenerateMutation.isPending}>
                <IconRefresh className="h-3 w-3 mr-1" />
                Atualizar QR
              </Button>
            </>
          )}
        </div>
      ) : statusData?.data?.status === "READY" || statusData?.data?.status === "AUTHENTICATED" ? (
        <div className="flex flex-col items-center gap-3 py-4">
          <IconPlugConnected className="h-10 w-10 text-green-600" />
          <p className="text-sm text-green-600 font-medium">WhatsApp conectado com sucesso</p>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => disconnectMutation.mutate()}
            disabled={disconnectMutation.isPending}
          >
            Desconectar
          </Button>
        </div>
      ) : null}
    </div>
  );
};

export const NotificationListPage = () => {
  const navigate = useNavigate();

  // Local UI state
  const [showFilters, setShowFilters] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [, setTableData] = useState<{ items: Notification[]; totalRecords: number }>({
    items: [],
    totalRecords: 0,
  });

  // Cache for selected user data (for filter badge display)
  const usersCacheRef = useRef<Map<string, { id: string; name: string }>>(new Map());
  const [selectedUser, setSelectedUser] = useState<{ id: string; name: string } | null>(null);

  // We'll initialize useTableFilters first, then use the userId from filters below

  // Custom serializer for notification filters to URL params
  const serializeFilters = useCallback((filters: Partial<NotificationPageFilters>): Record<string, string> => {
    const params: Record<string, string> = {};

    if (filters.types?.length) params.types = JSON.stringify(filters.types);
    if (filters.importance?.length) params.importance = JSON.stringify(filters.importance);
    if (filters.channels?.length) params.channels = JSON.stringify(filters.channels);
    if (filters.status) params.status = filters.status;
    if (filters.unread) params.unread = "true";
    if (filters.userId) params.userId = filters.userId;
    if (filters.createdAt?.gte) params.createdAfter = filters.createdAt.gte.toISOString();
    if (filters.createdAt?.lte) params.createdBefore = filters.createdAt.lte.toISOString();

    return params;
  }, []);

  // Custom deserializer from URL params to notification filters
  const deserializeFilters = useCallback((params: URLSearchParams): Partial<NotificationPageFilters> => {
    const filters: Partial<NotificationPageFilters> = {};

    const types = params.get("types");
    if (types) {
      try {
        const parsed = JSON.parse(types);
        if (Array.isArray(parsed) && parsed.length > 0) filters.types = parsed;
      } catch { /* ignore */ }
    }

    const importance = params.get("importance");
    if (importance) {
      try {
        const parsed = JSON.parse(importance);
        if (Array.isArray(parsed) && parsed.length > 0) filters.importance = parsed;
      } catch { /* ignore */ }
    }

    const channels = params.get("channels");
    if (channels) {
      try {
        const parsed = JSON.parse(channels);
        if (Array.isArray(parsed) && parsed.length > 0) filters.channels = parsed;
      } catch { /* ignore */ }
    }

    const status = params.get("status");
    if (status === "sent" || status === "pending") filters.status = status;

    const unread = params.get("unread");
    if (unread === "true") filters.unread = true;

    const userId = params.get("userId");
    if (userId) filters.userId = userId;

    const createdAfter = params.get("createdAfter");
    const createdBefore = params.get("createdBefore");
    if (createdAfter || createdBefore) {
      filters.createdAt = {
        ...(createdAfter && { gte: new Date(createdAfter) }),
        ...(createdBefore && { lte: new Date(createdBefore) }),
      };
    }

    return filters;
  }, []);

  // Use the unified table filters hook with URL persistence
  const {
    filters,
    setFilters,
    searchingFor,
    displaySearchText,
    setSearch,
    clearAllFilters: clearAllFiltersBase,
    queryFilters: baseQueryFilters,
    hasActiveFilters,
  } = useTableFilters<NotificationPageFilters>({
    searchDebounceMs: 300,
    searchParamName: "search",
    serializeToUrl: serializeFilters,
    deserializeFromUrl: deserializeFilters,
    excludeFromUrl: ["limit", "orderBy"],
  });

  // Fetch user data when userId is in filters (e.g. from URL) but not yet cached
  const { data: userData } = useUser(filters.userId || "", {
    enabled: !!filters.userId && !usersCacheRef.current.has(filters.userId),
  });

  // Update cache and selectedUser when user data arrives
  useEffect(() => {
    if (userData?.data && filters.userId) {
      const user = { id: userData.data.id, name: userData.data.name };
      usersCacheRef.current.set(user.id, user);
      setSelectedUser(user);
    }
  }, [userData?.data, filters.userId]);

  // Handle filter changes from the sheet
  const handleFilterChange = useCallback(
    (newFilters: Partial<NotificationPageFilters>) => {
      setFilters(newFilters);
    },
    [setFilters],
  );

  // Handle user selection from the filter sheet (cache name for badge)
  const handleUserSelect = useCallback((user: { id: string; name: string } | null) => {
    if (user) {
      usersCacheRef.current.set(user.id, user);
      setSelectedUser(user);
    } else {
      setSelectedUser(null);
    }
  }, []);

  // Handle filter removal
  const baseOnRemoveFilter = createFilterRemover(filters, handleFilterChange);

  const onRemoveFilter = useCallback(
    (key: string, value?: any) => {
      if (key === "searchingFor") {
        setSearch("");
      } else if (key === "userId") {
        setSelectedUser(null);
        baseOnRemoveFilter(key, value);
      } else {
        baseOnRemoveFilter(key, value);
      }
    },
    [baseOnRemoveFilter, setSearch],
  );

  // Clear all filters
  const clearAllFilters = useCallback(() => {
    clearAllFiltersBase();
    setSelectedUser(null);
  }, [clearAllFiltersBase]);

  // Build the users list for filter badge display from cache
  const usersForBadges = useMemo(() => {
    return Array.from(usersCacheRef.current.values());
  }, [filters.userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Extract active filters for badge display
  const activeFilters = useMemo(() => {
    const filtersWithSearch = {
      ...filters,
      searchingFor: searchingFor || undefined,
    };

    return extractActiveFilters(filtersWithSearch, onRemoveFilter, {
      users: usersForBadges,
    });
  }, [filters, searchingFor, onRemoveFilter, usersForBadges]);

  // Stable query filters ref for the table
  const queryFiltersRef = useRef<Partial<NotificationPageFilters>>({});
  const queryFiltersStringRef = useRef("");

  const queryFilters = useMemo(() => {
    const result = { ...baseQueryFilters };

    const currentString = JSON.stringify(result);
    if (currentString !== queryFiltersStringRef.current) {
      queryFiltersStringRef.current = currentString;
      queryFiltersRef.current = result;
    }

    return queryFiltersRef.current;
  }, [baseQueryFilters]);

  return (
    <PrivilegeRoute>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="list"
          title="Notificações"
          favoritePage={FAVORITE_PAGES.ADMINISTRACAO_NOTIFICACOES_LISTAR}
          breadcrumbs={[
            { label: "Início", href: "/" },
            { label: "Administração", href: "/administracao" },
            { label: "Notificações" },
          ]}
          className="flex-shrink-0"
          actions={[
            {
              key: "qr-code",
              label: "WhatsApp",
              icon: IconQrcode,
              onClick: () => setShowQrModal(true),
              variant: "outline",
            },
            {
              key: "create",
              label: "Nova Notificação",
              icon: IconPlus,
              onClick: () => navigate(routes.administration.notifications.create),
              variant: "default",
            },
          ]}
        />

        <div className="flex-1 min-h-0 pb-6 flex flex-col">
          <Card className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="p-4 space-y-4 flex flex-col flex-1 overflow-hidden">
              {/* Search and Filter Controls */}
              <div className="flex flex-col gap-3 sm:flex-row">
                <TableSearchInput
                  value={displaySearchText}
                  onChange={(value) => {
                    setSearch(value);
                  }}
                  placeholder="Buscar por título, mensagem..."
                  isPending={displaySearchText !== searchingFor}
                  className="flex-1"
                />
                <div className="flex gap-2">
                  <Button
                    variant={hasActiveFilters ? "default" : "outline"}
                    onClick={() => setShowFilters(true)}
                  >
                    <IconFilter className="h-4 w-4" />
                    <span>
                      Filtros
                      {hasActiveFilters ? ` (${activeFilters.length})` : ""}
                    </span>
                  </Button>
                </div>
              </div>

              {/* Active Filter Indicators - using shared component, no border separator */}
              {activeFilters.length > 0 && (
                <FilterIndicators
                  filters={activeFilters}
                  onClearAll={clearAllFilters}
                  className="px-1 py-1"
                />
              )}

              {/* Table */}
              <div className="flex-1 min-h-0 overflow-auto">
                <NotificationTable
                  filters={queryFilters as Partial<NotificationGetManyFormData>}
                  onDataChange={(data) => {
                    setTableData({
                      items: data.items as any,
                      totalRecords: data.totalRecords,
                    });
                  }}
                  className="h-full"
                />
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Filter Drawer */}
      <NotificationFilters
        open={showFilters}
        onOpenChange={setShowFilters}
        filters={filters as any}
        onFilterChange={handleFilterChange as any}
        onUserSelect={handleUserSelect}
        selectedUser={selectedUser}
      />

      {/* WhatsApp QR Code Modal */}
      <Dialog open={showQrModal} onOpenChange={setShowQrModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconBrandWhatsapp className="w-5 h-5 text-green-500" />
              Conectar WhatsApp
            </DialogTitle>
            <DialogDescription>
              Configure a conexão com o WhatsApp Business
            </DialogDescription>
          </DialogHeader>
          <WhatsAppQRCard />
        </DialogContent>
      </Dialog>
    </PrivilegeRoute>
  );
};
