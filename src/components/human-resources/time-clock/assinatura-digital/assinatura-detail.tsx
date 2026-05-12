import { useEffect, useMemo, useState } from "react";
import { IconThumbDown, IconThumbUp, IconHelp } from "@tabler/icons-react";

import { useSecullumAssinaturas, useSecullumAssinaturaById } from "../../../../hooks";
import { formatDate, formatDateTime, debounce } from "../../../../utils";
import { cn } from "@/lib/utils";

import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SimplePaginationAdvanced } from "@/components/ui/pagination-advanced";

import { AssinaturaItemDialog, type AssinaturaDialogItem } from "./assinatura-item-dialog";

interface AssinaturaDetailProps {
  apuracaoId: number;
  className?: string;
}

const DEFAULT_PAGE_SIZE = 50;

function StatusCell({ status }: { status: number }) {
  if (status === 1) {
    return (
      <Badge variant="success" className="gap-1">
        <IconThumbUp className="h-3 w-3" />
        Aprovado
      </Badge>
    );
  }
  if (status === 2) {
    return (
      <Badge variant="destructive" className="gap-1">
        <IconThumbDown className="h-3 w-3" />
        Rejeitado
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1">
      <IconHelp className="h-3 w-3" />
      Pendente
    </Badge>
  );
}

export function AssinaturaDetail({ apuracaoId, className }: AssinaturaDetailProps) {
  // Header data comes from the list (apuração metadata isn't part of the detail
  // response). The list query is normally already cached from the list page.
  const { data: listResponse, isLoading: isListLoading } = useSecullumAssinaturas();
  const { data: detailResponse, isLoading: isDetailLoading } = useSecullumAssinaturaById(apuracaoId);

  const header = useMemo(() => {
    const list = listResponse?.data?.data;
    if (!Array.isArray(list)) return null;
    return list.find((a) => a.Id === apuracaoId) ?? null;
  }, [listResponse, apuracaoId]);

  const items = detailResponse?.data?.data?.ListaItensAssinatura ?? [];

  const [displaySearchText, setDisplaySearchText] = useState("");
  const [searchText, setSearchText] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [selectedItem, setSelectedItem] = useState<AssinaturaDialogItem | null>(null);

  const updateSearch = useMemo(
    () =>
      debounce((value: string) => {
        setSearchText(value);
      }, 200),
    [],
  );

  useEffect(() => {
    setPage(0);
  }, [searchText]);

  const filteredItems = useMemo(() => {
    let arr = [...items];
    if (searchText) {
      const q = searchText.toLowerCase();
      arr = arr.filter((it) => it.Funcionario?.toLowerCase().includes(q));
    }
    arr.sort((a, b) => (a.Funcionario || "").localeCompare(b.Funcionario || "", "pt-BR"));
    return arr;
  }, [items, searchText]);

  const paginated = useMemo(() => {
    const start = page * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, page, pageSize]);

  const totalRecords = filteredItems.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* Header / read-only metadata */}
      <Card className="shadow-sm border border-border">
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-2">
            <Label className="text-xs text-muted-foreground">Descrição</Label>
            {isListLoading && !header ? (
              <Skeleton className="h-9 w-full mt-1" />
            ) : (
              <Input value={header?.Descricao ?? `Apuração #${apuracaoId}`} readOnly disabled />
            )}
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Data Inicial</Label>
            {isListLoading && !header ? (
              <Skeleton className="h-9 w-full mt-1" />
            ) : (
              <Input value={header?.DataInicio ? formatDate(header.DataInicio) : "—"} readOnly disabled />
            )}
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Data Final</Label>
            {isListLoading && !header ? (
              <Skeleton className="h-9 w-full mt-1" />
            ) : (
              <Input value={header?.DataFim ? formatDate(header.DataFim) : "—"} readOnly disabled />
            )}
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Data de Criação</Label>
            {isListLoading && !header ? (
              <Skeleton className="h-9 w-full mt-1" />
            ) : (
              <Input
                value={
                  header?.DataInclusao && new Date(header.DataInclusao).getFullYear() > 1
                    ? formatDateTime(header.DataInclusao)
                    : "—"
                }
                readOnly
                disabled
              />
            )}
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Número</Label>
            <Input value={String(apuracaoId)} readOnly disabled />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Cartões</Label>
            <Input value={header?.NumeroCartoes != null ? String(header.NumeroCartoes) : "—"} readOnly disabled />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Aprovados</Label>
            <Input value={header?.Aprovados != null ? String(header.Aprovados) : "—"} readOnly disabled />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Rejeitados</Label>
            <Input value={header?.Rejeitados != null ? String(header.Rejeitados) : "—"} readOnly disabled />
          </div>
        </CardContent>
      </Card>

      {/* Items table */}
      <Card className="flex-1 flex flex-col shadow-sm border border-border min-h-0">
        <CardContent className="flex-1 flex flex-col p-4 space-y-4 overflow-hidden">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Cartões Ponto ({totalRecords})
            </h3>
            <TableSearchInput
              value={displaySearchText}
              onChange={(v) => {
                setDisplaySearchText(v);
                updateSearch(v);
              }}
              placeholder="Buscar funcionário..."
              isPending={displaySearchText !== searchText}
            />
          </div>

          <div className="flex-1 min-h-0 overflow-auto">
            {isDetailLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : paginated.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-12">
                <p className="text-sm">
                  {searchText ? "Nenhum funcionário corresponde ao filtro." : "Nenhum cartão ponto nesta apuração."}
                </p>
              </div>
            ) : (
              <div className="rounded-lg flex flex-col overflow-hidden h-full">
                <div className="border-l border-r border-t border-border rounded-t-lg overflow-hidden">
                  <Table className="w-full table-fixed">
                    <TableHeader className="[&_tr]:border-b-0 [&_tr]:hover:bg-muted">
                      <TableRow className="bg-muted hover:bg-muted">
                        <TableHead className="text-foreground font-bold uppercase text-xs bg-muted px-4 py-2">
                          Funcionário
                        </TableHead>
                        <TableHead className="text-foreground font-bold uppercase text-xs bg-muted w-[180px] px-4 py-2">
                          Status
                        </TableHead>
                        <TableHead className="text-foreground font-bold uppercase text-xs bg-muted w-[200px] px-4 py-2">
                          Data da Resposta
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                  </Table>
                </div>
                <div className="flex-1 overflow-y-auto overflow-x-hidden border-l border-r border-border">
                  <Table className="w-full table-fixed">
                    <TableBody>
                      {paginated.map((item, index) => (
                        <TableRow
                          key={item.Id}
                          className={cn(
                            "transition-colors border-b border-border cursor-pointer",
                            index % 2 === 1 && "bg-muted/10",
                            "hover:bg-muted/30",
                          )}
                          onClick={() => setSelectedItem(item)}
                        >
                          <TableCell className="font-medium px-4 py-2 truncate">{item.Funcionario || "—"}</TableCell>
                          <TableCell className="w-[180px] px-4 py-2">
                            <StatusCell status={item.Status} />
                          </TableCell>
                          <TableCell className="w-[200px] px-4 py-2 text-muted-foreground">
                            {item.DataResposta ? formatDateTime(item.DataResposta) : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="px-4 border-l border-r border-b border-border rounded-b-lg bg-muted/50">
                  <SimplePaginationAdvanced
                    currentPage={page}
                    totalPages={totalPages}
                    pageSize={pageSize}
                    totalItems={totalRecords}
                    onPageChange={setPage}
                    onPageSizeChange={(s) => {
                      setPageSize(s);
                      setPage(0);
                    }}
                    pageSizeOptions={[20, 50, 100]}
                    showPageSizeSelector={true}
                    showGoToPage={totalPages > 5}
                    showPageInfo={true}
                  />
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <AssinaturaItemDialog
        open={!!selectedItem}
        apuracaoId={apuracaoId}
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
      />
    </div>
  );
}
