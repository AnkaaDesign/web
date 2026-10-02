/**
 * Uma seção ABERTA do assistente do orçamento: cartão com título e conteúdo.
 *
 * Substitui o acordeão de item único do passo 1 antigo, que escondia metade do
 * que o comercial precisa conferir (decisão do dono, 02/10/2026).
 */
import type { ReactNode } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface WizardSectionProps {
  icon: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Ações à direita do título (ex.: "Repetir nos demais"). */
  actions?: ReactNode;
  id?: string;
  className?: string;
  children: ReactNode;
}

export function WizardSection({ icon, title, description, actions, id, className, children }: WizardSectionProps) {
  return (
    <Card id={id} className={cn("scroll-mt-24", className)}>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="text-muted-foreground">{icon}</span>
              {title}
            </CardTitle>
            {description && <CardDescription className="mt-1">{description}</CardDescription>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}
