import { Badge } from "@/components/ui/badge";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import { formatCPF, formatBrazilianPhone } from "@/utils/formatters";
import { formatDate, formatDateTime } from "@/utils/date";
import { getCollaboratorStatus } from "@/utils/user";
import {
  SECTOR_PRIVILEGES,
  SHIRT_SIZE_LABELS,
  PANTS_SIZE_LABELS,
  BOOT_SIZE_LABELS,
  SLEEVES_SIZE_LABELS,
  MASK_SIZE_LABELS,
  GLOVES_SIZE_LABELS,
  RAIN_BOOTS_SIZE_LABELS,
  CONTRACT_TYPE_LABELS,
  EMPLOYEE_TYPE_LABELS,
  TERMINATION_TYPE_LABELS,
} from "@/constants";
import type { User } from "@/types";
import type { DataTableColumnDef, PersistedTableConfig } from "@/components/ui/datatable";
import { getDocumentProgress } from "@/components/personnel-department/admission/utils";
import { DocumentProgressBar } from "@/components/personnel-department/admission/document-progress";

/**
 * Sensitive (payroll / folha) HR fields — gated to the HR back-office sectors. ADMIN always passes
 * in the DataTable engine, so it sees them too. A gated column is removed entirely (header, cells,
 * the column-visibility option AND export) for everyone else.
 */
const HR_VIEWERS = [SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.ADMIN];

const dash = <span className="text-muted-foreground">-</span>;

function muted(value: string | null | undefined) {
  return value ? <span className="text-sm truncate">{value}</span> : dash;
}

function sizeCell(value: string | null | undefined, labels: Record<string, string>) {
  return value ? <span className="text-sm truncate">{labels[value] ?? value}</span> : dash;
}

/**
 * The full collaborator/user column set as generic `DataTableColumnDef`s for the new DataTable.
 * Faithful reproduction of the legacy table columns + a comprehensive set of additional
 * user/collaborator fields (default-hidden, gated where sensitive). Every `accessorFn` column
 * carries `meta.exportValue` so it stays searchable + exportable.
 */
export function createUserColumns(): DataTableColumnDef<User>[] {
  return [
    // --- Identity -----------------------------------------------------------
    {
      id: "payrollNumber",
      header: "Nº Folha",
      accessorFn: (u) => u.payrollNumber ?? "",
      enableSorting: true,
      size: 120,
      minSize: 90,
      meta: { headerLabel: "Nº Folha", exportValue: (u) => u.payrollNumber ?? "" },
      cell: ({ row }) => muted(row.original.payrollNumber != null ? String(row.original.payrollNumber) : null),
    },
    {
      id: "name",
      header: "Nome",
      accessorKey: "name",
      enableSorting: true,
      size: 260,
      minSize: 200,
      meta: { headerLabel: "Nome" },
      cell: ({ getValue }) => <TruncatedTextWithTooltip text={(getValue() as string) || "-"} className="truncate font-medium" />,
    },
    {
      id: "email",
      header: "Email",
      accessorFn: (u) => u.email || "",
      enableSorting: true,
      size: 220,
      meta: { headerLabel: "Email", exportValue: (u) => u.email || "" },
      cell: ({ row }) =>
        row.original.email ? (
          <a
            href={`mailto:${row.original.email}`}
            className="text-green-600 dark:text-green-600 hover:text-green-700 dark:hover:text-green-500 hover:underline truncate block text-sm"
            onClick={(e) => e.stopPropagation()}
            title={row.original.email}
          >
            {row.original.email}
          </a>
        ) : (
          dash
        ),
    },
    {
      id: "phone",
      header: "Telefone",
      accessorFn: (u) => u.phone || "",
      enableSorting: true,
      size: 150,
      meta: {
        headerLabel: "Telefone",
        exportValue: (u) => (u.phone ? formatBrazilianPhone(u.phone) : ""),
      },
      cell: ({ row }) => muted(row.original.phone ? formatBrazilianPhone(row.original.phone) : null),
    },
    {
      id: "cpf",
      header: "CPF",
      accessorFn: (u) => u.cpf || "",
      enableSorting: true,
      size: 150,
      meta: { headerLabel: "CPF", exportValue: (u) => (u.cpf ? formatCPF(u.cpf) : "") },
      cell: ({ row }) => muted(row.original.cpf ? formatCPF(row.original.cpf) : null),
    },
    {
      id: "pis",
      header: "PIS",
      accessorFn: (u) => u.pis || "",
      enableSorting: true,
      size: 150,
      meta: { headerLabel: "PIS", exportValue: (u) => u.pis || "" },
      cell: ({ row }) => muted(row.original.pis),
    },

    // --- Job ----------------------------------------------------------------
    {
      id: "position",
      header: "Cargo",
      accessorFn: (u) => u.position?.name || "",
      enableSorting: true,
      size: 170,
      meta: { headerLabel: "Cargo", exportValue: (u) => u.position?.name || "" },
      cell: ({ row }) =>
        row.original.position?.name ? (
          <TruncatedTextWithTooltip text={row.original.position.name} className="truncate text-sm" />
        ) : (
          dash
        ),
    },
    {
      id: "sector",
      header: "Setor",
      accessorFn: (u) => u.sector?.name || "",
      enableSorting: true,
      size: 170,
      meta: { headerLabel: "Setor", exportValue: (u) => u.sector?.name || "" },
      cell: ({ row }) =>
        row.original.sector?.name ? (
          <TruncatedTextWithTooltip text={row.original.sector.name} className="truncate text-sm" />
        ) : (
          dash
        ),
    },
    // NEW: Setor Liderado (was export-only in the legacy table).
    {
      id: "ledSector",
      header: "Setor Liderado",
      accessorFn: (u) => u.ledSector?.name || "",
      enableSorting: true,
      size: 170,
      meta: { defaultVisible: false, headerLabel: "Setor Liderado", exportValue: (u) => u.ledSector?.name || "" },
      cell: ({ row }) =>
        row.original.ledSector?.name ? (
          <Badge variant="outline" className="truncate">
            {row.original.ledSector.name}
          </Badge>
        ) : (
          dash
        ),
    },

    // --- Documents / Tasks --------------------------------------------------
    {
      id: "documents",
      header: "Documentos",
      enableSorting: false,
      size: 170,
      meta: {
        headerLabel: "Documentos",
        exportValue: (u) => {
          const { done, total } = getDocumentProgress(u.admissions?.[0]?.documents);
          return total === 0 ? "" : `${done}/${total}`;
        },
      },
      cell: ({ row }) => {
        const { done, total } = getDocumentProgress(row.original.admissions?.[0]?.documents);
        if (total === 0) return <span className="text-sm text-muted-foreground">-</span>;
        return <DocumentProgressBar done={done} total={total} />;
      },
    },
    {
      id: "tasksCount",
      header: "Tarefas",
      accessorFn: (u) => u._count?.createdTasks ?? 0,
      enableSorting: true,
      size: 110,
      meta: { align: "left", headerLabel: "Tarefas", exportValue: (u) => u._count?.createdTasks ?? 0 },
      cell: ({ row }) => (
        <Badge variant="default" className="inline-flex items-center justify-center min-w-[2.5rem] px-1.5 tabular-nums leading-none">
          {row.original._count?.createdTasks || 0}
        </Badge>
      ),
    },

    // --- Status / Contract --------------------------------------------------
    {
      id: "currentContractStatus",
      header: "Situação",
      accessorFn: (u) => getCollaboratorStatus(u).label,
      enableSorting: true,
      size: 250,
      meta: { headerLabel: "Situação", exportValue: (u) => getCollaboratorStatus(u).label },
      cell: ({ row }) => {
        const { label, variant } = getCollaboratorStatus(row.original);
        return (
          <Badge variant={variant} className="text-xs whitespace-nowrap">
            {label}
          </Badge>
        );
      },
    },
    {
      id: "currentContractType",
      header: "Modalidade",
      accessorFn: (u) => (u.currentContractType ? CONTRACT_TYPE_LABELS[u.currentContractType] : ""),
      enableSorting: true,
      size: 200,
      meta: {
        headerLabel: "Modalidade",
        exportValue: (u) => (u.currentContractType ? CONTRACT_TYPE_LABELS[u.currentContractType] : ""),
      },
      cell: ({ row }) =>
        row.original.currentContractType ? (
          <Badge variant="outline" className="text-xs whitespace-nowrap">
            {CONTRACT_TYPE_LABELS[row.original.currentContractType]}
          </Badge>
        ) : (
          dash
        ),
    },
    // NEW: Categoria (worker category — EMPLOYEE_TYPE).
    {
      id: "employeeType",
      header: "Categoria",
      accessorFn: (u) => (u.currentEmployeeType ? EMPLOYEE_TYPE_LABELS[u.currentEmployeeType] : ""),
      enableSorting: true,
      size: 160,
      meta: {
        defaultVisible: false,
        headerLabel: "Categoria",
        exportValue: (u) => (u.currentEmployeeType ? EMPLOYEE_TYPE_LABELS[u.currentEmployeeType] : ""),
      },
      cell: ({ row }) =>
        row.original.currentEmployeeType ? (
          <Badge variant="outline" className="text-xs whitespace-nowrap">
            {EMPLOYEE_TYPE_LABELS[row.original.currentEmployeeType]}
          </Badge>
        ) : (
          dash
        ),
    },
    {
      id: "performanceLevel",
      header: "Nível de Performance",
      accessorFn: (u) => u.performanceLevel ?? 0,
      enableSorting: true,
      size: 180,
      meta: { headerLabel: "Nível de Performance", exportValue: (u) => u.performanceLevel ?? 0 },
      cell: ({ row }) => (
        <Badge variant="default" className="inline-flex items-center justify-center min-w-[2.5rem] px-1.5 tabular-nums leading-none">
          {row.original.performanceLevel || 0}
        </Badge>
      ),
    },

    // --- Dates --------------------------------------------------------------
    {
      id: "birth",
      header: "Data de Nascimento",
      accessorFn: (u) => (u.birth ? new Date(u.birth).getTime() : 0),
      enableSorting: true,
      size: 170,
      meta: { defaultVisible: false, headerLabel: "Data de Nascimento", exportValue: (u) => (u.birth ? new Date(u.birth) : null) },
      cell: ({ row }) => muted(row.original.birth ? formatDate(new Date(row.original.birth)) : null),
    },
    // NEW: Data de Admissão (from the current EmploymentContract).
    {
      id: "admissionDate",
      header: "Data de Admissão",
      accessorFn: (u) => (u.currentContract?.admissionDate ? new Date(u.currentContract.admissionDate).getTime() : 0),
      enableSorting: true,
      size: 170,
      meta: {
        defaultVisible: false,
        headerLabel: "Data de Admissão",
        exportValue: (u) => (u.currentContract?.admissionDate ? new Date(u.currentContract.admissionDate) : null),
      },
      cell: ({ row }) => muted(row.original.currentContract?.admissionDate ? formatDate(new Date(row.original.currentContract.admissionDate)) : null),
    },
    // NEW: Fim da Experiência (exp1EndAt — the "contratação" date used by the legacy filter).
    {
      id: "exp1EndAt",
      header: "Fim da Experiência",
      accessorFn: (u) => (u.currentContract?.exp1EndAt ? new Date(u.currentContract.exp1EndAt).getTime() : 0),
      enableSorting: true,
      size: 170,
      meta: {
        defaultVisible: false,
        headerLabel: "Fim da Experiência",
        exportValue: (u) => (u.currentContract?.exp1EndAt ? new Date(u.currentContract.exp1EndAt) : null),
      },
      cell: ({ row }) => muted(row.original.currentContract?.exp1EndAt ? formatDate(new Date(row.original.currentContract.exp1EndAt)) : null),
    },
    // NEW: Data de Efetivação (effectedAt).
    {
      id: "effectedAt",
      header: "Data de Efetivação",
      accessorFn: (u) => (u.currentContract?.effectedAt ? new Date(u.currentContract.effectedAt).getTime() : 0),
      enableSorting: true,
      size: 170,
      meta: {
        defaultVisible: false,
        headerLabel: "Data de Efetivação",
        exportValue: (u) => (u.currentContract?.effectedAt ? new Date(u.currentContract.effectedAt) : null),
      },
      cell: ({ row }) => muted(row.original.currentContract?.effectedAt ? formatDate(new Date(row.original.currentContract.effectedAt)) : null),
    },
    {
      id: "dismissedAt",
      header: "Data de Demissão",
      accessorFn: (u) => (u.currentContract?.terminationDate ? new Date(u.currentContract.terminationDate).getTime() : 0),
      enableSorting: true,
      size: 170,
      meta: {
        defaultVisible: false,
        headerLabel: "Data de Demissão",
        exportValue: (u) => (u.currentContract?.terminationDate ? new Date(u.currentContract.terminationDate) : null),
      },
      cell: ({ row }) => muted(row.original.currentContract?.terminationDate ? formatDate(new Date(row.original.currentContract.terminationDate)) : null),
    },
    // NEW: Tipo de Demissão (terminationType).
    {
      id: "terminationType",
      header: "Tipo de Demissão",
      accessorFn: (u) => (u.currentContract?.terminationType ? TERMINATION_TYPE_LABELS[u.currentContract.terminationType] : ""),
      enableSorting: true,
      size: 200,
      meta: {
        defaultVisible: false,
        headerLabel: "Tipo de Demissão",
        exportValue: (u) => (u.currentContract?.terminationType ? TERMINATION_TYPE_LABELS[u.currentContract.terminationType] : ""),
      },
      cell: ({ row }) =>
        row.original.currentContract?.terminationType ? (
          <Badge variant="outline" className="text-xs whitespace-nowrap">
            {TERMINATION_TYPE_LABELS[row.original.currentContract.terminationType]}
          </Badge>
        ) : (
          dash
        ),
    },
    {
      id: "lastLoginAt",
      header: "Último Login",
      accessorFn: (u) => (u.lastLoginAt ? new Date(u.lastLoginAt).getTime() : 0),
      enableSorting: true,
      size: 180,
      meta: { defaultVisible: false, headerLabel: "Último Login", exportValue: (u) => (u.lastLoginAt ? new Date(u.lastLoginAt) : null) },
      cell: ({ row }) => muted(row.original.lastLoginAt ? formatDateTime(new Date(row.original.lastLoginAt)) : null),
    },
    {
      id: "createdAt",
      header: "Data de Criação",
      accessorFn: (u) => (u.createdAt ? new Date(u.createdAt).getTime() : 0),
      enableSorting: true,
      size: 180,
      meta: { defaultVisible: false, headerLabel: "Data de Criação", exportValue: (u) => (u.createdAt ? new Date(u.createdAt) : null) },
      cell: ({ row }) => muted(row.original.createdAt ? formatDateTime(new Date(row.original.createdAt)) : null),
    },
    {
      id: "updatedAt",
      header: "Última Atualização",
      accessorFn: (u) => (u.updatedAt ? new Date(u.updatedAt).getTime() : 0),
      enableSorting: true,
      size: 180,
      meta: { defaultVisible: false, headerLabel: "Última Atualização", exportValue: (u) => (u.updatedAt ? new Date(u.updatedAt) : null) },
      cell: ({ row }) => muted(row.original.updatedAt ? formatDateTime(new Date(row.original.updatedAt)) : null),
    },

    // --- Flags --------------------------------------------------------------
    {
      id: "verified",
      header: "Verificado",
      accessorFn: (u) => (u.verified ? "Sim" : "Não"),
      enableSorting: true,
      size: 120,
      meta: { defaultVisible: false, headerLabel: "Verificado", exportValue: (u) => (u.verified ? "Sim" : "Não") },
      cell: ({ row }) =>
        row.original.verified ? (
          <Badge variant="default" className="text-xs">
            Sim
          </Badge>
        ) : (
          <Badge variant="secondary" className="text-xs">
            Não
          </Badge>
        ),
    },
    // NEW: Requer Alteração de Senha (was export-only in the legacy table).
    {
      id: "requirePasswordChange",
      header: "Requer Nova Senha",
      accessorFn: (u) => (u.requirePasswordChange ? "Sim" : "Não"),
      enableSorting: true,
      size: 150,
      meta: { defaultVisible: false, headerLabel: "Requer Nova Senha", exportValue: (u) => (u.requirePasswordChange ? "Sim" : "Não") },
      cell: ({ row }) =>
        row.original.requirePasswordChange ? (
          <Badge variant="pending" className="text-xs">
            Sim
          </Badge>
        ) : (
          <Badge variant="secondary" className="text-xs">
            Não
          </Badge>
        ),
    },

    // --- PPE sizes ----------------------------------------------------------
    {
      id: "ppeShirts",
      header: "Camisa",
      accessorFn: (u) => u.ppeSize?.shirts || "",
      size: 90,
      meta: { defaultVisible: false, align: "center", headerLabel: "Camisa", exportValue: (u) => (u.ppeSize?.shirts ? SHIRT_SIZE_LABELS[u.ppeSize.shirts as keyof typeof SHIRT_SIZE_LABELS] ?? u.ppeSize.shirts : "") },
      cell: ({ row }) => sizeCell(row.original.ppeSize?.shirts, SHIRT_SIZE_LABELS),
    },
    {
      id: "ppePants",
      header: "Calça",
      accessorFn: (u) => u.ppeSize?.pants || "",
      size: 90,
      meta: { defaultVisible: false, align: "center", headerLabel: "Calça", exportValue: (u) => (u.ppeSize?.pants ? PANTS_SIZE_LABELS[u.ppeSize.pants as keyof typeof PANTS_SIZE_LABELS] ?? u.ppeSize.pants : "") },
      cell: ({ row }) => sizeCell(row.original.ppeSize?.pants, PANTS_SIZE_LABELS),
    },
    {
      id: "ppeBoots",
      header: "Bota",
      accessorFn: (u) => u.ppeSize?.boots || "",
      size: 90,
      meta: { defaultVisible: false, align: "center", headerLabel: "Bota", exportValue: (u) => (u.ppeSize?.boots ? BOOT_SIZE_LABELS[u.ppeSize.boots as keyof typeof BOOT_SIZE_LABELS] ?? u.ppeSize.boots : "") },
      cell: ({ row }) => sizeCell(row.original.ppeSize?.boots, BOOT_SIZE_LABELS),
    },
    {
      id: "ppeSleeves",
      header: "Manguito",
      accessorFn: (u) => u.ppeSize?.sleeves || "",
      size: 100,
      meta: { defaultVisible: false, align: "center", headerLabel: "Manguito", exportValue: (u) => (u.ppeSize?.sleeves ? SLEEVES_SIZE_LABELS[u.ppeSize.sleeves as keyof typeof SLEEVES_SIZE_LABELS] ?? u.ppeSize.sleeves : "") },
      cell: ({ row }) => sizeCell(row.original.ppeSize?.sleeves, SLEEVES_SIZE_LABELS),
    },
    {
      id: "ppeMask",
      header: "Máscara",
      accessorFn: (u) => u.ppeSize?.mask || "",
      size: 100,
      meta: { defaultVisible: false, align: "center", headerLabel: "Máscara", exportValue: (u) => (u.ppeSize?.mask ? MASK_SIZE_LABELS[u.ppeSize.mask as keyof typeof MASK_SIZE_LABELS] ?? u.ppeSize.mask : "") },
      cell: ({ row }) => sizeCell(row.original.ppeSize?.mask, MASK_SIZE_LABELS),
    },
    {
      id: "ppeGloves",
      header: "Luva",
      accessorFn: (u) => u.ppeSize?.gloves || "",
      size: 90,
      meta: { defaultVisible: false, align: "center", headerLabel: "Luva", exportValue: (u) => (u.ppeSize?.gloves ? GLOVES_SIZE_LABELS[u.ppeSize.gloves as keyof typeof GLOVES_SIZE_LABELS] ?? u.ppeSize.gloves : "") },
      cell: ({ row }) => sizeCell(row.original.ppeSize?.gloves, GLOVES_SIZE_LABELS),
    },
    {
      id: "ppeRainBoots",
      header: "Galocha",
      accessorFn: (u) => u.ppeSize?.rainBoots || "",
      size: 100,
      meta: { defaultVisible: false, align: "center", headerLabel: "Galocha", exportValue: (u) => (u.ppeSize?.rainBoots ? RAIN_BOOTS_SIZE_LABELS[u.ppeSize.rainBoots as keyof typeof RAIN_BOOTS_SIZE_LABELS] ?? u.ppeSize.rainBoots : "") },
      cell: ({ row }) => sizeCell(row.original.ppeSize?.rainBoots, RAIN_BOOTS_SIZE_LABELS),
    },

    // --- Address ------------------------------------------------------------
    {
      id: "city",
      header: "Cidade",
      accessorFn: (u) => u.city || "",
      enableSorting: true,
      size: 160,
      meta: { defaultVisible: false, headerLabel: "Cidade", exportValue: (u) => u.city || "" },
      cell: ({ row }) =>
        row.original.city ? <TruncatedTextWithTooltip text={row.original.city} className="truncate text-sm" /> : dash,
    },
    {
      id: "state",
      header: "Estado",
      accessorFn: (u) => u.state || "",
      enableSorting: true,
      size: 110,
      meta: { defaultVisible: false, headerLabel: "Estado", exportValue: (u) => u.state || "" },
      cell: ({ row }) => muted(row.original.state),
    },
    {
      id: "zipCode",
      header: "CEP",
      accessorFn: (u) => u.zipCode || "",
      enableSorting: true,
      size: 120,
      meta: { defaultVisible: false, headerLabel: "CEP", exportValue: (u) => u.zipCode || "" },
      cell: ({ row }) => muted(row.original.zipCode),
    },
    {
      id: "address",
      header: "Endereço",
      accessorFn: (u) => {
        if (!u.address) return "";
        let full = u.address;
        if (u.addressNumber) full += `, ${u.addressNumber}`;
        if (u.addressComplement) full += ` - ${u.addressComplement}`;
        return full;
      },
      size: 220,
      meta: {
        defaultVisible: false,
        headerLabel: "Endereço",
        exportValue: (u) => {
          if (!u.address) return "";
          let full = u.address;
          if (u.addressNumber) full += `, ${u.addressNumber}`;
          if (u.addressComplement) full += ` - ${u.addressComplement}`;
          return full;
        },
      },
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return v ? <TruncatedTextWithTooltip text={v} className="truncate text-sm" /> : dash;
      },
    },
    {
      id: "neighborhood",
      header: "Bairro",
      accessorFn: (u) => u.neighborhood || "",
      enableSorting: true,
      size: 160,
      meta: { defaultVisible: false, headerLabel: "Bairro", exportValue: (u) => u.neighborhood || "" },
      cell: ({ row }) =>
        row.original.neighborhood ? <TruncatedTextWithTooltip text={row.original.neighborhood} className="truncate text-sm" /> : dash,
    },
    // NEW: Site / rede social.
    {
      id: "site",
      header: "Site",
      accessorFn: (u) => u.site || "",
      size: 180,
      meta: { defaultVisible: false, headerLabel: "Site", exportValue: (u) => u.site || "" },
      cell: ({ row }) =>
        row.original.site ? <TruncatedTextWithTooltip text={row.original.site} className="truncate text-sm" /> : dash,
    },

    // --- Sensitive payroll fields (gated to HR / Accounting / Admin) --------
    // NEW: Matrícula (current contract registration number).
    {
      id: "matricula",
      header: "Matrícula",
      accessorFn: (u) => u.currentContract?.matricula ?? "",
      enableSorting: true,
      size: 130,
      meta: { defaultVisible: false, headerLabel: "Matrícula", requiredPrivilege: HR_VIEWERS, exportValue: (u) => u.currentContract?.matricula ?? "" },
      cell: ({ row }) => muted(row.original.currentContract?.matricula != null ? String(row.original.currentContract.matricula) : null),
    },
    // NEW: ID Secullum (time-clock integration id).
    {
      id: "secullumEmployeeId",
      header: "ID Secullum",
      accessorFn: (u) => u.secullumEmployeeId ?? "",
      enableSorting: true,
      size: 130,
      meta: { defaultVisible: false, headerLabel: "ID Secullum", requiredPrivilege: HR_VIEWERS, exportValue: (u) => u.secullumEmployeeId ?? "" },
      cell: ({ row }) => muted(row.original.secullumEmployeeId != null ? String(row.original.secullumEmployeeId) : null),
    },
    // NEW: Sindicalizado (union member).
    {
      id: "unionMember",
      header: "Sindicalizado",
      accessorFn: (u) => (u.unionMember ? "Sim" : "Não"),
      size: 140,
      meta: { defaultVisible: false, headerLabel: "Sindicalizado", requiredPrivilege: HR_VIEWERS, exportValue: (u) => (u.unionMember ? "Sim" : "Não") },
      cell: ({ row }) =>
        row.original.unionMember ? (
          <Badge variant="default" className="text-xs">
            Sim
          </Badge>
        ) : (
          <Badge variant="secondary" className="text-xs">
            Não
          </Badge>
        ),
    },
    // NEW: Dependentes (dependents count — drives IRRF/folha).
    {
      id: "dependentsCount",
      header: "Dependentes",
      accessorFn: (u) => u.dependentsCount ?? 0,
      enableSorting: true,
      size: 140,
      meta: { defaultVisible: false, align: "left", headerLabel: "Dependentes", requiredPrivilege: HR_VIEWERS, exportValue: (u) => u.dependentsCount ?? 0 },
      cell: ({ row }) => (
        <Badge variant="secondary" className="inline-flex items-center justify-center min-w-[2.5rem] px-1.5 tabular-nums leading-none">
          {row.original.dependentsCount ?? 0}
        </Badge>
      ),
    },
    // NEW: Desconto Simplificado (simplified IRRF deduction opt-in).
    {
      id: "hasSimplifiedDeduction",
      header: "Desconto Simplificado",
      accessorFn: (u) => (u.hasSimplifiedDeduction ? "Sim" : "Não"),
      size: 180,
      meta: { defaultVisible: false, headerLabel: "Desconto Simplificado", requiredPrivilege: HR_VIEWERS, exportValue: (u) => (u.hasSimplifiedDeduction ? "Sim" : "Não") },
      cell: ({ row }) =>
        row.original.hasSimplifiedDeduction ? (
          <Badge variant="default" className="text-xs">
            Sim
          </Badge>
        ) : (
          <Badge variant="secondary" className="text-xs">
            Não
          </Badge>
        ),
    },
  ];
}

// Every user-table column id, in authoring order — the basis for the per-sector default layout below.
const ALL_USER_COLUMN_IDS = [
  "payrollNumber", "name", "email", "phone", "cpf", "pis",
  "position", "sector", "ledSector",
  "documents", "tasksCount",
  "currentContractStatus", "currentContractType", "employeeType", "performanceLevel",
  "birth", "admissionDate", "exp1EndAt", "effectedAt", "dismissedAt", "terminationType",
  "lastLoginAt", "createdAt", "updatedAt",
  "verified", "requirePasswordChange",
  "ppeShirts", "ppePants", "ppeBoots", "ppeSleeves", "ppeMask", "ppeGloves", "ppeRainBoots",
  "city", "state", "zipCode", "address", "neighborhood", "site",
  "matricula", "secullumEmployeeId", "unionMember", "dependentsCount", "hasSimplifiedDeduction",
] as const;

/** Build a full table config (visibility + order) showing exactly `visible` (in that order), the rest
 *  hidden. Ids the sector can't access are filtered out by `requiredPrivilege` before the engine sees
 *  them, so listing a gated id here is harmless. */
function sectorConfig(visible: string[]): Partial<PersistedTableConfig> {
  const columnVisibility: Record<string, boolean> = {};
  for (const id of ALL_USER_COLUMN_IDS) columnVisibility[id] = visible.includes(id);
  return {
    columnOrder: [...visible, ...ALL_USER_COLUMN_IDS.filter((id) => !visible.includes(id))],
    columnVisibility,
  };
}

/**
 * Per-sector STARTING column layout — applied only when the user has no saved config. HR / Accounting
 * see the folha-oriented columns; the production-management sectors get the operational set. ADMIN has
 * no entry and falls back to the hardcoded `meta.defaultVisible` defaults.
 */
export const USER_TABLE_SECTOR_DEFAULTS: Partial<Record<SECTOR_PRIVILEGES, Partial<PersistedTableConfig>>> = {
  [SECTOR_PRIVILEGES.HUMAN_RESOURCES]: sectorConfig([
    "payrollNumber", "name", "cpf", "position", "sector", "currentContractStatus", "employeeType", "admissionDate", "documents",
  ]),
  [SECTOR_PRIVILEGES.ACCOUNTING]: sectorConfig([
    "payrollNumber", "name", "cpf", "position", "sector", "currentContractStatus", "employeeType", "admissionDate", "dismissedAt",
  ]),
  [SECTOR_PRIVILEGES.PRODUCTION_MANAGER]: sectorConfig([
    "name", "position", "sector", "currentContractStatus", "currentContractType", "performanceLevel", "tasksCount",
  ]),
};

// Default-visible column ids (mirrors the legacy `user-list-visible-columns-v4` defaults).
export const USER_TABLE_DEFAULT_VISIBLE = ["payrollNumber", "name", "position", "sector", "currentContractStatus", "documents"];
