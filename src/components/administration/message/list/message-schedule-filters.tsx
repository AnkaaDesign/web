import { useEffect, useState } from "react";
import { FilterDrawer } from "@/components/common/filters/ui/FilterDrawer";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { IconFilter } from "@tabler/icons-react";
import { SCHEDULE_FREQUENCY, SCHEDULE_FREQUENCY_LABELS } from "@/constants";
import type {
  MessageScheduleGetManyFormData,
  MessageScheduleStatus,
  MessageTargetType,
} from "@/schemas/message-schedule";

/**
 * Filtros da tabela de comunicados recorrentes.
 *
 * Deliberadamente SEPARADO de `MessageFilters`: as duas tabelas dividem a
 * página, mas filtram coisas diferentes. Uma mensagem tem período de exibição,
 * visualizações e destinatários congelados; um agendamento tem cadência,
 * vigência e um público que é regra. Um único painel para as duas só produziria
 * campos que não se aplicam a metade da tela.
 */

const STATUS_OPTIONS: { value: MessageScheduleStatus; label: string }[] = [
  { value: "active", label: "Ativo" },
  { value: "paused", label: "Pausado" },
  { value: "finished", label: "Encerrado" },
];

/** As mesmas frequências que o compositor oferece — ONCE não é recorrência. */
const FREQUENCY_OPTIONS = [
  SCHEDULE_FREQUENCY.DAILY,
  SCHEDULE_FREQUENCY.WEEKLY,
  SCHEDULE_FREQUENCY.BIWEEKLY,
  SCHEDULE_FREQUENCY.MONTHLY,
  SCHEDULE_FREQUENCY.BIMONTHLY,
  SCHEDULE_FREQUENCY.QUARTERLY,
  SCHEDULE_FREQUENCY.SEMI_ANNUAL,
  SCHEDULE_FREQUENCY.ANNUAL,
].map(f => ({ value: f, label: SCHEDULE_FREQUENCY_LABELS[f] ?? f }));

const TARGET_OPTIONS: { value: MessageTargetType; label: string }[] = [
  { value: "ALL", label: "Todos" },
  { value: "SPECIFIC", label: "Usuários específicos" },
  { value: "SECTOR", label: "Por setor" },
  { value: "POSITION", label: "Por cargo" },
];

interface MessageScheduleFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: Partial<MessageScheduleGetManyFormData>;
  onFilterChange: (filters: Partial<MessageScheduleGetManyFormData>) => void;
}

export function MessageScheduleFilters({
  open,
  onOpenChange,
  filters,
  onFilterChange,
}: MessageScheduleFiltersProps) {
  const [localFilters, setLocalFilters] = useState(filters);

  useEffect(() => {
    if (open) setLocalFilters(filters);
  }, [open, filters]);

  const handleApply = () => {
    onFilterChange(localFilters);
    onOpenChange(false);
  };

  const handleClear = () => {
    setLocalFilters({});
    onFilterChange({});
  };

  return (
    <FilterDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Filtros dos recorrentes"
      titleIcon={<IconFilter className="h-5 w-5" />}
      description="Filtra apenas a tabela de comunicados recorrentes"
      onApply={handleApply}
      onReset={handleClear}
      applyLabel="Aplicar Filtros"
      resetLabel="Limpar"
    >
      <div className="space-y-2">
        <Label className="text-sm font-medium">Situação</Label>
        <Combobox
          mode="multiple"
          value={localFilters.status ?? []}
          onValueChange={value =>
            setLocalFilters(prev => ({
              ...prev,
              status: (value as MessageScheduleStatus[]).length
                ? (value as MessageScheduleStatus[])
                : undefined,
            }))
          }
          options={STATUS_OPTIONS}
          placeholder="Todas as situações"
          searchable={false}
          clearable
        />
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium">Repetição</Label>
        <Combobox
          mode="multiple"
          value={localFilters.frequency ?? []}
          onValueChange={value =>
            setLocalFilters(prev => ({
              ...prev,
              frequency: (value as SCHEDULE_FREQUENCY[]).length
                ? (value as SCHEDULE_FREQUENCY[])
                : undefined,
            }))
          }
          options={FREQUENCY_OPTIONS}
          placeholder="Todas as frequências"
          searchable={false}
          clearable
        />
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium">Público-alvo</Label>
        <Combobox
          mode="multiple"
          value={localFilters.targetType ?? []}
          onValueChange={value =>
            setLocalFilters(prev => ({
              ...prev,
              targetType: (value as MessageTargetType[]).length
                ? (value as MessageTargetType[])
                : undefined,
            }))
          }
          options={TARGET_OPTIONS}
          placeholder="Todos os públicos"
          searchable={false}
          clearable
        />
      </div>
    </FilterDrawer>
  );
}
