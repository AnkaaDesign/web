import { toast } from "sonner";

export const toastConfig = {
  // Default positions and durations
  position: "top-right" as const,
  duration: {
    default: 5000,
    success: 4000,
    error: 8000,
    warning: 6000,
    info: 5000,
  },

  // Max toasts
  maxToasts: 5,

  // Styling
  className: "font-medium",

  // Common toast methods with consistent messaging
  success: (message: string, description?: string) => {
    toast.success(message, {
      description,
      duration: toastConfig.duration.success,
    });
  },

  error: (message: string, description?: string) => {
    toast.error(message, {
      description,
      duration: toastConfig.duration.error,
    });
  },

  warning: (message: string, description?: string) => {
    toast.warning(message, {
      description,
      duration: toastConfig.duration.warning,
    });
  },

  info: (message: string, description?: string) => {
    toast.info(message, {
      description,
      duration: toastConfig.duration.info,
    });
  },

  // Special toast for copy operations
  copy: (itemName: string) => {
    toast.success(`${itemName} copiado para a área de transferência`, {
      duration: toastConfig.duration.success,
    });
  },

  // Special toast for export operations
  export: {
    start: (format: string) => {
      toast.info(`Exportando dados em formato ${format}...`, {
        duration: toastConfig.duration.info,
      });
    },
    success: (format: string) => {
      toast.success(`Dados exportados com sucesso em formato ${format}`, {
        duration: toastConfig.duration.success,
      });
    },
    error: (format: string) => {
      toast.error(`Erro ao exportar dados em formato ${format}`, {
        duration: toastConfig.duration.error,
      });
    },
  },

  // Loading toast with promise
  promise: <T>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((error: any) => string);
    },
  ) => {
    return toast.promise(promise, messages);
  },
};

// Export direct toast for advanced usage
export { toast };
