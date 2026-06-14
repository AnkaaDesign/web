import React from "react";
import { formatDate } from "../../../../utils";
import { ADMISSION_STATUS_LABELS, CONTRACT_TYPE_LABELS } from "../../../../constants";
import type { ADMISSION_STATUS, CONTRACT_TYPE } from "../../../../constants";
import { Badge, getBadgeVariantFromStatus } from "@/components/ui/badge";
import type { Admission } from "../../../../types/admission";
import { getDocumentProgress } from "../utils";

export interface AdmissionColumn {
  key: string;
  header: string;
  accessor: (admission: Admission) => React.ReactNode;
  sortable?: boolean;
  className?: string;
  align?: "left" | "center" | "right";
}

export const createAdmissionColumns = (): AdmissionColumn[] => [
  // Colaborador
  {
    key: "user.name",
    header: "COLABORADOR",
    accessor: (admission: Admission) => (
      <div className="font-medium truncate" title={admission.user?.name}>
        {admission.user?.name || <span className="text-muted-foreground">-</span>}
      </div>
    ),
    sortable: true,
    // table-layout:fixed ignora min-width — é o `w-` que define a largura da coluna.
    className: "w-[360px] min-w-[360px]",
    align: "left",
  },

  // Tipo de Contrato (do colaborador)
  {
    key: "user.currentContractType",
    header: "TIPO DE CONTRATO",
    accessor: (admission: Admission) => {
      const contractType = admission.user?.currentContractType;
      if (!contractType) return <span className="text-muted-foreground">-</span>;
      return (
        <Badge variant={getBadgeVariantFromStatus(contractType, "USER")} className="text-xs whitespace-nowrap">
          {CONTRACT_TYPE_LABELS[contractType as CONTRACT_TYPE] || contractType}
        </Badge>
      );
    },
    sortable: false,
    className: "min-w-[180px]",
    align: "left",
  },

  // Status da admissão
  {
    key: "status",
    header: "STATUS",
    accessor: (admission: Admission) => (
      <Badge variant={getBadgeVariantFromStatus(admission.status, "ADMISSION")} className="text-xs whitespace-nowrap">
        {ADMISSION_STATUS_LABELS[admission.status as ADMISSION_STATUS] || admission.status}
      </Badge>
    ),
    sortable: true,
    className: "min-w-[190px]",
    align: "left",
  },

  // Data de Admissão
  {
    key: "hireDate",
    header: "DATA DE ADMISSÃO",
    accessor: (admission: Admission) => (
      <div className="text-sm truncate">{admission.hireDate ? formatDate(new Date(admission.hireDate)) : <span className="text-muted-foreground">-</span>}</div>
    ),
    sortable: true,
    className: "min-w-[160px]",
    align: "left",
  },

  // Documentos (progresso)
  {
    key: "documents",
    header: "DOCUMENTOS",
    accessor: (admission: Admission) => {
      const { done, total } = getDocumentProgress(admission.documents);
      if (total === 0) return <span className="text-sm text-muted-foreground">-</span>;
      return (
        <div className="text-sm whitespace-nowrap">
          <span className={done === total ? "font-medium text-green-700 dark:text-green-500" : "font-medium"}>
            {done}/{total}
          </span>{" "}
          <span className="text-xs text-muted-foreground">docs</span>
        </div>
      );
    },
    sortable: false,
    className: "min-w-[120px]",
    align: "left",
  },

  // Criado por
  {
    key: "createdBy.name",
    header: "CRIADO POR",
    accessor: (admission: Admission) => (
      <div className="text-sm truncate" title={admission.createdBy?.name}>
        {admission.createdBy?.name || <span className="text-muted-foreground">-</span>}
      </div>
    ),
    sortable: false,
    className: "min-w-[180px]",
    align: "left",
  },

  // Criado em
  {
    key: "createdAt",
    header: "CRIADO EM",
    accessor: (admission: Admission) => (
      <div className="text-sm truncate">{admission.createdAt ? formatDate(new Date(admission.createdAt)) : <span className="text-muted-foreground">-</span>}</div>
    ),
    sortable: true,
    className: "min-w-[140px]",
    align: "left",
  },
];

// Export the default visible columns
export const DEFAULT_ADMISSION_VISIBLE_COLUMNS = new Set(["user.name", "user.currentContractType", "status", "hireDate", "documents", "createdBy.name"]);
