import { IconClockOff, IconFilter } from "@tabler/icons-react";

interface SchedulesEmptyProps {
  hasFilters?: boolean;
}

export function SchedulesEmpty({ hasFilters }: SchedulesEmptyProps) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
      {hasFilters ? (
        <>
          <IconFilter className="h-12 w-12 mb-2 text-muted-foreground/50" />
          <p className="text-lg font-medium">Nenhum horário encontrado</p>
          <p className="text-sm mt-1">Tente ajustar os filtros de busca</p>
        </>
      ) : (
        <>
          <IconClockOff className="h-12 w-12 mb-2 text-muted-foreground/50" />
          <p className="text-lg font-medium">Nenhum horário disponível</p>
          <p className="text-sm mt-1">Não há horários cadastrados no Secullum</p>
        </>
      )}
    </div>
  );
}
