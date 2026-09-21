import { memo } from "react";
import type { Table } from "@tanstack/react-table";
import { SimplePaginationAdvanced } from "@/components/ui/pagination-advanced";

interface DataTablePaginationProps<TData> {
  table: Table<TData>;
  /** Total rows across all pages (filtered count in client mode, server total otherwise). */
  totalItems: number;
  pageSizeOptions?: number[];
  /**
   * ⛔ ESTES TRÊS SÃO PROPS, E NÃO SE LÊ `table.getState()` AQUI DENTRO.
   *
   * Este componente é `memo`. O `table` que o TanStack devolve é a MESMA
   * instância a cada render (ele muta o objeto em vez de recriá-lo), e
   * `totalItems`/`pageSizeOptions` são estáveis — então, lendo a página de
   * dentro, o `memo` comparava três props idênticas, PULAVA o render, e o
   * rodapé continuava desenhando o `pageIndex` do render anterior. Para sempre.
   *
   * O estrago era exatamente o defeito relatado: `SimplePaginationAdvanced`
   * calcula o destino do botão "Próxima" como `currentPage + 1`. Com
   * `currentPage` congelado em 0, TODO clique em "próxima" pedia a página 2 —
   * ia uma vez e nunca mais, e o número destacado no rodapé ficava na página em
   * que a tabela montou. Só o seed da URL no mount acertava o rodapé, o que
   * fazia um link `?page=3` parecer correto e escondia o defeito.
   *
   * Por que ninguém via o tempo todo: `totalItems` MUDAVA a cada troca de
   * página nas listas sem `placeholderData` (a contagem caía a 0 enquanto a
   * resposta viajava e voltava), e essa mudança de prop forçava o render que
   * ressincronizava o rodapé. Era o "às vezes vai, às vezes não". Corrigir a
   * contagem com `keepPreviousData` tirou o acidente que mascarava este bug.
   *
   * Passá-los como props preserva a intenção do `memo` — um tick de rolagem do
   * virtualizador re-renderiza a `DataTable` e não o rodapé — e faz o estado da
   * paginação participar da comparação, que é o que faltava.
   */
  pageIndex: number;
  pageSize: number;
  pageCount: number;
}

function DataTablePaginationInner<TData>({
  table,
  totalItems,
  pageSizeOptions,
  pageIndex,
  pageSize,
  pageCount,
}: DataTablePaginationProps<TData>) {
  return (
    <SimplePaginationAdvanced
      currentPage={pageIndex}
      totalPages={Math.max(1, pageCount)}
      pageSize={pageSize}
      totalItems={totalItems}
      pageSizeOptions={pageSizeOptions}
      onPageChange={(p) => table.setPageIndex(p)}
      onPageSizeChange={(s) => table.setPageSize(s)}
    />
  );
}

// Memoized so a virtualizer scroll tick re-rendering <DataTable> doesn't re-render
// the pagination footer. `table` is a stable instance and `totalItems`/`pageSizeOptions`
// are stable — por isso o estado da paginação PRECISA chegar por prop (ver acima).
export const DataTablePagination = memo(DataTablePaginationInner) as typeof DataTablePaginationInner;
