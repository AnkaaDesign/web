import React, { useState, useEffect, useCallback } from 'react';
import {
  IconEdit,
  IconTrash,
  IconSearch,
  IconPlus,
  IconDots,
  IconPhone,
  IconMail,
  IconLock,
  IconLockOpen,
} from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { representativeService } from '@/services/representativeService';
import type { Representative } from '@/types/representative';
import {
  RepresentativeRole,
  REPRESENTATIVE_ROLE_LABELS,
  REPRESENTATIVE_ROLE_COLORS,
} from '@/types/representative';
import { LoadingOverlay } from '@/components/ui/loading';
import { useToast } from '@/hooks/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Card } from '@/components/ui/card';

interface RepresentativeListProps {
  customerId?: string;
  onEdit?: (representative: Representative) => void;
  onSelect?: (representatives: Representative[]) => void;
  selectable?: boolean;
}

export const RepresentativeList: React.FC<RepresentativeListProps> = ({
  customerId,
  onEdit,
  onSelect,
  selectable = false,
}) => {
  const { error, success } = useToast();
  const navigate = useNavigate();

  // State
  const [representatives, setRepresentatives] = useState<Representative[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RepresentativeRole | 'all'>('all');
  const [activeFilter, setActiveFilter] = useState<boolean | 'all'>('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [representativeToDelete, setRepresentativeToDelete] = useState<Representative | null>(null);
  const [selectedRepresentative, setSelectedRepresentative] = useState<Representative | null>(null);

  // Load representatives
  const loadRepresentatives = useCallback(async () => {
    setLoading(true);
    try {
      const response = await representativeService.getAll({
        page: page + 1,
        pageSize: rowsPerPage,
        search: search || undefined,
        customerId,
        role: roleFilter === 'all' ? undefined : roleFilter,
        isActive: activeFilter === 'all' ? undefined : activeFilter as boolean,
      });

      setRepresentatives(response.data);
      setTotalCount(response.meta.total);
    } catch (err: any) {
      error(err.message || 'Erro ao carregar representantes');
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, search, customerId, roleFilter, activeFilter, error]);

  useEffect(() => {
    loadRepresentatives();
  }, [loadRepresentatives]);

  // Handlers
  const handleSearchChange = (value: string | number | null) => {
    setSearch(String(value || ''));
    setPage(0);
  };

  const handleRoleFilterChange = (value: string) => {
    setRoleFilter(value as RepresentativeRole | 'all');
    setPage(0);
  };

  const handleActiveFilterChange = (value: string) => {
    setActiveFilter(value === 'all' ? 'all' : value === 'true');
    setPage(0);
  };

  const handleChangePage = (newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (value: string) => {
    setRowsPerPage(parseInt(value, 10));
    setPage(0);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const newSelected = representatives.map((r) => r.id);
      setSelected(newSelected);
      onSelect?.(representatives);
    } else {
      setSelected([]);
      onSelect?.([]);
    }
  };

  const handleSelectOne = (id: string) => {
    const selectedIndex = selected.indexOf(id);
    let newSelected: string[] = [];

    if (selectedIndex === -1) {
      newSelected = newSelected.concat(selected, id);
    } else if (selectedIndex === 0) {
      newSelected = newSelected.concat(selected.slice(1));
    } else if (selectedIndex === selected.length - 1) {
      newSelected = newSelected.concat(selected.slice(0, -1));
    } else if (selectedIndex > 0) {
      newSelected = newSelected.concat(
        selected.slice(0, selectedIndex),
        selected.slice(selectedIndex + 1)
      );
    }

    setSelected(newSelected);
    const selectedReps = representatives.filter((r) => newSelected.includes(r.id));
    onSelect?.(selectedReps);
  };

  const handleEdit = (representative: Representative) => {
    if (onEdit) {
      onEdit(representative);
    } else {
      navigate(`/representatives/${representative.id}/edit`);
    }
  };

  const handleDelete = (representative: Representative) => {
    setRepresentativeToDelete(representative);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!representativeToDelete) return;

    try {
      await representativeService.delete(representativeToDelete.id);
      success('Representante excluído com sucesso');
      loadRepresentatives();
    } catch (err: any) {
      error(err.message || 'Erro ao excluir representante');
    } finally {
      setDeleteDialogOpen(false);
      setRepresentativeToDelete(null);
    }
  };

  const handleToggleActive = async (representative: Representative) => {
    try {
      await representativeService.toggleActive(representative.id);
      success(
        `Representante ${representative.isActive ? 'desativado' : 'ativado'} com sucesso`
      );
      loadRepresentatives();
    } catch (err: any) {
      error(err.message || 'Erro ao alterar status');
    }
  };

  const handleUpdatePassword = (representative: Representative) => {
    navigate(`/representatives/${representative.id}/password`);
  };

  const isSelected = (id: string) => selected.indexOf(id) !== -1;

  // Calculate pagination
  const totalPages = Math.ceil(totalCount / rowsPerPage);
  const from = page * rowsPerPage + 1;
  const to = Math.min((page + 1) * rowsPerPage, totalCount);

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Filters and Actions */}
        <div className="flex gap-2 items-center flex-wrap">
          <div className="relative flex-grow min-w-[250px]">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou telefone..."
              value={search}
              onChange={handleSearchChange}
              className="pl-9"
            />
          </div>

          <Select value={roleFilter} onValueChange={handleRoleFilterChange}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Função" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {Object.entries(RepresentativeRole).map(([key, value]) => (
                <SelectItem key={key} value={value}>
                  {REPRESENTATIVE_ROLE_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={String(activeFilter)} onValueChange={handleActiveFilterChange}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="true">Ativos</SelectItem>
              <SelectItem value="false">Inativos</SelectItem>
            </SelectContent>
          </Select>

          <Button onClick={() => navigate('/representatives/new')}>
            <IconPlus className="mr-2 h-4 w-4" />
            Novo Representante
          </Button>
        </div>

        {/* Table */}
        <Card className="relative">
          {loading && <LoadingOverlay />}

          <Table>
            <TableHeader>
              <TableRow>
                {selectable && (
                  <TableHead className="w-12">
                    <Checkbox
                      checked={representatives.length > 0 && selected.length === representatives.length}
                      indeterminate={selected.length > 0 && selected.length < representatives.length}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                )}
                <TableHead>Nome</TableHead>
                <TableHead>Função</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Acesso</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-center">Tarefas</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {representatives.map((representative) => {
                const isItemSelected = isSelected(representative.id);
                const hasSystemAccess = !!representative.email && !!representative.password;

                return (
                  <TableRow
                    key={representative.id}
                    data-state={isItemSelected ? 'selected' : undefined}
                    onClick={() => selectable && handleSelectOne(representative.id)}
                    className={selectable ? 'cursor-pointer' : ''}
                  >
                    {selectable && (
                      <TableCell>
                        <Checkbox checked={isItemSelected} />
                      </TableCell>
                    )}

                    <TableCell>
                      <div className="font-medium text-sm">
                        {representative.name}
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
                      <div className="text-sm">
                        {representative.customer?.name || '-'}
                      </div>
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
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="inline-flex">
                            {hasSystemAccess ? (
                              <IconLockOpen className="h-5 w-5 text-green-600" />
                            ) : (
                              <IconLock className="h-5 w-5 text-muted-foreground" />
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          {hasSystemAccess ? 'Com acesso ao sistema' : 'Apenas contato'}
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>

                    <TableCell className="text-center">
                      <Badge
                        variant={representative.isActive ? 'active' : 'inactive'}
                        className="text-xs"
                      >
                        {representative.isActive ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-center">
                      <div className="text-sm">
                        {representative.tasks?.length || 0}
                      </div>
                    </TableCell>

                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedRepresentative(representative);
                            }}
                          >
                            <IconDots className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(representative)}>
                            <IconEdit className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          {representative.email && (
                            <DropdownMenuItem onClick={() => handleUpdatePassword(representative)}>
                              <IconLock className="h-4 w-4 mr-2" />
                              Alterar Senha
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => handleToggleActive(representative)}>
                            {representative.isActive ? (
                              <>
                                <IconLock className="h-4 w-4 mr-2" />
                                Desativar
                              </>
                            ) : (
                              <>
                                <IconLockOpen className="h-4 w-4 mr-2" />
                                Ativar
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(representative)}
                            className="text-destructive focus:text-destructive"
                          >
                            <IconTrash className="h-4 w-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}

              {representatives.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={selectable ? 9 : 8} className="text-center">
                    <div className="text-sm text-muted-foreground py-8">
                      Nenhum representante encontrado
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-4 border-t">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Itens por página:</span>
              <Select value={String(rowsPerPage)} onValueChange={handleChangeRowsPerPage}>
                <SelectTrigger className="w-[70px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5</SelectItem>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {totalCount > 0 ? `${from}-${to} de ${totalCount}` : '0-0 de 0'}
              </span>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleChangePage(page - 1)}
                  disabled={page === 0}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleChangePage(page + 1)}
                  disabled={page >= totalPages - 1}
                >
                  Próxima
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir o representante "{representativeToDelete?.name}"?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                onClick={() => {
                  setDeleteDialogOpen(false);
                  setRepresentativeToDelete(null);
                }}
              >
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete}>
                Confirmar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
};
