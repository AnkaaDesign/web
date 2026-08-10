// components/questionnaire/admin/row-actions.tsx
//
// Right-click row actions shared by the three questionnaire admin lists (Temas,
// Perguntas, Campanhas): ver detalhes / abrir em nova guia / editar / excluir.
//
// Exclusão é o único item com regra: um tema com perguntas, uma pergunta já
// ligada a uma campanha ou uma campanha que não está cancelada NÃO podem ser
// removidos (a API rejeita, e aqui o item aparece desabilitado com o motivo em
// vez de deixar o usuário tomar o erro depois do clique).

import type { ReactNode } from "react";
import { IconEdit, IconExternalLink, IconEye, IconTrash } from "@tabler/icons-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { EntityRowAction } from "./entity-table";

const iconClass = "mr-2 h-4 w-4";

interface BuildRowActionsArgs {
  /** Route of the detail page — also what "abrir em nova guia" opens. */
  detailHref: string;
  /** Route of the edit form. Omit to hide "Editar". */
  editHref?: string;
  navigate: (href: string) => void;
  onDelete: () => void;
  /** Non-null = delete is blocked, and this text explains why (menu tooltip/label). */
  deleteBlockedReason?: string | null;
  /** Hide destructive/edit entries for viewers without write access. */
  canManage?: boolean;
}

export function buildRowActions({
  detailHref,
  editHref,
  navigate,
  onDelete,
  deleteBlockedReason,
  canManage = true,
}: BuildRowActionsArgs): EntityRowAction[] {
  const actions: EntityRowAction[] = [
    {
      key: "details",
      label: "Ver detalhes",
      icon: <IconEye className={iconClass} />,
      onClick: () => navigate(detailHref),
    },
    {
      key: "new-tab",
      label: "Abrir em nova guia",
      icon: <IconExternalLink className={iconClass} />,
      onClick: () => window.open(detailHref, "_blank", "noopener,noreferrer"),
    },
  ];

  if (canManage && editHref) {
    actions.push({
      key: "edit",
      label: "Editar",
      icon: <IconEdit className={iconClass} />,
      onClick: () => navigate(editHref),
    });
  }

  if (canManage) {
    actions.push({
      key: "delete",
      label: deleteBlockedReason ?? "Excluir",
      icon: <IconTrash className={iconClass} />,
      onClick: onDelete,
      disabled: !!deleteBlockedReason,
      destructive: !deleteBlockedReason,
      separatorBefore: true,
    });
  }

  return actions;
}

interface ConfirmDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  loading?: boolean;
  onConfirm: () => void;
}

export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  title,
  description,
  loading,
  onConfirm,
}: ConfirmDeleteDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <IconTrash className="h-5 w-5 text-destructive" />
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={loading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
