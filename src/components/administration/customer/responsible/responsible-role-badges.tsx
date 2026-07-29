import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { RESPONSIBLE_ROLE_COLORS, RESPONSIBLE_ROLE_LABELS, type ResponsibleRole } from "@/types/responsible";
import { cn } from "@/lib/utils";

interface ResponsibleRoleBadgesProps {
  roles: ResponsibleRole[] | undefined | null;
  /**
   * Cap the number of badges rendered, collapsing the rest into a "+N" chip.
   * Use inside table cells, where the row height is fixed and overflow clips.
   */
  maxVisible?: number;
  className?: string;
}

/**
 * The single place a contact's roles are rendered as badges.
 *
 * A responsible can hold several roles at once (e.g. OWNER + FINANCIAL) so that
 * colleagues can tell which areas that contact actually handles before reaching
 * out. Keeping one component means the table cell, the detail card and the task
 * sections cannot drift in colour or ordering.
 */
export function ResponsibleRoleBadges({ roles, maxVisible, className }: ResponsibleRoleBadgesProps) {
  const list = roles ?? [];
  if (list.length === 0) {
    return <span className="text-muted-foreground">-</span>;
  }

  const visible = maxVisible ? list.slice(0, maxVisible) : list;
  const hidden = list.slice(visible.length);

  return (
    // Com `maxVisible` a linha NÃO quebra: a contagem de papéis varia de contato
    // para contato, e uma célula que quebra faz a linha inteira da tabela crescer
    // — cada responsável com altura diferente. Sem `maxVisible` (cartão de
    // detalhe) a quebra é o comportamento certo, porque ali cabe.
    <div className={cn("flex items-center gap-1", maxVisible ? "flex-nowrap" : "flex-wrap", className)}>
      {visible.map((role) => (
        <Badge
          key={role}
          variant={RESPONSIBLE_ROLE_COLORS[role] as any}
          className={cn("text-xs whitespace-nowrap", maxVisible && "shrink-0")}
        >
          {RESPONSIBLE_ROLE_LABELS[role] ?? role}
        </Badge>
      ))}
      {hidden.length > 0 && (
        // Tooltip, e não o `title` nativo: o "+N" só vale se der para descobrir
        // O QUE ele esconde, e o balão do sistema demora ~1s, some sozinho e não
        // aceita uma lista legível.
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="secondary"
              className={cn("cursor-default text-xs whitespace-nowrap", maxVisible && "shrink-0")}
            >
              +{hidden.length}
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[240px]">
            <div className="flex flex-col gap-0.5">
              {hidden.map((role) => (
                <span key={role}>{RESPONSIBLE_ROLE_LABELS[role] ?? role}</span>
              ))}
            </div>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
