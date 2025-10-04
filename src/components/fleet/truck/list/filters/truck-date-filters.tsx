import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { IconCalendar } from "@tabler/icons-react";

interface TruckDateFiltersProps {
  createdAt?: { gte?: Date; lte?: Date };
  updatedAt?: { gte?: Date; lte?: Date };
  onCreatedAtChange: (value: { gte?: Date; lte?: Date } | undefined) => void;
  onUpdatedAtChange: (value: { gte?: Date; lte?: Date } | undefined) => void;
}

interface DateRangeInputProps {
  label: string;
  description: string;
  gte?: Date;
  lte?: Date;
  onChange: (gte?: Date, lte?: Date) => void;
}

function DateRangeInput({ label, description, gte, lte, onChange }: DateRangeInputProps) {
  const handleStartDateChange = (date: Date | undefined) => {
    onChange(date, lte);
  };

  const handleEndDateChange = (date: Date | undefined) => {
    onChange(gte, date);
  };

  const clearDates = () => {
    onChange(undefined, undefined);
  };

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-sm font-medium">{label}</Label>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Data inicial</Label>
          <DatePicker date={gte} onDateChange={handleStartDateChange} placeholder="Selecionar data..." />
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Data final</Label>
          <DatePicker date={lte} onDateChange={handleEndDateChange} placeholder="Selecionar data..." />
        </div>
      </div>

      {(gte || lte) && (
        <div className="pt-2">
          <button type="button" onClick={clearDates} className="text-xs text-muted-foreground hover:text-foreground underline">
            Limpar datas
          </button>
        </div>
      )}
    </div>
  );
}

export function TruckDateFilters({ createdAt, updatedAt, onCreatedAtChange, onUpdatedAtChange }: TruckDateFiltersProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <IconCalendar className="h-5 w-5" />
            Filtros de Data
          </CardTitle>
          <CardDescription>Filtre caminhões por intervalos de datas de criação e atualização</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <DateRangeInput
            label="Data de Criação"
            description="Filtre por quando o caminhão foi criado no sistema"
            gte={createdAt?.gte}
            lte={createdAt?.lte}
            onChange={(gte, lte) => {
              if (!gte && !lte) {
                onCreatedAtChange(undefined);
              } else {
                onCreatedAtChange({ gte, lte });
              }
            }}
          />

          <DateRangeInput
            label="Data de Atualização"
            description="Filtre por quando o caminhão foi atualizado pela última vez"
            gte={updatedAt?.gte}
            lte={updatedAt?.lte}
            onChange={(gte, lte) => {
              if (!gte && !lte) {
                onUpdatedAtChange(undefined);
              } else {
                onUpdatedAtChange({ gte, lte });
              }
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
