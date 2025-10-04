import { useState, useMemo } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameMonth, isSameDay, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { IconCalendar, IconChevronLeft, IconChevronRight, IconRefresh } from "@tabler/icons-react";
import { useSecullumHolidays } from "../../../hooks";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export default function HolidayCalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  const { data, isLoading, refetch, isRefetching } = useSecullumHolidays({ year, month });

  const holidays = useMemo(() => {
    if (!data?.data) return [];
    return Array.isArray(data.data) ? data.data : [];
  }, [data]);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Add padding days to start from Sunday
  const startPadding = getDay(monthStart);
  const paddingDays = Array.from({ length: startPadding }, (_, i) => {
    const date = new Date(monthStart);
    date.setDate(date.getDate() - (startPadding - i));
    return date;
  });

  // Add padding days to complete the week
  const endPadding = 6 - getDay(monthEnd);
  const endPaddingDays = Array.from({ length: endPadding }, (_, i) => {
    const date = new Date(monthEnd);
    date.setDate(date.getDate() + (i + 1));
    return date;
  });

  const allDays = [...paddingDays, ...days, ...endPaddingDays];

  const getHolidaysForDay = (date: Date) => {
    return holidays.filter((holiday: any) => {
      const holidayDate = new Date(holiday.data || holiday.date);
      return isSameDay(holidayDate, date);
    });
  };

  const getHolidayType = (holiday: any) => {
    if (holiday.tipo === 1) return "Nacional";
    if (holiday.tipo === 2) return "Estadual";
    if (holiday.tipo === 3) return "Municipal";
    return "Empresa";
  };

  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  return (
    <div className="container mx-auto py-6 space-y-6">
      <PageHeader
        title="Calendário de Feriados"
        subtitle="Visualização em calendário dos feriados cadastrados no Secullum"
        actions={[
          {
            key: "refresh",
            label: "Atualizar",
            icon: IconRefresh,
            onClick: () => refetch(),
            disabled: isRefetching,
          },
        ]}
      />

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold capitalize flex items-center gap-2">
              <IconCalendar className="h-6 w-6" />
              {format(currentDate, "MMMM yyyy", { locale: ptBR })}
            </h2>
            <div className="flex gap-2">
              <Button variant="outline" size="icon" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
                <IconChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={() => setCurrentDate(new Date())}>
                Hoje
              </Button>
              <Button variant="outline" size="icon" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
                <IconChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-96">
              <LoadingSpinner size="lg" />
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-px bg-muted rounded-lg overflow-hidden">
              {/* Week days header */}
              {weekDays.map((day) => (
                <div key={day} className="bg-background p-3 text-center font-semibold text-sm">
                  {day}
                </div>
              ))}

              {/* Calendar days */}
              {allDays.map((date, index) => {
                const dayHolidays = getHolidaysForDay(date);
                const isCurrentMonth = isSameMonth(date, currentDate);
                const isToday = isSameDay(date, new Date());

                return (
                  <div
                    key={index}
                    className={cn(
                      "bg-background min-h-[100px] p-2 relative",
                      !isCurrentMonth && "bg-muted/50 text-muted-foreground",
                      isToday && "bg-primary/5 ring-2 ring-primary",
                    )}
                  >
                    <div className={cn("text-sm font-medium", isToday && "text-primary")}>{format(date, "d")}</div>

                    {dayHolidays.length > 0 && (
                      <div className="mt-1 space-y-1">
                        {dayHolidays.map((holiday: any, i: number) => (
                          <TooltipProvider key={i}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="text-xs p-1 bg-red-100 dark:bg-red-900/20 rounded cursor-pointer truncate">
                                  {holiday.descricao || holiday.description || holiday.nome || "Feriado"}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="space-y-1">
                                  <p className="font-semibold">{holiday.descricao || holiday.description || holiday.nome}</p>
                                  <p className="text-sm">Tipo: {getHolidayType(holiday)}</p>
                                  {holiday.observacao && <p className="text-sm text-muted-foreground">{holiday.observacao}</p>}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-6 flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 bg-red-100 dark:bg-red-900/20 rounded" />
              <span className="text-sm">Feriado</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 bg-primary/5 ring-2 ring-primary rounded" />
              <span className="text-sm">Hoje</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export { HolidayCalendarPage };
