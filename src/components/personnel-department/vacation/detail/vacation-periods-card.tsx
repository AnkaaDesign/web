import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { IconCalendar, IconDeviceFloppy, IconLoader2 } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { formatDate } from "../../../../utils";
import type { Vacation } from "../../../../types/vacation";
import { useVacationSetPeriods } from "../../../../hooks/personnel-department/use-vacations";
import { FracionamentoEditor } from "../form/fracionamento-editor";
import { validateFracionamento, type FracionamentoPeriod } from "../form/vacation-art130";

interface VacationPeriodsCardProps {
  vacation: Vacation;
  /** Blocks edition (e.g. PAID/EXPIRED). */
  disabled?: boolean;
  className?: string;
}

export function VacationPeriodsCard({ vacation, disabled = false, className }: VacationPeriodsCardProps) {
  const setPeriods = useVacationSetPeriods();

  const vacationDaysToSplit = Math.max(0, vacation.entitledDays - vacation.abonoPecuniarioDays);

  const toEditable = (): FracionamentoPeriod[] =>
    (vacation.periods ?? []).map((p) => ({ startDate: p.startDate ? new Date(p.startDate) : null, days: p.days }));

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<FracionamentoPeriod[]>(toEditable());

  useEffect(() => {
    setDraft(toEditable());
    setEditing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vacation.id, vacation.periods]);

  const validation = validateFracionamento(draft, vacationDaysToSplit);

  const handleSave = async () => {
    const filled = draft.filter((p) => p.startDate && p.days).map((p) => ({ startDate: p.startDate as Date, days: Number(p.days) }));
    if (filled.length === 0) return;
    try {
      await setPeriods.mutateAsync({ id: vacation.id, data: { periods: filled } });
      setEditing(false);
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Error saving vacation periods:", error);
      }
    }
  };

  return (
    <Card className={cn("shadow-sm border border-border", className)}>
      <CardHeader className="pb-4 flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <IconCalendar className="h-5 w-5 text-muted-foreground" />
          Períodos (Fracionamento)
        </CardTitle>
        {!disabled && !editing && (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            {vacation.periods && vacation.periods.length > 0 ? "Editar" : "Fracionar"}
          </Button>
        )}
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        {editing ? (
          <>
            <FracionamentoEditor periods={draft} onChange={setDraft} vacationDaysToSplit={vacationDaysToSplit} disabled={setPeriods.isPending} />
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDraft(toEditable());
                  setEditing(false);
                }}
                disabled={setPeriods.isPending}
              >
                Cancelar
              </Button>
              <Button variant="default" size="sm" onClick={handleSave} disabled={setPeriods.isPending || !validation.ok || draft.length === 0}>
                {setPeriods.isPending ? <IconLoader2 className="h-4 w-4 mr-2 animate-spin" /> : <IconDeviceFloppy className="h-4 w-4 mr-2" />}
                Salvar períodos
              </Button>
            </div>
          </>
        ) : vacation.periods && vacation.periods.length > 0 ? (
          <div className="space-y-2">
            {vacation.periods.map((period, index) => (
              <div key={period.id ?? index} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                <span className="text-muted-foreground">{index + 1}º período</span>
                <span className="font-medium">{period.startDate ? formatDate(new Date(period.startDate)) : "-"}</span>
                <span className="font-medium">{period.days} dias</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Período único de {vacationDaysToSplit} dias de gozo (não fracionado).</p>
        )}
      </CardContent>
    </Card>
  );
}
