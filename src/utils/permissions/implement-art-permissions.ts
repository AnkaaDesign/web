/**
 * Quem age sobre a ARTE e o PROJETO do implemento — espelho dos `@Roles` de
 * `implement.controller.ts` na API (`IMPLEMENT_ART_EDIT_ROLES`,
 * `IMPLEMENT_ART_DECIDE_ROLES`, `IMPLEMENT_PROJECT_ROLES`). A tela só esconde o
 * botão; quem recusa é a API.
 */
import { SECTOR_PRIVILEGES } from "@/constants/enums";
import { hasAnyPrivilege } from "@/utils/user";

type PrivilegeUser = Parameters<typeof hasAnyPrivilege>[0];

/** Subir, enviar ao cliente, versão nova, lote e apagar rascunho: quem faz a arte e quem fala com o cliente. */
const ART_EDIT = [SECTOR_PRIVILEGES.DESIGNER, SECTOR_PRIVILEGES.COMMERCIAL, SECTOR_PRIVILEGES.ADMIN];

/** Aprovar em nome do cliente e reprovar (nota obrigatória). */
const ART_DECIDE = [SECTOR_PRIVILEGES.COMMERCIAL, SECTOR_PRIVILEGES.ADMIN];

/** O projeto do implemento (PDFs do fabricante). */
const PROJECT_EDIT = [
  SECTOR_PRIVILEGES.COMMERCIAL,
  SECTOR_PRIVILEGES.LOGISTIC,
  SECTOR_PRIVILEGES.DESIGNER,
  SECTOR_PRIVILEGES.ADMIN,
];

export function canEditImplementArt(user: PrivilegeUser | null | undefined): boolean {
  return !!user && hasAnyPrivilege(user, ART_EDIT);
}

export function canDecideImplementArt(user: PrivilegeUser | null | undefined): boolean {
  return !!user && hasAnyPrivilege(user, ART_DECIDE);
}

export function canEditImplementProject(user: PrivilegeUser | null | undefined): boolean {
  return !!user && hasAnyPrivilege(user, PROJECT_EDIT);
}
