import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CheckCircle2, XCircle, MessageSquare, AlertCircle, User, Calendar } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAbsenceActions } from "../../../../hooks";
import { ABSENCE_STATUS, ABSENCE_STATUS_LABELS } from "../../../../constants";
import type { Absence } from "../../../../types";
import { toast } from "sonner";

interface AbsenceQuickActionsProps {
  absence: Absence;
  onSuccess?: () => void;
  showUserInfo?: boolean;
}

export function AbsenceQuickActions({
  absence,
  onSuccess,
  showUserInfo = true
}: AbsenceQuickActionsProps) {
  const [justificationReason, setJustificationReason] = useState(absence.reason || "");
  const [isJustificationOpen, setIsJustificationOpen] = useState(false);
  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [isRejectOpen, setIsRejectOpen] = useState(false);

  const { approve, reject, submitJustification } = useAbsenceActions();

  const getStatusColor = (status: string) => {
    switch (status) {
      case ABSENCE_STATUS.PENDING_JUSTIFICATION:
        return "bg-amber-100 text-amber-800 border-amber-200";
      case ABSENCE_STATUS.JUSTIFICATION_SUBMITTED:
        return "bg-blue-100 text-blue-800 border-blue-200";
      case ABSENCE_STATUS.APPROVED:
        return "bg-green-100 text-green-800 border-green-200";
      case ABSENCE_STATUS.REJECTED:
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const canSubmitJustification = () => {
    return absence.status === ABSENCE_STATUS.PENDING_JUSTIFICATION;
  };

  const canApproveReject = () => {
    return absence.status === ABSENCE_STATUS.JUSTIFICATION_SUBMITTED ||
           absence.status === ABSENCE_STATUS.PENDING_JUSTIFICATION;
  };

  const handleSubmitJustification = async () => {
    if (!justificationReason.trim()) {
      toast.error("A justificativa é obrigatória");
      return;
    }

    try {
      await submitJustification(absence.id, justificationReason);
      toast.success("Justificativa enviada com sucesso!");
      setIsJustificationOpen(false);
      onSuccess?.();
    } catch (error) {
      toast.error("Erro ao enviar justificativa");
    }
  };

  const handleApprove = async () => {
    try {
      await approve(absence.id);
      toast.success("Falta aprovada com sucesso!");
      setIsApproveOpen(false);
      onSuccess?.();
    } catch (error) {
      toast.error("Erro ao aprovar falta");
    }
  };

  const handleReject = async () => {
    try {
      await reject(absence.id);
      toast.success("Falta rejeitada com sucesso!");
      setIsRejectOpen(false);
      onSuccess?.();
    } catch (error) {
      toast.error("Erro ao rejeitar falta");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Ações Rápidas</CardTitle>
        <CardDescription>
          Realize ações comuns para esta falta
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Absence Info */}
        {showUserInfo && (
          <div className="p-3 bg-muted rounded-lg space-y-2">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{absence.user?.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{format(new Date(absence.date), "PPP", { locale: ptBR })}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Status:</span>
              <Badge className={getStatusColor(absence.status)}>
                {ABSENCE_STATUS_LABELS[absence.status as keyof typeof ABSENCE_STATUS_LABELS]}
              </Badge>
            </div>
          </div>
        )}

        {/* Current Reason/Justification */}
        {absence.reason && (
          <div>
            <Label className="text-sm font-medium">Justificativa Atual:</Label>
            <div className="mt-1 p-3 bg-muted rounded text-sm">
              {absence.reason}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col gap-2">
          {/* Submit Justification */}
          {canSubmitJustification() && (
            <Dialog open={isJustificationOpen} onOpenChange={setIsJustificationOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="justify-start">
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Enviar Justificativa
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Enviar Justificativa</DialogTitle>
                  <DialogDescription>
                    Informe a justificativa para esta falta
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="justification">Justificativa *</Label>
                    <Textarea
                      id="justification"
                      value={justificationReason}
                      onChange={(e) => setJustificationReason(e.target.value)}
                      placeholder="Informe a justificativa para a falta..."
                      className="min-h-[100px] mt-1"
                      maxLength={500}
                    />
                    <div className="text-right text-sm text-muted-foreground mt-1">
                      {justificationReason.length}/500
                    </div>
                  </div>
                  {!justificationReason.trim() && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        A justificativa é obrigatória
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setIsJustificationOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleSubmitJustification}
                    disabled={!justificationReason.trim()}
                  >
                    Enviar Justificativa
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}

          {/* Approve */}
          {canApproveReject() && (
            <Dialog open={isApproveOpen} onOpenChange={setIsApproveOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="justify-start text-green-700 hover:text-green-800">
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Aprovar Falta
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Aprovar Falta</DialogTitle>
                  <DialogDescription>
                    Tem certeza que deseja aprovar esta falta?
                  </DialogDescription>
                </DialogHeader>
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    A falta será marcada como aprovada e não poderá ser revertida facilmente.
                  </AlertDescription>
                </Alert>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setIsApproveOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button onClick={handleApprove} className="bg-green-600 hover:bg-green-700">
                    Aprovar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}

          {/* Reject */}
          {canApproveReject() && (
            <Dialog open={isRejectOpen} onOpenChange={setIsRejectOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="justify-start text-red-700 hover:text-red-800">
                  <XCircle className="mr-2 h-4 w-4" />
                  Rejeitar Falta
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Rejeitar Falta</DialogTitle>
                  <DialogDescription>
                    Tem certeza que deseja rejeitar esta falta?
                  </DialogDescription>
                </DialogHeader>
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>
                    A falta será marcada como rejeitada e não poderá ser revertida facilmente.
                  </AlertDescription>
                </Alert>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setIsRejectOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleReject}
                  >
                    Rejeitar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Status Info */}
        {absence.status === ABSENCE_STATUS.APPROVED && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              Esta falta foi aprovada
            </AlertDescription>
          </Alert>
        )}

        {absence.status === ABSENCE_STATUS.REJECTED && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>
              Esta falta foi rejeitada
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}