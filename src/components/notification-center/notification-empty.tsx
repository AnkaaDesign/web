import * as React from "react";
import { IconBellOff } from "@tabler/icons-react";

export const NotificationEmpty: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
        <IconBellOff className="w-8 h-8 text-muted-foreground" />
      </div>
      <h3 className="text-sm font-medium text-foreground mb-1">Nenhuma notificação</h3>
      <p className="text-xs text-muted-foreground text-center">
        Você está em dia! Não há notificações no momento.
      </p>
    </div>
  );
};
