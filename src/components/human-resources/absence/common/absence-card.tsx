import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { User, Calendar, Clock, MoreHorizontal, Edit, Trash2, Eye } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ABSENCE_STATUS, ABSENCE_STATUS_LABELS } from "../../../../constants";
import type { Absence } from "../../../../types";

interface AbsenceCardProps {
  absence: Absence;
  onEdit?: (absence: Absence) => void;
  onDelete?: (absence: Absence) => void;
  onView?: (absence: Absence) => void;
  showActions?: boolean;
  compact?: boolean;
}

export function AbsenceCard({
  absence,
  onEdit,
  onDelete,
  onView,
  showActions = true,
  compact = false
}: AbsenceCardProps) {
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

  return (
    <Card className={`w-full transition-shadow hover:shadow-md ${compact ? "p-2" : ""}`}>
      <CardHeader className={compact ? "pb-2" : "pb-3"}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Avatar className={compact ? "h-8 w-8" : "h-10 w-10"}>
              <AvatarFallback className="bg-primary/10 text-primary">
                {getInitials(absence.user?.name || "???")}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className={`font-medium text-foreground ${compact ? "text-sm" : ""}`}>
                {absence.user?.name || "Nome não disponível"}
              </h3>
              <div className="flex items-center gap-1 text-muted-foreground">
                <User className="h-3 w-3" />
                <span className="text-xs">
                  {absence.user?.position?.name || "Cargo não informado"}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={getStatusColor(absence.status)}>
              {ABSENCE_STATUS_LABELS[absence.status as keyof typeof ABSENCE_STATUS_LABELS]}
            </Badge>
            {showActions && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {onView && (
                    <DropdownMenuItem onClick={() => onView(absence)}>
                      <Eye className="mr-2 h-4 w-4" />
                      Visualizar
                    </DropdownMenuItem>
                  )}
                  {onEdit && (
                    <DropdownMenuItem onClick={() => onEdit(absence)}>
                      <Edit className="mr-2 h-4 w-4" />
                      Editar
                    </DropdownMenuItem>
                  )}
                  {onDelete && (
                    <DropdownMenuItem
                      onClick={() => onDelete(absence)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Excluir
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className={compact ? "pt-0" : ""}>
        <div className="space-y-3">
          {/* Date Info */}
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">
              {format(new Date(absence.date), "PPP", { locale: ptBR })}
            </span>
            {isPastDate() && (
              <span className="text-muted-foreground">
                ({formatDistanceToNow(new Date(absence.date), { locale: ptBR, addSuffix: true })})
              </span>
            )}
          </div>

          {/* Time Info */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>
              Registrado {formatDistanceToNow(new Date(absence.createdAt), { locale: ptBR, addSuffix: true })}
            </span>
          </div>

          {/* Reason/Justification */}
          {absence.reason && (
            <div className="mt-3">
              <p className="text-sm text-muted-foreground mb-1">
                {isPastDate() ? "Justificativa:" : "Motivo:"}
              </p>
              <p className="text-sm bg-muted p-2 rounded border-l-2 border-primary/20">
                {absence.reason.length > 100 && compact
                  ? `${absence.reason.slice(0, 100)}...`
                  : absence.reason}
              </p>
            </div>
          )}

          {/* No reason warning for past dates */}
          {!absence.reason && isPastDate() && absence.status === ABSENCE_STATUS.PENDING_JUSTIFICATION && (
            <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
              Justificativa pendente para falta em data passada
            </div>
          )}

          {/* Action Link */}
          {onView && (
            <div className="pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onView(absence)}
                className="w-full"
              >
                <Eye className="mr-2 h-4 w-4" />
                Ver Detalhes
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}