import { IconSignature, IconSearch } from "@tabler/icons-react";

interface AssinaturaEmptyProps {
  hasFilters: boolean;
}

export function AssinaturaEmpty({ hasFilters }: AssinaturaEmptyProps) {
  const Icon = hasFilters ? IconSearch : IconSignature;
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
      <Icon className="h-12 w-12 mb-3 opacity-40" />
      <p className="text-sm font-medium">
        {hasFilters ? "Nenhuma apuração corresponde ao filtro." : "Nenhuma apuração encontrada."}
      </p>
      {!hasFilters && (
        <p className="text-xs mt-1 max-w-sm">
          Quando uma apuração de cartão ponto for criada no Secullum, ela aparecerá aqui.
        </p>
      )}
    </div>
  );
}
