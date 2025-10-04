import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  User,
  Calendar,
  Clock,
  Edit,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Loader2,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAbsenceDetail } from "../../../../hooks";
import { ABSENCE_STATUS, ABSENCE_STATUS_LABELS } from "../../../../constants";
import { AbsenceEditForm, AbsenceQuickActions } from "../form";

interface AbsenceDetailProps {
  absenceId: string;
  onBack?: () => void;
  onEdit?: () => void;
  allowEdit?: boolean;
  allowActions?: boolean;
}

export function AbsenceDetail({
  absenceId,
  onBack,
  onEdit,
  allowEdit = true,
  allowActions = true
}: AbsenceDetailProps) {
  const [isEditOpen, setIsEditOpen] = useState(false);

  const {
    data: absence,
    isLoading,
    error,
    refetch
  } = useAbsenceDetail(absenceId, {
    include: {
      user: true,
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Carregando detalhes da falta...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !absence) {
    return (
      <Card>
        <CardContent className="p-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Erro ao carregar detalhes da falta. Verifique se ela existe e tente novamente.
            </AlertDescription>
          </Alert>
          {onBack && (
            <Button variant="outline" onClick={onBack} className="mt-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case ABSENCE_STATUS.PENDING_JUSTIFICATION:
        return <AlertCircle className="h-4 w-4" />;
      case ABSENCE_STATUS.JUSTIFICATION_SUBMITTED:
        return <MessageSquare className="h-4 w-4" />;
      case ABSENCE_STATUS.APPROVED:
        return <CheckCircle2 className="h-4 w-4" />;
      case ABSENCE_STATUS.REJECTED:
        return <XCircle className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((word) => word.charAt(0))
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const isPastDate = () => {
    const today = new Date();
    const absenceDate = new Date(absence.date);
    today.setHours(0, 0, 0, 0);
    absenceDate.setHours(0, 0, 0, 0);
    return absenceDate < today;
  };

  const handleEditSuccess = () => {
    setIsEditOpen(false);
    refetch();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              {onBack && (
                <Button variant="outline" size="sm" onClick={onBack}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              <div>
                <CardTitle className="flex items-center gap-2">
                  Detalhes da Falta
                </CardTitle>
                <CardDescription>
                  Informações completas sobre o registro de falta
                </CardDescription>
              </div>
            </div>
            {allowEdit && (
              <Button onClick={() => setIsEditOpen(true)}>
                <Edit className="mr-2 h-4 w-4" />
                Editar
              </Button>
            )}
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Employee Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Funcionário
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarFallback className="bg-primary/10 text-primary text-lg">
                    {getInitials(absence.user?.name || "???")}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-1">
                  <h3 className="text-xl font-semibold">
                    {absence.user?.name || "Nome não disponível"}
                  </h3>
                  <p className="text-muted-foreground">
                    {absence.user?.position?.name || "Cargo não informado"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {absence.user?.sector?.name || "Setor não informado"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Absence Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Detalhes da Falta
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Date */}
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Data da Falta
                </label>
                <p className="text-lg font-medium">
                  {format(new Date(absence.date), "PPP", { locale: ptBR })}
                </p>
                {isPastDate() && (
                  <p className="text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(absence.date), { locale: ptBR, addSuffix: true })}
                  </p>
                )}
              </div>

              <Separator />

              {/* Status */}
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Status
                </label>
                <div className="flex items-center gap-2 mt-1">
                  <Badge className={getStatusColor(absence.status)}>
                    {getStatusIcon(absence.status)}
                    <span className="ml-1">
                      {ABSENCE_STATUS_LABELS[absence.status as keyof typeof ABSENCE_STATUS_LABELS]}
                    </span>
                  </Badge>
                </div>
              </div>

              <Separator />

              {/* Created At */}
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Registrado em
                </label>
                <div className="flex items-center gap-2 mt-1">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {format(new Date(absence.createdAt), "PPP 'às' HH:mm", { locale: ptBR })}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {formatDistanceToNow(new Date(absence.createdAt), { locale: ptBR, addSuffix: true })}
                </p>
              </div>

              {/* Reason/Justification */}
              {absence.reason && (
                <>
                  <Separator />
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      {isPastDate() ? "Justificativa" : "Motivo"}
                    </label>
                    <div className="mt-2 p-4 bg-muted rounded-lg border-l-4 border-primary">
                      <p className="text-sm leading-relaxed">{absence.reason}</p>
                    </div>
                  </div>
                </>
              )}

              {/* No reason warning */}
              {!absence.reason && isPastDate() && absence.status === ABSENCE_STATUS.PENDING_JUSTIFICATION && (
                <>
                  <Separator />
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Esta falta em data passada ainda não possui justificativa
                    </AlertDescription>
                  </Alert>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Actions Sidebar */}
        {allowActions && (
          <div className="space-y-6">
            <AbsenceQuickActions
              absence={absence}
              onSuccess={refetch}
              showUserInfo={false}
            />
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Falta</DialogTitle>
            <DialogDescription>
              Atualize as informações da falta
            </DialogDescription>
          </DialogHeader>
          <AbsenceEditForm
            absence={absence}
            onSuccess={handleEditSuccess}
            onCancel={() => setIsEditOpen(false)}
            allowStatusChange={true}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}