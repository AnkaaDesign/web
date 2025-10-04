import { formatCPF, formatPhone, formatDate, formatDateTime } from "../../../../utils";
import { USER_STATUS_LABELS } from "../../../../constants";
import { Badge, getBadgeVariantFromStatus } from "@/components/ui/badge";
import type { User } from "../../../../types";
import type { UserColumn } from "./types";

export const createUserColumns = (): UserColumn[] => [
  // Número da Folha (Payroll Number)
  {
    key: "payrollNumber",
    header: "Nº FOLHA",
    accessor: (user: User) => <div className="text-sm whitespace-nowrap">{user.payrollNumber || <span className="text-muted-foreground">-</span>}</div>,
    sortable: true,
    className: "w-32",
    align: "left",
  },

  // Nome (Name)
  {
    key: "name",
    header: "NOME",
    accessor: (user: User) => (
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center flex-shrink-0 border border-border/50">
          <span className="text-xs font-semibold text-muted-foreground">{user.name?.charAt(0)?.toUpperCase() || "?"}</span>
        </div>
        <span className="font-medium truncate max-w-[200px]">{user.name}</span>
      </div>
    ),
    sortable: true,
    className: "min-w-[250px]",
    align: "left",
  },

  // Email
  {
    key: "email",
    header: "EMAIL",
    accessor: (user: User) => (
      <div className="text-sm">
        {user.email ? (
          <a
            href={`mailto:${user.email}`}
            className="text-green-600 dark:text-green-600 hover:text-green-700 dark:hover:text-green-500 hover:underline truncate block max-w-[200px]"
            onClick={(e) => e.stopPropagation()}
          >
            {user.email}
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

  // Telefone (Phone)
  {
    key: "phone",
    header: "TELEFONE",
    accessor: (user: User) => <div className="text-sm">{user.phone ? formatPhone(user.phone) : <span className="text-muted-foreground">-</span>}</div>,
    sortable: true,
    className: "min-w-[140px]",
    align: "left",
  },

  // CPF
  {
    key: "cpf",
    header: "CPF",
    accessor: (user: User) => <div className="text-sm">{user.cpf ? formatCPF(user.cpf) : <span className="text-muted-foreground">-</span>}</div>,
    sortable: true,
    className: "min-w-[140px]",
    align: "left",
  },

  // PIS
  {
    key: "pis",
    header: "PIS",
    accessor: (user: User) => <div className="text-sm">{user.pis || <span className="text-muted-foreground">-</span>}</div>,
    sortable: true,
    className: "min-w-[140px]",
    align: "left",
  },

  // Cargo (Position)
  {
    key: "position.name",
    header: "CARGO",
    accessor: (user: User) => <div className="text-sm">{user.position?.name || <span className="text-muted-foreground">-</span>}</div>,
    sortable: true,
    className: "min-w-[150px]",
    align: "left",
  },

  // Setor (Sector)
  {
    key: "sector.name",
    header: "SETOR",
    accessor: (user: User) => <div className="text-sm">{user.sector?.name || <span className="text-muted-foreground">-</span>}</div>,
    sortable: true,
    className: "min-w-[150px]",
    align: "left",
  },

  // Total de Tarefas (Task Count)
  {
    key: "tasksCount",
    header: "TAREFAS",
    accessor: (user: User) => (
      <div className="text-sm text-center">
        <span className="inline-flex items-center justify-center min-w-[2rem] h-6 px-2 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium">
          {user._count?.createdTasks || 0}
        </span>
      </div>
    ),
    sortable: false,
    className: "w-24",
    align: "center",
  },

  // Total de Férias (Vacation Count)
  {
    key: "vacationsCount",
    header: "FÉRIAS",
    accessor: (user: User) => (
      <div className="text-sm text-center">
        <span className="inline-flex items-center justify-center min-w-[2rem] h-6 px-2 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs font-medium">
          {user._count?.vacations || 0}
        </span>
      </div>
    ),
    sortable: false,
    className: "w-24",
    align: "center",
  },


  // Data de Admissão (Admissional Date)
  {
    key: "admissional",
    header: "DATA DE ADMISSÃO",
    accessor: (user: User) => <div className="text-sm">{user.admissional ? formatDate(new Date(user.admissional)) : <span className="text-muted-foreground">-</span>}</div>,
    sortable: true,
    className: "min-w-[150px]",
    align: "left",
  },

  // Data de Nascimento (Birth Date)
  {
    key: "birthDate",
    header: "DATA DE NASCIMENTO",
    accessor: (user: User) => <div className="text-sm">{user.birthDate ? formatDate(new Date(user.birthDate)) : <span className="text-muted-foreground">-</span>}</div>,
    sortable: true,
    className: "min-w-[150px]",
    align: "left",
  },

  // Data de Demissão (Dismissal Date)
  {
    key: "dismissal",
    header: "DATA DE DEMISSÃO",
    accessor: (user: User) => <div className="text-sm">{user.dismissal ? formatDate(new Date(user.dismissal)) : <span className="text-muted-foreground">-</span>}</div>,
    sortable: true,
    className: "min-w-[150px]",
    align: "left",
  },

  // Status
  {
    key: "status",
    header: "STATUS",
    accessor: (user: User) => {
      const variant = getBadgeVariantFromStatus(user.status, "USER");

      return (
        <Badge variant={variant} className="text-xs">
          {USER_STATUS_LABELS[user.status]}
        </Badge>
      );
    },
    sortable: true,
    className: "min-w-[200px]",
    align: "left",
  },

  // Nível de Performance (Performance Level)
  {
    key: "performanceLevel",
    header: "NÍVEL DE PERFORMANCE",
    accessor: (user: User) => (
      <div className="text-sm text-center">
        <span className="inline-flex items-center justify-center min-w-[2rem] h-6 px-2 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs font-medium">
          {user.performanceLevel || 0}
        </span>
      </div>
    ),
    sortable: true,
    className: "min-w-[180px]",
    align: "center",
  },

  // Verificado (Verified)
  {
    key: "verified",
    header: "VERIFICADO",
    accessor: (user: User) => (
      <div className="text-sm text-center">
        {user.verified ? (
          <Badge variant="default" className="text-xs">
            Sim
          </Badge>
        ) : (
          <Badge variant="secondary" className="text-xs">
            Não
          </Badge>
        )}
      </div>
    ),
    sortable: true,
    className: "min-w-[120px]",
    align: "center",
  },

  // Último Login (Last Login)
  {
    key: "lastLoginAt",
    header: "ÚLTIMO LOGIN",
    accessor: (user: User) => <div className="text-sm">{user.lastLoginAt ? formatDateTime(new Date(user.lastLoginAt)) : <span className="text-muted-foreground">-</span>}</div>,
    sortable: true,
    className: "min-w-[180px]",
    align: "left",
  },

  // Setor Gerenciado (Managed Sector)
  {
    key: "managedSector.name",
    header: "SETOR GERENCIADO",
    accessor: (user: User) => <div className="text-sm">{user.managedSector?.name || <span className="text-muted-foreground">-</span>}</div>,
    sortable: true,
    className: "min-w-[150px]",
    align: "left",
  },

  // Cidade (City)
  {
    key: "city",
    header: "CIDADE",
    accessor: (user: User) => <div className="text-sm">{user.city || <span className="text-muted-foreground">-</span>}</div>,
    sortable: true,
    className: "min-w-[150px]",
    align: "left",
  },

  // Estado (State)
  {
    key: "state",
    header: "ESTADO",
    accessor: (user: User) => <div className="text-sm">{user.state || <span className="text-muted-foreground">-</span>}</div>,
    sortable: true,
    className: "min-w-[100px]",
    align: "left",
  },

  // CEP (Zip Code)
  {
    key: "zipCode",
    header: "CEP",
    accessor: (user: User) => <div className="text-sm">{user.zipCode || <span className="text-muted-foreground">-</span>}</div>,
    sortable: true,
    className: "min-w-[120px]",
    align: "left",
  },

  // Endereço (Address)
  {
    key: "address",
    header: "ENDEREÇO",
    accessor: (user: User) => (
      <div className="text-sm">
        {user.address ? (
          <span className="truncate max-w-[200px] block" title={`${user.address}${user.addressNumber ? `, ${user.addressNumber}` : ""}${user.addressComplement ? ` - ${user.addressComplement}` : ""}`}>
            {user.address}
            {user.addressNumber ? `, ${user.addressNumber}` : ""}
            {user.addressComplement ? ` - ${user.addressComplement}` : ""}
          </span>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </div>
    ),
    sortable: true,
    className: "min-w-[200px]",
    align: "left",
  },

  // Bairro (Neighborhood)
  {
    key: "neighborhood",
    header: "BAIRRO",
    accessor: (user: User) => <div className="text-sm">{user.neighborhood || <span className="text-muted-foreground">-</span>}</div>,
    sortable: true,
    className: "min-w-[150px]",
    align: "left",
  },

  // Requer Alteração de Senha (Require Password Change)
  {
    key: "requirePasswordChange",
    header: "REQUER ALTERAÇÃO DE SENHA",
    accessor: (user: User) => (
      <div className="text-sm text-center">
        {user.requirePasswordChange ? (
          <Badge variant="destructive" className="text-xs">
            Sim
          </Badge>
        ) : (
          <Badge variant="secondary" className="text-xs">
            Não
          </Badge>
        )}
      </div>
    ),
    sortable: true,
    className: "min-w-[220px]",
    align: "center",
  },

  // Data de Criação (Created At)
  {
    key: "createdAt",
    header: "DATA DE CRIAÇÃO",
    accessor: (user: User) => <div className="text-sm">{user.createdAt ? formatDateTime(new Date(user.createdAt)) : <span className="text-muted-foreground">-</span>}</div>,
    sortable: true,
    className: "min-w-[180px]",
    align: "left",
  },

  // Data de Atualização (Updated At)
  {
    key: "updatedAt",
    header: "ÚLTIMA ATUALIZAÇÃO",
    accessor: (user: User) => <div className="text-sm">{user.updatedAt ? formatDateTime(new Date(user.updatedAt)) : <span className="text-muted-foreground">-</span>}</div>,
    sortable: true,
    className: "min-w-[180px]",
    align: "left",
  },
];

// Export the default visible columns
export const DEFAULT_VISIBLE_COLUMNS = new Set(["payrollNumber", "name", "position.name", "sector.name", "status"]);
