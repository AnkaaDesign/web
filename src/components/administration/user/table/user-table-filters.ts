import {
  IconActivity,
  IconUser,
  IconId,
  IconBriefcase,
  IconBuilding,
  IconBuildingCommunity,
  IconCalendar,
  IconEye,
  IconLock,
} from "@tabler/icons-react";
import { createElement } from "react";
import {
  CONTRACT_TYPE_LABELS,
  CONTRACT_STATUS_LABELS,
  EMPLOYEE_TYPE_LABELS,
} from "@/constants";
import type { User } from "@/types";
import type { DataTableFilterDef, DataTableFilterOption } from "@/components/ui/datatable";

/** Build a sorted, de-duplicated `{value,label}` option list from a relation present on the loaded rows. */
function relationOptions(rows: User[], pick: (u: User) => { id?: string | null; name?: string | null } | undefined): DataTableFilterOption[] {
  const map = new Map<string, string>();
  for (const u of rows) {
    const rel = pick(u);
    if (rel?.id) map.set(rel.id, rel.name || rel.id);
  }
  return Array.from(map, ([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Declarative client-mode filters for the collaborator table. Faithful to the legacy filter sheet
 * (Situação, Modalidade, Categoria, Cargo, Setor, date ranges) plus a few extra useful predicates.
 * Cargo / Setor / Setor Liderado options are derived from the loaded rows (the active set).
 */
export function buildUserFilterDefs(rows: User[]): DataTableFilterDef<User>[] {
  return [
    {
      key: "currentContractStatus",
      label: "Situação",
      type: "multiselect",
      icon: createElement(IconActivity, { className: "h-4 w-4" }),
      options: Object.entries(CONTRACT_STATUS_LABELS).map(([value, label]) => ({ value, label })),
      accessor: (u) => u.currentContractStatus ?? "",
    },
    {
      key: "currentContractType",
      label: "Modalidade",
      type: "multiselect",
      icon: createElement(IconUser, { className: "h-4 w-4" }),
      options: Object.entries(CONTRACT_TYPE_LABELS).map(([value, label]) => ({ value, label })),
      accessor: (u) => u.currentContractType ?? "",
    },
    {
      key: "currentEmployeeType",
      label: "Categoria",
      type: "multiselect",
      icon: createElement(IconId, { className: "h-4 w-4" }),
      options: Object.entries(EMPLOYEE_TYPE_LABELS).map(([value, label]) => ({ value, label })),
      accessor: (u) => u.currentEmployeeType ?? "",
    },
    {
      key: "positionId",
      label: "Cargo",
      type: "multiselect",
      icon: createElement(IconBriefcase, { className: "h-4 w-4" }),
      options: relationOptions(rows, (u) => u.position),
      accessor: (u) => u.positionId ?? "",
    },
    {
      key: "sectorId",
      label: "Setor",
      type: "multiselect",
      icon: createElement(IconBuilding, { className: "h-4 w-4" }),
      options: relationOptions(rows, (u) => u.sector),
      accessor: (u) => u.sectorId ?? "",
    },
    {
      key: "ledSectorId",
      label: "Setor Liderado",
      type: "multiselect",
      icon: createElement(IconBuildingCommunity, { className: "h-4 w-4" }),
      options: relationOptions(rows, (u) => u.ledSector),
      accessor: (u) => u.ledSector?.id ?? "",
    },
    {
      key: "hasLedSector",
      label: "Lidera um setor",
      type: "boolean",
      icon: createElement(IconBuildingCommunity, { className: "h-4 w-4" }),
      accessor: (u) => !!u.ledSector?.id,
    },
    {
      key: "verified",
      label: "Verificado",
      type: "boolean",
      icon: createElement(IconEye, { className: "h-4 w-4" }),
      accessor: (u) => !!u.verified,
    },
    {
      key: "requirePasswordChange",
      label: "Requer Nova Senha",
      type: "boolean",
      icon: createElement(IconLock, { className: "h-4 w-4" }),
      accessor: (u) => !!u.requirePasswordChange,
    },
    {
      key: "birth",
      label: "Data de Nascimento",
      type: "date-range",
      icon: createElement(IconCalendar, { className: "h-4 w-4" }),
      accessor: (u) => u.birth ?? null,
    },
    {
      key: "admissionDate",
      label: "Data de Admissão",
      type: "date-range",
      icon: createElement(IconCalendar, { className: "h-4 w-4" }),
      accessor: (u) => u.currentContract?.admissionDate ?? null,
    },
    {
      key: "exp1EndAt",
      label: "Fim da Experiência",
      type: "date-range",
      icon: createElement(IconCalendar, { className: "h-4 w-4" }),
      accessor: (u) => u.currentContract?.exp1EndAt ?? null,
    },
    {
      key: "dismissedAt",
      label: "Data de Demissão",
      type: "date-range",
      icon: createElement(IconCalendar, { className: "h-4 w-4" }),
      accessor: (u) => u.currentContract?.terminationDate ?? null,
    },
    {
      key: "lastLoginAt",
      label: "Último Login",
      type: "date-range",
      icon: createElement(IconCalendar, { className: "h-4 w-4" }),
      accessor: (u) => u.lastLoginAt ?? null,
    },
    {
      key: "createdAt",
      label: "Data de Criação",
      type: "date-range",
      icon: createElement(IconCalendar, { className: "h-4 w-4" }),
      accessor: (u) => u.createdAt ?? null,
    },
  ];
}
