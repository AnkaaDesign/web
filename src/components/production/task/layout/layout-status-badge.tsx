import { Badge } from "@/components/ui/badge";
import { LAYOUT_STATUS } from "@/constants/enums";
import { LAYOUT_STATUS_LABELS } from "@/constants/enum-labels";

interface LayoutStatusBadgeProps {
  status?: string | null;
  size?: "default" | "sm" | "lg";
  className?: string;
  /**
   * Mostrar também o Rascunho. Em TAREFA o rascunho é ruído — quem não pode aprovar
   * nem enxerga o layout, e quem pode já sabe que o que não tem pílula é rascunho.
   * Em AEROGRAFIA é o contrário: rascunho é o estado que o aerografista vê com a tarja
   * "não liberada para produção", então precisa estar escrito na tela.
   */
  showDraft?: boolean;
}

export function LayoutStatusBadge({ status, size = "default", className, showDraft = false }: LayoutStatusBadgeProps) {
  if (!status) return null;
  if (status === LAYOUT_STATUS.DRAFT && !showDraft) return null;

  const variant = getLayoutStatusVariant(status);
  const label = LAYOUT_STATUS_LABELS[status as LAYOUT_STATUS] || status;

  return (
    <Badge variant={variant} size={size} className={className}>
      {label}
    </Badge>
  );
}

function getLayoutStatusVariant(status: string): "approved" | "rejected" | "default" {
  switch (status) {
    case LAYOUT_STATUS.APPROVED:
      return "approved";
    case LAYOUT_STATUS.REPROVED:
      return "rejected";
    default:
      return "default";
  }
}
