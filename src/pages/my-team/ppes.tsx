import { useState, useCallback, useMemo } from "react";
import { routes } from "../../constants";
import { useTeamStaffEpis, useTeamStaffUsers } from "../../hooks";
import { useAuth } from "@/contexts/auth-context";
import { isTeamLeader } from "@/utils/user";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatDateTime } from "../../utils";
import type { PpeDeliveryGetManyFormData } from "../../schemas";
import { IconDownload, IconFileTypeCsv, IconFileTypeXls, IconFilter, IconX, IconCalendar, IconUser, IconRefresh, IconHelmet } from "@tabler/icons-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { SimplePaginationAdvanced } from "@/components/ui/pagination-advanced";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import { Navigate } from "react-router-dom";

export const TeamPpesPage = () => {
  const { user: currentUser } = useAuth();

  usePageTracker({
    title: "EPIs da Equipe",
    icon: "helmet",
  });

  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  if (!currentUser || !isTeamLeader(currentUser as any)) {
    return <Navigate to={routes.home} replace />;
  }

  const { data: usersResponse } = useTeamStaffUsers({
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

  const ppeFilters = useMemo(() => {
    const baseFilters: Partial<PpeDeliveryGetManyFormData> = {
      where: {},
      include: {
        user: {
          include: {
            position: {
              include: {
                sector: true,
              },
            },
          },
        },
        item: true,
      },
      orderBy: {
        actualDeliveryDate: "desc",
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

    return baseFilters;
  }, [selectedUserId, currentPage, pageSize]);

  const { data: episResponse, isLoading, refetch } = useTeamStaffEpis(ppeFilters);
  const epis = episResponse?.data || [];
  const totalRecords = episResponse?.meta?.totalRecords || 0;
  const totalPages = Math.ceil(totalRecords / pageSize);

  const exportToCSV = useCallback(() => {
    if (!epis.length) {
      toast.error("Nenhuma entrega para exportar");
      return;
    }

    const csvContent = [
      ["Colaborador", "E-mail", "Cargo", "EPI", "Quantidade", "Data Entrega", "Validade"],
      ...epis.map((delivery) => [
        delivery.user?.name || "",
        delivery.user?.email || "",
        delivery.user?.position?.name || "",
        delivery.item?.name || "",
        delivery.quantity?.toString() || "1",
        delivery.actualDeliveryDate ? formatDateTime(delivery.actualDeliveryDate) : "",
        "",
      ]),
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `epis_equipe_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    toast.success("Arquivo CSV exportado com sucesso!");
  }, [epis]);

  const exportToExcel = useCallback(() => {
    if (!epis.length) {
      toast.error("Nenhuma entrega para exportar");
      return;
    }

    const excelContent = [
      ["Relatório de EPIs da Equipe"],
      [`Data: ${formatDateTime(new Date())}`],
      [`Setor: ${currentUser?.managedSector?.name || "N/A"}`],
      [],
      ["Colaborador", "E-mail", "Cargo", "EPI", "Quantidade", "Data Entrega", "Validade"],
      ...epis.map((delivery) => [
        delivery.user?.name || "",
        delivery.user?.email || "",
        delivery.user?.position?.name || "",
        delivery.item?.name || "",
        delivery.quantity?.toString() || "1",
        delivery.actualDeliveryDate ? formatDateTime(delivery.actualDeliveryDate) : "",
        "",
      ]),
    ]
      .map((row) => row.join("\t"))
      .join("\n");

    const blob = new Blob([excelContent], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `epis_equipe_${new Date().toISOString().split("T")[0]}.xls`;
    link.click();
    toast.success("Arquivo Excel exportado com sucesso!");
  }, [epis, currentUser?.managedSector?.name]);

  const clearFilters = () => {
    setSelectedUserId("");
    setCurrentPage(1);
  };

  const hasActiveFilters = selectedUserId;

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">EPIs da Equipe</h1>
        <p className="text-muted-foreground mt-1">Acompanhe as entregas de EPIs dos colaboradores do seu setor</p>
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
            <div className="space-y-2">
              <Label htmlFor="user-filter">Colaborador</Label>
              <Combobox
                value={selectedUserId}
                onValueChange={(value) => setSelectedUserId(Array.isArray(value) ? value[0] || "" : value || "")}
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

      <div className="flex justify-between items-center mb-4">
        <div className="text-sm text-muted-foreground">
          {totalRecords} {totalRecords === 1 ? "entrega" : "entregas"} encontrada{totalRecords !== 1 ? "s" : ""}
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
                  <TableHead>EPI</TableHead>
                  <TableHead className="text-right">Quantidade</TableHead>
                  <TableHead>Data Entrega</TableHead>
                  <TableHead>Validade</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : epis.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nenhuma entrega de EPI encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  epis.map((delivery) => (
                    <TableRow key={delivery.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                            <IconUser className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="font-medium">
                              <TruncatedTextWithTooltip text={delivery.user?.name || "-"} />
                            </div>
                            <div className="text-sm text-muted-foreground">{delivery.user?.position?.name || "-"}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <IconHelmet className="h-4 w-4 text-muted-foreground" />
                          <TruncatedTextWithTooltip text={delivery.item?.name || "-"} />
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">{delivery.quantity || 1}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <IconCalendar className="h-4 w-4 text-muted-foreground" />
                          {delivery.actualDeliveryDate ? formatDate(delivery.actualDeliveryDate) : "-"}
                        </div>
                      </TableCell>
                      <TableCell>-</TableCell>
                      <TableCell>-</TableCell>
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

export default TeamPpesPage;
