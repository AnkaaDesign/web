import { memo } from "react";
import type { Table } from "@tanstack/react-table";
import { SimplePaginationAdvanced } from "@/components/ui/pagination-advanced";

interface DataTablePaginationProps<TData> {
  table: Table<TData>;
  /**
   * A página e o tamanho vêm como PROPS, não de `table.getState()` aqui dentro: o
   * `table` do TanStack é uma referência estável, e com o `memo` abaixo o rodapé
   * só re-renderiza quando alguma prop muda. Lendo do `table`, ir da página 1
   * para a 2 com o total inalterado não mudava prop nenhuma — os dados trocavam
   * e o rodapé ficava congelado na 1 até recarregar.
   */
  pageIndex: number;
  pageSize: number;
  /** Total rows across all pages (filtered count in client mode, server total otherwise). */
  totalItems: number;
  pageSizeOptions?: number[];
}

function DataTablePaginationInner<TData>({ table, pageIndex, pageSize, totalItems, pageSizeOptions }: DataTablePaginationProps<TData>) {
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
// the pagination footer (the `table` ref is stable; pageIndex/pageSize/totalItems/pageSizeOptions only
// change when the footer really has to redraw).
export const DataTablePagination = memo(DataTablePaginationInner) as typeof DataTablePaginationInner;
