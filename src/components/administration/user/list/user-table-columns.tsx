import { formatCPF, formatBrazilianPhone, formatDate, formatDateTime } from "../../../../utils";
import { SHIRT_SIZE_LABELS, PANTS_SIZE_LABELS, BOOT_SIZE_LABELS, SLEEVES_SIZE_LABELS, MASK_SIZE_LABELS, GLOVES_SIZE_LABELS, RAIN_BOOTS_SIZE_LABELS, CONTRACT_TYPE_LABELS } from "../../../../constants";
import { getCollaboratorStatus } from "../../../../utils/user";
import { Badge } from "@/components/ui/badge";
import type { User } from "../../../../types";
import type { UserColumn } from "./types";
import { getDocumentProgress } from "../../../personnel-department/admission/utils";
import { DocumentProgressBar } from "../../../personnel-department/admission/document-progress";

export const createUserColumns = (): UserColumn[] => [
  // Número da Folha (Payroll Number)
  {
    key: "payrollNumber",
    header: "Nº FOLHA",
    accessor: (user: User) => <div className="text-sm truncate">{user.payrollNumber || <span className="text-muted-foreground">-</span>}</div>,
    sortable: true,
    className: "w-32",
    align: "left",
  },

  // Nome (Name)
  {
    key: "name",
    header: "NOME",
    accessor: (user: User) => (
      <div className="font-medium truncate" title={user.name}>{user.name}</div>
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
      <div className="text-sm truncate">
        {user.email ? (
          <a
            href={`mailto:${user.email}`}
            className="text-green-600 dark:text-green-600 hover:text-green-700 dark:hover:text-green-500 hover:underline truncate block"
            onClick={(e) => e.stopPropagation()}
            title={user.email}
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
    accessor: (user: User) => <div className="text-sm truncate">{user.phone ? formatBrazilianPhone(user.phone) : <span className="text-muted-foreground">-</span>}</div>,
    sortable: true,
    className: "min-w-[140px]",
    align: "left",
  },

  // CPF
  {
    key: "cpf",
    header: "CPF",
    accessor: (user: User) => <div className="text-sm truncate">{user.cpf ? formatCPF(user.cpf) : <span className="text-muted-foreground">-</span>}</div>,
    sortable: true,
    className: "min-w-[140px]",
    align: "left",
  },

  // PIS
  {
    key: "pis",
    header: "PIS",
    accessor: (user: User) => <div className="text-sm truncate">{user.pis || <span className="text-muted-foreground">-</span>}</div>,
    sortable: true,
    className: "min-w-[140px]",
    align: "left",
  },

  // Cargo (Position)
  {
    key: "position.hierarchy",
    header: "CARGO",
    accessor: (user: User) => <div className="text-sm truncate" title={user.position?.name}>{user.position?.name || <span className="text-muted-foreground">-</span>}</div>,
    sortable: true,
    className: "min-w-[150px]",
    align: "left",
  },

  // Setor (Sector)
  {
    key: "sector.name",
    header: "SETOR",
    accessor: (user: User) => <div className="text-sm truncate" title={user.sector?.name}>{user.sector?.name || <span className="text-muted-foreground">-</span>}</div>,
    sortable: true,
    className: "min-w-[150px]",
    align: "left",
  },

  // Documentos (admission document checklist progress — most recent admission)
  {
    key: "documents",
    header: "DOCUMENTOS",
    accessor: (user: User) => {
      const latestAdmission = user.admissions?.[0];
      const { done, total } = getDocumentProgress(latestAdmission?.documents);
      if (total === 0) return <span className="text-sm text-muted-foreground">-</span>;
      return <DocumentProgressBar done={done} total={total} />;
    },
    sortable: false,
    className: "min-w-[150px]",
    align: "left",
  },

  // Total de Tarefas (Task Count)
  {
    key: "tasksCount",
    header: "TAREFAS",
    accessor: (user: User) => (
      <Badge variant="default" className="inline-flex items-center justify-center min-w-[2.5rem] px-1.5 tabular-nums leading-none">
        {user._count?.createdTasks || 0}
      </Badge>
    ),
    sortable: false,
    className: "w-24",
    align: "left",
  },

  // Data de Nascimento (Birth Date)
  {
    key: "birth",
    header: "DATA DE NASCIMENTO",
    accessor: (user: User) => <div className="text-sm truncate">{user.birth ? formatDate(new Date(user.birth)) : <span className="text-muted-foreground">-</span>}</div>,
    sortable: true,
    className: "min-w-[150px]",
    align: "left",
  },

  // Data de Demissão (Dismissal Date)
  {
    key: "dismissedAt",
    header: "DATA DE DEMISSÃO",
    accessor: (user: User) => {
      const terminationDate = user.currentContract?.terminationDate;
      return <div className="text-sm truncate">{terminationDate ? formatDate(new Date(terminationDate)) : <span className="text-muted-foreground">-</span>}</div>;
    },
    sortable: true,
    className: "min-w-[150px]",
    align: "left",
  },

  // Situação (collaborator status — color + label derived from cache fields)
  {
    key: "currentContractStatus",
    header: "SITUAÇÃO",
    accessor: (user: User) => {
      const { label, variant } = getCollaboratorStatus(user);

      return (
        <Badge variant={variant} className="text-xs whitespace-nowrap">
          {label}
        </Badge>
      );
    },
    sortable: true,
    className: "min-w-[250px]",
    align: "left",
  },

  // Modalidade (legal contract type — neutral, non-default column)
  {
    key: "currentContractType",
    header: "MODALIDADE",
    accessor: (user: User) => {
      const type = user.currentContractType;
      return type ? (
        <Badge variant="outline" className="text-xs whitespace-nowrap">
          {CONTRACT_TYPE_LABELS[type]}
        </Badge>
      ) : (
        <span className="text-muted-foreground">-</span>
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
      <Badge variant="default" className="inline-flex items-center justify-center min-w-[2.5rem] px-1.5 tabular-nums leading-none">
        {user.performanceLevel || 0}
      </Badge>
    ),
    sortable: true,
    className: "min-w-[180px]",
    align: "left",
  },

  // Verificado (Verified)
  {
    key: "verified",
    header: "VERIFICADO",
    accessor: (user: User) => (
      <div className="text-sm">
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
    align: "left",
  },

  // Último Login (Last Login)
  {
    key: "lastLoginAt",
    header: "ÚLTIMO LOGIN",
    accessor: (user: User) => <div className="text-sm truncate">{user.lastLoginAt ? formatDateTime(new Date(user.lastLoginAt)) : <span className="text-muted-foreground">-</span>}</div>,
    sortable: true,
    className: "min-w-[180px]",
    align: "left",
  },

  // Camisa (Shirt Size)
  {
    key: "ppeSize.shirts",
    header: "CAMISA",
    accessor: (user: User) => {
      const value = user.ppeSize?.shirts;
      return <div className="text-sm truncate">{value ? (SHIRT_SIZE_LABELS[value as keyof typeof SHIRT_SIZE_LABELS] || value) : <span className="text-muted-foreground">-</span>}</div>;
    },
    sortable: false,
    className: "w-20",
    align: "center",
  },

  // Calça (Pants Size)
  {
    key: "ppeSize.pants",
    header: "CALÇA",
    accessor: (user: User) => {
      const value = user.ppeSize?.pants;
      return <div className="text-sm truncate">{value ? (PANTS_SIZE_LABELS[value as keyof typeof PANTS_SIZE_LABELS] || value) : <span className="text-muted-foreground">-</span>}</div>;
    },
    sortable: false,
    className: "w-20",
    align: "center",
  },

  // Bota (Boot Size)
  {
    key: "ppeSize.boots",
    header: "BOTA",
    accessor: (user: User) => {
      const value = user.ppeSize?.boots;
      return <div className="text-sm truncate">{value ? (BOOT_SIZE_LABELS[value as keyof typeof BOOT_SIZE_LABELS] || value) : <span className="text-muted-foreground">-</span>}</div>;
    },
    sortable: false,
    className: "w-20",
    align: "center",
  },

  // Manguito (Sleeves Size)
  {
    key: "ppeSize.sleeves",
    header: "MANGUITO",
    accessor: (user: User) => {
      const value = user.ppeSize?.sleeves;
      return <div className="text-sm truncate">{value ? (SLEEVES_SIZE_LABELS[value as keyof typeof SLEEVES_SIZE_LABELS] || value) : <span className="text-muted-foreground">-</span>}</div>;
    },
    sortable: false,
    className: "w-24",
    align: "center",
  },

  // Máscara (Mask Size)
  {
    key: "ppeSize.mask",
    header: "MÁSCARA",
    accessor: (user: User) => {
      const value = user.ppeSize?.mask;
      return <div className="text-sm truncate">{value ? (MASK_SIZE_LABELS[value as keyof typeof MASK_SIZE_LABELS] || value) : <span className="text-muted-foreground">-</span>}</div>;
    },
    sortable: false,
    className: "w-24",
    align: "center",
  },

  // Luva (Gloves Size)
  {
    key: "ppeSize.gloves",
    header: "LUVA",
    accessor: (user: User) => {
      const value = user.ppeSize?.gloves;
      return <div className="text-sm truncate">{value ? (GLOVES_SIZE_LABELS[value as keyof typeof GLOVES_SIZE_LABELS] || value) : <span className="text-muted-foreground">-</span>}</div>;
    },
    sortable: false,
    className: "w-20",
    align: "center",
  },

  // Galocha (Rain Boots Size)
  {
    key: "ppeSize.rainBoots",
    header: "GALOCHA",
    accessor: (user: User) => {
      const value = user.ppeSize?.rainBoots;
      return <div className="text-sm truncate">{value ? (RAIN_BOOTS_SIZE_LABELS[value as keyof typeof RAIN_BOOTS_SIZE_LABELS] || value) : <span className="text-muted-foreground">-</span>}</div>;
    },
    sortable: false,
    className: "w-24",
    align: "center",
  },

  // Cidade (City)
  {
    key: "city",
    header: "CIDADE",
    accessor: (user: User) => <div className="text-sm truncate" title={user.city ?? undefined}>{user.city || <span className="text-muted-foreground">-</span>}</div>,
    sortable: true,
    className: "min-w-[150px]",
    align: "left",
  },

  // Estado (State)
  {
    key: "state",
    header: "ESTADO",
    accessor: (user: User) => <div className="text-sm truncate">{user.state || <span className="text-muted-foreground">-</span>}</div>,
    sortable: true,
    className: "min-w-[100px]",
    align: "left",
  },

  // CEP (Zip Code)
  {
    key: "zipCode",
    header: "CEP",
    accessor: (user: User) => <div className="text-sm truncate">{user.zipCode || <span className="text-muted-foreground">-</span>}</div>,
    sortable: true,
    className: "min-w-[120px]",
    align: "left",
  },

  // Endereço (Address)
  {
    key: "address",
    header: "ENDEREÇO",
    accessor: (user: User) => (
      <div className="text-sm truncate">
        {user.address ? (
          <div className="truncate" title={`${user.address}${user.addressNumber ? `, ${user.addressNumber}` : ""}${user.addressComplement ? ` - ${user.addressComplement}` : ""}`}>
            {user.address}
            {user.addressNumber ? `, ${user.addressNumber}` : ""}
            {user.addressComplement ? ` - ${user.addressComplement}` : ""}
          </div>
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
    accessor: (user: User) => <div className="text-sm truncate" title={user.neighborhood ?? undefined}>{user.neighborhood || <span className="text-muted-foreground">-</span>}</div>,
    sortable: true,
    className: "min-w-[150px]",
    align: "left",
  },

];

// Export the default visible columns
export const DEFAULT_VISIBLE_COLUMNS = new Set(["payrollNumber", "name", "position.hierarchy", "sector.name", "currentContractType", "documents"]);
