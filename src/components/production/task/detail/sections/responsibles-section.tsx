import React from "react";

import { IconBrandWhatsapp, IconUser } from "@tabler/icons-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SECTOR_PRIVILEGES } from "@/constants";
import type { Task } from "@/types";
import {
  RESPONSIBLE_ROLE_LABELS,
  ResponsibleRole,
  formatResponsibleRoles,
  getResponsibleRoles,
} from "@/types/responsible";

/**
 * Formats a Brazilian phone number for display.
 * 11-digit -> (NN) NNNNN-NNNN, 10-digit -> (NN) NNNN-NNNN, otherwise returns the raw value.
 */
function formatPhone(phone: string): string {
  const numbers = phone.replace(/\D/g, "");
  if (numbers.length === 11) {
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
  }
  if (numbers.length === 10) {
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 6)}-${numbers.slice(6, 10)}`;
  }
  return phone;
}

/**
 * Bare render body for the "Responsáveis" detail section (DetailPage host supplies the Card/title).
 *
 * DESIGNER sector sees only MARKETING responsibles (falling back to COMMERCIAL when there are no
 * MARKETING reps); every other sector sees all of the task's responsibles. Returns null when there
 * is nothing to show.
 */
export function ResponsiblesSection({ task, role }: { task: Task; role: string }): React.ReactNode {
  const responsibles = task.responsibles;
  if (!responsibles || responsibles.length === 0) return null;

  const isDesignerSector = role === SECTOR_PRIVILEGES.DESIGNER;
  const reps = isDesignerSector
    ? (() => {
        const marketing = responsibles.filter((r) => getResponsibleRoles(r).includes(ResponsibleRole.MARKETING));
        return marketing.length > 0
          ? marketing
          : responsibles.filter((r) => getResponsibleRoles(r).includes(ResponsibleRole.COMMERCIAL));
      })()
    : responsibles;

  if (reps.length === 0) return null;

  return (
    <div className="space-y-2">
      {reps.map((rep) => {
        const cleanPhone = rep.phone.replace(/\D/g, "");
        const whatsappNumber = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
        // Um contato acumula papéis (aqui, nove), e enfileirar todos fazia o
        // rótulo ocupar três linhas e espremer nome e telefone. Mostra o
        // primeiro — o que explica POR QUE ele é o responsável desta tarefa — e
        // conta o resto; a lista inteira fica no title.
        const roles = getResponsibleRoles(rep);
        const allRoles = formatResponsibleRoles(roles);
        const extraRoles = Math.max(0, roles.length - 1);
        const roleLabel = roles.length > 0 ? RESPONSIBLE_ROLE_LABELS[roles[0]] ?? "" : "";

        return (
          <div key={rep.id} className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 px-4 py-2.5">
            <span className="text-sm font-medium text-muted-foreground flex min-w-0 items-center gap-2">
              <IconUser className="h-4 w-4 shrink-0" />
              <span className="truncate" title={allRoles}>
                Responsável {roleLabel}
              </span>
              {extraRoles > 0 && (
                // O "+N" tem de dizer o que esconde: passar o mouse abre a
                // lista dos demais papéis deste responsável.
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="shrink-0 cursor-default rounded-full bg-muted px-1.5 py-0.5 text-xs tabular-nums">
                      +{extraRoles}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[240px]">
                    <div className="flex flex-col gap-0.5">
                      {roles.slice(1).map((role) => (
                        <span key={role}>{RESPONSIBLE_ROLE_LABELS[role] ?? role}</span>
                      ))}
                    </div>
                  </TooltipContent>
                </Tooltip>
              )}
            </span>
            <div className="flex shrink-0 items-center gap-3">
              <span className="text-sm font-semibold text-foreground">{rep.name}</span>
              <a href={`tel:${rep.phone}`} className="text-sm font-medium text-green-600 dark:text-green-600 hover:underline">
                {formatPhone(rep.phone)}
              </a>
              <a
                href={`https://wa.me/${whatsappNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-green-600 dark:text-green-600 hover:text-green-700 dark:hover:text-green-500 transition-colors"
                title="Enviar mensagem no WhatsApp"
              >
                <IconBrandWhatsapp className="h-5 w-5" />
              </a>
            </div>
          </div>
        );
      })}
    </div>
  );
}
