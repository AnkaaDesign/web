// web/src/components/cliente/portal-section-card.tsx
//
// CADA SEÇÃO NO SEU PRÓPRIO CARTÃO CONTORNADO — preferência permanente do dono
// (§10), e a razão pela qual nenhuma destas telas é um rolo contínuo.
//
// ⛔ ELE NÃO DESENHA MAIS NADA PRÓPRIO. Era o SEGUNDO de três moldes de card no
// portal, e divergia do primeiro exatamente onde mais se nota: título em
// `font-semibold` contra o `font-medium` de `CardTitle`, que é o corpo de letra
// de todo card desta casa. Agora delega em `PortalCard`
// (`components/cliente/portal-detail.tsx`), o molde ÚNICO, e continua existindo
// só pela API — `action` (singular) em vez de `actions`, que é como as telas de
// Cobranças e Pedidos já o chamam.
import type { ReactNode } from "react";

import { PortalCard } from "./portal-detail";

export interface PortalSectionCardProps {
  title: ReactNode;
  description?: ReactNode;
  /** Botão ou badge alinhado à direita do título. */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Some com o respiro interno quando o conteúdo é uma tabela de ponta a ponta. */
  flush?: boolean;
}

export function PortalSectionCard({
  title,
  description,
  action,
  children,
  className,
  flush = false,
}: PortalSectionCardProps) {
  return (
    <PortalCard
      title={title}
      description={description}
      actions={action}
      className={className}
      flush={flush}
    >
      {children}
    </PortalCard>
  );
}
