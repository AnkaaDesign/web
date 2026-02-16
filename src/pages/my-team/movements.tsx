import { useState, useCallback, useMemo } from "react";
import { routes } from "../../constants";
import { useTeamStaffActivities, useTeamStaffUsers } from "../../hooks";
import { useAuth } from "@/contexts/auth-context";
import { isTeamLeader } from "@/utils/user";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatDateTime } from "../../utils";
import type { ActivityGetManyFormData } from "../../schemas";
import { IconDownload, IconFileTypeCsv, IconFileTypeXls, IconFilter, IconX, IconCalendar, IconUser, IconRefresh, IconPackage } from "@tabler/icons-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { SimplePaginationAdvanced } from "@/components/ui/pagination-advanced";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import { Navigate } from "react-router-dom";
import { ACTIVITY_OPERATION_LABELS } from "@/constants/enum-labels";
import type { ACTIVITY_OPERATION } from "@/constants/enums";

export const TeamMovementsPage = () => {
  const { user: currentUser } = useAuth();

  usePageTracker({
    title: "Movimentações da Equipe",
    icon: "activity",
  });

  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  if (!currentUser || !isTeamLeader(currentUser)) {
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

  const activityFilters = useMemo(() => {
    const baseFilters: Partial<ActivityGetManyFormData> = {
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

    return baseFilters;
  }, [selectedUserId, currentPage, pageSize]);

  const { data: activitiesResponse, isLoading, refetch } = useTeamStaffActivities(activityFilters);
  const activities = activitiesResponse?.data || [];
  const totalRecords = activitiesResponse?.meta?.totalRecords || 0;
  const totalPages = Math.ceil(totalRecords / pageSize);

  const exportToCSV = useCallback(() => {
    if (!activities.length) {
      toast.error("Nenhuma movimentação para exportar");
      return;
    }

    const csvContent = [
      ["Colaborador", "Cargo", "Item", "Código", "Tipo", "Quantidade", "Data"],
      ...activities.map((activity) => [
        activity.user?.name || "",
        activity.user?.position?.name || "",
        activity.item?.name || "",
        activity.item?.uniCode || "",
        activity.operation ? ACTIVITY_OPERATION_LABELS[activity.operation] : "",
        activity.quantity?.toString() || "",
        formatDateTime(activity.createdAt),
      ]),
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `movimentacoes_equipe_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    toast.success("Arquivo CSV exportado com sucesso!");
  }, [activities]);

  const exportToExcel = useCallback(() => {
    if (!activities.length) {
      toast.error("Nenhuma movimentação para exportar");
      return;
    }

    const excelContent = [
      ["Relatório de Movimentações da Equipe"],
      [`Data: ${formatDateTime(new Date())}`],
      [`Setor: ${currentUser?.managedSector?.name || "N/A"}`],
      [],
      ["Colaborador", "Cargo", "Item", "Código", "Tipo", "Quantidade", "Data"],
      ...activities.map((activity) => [
        activity.user?.name || "",
        activity.user?.position?.name || "",
        activity.item?.name || "",
        activity.item?.uniCode || "",
        activity.operation ? ACTIVITY_OPERATION_LABELS[activity.operation] : "",
        activity.quantity?.toString() || "",
        formatDateTime(activity.createdAt),
      ]),
    ]
      .map((row) => row.join("\t"))
      .join("\n");

    const blob = new Blob([excelContent], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `movimentacoes_equipe_${new Date().toISOString().split("T")[0]}.xls`;
    link.click();
    toast.success("Arquivo Excel exportado com sucesso!");
  }, [activities, currentUser?.managedSector?.name]);

  const clearFilters = () => {
    setSelectedUserId("");
    setCurrentPage(1);
  };

  const hasActiveFilters = selectedUserId;

  const getOperationBadge = (operation: ACTIVITY_OPERATION) => {
    const config: Record<ACTIVITY_OPERATION, { variant: "default" | "secondary" | "destructive" | "outline" }> = {
      INBOUND: { variant: "default" },
      OUTBOUND: { variant: "secondary" },
    };
    const badgeConfig = config[operation] || { variant: "outline" as const };
    return <Badge variant={badgeConfig.variant}>{ACTIVITY_OPERATION_LABELS[operation]}</Badge>;
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Movimentações da Equipe</h1>
        <p className="text-muted-foreground mt-1">Acompanhe as movimentações de estoque dos colaboradores do seu setor</p>
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
                onValueChange={(value) => setSelectedUserId((Array.isArray(value) ? value[0] : value) || "")}
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
          {totalRecords} {totalRecords === 1 ? "movimentação" : "movimentações"} encontrada{totalRecords !== 1 ? "s" : ""}
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
                  <TableHead>Item</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Quantidade</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : activities.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Nenhuma movimentação encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  activities.map((activity) => (
                    <TableRow key={activity.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                            <IconUser className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="font-medium">
                              <TruncatedTextWithTooltip text={activity.user?.name || "-"} />
                            </div>
                            <div className="text-sm text-muted-foreground">{activity.user?.position?.name || "-"}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <IconPackage className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">
                              <TruncatedTextWithTooltip text={activity.item?.name || "-"} />
                            </div>
                            {activity.item?.uniCode && <div className="text-sm text-muted-foreground">Código: {activity.item.uniCode}</div>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{activity.operation ? getOperationBadge(activity.operation) : "-"}</TableCell>
                      <TableCell className="text-right font-medium">{activity.quantity || "-"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <IconCalendar className="h-4 w-4 text-muted-foreground" />
                          {formatDate(activity.createdAt)}
                        </div>
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

export default TeamMovementsPage;
