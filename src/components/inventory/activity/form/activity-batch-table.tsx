import React, { useMemo } from "react";
import type { UseFieldArrayUpdate } from "react-hook-form";
import { IconTrash } from "@tabler/icons-react";
import type { User } from "../../../../types";
import { ACTIVITY_OPERATION_LABELS, ACTIVITY_REASON_LABELS } from "../../../../constants";
import { useItem } from "../../../../hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SimplePaginationAdvanced } from "@/components/ui/pagination-advanced";
import { ActivityUserSelector } from "./activity-user-selector";
import { cn } from "@/lib/utils";
import { TABLE_LAYOUT } from "@/components/ui/table-constants";
import { useScrollbarWidth } from "@/hooks/common/use-scrollbar-width";
import { useTableState } from "@/hooks/common/use-table-state";

interface ActivityField {
  itemId: string;
  quantity: number;
  operation: string;
  reason?: string;
  userId?: string;
}

interface ActivityBatchTableProps {
  fields: ActivityField[];
  update: UseFieldArrayUpdate<any, "activities">;
  remove: (index: number) => void;
  users: User[];
}

const ActivityBatchTableRow = ({
  field,
  index,
  update,
  remove,
  users,
}: {
  field: ActivityField;
  index: number;
  update: UseFieldArrayUpdate<any, "activities">;
  remove: (index: number) => void;
  users: User[];
}) => {
  const { data: itemResponse } = useItem(field.itemId, {
    include: {
      brand: true,
      category: true,
    },
  });

  const item = itemResponse?.data;

  const handleQuantityChange = (value: string) => {
    const numValue = parseFloat(value) || 0.01;
    update(index, { ...field, quantity: numValue });
  };

  const handleUserChange = (userId: string | undefined) => {
    update(index, { ...field, userId });
  };

  return (
    <TableRow className={cn("cursor-pointer transition-colors border-b border-border", index % 2 === 1 && "bg-muted/10", "hover:bg-muted/20")}>
      <TableCell className="w-28 p-0 !border-r-0">
        <div className="px-4 py-2">
          <div className="font-mono text-sm">{item?.uniCode || "-"}</div>
        </div>
      </TableCell>
      <TableCell className="p-0 !border-r-0">
        <div className="px-4 py-2">
          <div className="font-medium">{item ? item.name : "Carregando..."}</div>
          {item?.brand?.name && <div className="text-xs text-muted-foreground">{item.brand.name}</div>}
        </div>
      </TableCell>
      <TableCell className="w-24 p-0 !border-r-0">
        <div className="px-4 py-2">
          <Input
            type="number"
            min={0.01}
            max={999999}
            step={0.01}
            value={field.quantity || 0}
            onChange={(value: string | number | null) => handleQuantityChange(typeof value === 'string' ? value : String(value ?? ''))}
            className="w-full h-8"
          />
        </div>
      </TableCell>
      <TableCell className="w-32 p-0 !border-r-0">
        <div className="px-4 py-2">
          <Badge variant={field.operation === "INBOUND" ? "success" : "destructive"} className="text-xs">
            {ACTIVITY_OPERATION_LABELS[field.operation as keyof typeof ACTIVITY_OPERATION_LABELS]}
          </Badge>
        </div>
      </TableCell>
      <TableCell className="w-36 p-0 !border-r-0">
        <div className="px-4 py-2">
          <Badge variant="outline" className="text-xs">
            {field.reason ? ACTIVITY_REASON_LABELS[field.reason as keyof typeof ACTIVITY_REASON_LABELS] : "-"}
          </Badge>
        </div>
      </TableCell>
      <TableCell className="w-48 p-0 !border-r-0">
        <div className="px-4 py-2">
          <ActivityUserSelector value={field.userId} onChange={handleUserChange} users={users} placeholder="Selecione..." size="sm" />
        </div>
      </TableCell>
      <TableCell className="w-20 p-0 !border-r-0">
        <div className="px-4 py-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)} className="h-8 w-8 p-0">
            <IconTrash className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
};

export const ActivityBatchTable = ({ fields, update, remove, users }: ActivityBatchTableProps) => {
  const totalQuantity = fields.reduce((sum, field) => sum + field.quantity, 0);

  // Get scrollbar width info
  const { width: scrollbarWidth, isOverlay } = useScrollbarWidth();

  // Use table state for pagination (but not URL state since this is in a form)
  const { page, pageSize, setPage, setPageSize } = useTableState({
    defaultPageSize: 10, // Smaller page size for form editing
    resetSelectionOnPageChange: false,
  });

  // Calculate pagination
  const totalPages = Math.ceil(fields.length / pageSize);
  const startIndex = (page - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, fields.length);

  // Get current page fields
  const paginatedFields = useMemo(() => {
    return fields.slice(startIndex, endIndex);
  }, [fields, startIndex, endIndex]);

  // Adjust page if necessary when fields change
  React.useEffect(() => {
    if (page > totalPages && totalPages > 0) {
      setPage(totalPages);
    }
  }, [page, totalPages, setPage]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 flex flex-col overflow-hidden rounded-lg">
        {/* Fixed Header Table */}
        <div className="border border-border rounded-t-lg overflow-hidden">
          <Table className={cn("w-full [&>div]:border-0 [&>div]:rounded-none", TABLE_LAYOUT.tableLayout)}>
            <TableHeader className="[&_tr]:border-b-0 bg-muted">
              <TableRow className="bg-muted hover:bg-muted even:bg-muted">
                <TableHead className="w-28 whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0">
                  <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">Código</div>
                </TableHead>
                <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0">
                  <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">Item</div>
                </TableHead>
                <TableHead className="w-24 whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0">
                  <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">Quantidade</div>
                </TableHead>
                <TableHead className="w-32 whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0">
                  <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">Operação</div>
                </TableHead>
                <TableHead className="w-36 whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0">
                  <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">Motivo</div>
                </TableHead>
                <TableHead className="w-48 whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0">
                  <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">Usuário</div>
                </TableHead>
                <TableHead className="w-20 whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0">
                  <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">Ações</div>
                </TableHead>

                {/* Scrollbar spacer - only show if not overlay scrollbar */}
                {!isOverlay && <TableHead style={{ width: `${scrollbarWidth}px`, minWidth: `${scrollbarWidth}px` }} className="p-0 border-0 !border-r-0 shrink-0"></TableHead>}
              </TableRow>
            </TableHeader>
          </Table>
        </div>

        {/* Scrollable Body Table */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden border-x border-border">
          <Table className={cn("w-full [&>div]:border-0 [&>div]:rounded-none", TABLE_LAYOUT.tableLayout)}>
            <TableBody>
              {paginatedFields.map((field, paginatedIndex) => {
                const originalIndex = startIndex + paginatedIndex;
                return <ActivityBatchTableRow key={field.itemId} field={field} index={originalIndex} update={update} remove={remove} users={users} />;
              })}
            </TableBody>
          </Table>
        </div>

        {/* Pagination and Summary Footer */}
        <div className="border-x border-b border-border rounded-b-lg bg-card">
          {/* Pagination - only show if there are multiple pages */}
          {totalPages > 1 && (
            <div className="p-3 border-b border-border">
              <SimplePaginationAdvanced
                currentPage={page}
                totalPages={totalPages}
                pageSize={pageSize}
                totalItems={fields.length}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
                pageSizeOptions={[5, 10, 20, 30]}
                showPageInfo={true}
                showPageSizeSelector={true}
                showGoToPage={totalPages > 5}
              />
            </div>
          )}

          {/* Summary */}
          <div className="p-3 bg-muted/50">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Total de itens: <span className="font-medium text-foreground">{fields.length}</span>
                {totalPages > 1 && (
                  <span className="ml-2">
                    (Página {page} de {totalPages})
                  </span>
                )}
              </div>
              <div className="text-sm text-muted-foreground">
                Quantidade total: <span className="font-medium text-foreground">{totalQuantity.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
