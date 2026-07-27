import { responsibleService } from "@/services/responsibleService";
import type { ResponsibleRole, ResponsibleRowData } from "@/types/responsible";

/** Order-insensitive set comparison — the API stores roles in canonical order. */
function sameRoles(a: ResponsibleRole[] = [], b: ResponsibleRole[] = []): boolean {
  if (a.length !== b.length) return false;
  const left = [...a].sort();
  const right = [...b].sort();
  return left.every((role, i) => role === right[i]);
}

/**
 * Persists inline role edits made on already-registered contacts.
 *
 * The task/budget forms let you change the roles of a contact you picked from
 * the combobox. Those rows are NOT part of the task payload (only `newResponsibles`
 * is), so the change has to be written straight to the Responsible — which is
 * what makes it show up on the task, on the quote, and on every other task that
 * shares the contact.
 *
 * Rows are skipped unless they are an existing contact whose roles actually
 * differ from what was loaded; otherwise every save would PUT every contact and
 * spam the changelog. New rows are ignored — they carry their roles in the task
 * payload and are created by `processResponsibles`.
 *
 * Failures are collected and rethrown as one error so a partial sync is visible
 * rather than silent.
 */
export async function syncResponsibleRoles(rows: ResponsibleRowData[]): Promise<void> {
  const changed = rows.filter(
    (row) =>
      !row.isNew &&
      !!row.id &&
      !row.id.startsWith("temp-") &&
      (row.roles?.length ?? 0) > 0 &&
      !sameRoles(row.roles, row.originalRoles),
  );

  if (changed.length === 0) return;

  const failures: string[] = [];
  await Promise.all(
    changed.map(async (row) => {
      try {
        await responsibleService.update(row.id, { roles: row.roles });
      } catch (error: any) {
        failures.push(`${row.name || row.id}: ${error?.message || "erro desconhecido"}`);
      }
    }),
  );

  if (failures.length > 0) {
    throw new Error(`Falha ao atualizar funções dos responsáveis: ${failures.join("; ")}`);
  }
}
