import { formatCNPJ, formatBrazilianPhone } from "../../../../utils";
import type { Supplier } from "../../../../types";
import { Badge } from "../../../ui/badge";
import { TABLE_LAYOUT } from "../../../ui/table-constants";
import type { SupplierColumn } from "./types";
import { getFileUrl } from "@/utils/file";

export const createSupplierColumns = (): SupplierColumn[] => [
  // Basic Information (Primary columns - most commonly used)
  {
    key: "fantasyName",
    header: "NOME",
    accessor: (supplier: Supplier) => (
      <div className="flex items-center gap-2">
        {supplier.logo?.id ? (
          <img
            src={getFileUrl(supplier.logo)}
            alt={`${supplier.fantasyName} logo`}
            className="h-8 w-8 rounded-md object-cover flex-shrink-0 border border-border/50"
            onError={(e) => {
              // Hide image if it fails to load
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center flex-shrink-0 border border-border/50">
            <span className="text-xs font-semibold text-muted-foreground">{supplier.fantasyName.charAt(0).toUpperCase()}</span>
          </div>
        )}
        <span className="font-medium truncate">{supplier.fantasyName}</span>
      </div>
    ),
    sortable: true,
    className: TABLE_LAYOUT.firstDataColumn.className,
    align: "left",
  },
  {
    key: "corporateName",
    header: "RAZÃO SOCIAL",
    accessor: (supplier: Supplier) => <div className="truncate">{supplier.corporateName || "-"}</div>,
    sortable: true,
    className: "w-64",
    align: "left",
  },
  {
    key: "cnpj",
    header: "CNPJ",
    accessor: (supplier: Supplier) => <div className="text-sm truncate">{supplier.cnpj ? formatCNPJ(supplier.cnpj) : "-"}</div>,
    sortable: true,
    className: "w-32",
    align: "left",
  },

  // Contact Information (Essential for communication)
  {
    key: "email",
    header: "EMAIL",
    accessor: (supplier: Supplier) => (
      <div className="text-sm truncate">
        {supplier.email ? (
          <a
            href={`mailto:${supplier.email}`}
            className="text-green-600 dark:text-green-600 hover:text-green-700 dark:hover:text-green-500 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {supplier.email}
          </a>
        ) : (
          "-"
        )}
      </div>
    ),
    sortable: true,
    className: "w-48",
    align: "left",
  },
  {
    key: "phones",
    header: "TELEFONES",
    accessor: (supplier: Supplier) => {
      if (supplier.phones && supplier.phones.length > 0) {
        const mainPhone = formatBrazilianPhone(supplier.phones[0]);
        const otherCount = supplier.phones.length - 1;

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
    className: "w-44",
    align: "left",
  },
  {
    key: "site",
    header: "SITE",
    accessor: (supplier: Supplier) => (
      <div className="text-sm truncate">
        {supplier.site ? (
          <a
            href={supplier.site.startsWith("http") ? supplier.site : `https://${supplier.site}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-green-600 dark:text-green-600 hover:text-green-700 dark:hover:text-green-500 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {supplier.site}
          </a>
        ) : (
          "-"
        )}
      </div>
    ),
    sortable: true,
    className: "w-40",
    align: "left",
  },

  // Business Metrics (Important for business analysis)
  {
    key: "_count.items",
    header: "PRODUTOS",
    accessor: (supplier: Supplier) => (
      <div className="text-center">
        <Badge variant="secondary" className="text-xs">
          {supplier._count?.items || 0}
        </Badge>
      </div>
    ),
    sortable: true,
    className: "w-20",
    align: "center",
  },
  {
    key: "_count.orders",
    header: "PEDIDOS",
    accessor: (supplier: Supplier) => (
      <div className="text-center">
        <Badge variant="secondary" className="text-xs">
          {supplier._count?.orders || 0}
        </Badge>
      </div>
    ),
    sortable: true,
    className: "w-24",
    align: "center",
  },
  {
    key: "_count.orderRules",
    header: "REGRAS DE PEDIDO",
    accessor: (supplier: Supplier) => (
      <div className="text-center">
        <Badge variant="secondary" className="text-xs">
          {supplier._count?.orderRules || 0}
        </Badge>
      </div>
    ),
    sortable: true,
    className: "w-32",
    align: "center",
  },

  // Location Information (Secondary information)
  {
    key: "city",
    header: "CIDADE",
    accessor: (supplier: Supplier) => <div className="truncate">{supplier.city || "-"}</div>,
    sortable: true,
    className: "w-32",
    align: "left",
  },
  {
    key: "state",
    header: "ESTADO",
    accessor: (supplier: Supplier) => <div className="text-sm truncate">{supplier.state || "-"}</div>,
    sortable: true,
    className: "w-20",
    align: "left",
  },
  {
    key: "address",
    header: "ENDEREÇO",
    accessor: (supplier: Supplier) => {
      const fullAddress = [supplier.address, supplier.addressNumber, supplier.addressComplement].filter(Boolean).join(", ");
      return <div className="text-sm truncate">{fullAddress || "-"}</div>;
    },
    sortable: true,
    className: "w-56",
    align: "left",
  },
  {
    key: "neighborhood",
    header: "BAIRRO",
    accessor: (supplier: Supplier) => <div className="text-sm truncate">{supplier.neighborhood || "-"}</div>,
    sortable: true,
    className: "w-32",
    align: "left",
  },
  {
    key: "zipCode",
    header: "CEP",
    accessor: (supplier: Supplier) => <div className="font-mono text-sm truncate">{supplier.zipCode ? supplier.zipCode.replace(/(\d{5})(\d{3})/, "$1-$2") : "-"}</div>,
    sortable: true,
    className: "w-28",
    align: "left",
  },

  // Metadata (Timestamps - usually secondary importance)
  {
    key: "createdAt",
    header: "CRIADO EM",
    accessor: (supplier: Supplier) => <div className="text-sm text-muted-foreground">{new Date(supplier.createdAt).toLocaleDateString("pt-BR")}</div>,
    sortable: true,
    className: "w-32",
    align: "left",
  },
  {
    key: "updatedAt",
    header: "ATUALIZADO EM",
    accessor: (supplier: Supplier) => <div className="text-sm text-muted-foreground">{new Date(supplier.updatedAt).toLocaleDateString("pt-BR")}</div>,
    sortable: true,
    className: "w-32",
    align: "left",
  },
];
