import { useState, useCallback, useMemo } from "react";
import { routes } from "../../constants";
import { useTeamStaffUsers } from "../../hooks";
import { useAuth } from "@/contexts/auth-context";
import { isTeamLeader } from "@/utils/user";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "../../utils";
import type { UserGetManyFormData } from "../../schemas";
import { IconDownload, IconFileTypeCsv, IconFileTypeXls, IconFilter, IconSearch, IconX, IconUser, IconRefresh, IconMail, IconBriefcase } from "@tabler/icons-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { useDebounce } from "@/hooks/common/use-debounce";
import { SimplePaginationAdvanced } from "@/components/ui/pagination-advanced";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import { Navigate } from "react-router-dom";

export const TeamMembersPage = () => {
  const { user: currentUser } = useAuth();

  usePageTracker({
    title: "Membros da Equipe",
    icon: "users",
  });

  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  if (!currentUser || !isTeamLeader(currentUser)) {
    return <Navigate to={routes.home} replace />;
  }

  const userFilters = useMemo(() => {
    const baseFilters: Partial<UserGetManyFormData> = {
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
      page: currentPage,
      limit: pageSize,
    };

    if (debouncedSearchTerm) {
      baseFilters.searchingFor = debouncedSearchTerm;
    }

    return baseFilters;
  }, [debouncedSearchTerm, currentPage, pageSize]);

  const { data: usersResponse, isLoading, refetch } = useTeamStaffUsers(userFilters);
  const users = usersResponse?.data || [];
  const totalRecords = usersResponse?.meta?.totalRecords || 0;
  const totalPages = Math.ceil(totalRecords / pageSize);

  const exportToCSV = useCallback(() => {
    if (!users.length) {
      toast.error("Nenhum membro para exportar");
      return;
    }

    const csvContent = [
      ["Nome", "E-mail", "Cargo", "Setor", "Admissão", "Status"],
      ...users.map((user) => [
        user.name || "",
        user.email || "",
        user.position?.name || "",
        user.position?.sector?.name || "",
        user.hireDate ? formatDate(user.hireDate) : "",
        user.active ? "Ativo" : "Inativo",
      ]),
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `membros_equipe_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    toast.success("Arquivo CSV exportado com sucesso!");
  }, [users]);

  const exportToExcel = useCallback(() => {
    if (!users.length) {
      toast.error("Nenhum membro para exportar");
      return;
    }

    const excelContent = [
      ["Relatório de Membros da Equipe"],
      [`Data: ${formatDate(new Date())}`],
      [`Setor: ${currentUser?.managedSector?.name || "N/A"}`],
      [],
      ["Nome", "E-mail", "Cargo", "Setor", "Admissão", "Status"],
      ...users.map((user) => [
        user.name || "",
        user.email || "",
        user.position?.name || "",
        user.position?.sector?.name || "",
        user.hireDate ? formatDate(user.hireDate) : "",
        user.active ? "Ativo" : "Inativo",
      ]),
    ]
      .map((row) => row.join("\t"))
      .join("\n");

    const blob = new Blob([excelContent], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `membros_equipe_${new Date().toISOString().split("T")[0]}.xls`;
    link.click();
    toast.success("Arquivo Excel exportado com sucesso!");
  }, [users, currentUser?.managedSector?.name]);

  const clearFilters = () => {
    setSearchTerm("");
    setCurrentPage(1);
  };

  const hasActiveFilters = debouncedSearchTerm;

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Membros da Equipe</h1>
        <p className="text-muted-foreground mt-1">Visualize os colaboradores do seu setor</p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <IconFilter className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="search">Buscar colaborador</Label>
              <div className="relative">
                <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="search" placeholder="Nome ou e-mail..." value={searchTerm} onChange={(value) => setSearchTerm(value as string)} className="pl-9" />
              </div>
            </div>

            <div className="flex items-end gap-2 md:col-span-2">
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

      <div className="flex justify-between items-center mb-4">
        <div className="text-sm text-muted-foreground">
          {totalRecords} {totalRecords === 1 ? "membro" : "membros"} encontrado{totalRecords !== 1 ? "s" : ""}
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

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Admissão</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Nenhum membro encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                            <IconUser className="h-4 w-4" />
                          </div>
                          <div className="font-medium">
                            <TruncatedTextWithTooltip text={user.name || "-"} />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <IconMail className="h-4 w-4 text-muted-foreground" />
                          <TruncatedTextWithTooltip text={user.email || "-"} maxLength={25} />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <IconBriefcase className="h-4 w-4 text-muted-foreground" />
                          {user.position?.name || "-"}
                        </div>
                      </TableCell>
                      <TableCell>{user.hireDate ? formatDate(user.hireDate) : "-"}</TableCell>
                      <TableCell>
                        <Badge variant={user.active ? "default" : "secondary"}>{user.active ? "Ativo" : "Inativo"}</Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="border-t px-4 py-3">
              <SimplePaginationAdvanced currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} pageSize={pageSize} onPageSizeChange={setPageSize} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TeamMembersPage;
