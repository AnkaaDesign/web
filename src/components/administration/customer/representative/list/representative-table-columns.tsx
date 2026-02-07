import React from "react";
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
import type { Representative } from "@/types/representative";
import {
  REPRESENTATIVE_ROLE_LABELS,
  REPRESENTATIVE_ROLE_COLORS,
} from "@/types/representative";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CreateColumnsProps {
  onEdit: (representative: Representative) => void;
  onDelete: (representative: Representative) => void;
  onToggleActive: (representative: Representative) => void;
  onUpdatePassword: (representative: Representative) => void;
  isLoading?: boolean;
}

export function createRepresentativeColumns({
  onEdit,
  onDelete,
  onToggleActive,
  onUpdatePassword,
  isLoading,
}: CreateColumnsProps): ColumnDef<Representative>[] {
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
        const representative = row.original;
        return (
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
              <IconUser className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex flex-col">
              <span className="font-medium text-sm">{representative.name}</span>
              {representative.customer && (
                <span className="text-xs text-muted-foreground">
                  {representative.customer.name}
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
            variant={REPRESENTATIVE_ROLE_COLORS[role] as any}
            className="text-xs"
          >
            {REPRESENTATIVE_ROLE_LABELS[role]}
          </Badge>
        );
      },
    },
    {
      id: "contact",
      header: () => <span className="font-bold uppercase text-xs">CONTATO</span>,
      cell: ({ row }) => {
        const representative = row.original;
        return (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <IconPhone className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs">{representative.phone}</span>
            </div>
            {representative.email && (
              <div className="flex items-center gap-1.5">
                <IconMail className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs">{representative.email}</span>
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
        const representative = row.original;
        const hasSystemAccess = !!representative.email && !!representative.password;
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
        const representative = row.original;
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
              <DropdownMenuItem onClick={() => onEdit(representative)}>
                <IconEdit className="mr-2 h-4 w-4" />
                Editar
              </DropdownMenuItem>
              {representative.email && (
                <DropdownMenuItem onClick={() => onUpdatePassword(representative)}>
                  <IconLock className="mr-2 h-4 w-4" />
                  Alterar Senha
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onToggleActive(representative)}>
                {representative.isActive ? (
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
                onClick={() => onDelete(representative)}
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