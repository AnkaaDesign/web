import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Badge } from "@/components/ui/badge";
import { NotificationCard } from "../card";
import { useNotificationsInfinite, useNotificationMutations } from "../../../../hooks";
import {
  NOTIFICATION_TYPE,
  NOTIFICATION_IMPORTANCE,
  NOTIFICATION_CHANNEL,
  NOTIFICATION_TYPE_LABELS,
  NOTIFICATION_IMPORTANCE_LABELS,
  NOTIFICATION_CHANNEL_LABELS,
} from "../../../../constants";
import type { NotificationGetManyFormData } from "../../../../schemas";
import { IconSearch, IconFilter, IconPlus, IconX } from "@tabler/icons-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useInfiniteScroll } from "@/hooks";

interface NotificationListProps {
  className?: string;
}

export function NotificationList({ className }: NotificationListProps) {
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState("");
  const [filters, setFilters] = useState<Partial<NotificationGetManyFormData>>({
    searchingFor: "",
    types: [],
    importance: [],
    channels: [],
    unread: undefined,
  });
  const [showFilters, setShowFilters] = useState(false);

  const notificationQuery = useNotificationsInfinite({
    ...filters,
    orderBy: { createdAt: "desc" },
    include: {
      user: true,
      seenBy: {
        include: {
          user: true,
        },
      },
    },
  });

  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = notificationQuery;

  const { delete: deleteNotification } = useNotificationMutations();

  const { lastElementRef } = useInfiniteScroll({
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  });

  const notifications = data?.pages.flatMap((page) => page.data || []) || [];

  // Debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setFilters((prev) => ({ ...prev, searchingFor: searchInput }));
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchInput]);

  // Sync search input with filters when filters are cleared
  useEffect(() => {
    if (filters.searchingFor === "" && searchInput !== "") {
      setSearchInput("");
    }
  }, [filters.searchingFor]);

  const handleSearchInputChange = useCallback((value: string) => {
    setSearchInput(value);
  }, []);

  const handleFilterChange = (key: keyof typeof filters, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleClearFilters = () => {
    setSearchInput("");
    setFilters({
      searchingFor: "",
      types: [],
      importance: [],
      channels: [],
      unread: undefined,
    });
  };

  const handleView = (id: string) => {
    navigate(`/administracao/notificacoes/detalhes/${id}`);
  };

  const handleEdit = (id: string) => {
    navigate(`/administracao/notificacoes/editar/${id}`);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Tem certeza que deseja excluir esta notificação?")) {
      await deleteNotification(id);
    }
  };

  const handleCreate = () => {
    navigate("/administracao/notificacoes/cadastrar");
  };

  const activeFiltersCount = (filters.types?.length || 0) + (filters.importance?.length || 0) + (filters.channels?.length || 0) + (filters.unread !== undefined ? 1 : 0);

  return (
    <div className={className}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold">Notificações</h2>
          {activeFiltersCount > 0 && (
            <Badge variant="secondary">
              {activeFiltersCount} filtro{activeFiltersCount !== 1 ? "s" : ""} aplicado{activeFiltersCount !== 1 ? "s" : ""}
            </Badge>
          )}
        </div>
        <Button onClick={handleCreate}>
          <IconPlus className="w-4 h-4 mr-2" />
          Nova Notificação
        </Button>
      </div>

      {/* Search and filters */}
      <div className="space-y-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <IconSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input placeholder="Buscar notificações..." className="pl-10" value={searchInput} onChange={(value) => handleSearchInputChange(String(value || ""))} />
          </div>
          <Button variant="outline" onClick={() => setShowFilters(!showFilters)} className={activeFiltersCount > 0 ? "border-blue-500 text-blue-600" : ""}>
            <IconFilter className="w-4 h-4 mr-2" />
            Filtros
          </Button>
          {activeFiltersCount > 0 && (
            <Button variant="ghost" size="sm" onClick={handleClearFilters}>
              <IconX className="w-4 h-4 mr-2" />
              Limpar
            </Button>
          )}
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className="bg-gray-50 p-4 rounded-lg border space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Type filter - Multi-select */}
              <div>
                <label className="text-sm font-medium mb-2 block">Tipo</label>
                <Combobox
                  mode="multiple"
                  value={filters.types || []}
                  onValueChange={(value) => handleFilterChange("types", Array.isArray(value) ? value : [])}
                  options={Object.values(NOTIFICATION_TYPE).map((type) => ({
                    value: type,
                    label: NOTIFICATION_TYPE_LABELS[type],
                  }))}
                  placeholder="Selecione os tipos"
                  searchable={false}
                  clearable
                />
              </div>

              {/* Importance filter - Multi-select */}
              <div>
                <label className="text-sm font-medium mb-2 block">Importância</label>
                <Combobox
                  mode="multiple"
                  value={filters.importance || []}
                  onValueChange={(value) => handleFilterChange("importance", Array.isArray(value) ? value : [])}
                  options={Object.values(NOTIFICATION_IMPORTANCE).map((importance) => ({
                    value: importance,
                    label: NOTIFICATION_IMPORTANCE_LABELS[importance],
                  }))}
                  placeholder="Selecione as importâncias"
                  searchable={false}
                  clearable
                />
              </div>

              {/* Channel filter - Multi-select */}
              <div>
                <label className="text-sm font-medium mb-2 block">Canal</label>
                <Combobox
                  mode="multiple"
                  value={filters.channels || []}
                  onValueChange={(value) => handleFilterChange("channels", Array.isArray(value) ? value : [])}
                  options={Object.values(NOTIFICATION_CHANNEL).map((channel) => ({
                    value: channel,
                    label: NOTIFICATION_CHANNEL_LABELS[channel],
                  }))}
                  placeholder="Selecione os canais"
                  searchable={false}
                  clearable
                />
              </div>

              {/* Read status filter */}
              <div>
                <label className="text-sm font-medium mb-2 block">Status</label>
                <Combobox
                  value={filters.unread === undefined ? "" : filters.unread ? "unread" : "read"}
                  onValueChange={(value) => {
                    const statusValue = Array.isArray(value) ? value[0] : value;
                    handleFilterChange("unread", statusValue === "" || statusValue === undefined ? undefined : statusValue === "unread");
                  }}
                  options={[
                    { value: "", label: "Todas" },
                    { value: "unread", label: "Não lidas" },
                    { value: "read", label: "Lidas" },
                  ]}
                  placeholder="Todas"
                  searchable={false}
                  clearable
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="border rounded-lg p-4">
              <div className="flex items-start gap-4">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Notification list */}
      {!isLoading && (
        <div className="space-y-4">
          {notifications.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-500 mb-4">Nenhuma notificação encontrada</div>
              <Button onClick={handleCreate}>
                <IconPlus className="w-4 h-4 mr-2" />
                Criar primeira notificação
              </Button>
            </div>
          ) : (
            <>
              {notifications.map((notification, index) => (
                <div key={notification.id} ref={index === notifications.length - 1 ? lastElementRef : undefined}>
                  <NotificationCard notification={notification} onView={handleView} onEdit={handleEdit} onDelete={handleDelete} />
                </div>
              ))}

              {/* Loading more indicator */}
              {isFetchingNextPage && (
                <div className="flex justify-center py-4">
                  <div className="flex items-center gap-2 text-gray-500">
                    <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                    Carregando mais notificações...
                  </div>
                </div>
              )}

              {/* End of list indicator */}
              {!hasNextPage && notifications.length > 0 && <div className="text-center py-4 text-gray-500 text-sm">Todas as notificações foram carregadas</div>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
