import { Combobox } from "@/components/ui/combobox";
import type { ComboboxOption } from "@/components/ui/combobox";
import { DASHBOARD_TIME_PERIOD, DASHBOARD_TIME_PERIOD_LABELS } from "../../constants";

interface TimePeriodSelectorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function TimePeriodSelector({ value, onChange, className }: TimePeriodSelectorProps) {
  const options: ComboboxOption[] = [
    { value: DASHBOARD_TIME_PERIOD.THIS_WEEK, label: DASHBOARD_TIME_PERIOD_LABELS[DASHBOARD_TIME_PERIOD.THIS_WEEK] },
    { value: DASHBOARD_TIME_PERIOD.THIS_MONTH, label: DASHBOARD_TIME_PERIOD_LABELS[DASHBOARD_TIME_PERIOD.THIS_MONTH] },
    { value: DASHBOARD_TIME_PERIOD.THIS_YEAR, label: DASHBOARD_TIME_PERIOD_LABELS[DASHBOARD_TIME_PERIOD.THIS_YEAR] },
    { value: DASHBOARD_TIME_PERIOD.ALL_TIME, label: DASHBOARD_TIME_PERIOD_LABELS[DASHBOARD_TIME_PERIOD.ALL_TIME] },
  ];

  return (
    <Combobox
      value={value}
      onValueChange={(val) => val && onChange(val as string)}
      options={options}
      placeholder="Selecione o período"
      searchable={false}
      clearable={false}
      className={`w-[180px] ${className || ""}`}
      triggerClassName="h-9"
    />
  );
}
