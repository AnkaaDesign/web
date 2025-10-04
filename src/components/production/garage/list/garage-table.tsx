import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { IconBuilding, IconRoad, IconMapPin, IconEdit, IconTrash, IconCar, IconDotsVertical, IconChevronUp, IconChevronDown, IconSelector } from "@tabler/icons-react";

import type { Garage, GarageGetManyFormData } from "../../../../types";
import { routes, GARAGE_STATUS } from "../../../../constants";
import { useGarages } from "../../../../hooks";
import { formatDateTime } from "../../../../utils";
import { cn } from "@/lib/utils";
import { useTableState, convertSortConfigsToOrderBy } from "@/hooks/use-table-state";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingTable } from "@/components/ui/loading-table";
import { ErrorState } from "@/components/ui/error-state";
import { SimplePaginationAdvanced } from "@/components/ui/pagination-advanced";
import { GarageStatusBadge } from "../common/garage-status-badge";

interface GarageTableProps {
  filters?: Partial<GarageGetManyFormData>;
  onDataChange?: (data: { garages: Garage[]; totalRecords: number }) => void;
  className?: string;
}

export function GarageTable({ filters = {}, onDataChange, className }: GarageTableProps) {
  // Use URL state management for pagination and selection
  const {
    page,
    pageSize,
    selectedIds,
    sortConfigs,
    showSelectedOnly,
    setPage,
    setPageSize,
    toggleSelection,
    toggleSelectAll,
    toggleSort,
    getSortDirection,
    getSortOrder,
    isSelected,
    isAllSelected,
    isPartiallySelected,
    selectionCount,
    resetSelection,
    removeFromSelection,
  } = useTableState({
    defaultPageSize: 40,
    resetSelectionOnPageChange: false,
  });

  // Memoize include configuration to prevent re-renders
  const includeConfig = React.useMemo(
    () => ({
      lanes: {
        include: {
          parkingSpots: true,
        },
      },
    }),
    [],
  );

  // Memoize query parameters to prevent infinite re-renders
  const queryParams = React.useMemo(() => {
    const params = {
      // When showSelectedOnly is true, don't apply filters
      ...(showSelectedOnly ? {} : filters),
      page: page + 1, // Convert 0-based to 1-based for API
      limit: pageSize,
      include: includeConfig,
      // Convert sortConfigs to orderBy format for API
      ...(sortConfigs.length > 0 && {
        orderBy: convertSortConfigsToOrderBy(sortConfigs),
      }),
      // When showSelectedOnly is true, only show selected items
      ...(showSelectedOnly &&
        selectedIds.length > 0 && {
          where: {
            id: { in: selectedIds },
          },
        }),
    };

    return params;
  }, [filters, page, pageSize, includeConfig, sortConfigs, showSelectedOnly, selectedIds]);

  const { data: response, isLoading, error, refetch } = useGarages(queryParams);

  const garages = response?.data || [];
  const totalPages = response?.meta ? Math.ceil(response.meta.totalRecords / pageSize) : 1;
  const totalRecords = response?.meta?.totalRecords || 0;

  // Notify parent component of data changes
  // Use a ref to track if we've already notified for this exact data
  const lastNotifiedDataRef = React.useRef<string>("");
  const isMountedRef = React.useRef(true);

  React.useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  React.useEffect(() => {
    if (onDataChange && isMountedRef.current) {
      // Create a unique key for the current data to detect real changes
      const dataKey = garages.length > 0 ? `${totalRecords}-${garages.map((garage) => garage.id).join(",")}` : `empty-${totalRecords}`;

      // Only notify if this exact data hasn't been notified yet
      if (dataKey !== lastNotifiedDataRef.current) {
        lastNotifiedDataRef.current = dataKey;
        onDataChange({ garages, totalRecords });
      }
    }
  }, [garages, totalRecords, onDataChange]);

  // Get current page garage IDs for selection
  const currentPageGarageIds = React.useMemo(() => {
    return garages.map((garage) => garage.id);
  }, [garages]);

  // Selection handlers
  const allSelected = isAllSelected(currentPageGarageIds);
  const partiallySelected = isPartiallySelected(currentPageGarageIds);

  const handleSelectAll = () => {
    toggleSelectAll(currentPageGarageIds);
  };

  const handleSelectGarage = (garageId: string) => {
    toggleSelection(garageId);
  };

  const renderSortIndicator = (columnKey: string) => {
    const sortDirection = getSortDirection(columnKey);
    const sortOrder = getSortOrder(columnKey);

    return (
      <div className="inline-flex items-center ml-1">
        {sortDirection === null && <IconSelector className="h-4 w-4 text-muted-foreground" />}
        {sortDirection === "asc" && <IconChevronUp className="h-4 w-4 text-foreground" />}
        {sortDirection === "desc" && <IconChevronDown className="h-4 w-4 text-foreground" />}
        {sortOrder !== null && sortConfigs.length > 1 && <span className="text-xs ml-0.5">{sortOrder + 1}</span>}
      </div>
    );
  };

  const calculateMetrics = (garage: Garage) => {
    const totalLanes = garage.lanes?.length || 0;
    const totalSpots = garage.lanes?.reduce((sum, lane) => sum + (lane.parkingSpots?.length || 0), 0) || 0;
    const totalTrucks = garage.trucks?.length || 0;
    const occupancyRate = totalSpots > 0 ? (totalTrucks / totalSpots) * 100 : 0;

    return {
      totalLanes,
      totalSpots,
      totalTrucks,
      occupancyRate,
      area: garage.width * garage.length,
    };
  };

  if (isLoading) {
    return <LoadingTable className={className} />;
  }

  if (error) {
    return <ErrorState title="Erro ao carregar garagens" message="Não foi possível carregar a lista de garagens" onRetry={refetch} className={className} />;
  }

  if (garages.length === 0) {
    return (
      <EmptyState
        icon={IconBuilding}
        title="Nenhuma garagem encontrada"
        message="Não há garagens cadastradas ou que correspondam aos filtros aplicados"
        actions={[
          {
            label: "Nova Garagem",
            href: routes.production.garages.create,
            variant: "default",
          },
        ]}
        className={className}
      />
    );
  }

  return (
    <div className={cn("rounded-lg flex flex-col overflow-hidden", className)}>
      {/* Fixed Header Table */}
      <div className="border-l border-r border-t border-border rounded-t-lg overflow-hidden">
        <Table className="w-full">
          <TableHeader className="[&_tr]:border-b-0 [&_tr]:hover:bg-muted">
            <TableRow className="bg-muted hover:bg-muted even:bg-muted">
              {/* Selection column */}
              <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0 w-12">
                <div className="flex items-center justify-center h-full w-full px-2">
                  <Checkbox
                    checked={allSelected}
                    indeterminate={partiallySelected}
                    onCheckedChange={handleSelectAll}
                    aria-label="Select all garages"
                    disabled={isLoading || garages.length === 0}
                  />
                </div>
              </TableHead>

              {/* Name column - sortable */}
              <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0 w-64">
                <button
                  onClick={() => toggleSort("name")}
                  className="flex items-center gap-1 w-full h-full min-h-[2.5rem] px-4 py-2 hover:bg-muted/80 transition-colors cursor-pointer text-left border-0 bg-transparent justify-start"
                  disabled={isLoading || garages.length === 0}
                >
                  Nome
                  {renderSortIndicator("name")}
                </button>
              </TableHead>

              {/* Dimensions column */}
              <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0 w-32">
                <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2 justify-start text-left">Dimensões</div>
              </TableHead>

              {/* Status column - sortable */}
              <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0 w-28">
                <button
                  onClick={() => toggleSort("status")}
                  className="flex items-center gap-1 w-full h-full min-h-[2.5rem] px-4 py-2 hover:bg-muted/80 transition-colors cursor-pointer text-left border-0 bg-transparent justify-start"
                  disabled={isLoading || garages.length === 0}
                >
                  Status
                  {renderSortIndicator("status")}
                </button>
              </TableHead>

              {/* Created At column - sortable */}
              <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0 w-32">
                <button
                  onClick={() => toggleSort("createdAt")}
                  className="flex items-center gap-1 w-full h-full min-h-[2.5rem] px-4 py-2 hover:bg-muted/80 transition-colors cursor-pointer text-left border-0 bg-transparent justify-start"
                  disabled={isLoading || garages.length === 0}
                >
                  Criado em
                  {renderSortIndicator("createdAt")}
                </button>
              </TableHead>

              {/* Actions column */}
              <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0 w-20">
                <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2 justify-center text-center">Ações</div>
              </TableHead>
            </TableRow>
          </TableHeader>
        </Table>
      </div>

      {/* Scrollable Body Table */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden border-l border-r border-border">
        <Table className="w-full">
          <TableBody>
            {garages.map((garage, index) => {
              const garageIsSelected = isSelected(garage.id);
              const metrics = calculateMetrics(garage);

              return (
                <TableRow
                  key={garage.id}
                  data-state={garageIsSelected ? "selected" : undefined}
                  className={cn(
                    "cursor-pointer transition-colors border-b border-border",
                    // Alternating row colors
                    index % 2 === 1 && "bg-muted/10",
                    // Hover state that works with alternating colors
                    "hover:bg-muted/20",
                    // Selected state overrides alternating colors
                    garageIsSelected && "bg-muted/30 hover:bg-muted/40",
                  )}
                  onClick={() => (window.location.href = routes.production.garages.details(garage.id))}
                >
                  {/* Selection checkbox */}
                  <TableCell className="p-0 !border-r-0 w-12">
                    <div className="flex items-center justify-center h-full w-full px-2 py-2" onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={garageIsSelected} onCheckedChange={() => handleSelectGarage(garage.id)} aria-label={`Select ${garage.name}`} />
                    </div>
                  </TableCell>

                  {/* Name */}
                  <TableCell className="p-0 !border-r-0 w-64">
                    <div className="px-4 py-2">
                      <div className="flex items-center space-x-3 min-w-0">
                        <div className="p-2 rounded-lg bg-primary/10 flex-shrink-0">
                          <IconBuilding className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-foreground truncate">{garage.name}</p>
                          <div className="flex items-center gap-4 mt-1">
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <IconRoad className="h-3 w-3" />
                              <span>{metrics.totalLanes} faixas</span>
                            </div>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <IconMapPin className="h-3 w-3" />
                              <span>{metrics.totalSpots} vagas</span>
                            </div>
                            {metrics.totalTrucks > 0 && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <IconCar className="h-3 w-3" />
                                <span>{metrics.totalTrucks} caminhões</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </TableCell>

                  {/* Dimensions */}
                  <TableCell className="p-0 !border-r-0 w-32">
                    <div className="px-4 py-2">
                      <div className="text-sm">
                        <p className="font-medium">
                          {garage.width}m × {garage.length}m
                        </p>
                        <p className="text-muted-foreground">{metrics.area.toFixed(2)} m²</p>
                      </div>
                    </div>
                  </TableCell>

                  {/* Status */}
                  <TableCell className="p-0 !border-r-0 w-28">
                    <div className="px-4 py-2">
                      <GarageStatusBadge status={garage.status as GARAGE_STATUS} />
                    </div>
                  </TableCell>

                  {/* Created At */}
                  <TableCell className="p-0 !border-r-0 w-32">
                    <div className="px-4 py-2">
                      <div className="text-sm text-muted-foreground">{formatDateTime(garage.createdAt)}</div>
                    </div>
                  </TableCell>

                  {/* Actions */}
                  <TableCell className="p-0 !border-r-0 w-20">
                    <div className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <IconDotsVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => (window.location.href = routes.production.garages.details(garage.id))}>
                            <IconBuilding className="h-4 w-4 mr-2" />
                            Visualizar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => (window.location.href = routes.production.garages.edit(garage.id))}>
                            <IconEdit className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Footer */}
      <div className="px-4 border-l border-r border-b border-border rounded-b-lg bg-muted/50">
        <SimplePaginationAdvanced
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
          pageSize={pageSize}
          totalItems={totalRecords}
          pageSizeOptions={[20, 40, 60, 100]}
          onPageSizeChange={setPageSize}
          showPageSizeSelector={true}
          showGoToPage={true}
          showPageInfo={true}
        />
      </div>
    </div>
  );
}
