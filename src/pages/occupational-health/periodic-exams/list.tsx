import { useMemo, useState } from "react";
import { differenceInCalendarDays, addMonths } from "date-fns";
import {
  IconAlertTriangle,
  IconCalendarDue,
  IconCalendarPlus,
  IconCalendarStats,
  IconClipboardList,
  IconRefresh,
  IconStethoscope,
} from "@tabler/icons-react";

import { FAVORITE_PAGES, routes, SECTOR_PRIVILEGES } from "../../../constants";
import { formatDate } from "../../../utils";
import { useExpiringMedicalExams } from "@/hooks/occupational-health/use-medical-exams";
import type { MedicalExam } from "@/types/medical-exam";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ScheduleNextExamDialog } from "@/components/occupational-health/medical-exam/periodic";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

const DAYS_OPTIONS = [30, 60, 90, 180];

function getDaysLeftBadge(expiresAt: Date | string) {
  const daysLeft = differenceInCalendarDays(new Date(expiresAt), new Date());

  if (daysLeft < 0) {
    return (
      <Badge variant="destructive" className="text-xs whitespace-nowrap">
        Vencido há {Math.abs(daysLeft)} {Math.abs(daysLeft) === 1 ? "dia" : "dias"}
      </Badge>
    );
  }

  return (
    <Badge variant={daysLeft <= 30 ? "amber" : "secondary"} className="text-xs whitespace-nowrap">
      {daysLeft} {daysLeft === 1 ? "dia" : "dias"}
    </Badge>
  );
}

export const PeriodicExamsPage = () => {
  usePageTracker({
    title: "Exames Periódicos",
    icon: "calendar-due",
  });

  const [days, setDays] = useState(60);
  const [scheduleExam, setScheduleExam] = useState<MedicalExam | null>(null);

  const { data: response, isLoading, error, refetch, isRefetching } = useExpiringMedicalExams(days);

  const exams = useMemo(() => response?.data || [], [response?.data]);

  const { overdueCount, expiringCount } = useMemo(() => {
    let overdue = 0;
    let expiring = 0;
    for (const exam of exams) {
      if (!exam.expiresAt) continue;
      if (differenceInCalendarDays(new Date(exam.expiresAt), new Date()) < 0) {
        overdue++;
      } else {
        expiring++;
      }
    }
    return { overdueCount: overdue, expiringCount: expiring };
  }, [exams]);

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="list"
          title="Exames Periódicos"
          favoritePage={FAVORITE_PAGES.MEDICINA_DO_TRABALHO_EXAMES_PERIODICOS_LISTAR}
          breadcrumbs={[
            { label: "Início", href: "/" },
            { label: "Medicina do Trabalho", href: routes.occupationalHealth.root },
            { label: "Exames Periódicos" },
          ]}
          actions={[
            {
              key: "refresh",
              label: "Atualizar",
              icon: IconRefresh,
              onClick: () => refetch(),
              loading: isRefetching,
            },
          ]}
          className="flex-shrink-0"
        />

        <div className="flex-1 min-h-0 overflow-y-auto pb-6">
          <div className="space-y-4">
            {/* Days selector */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground">Janela de monitoramento:</span>
              {DAYS_OPTIONS.map((option) => (
                <Button key={option} variant={days === option ? "default" : "outline"} size="sm" onClick={() => setDays(option)}>
                  {option} dias
                </Button>
              ))}
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="shadow-sm border border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <IconAlertTriangle className="h-4 w-4 text-destructive" />
                    Vencidos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? <Skeleton className="h-8 w-16" /> : <p className="text-3xl font-bold text-destructive">{overdueCount}</p>}
                </CardContent>
              </Card>

              <Card className="shadow-sm border border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <IconCalendarDue className="h-4 w-4 text-amber-600 dark:text-amber-500" />
                    Vencendo em {days} dias
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? <Skeleton className="h-8 w-16" /> : <p className="text-3xl font-bold text-amber-600 dark:text-amber-500">{expiringCount}</p>}
                </CardContent>
              </Card>

              <Card className="shadow-sm border border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <IconCalendarStats className="h-4 w-4" />
                    Total monitorado
                  </CardTitle>
                </CardHeader>
                <CardContent>{isLoading ? <Skeleton className="h-8 w-16" /> : <p className="text-3xl font-bold">{exams.length}</p>}</CardContent>
              </Card>
            </div>

            {/* Table */}
            <Card className="shadow-sm border border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IconClipboardList className="h-5 w-5 text-muted-foreground" />
                  Exames a vencer
                </CardTitle>
              </CardHeader>
              <CardContent>
                {error ? (
                  <div className="flex flex-col items-center justify-center p-8 text-center text-destructive">
                    <IconAlertTriangle className="h-8 w-8 mb-4" />
                    <div className="text-lg font-medium mb-2">Não foi possível carregar os exames</div>
                    <div className="text-sm text-muted-foreground">Tente novamente mais tarde.</div>
                  </div>
                ) : isLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 6 }).map((_, index) => (
                      <Skeleton key={index} className="h-10 w-full" />
                    ))}
                  </div>
                ) : exams.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                    <IconStethoscope className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <div className="text-lg font-medium mb-2">Nenhum exame vencendo</div>
                    <div className="text-sm">Não há exames vencidos ou vencendo nos próximos {days} dias.</div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted hover:bg-muted">
                          <TableHead className="text-foreground font-bold uppercase text-xs">Colaborador</TableHead>
                          <TableHead className="text-foreground font-bold uppercase text-xs">Cargo</TableHead>
                          <TableHead className="text-foreground font-bold uppercase text-xs">Último Exame</TableHead>
                          <TableHead className="text-foreground font-bold uppercase text-xs">Validade</TableHead>
                          <TableHead className="text-foreground font-bold uppercase text-xs">Próximo (auto)</TableHead>
                          <TableHead className="text-foreground font-bold uppercase text-xs">Prazo</TableHead>
                          <TableHead className="text-foreground font-bold uppercase text-xs text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {exams.map((exam, index) => {
                          const isOverdue = exam.expiresAt ? differenceInCalendarDays(new Date(exam.expiresAt), new Date()) < 0 : false;

                          // Próximo periódico (auto-followup): expiresAt é a próxima data-base;
                          // se houver periodicidade definida, exibimos também a janela em meses.
                          const nextDue = exam.expiresAt ? new Date(exam.expiresAt) : exam.examDate && exam.periodicityMonths ? addMonths(new Date(exam.examDate), exam.periodicityMonths) : null;

                          return (
                            <TableRow key={exam.id} className={cn("border-b border-border", index % 2 === 1 && "bg-muted/10", "hover:bg-muted/20")}>
                              <TableCell className="font-medium">{exam.user?.name || "-"}</TableCell>
                              <TableCell className="text-sm">{exam.user?.position?.name || "-"}</TableCell>
                              <TableCell className="text-sm">{exam.examDate ? formatDate(new Date(exam.examDate)) : "-"}</TableCell>
                              <TableCell className={cn("text-sm", isOverdue && "text-destructive font-semibold")}>
                                {exam.expiresAt ? formatDate(new Date(exam.expiresAt)) : "-"}
                              </TableCell>
                              <TableCell className="text-sm">
                                {nextDue ? (
                                  <div className="flex flex-col">
                                    <span>{formatDate(nextDue)}</span>
                                    {exam.periodicityMonths != null && (
                                      <span className="text-xs text-muted-foreground">a cada {exam.periodicityMonths} {exam.periodicityMonths === 1 ? "mês" : "meses"}</span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell>{exam.expiresAt ? getDaysLeftBadge(exam.expiresAt) : "-"}</TableCell>
                              <TableCell className="text-right">
                                <Button variant="outline" size="sm" onClick={() => setScheduleExam(exam)}>
                                  <IconCalendarPlus className="h-4 w-4 mr-2" />
                                  Agendar próximo
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Schedule Next Exam Dialog */}
        <ScheduleNextExamDialog exam={scheduleExam} open={!!scheduleExam} onOpenChange={(open) => !open && setScheduleExam(null)} />
      </div>
    </PrivilegeRoute>
  );
};

export default PeriodicExamsPage;
