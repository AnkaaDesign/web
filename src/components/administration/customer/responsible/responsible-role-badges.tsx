import { Badge } from "@/components/ui/badge";
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
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {visible.map((role) => (
        <Badge key={role} variant={RESPONSIBLE_ROLE_COLORS[role] as any} className="text-xs whitespace-nowrap">
          {RESPONSIBLE_ROLE_LABELS[role] ?? role}
        </Badge>
      ))}
      {hidden.length > 0 && (
        <Badge
          variant="secondary"
          className="text-xs whitespace-nowrap"
          title={hidden.map((role) => RESPONSIBLE_ROLE_LABELS[role] ?? role).join(", ")}
        >
          +{hidden.length}
        </Badge>
      )}
    </div>
  );
}
