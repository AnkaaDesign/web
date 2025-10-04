import { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { IconPlus, IconSearch, IconFilter, IconEye, IconEdit, IconTrash } from "@tabler/icons-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import type { Driver } from "../../../../types";
import { DRIVER_STATUS_LABELS, CNH_CATEGORY_LABELS } from "../../../../constants";
import { useDrivers, useDriverMutations } from "../../../../hooks";
import { isCNHExpired, isCNHExpiringSoon } from "../../../../utils";
import { useTableFilters } from "@/hooks/use-table-filters";
import { extractActiveFilters, createFilterRemover } from "./filter-utils";
import { FilterIndicators } from "./filter-indicator";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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
import { toast } from "sonner";
import { LoadingSpinner } from "@/components/ui/loading";

interface DriverListProps {
  onCreateDriver?: () => void;
  onEditDriver?: (driver: Driver) => void;
  onViewDriver?: (driver: Driver) => void;
}

export function DriverList({ onCreateDriver, onEditDriver, onViewDriver }: DriverListProps) {
  const navigate = useNavigate();
  const { deleteAsync } = useDriverMutations();

  // Delete confirmation dialog state
  const [deleteDialog, setDeleteDialog] = useState<{
    items: Driver[];
    isBulk: boolean;
  } | null>(null);

  // Use table filters hook for unified filter management
  const { filters, setFilters, searchingFor, displaySearchText, setSearch, clearAllFilters, hasActiveFilters, queryFilters } = useTableFilters({
    defaultFilters: {},
    searchDebounceMs: 300,
  });

  const {
    data: driversData,
    isLoading,
    refetch,
  } = useDrivers({
    ...queryFilters,
    orderBy: { name: "asc" },
    include: {
      user: true,
    },
  });

  const drivers = driversData?.data || [];

  // Extract active filters for display
  const activeFilters = useMemo(() => {
    return extractActiveFilters(filters, createFilterRemover(filters, setFilters), {});
  }, [filters, setFilters]);

  const handleDeleteDriver = (driver: Driver) => {
    setDeleteDialog({
      items: [driver],
      isBulk: false,
    });
  };

  const confirmDelete = async () => {
    if (!deleteDialog) return;

    try {
      const driver = deleteDialog.items[0];
      await deleteAsync(driver.id);
      toast.success("Motorista excluído com sucesso!");
      refetch();
    } catch (error) {
      console.error("Error deleting driver:", error);
      toast.error("Erro ao excluir motorista.");
    } finally {
      setDeleteDialog(null);
    }
  };

  const getStatusBadge = (driver: Driver) => {
    if (driver.status === "ACTIVE") {
      const isExpired = isCNHExpired(new Date(driver.cnhExpiryDate));
      const isExpiringSoon = !isExpired && isCNHExpiringSoon(new Date(driver.cnhExpiryDate));

      if (isExpired) {
        return <Badge variant="destructive">CNH Vencida</Badge>;
      }
      if (isExpiringSoon) {
        return (
          <Badge variant="outline" className="border-yellow-500 text-yellow-700">
            Vence em Breve
          </Badge>
        );
      }
      return (
        <Badge variant="default" className="bg-green-500">
          Ativo
        </Badge>
      );
    }

    if (driver.status === "SUSPENDED") {
      return <Badge variant="destructive">Suspenso</Badge>;
    }

    if (driver.status === "LICENSE_EXPIRED") {
      return <Badge variant="destructive">CNH Vencida</Badge>;
    }

    return <Badge variant="secondary">Inativo</Badge>;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <LoadingSpinner />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Motoristas</CardTitle>
              <CardDescription>Gerencie os motoristas da frota</CardDescription>
            </div>
            <Button onClick={onCreateDriver}>
              <IconPlus className="mr-2 h-4 w-4" />
              Novo Motorista
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar por nome, CPF ou CNH..." value={displaySearchText} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Button variant="outline">
              <IconFilter className="mr-2 h-4 w-4" />
              Filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Filter Indicators */}
      {activeFilters.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <FilterIndicators filters={activeFilters} onClearAll={clearAllFilters} />
          </CardContent>
        </Card>
      )}

      {/* Drivers Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            {drivers.length} motorista{drivers.length !== 1 ? "s" : ""}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {drivers.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">{hasActiveFilters ? "Nenhum motorista encontrado com os critérios de busca." : "Nenhum motorista cadastrado ainda."}</p>
              {!hasActiveFilters && (
                <Button className="mt-4" onClick={onCreateDriver}>
                  <IconPlus className="mr-2 h-4 w-4" />
                  Cadastrar Primeiro Motorista
                </Button>
              )}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>CPF</TableHead>
                    <TableHead>CNH</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[70px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drivers.map((driver) => (
                    <TableRow key={driver.id}>
                      <TableCell className="font-medium">{driver.name}</TableCell>
                      <TableCell>{driver.cpf}</TableCell>
                      <TableCell className="font-mono text-sm">{driver.cnhNumber}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{CNH_CATEGORY_LABELS[driver.cnhCategory] || driver.cnhCategory}</Badge>
                      </TableCell>
                      <TableCell>{format(new Date(driver.cnhExpiryDate), "dd/MM/yyyy", { locale: ptBR })}</TableCell>
                      <TableCell>{getStatusBadge(driver)}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Abrir menu</span>
                              <IconFilter className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onViewDriver?.(driver)}>
                              <IconEye className="mr-2 h-4 w-4" />
                              Visualizar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onEditDriver?.(driver)}>
                              <IconEdit className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-red-600" onClick={() => handleDeleteDriver(driver)}>
                              <IconTrash className="mr-2 h-4 w-4" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o motorista "{deleteDialog?.items[0]?.name}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
