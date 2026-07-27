import React from "react";

import { IconBrandWhatsapp, IconUser } from "@tabler/icons-react";

import { SECTOR_PRIVILEGES } from "@/constants";
import type { Task } from "@/types";
import { RESPONSIBLE_ROLE_LABELS, ResponsibleRole } from "@/types/responsible";

/**
 * Canonical role order, reused for both group ordering and the "primary role"
 * tie-break. Deliberately the enum declaration order -- the same order the
 * create/update schemas sort a responsible's `roles` into, so a contact's
 * badges, their group placement and their secondary chips never disagree.
 */
const CANONICAL_ROLE_ORDER = Object.values(ResponsibleRole);

/**
 * Which contact roles each sector may see, in priority order.
 *
 * A sector absent from this map sees every role (ADMIN, COMMERCIAL,
 * PRODUCTION_MANAGER). Sectors that cannot see the section at all are gated
 * upstream by `canViewRestricted` in task-detail-page.tsx and never reach here.
 */
const SECTOR_VISIBLE_ROLES: Partial<Record<string, ResponsibleRole[]>> = {
  [SECTOR_PRIVILEGES.DESIGNER]: [ResponsibleRole.MARKETING],
  [SECTOR_PRIVILEGES.FINANCIAL]: [ResponsibleRole.FINANCIAL],
  [SECTOR_PRIVILEGES.LOGISTIC]: [ResponsibleRole.FLEET_MANAGER, ResponsibleRole.DRIVER],
};

/**
 * Shown to a restricted sector when the task has no contact holding any of its
 * own roles -- better a commercial contact than an empty card.
 */
const FALLBACK_ROLES: ResponsibleRole[] = [ResponsibleRole.COMMERCIAL];

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
 * The roles this sector may see, falling back to Comercial when it has no match.
 *
 * Exported so the task edit form gates its responsible list through the exact
 * same rule -- a second copy of this logic is how the two surfaces drift.
 */
export function resolveVisibleRoles(
  sector: string,
  responsibles: Array<{ roles?: ResponsibleRole[] }>,
): ResponsibleRole[] {
  const allowed = SECTOR_VISIBLE_ROLES[sector];
  if (!allowed) return CANONICAL_ROLE_ORDER;

  const hasMatch = responsibles.some((rep) => rep.roles?.some((role) => allowed.includes(role)));
  return hasMatch ? allowed : FALLBACK_ROLES;
}

/**
 * Bare render body for the "Responsáveis" detail section (DetailPage host supplies the Card/title).
 *
 * One row per contact, with every role that contact holds listed inline. Roles
 * are deliberately NOT split between a group heading and the row: a contact who
 * holds Comercial + 8 others would otherwise show "Comercial" as a floating
 * badge and the remaining eight in the row, reading like a truncated list.
 *
 * Visibility is per sector (see SECTOR_VISIBLE_ROLES): DESIGNER sees Marketing,
 * FINANCIAL sees Financeiro, LOGISTIC sees Gestor de Frota / Motorista, and
 * ADMIN / COMMERCIAL / PRODUCTION_MANAGER see everything. A restricted sector
 * therefore sees only the contacts it may call, labelled with just the roles it
 * is allowed to know about. Returns null when there is nothing to show.
 */
export function ResponsiblesSection({ task, role }: { task: Task; role: string }): React.ReactNode {
  const responsibles = task.responsibles;
  if (!responsibles || responsibles.length === 0) return null;

  const visibleRoles = resolveVisibleRoles(role, responsibles);
  const reps = responsibles
    .map((rep) => ({ rep, roles: (rep.roles ?? []).filter((r) => visibleRoles.includes(r)) }))
    .filter(({ roles }) => roles.length > 0);
  if (reps.length === 0) return null;

  return (
    <div className="space-y-2">
      {reps.map(({ rep, roles }) => {
        const cleanPhone = rep.phone.replace(/\D/g, "");
        const whatsappNumber = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;

        return (
          <div key={rep.id} className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 px-4 py-2.5">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="flex items-center gap-2">
                <IconUser className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate text-sm font-semibold text-foreground">{rep.name}</span>
              </span>
              <span className="pl-6 text-xs text-muted-foreground">
                {roles.map((r) => RESPONSIBLE_ROLE_LABELS[r]).join(" · ")}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-3">
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
