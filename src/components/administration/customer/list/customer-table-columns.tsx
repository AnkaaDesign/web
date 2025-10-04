import type { Customer } from "../../../../types";
import { formatCNPJ, formatCPF, formatPhone, formatDateTime } from "../../../../utils";
import { Badge } from "@/components/ui/badge";

export interface CustomerColumn {
  key: string;
  header: string;
  accessor: (customer: Customer) => React.ReactNode;
  sortable?: boolean;
  align?: "left" | "center" | "right";
  className?: string;
}

export function createCustomerColumns(): CustomerColumn[] {
  return [
    {
      key: "fantasyName",
      header: "NOME FANTASIA",
      accessor: (customer) => (
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center flex-shrink-0 border border-border/50">
            <span className="text-xs font-semibold text-muted-foreground">{customer.fantasyName?.charAt(0)?.toUpperCase() || "?"}</span>
          </div>
          <span className="font-medium truncate max-w-[200px]">{customer.fantasyName}</span>
        </div>
      ),
      sortable: true,
      className: "min-w-[250px]",
      align: "left",
    },
    {
      key: "document",
      header: "DOCUMENTO",
      accessor: (customer) => {
        if (customer.cnpj) {
          return <div className="text-sm">{formatCNPJ(customer.cnpj)}</div>;
        }
        if (customer.cpf) {
          return <div className="text-sm">{formatCPF(customer.cpf)}</div>;
        }
        return <span className="text-muted-foreground">-</span>;
      },
      sortable: false,
      className: "min-w-[150px]",
      align: "left",
    },
    {
      key: "corporateName",
      header: "RAZÃO SOCIAL",
      accessor: (customer) => (
        <div className="text-sm">
          {customer.corporateName ? <span className="truncate max-w-[200px] block">{customer.corporateName}</span> : <span className="text-muted-foreground">-</span>}
        </div>
      ),
      sortable: true,
      className: "min-w-[200px]",
      align: "left",
    },
    {
      key: "email",
      header: "E-MAIL",
      accessor: (customer) => (
        <div className="text-sm">
          {customer.email ? (
            <a
              href={`mailto:${customer.email}`}
              className="text-green-600 dark:text-green-600 hover:text-green-700 dark:hover:text-green-500 hover:underline truncate block max-w-[200px]"
              onClick={(e) => e.stopPropagation()}
            >
              {customer.email}
            </a>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </div>
      ),
      sortable: true,
      className: "min-w-[200px]",
      align: "left",
    },
    {
      key: "phones",
      header: "TELEFONES",
      accessor: (customer) => {
        if (customer.phones && customer.phones.length > 0) {
          const mainPhone = formatPhone(customer.phones[0]);
          const otherCount = customer.phones.length - 1;

          return (
            <div className="flex items-center gap-1.5">
              <span className="text-sm">{mainPhone}</span>
              {otherCount > 0 && (
                <Badge variant="secondary" className="text-xs px-1.5 h-5">
                  +{otherCount}
                </Badge>
              )}
            </div>
          );
        }
        return <span className="text-muted-foreground">-</span>;
      },
      sortable: false,
      className: "min-w-[140px]",
      align: "left",
    },
    {
      key: "city",
      header: "CIDADE",
      accessor: (customer) => {
        if (customer.city && customer.state) {
          return (
            <div className="text-sm">
              <span className="truncate max-w-[150px] block">{`${customer.city}/${customer.state}`}</span>
            </div>
          );
        }
        if (customer.city) {
          return (
            <div className="text-sm">
              <span className="truncate max-w-[150px] block">{customer.city}</span>
            </div>
          );
        }
        return <span className="text-muted-foreground">-</span>;
      },
      sortable: true,
      className: "min-w-[150px]",
      align: "left",
    },
    {
      key: "tags",
      header: "TAGS",
      accessor: (customer) => {
        if (customer.tags && customer.tags.length > 0) {
          return (
            <div className="flex flex-wrap gap-1">
              {customer.tags.slice(0, 2).map((tag, index) => (
                <Badge key={index} variant="outline" className="text-xs h-5">
                  {tag}
                </Badge>
              ))}
              {customer.tags.length > 2 && (
                <Badge variant="secondary" className="text-xs px-1.5 h-5">
                  +{customer.tags.length - 2}
                </Badge>
              )}
            </div>
          );
        }
        return <span className="text-muted-foreground">-</span>;
      },
      sortable: false,
      className: "min-w-[120px]",
      align: "left",
    },
    {
      key: "taskCount",
      header: "TAREFAS",
      accessor: (customer) => {
        const count = customer._count?.tasks || 0;
        return (
          <Badge variant={count > 0 ? "default" : "secondary"} className="min-w-[2rem] justify-center">
            {count}
          </Badge>
        );
      },
      sortable: false,
      align: "center",
      className: "min-w-[80px]",
    },
    {
      key: "createdAt",
      header: "CADASTRADO EM",
      accessor: (customer) => <div className="text-sm">{customer.createdAt ? formatDateTime(new Date(customer.createdAt)) : <span className="text-muted-foreground">-</span>}</div>,
      sortable: true,
      className: "min-w-[180px]",
      align: "left",
    },
  ];
}

// Export the default visible columns
export const DEFAULT_VISIBLE_COLUMNS = new Set(["fantasyName", "document", "email", "phones", "city", "taskCount"]);
