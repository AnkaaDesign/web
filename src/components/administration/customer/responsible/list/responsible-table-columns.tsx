import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  IconEdit,
  IconTrash,
  IconDots,
  IconPhone,
  IconMail,
  IconLock,
  IconLockOpen,
  IconUser,
} from "@tabler/icons-react";
import type { Responsible } from "@/types/responsible";
import {
  RESPONSIBLE_ROLE_LABELS,
  RESPONSIBLE_ROLE_COLORS,
} from "@/types/responsible";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CreateColumnsProps {
  onEdit: (responsible: Responsible) => void;
  onDelete: (responsible: Responsible) => void;
  onToggleActive: (responsible: Responsible) => void;
  onUpdatePassword: (responsible: Responsible) => void;
  isLoading?: boolean;
}

export function createResponsibleColumns({
  onEdit,
  onDelete,
  onToggleActive,
  onUpdatePassword,
  isLoading,
}: CreateColumnsProps): ColumnDef<Responsible>[] {
  return [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Selecionar todos"
          disabled={isLoading}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Selecionar linha"
          disabled={isLoading}
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "name",
      header: () => <span className="font-bold uppercase text-xs">NOME</span>,
      cell: ({ row }) => {
        const responsible = row.original;
        return (
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
              <IconUser className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex flex-col">
              <span className="font-medium text-sm">{responsible.name}</span>
              {responsible.company && (
                <span className="text-xs text-muted-foreground">
                  {responsible.company.corporateName || responsible.company.fantasyName}
                </span>
              )}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "role",
      header: () => <span className="font-bold uppercase text-xs">FUNÇÃO</span>,
      cell: ({ row }) => {
        const role = row.original.role;
        return (
          <Badge
            variant={RESPONSIBLE_ROLE_COLORS[role] as any}
            className="text-xs"
          >
            {RESPONSIBLE_ROLE_LABELS[role]}
          </Badge>
        );
      },
    },
    {
      id: "contact",
      header: () => <span className="font-bold uppercase text-xs">CONTATO</span>,
      cell: ({ row }) => {
        const responsible = row.original;
        return (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <IconPhone className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs">{responsible.phone}</span>
            </div>
            {responsible.email && (
              <div className="flex items-center gap-1.5">
                <IconMail className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs">{responsible.email}</span>
              </div>
            )}
          </div>
        );
      },
    },
    {
      id: "access",
      header: () => <span className="font-bold uppercase text-xs">ACESSO</span>,
      cell: ({ row }) => {
        const responsible = row.original;
        const hasSystemAccess = !!responsible.email && !!responsible.password;
        return (
          <div className="flex items-center">
            {hasSystemAccess ? (
              <div className="flex items-center gap-1.5">
                <IconLockOpen className="h-4 w-4 text-green-600" />
                <span className="text-xs text-green-600">Com acesso</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <IconLock className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Sem acesso</span>
              </div>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "isActive",
      header: () => <span className="font-bold uppercase text-xs">STATUS</span>,
      cell: ({ row }) => {
        const isActive = row.original.isActive;
        return (
          <Badge
            variant={isActive ? "success" : "secondary"}
            className="text-xs"
          >
            {isActive ? "Ativo" : "Inativo"}
          </Badge>
        );
      },
    },
    {
      accessorKey: "createdAt",
      header: () => <span className="font-bold uppercase text-xs">CRIADO EM</span>,
      cell: ({ row }) => {
        const date = row.original.createdAt;
        return date ? (
          <span className="text-xs text-muted-foreground">
            {format(new Date(date), "dd/MM/yyyy", { locale: ptBR })}
          </span>
        ) : (
          "-"
        );
      },
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Ações</span>,
      cell: ({ row }) => {
        const responsible = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                disabled={isLoading}
              >
                <IconDots className="h-4 w-4" />
                <span className="sr-only">Abrir menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(responsible)}>
                <IconEdit className="mr-2 h-4 w-4" />
                Editar
              </DropdownMenuItem>
              {responsible.email && (
                <DropdownMenuItem onClick={() => onUpdatePassword(responsible)}>
                  <IconLock className="mr-2 h-4 w-4" />
                  Alterar Senha
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onToggleActive(responsible)}>
                {responsible.isActive ? (
                  <>
                    <IconLock className="mr-2 h-4 w-4" />
                    Desativar
                  </>
                ) : (
                  <>
                    <IconLockOpen className="mr-2 h-4 w-4" />
                    Ativar
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onDelete(responsible)}
                className="text-destructive focus:text-destructive"
              >
                <IconTrash className="mr-2 h-4 w-4" />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
}
