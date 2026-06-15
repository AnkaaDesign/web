import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IconBeach, IconAlertTriangle } from "@tabler/icons-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { SimplePaginationAdvanced } from "@/components/ui/pagination-advanced";
import { cn } from "@/lib/utils";
import { routes } from "../../../../constants";
import { useVacationGroups } from "../../../../hooks/personnel-department/use-vacation-groups";
import { useTableState } from "@/hooks/common/use-table-state";
import { createVacationGroupColumns } from "./vacation-group-table-columns";

interface VacationGroupListProps {
  className?: string;
}

const DEFAULT_PAGE_SIZE = 40;

export function VacationGroupList({ className }: VacationGroupListProps) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const { page, pageSize, setPage, setPageSize } = useTableState({
    defaultPageSize: DEFAULT_PAGE_SIZE,
    resetSelectionOnPageChange: false,
  });

  const columns = useMemo(() => createVacationGroupColumns(), []);

  const queryParams = useMemo(
    () => ({
      page: page + 1,
      limit: pageSize,
      include: { periods: true, vacations: true },
      orderBy: { createdAt: "desc" as const },
      ...(search.trim() ? { searchingFor: search.trim() } : {}),
    }),
    [page, pageSize, search],
  );

  const { data: response, isLoading, error } = useVacationGroups(queryParams);
  const groups = response?.data || [];
  const totalRecords = response?.meta?.totalRecords || 0;
  const totalPages = Math.ceil(totalRecords / pageSize);

  return (
    <Card className={cn("flex flex-col shadow-sm border border-border", className)}>
      <CardContent className="flex-1 flex flex-col p-4 space-y-4 overflow-hidden">
        <TableSearchInput value={search} onChange={(value) => setSearch(value)} placeholder="Buscar por nome ou observações" />

        <div className="flex-1 min-h-0 overflow-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted hover:bg-muted">
                {columns.map((column) => (
                  <TableHead
                    key={column.key}
                    className={cn(
                      "whitespace-nowrap text-foreground font-bold uppercase text-xs",
                      column.className,
                      column.align === "center" && "text-center",
                      column.align === "right" && "text-right",
                    )}
                  >
                    {column.header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {error ? (
                <TableRow>
                  <TableCell colSpan={columns.length}>
                    <div className="flex flex-col items-center justify-center p-8 text-center text-destructive">
                      <IconAlertTriangle className="h-8 w-8 mb-4" />
                      <div className="text-lg font-medium mb-2">Não foi possível carregar as férias coletivas</div>
                      <div className="text-sm text-muted-foreground">Tente novamente mais tarde.</div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : isLoading ? (
                <TableRow>
                  <TableCell colSpan={columns.length}>
                    <div className="flex items-center justify-center p-8 text-muted-foreground">Carregando...</div>
                  </TableCell>
                </TableRow>
              ) : groups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length}>
                    <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                      <IconBeach className="h-12 w-12 text-muted-foreground/50 mb-4" />
                      <div className="text-lg font-medium mb-2">Nenhuma férias coletiva encontrada</div>
                      <div className="text-sm">Use a ação "Novas Férias Coletivas" para começar.</div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                groups.map((group, index) => (
                  <TableRow
                    key={group.id}
                    className={cn("cursor-pointer transition-colors", index % 2 === 1 && "bg-muted/10", "hover:bg-muted/20")}
                    onClick={() => navigate(routes.personnelDepartment.vacations.collectiveDetails(group.id))}
                  >
                    {columns.map((column) => (
                      <TableCell
                        key={column.key}
                        className={cn(column.className, column.align === "center" && "text-center", column.align === "right" && "text-right")}
                      >
                        {column.accessor(group)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

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
      </CardContent>
    </Card>
  );
}
