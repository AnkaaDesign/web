import { useState, useMemo } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/common/use-auth";
import { routes } from "../../constants";
import { IconLoader2 } from "@tabler/icons-react";
import { useTeamStaffWarnings, useTeamStaffUsers } from "../../hooks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "../../utils";
import { IconFilter, IconRefresh, IconUser, IconCalendar, IconX, IconAlertTriangle } from "@tabler/icons-react";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { SimplePaginationAdvanced } from "@/components/ui/pagination-advanced";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import type { WarningGetManyFormData } from "../../schemas";

export default function MyTeamWarningsPage() {
  // Track page access
  usePageTracker({
    title: "Advertências da Equipe",
    icon: "alert-triangle",
  });

  const { user, isLoading } = useAuth();

  // Show loading spinner while auth is being determined
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <IconLoader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Redirect if not authenticated
  if (!user) {
    return <Navigate to={routes.authentication.login} replace />;
  }

  // Only team leaders (users with managedSector) can access this page
  if (!user.managedSector) {
    return <Navigate to={routes.home} replace />;
  }

  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Fetch users from the team leader's managed sector using secure endpoint
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

  // Prepare filters based on selections
  // Note: No need to filter by sector - the secure team-staff endpoint handles this automatically
  const warningFilters = useMemo(() => {
    const baseFilters: Partial<WarningGetManyFormData> = {
      where: {},
      include: {
        collaborator: {
          include: {
            position: {
              include: {
                sector: true,
              },
            },
          },
        },
        supervisor: {
          include: {
            position: true,
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
        collaboratorId: selectedUserId,
      };
    }

    return baseFilters;
  }, [selectedUserId, currentPage, pageSize]);

  // Fetch warnings using secure team-staff endpoint (automatically filtered by managed sector)
  const { data: warningsResponse, isLoading: isLoadingWarnings, refetch } = useTeamStaffWarnings(warningFilters);
  const warnings = warningsResponse?.data || [];
  const totalRecords = warningsResponse?.meta?.totalRecords || 0;
  const totalPages = Math.ceil(totalRecords / pageSize);

  // Clear filters
  const clearFilters = () => {
    setSelectedUserId("");
    setCurrentPage(1);
  };

  const hasActiveFilters = selectedUserId;

  // Get severity badge color
  const getSeverityColor = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case "leve":
        return "bg-yellow-100 text-yellow-800";
      case "moderada":
        return "bg-orange-100 text-orange-800";
      case "grave":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Advertências da Equipe</h1>
          <p className="text-muted-foreground mt-1">Visualize as advertências dos colaboradores do seu setor</p>
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

        {/* Stats */}
        <div className="flex justify-between items-center mb-4">
          <div className="text-sm text-muted-foreground">
            {totalRecords} {totalRecords === 1 ? "advertência" : "advertências"} encontrada{totalRecords !== 1 ? "s" : ""}
          </div>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Colaborador</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Supervisor</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingWarnings ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        Carregando...
                      </TableCell>
                    </TableRow>
                  ) : warnings.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        Nenhuma advertência encontrada
                      </TableCell>
                    </TableRow>
                  ) : (
                    warnings.map((warning) => (
                      <TableRow key={warning.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                              <IconUser className="h-4 w-4" />
                            </div>
                            <div>
                              <div className="font-medium">{warning.collaborator?.name || "-"}</div>
                              <div className="text-sm text-muted-foreground">{warning.collaborator?.position?.name || "-"}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getSeverityColor(warning.type || "")}>
                            <IconAlertTriangle className="h-3 w-3 mr-1" />
                            {warning.type || "-"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <TruncatedTextWithTooltip text={warning.reason || "-"} maxLength={50} />
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div className="font-medium">{warning.supervisor?.name || "-"}</div>
                            <div className="text-muted-foreground">{warning.supervisor?.position?.name || "-"}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <IconCalendar className="h-4 w-4 text-muted-foreground" />
                            {warning.createdAt ? formatDate(warning.createdAt) : "-"}
                          </div>
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
  );
}
