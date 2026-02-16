import { useState, useCallback, useMemo } from "react";
import { routes } from "../../constants";
import { useTeamStaffCalculations, useTeamStaffUsers } from "../../hooks";
import { useAuth } from "@/contexts/auth-context";
import { isTeamLeader } from "@/utils/user";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "../../utils";
import { IconDownload, IconFileTypeCsv, IconFileTypeXls, IconFilter, IconX, IconUser, IconRefresh, IconClock, IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import { Navigate } from "react-router-dom";

const MONTHS = [
  { value: 1, label: "Janeiro" },
  { value: 2, label: "Fevereiro" },
  { value: 3, label: "Março" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Maio" },
  { value: 6, label: "Junho" },
  { value: 7, label: "Julho" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Setembro" },
  { value: 10, label: "Outubro" },
  { value: 11, label: "Novembro" },
  { value: 12, label: "Dezembro" },
];

export const TeamCalculationsPage = () => {
  const { user: currentUser } = useAuth();

  usePageTracker({
    title: "Controle de Ponto da Equipe",
    icon: "fingerprint",
  });

  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedUserId, setSelectedUserId] = useState<string>("");

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

  const { data: calculationsResponse, isLoading, refetch } = useTeamStaffCalculations(selectedYear, selectedMonth);

  const calculations = useMemo(() => {
    const data = calculationsResponse?.data || [];
    if (selectedUserId) {
      return data.filter((calc: any) => calc.userId === selectedUserId || calc.user?.id === selectedUserId);
    }
    return data;
  }, [calculationsResponse, selectedUserId]);

  const formatHours = (minutes: number | null | undefined) => {
    if (!minutes && minutes !== 0) return "-";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const exportToCSV = useCallback(() => {
    if (!calculations.length) {
      toast.error("Nenhum cálculo para exportar");
      return;
    }

    const csvContent = [
      ["Colaborador", "Cargo", "Horas Trabalhadas", "Horas Extras", "Faltas", "Atrasos", "Período"],
      ...calculations.map((calc: any) => [
        calc.user?.name || "",
        calc.user?.position?.name || "",
        formatHours(calc.workedMinutes),
        formatHours(calc.overtimeMinutes),
        calc.absences?.toString() || "0",
        formatHours(calc.lateMinutes),
        `${MONTHS.find((m) => m.value === selectedMonth)?.label} ${selectedYear}`,
      ]),
    ]
      .map((row) => row.map((cell: string | number) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `ponto_equipe_${selectedMonth}_${selectedYear}.csv`;
    link.click();
    toast.success("Arquivo CSV exportado com sucesso!");
  }, [calculations, selectedMonth, selectedYear]);

  const exportToExcel = useCallback(() => {
    if (!calculations.length) {
      toast.error("Nenhum cálculo para exportar");
      return;
    }

    const excelContent = [
      ["Relatório de Controle de Ponto da Equipe"],
      [`Data: ${formatDateTime(new Date())}`],
      [`Setor: ${currentUser?.managedSector?.name || "N/A"}`],
      [`Período: ${MONTHS.find((m) => m.value === selectedMonth)?.label} ${selectedYear}`],
      [],
      ["Colaborador", "Cargo", "Horas Trabalhadas", "Horas Extras", "Faltas", "Atrasos"],
      ...calculations.map((calc: any) => [
        calc.user?.name || "",
        calc.user?.position?.name || "",
        formatHours(calc.workedMinutes),
        formatHours(calc.overtimeMinutes),
        calc.absences?.toString() || "0",
        formatHours(calc.lateMinutes),
      ]),
    ]
      .map((row) => row.join("\t"))
      .join("\n");

    const blob = new Blob([excelContent], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `ponto_equipe_${selectedMonth}_${selectedYear}.xls`;
    link.click();
    toast.success("Arquivo Excel exportado com sucesso!");
  }, [calculations, selectedMonth, selectedYear, currentUser?.managedSector?.name]);

  const clearFilters = () => {
    setSelectedUserId("");
    setSelectedYear(currentDate.getFullYear());
    setSelectedMonth(currentDate.getMonth() + 1);
  };

  const goToPreviousMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  const hasActiveFilters = selectedUserId || selectedYear !== currentDate.getFullYear() || selectedMonth !== currentDate.getMonth() + 1;

  const years = Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - i);

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Controle de Ponto da Equipe</h1>
        <p className="text-muted-foreground mt-1">Acompanhe os registros de ponto dos colaboradores do seu setor</p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <IconFilter className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-5">
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

            <div className="space-y-2">
              <Label>Mês</Label>
              <Combobox
                value={selectedMonth.toString()}
                onValueChange={(value) => setSelectedMonth(parseInt((Array.isArray(value) ? value[0] : value) || "1"))}
                options={MONTHS.map((m) => ({ value: m.value.toString(), label: m.label }))}
                placeholder="Selecione o mês"
                searchable={false}
              />
            </div>

            <div className="space-y-2">
              <Label>Ano</Label>
              <Combobox
                value={selectedYear.toString()}
                onValueChange={(value) => setSelectedYear(parseInt((Array.isArray(value) ? value[0] : value) || currentDate.getFullYear().toString()))}
                options={years.map((y) => ({ value: y.toString(), label: y.toString() }))}
                placeholder="Selecione o ano"
                searchable={false}
              />
            </div>

            <div className="flex items-end gap-2 md:col-span-2">
              <Button variant="outline" size="icon" onClick={goToPreviousMonth}>
                <IconChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={goToNextMonth}>
                <IconChevronRight className="h-4 w-4" />
              </Button>
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
          <span className="font-medium">{MONTHS.find((m) => m.value === selectedMonth)?.label} {selectedYear}</span>
          {" - "}
          {calculations.length} {calculations.length === 1 ? "registro" : "registros"} encontrado{calculations.length !== 1 ? "s" : ""}
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
                  <TableHead>Horas Trabalhadas</TableHead>
                  <TableHead>Horas Extras</TableHead>
                  <TableHead>Faltas</TableHead>
                  <TableHead>Atrasos</TableHead>
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
                ) : calculations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nenhum registro de ponto encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  calculations.map((calc: any) => (
                    <TableRow key={calc.id || calc.userId}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                            <IconUser className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="font-medium">
                              <TruncatedTextWithTooltip text={calc.user?.name || "-"} />
                            </div>
                            <div className="text-sm text-muted-foreground">{calc.user?.position?.name || "-"}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <IconClock className="h-4 w-4 text-muted-foreground" />
                          {formatHours(calc.workedMinutes)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={calc.overtimeMinutes > 0 ? "text-green-600 font-medium" : ""}>
                          {formatHours(calc.overtimeMinutes)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={calc.absences > 0 ? "text-red-600 font-medium" : ""}>
                          {calc.absences || 0}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={calc.lateMinutes > 0 ? "text-yellow-600 font-medium" : ""}>
                          {formatHours(calc.lateMinutes)}
                        </span>
                      </TableCell>
                      <TableCell>
                        {calc.absences > 0 ? (
                          <Badge variant="destructive">Com faltas</Badge>
                        ) : calc.lateMinutes > 60 ? (
                          <Badge className="bg-yellow-100 text-yellow-800">Atrasos</Badge>
                        ) : (
                          <Badge variant="outline">Regular</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TeamCalculationsPage;
