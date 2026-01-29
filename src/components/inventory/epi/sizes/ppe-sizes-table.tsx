import React from "react";
import { useNavigate } from "react-router-dom";
import type { User } from "../../../../types";
import type { UserGetManyFormData } from "../../../../schemas";
import { routes } from "../../../../constants";
import { useUsers } from "../../../../hooks";
import {
  SHIRT_SIZE_LABELS,
  BOOT_SIZE_LABELS,
  PANTS_SIZE_LABELS,
  SLEEVES_SIZE_LABELS,
  MASK_SIZE_LABELS,
  GLOVES_SIZE_LABELS,
  RAIN_BOOTS_SIZE_LABELS,
} from "../../../../constants";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { IconChevronUp, IconChevronDown, IconSelector, IconShirt, IconShoe, IconHanger, IconMask, IconHandGrab, IconUmbrella, IconAlertTriangle, IconRefresh } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { SimplePaginationAdvanced } from "@/components/ui/pagination-advanced";
import { useTableState, convertSortConfigsToOrderBy } from "@/hooks/use-table-state";
import { Badge } from "@/components/ui/badge";
import { useScrollbarWidth } from "@/hooks/use-scrollbar-width";
import { TABLE_LAYOUT } from "@/components/ui/table-constants";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";

interface PpeSizesTableProps {
  visibleColumns: Set<string>;
  className?: string;
  filters?: Partial<UserGetManyFormData>;
  onDataChange?: (data: { users: User[]; totalRecords: number }) => void;
}

function getSizeLabel(field: string, value: string | null): string {
  if (!value) return "-";
  switch (field) {
    case "shirts":
      return SHIRT_SIZE_LABELS[value as keyof typeof SHIRT_SIZE_LABELS] || value;
    case "pants":
      return PANTS_SIZE_LABELS[value as keyof typeof PANTS_SIZE_LABELS] || value;
    case "shorts":
      return PANTS_SIZE_LABELS[value as keyof typeof PANTS_SIZE_LABELS] || value;
    case "boots":
      return BOOT_SIZE_LABELS[value as keyof typeof BOOT_SIZE_LABELS] || value;
    case "sleeves":
      return SLEEVES_SIZE_LABELS[value as keyof typeof SLEEVES_SIZE_LABELS] || value;
    case "mask":
      return MASK_SIZE_LABELS[value as keyof typeof MASK_SIZE_LABELS] || value;
    case "gloves":
      return GLOVES_SIZE_LABELS[value as keyof typeof GLOVES_SIZE_LABELS] || value;
    case "rainBoots":
      return RAIN_BOOTS_SIZE_LABELS[value as keyof typeof RAIN_BOOTS_SIZE_LABELS] || value;
    default:
      return value;
  }
}

export interface PpeSizeColumn {
  key: string;
  header: string;
  accessor: (user: User) => React.ReactNode;
  sortable?: boolean;
  className?: string;
  align?: "left" | "center" | "right";
}

export function createPpeSizeColumns(): PpeSizeColumn[] {
  return [
    {
      key: "name",
      header: "COLABORADOR",
      accessor: (user: User) => (
        <div className="font-medium text-sm truncate" title={user.name}>{user.name}</div>
      ),
      sortable: true,
      className: "min-w-[200px]",
      align: "left",
    },
    {
      key: "position.name",
      header: "CARGO",
      accessor: (user: User) => (
        <div className="text-sm text-muted-foreground truncate" title={user.position?.name}>{user.position?.name || <span className="text-muted-foreground">-</span>}</div>
      ),
      sortable: true,
      className: "min-w-[120px]",
      align: "left",
    },
    {
      key: "sector.name",
      header: "SETOR",
      accessor: (user: User) => (
        <div className="text-sm text-muted-foreground truncate" title={user.sector?.name}>{user.sector?.name || <span className="text-muted-foreground">-</span>}</div>
      ),
      sortable: true,
      className: "min-w-[120px]",
      align: "left",
    },
    {
      key: "ppeSize.shirts",
      header: "CAMISA",
      accessor: (user: User) => {
        const value = user.ppeSize?.shirts as string | null | undefined;
        return value ? (
          <Badge variant="secondary" className="font-medium text-xs">{getSizeLabel("shirts", value)}</Badge>
        ) : (
          <span className="text-muted-foreground/40 text-xs">-</span>
        );
      },
      sortable: true,
      className: "w-[1%] whitespace-nowrap",
      align: "left",
    },
    {
      key: "ppeSize.pants",
      header: "CALÇA",
      accessor: (user: User) => {
        const value = user.ppeSize?.pants as string | null | undefined;
        return value ? (
          <Badge variant="secondary" className="font-medium text-xs">{getSizeLabel("pants", value)}</Badge>
        ) : (
          <span className="text-muted-foreground/40 text-xs">-</span>
        );
      },
      sortable: true,
      className: "w-[1%] whitespace-nowrap",
      align: "left",
    },
    {
      key: "ppeSize.shorts",
      header: "BERMUDA",
      accessor: (user: User) => {
        const value = user.ppeSize?.shorts as string | null | undefined;
        return value ? (
          <Badge variant="secondary" className="font-medium text-xs">{getSizeLabel("shorts", value)}</Badge>
        ) : (
          <span className="text-muted-foreground/40 text-xs">-</span>
        );
      },
      sortable: true,
      className: "w-[1%] whitespace-nowrap",
      align: "left",
    },
    {
      key: "ppeSize.boots",
      header: "BOTA",
      accessor: (user: User) => {
        const value = user.ppeSize?.boots as string | null | undefined;
        return value ? (
          <Badge variant="secondary" className="font-medium text-xs">{getSizeLabel("boots", value)}</Badge>
        ) : (
          <span className="text-muted-foreground/40 text-xs">-</span>
        );
      },
      sortable: true,
      className: "w-[1%] whitespace-nowrap",
      align: "left",
    },
    {
      key: "ppeSize.sleeves",
      header: "MANGUITO",
      accessor: (user: User) => {
        const value = user.ppeSize?.sleeves as string | null | undefined;
        return value ? (
          <Badge variant="secondary" className="font-medium text-xs">{getSizeLabel("sleeves", value)}</Badge>
        ) : (
          <span className="text-muted-foreground/40 text-xs">-</span>
        );
      },
      sortable: true,
      className: "w-[1%] whitespace-nowrap",
      align: "left",
    },
    {
      key: "ppeSize.mask",
      header: "MÁSCARA",
      accessor: (user: User) => {
        const value = user.ppeSize?.mask as string | null | undefined;
        return value ? (
          <Badge variant="secondary" className="font-medium text-xs">{getSizeLabel("mask", value)}</Badge>
        ) : (
          <span className="text-muted-foreground/40 text-xs">-</span>
        );
      },
      sortable: true,
      className: "w-[1%] whitespace-nowrap",
      align: "left",
    },
    {
      key: "ppeSize.gloves",
      header: "LUVA",
      accessor: (user: User) => {
        const value = user.ppeSize?.gloves as string | null | undefined;
        return value ? (
          <Badge variant="secondary" className="font-medium text-xs">{getSizeLabel("gloves", value)}</Badge>
        ) : (
          <span className="text-muted-foreground/40 text-xs">-</span>
        );
      },
      sortable: true,
      className: "w-[1%] whitespace-nowrap",
      align: "left",
    },
    {
      key: "ppeSize.rainBoots",
      header: "GALOCHA",
      accessor: (user: User) => {
        const value = user.ppeSize?.rainBoots as string | null | undefined;
        return value ? (
          <Badge variant="secondary" className="font-medium text-xs">{getSizeLabel("rainBoots", value)}</Badge>
        ) : (
          <span className="text-muted-foreground/40 text-xs">-</span>
        );
      },
      sortable: true,
      className: "w-[1%] whitespace-nowrap",
      align: "left",
    },
  ];
}

export const DEFAULT_PPE_SIZE_VISIBLE_COLUMNS = new Set([
  "name", "sector.name",
  "ppeSize.shirts", "ppeSize.pants", "ppeSize.shorts", "ppeSize.boots", "ppeSize.sleeves",
  "ppeSize.mask", "ppeSize.gloves", "ppeSize.rainBoots",
]);

export function PpeSizesTable({ visibleColumns, className, filters = {}, onDataChange }: PpeSizesTableProps) {
  const navigate = useNavigate();
  const { width: scrollbarWidth, isOverlay } = useScrollbarWidth();

  const {
    page,
    pageSize,
    sortConfigs,
    setPage,
    setPageSize,
    toggleSort,
    getSortDirection,
    getSortOrder,
  } = useTableState({
    defaultPageSize: 40,
    resetSelectionOnPageChange: false,
    defaultSort: [{ column: "name", direction: "asc" }],
  });

  const includeConfig = React.useMemo(
    () => ({
      position: true,
      sector: true,
      ppeSize: true,
    }),
    [],
  );

  const queryParams = React.useMemo(() => ({
    ...filters,
    page: Math.max(1, page + 1),
    limit: pageSize,
    include: includeConfig,
    ...(sortConfigs.length > 0 && {
      orderBy: convertSortConfigsToOrderBy(sortConfigs),
    }),
  }), [filters, page, pageSize, includeConfig, sortConfigs]);

  const { data: response, isLoading, error } = useUsers(queryParams);

  const users = response?.data || [];
  const totalRecords = response?.meta?.totalRecords || 0;
  const totalPages = Math.ceil(totalRecords / pageSize);

  // Notify parent
  const lastNotifiedDataRef = React.useRef<string>("");
  React.useEffect(() => {
    if (onDataChange) {
      const dataKey = users.length > 0 ? `${totalRecords}-${users.map((u) => u.id).join(",")}` : `empty-${totalRecords}`;
      if (dataKey !== lastNotifiedDataRef.current) {
        lastNotifiedDataRef.current = dataKey;
        onDataChange({ users, totalRecords });
      }
    }
  }, [users, totalRecords, onDataChange]);

  const allColumns = React.useMemo(() => createPpeSizeColumns(), []);
  const columns = allColumns.filter((col) => visibleColumns.has(col.key));

  const renderSortIndicator = (columnKey: string) => {
    const direction = getSortDirection(columnKey);
    const order = getSortOrder(columnKey);
    return (
      <div className="inline-flex items-center ml-1">
        {direction === null && <IconSelector className="h-4 w-4 text-muted-foreground" />}
        {direction === "asc" && <IconChevronUp className="h-4 w-4 text-foreground" />}
        {direction === "desc" && <IconChevronDown className="h-4 w-4 text-foreground" />}
        {order !== null && sortConfigs.length > 1 && <span className="text-xs ml-0.5">{order + 1}</span>}
      </div>
    );
  };

  return (
    <div className={cn("rounded-lg flex flex-col", className)}>
      {/* Fixed Header */}
      <div className="border-l border-r border-t border-border rounded-t-lg overflow-hidden shrink-0">
        <Table className={cn("w-full", TABLE_LAYOUT.tableLayout)}>
          <colgroup>
            {columns.map((column) => (
              <col key={column.key} className={column.key.startsWith("ppeSize.") ? "w-[8%]" : undefined} />
            ))}
            {!isOverlay && <col style={{ width: `${scrollbarWidth}px` }} />}
          </colgroup>
          <TableHeader className="[&_tr]:border-b-0 [&_tr]:hover:bg-muted">
            <TableRow className="bg-muted hover:bg-muted even:bg-muted">
              {columns.map((column) => (
                <TableHead key={column.key} className={cn("whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0")}>
                  {column.sortable ? (
                    <button
                      onClick={() => toggleSort(column.key)}
                      className={cn(
                        "flex items-center gap-1 w-full h-full min-h-[2.5rem] px-4 py-2 hover:bg-muted/80 transition-colors cursor-pointer text-left border-0 bg-transparent",
                        column.align === "center" && "justify-center",
                        column.align === "right" && "justify-end",
                        !column.align && "justify-start",
                      )}
                      disabled={isLoading || users.length === 0}
                    >
                      <TruncatedTextWithTooltip text={column.header} />
                      {renderSortIndicator(column.key)}
                    </button>
                  ) : (
                    <div
                      className={cn(
                        "flex items-center h-full min-h-[2.5rem] px-4 py-2",
                        column.align === "center" && "justify-center text-center",
                        column.align === "right" && "justify-end text-right",
                        !column.align && "justify-start text-left",
                      )}
                    >
                      <TruncatedTextWithTooltip text={column.header} />
                    </div>
                  )}
                </TableHead>
              ))}
              {!isOverlay && (
                <TableHead style={{ width: `${scrollbarWidth}px`, minWidth: `${scrollbarWidth}px` }} className="bg-muted p-0 border-0 !border-r-0 shrink-0" />
              )}
            </TableRow>
          </TableHeader>
        </Table>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden border-l border-r border-border">
        <Table className={cn("w-full", TABLE_LAYOUT.tableLayout)}>
          <colgroup>
            {columns.map((column) => (
              <col key={column.key} className={column.key.startsWith("ppeSize.") ? "w-[8%]" : undefined} />
            ))}
          </colgroup>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center py-8">
                  <div className="flex items-center justify-center">
                    <IconRefresh className="h-4 w-4 mr-2 animate-spin" />
                    Carregando...
                  </div>
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="p-0">
                  <div className="flex flex-col items-center justify-center p-8 text-center text-destructive">
                    <IconAlertTriangle className="h-8 w-8 mb-4" />
                    <div className="text-lg font-medium mb-2">Não foi possível carregar os tamanhos de EPI</div>
                    <div className="text-sm text-muted-foreground">Tente novamente mais tarde.</div>
                  </div>
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="p-0">
                  <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                    <IconShirt className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <div className="text-lg font-medium mb-2">Nenhum colaborador encontrado</div>
                    <div className="text-sm">Ajuste os filtros para ver mais resultados.</div>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              users.map((user: User, index: number) => (
                <TableRow
                  key={user.id}
                  className={cn(
                    "cursor-pointer transition-colors border-b border-border",
                    index % 2 === 1 && "bg-muted/10",
                    "hover:bg-muted/20",
                  )}
                  onClick={() => navigate(routes.administration.collaborators.details(user.id))}
                >
                  {columns.map((column) => (
                    <TableCell
                      key={column.key}
                      className={cn(
                        "p-0 !border-r-0",
                        column.align === "center" && "text-center",
                        column.align === "right" && "text-right",
                        !column.align && "text-left",
                      )}
                    >
                      <div className={cn(
                        "px-4 py-2",
                        column.align === "center" && "flex justify-center",
                        column.align === "right" && "flex justify-end",
                      )}>
                        {column.accessor(user)}
                      </div>
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
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
