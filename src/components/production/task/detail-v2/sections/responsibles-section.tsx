import React from "react";

import { IconBrandWhatsapp, IconUser } from "@tabler/icons-react";

import { SECTOR_PRIVILEGES } from "@/constants";
import type { Task } from "@/types";
import { RESPONSIBLE_ROLE_LABELS, ResponsibleRole } from "@/types/responsible";

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
        const marketing = responsibles.filter((r) => r.role === ResponsibleRole.MARKETING);
        return marketing.length > 0 ? marketing : responsibles.filter((r) => r.role === ResponsibleRole.COMMERCIAL);
      })()
    : responsibles;

  if (reps.length === 0) return null;

  return (
    <div className="space-y-2">
      {reps.map((rep) => {
        const cleanPhone = rep.phone.replace(/\D/g, "");
        const whatsappNumber = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
        const roleLabel = RESPONSIBLE_ROLE_LABELS[rep.role] || rep.role;

        return (
          <div key={rep.id} className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 px-4 py-2.5">
            <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <IconUser className="h-4 w-4" />
              Responsável {roleLabel}
            </span>
            <div className="flex items-center gap-3">
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
