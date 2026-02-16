/**
 * Notification List Page
 *
 * Table-based view for managing notifications with:
 * - Searchable table with sorting
 * - Filter drawer for advanced filtering
 * - Bulk actions support via context menu
 */

import { PageHeader } from "@/components/ui/page-header";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { FAVORITE_PAGES, routes } from "../../../constants";
import { useState, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { NotificationTable } from "@/components/administration/notification/list/notification-table";
import { NotificationFilters } from "@/components/administration/notification/list/notification-filters";
import {
  IconPlus,
  IconFilter,
  IconX,
  IconQrcode,
  IconBrandWhatsapp,
  IconPlugConnected,
  IconPlugOff,
  IconAlertCircle,
  IconRefresh,
} from "@tabler/icons-react";
import type { NotificationGetManyFormData } from "@/schemas";
import type { Notification } from "@/types";
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

// Filter indicator component
function FilterIndicator({
  label,
  value,
  onRemove,
}: {
  label: string;
  value: string;
  onRemove: () => void;
}) {
  return (
    <Badge variant="secondary" className="flex items-center gap-1 px-2 py-1">
      <span className="text-xs text-muted-foreground">{label}:</span>
      <span className="text-xs font-medium">{value}</span>
      <button
        onClick={onRemove}
        className="ml-1 hover:bg-muted rounded-full p-0.5"
      >
        <IconX className="h-3 w-3" />
      </button>
    </Badge>
  );
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
      // Poll every 2 seconds when CONNECTING to detect when QR becomes available
      // Poll every 30 seconds when QR_READY to refresh the QR before it expires
      if (status === "CONNECTING") return 2000;
      if (status === "QR_READY") return 30000;
      return false;
    },
  });

  // Determine if we should fetch QR code
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
    // Poll for QR code every 3 seconds when connecting (until QR is available)
    refetchInterval: (query) => {
      const status = statusData?.data?.status;
      const hasQR = query?.state?.data?.data?.qr;
      // Keep polling if we're connecting and don't have a QR code yet
      if (status === "CONNECTING" && !hasQR) return 3000;
      // Stop polling once we have the QR code
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

  // State
  const [searchInput, setSearchInput] = useState("");
  const [searchingFor, setSearchingFor] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [filters, setFilters] = useState<Partial<NotificationGetManyFormData>>({});
  const [, setTableData] = useState<{ items: Notification[]; totalRecords: number }>({
    items: [],
    totalRecords: 0,
  });

  const searchTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Debounced search
  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setSearchingFor(value);
    }, 300);
  }, []);

  // Handle filter changes
  const handleFilterChange = useCallback((newFilters: Partial<NotificationGetManyFormData>) => {
    setFilters(newFilters);
  }, []);

  // Compute query filters
  const queryFilters = useMemo(() => ({
    ...filters,
    searchingFor: searchingFor || undefined,
  }), [filters, searchingFor]);

  // Extract active filters for indicators
  const activeFilters = useMemo(() => {
    const indicators: { label: string; value: string; onRemove: () => void }[] = [];

    if (searchingFor) {
      indicators.push({
        label: "Busca",
        value: searchingFor,
        onRemove: () => {
          setSearchInput("");
          setSearchingFor("");
        },
      });
    }

    if (filters.types?.length) {
      indicators.push({
        label: "Tipo",
        value: `${filters.types.length} selecionado(s)`,
        onRemove: () => setFilters((prev) => ({ ...prev, types: [] })),
      });
    }

    if (filters.importance?.length) {
      indicators.push({
        label: "Importância",
        value: `${filters.importance.length} selecionado(s)`,
        onRemove: () => setFilters((prev) => ({ ...prev, importance: [] })),
      });
    }

    if (filters.channels?.length) {
      indicators.push({
        label: "Canal",
        value: `${filters.channels.length} selecionado(s)`,
        onRemove: () => setFilters((prev) => ({ ...prev, channels: [] })),
      });
    }

    if ((filters as any).status) {
      indicators.push({
        label: "Status",
        value: (filters as any).status === "sent" ? "Enviadas" : "Pendentes",
        onRemove: () => setFilters((prev) => ({ ...prev, status: undefined } as any)),
      });
    }

    if (filters.unread) {
      indicators.push({
        label: "Leitura",
        value: "Não lidas",
        onRemove: () => setFilters((prev) => ({ ...prev, unread: undefined })),
      });
    }

    if (filters.createdAt) {
      indicators.push({
        label: "Período",
        value: "Filtrado",
        onRemove: () => setFilters((prev) => ({ ...prev, createdAt: undefined })),
      });
    }

    return indicators;
  }, [searchingFor, filters]);

  const clearAllFilters = useCallback(() => {
    setSearchInput("");
    setSearchingFor("");
    setFilters({});
  }, []);

  const hasActiveFilters = activeFilters.length > 0;

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
                  value={searchInput}
                  onChange={handleSearchChange}
                  placeholder="Buscar por título, mensagem..."
                  isPending={searchInput !== searchingFor}
                  className="flex-1"
                />
                <div className="flex gap-2">
                  <Button
                    variant={hasActiveFilters ? "default" : "outline"}
                    onClick={() => setShowFilters(true)}
                  >
                    <IconFilter className="h-4 w-4 mr-2" />
                    Filtros
                    {hasActiveFilters && ` (${activeFilters.length})`}
                  </Button>
                </div>
              </div>

              {/* Active Filter Indicators */}
              {activeFilters.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-3 border-t">
                  {activeFilters.map((filter, index) => (
                    <FilterIndicator
                      key={index}
                      label={filter.label}
                      value={filter.value}
                      onRemove={filter.onRemove}
                    />
                  ))}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearAllFilters}
                    className="h-6 px-2 text-xs"
                  >
                    Limpar todos
                  </Button>
                </div>
              )}

              {/* Table */}
              <div className="flex-1 min-h-0 overflow-auto">
                <NotificationTable
                  filters={queryFilters}
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
        filters={filters}
        onFilterChange={handleFilterChange}
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
