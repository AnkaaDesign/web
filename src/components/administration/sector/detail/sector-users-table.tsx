import { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { IconUsers, IconChevronRight } from "@tabler/icons-react";

import type { Sector, User } from "../../../../types";
import type { UserGetManyFormData } from "../../../../schemas";
import { routes } from "../../../../constants";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { UserTable } from "@/components/administration/user/list/user-table";
import { ColumnVisibilityManager } from "@/components/administration/user/list/column-visibility-manager";
import { createUserColumns } from "@/components/administration/user/list/user-table-columns";
import { useColumnVisibility } from "@/hooks/common/use-column-visibility";
import { useTableFilters } from "@/hooks/common/use-table-filters";

interface SectorUsersTableProps {
  sector: Sector;
}

export function SectorUsersTable({ sector }: SectorUsersTableProps) {
  const navigate = useNavigate();

  // State to hold current table data
  const [_tableData, setTableData] = useState<{ users: User[]; totalRecords: number }>({ users: [], totalRecords: 0 });

  // Stable callback for table data updates
  const handleTableDataChange = useCallback((data: { users: User[]; totalRecords: number }) => {
    setTableData(data);
  }, []);

  // Use table filters for search functionality
  const {
    searchingFor,
    displaySearchText,
    setSearch,
  } = useTableFilters<UserGetManyFormData>({
    defaultFilters: {},
    searchDebounceMs: 500,
    searchParamName: "userSearch",
  });

  // Visible columns state with localStorage persistence
  const { visibleColumns, setVisibleColumns } = useColumnVisibility(
    "sector-detail-user-visible-columns",
    new Set(["payrollNumber", "name", "email", "phone", "position.name", "status"])
  );

  // Get all available columns for column visibility manager
  const allColumns = useMemo(() => createUserColumns(), []);

  // Filter to only show users from this sector, with search
  // useTableFilters provides searchingFor which is automatically included
  const filters = useMemo(() => {
    return {
      where: {
        sectorId: sector.id,
      },
      searchingFor: searchingFor || undefined, // API expects 'searchingFor' parameter
    };
  }, [sector.id, searchingFor]);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IconUsers className="h-5 w-5" />
            Usuários do Setor
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(routes.administration.users.root + `?sectorId=${sector.id}`)}
          >
            Ver todos os usuários
            <IconChevronRight className="h-4 w-4 ml-2" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search and Column Visibility Controls */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <TableSearchInput
            value={displaySearchText}
            onChange={(value) => setSearch(value)}
            placeholder="Buscar por nome, email, CPF, PIS..."
            isPending={displaySearchText !== searchingFor}
          />
          <div className="flex gap-2">
            <ColumnVisibilityManager
              columns={allColumns}
              visibleColumns={visibleColumns}
              onVisibilityChange={setVisibleColumns}
            />
          </div>
        </div>

        {/* User Table - with height constraint wrapper (UserTable doesn't have built-in height) */}
        <div style={{ minHeight: "400px", maxHeight: "600px" }}>
          <UserTable
            visibleColumns={visibleColumns}
            filters={filters}
            onDataChange={handleTableDataChange}
          />
        </div>
      </CardContent>
    </Card>
  );
}
