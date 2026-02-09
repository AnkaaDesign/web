import { useMemo } from "react";
import { IconUsers, IconEye } from "@tabler/icons-react";

import type { Message } from "../../../../types";
import type { UserGetManyFormData } from "../../../../schemas";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { UserTable } from "@/components/administration/user/list/user-table";
import { ColumnVisibilityManager } from "@/components/administration/user/list/column-visibility-manager";
import { createUserColumns } from "@/components/administration/user/list/user-table-columns";
import { useColumnVisibility } from "@/hooks/common/use-column-visibility";
import { useTableFilters } from "@/hooks/common/use-table-filters";

interface MessageViewersTableProps {
  message: Message & { views?: Array<{ userId: string; viewedAt: string | Date; dismissedAt?: string | Date | null }> };
}

export function MessageViewersTable({ message }: MessageViewersTableProps) {
  // Use table filters for search functionality
  const {
    searchingFor,
    displaySearchText,
    setSearch,
  } = useTableFilters<UserGetManyFormData>({
    defaultFilters: {},
    searchDebounceMs: 500,
    searchParamName: "viewerSearch",
  });

  // Visible columns state with localStorage persistence
  const { visibleColumns, setVisibleColumns } = useColumnVisibility(
    "message-detail-viewer-visible-columns",
    new Set(["payrollNumber", "name", "email", "phone", "position.name", "status"])
  );

  // Get all available columns for column visibility manager
  const allColumns = useMemo(() => createUserColumns(), []);

  // Extract user IDs from message views (already included in message data)
  const viewerUserIds = useMemo(() => {
    if (!message.views || message.views.length === 0) return [];
    return message.views.map((view) => view.userId);
  }, [message.views]);

  // Filter to only show users who viewed this message, with search
  const filters = useMemo(() => {
    if (viewerUserIds.length === 0) {
      // Return a filter that will return no results
      return {
        where: {
          id: { in: ["__no_results__"] },
        },
        searchingFor: searchingFor || undefined,
      };
    }
    return {
      where: {
        id: { in: viewerUserIds },
      },
      searchingFor: searchingFor || undefined,
    };
  }, [viewerUserIds, searchingFor]);

  // Show empty state if no viewers
  if (viewerUserIds.length === 0) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconEye className="h-5 w-5" />
            Usuários que Visualizaram
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
            <IconUsers className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <div className="text-lg font-medium mb-2">Nenhuma visualização</div>
            <div className="text-sm">Esta mensagem ainda não foi visualizada por nenhum usuário.</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IconEye className="h-5 w-5" />
            Usuários que Visualizaram ({viewerUserIds.length})
          </div>
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

        {/* User Table - with height constraint wrapper */}
        <div style={{ minHeight: "400px", maxHeight: "600px" }}>
          <UserTable
            visibleColumns={visibleColumns}
            filters={filters}
          />
        </div>
      </CardContent>
    </Card>
  );
}
