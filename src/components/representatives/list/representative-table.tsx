import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { representativeService } from "@/services/representativeService";
import type { Representative } from "@/types/representative";
import type { RepresentativeGetManyFormData } from "@/types/representative";
import {
  REPRESENTATIVE_ROLE_LABELS,
  REPRESENTATIVE_ROLE_COLORS,
} from "@/types/representative";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  IconEdit,
  IconTrash,
  IconDots,
  IconPhone,
  IconMail,
  IconLock,
  IconLockOpen,
  IconUser,
  IconChevronUp,
  IconChevronDown,
  IconSelector,
} from "@tabler/icons-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RepresentativeTableSkeleton } from "./representative-table-skeleton";
import { SimplePaginationAdvanced } from "@/components/ui/pagination-advanced";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { useTableState, convertSortConfigsToOrderBy } from "@/hooks/use-table-state";

interface RepresentativeTableProps {
  filters: Partial<RepresentativeGetManyFormData>;
  onEdit?: (representative: Representative) => void;
  onDelete?: (representative: Representative) => void;
  onToggleActive?: (representative: Representative) => void;
  onUpdatePassword?: (representative: Representative) => void;
  onDataChange?: (data: { representatives: Representative[]; totalRecords: number }) => void;
  className?: string;
  searchTerm?: string;
}

export function RepresentativeTable({
  filters,
  onEdit,
  onDelete,
  onToggleActive,
  onUpdatePassword,
  onDataChange,
  className,
  searchTerm,
}: RepresentativeTableProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Use URL state management for pagination and selection
  const {
    page,
    pageSize,
    selectedIds,
    sortConfigs,
    showSelectedOnly,
    setPage,
    setPageSize,
    toggleSelection,
    toggleSelectAll,
    toggleSort,
    getSortDirection,
    getSortOrder,
    isSelected,
    isAllSelected,
    isPartiallySelected,
    selectionCount,
    removeFromSelection,
    handleRowClick: handleRowClickSelection,
  } = useTableState({
    defaultPageSize: 40,
    resetSelectionOnPageChange: false,
  });

  // Memoize query parameters
  const queryParams = useMemo(() => {
    const params = {
      ...filters,
      page: page + 1, // Convert 0-based to 1-based for API
      pageSize,
      search: searchTerm || undefined,
      ...(sortConfigs.length > 0 && {
        orderBy: convertSortConfigsToOrderBy(sortConfigs),
      }),
      ...(showSelectedOnly && selectedIds.length > 0 && {
        ids: selectedIds,
      }),
    };
    return params;
  }, [filters, page, pageSize, searchTerm, sortConfigs, showSelectedOnly, selectedIds]);

  // Fetch representatives data
  const { data, isLoading, error } = useQuery({
    queryKey: ["representatives", queryParams],
    queryFn: async () => {
      const response = await representativeService.getAll(queryParams);

      // Notify parent of data change
      if (onDataChange) {
        onDataChange({
          representatives: response.data,
          totalRecords: response.meta.total,
        });
      }

      return response;
    },
    keepPreviousData: true,
  });

  // Toggle active mutation
  const toggleActiveMutation = useMutation({
    mutationFn: (id: string) => representativeService.toggleActive(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["representatives"] });
      toast({
        title: "Sucesso",
        description: `Representante ${data.isActive ? "ativado" : "desativado"} com sucesso`,
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao alterar status do representante",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (representative: Representative) => {
    if (onEdit) {
      onEdit(representative);
    } else {
      navigate(`/representatives/${representative.id}/edit`);
    }
  };

  const handleToggleActive = (representative: Representative) => {
    if (onToggleActive) {
      onToggleActive(representative);
    } else {
      toggleActiveMutation.mutate(representative.id);
    }
  };

  const handleUpdatePassword = (representative: Representative) => {
    if (onUpdatePassword) {
      onUpdatePassword(representative);
    } else {
      navigate(`/representatives/${representative.id}/password`);
    }
  };

  const handleRowClick = (e: React.MouseEvent, representative: Representative) => {
    // Check if the click was on an interactive element
    const target = e.target as HTMLElement;
    const isInteractive = target.closest('button, a, input, [role="button"]');

    if (!isInteractive) {
      handleRowClickSelection(e, representative.id);
    }
  };

  if (isLoading && !data) {
    return <RepresentativeTableSkeleton />;
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Erro ao carregar representantes. Por favor, tente novamente.
        </p>
      </div>
    );
  }

  const representatives = data?.data || [];
  const totalRecords = data?.meta.total || 0;
  const totalPages = Math.ceil(totalRecords / pageSize);

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={isAllSelected()}
                  indeterminate={isPartiallySelected()}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Selecionar todos"
                />
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-3 h-8 data-[state=open]:bg-accent"
                  onClick={() => toggleSort("name")}
                >
                  Nome
                  {getSortDirection("name") === "desc" ? (
                    <IconChevronDown className="ml-2 h-4 w-4" />
                  ) : getSortDirection("name") === "asc" ? (
                    <IconChevronUp className="ml-2 h-4 w-4" />
                  ) : (
                    <IconSelector className="ml-2 h-4 w-4" />
                  )}
                  {getSortOrder("name") > 0 && (
                    <span className="ml-1 text-xs">{getSortOrder("name")}</span>
                  )}
                </Button>
              </TableHead>
              <TableHead>Função</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Contato</TableHead>
              <TableHead>Acesso</TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-3 h-8 data-[state=open]:bg-accent"
                  onClick={() => toggleSort("isActive")}
                >
                  Status
                  {getSortDirection("isActive") === "desc" ? (
                    <IconChevronDown className="ml-2 h-4 w-4" />
                  ) : getSortDirection("isActive") === "asc" ? (
                    <IconChevronUp className="ml-2 h-4 w-4" />
                  ) : (
                    <IconSelector className="ml-2 h-4 w-4" />
                  )}
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-3 h-8 data-[state=open]:bg-accent"
                  onClick={() => toggleSort("createdAt")}
                >
                  Criado em
                  {getSortDirection("createdAt") === "desc" ? (
                    <IconChevronDown className="ml-2 h-4 w-4" />
                  ) : getSortDirection("createdAt") === "asc" ? (
                    <IconChevronUp className="ml-2 h-4 w-4" />
                  ) : (
                    <IconSelector className="ml-2 h-4 w-4" />
                  )}
                </Button>
              </TableHead>
              <TableHead className="w-12">
                <span className="sr-only">Ações</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {representatives.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center">
                  <div className="py-8 text-sm text-muted-foreground">
                    Nenhum representante encontrado
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              representatives.map((representative) => {
                const hasSystemAccess = !!representative.email && !!representative.password;
                const selected = isSelected(representative.id);

                return (
                  <TableRow
                    key={representative.id}
                    data-state={selected ? "selected" : undefined}
                    onClick={(e) => handleRowClick(e, representative)}
                    className={cn(
                      "cursor-pointer",
                      selected && "bg-muted/50"
                    )}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selected}
                        onCheckedChange={() => toggleSelection(representative.id)}
                        aria-label="Selecionar linha"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                          <IconUser className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-medium text-sm">{representative.name}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={REPRESENTATIVE_ROLE_COLORS[representative.role] as any}
                        className="text-xs"
                      >
                        {REPRESENTATIVE_ROLE_LABELS[representative.role]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {representative.customer?.name || "-"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5">
                          <IconPhone className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-xs">{representative.phone}</span>
                        </div>
                        {representative.email && (
                          <div className="flex items-center gap-1.5">
                            <IconMail className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-xs">{representative.email}</span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {hasSystemAccess ? (
                        <div className="flex items-center gap-1.5">
                          <IconLockOpen className="h-4 w-4 text-green-600" />
                          <span className="text-xs text-green-600">Com acesso</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <IconLock className="h-4 w-4 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">Sem acesso</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={representative.isActive ? "success" : "secondary"}
                        className="text-xs"
                      >
                        {representative.isActive ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {representative.createdAt ? (
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(representative.createdAt), "dd/MM/yyyy", { locale: ptBR })}
                        </span>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <IconDots className="h-4 w-4" />
                            <span className="sr-only">Abrir menu</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(representative)}>
                            <IconEdit className="mr-2 h-4 w-4" />
                            Editar
                          </DropdownMenuItem>
                          {representative.email && (
                            <DropdownMenuItem onClick={() => handleUpdatePassword(representative)}>
                              <IconLock className="mr-2 h-4 w-4" />
                              Alterar Senha
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleToggleActive(representative)}>
                            {representative.isActive ? (
                              <>
                                <IconLock className="mr-2 h-4 w-4" />
                                Desativar
                              </>
                            ) : (
                              <>
                                <IconLockOpen className="mr-2 h-4 w-4" />
                                Ativar
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => onDelete?.(representative)}
                            className="text-destructive focus:text-destructive"
                          >
                            <IconTrash className="mr-2 h-4 w-4" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalRecords > 0 && (
        <SimplePaginationAdvanced
          currentPage={page}
          totalPages={totalPages}
          pageSize={pageSize}
          totalRecords={totalRecords}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          pageSizeOptions={[10, 20, 40, 60, 100]}
        />
      )}
    </div>
  );
}