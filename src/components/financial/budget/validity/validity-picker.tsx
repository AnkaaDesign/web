import { useState, type ReactNode } from "react";
import { IconArrowLeft, IconCalendar, IconChevronRight } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Calendar, type CalendarProps } from "@/components/ui/calendar";
import { formatDate } from "@/utils";
import { cn } from "@/lib/utils";
import {
  QUOTE_VALIDITY_EXTENSIONS,
  QUOTE_VALIDITY_OPTIONS,
  endOfDay,
  extendValidity,
  isQuoteValidityExpired,
  quoteValidityEnd,
} from "./validity";

interface ValidityPickerProps {
  /**
   * A validade atual. Só com ela (e ainda valendo) aparece "Estender a validade
   * atual". Na seleção de VÁRIOS orçamentos não há uma atual, e fica de fora.
   */
  current?: Date | null;
  /** A data escolhida até aqui, destacada nos botões e no calendário. */
  selected?: Date | null;
  onPick: (next: Date) => void;
  /** A largura vem de quem usa: o popover do campo acompanha o trigger. */
  className?: string;
}

const sameDay = (a?: Date | null, b?: Date | null) => !!a && !!b && a.toDateString() === b.toDateString();

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</h4>
      {children}
    </section>
  );
}

function Option({ label, date, active, onClick }: { label: string; date: Date; active: boolean; onClick: () => void }) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? "default" : "outline"}
      className="h-auto flex-col gap-0.5 py-2"
      onClick={onClick}
    >
      <span className="text-sm">{label}</span>
      <span className={cn("text-[11px] tabular-nums", active ? "opacity-80" : "text-muted-foreground")}>
        {formatDate(date)}
      </span>
    </Button>
  );
}

/**
 * AS TRÊS FORMAS DE MEXER NA VALIDADE, num lugar só.
 *
 * É o corpo do campo do formulário (`ValidityField`) e do diálogo de estender em
 * lote (`ExtendValidityDialog`). Por isso as duas telas oferecem as mesmas
 * opções, na mesma ordem e com o mesmo visual:
 *
 *   1. A partir de hoje: 15/30/60/90 dias. É o que um orçamento vencido precisa.
 *   2. Estender a validade atual: +15/+30. Só sobre uma validade que ainda vale.
 *   3. Data exata, no calendário. Datas passadas ficam bloqueadas.
 *
 * O calendário é uma SEGUNDA VISTA, não uma terceira seção. Empilhado embaixo
 * das opções, ele deixava o popover mais alto que a tela. Agora "Escolher uma
 * data…" troca o conteúdo pelo calendário, e "Voltar" retorna às opções.
 *
 * Não grava nada: devolve a data escolhida a quem a usa.
 */
export function ValidityPicker({ current, selected, onPick, className }: ValidityPickerProps) {
  const podeSomar = !!current && !isQuoteValidityExpired(current);
  const [vista, setVista] = useState<"opcoes" | "calendario">("opcoes");

  // O `CalendarProps` do projeto não declara as props do modo "single" do
  // react-day-picker (é o mesmo desencontro que os outros usos contornam com
  // `@ts-expect-error`); o objeto evita suprimir erro no JSX inteiro.
  const calendarProps = {
    mode: "single",
    selected: selected ?? undefined,
    defaultMonth: selected ?? (podeSomar ? current! : new Date()),
    disabled: { before: new Date() },
    onSelect: (d: Date | undefined) => d && onPick(endOfDay(d)),
    // Sem padding e com a raiz em largura cheia: os dias são `w-full
    // aspect-square`, então o calendário acompanha a largura do popover.
    className: "p-0",
    classNames: { root: "rdp-root w-full" }, // `rdp-root` é a classe padrão que o spread substituiria
  } as unknown as CalendarProps;

  if (vista === "calendario") {
    return (
      <div className={cn("w-full space-y-3", className)}>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="-ml-2 h-7 gap-1.5 px-2 text-muted-foreground"
          onClick={() => setVista("opcoes")}
        >
          <IconArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        <Calendar {...calendarProps} />
      </div>
    );
  }

  return (
    <div className={cn("w-full space-y-4", className)}>
      <Section title="A partir de hoje">
        <div className="grid grid-cols-2 gap-1.5">
          {QUOTE_VALIDITY_OPTIONS.map((d) => {
            const data = quoteValidityEnd(d);
            return (
              <Option key={d} label={`${d} dias`} date={data} active={sameDay(selected, data)} onClick={() => onPick(data)} />
            );
          })}
        </div>
      </Section>

      {podeSomar && (
        <Section title="Estender a validade atual">
          <div className="grid grid-cols-2 gap-1.5">
            {QUOTE_VALIDITY_EXTENSIONS.map((d) => {
              const data = extendValidity(current!, d);
              return (
                <Option key={d} label={`+${d} dias`} date={data} active={sameDay(selected, data)} onClick={() => onPick(data)} />
              );
            })}
          </div>
        </Section>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full justify-between font-normal"
        onClick={() => setVista("calendario")}
      >
        <span className="flex items-center gap-2">
          <IconCalendar className="h-4 w-4" />
          Escolher uma data…
        </span>
        <IconChevronRight className="h-4 w-4 opacity-50" />
      </Button>
    </div>
  );
}
