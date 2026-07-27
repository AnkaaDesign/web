import React from "react";
import type { Responsible } from "@/types/responsible";
import {
  RESPONSIBLE_ROLE_LABELS,
  RESPONSIBLE_ROLE_COLORS,
  getResponsibleRoles,
} from "@/types/responsible";
import { Badge } from "@/components/ui/badge";
import { CustomerLogoDisplay } from "@/components/ui/avatar-display";
import { formatBrazilianPhone, formatCPF, formatDateTime } from "@/utils";

export interface ResponsibleColumn {
  key: string;
  header: string;
  accessor: (responsible: Responsible) => React.ReactNode;
  sortable?: boolean;
  align?: "left" | "center" | "right";
  className?: string;
}

export function createResponsibleColumns(): ResponsibleColumn[] {
  return [
    {
      key: "name",
      header: "NOME",
      accessor: (responsible) => (
        <span className="font-medium truncate max-w-[200px] block">{responsible.name}</span>
      ),
      sortable: true,
      className: "min-w-[200px]",
      align: "left",
    },
    {
      key: "role",
      header: "FUNÇÃO",
      accessor: (responsible) => (
        <div className="flex flex-wrap gap-1">
          {getResponsibleRoles(responsible).map((role) => (
            <Badge
              key={role}
              variant={RESPONSIBLE_ROLE_COLORS[role] as any}
              className="text-xs"
            >
              {RESPONSIBLE_ROLE_LABELS[role]}
            </Badge>
          ))}
        </div>
      ),
      sortable: false,
      className: "min-w-[120px]",
      align: "left",
    },
    {
      key: "company",
      header: "EMPRESA",
      accessor: (responsible) => (
        <div className="text-sm">
          {responsible.company?.corporateName || responsible.company?.fantasyName ? (
            <div className="flex items-center gap-2">
              <CustomerLogoDisplay
                logo={responsible.company.logo}
                customerName={responsible.company.corporateName || responsible.company.fantasyName}
                size="sm"
                shape="rounded"
                className="flex-shrink-0"
              />
              <span className="truncate max-w-[200px]">{responsible.company.corporateName || responsible.company.fantasyName}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </div>
      ),
      sortable: false,
      className: "min-w-[250px]",
      align: "left",
    },
    {
      key: "phone",
      header: "TELEFONE",
      accessor: (responsible) => (
        <div className="text-sm">
          {responsible.phone ? (
            <span>{formatBrazilianPhone(responsible.phone)}</span>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </div>
      ),
      sortable: false,
      className: "min-w-[140px]",
      align: "left",
    },
    {
      // CPF fica ao lado do telefone: os dois identificam a PESSOA, e é por eles
      // que a assinatura eletrônica confere quem assinou.
      key: "cpf",
      header: "CPF",
      accessor: (responsible) => (
        <div className="text-sm tabular-nums">
          {responsible.cpf ? (
            <span>{formatCPF(responsible.cpf)}</span>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </div>
      ),
      sortable: false,
      className: "min-w-[150px]",
      align: "left",
    },
    {
      key: "email",
      header: "E-MAIL",
      accessor: (responsible) => (
        <div className="text-sm">
          {responsible.email ? (
            <a
              href={`mailto:${responsible.email}`}
              className="text-green-600 dark:text-green-600 hover:text-green-700 dark:hover:text-green-500 hover:underline truncate block max-w-[200px]"
              onClick={(e) => e.stopPropagation()}
            >
              {responsible.email}
            </a>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </div>
      ),
      sortable: false,
      className: "min-w-[200px]",
      align: "left",
    },
    {
      key: "access",
      header: "ACESSO",
      accessor: (responsible) => {
        const hasSystemAccess = !!responsible.email && !!responsible.password;
        return (
          <div className="text-sm">
            {hasSystemAccess ? (
              <span className="text-green-600">Com acesso</span>
            ) : (
              <span className="text-muted-foreground">-</span>
            )}
          </div>
        );
      },
      sortable: false,
      className: "min-w-[100px]",
      align: "left",
    },
    {
      key: "isActive",
      header: "STATUS",
      accessor: (responsible) => (
        <Badge
          variant={responsible.isActive ? "success" : "secondary"}
          className="text-xs"
        >
          {responsible.isActive ? "Ativo" : "Inativo"}
        </Badge>
      ),
      sortable: true,
      className: "min-w-[100px]",
      align: "left",
    },
    {
      key: "createdAt",
      header: "CRIADO EM",
      accessor: (responsible) => (
        <div className="text-sm">
          {responsible.createdAt ? (
            formatDateTime(new Date(responsible.createdAt))
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </div>
      ),
      sortable: true,
      className: "min-w-[180px]",
      align: "left",
    },
  ];
}

// Export the default visible columns
export const DEFAULT_VISIBLE_COLUMNS = new Set(["name", "role", "company", "phone", "email", "isActive"]);
