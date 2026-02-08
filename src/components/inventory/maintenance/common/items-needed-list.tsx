import React, { useCallback, useState, useMemo } from "react";
import type { Item } from "../../../../types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { ItemsNeededTable } from "./items-needed-table";
import { ItemsNeededColumnVisibilityManager, getDefaultVisibleColumns } from "./items-needed-column-visibility-manager";
import { createItemsNeededColumns } from "./items-needed-columns";
import { cn } from "@/lib/utils";
import { useTableFilters } from "@/hooks/common/use-table-filters";
import { useColumnVisibility } from "@/hooks/common/use-column-visibility";
import { IconPackage } from "@tabler/icons-react";

interface ItemConfig {
  itemId: string;
  quantity: number;
}

interface ItemsNeededListProps {
  itemsConfig: ItemConfig[];
  className?: string;
}

const DEFAULT_PAGE_SIZE = 40;

export function ItemsNeededList({ itemsConfig, className }: ItemsNeededListProps) {
  // State to hold current page items and total count from the table
  const [tableData, setTableData] = useState<{ items: Item[]; totalRecords: number }>({ items: [], totalRecords: 0 });

  // Stable callback for table data updates
  const handleTableDataChange = useCallback((data: { items: Item[]; totalRecords: number }) => {
    setTableData(data);
  }, []);

  // Filter state management with search only
  const { searchingFor, displaySearchText, setSearch, queryFilters } = useTableFilters({
    defaultFilters: {},
    searchDebounceMs: 500,
    searchParamName: "itemsNeededSearch",
    excludeFromUrl: ["limit", "orderBy"],
  });

  // Default visible columns
  const defaultVisibleColumns = useMemo(() => getDefaultVisibleColumns(), []);

  // Column visibility state with localStorage persistence
  const { visibleColumns, setVisibleColumns } = useColumnVisibility("items-needed-visible-columns", defaultVisibleColumns);

  // Get all columns for visibility manager
  const allColumns = useMemo(() => createItemsNeededColumns(), []);

  return (
    <Card className={cn("flex flex-col shadow-sm border border-border w-full", className)}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <IconPackage className="h-5 w-5 text-muted-foreground" />
          Itens Necessários
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {/* Search and controls */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <TableSearchInput value={displaySearchText} onChange={setSearch} placeholder="Buscar por nome, código, marca, categoria..." isPending={displaySearchText !== searchingFor} />
          <div className="flex gap-2">
            <ItemsNeededColumnVisibilityManager columns={allColumns} visibleColumns={visibleColumns} onVisibilityChange={setVisibleColumns} />
          </div>
        </div>

        {/* Table */}
        <ItemsNeededTable itemsConfig={itemsConfig} filters={queryFilters} visibleColumns={visibleColumns} onDataChange={handleTableDataChange} />
      </CardContent>
    </Card>
  );
}
