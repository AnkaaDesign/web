// web/src/components/cliente/portal-mobile-list.tsx
//
// A LISTA DO PORTAL NO CELULAR — cartões, e não tabela.
//
// A 390 px a tabela de orçamentos mostrava DUAS colunas (Nº e Veículos) e
// escondia estado, validade e valor atrás de uma rolagem lateral que ninguém
// descobre. No celular cada linha vira um CARTÃO com tudo o que a tabela tem.
//
// ⚠️ AS COLUNAS SÃO AS MESMAS DA TABELA — este componente não declara forma
// própria. Ele recebe as `DataTableColumnDef` da página e desenha cada uma com
// o próprio `cell` dela (rótulo de `meta.headerLabel`): estado, recorte por
// papel e formatação continuam num lugar só. A primeira coluna é o título do
// cartão; as demais, pares rótulo/valor.
//
// A busca, o filtro de estado e a paginação falam o MESMO idioma da tabela:
// `onParamsChange({ search, filters })` para a página e `?page=` no endereço.
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { IconChevronLeft, IconChevronRight, IconSearch } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  DataTableColumnDef,
  DataTableFilterDef,
  DataTableFilterValues,
} from "@/components/ui/datatable";
import { cn } from "@/lib/utils";

interface Meta {
  headerLabel?: string;
}

/** O valor de uma coluna para uma linha — o `accessorFn` dela, quando há. */
function valorDa<T>(column: DataTableColumnDef<T>, row: T, index: number): unknown {
  const accessor = (column as { accessorFn?: (row: T, index: number) => unknown }).accessorFn;
  if (accessor) return accessor(row, index);
  const key = (column as { accessorKey?: string }).accessorKey;
  return key ? (row as Record<string, unknown>)[key] : undefined;
}

/**
 * Desenha a célula com o `cell` da própria coluna.
 *
 * O `cell` do TanStack recebe um contexto grande; as colunas do portal só usam
 * `row.original` e `getValue()`. É esse o contrato mínimo que entregamos — uma
 * coluna nova que precise de mais quebra aqui, à vista, no teste de tela.
 */
function celula<T>(column: DataTableColumnDef<T>, row: T, index: number): ReactNode {
  const cell = column.cell;
  const value = valorDa(column, row, index);
  if (typeof cell === "function") {
    return (cell as (ctx: unknown) => ReactNode)({
      row: { original: row, index, id: String(index) },
      getValue: () => value,
      column: { id: column.id },
    });
  }
  if (value === null || value === undefined || value === "") return null;
  return String(value);
}

function rotulo<T>(column: DataTableColumnDef<T>): string {
  const meta = column.meta as Meta | undefined;
  if (meta?.headerLabel) return meta.headerLabel;
  return typeof column.header === "string" ? column.header : column.id;
}

export interface PortalMobileListProps<T> {
  rows: T[];
  columns: DataTableColumnDef<T>[];
  getRowId: (row: T) => string;
  onRowClick?: (row: T) => void;
  isLoading?: boolean;
  totalRecords: number;
  page: number;
  pageSize: number;
  searchPlaceholder?: string;
  emptyMessage?: string;
  /** Só `multiselect` é desenhado aqui (é o único que as listas do portal usam). */
  filterDefs?: DataTableFilterDef<T>[];
  /** O estado de busca/filtros que a página já guarda — a mesma fonte da tabela. */
  params: { search: string; filters?: DataTableFilterValues };
  onParamsChange: (next: { search: string; filters: DataTableFilterValues }) => void;
}

export function PortalMobileList<T>({
  rows,
  columns,
  getRowId,
  onRowClick,
  isLoading,
  totalRecords,
  page,
  pageSize,
  searchPlaceholder = "Buscar...",
  emptyMessage = "Nada encontrado.",
  filterDefs = [],
  params,
  onParamsChange,
}: PortalMobileListProps<T>) {
  const [, setSearchParams] = useSearchParams();
  const [busca, setBusca] = useState(params.search);

  // A busca espera a mão parar (400 ms), como a da tabela.
  useEffect(() => {
    if (busca === params.search) return;
    const timer = setTimeout(() => {
      onParamsChange({ search: busca, filters: params.filters ?? {} });
      irParaPagina(1);
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca]);

  const irParaPagina = (next: number) =>
    setSearchParams(
      (current) => {
        const proximo = new URLSearchParams(current);
        if (next <= 1) proximo.delete("page");
        else proximo.set("page", String(next));
        return proximo;
      },
      { replace: true },
    );

  const multiselects = filterDefs.filter((f) => f.type === "multiselect" && f.options?.length);
  const totalPaginas = Math.max(1, Math.ceil(totalRecords / pageSize));
  const [titulo, ...resto] = columns;

  const alternar = (key: string, value: string) => {
    const filtros = params.filters ?? {};
    const atual = Array.isArray(filtros[key]) ? (filtros[key] as string[]) : [];
    const proximo = atual.includes(value) ? atual.filter((v) => v !== value) : [...atual, value];
    onParamsChange({
      search: params.search,
      filters: { ...filtros, [key]: proximo.length ? proximo : undefined },
    });
    irParaPagina(1);
  };

  const cartoes = useMemo(
    () =>
      rows.map((row, index) => (
        <li key={getRowId(row)}>
          <Card
            role={onRowClick ? "button" : undefined}
            tabIndex={onRowClick ? 0 : undefined}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            onKeyDown={
              onRowClick
                ? (event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onRowClick(row);
                    }
                  }
                : undefined
            }
            className={cn(
              "space-y-2 p-4",
              onRowClick && "cursor-pointer transition-colors active:bg-muted/60",
            )}
          >
            {titulo ? (
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 text-base font-semibold">
                  <span className="mr-1 text-sm font-normal text-muted-foreground">{rotulo(titulo)}</span>
                  {celula(titulo, row, index)}
                </div>
                {onRowClick ? <IconChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" /> : null}
              </div>
            ) : null}
            <dl className="space-y-1.5">
              {resto.map((column) => {
                const conteudo = celula(column, row, index);
                return (
                  <div key={column.id} className="flex items-start justify-between gap-3">
                    <dt className="shrink-0 text-sm text-muted-foreground">{rotulo(column)}</dt>
                    <dd className="min-w-0 text-right text-sm">{conteudo ?? "—"}</dd>
                  </div>
                );
              })}
            </dl>
          </Card>
        </li>
      )),
    // As colunas e as linhas decidem tudo; o resto é estável.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, columns, onRowClick],
  );

  return (
    <div className="space-y-3">
      <div className="relative">
        <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          enterKeyHint="search"
          inputMode="search"
          className="h-11 pl-9 text-base"
          placeholder={searchPlaceholder}
          value={busca}
          onChange={(next) => setBusca(String(next ?? ""))}
          aria-label={searchPlaceholder}
        />
      </div>

      {multiselects.map((filtro) => {
        const filtros = params.filters ?? {};
        const ativos = Array.isArray(filtros[filtro.key]) ? (filtros[filtro.key] as string[]) : [];
        return (
          <div key={filtro.key} className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex w-max gap-2" role="group" aria-label={filtro.label}>
              {filtro.options!.map((opcao) => {
                const ativo = ativos.includes(String(opcao.value));
                return (
                  <Button
                    key={String(opcao.value)}
                    type="button"
                    size="sm"
                    variant={ativo ? "default" : "outline"}
                    aria-pressed={ativo}
                    className="h-9 rounded-full"
                    onClick={() => alternar(filtro.key, String(opcao.value))}
                  >
                    {opcao.label}
                  </Button>
                );
              })}
            </div>
          </div>
        );
      })}

      {isLoading ? (
        <ul className="space-y-3">
          {Array.from({ length: 3 }, (_, i) => (
            <li key={i}>
              <Card className="space-y-2 p-4">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </Card>
            </li>
          ))}
        </ul>
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState title={emptyMessage} className="py-10" />
        </Card>
      ) : (
        <ul className="space-y-3">{cartoes}</ul>
      )}

      {totalPaginas > 1 ? (
        <div className="flex items-center justify-between gap-3 pt-1">
          <Button
            type="button"
            variant="outline"
            className="h-11"
            disabled={page <= 1}
            onClick={() => irParaPagina(page - 1)}
          >
            <IconChevronLeft className="mr-1 h-4 w-4" />
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground tabular-nums">
            {page} de {totalPaginas}
          </span>
          <Button
            type="button"
            variant="outline"
            className="h-11"
            disabled={page >= totalPaginas}
            onClick={() => irParaPagina(page + 1)}
          >
            Próxima
            <IconChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
