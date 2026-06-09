import { SERVICE_ORDER_STATUS_LABELS } from "../constants";
import { SERVICE_ORDER_STATUS } from "../constants";
import type { ServiceOrder } from "../types";
import { type BadgeVariant } from "../constants/badge-colors";

export const isServiceOrderStarted = (serviceOrder: Pick<ServiceOrder, "startedAt">): boolean => {
  return serviceOrder.startedAt !== null;
};

export const isServiceOrderFinished = (serviceOrder: Pick<ServiceOrder, "finishedAt">): boolean => {
  return serviceOrder.finishedAt !== null;
};

export const getServiceOrderStatus = (serviceOrder: Pick<ServiceOrder, "startedAt" | "finishedAt">): "pending" | "in_progress" | "completed" => {
  if (serviceOrder.finishedAt) return "completed";
  if (serviceOrder.startedAt) return "in_progress";
  return "pending";
};

export const calculateServiceOrderDuration = (serviceOrder: Pick<ServiceOrder, "startedAt" | "finishedAt">): number | null => {
  if (!serviceOrder.startedAt) return null;

  const endTime = serviceOrder.finishedAt || new Date();
  return endTime.getTime() - serviceOrder.startedAt.getTime();
};

export const canStartServiceOrder = (serviceOrder: Pick<ServiceOrder, "startedAt" | "finishedAt">): boolean => {
  return !serviceOrder.startedAt && !serviceOrder.finishedAt;
};

export const canFinishServiceOrder = (serviceOrder: Pick<ServiceOrder, "startedAt" | "finishedAt">): boolean => {
  return serviceOrder.startedAt !== null && !serviceOrder.finishedAt;
};

export function getServiceOrderStatusLabel(status: SERVICE_ORDER_STATUS): string {
  return SERVICE_ORDER_STATUS_LABELS[status] || status;
}

export function getServiceOrderStatusColor(status: SERVICE_ORDER_STATUS): BadgeVariant {
  const statusColorMap: Record<SERVICE_ORDER_STATUS, BadgeVariant> = {
    [SERVICE_ORDER_STATUS.PENDING]: "gray",
    [SERVICE_ORDER_STATUS.IN_PROGRESS]: "blue",
    [SERVICE_ORDER_STATUS.WAITING_ARTWORK]: "purple",
    [SERVICE_ORDER_STATUS.PAUSED]: "yellow",
    [SERVICE_ORDER_STATUS.WAITING_APPROVE]: "purple",
    [SERVICE_ORDER_STATUS.COMPLETED]: "green",
    [SERVICE_ORDER_STATUS.CANCELLED]: "red",
  };

  return statusColorMap[status] || "default";
}

export const isServiceOrderPaused = (serviceOrder: Pick<ServiceOrder, "status">): boolean => {
  return serviceOrder.status === SERVICE_ORDER_STATUS.PAUSED;
};

export const canPauseServiceOrder = (serviceOrder: Pick<ServiceOrder, "status">): boolean => {
  return serviceOrder.status === SERVICE_ORDER_STATUS.IN_PROGRESS;
};

export const canResumeServiceOrder = (serviceOrder: Pick<ServiceOrder, "status">): boolean => {
  return serviceOrder.status === SERVICE_ORDER_STATUS.PAUSED;
};

export const getServiceOrderTotalActiveTimeSeconds = (
  serviceOrder: Pick<ServiceOrder, "status" | "startedAt" | "lastStartedAt" | "totalActiveTimeSeconds">
): number => {
  const accumulated = serviceOrder.totalActiveTimeSeconds ?? 0;
  // Only add a live session when the SO is actively running
  if (serviceOrder.status === SERVICE_ORDER_STATUS.IN_PROGRESS) {
    // Prefer lastStartedAt (most recent session start); fall back to startedAt for first sessions
    const activeStart = serviceOrder.lastStartedAt ?? serviceOrder.startedAt;
    if (activeStart) {
      const now = new Date();
      const sessionSeconds = Math.floor(
        (now.getTime() - new Date(activeStart).getTime()) / 1000
      );
      return accumulated + Math.max(0, sessionSeconds);
    }
  }
  return accumulated;
};

export const formatActiveTime = (totalSeconds: number): string => {
  if (totalSeconds <= 0) return "00:00";
  if (totalSeconds < 60) return "< 1 min";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};
