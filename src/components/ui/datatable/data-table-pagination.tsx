import { memo } from "react";
import type { Table } from "@tanstack/react-table";
import { SimplePaginationAdvanced } from "@/components/ui/pagination-advanced";

interface DataTablePaginationProps<TData> {
  table: Table<TData>;
  /** Total rows across all pages (filtered count in client mode, server total otherwise). */
  totalItems: number;
  pageSizeOptions?: number[];
}

function DataTablePaginationInner<TData>({ table, totalItems, pageSizeOptions }: DataTablePaginationProps<TData>) {
  const { pageIndex, pageSize } = table.getState().pagination;
  return (
    <SimplePaginationAdvanced
      currentPage={pageIndex}
      totalPages={Math.max(1, table.getPageCount())}
      pageSize={pageSize}
      totalItems={totalItems}
      pageSizeOptions={pageSizeOptions}
      onPageChange={(p) => table.setPageIndex(p)}
      onPageSizeChange={(s) => table.setPageSize(s)}
    />
  );
}

// Memoized so a virtualizer scroll tick re-rendering <DataTable> doesn't re-render
// the pagination footer (the `table` ref is stable; totalItems/pageSizeOptions are stable).
export const DataTablePagination = memo(DataTablePaginationInner) as typeof DataTablePaginationInner;
