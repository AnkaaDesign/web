import { useState } from "react";
import { IconCalendar, IconChevronDown } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDate } from "@/utils";
import { cn } from "@/lib/utils";
import { describeValidity, isQuoteValidityExpired } from "./validity";
import { ValidityPicker } from "./validity-picker";

interface ValidityFieldProps {
  value: Date | string | null | undefined;
  onChange: (next: Date) => void;
  disabled?: boolean;
}

/**
 * VALIDADE DA PROPOSTA — o campo do formulário.
 *
 * Era um seletor "15/30/60/90 dias" que só mostrava um período quando a data
 * casava com ele e caía em "30 dias" para qualquer outra, inclusive uma validade
 * vencida havia meses. Agora o campo mostra a DATA, em vermelho quando já passou,
 * e diz quanto falta. Clicar abre o `ValidityPicker`, com as três formas de trocar
 * ou estender.
 *
 * Só altera o formulário: a gravação acontece no Salvar, junto com o resto.
 */
export function ValidityField({ value, onChange, disabled }: ValidityFieldProps) {
  const [open, setOpen] = useState(false);
  const atual = value ? new Date(value) : null;
  const vencida = isQuoteValidityExpired(atual);

  return (
    <div className="space-y-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              "w-full justify-between font-normal",
              !atual && "text-muted-foreground",
              vencida && "border-destructive text-destructive hover:text-destructive",
            )}
          >
            <span className="flex items-center gap-2 tabular-nums">
              <IconCalendar className="h-4 w-4" />
              {atual ? formatDate(atual) : "Selecione"}
            </span>
            <IconChevronDown className="h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        {/* Largura do trigger; o mínimo só segura o calendário (7 dias de 2rem) em
            campos muito estreitos. */}
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[260px] p-3" align="start">
          <ValidityPicker
            current={atual}
            selected={atual}
            onPick={(d) => {
              onChange(d);
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>

      {atual && (
        <p className={cn("text-xs", vencida ? "text-destructive" : "text-muted-foreground")}>
          {describeValidity(atual)}
        </p>
      )}
    </div>
  );
}
