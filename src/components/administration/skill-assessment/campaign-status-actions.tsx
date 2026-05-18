import { useState } from "react";
import {
  IconAlertTriangle,
  IconCheck,
  IconLoader2,
  IconLock,
  IconPlayerPlay,
  IconX,
} from "@tabler/icons-react";

import type { Assessment } from "../../../types";
import { ASSESSMENT_STATUS } from "../../../constants";
import {
  useOpenAssessment,
  useCloseAssessment,
  useCancelAssessment,
} from "../../../hooks";

import { Button } from "@/components/ui/button";
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
import { toast } from "@/components/ui/sonner";

interface CampaignStatusActionsProps {
  assessment: Assessment;
}

type Action = "open" | "close" | "cancel" | null;

export function CampaignStatusActions({ assessment }: CampaignStatusActionsProps) {
  const [pendingAction, setPendingAction] = useState<Action>(null);

  const openMut = useOpenAssessment();
  const closeMut = useCloseAssessment();
  const cancelMut = useCancelAssessment();

  const status = assessment.status as ASSESSMENT_STATUS;
  const canOpen = status === ASSESSMENT_STATUS.DRAFT;
  const canClose = status === ASSESSMENT_STATUS.OPEN;
  const canCancel = status === ASSESSMENT_STATUS.DRAFT || status === ASSESSMENT_STATUS.OPEN;

  const confirm = async () => {
    try {
      if (pendingAction === "open") {
        await openMut.mutateAsync(assessment.id);
        toast.success("Campanha aberta. Entradas foram geradas para os avaliadores.");
      } else if (pendingAction === "close") {
        await closeMut.mutateAsync(assessment.id);
        toast.success("Campanha fechada.");
      } else if (pendingAction === "cancel") {
        await cancelMut.mutateAsync(assessment.id);
        toast.success("Campanha cancelada.");
      }
    } catch (err) {
      toast.error("Erro ao alterar status da campanha");
      if (process.env.NODE_ENV !== "production") console.error(err);
    } finally {
      setPendingAction(null);
    }
  };

  const dialogCopy: Record<NonNullable<Action>, { title: string; description: string }> = {
    open: {
      title: "Abrir campanha?",
      description:
        "Esta ação gera as entradas de avaliação para cada colaborador dos setores selecionados. Após aberta, a campanha não poderá ser editada.",
    },
    close: {
      title: "Fechar campanha?",
      description:
        "Esta ação encerra a coleta. Líderes não poderão mais enviar avaliações pendentes.",
    },
    cancel: {
      title: "Cancelar campanha?",
      description:
        "Esta ação invalida a campanha. As entradas existentes ficam congeladas e não recebem novas respostas.",
    },
  };

  const anyPending = openMut.isPending || closeMut.isPending || cancelMut.isPending;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {canOpen && (
          <Button onClick={() => setPendingAction("open")} disabled={anyPending}>
            {openMut.isPending ? (
              <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <IconPlayerPlay className="mr-2 h-4 w-4" />
            )}
            Abrir campanha
          </Button>
        )}
        {canClose && (
          <Button variant="outline" onClick={() => setPendingAction("close")} disabled={anyPending}>
            {closeMut.isPending ? (
              <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <IconLock className="mr-2 h-4 w-4" />
            )}
            Fechar campanha
          </Button>
        )}
        {canCancel && (
          <Button variant="destructive" onClick={() => setPendingAction("cancel")} disabled={anyPending}>
            {cancelMut.isPending ? (
              <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <IconX className="mr-2 h-4 w-4" />
            )}
            Cancelar campanha
          </Button>
        )}
        {!canOpen && !canClose && !canCancel && (
          <span className="text-sm text-muted-foreground inline-flex items-center gap-2">
            <IconCheck className="h-4 w-4" /> Sem ações disponíveis para o status atual.
          </span>
        )}
      </div>

      <AlertDialog open={!!pendingAction} onOpenChange={(o) => !o && setPendingAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <IconAlertTriangle className="h-5 w-5 text-amber-500" />
              {pendingAction ? dialogCopy[pendingAction].title : ""}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction ? dialogCopy[pendingAction].description : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={confirm} disabled={anyPending}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
