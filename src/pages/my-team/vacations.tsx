import { useState, useMemo } from "react";
import { useTeamStaffVacations, useTeamStaffUsers } from "../../hooks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "../../utils";
import { isTeamLeader } from "@/utils/user";
import { useAuth } from "@/contexts/auth-context";
import { IconFilter, IconRefresh, IconUser, IconCalendar, IconX } from "@tabler/icons-react";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { SimplePaginationAdvanced } from "@/components/ui/pagination-advanced";
import type { VacationGetManyFormData } from "../../schemas";
import { Navigate } from "react-router-dom";
import { routes } from "../../constants";

export default function MyTeamVacationsPage() {
  const { user } = useAuth();

  // Track page access
  usePageTracker({
    title: "Férias da Equipe",
    icon: "calendar",
  });

  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Check if user is a team leader (based on managedSector relationship)
  if (!user || !isTeamLeader(user)) {
    return <Navigate to={routes.home} replace />;
  }

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
  const vacationFilters = useMemo(() => {
    const baseFilters: Partial<VacationGetManyFormData> = {
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
      },
      orderBy: {
        startAt: "desc",
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

  // Fetch vacations using secure team-staff endpoint (automatically filtered by managed sector)
  const { data: vacationsResponse, isLoading, refetch } = useTeamStaffVacations(vacationFilters);
  const vacations = vacationsResponse?.data || [];
  const totalRecords = vacationsResponse?.meta?.totalRecords || 0;
  const totalPages = Math.ceil(totalRecords / pageSize);

  // Clear filters
  const clearFilters = () => {
    setSelectedUserId("");
    setCurrentPage(1);
  };

  const hasActiveFilters = selectedUserId;

  return (
    <div className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Férias da Equipe</h1>
          <p className="text-muted-foreground mt-1">Visualize as férias dos colaboradores do seu setor</p>
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
            {totalRecords} {totalRecords === 1 ? "férias" : "férias"} encontrada{totalRecords !== 1 ? "s" : ""}
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
                    <TableHead>Período</TableHead>
                    <TableHead>Data Início</TableHead>
                    <TableHead>Data Fim</TableHead>
                    <TableHead>Dias</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        Carregando...
                      </TableCell>
                    </TableRow>
                  ) : vacations.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        Nenhuma férias encontrada
                      </TableCell>
                    </TableRow>
                  ) : (
                    vacations.map((vacation) => {
                      const days = vacation.startAt && vacation.endAt
                        ? Math.ceil((new Date(vacation.endAt).getTime() - new Date(vacation.startAt).getTime()) / (1000 * 60 * 60 * 24)) + 1
                        : 0;

                      return (
                        <TableRow key={vacation.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                                <IconUser className="h-4 w-4" />
                              </div>
                              <div>
                                <div className="font-medium">{vacation.user?.name || "-"}</div>
                                <div className="text-sm text-muted-foreground">{vacation.user?.position?.name || "-"}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{vacation.type || "-"}</div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <IconCalendar className="h-4 w-4 text-muted-foreground" />
                              {vacation.startAt ? formatDate(vacation.startAt) : "-"}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <IconCalendar className="h-4 w-4 text-muted-foreground" />
                              {vacation.endAt ? formatDate(vacation.endAt) : "-"}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{days} {days === 1 ? "dia" : "dias"}</div>
                          </TableCell>
                        </TableRow>
                      );
                    })
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
