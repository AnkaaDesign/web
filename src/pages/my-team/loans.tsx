import { useState, useCallback, useMemo } from "react";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { SECTOR_PRIVILEGES, BORROW_STATUS, BORROW_STATUS_LABELS } from "../../constants";
import { useBorrows, useUsers } from "../../hooks";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { BorrowStatusBadge } from "@/components/inventory/borrow/common/borrow-status-badge";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatDateTime } from "../../utils";
import type { BorrowGetManyFormData } from "../../schemas";
import { IconDownload, IconFileTypeCsv, IconFileTypeXls, IconFilter, IconSearch, IconX, IconCalendar, IconPackage, IconUser, IconRefresh } from "@tabler/icons-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { usePageTracker } from "@/hooks/use-page-tracker";
import { useDebounce } from "@/hooks/use-debounce";
import { SimplePaginationAdvanced } from "@/components/ui/pagination-advanced";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";

export const TeamLoansPage = () => {
  // Track page access
  usePageTracker({
    title: "Empréstimos da Equipe",
    icon: "packages",
  });

  const { user: currentUser } = useAuth();
  const [_filters] = useState<Partial<BorrowGetManyFormData>>({});
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Fetch users from the same sector
  const { data: usersResponse } = useUsers({
    where: {
      position: {
        sectorId: currentUser?.sectorId || currentUser?.managedSectorId,
      },
    },
    include: {
      position: {
        include: {
          sector: true,
        },
      },
    },
    orderBy: {
      name: "asc",
    },
  });

  const teamUsers = usersResponse?.data || [];

  // Prepare filters based on selections
  const borrowFilters = useMemo(() => {
    const baseFilters: Partial<BorrowGetManyFormData> = {
      where: {
        user: {
          position: {
            sectorId: currentUser?.sectorId || currentUser?.managedSectorId,
          },
        },
      },
      include: {
        item: true,
        user: {
          include: {
            position: {
              include: {
                sector: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      page: currentPage,
      limit: pageSize,
    };

    if (selectedUserId) {
      baseFilters.where = {
        ...baseFilters.where,
        userId: selectedUserId,
      };
    }

    if (selectedStatus) {
      baseFilters.where = {
        ...baseFilters.where,
        status: selectedStatus as BORROW_STATUS,
      };
    }

    if (debouncedSearchTerm) {
      baseFilters.searchingFor = debouncedSearchTerm;
    }

    return baseFilters;
  }, [currentUser?.sectorId, currentUser?.managedSectorId, selectedUserId, selectedStatus, debouncedSearchTerm, currentPage, pageSize]);

  // Fetch borrows
  const { data: borrowsResponse, isLoading, refetch } = useBorrows(borrowFilters);
  const borrows = borrowsResponse?.data || [];
  const totalRecords = borrowsResponse?.meta?.totalRecords || 0;
  const totalPages = Math.ceil(totalRecords / pageSize);

  // Export functions
  const exportToCSV = useCallback(() => {
    if (!borrows.length) {
      toast.error("Nenhum empréstimo para exportar");
      return;
    }

    const csvContent = [
      ["Colaborador", "E-mail", "Cargo", "Item", "Código", "Quantidade", "Status", "Data Empréstimo", "Data Devolução"],
      ...borrows.map((borrow) => [
        borrow.user?.name || "",
        borrow.user?.email || "",
        borrow.user?.position?.name || "",
        borrow.item?.name || "",
        borrow.item?.uniCode || "",
        borrow.quantity.toString(),
        BORROW_STATUS_LABELS[borrow.status],
        formatDateTime(borrow.createdAt),
        borrow.returnedAt ? formatDateTime(borrow.returnedAt) : "",
      ]),
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `emprestimos_equipe_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    toast.success("Arquivo CSV exportado com sucesso!");
  }, [borrows]);

  const exportToExcel = useCallback(() => {
    if (!borrows.length) {
      toast.error("Nenhum empréstimo para exportar");
      return;
    }

    const excelContent = [
      ["Relatório de Empréstimos da Equipe"],
      [`Data: ${formatDateTime(new Date())}`],
      [`Setor: ${currentUser?.sector?.name || currentUser?.managedSector?.name || "N/A"}`],
      [],
      ["Colaborador", "E-mail", "Cargo", "Item", "Código", "Quantidade", "Status", "Data Empréstimo", "Data Devolução", "Dias Emprestado"],
      ...borrows.map((borrow) => {
        const daysLoaned = borrow.returnedAt
          ? Math.ceil((new Date(borrow.returnedAt).getTime() - new Date(borrow.createdAt).getTime()) / (1000 * 60 * 60 * 24))
          : Math.ceil((new Date().getTime() - new Date(borrow.createdAt).getTime()) / (1000 * 60 * 60 * 24));

        return [
          borrow.user?.name || "",
          borrow.user?.email || "",
          borrow.user?.position?.name || "",
          borrow.item?.name || "",
          borrow.item?.uniCode || "",
          borrow.quantity.toString(),
          BORROW_STATUS_LABELS[borrow.status],
          formatDateTime(borrow.createdAt),
          borrow.returnedAt ? formatDateTime(borrow.returnedAt) : "",
          daysLoaned.toString(),
        ];
      }),
    ]
      .map((row) => row.join("\t"))
      .join("\n");

    const blob = new Blob([excelContent], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `emprestimos_equipe_${new Date().toISOString().split("T")[0]}.xls`;
    link.click();
    toast.success("Arquivo Excel exportado com sucesso!");
  }, [borrows, currentUser?.sector?.name, currentUser?.managedSector?.name]);

  // Clear filters
  const clearFilters = () => {
    setSelectedUserId("");
    setSelectedStatus("");
    setSearchTerm("");
    setCurrentPage(1);
  };

  const hasActiveFilters = selectedUserId || selectedStatus || debouncedSearchTerm;

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.LEADER}>
      <div className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Empréstimos da Equipe</h1>
          <p className="text-muted-foreground mt-1">Gerencie os empréstimos dos colaboradores do seu setor</p>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <IconFilter className="h-5 w-5" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="user-filter">Colaborador</Label>
                <Combobox
                  value={selectedUserId}
                  onValueChange={(value) => setSelectedUserId(value || "")}
                  options={[
                    { value: "", label: "Todos os colaboradores" },
                    ...teamUsers.map((user) => ({
                      value: user.id,
                      label: `${user.name}${user.position ? ` - ${user.position.name}` : ""}`,
                    })),
                  ]}
                  placeholder="Todos os colaboradores"
                  searchable={false}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status-filter">Status</Label>
                <Combobox
                  value={selectedStatus}
                  onValueChange={(value) => setSelectedStatus(value || "")}
                  options={[
                    { value: "", label: "Todos os status" },
                    { value: BORROW_STATUS.ACTIVE, label: BORROW_STATUS_LABELS[BORROW_STATUS.ACTIVE] },
                    { value: BORROW_STATUS.RETURNED, label: BORROW_STATUS_LABELS[BORROW_STATUS.RETURNED] },
                  ]}
                  placeholder="Todos os status"
                  searchable={false}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="search">Buscar item</Label>
                <div className="relative">
                  <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="search" placeholder="Nome ou código do item..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
                </div>
              </div>

              <div className="flex items-end gap-2">
                {hasActiveFilters && (
                  <Button variant="outline" onClick={clearFilters} className="gap-2">
                    <IconX className="h-4 w-4" />
                    Limpar
                  </Button>
                )}
                <Button variant="outline" onClick={() => refetch()} className="gap-2">
                  <IconRefresh className="h-4 w-4" />
                  Atualizar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-between items-center mb-4">
          <div className="text-sm text-muted-foreground">
            {totalRecords} {totalRecords === 1 ? "empréstimo" : "empréstimos"} encontrado{totalRecords !== 1 ? "s" : ""}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <IconDownload className="h-4 w-4" />
                Exportar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Exportar como</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={exportToCSV}>
                <IconFileTypeCsv className="h-4 w-4 mr-2" />
                CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportToExcel}>
                <IconFileTypeXls className="h-4 w-4 mr-2" />
                Excel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Colaborador</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Quantidade</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Emprestado em</TableHead>
                    <TableHead>Devolvido em</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Carregando...
                      </TableCell>
                    </TableRow>
                  ) : borrows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Nenhum empréstimo encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    borrows.map((borrow) => (
                      <TableRow key={borrow.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                              <IconUser className="h-4 w-4" />
                            </div>
                            <div>
                              <div className="font-medium">
                                <TruncatedTextWithTooltip text={borrow.user?.name || "-"} />
                              </div>
                              <div className="text-sm text-muted-foreground">{borrow.user?.position?.name || "-"}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <IconPackage className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <div className="font-medium">
                                <TruncatedTextWithTooltip text={borrow.item?.name || "-"} />
                              </div>
                              {borrow.item?.uniCode && <div className="text-sm text-muted-foreground">Código: {borrow.item.uniCode}</div>}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">{borrow.quantity}</TableCell>
                        <TableCell>
                          <BorrowStatusBadge status={borrow.status} />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <IconCalendar className="h-4 w-4 text-muted-foreground" />
                            {formatDate(borrow.createdAt)}
                          </div>
                        </TableCell>
                        <TableCell>
                          {borrow.returnedAt ? (
                            <div className="flex items-center gap-1">
                              <IconCalendar className="h-4 w-4 text-muted-foreground" />
                              {formatDate(borrow.returnedAt)}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="border-t px-4 py-3">
                <SimplePaginationAdvanced currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} pageSize={pageSize} onPageSizeChange={setPageSize} />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PrivilegeRoute>
  );
};

export default TeamLoansPage;
