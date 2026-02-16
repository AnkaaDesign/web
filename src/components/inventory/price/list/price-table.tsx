import React, { useState } from "react";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { canEditItems, canDeleteItems } from "@/utils/permissions/entity-permissions";
import { useAuth } from "@/hooks/common/use-auth";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
// Note: Price hooks should be implemented
// import { usePriceList, usePriceMutations } from "../../../../hooks";
import { IconCurrencyReal, IconLoader, IconEdit, IconTrash, IconPackage } from "@tabler/icons-react";
import { formatDate, formatCurrency } from "../../../../utils";
import type { Price } from "../../../../types";
import type { PriceGetManyFormData } from "../../../../schemas";

interface PriceTableProps {
  itemId?: string;
  filters?: Partial<PriceGetManyFormData>;
  onEditPrice?: (price: Price) => void;
  onDeletePrice?: (price: Price) => void;
  showItemInfo?: boolean;
}

export function PriceTable({ itemId, filters = {}, onEditPrice, onDeletePrice, showItemInfo = true }: PriceTableProps) {
  const [page, setPage] = useState(1);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{
    price: Price;
  } | null>(null);

  // Note: Price mutations should be added to hooks
  const deletePrice = async (_id: string) => {
    throw new Error('Price mutations not implemented');
  };

  // Permission checks
  const { user } = useAuth();
  const canEdit = user ? canEditItems(user) : false;
  const canDelete = user ? canDeleteItems(user) : false;

  const queryFilters: Partial<PriceGetManyFormData> = {
    ...filters,
    page: page + 1, // Convert 0-based to 1-based for API
    limit: 20,
    orderBy: { createdAt: "desc" },
    include: {
      item: showItemInfo,
    },
  };

  if (itemId) {
    queryFilters.where = {
      ...queryFilters.where,
      itemId: { equals: itemId },
    };
  }

  // Note: Price list hook should be added to hooks
  // Original code - to be restored when hooks are implemented:
  // const { data: pricesResponse, isLoading, error } = usePriceList(queryFilters);

  const pricesResponse = null as { data?: any[]; meta?: any } | null;
  const isLoading = true;
  const error = null;

  const prices = pricesResponse?.data || [];
  const meta = pricesResponse?.meta;

  const handleDeletePrice = async (price: Price) => {
    setDeleteDialog({ price });
  };

  const confirmDeletePrice = async () => {
    if (!deleteDialog) return;

    const price = deleteDialog.price;
    setDeletingId(price.id);
    setDeleteDialog(null);

    try {
      await deletePrice(price.id);
      onDeletePrice?.(price);
    } catch (error) {
      // Error handled by API client
    } finally {
      setDeletingId(null);
    }
  };

  const columns: ColumnDef<Price>[] = React.useMemo(() => {
    const baseColumns: ColumnDef<Price>[] = [
      {
        accessorKey: "value",
        header: "Preço",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <IconCurrencyReal className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{formatCurrency(row.original.value)}</span>
          </div>
        ),
      },
      {
        accessorKey: "createdAt",
        header: "Data de Criação",
        cell: ({ row }) => <span className="text-muted-foreground">{formatDate(row.original.createdAt)}</span>,
      },
      {
        id: "actions",
        header: "Ações",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            {canEdit && (
              <Button size="sm" variant="outline" onClick={() => onEditPrice?.(row.original)} disabled={!onEditPrice}>
                <IconEdit className="h-4 w-4" />
              </Button>
            )}
            {canDelete && (
              <Button size="sm" variant="outline" onClick={() => handleDeletePrice(row.original)} disabled={deletingId === row.original.id || !onDeletePrice}>
                {deletingId === row.original.id ? <IconLoader className="h-4 w-4 animate-spin" /> : <IconTrash className="h-4 w-4" />}
              </Button>
            )}
          </div>
        ),
      },
    ];

    // Add item column if showItemInfo is true
    if (showItemInfo) {
      baseColumns.splice(0, 0, {
        accessorKey: "item",
        header: "Item",
        cell: ({ row }) => {
          const item = row.original.item;
          return item ? (
            <div className="flex items-center gap-2">
              <IconPackage className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="font-medium">{item.name}</p>
                {item.uniCode && <p className="text-xs text-muted-foreground">{item.uniCode}</p>}
              </div>
            </div>
          ) : (
            <span className="text-muted-foreground">-</span>
          );
        },
      });
    }

    return baseColumns;
  }, [showItemInfo, onEditPrice, onDeletePrice, deletingId]);

  const table = useReactTable({
    data: prices,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: meta?.totalRecords ? Math.ceil(meta.totalRecords / (meta.limit || 20)) : 0,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconCurrencyReal className="h-5 w-5" />
            Preços
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <IconLoader className="h-6 w-6 animate-spin" />
          <span className="ml-2">Carregando preços...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconCurrencyReal className="h-5 w-5" />
            Preços
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8">
          <p className="text-muted-foreground">Erro ao carregar preços</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IconCurrencyReal className="h-5 w-5" />
          Preços
        </CardTitle>
        {meta && (
          <CardDescription>
            {meta.totalRecords} {meta.totalRecords === 1 ? "preço encontrado" : "preços encontrados"}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        {prices.length === 0 ? (
          <div className="text-center py-8">
            <IconCurrencyReal className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground">Nenhum preço encontrado</p>
          </div>
        ) : (
          <>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <TableHead key={header.id}>{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}</TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {meta && meta.totalRecords > (meta.limit || 20) && (
              <div className="flex items-center justify-between pt-4">
                <p className="text-sm text-muted-foreground">
                  Página {page} de {Math.ceil(meta.totalRecords / (meta.limit || 20))}
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}>
                    Anterior
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setPage(page + 1)} disabled={!meta.hasNextPage}>
                    Próxima
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este preço de {deleteDialog ? formatCurrency(deleteDialog.price.value) : ""}? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeletePrice} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
