/**
 * Message List Page
 *
 * Table-based view for managing in-app messages with:
 * - Searchable table with sorting
 * - Filter drawer for advanced filtering
 * - Quick actions via context menu
 * - Stats display (views, target users)
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
import { MessageTable } from "@/components/administration/message/list/message-table";
import { MessageFilters } from "@/components/administration/message/list/message-filters";
import {
  IconPlus,
  IconFilter,
  IconX,
  IconMessagePlus,
} from "@tabler/icons-react";
import type { MessageGetManyFormData } from "@/schemas/message";
import type { Message } from "@/types/message";

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

export const MessageListPage = () => {
  const navigate = useNavigate();

  // State
  const [searchInput, setSearchInput] = useState("");
  const [searchingFor, setSearchingFor] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Partial<MessageGetManyFormData>>({});
  const [tableData, setTableData] = useState<{ items: Message[]; totalRecords: number }>({
    items: [],
    totalRecords: 0,
  });

  const searchTimeoutRef = useRef<NodeJS.Timeout>();

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
  const handleFilterChange = useCallback((newFilters: Partial<MessageGetManyFormData>) => {
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

    if (filters.status?.length) {
      const statusLabels: Record<string, string> = {
        draft: "Rascunho",
        active: "Ativa",
        archived: "Arquivada",
      };
      const statusText = filters.status.map(s => statusLabels[s] || s).join(", ");
      indicators.push({
        label: "Status",
        value: statusText,
        onRemove: () => setFilters((prev) => ({ ...prev, status: undefined })),
      });
    }

    if (filters.priority?.length) {
      const priorityLabels: Record<string, string> = {
        low: "Baixa",
        normal: "Normal",
        high: "Alta",
      };
      const priorityText = filters.priority.map(p => priorityLabels[p] || p).join(", ");
      indicators.push({
        label: "Prioridade",
        value: priorityText,
        onRemove: () => setFilters((prev) => ({ ...prev, priority: undefined })),
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
      <div className="h-full flex flex-col bg-background px-4 pt-4">
        <PageHeader
          variant="list"
          title="Mensagens"
          icon={IconMessagePlus}
          favoritePage={FAVORITE_PAGES.ADMINISTRACAO_MENSAGENS_LISTAR}
          breadcrumbs={[
            { label: "Início", href: "/" },
            { label: "Administração", href: "/administracao" },
            { label: "Mensagens" },
          ]}
          className="flex-shrink-0"
          actions={[
            {
              key: "create",
              label: "Nova Mensagem",
              icon: IconPlus,
              onClick: () => navigate(routes.administration.messages?.create || "/administracao/mensagens/criar"),
              variant: "default",
            },
          ]}
        />

        <div className="flex-1 min-h-0 pb-6 flex flex-col gap-4 mt-4">
          {/* Search and Filter Controls */}
          <Card className="p-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              <TableSearchInput
                value={searchInput}
                onChange={handleSearchChange}
                placeholder="Buscar por título..."
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
              <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t">
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

            {/* Stats Display */}
            {tableData.totalRecords > 0 && (
              <div className="mt-3 pt-3 border-t text-sm text-muted-foreground">
                <span className="font-medium">{tableData.totalRecords}</span> mensagem
                {tableData.totalRecords !== 1 ? "ns" : ""} encontrada
                {tableData.totalRecords !== 1 ? "s" : ""}
              </div>
            )}
          </Card>

          {/* Table */}
          <div className="flex-1 min-h-0">
            <MessageTable
              filters={queryFilters}
              onDataChange={setTableData}
              className="h-full"
            />
          </div>
        </div>
      </div>

      {/* Filter Drawer */}
      <MessageFilters
        open={showFilters}
        onOpenChange={setShowFilters}
        filters={filters}
        onFilterChange={handleFilterChange}
      />
    </PrivilegeRoute>
  );
};
