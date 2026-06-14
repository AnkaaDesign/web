import { IconCalendar, IconPlus, IconTrash } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { validateFracionamento, type FracionamentoPeriod } from "./vacation-art130";

interface FracionamentoEditorProps {
  periods: FracionamentoPeriod[];
  onChange: (periods: FracionamentoPeriod[]) => void;
  /** Dias de gozo (entitled - abono) que a soma deve respeitar; 0 desliga a checagem de soma. */
  vacationDaysToSplit: number;
  disabled?: boolean;
  className?: string;
}

const MAX_PERIODS = 3;

export function FracionamentoEditor({ periods, onChange, vacationDaysToSplit, disabled = false, className }: FracionamentoEditorProps) {
  const validation = validateFracionamento(periods, vacationDaysToSplit);

  const updatePeriod = (index: number, patch: Partial<FracionamentoPeriod>) => {
    const next = periods.map((p, i) => (i === index ? { ...p, ...patch } : p));
    onChange(next);
  };

  const addPeriod = () => {
    if (periods.length >= MAX_PERIODS) return;
    onChange([...periods, { startDate: null, days: "" }]);
  };

  const removePeriod = (index: number) => {
    onChange(periods.filter((_, i) => i !== index));
  };

  const totalDays = periods.reduce((sum, p) => sum + (Number(p.days) || 0), 0);

  return (
    <div className={cn("space-y-3", className)}>
      {periods.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum período definido — as férias serão gozadas em um único período de {vacationDaysToSplit || 0} dias.</p>
      ) : (
        <div className="space-y-3">
          {periods.map((period, index) => (
            <div key={index} className="grid grid-cols-1 sm:grid-cols-[1fr_120px_auto] gap-3 items-end rounded-md border border-border p-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Início do {index + 1}º período</Label>
                <DateTimeInput
                  mode="date"
                  value={period.startDate}
                  onChange={(date) => updatePeriod(index, { startDate: date instanceof Date ? date : null })}
                  hideLabel
                  disabled={disabled}
                  placeholder="Data de início"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Dias</Label>
                <Input
                  type="number"
                  min={1}
                  max={30}
                  value={period.days ?? ""}
                  onChange={(value) => updatePeriod(index, { days: value === "" || value === null ? "" : Number(value) })}
                  disabled={disabled}
                  placeholder="0"
                />
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => removePeriod(index)} disabled={disabled} className="text-destructive">
                <IconTrash className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Total: <span className={cn("font-medium", vacationDaysToSplit > 0 && totalDays !== vacationDaysToSplit ? "text-destructive" : "text-foreground")}>{totalDays} dias</span>
              {vacationDaysToSplit > 0 && <span className="text-muted-foreground"> / {vacationDaysToSplit} dias de gozo</span>}
            </span>
          </div>
        </div>
      )}

      {periods.length < MAX_PERIODS && (
        <Button type="button" variant="outline" size="sm" onClick={addPeriod} disabled={disabled}>
          <IconPlus className="h-4 w-4 mr-2" />
          <IconCalendar className="h-4 w-4 mr-1" />
          Adicionar período
        </Button>
      )}

      {!validation.ok && (
        <Alert variant="warning">
          <AlertDescription>
            <ul className="list-disc list-inside space-y-1">
              {validation.errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <p className="text-xs text-muted-foreground">
        Fracionamento (Reforma 2017): até 3 períodos; um deve ter ≥ 14 dias corridos e os demais ≥ 5 dias cada.
      </p>
    </div>
  );
}
