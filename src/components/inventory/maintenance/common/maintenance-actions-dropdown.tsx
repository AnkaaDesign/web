import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  IconDotsVertical,
  IconEye,
  IconEdit,
  IconCheck,
  IconPlayerPlay,
  IconPlayerPause,
  IconCircleX,
  IconRotate,
  IconTrash,
  IconCalendar,
  IconPower,
  IconPower as IconPowerOff,
} from "@tabler/icons-react";
import { type Maintenance } from "../../../../types";
import { MAINTENANCE_STATUS } from "../../../../constants";
import { cn } from "@/lib/utils";

// Extended Maintenance type that includes MaintenanceSchedule properties
type MaintenanceWithSchedule = Maintenance & {
  nextRun?: Date | null;
  isActive?: boolean;
  maintenanceSchedule?: {
    nextRun?: Date | null;
    isActive?: boolean;
  };
};

interface MaintenanceActionsDropdownProps {
  maintenance: MaintenanceWithSchedule;
  onView?: (maintenance: MaintenanceWithSchedule) => void;
  onEdit?: (maintenance: MaintenanceWithSchedule) => void;
  onStart?: (maintenance: MaintenanceWithSchedule) => void;
  onFinish?: (maintenance: MaintenanceWithSchedule) => void;
  onPause?: (maintenance: MaintenanceWithSchedule) => void;
  onCancel?: (maintenance: MaintenanceWithSchedule) => void;
  onReactivate?: (maintenance: MaintenanceWithSchedule) => void;
  onReschedule?: (maintenance: MaintenanceWithSchedule) => void;
  onActivate?: (maintenance: MaintenanceWithSchedule) => void;
  onDeactivate?: (maintenance: MaintenanceWithSchedule) => void;
  onDelete?: (maintenance: MaintenanceWithSchedule) => void;
  className?: string;
}

export function MaintenanceActionsDropdown({
  maintenance,
  onView,
  onEdit,
  onStart,
  onFinish,
  onPause,
  onCancel,
  onReactivate,
  onReschedule,
  onActivate,
  onDeactivate,
  onDelete,
  className,
}: MaintenanceActionsDropdownProps) {
  const { status } = maintenance;

  // Check if maintenance is overdue
  const now = new Date();
  const nextRunDate = maintenance.nextRun || maintenance.maintenanceSchedule?.nextRun;
  const isOverdue = nextRunDate && status === MAINTENANCE_STATUS.PENDING && new Date(nextRunDate) < now;

  // Define which actions are available based on status with enhanced logic
  const canStart = status === MAINTENANCE_STATUS.PENDING || status === MAINTENANCE_STATUS.OVERDUE;
  const canFinish = status === MAINTENANCE_STATUS.IN_PROGRESS; // Only allow finishing if already in progress
  const canPause = status === MAINTENANCE_STATUS.IN_PROGRESS;
  const canCancel = status === MAINTENANCE_STATUS.PENDING || status === MAINTENANCE_STATUS.IN_PROGRESS || status === MAINTENANCE_STATUS.OVERDUE;
  const canReactivate = status === MAINTENANCE_STATUS.CANCELLED;
  const canEdit = status !== MAINTENANCE_STATUS.COMPLETED;
  const canDelete = status === MAINTENANCE_STATUS.CANCELLED || status === MAINTENANCE_STATUS.COMPLETED;
  const canReschedule = status === MAINTENANCE_STATUS.PENDING && !isOverdue; // Only allow reschedule if not overdue
  const isActive = maintenance.isActive ?? maintenance.maintenanceSchedule?.isActive ?? false;
  const canActivate = !isActive && status !== MAINTENANCE_STATUS.COMPLETED && status !== MAINTENANCE_STATUS.CANCELLED;
  const canDeactivate = isActive && status !== MAINTENANCE_STATUS.IN_PROGRESS; // Can't deactivate while in progress

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className={cn("h-8 w-8 p-0", className)}>
          <IconDotsVertical className="h-4 w-4" />
          <span className="sr-only">Abrir menu de ações</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {/* View Action - Always available */}
        {onView && (
          <DropdownMenuItem onClick={() => onView(maintenance)}>
            <IconEye className="mr-2 h-4 w-4" />
            Visualizar
          </DropdownMenuItem>
        )}

        {/* Edit Action */}
        {onEdit && canEdit && (
          <DropdownMenuItem onClick={() => onEdit(maintenance)}>
            <IconEdit className="mr-2 h-4 w-4" />
            Editar
          </DropdownMenuItem>
        )}

        {/* Status Change Actions */}
        {(canStart || canFinish || canPause) && <DropdownMenuSeparator />}

        {/* Start Action */}
        {onStart && canStart && (
          <DropdownMenuItem onClick={() => onStart(maintenance)}>
            <IconPlayerPlay className="mr-2 h-4 w-4 text-blue-600" />
            <span className="text-blue-600">Iniciar</span>
          </DropdownMenuItem>
        )}

        {/* Finish Action */}
        {onFinish && canFinish && (
          <DropdownMenuItem onClick={() => onFinish(maintenance)}>
            <IconCheck className="mr-2 h-4 w-4 text-green-700" />
            <span className="text-green-700 font-medium">Concluir</span>
          </DropdownMenuItem>
        )}

        {/* Pause Action */}
        {onPause && canPause && (
          <DropdownMenuItem onClick={() => onPause(maintenance)}>
            <IconPlayerPause className="mr-2 h-4 w-4 text-orange-600" />
            <span className="text-orange-600">Pausar</span>
          </DropdownMenuItem>
        )}

        {/* Reschedule Action */}
        {onReschedule && canReschedule && (
          <DropdownMenuItem onClick={() => onReschedule(maintenance)}>
            <IconCalendar className="mr-2 h-4 w-4 text-blue-600" />
            <span className="text-blue-600">Reagendar</span>
          </DropdownMenuItem>
        )}

        {/* Schedule Management Actions */}
        {(canActivate || canDeactivate) && <DropdownMenuSeparator />}

        {/* Activate Scheduling */}
        {onActivate && canActivate && (
          <DropdownMenuItem onClick={() => onActivate(maintenance)}>
            <IconPower className="mr-2 h-4 w-4 text-green-700" />
            <span className="text-green-700">Ativar Agendamento</span>
          </DropdownMenuItem>
        )}

        {/* Deactivate Scheduling */}
        {onDeactivate && canDeactivate && (
          <DropdownMenuItem onClick={() => onDeactivate(maintenance)}>
            <IconPowerOff className="mr-2 h-4 w-4 text-orange-600" />
            <span className="text-orange-600">Desativar Agendamento</span>
          </DropdownMenuItem>
        )}

        {/* Management Actions */}
        {(canCancel || canReactivate || canDelete) && <DropdownMenuSeparator />}

        {/* Cancel Action */}
        {onCancel && canCancel && (
          <DropdownMenuItem onClick={() => onCancel(maintenance)}>
            <IconCircleX className="mr-2 h-4 w-4 text-red-700" />
            <span className="text-red-700">Cancelar</span>
          </DropdownMenuItem>
        )}

        {/* Reactivate Action */}
        {onReactivate && canReactivate && (
          <DropdownMenuItem onClick={() => onReactivate(maintenance)}>
            <IconRotate className="mr-2 h-4 w-4 text-blue-600" />
            <span className="text-blue-600">Reativar</span>
          </DropdownMenuItem>
        )}

        {/* Delete Action */}
        {onDelete && canDelete && (
          <DropdownMenuItem onClick={() => onDelete(maintenance)} className="text-red-700">
            <IconTrash className="mr-2 h-4 w-4" />
            Excluir
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default MaintenanceActionsDropdown;
