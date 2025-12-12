import { IconCalendarOff, IconFilter } from "@tabler/icons-react";

interface HolidaysEmptyProps {
  hasFilters?: boolean;
}

export function HolidaysEmpty({ hasFilters }: HolidaysEmptyProps) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
      {hasFilters ? (
        <>
          <IconFilter className="h-12 w-12 mb-2 text-muted-foreground/50" />
          <p className="text-lg font-medium">Nenhum feriado encontrado</p>
          <p className="text-sm mt-1">Tente ajustar os filtros de busca</p>
        </>
      ) : (
        <>
          <IconCalendarOff className="h-12 w-12 mb-2 text-muted-foreground/50" />
          <p className="text-lg font-medium">Nenhum feriado disponível</p>
          <p className="text-sm mt-1">Não há feriados cadastrados para este período</p>
        </>
      )}
    </div>
  );
}
