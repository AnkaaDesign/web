// web/src/components/cliente/portal-table.tsx
//
// A TABELA INTERNA DE UM CARTÃO DO PORTAL.
//
// ⛔ NÃO substitui o `DataTable` de `@/components/ui/datatable`, e não compete
// com ele: as telas de LISTA do portal (Orçamentos, Veículos, Pedidos) usam o
// `DataTablePage` da casa, como o §10 manda. Esta peça serve ao caso que aquele
// componente não atende — a tabela que mora DENTRO de um cartão, subordinada a
// um registro-pai.
//
// É o caso de Cobranças. O dado é aninhado (cobrança → parcelas + notas), e as
// três coisas que o cartão carrega não cabem numa tabela plana:
//
//   • o estado da COBRANÇA (`BILLING_STATUS`) e o estado da PARCELA
//     (`INSTALLMENT_STATUS`) são dois ciclos diferentes, com `PENDING` e
//     `CANCELLED` querendo dizer coisas distintas em cada um. Achatá-los numa
//     linha só repetiria o estado do pai em cada filha e convidaria os dois a se
//     confundirem — que é o defeito que `BillingStatusBadge` existe para ter
//     corrigido;
//   • a NFS-e é do faturamento, não da parcela: numa tabela de parcelas ela não
//     tem linha onde morar;
//   • cada seção no seu próprio cartão contornado é preferência permanente do
//     dono (§10), e um `DataTablePage` por cobrança seria um cabeçalho de página
//     inteiro, com busca e barra de ferramentas, repetido N vezes na mesma tela.
//
// Então: colunas declaradas, cabeçalho, linhas, estado vazio e esqueleto, sobre
// as MESMAS primitivas de `@/components/ui/table` que o `DataTable` usa. A
// proibição do §10 (`ui/data-table.tsx`, o depreciado) segue respeitada.
import type { ReactNode } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface PortalTableColumn<T> {
  /**
   * ⚠️ SEM PONTO (§10). Vale aqui pela mesma razão que vale no `DataTable`:
   * o id vira chave de configuração e de parâmetro de URL, e um ponto abre
   * caminho aninhado onde deveria haver uma chave só.
   */
  id: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /** Alinha à direita. Dinheiro e datas lêem melhor alinhados. */
  align?: "left" | "right" | "center";
  className?: string;
  headerClassName?: string;
}

export interface PortalTableProps<T> {
  columns: Array<PortalTableColumn<T>>;
  rows: T[];
  getRowId: (row: T) => string;
  loading?: boolean;
  /** Quantas linhas de esqueleto desenhar enquanto carrega. */
  skeletonRows?: number;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: ReactNode;
  emptyAction?: ReactNode;
  /** Linha extra ao pé — totais, por exemplo. */
  footer?: ReactNode;
  className?: string;
}

const alignClass = (align: PortalTableColumn<unknown>["align"]) =>
  align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";

export function PortalTable<T>({
  columns,
  rows,
  getRowId,
  loading = false,
  skeletonRows = 3,
  emptyTitle = "Nada por aqui",
  emptyDescription,
  emptyIcon,
  emptyAction,
  footer,
  className,
}: PortalTableProps<T>) {
  if (!loading && rows.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        icon={emptyIcon}
        action={emptyAction}
      />
    );
  }

  return (
    // A ROLAGEM HORIZONTAL É DESTE QUADRO, NUNCA DA PÁGINA.
    //
    // `/cliente` é isento do `MobileUsageGuard` por prefixo, então metade
    // destas visitas é de celular. Sete colunas em 390px precisam rolar de
    // lado; deixar a PÁGINA rolar arrastaria junto o cabeçalho e as abas do
    // portal, e o contato perderia a navegação para ler uma data.
    <div className={cn("w-full overflow-x-auto", className)}>
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead
                key={column.id}
                className={cn(
                  "whitespace-nowrap",
                  alignClass(column.align),
                  column.headerClassName,
                )}
              >
                {column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading
            ? Array.from({ length: skeletonRows }, (_, index) => (
                <TableRow key={`skeleton-${index}`}>
                  {columns.map((column) => (
                    <TableCell key={column.id}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            : rows.map((row) => (
                <TableRow key={getRowId(row)}>
                  {columns.map((column) => (
                    <TableCell
                      key={column.id}
                      className={cn(alignClass(column.align), column.className)}
                    >
                      {column.cell(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
        </TableBody>
      </Table>
      {footer}
    </div>
  );
}
