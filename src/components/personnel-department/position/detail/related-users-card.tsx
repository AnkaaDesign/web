import { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { IconUsers, IconChevronRight } from "@tabler/icons-react";

import type { Position, User } from "../../../../types";
import type { UserGetManyFormData } from "../../../../schemas";
import { routes } from "../../../../constants";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { UserTable } from "@/components/administration/user/list/user-table";
import { ColumnVisibilityManager } from "@/components/administration/user/list/column-visibility-manager";
import { createUserColumns } from "@/components/administration/user/list/user-table-columns";
import { useColumnVisibility } from "@/hooks/common/use-column-visibility";

interface RelatedUsersCardProps {
  position: Position;
}

export function RelatedUsersCard({ position }: RelatedUsersCardProps) {
  const navigate = useNavigate();
  const [searchText, setSearchText] = useState("");
  const [_tableData, setTableData] = useState<{ users: User[]; totalRecords: number }>({ users: [], totalRecords: 0 });

  // Visible columns state with localStorage persistence
  const { visibleColumns, setVisibleColumns } = useColumnVisibility(
    "position-detail-users-visible-columns",
    new Set(["payrollNumber", "name", "email", "phone", "sector.name", "status"])
  );

  // Get all available columns for column visibility manager
  const allColumns = useMemo(() => createUserColumns(), []);

  // Stable callback for table data updates
  const handleTableDataChange = useCallback((data: { users: User[]; totalRecords: number }) => {
    setTableData(data);
  }, []);

  // Filter to only show users from this position with search
  const filters: Partial<UserGetManyFormData> = useMemo(() => {
    return {
      where: {
        positionId: position.id,
      },
      searchingFor: searchText.trim() || undefined, // API expects 'searchingFor' parameter
    };
  }, [position.id, searchText]);

  const handleViewAll = () => {
    navigate(`${routes.administration.collaborators.root}?positions=${position.id}`);
  };

  return (
    <Card className="h-full flex flex-col shadow-sm border border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IconUsers className="h-5 w-5" />
          Funcionários com este Cargo
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-4 pt-0 space-y-4 overflow-hidden">
        {/* Search and controls */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <TableSearchInput
            value={searchText}
            onChange={setSearchText}
            placeholder="Buscar por nome, email, CPF, PIS..."
            isPending={false}
          />
          <div className="flex gap-2">
            <ColumnVisibilityManager columns={allColumns} visibleColumns={visibleColumns} onVisibilityChange={setVisibleColumns} />
            <Button variant="outline" onClick={handleViewAll}>
              Ver todos os usuários
              <IconChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>

        {/* User table with min/max height */}
        <div className="flex-1 min-h-[400px] max-h-[600px]">
          <UserTable
            visibleColumns={visibleColumns}
            filters={filters}
            className="h-full"
            onDataChange={handleTableDataChange}
          />
        </div>
      </CardContent>
    </Card>
  );
}
