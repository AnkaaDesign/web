import React from "react";
import type { Representative } from "@/types/representative";
import {
  REPRESENTATIVE_ROLE_LABELS,
  REPRESENTATIVE_ROLE_COLORS,
} from "@/types/representative";
import { Badge } from "@/components/ui/badge";
import { CustomerLogoDisplay } from "@/components/ui/avatar-display";
import { formatBrazilianPhone, formatDateTime } from "@/utils";

export interface RepresentativeColumn {
  key: string;
  header: string;
  accessor: (representative: Representative) => React.ReactNode;
  sortable?: boolean;
  align?: "left" | "center" | "right";
  className?: string;
}

export function createRepresentativeColumns(): RepresentativeColumn[] {
  return [
    {
      key: "name",
      header: "NOME",
      accessor: (representative) => (
        <span className="font-medium truncate max-w-[200px] block">{representative.name}</span>
      ),
      sortable: true,
      className: "min-w-[200px]",
      align: "left",
    },
    {
      key: "role",
      header: "FUNÇÃO",
      accessor: (representative) => (
        <Badge
          variant={REPRESENTATIVE_ROLE_COLORS[representative.role] as any}
          className="text-xs"
        >
          {REPRESENTATIVE_ROLE_LABELS[representative.role]}
        </Badge>
      ),
      sortable: false,
      className: "min-w-[120px]",
      align: "left",
    },
    {
      key: "customer",
      header: "CLIENTE",
      accessor: (representative) => (
        <div className="text-sm">
          {representative.customer?.fantasyName ? (
            <div className="flex items-center gap-2">
              <CustomerLogoDisplay
                logo={representative.customer.logo}
                customerName={representative.customer.fantasyName}
                size="sm"
                shape="rounded"
                className="flex-shrink-0"
              />
              <span className="truncate max-w-[200px]">{representative.customer.fantasyName}</span>
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
      accessor: (representative) => (
        <div className="text-sm">
          {representative.phone ? (
            <span>{formatBrazilianPhone(representative.phone)}</span>
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
      key: "email",
      header: "E-MAIL",
      accessor: (representative) => (
        <div className="text-sm">
          {representative.email ? (
            <a
              href={`mailto:${representative.email}`}
              className="text-green-600 dark:text-green-600 hover:text-green-700 dark:hover:text-green-500 hover:underline truncate block max-w-[200px]"
              onClick={(e) => e.stopPropagation()}
            >
              {representative.email}
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
      accessor: (representative) => {
        const hasSystemAccess = !!representative.email && !!representative.password;
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
      accessor: (representative) => (
        <Badge
          variant={representative.isActive ? "success" : "secondary"}
          className="text-xs"
        >
          {representative.isActive ? "Ativo" : "Inativo"}
        </Badge>
      ),
      sortable: true,
      className: "min-w-[100px]",
      align: "left",
    },
    {
      key: "createdAt",
      header: "CRIADO EM",
      accessor: (representative) => (
        <div className="text-sm">
          {representative.createdAt ? (
            formatDateTime(new Date(representative.createdAt))
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
export const DEFAULT_VISIBLE_COLUMNS = new Set(["name", "role", "customer", "phone", "email", "isActive"]);
