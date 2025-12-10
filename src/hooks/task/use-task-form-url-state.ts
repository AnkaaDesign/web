import { useCallback, useMemo } from "react";
import { z } from "zod";
import { useUrlFilters } from "../common/use-url-filters";
import { TASK_STATUS } from "../../constants";

/**
 * Task Form URL State Hook
 *
 * Manages complex task creation form state in URL parameters to prevent data loss on refresh.
 * This is the most complex form in the system with multiple sections:
 * - Basic information (name, customer, serial number, etc.)
 * - Dates (entry date, deadline)
 * - Services with quantities and descriptions
 * - Cut plans with measurements and quantities
 * - Airbrushing settings
 * - Paint selections (general painting and logo paints)
 * - Truck dimensions and positioning
 * - File upload references (not actual files)
 * - Notes and details
 */

export interface TaskFormValidationState {
  isValid: boolean;
  errors: {
    name?: string;
    customerId?: string;
    services?: string;
    entryDate?: string;
    term?: string;
    cuts?: Record<number, { name?: string; quantity?: string; measurements?: string }>;
    airbrushing?: { description?: string };
    truck?: { dimensions?: string };
    generalPainting?: string;
    logoPaints?: string;
  };
}

interface UseTaskFormUrlStateOptions {
  initialData?: {
    // Basic information
    name?: string;
    customerId?: string;
    sectorId?: string;
    serialNumber?: string;
    commission?: string;
    details?: string;

    // Dates
    entryDate?: Date | null;
    term?: Date | null;

    // Services
    services?: Array<{
      description: string;
      startedAt?: Date | null;
      finishedAt?: Date | null;
    }>;

    // Cuts
    cuts?: Array<{
      name: string;
      quantity: number;
      description?: string;
      width?: number;
      height?: number;
      observations?: string;
    }>;

    // Airbrushing
    airbrushing?: {
      description: string;
      complexity: string;
      estimatedTime?: number;
      observations?: string;
    } | null;

    // Paint selections
    generalPaintingId?: string;
    logoPaintIds?: string[];

    // Truck information
    truck?: {
      xPosition?: number | null;
      yPosition?: number | null;
      garageId?: string | null;
    };

    // File references
    artworkIds?: string[];
  };
}

// Schema definitions for all form sections
const taskFormFilterConfig = {
  // Basic Information
  name: {
    schema: z.string().default(""),
    defaultValue: "",
    debounceMs: 800, // Increased debounce to avoid URL updates interfering with typing
  },
  customerId: {
    schema: z.string().uuid().optional(),
    defaultValue: undefined as string | undefined,
    debounceMs: 0,
  },
  sectorId: {
    schema: z.string().uuid().optional(),
    defaultValue: undefined as string | undefined,
    debounceMs: 0,
  },
  serialNumber: {
    schema: z.string().default(""),
    defaultValue: "",
    debounceMs: 800, // Increased debounce to avoid URL updates interfering with typing
  },
  details: {
    schema: z.string().default(""),
    defaultValue: "",
    debounceMs: 1000, // Increased debounce for large text fields
  },

  // Dates
  entryDate: {
    schema: z.coerce.date().nullable().optional(),
    defaultValue: undefined as Date | null | undefined,
    debounceMs: 0,
  },
  term: {
    schema: z.coerce.date().nullable().optional(),
    defaultValue: undefined as Date | null | undefined,
    debounceMs: 0,
  },

  // Services - Array of service objects
  services: {
    schema: z
      .array(
        z.object({
          description: z.string().min(1),
          startedAt: z.coerce.date().nullable().optional(),
          finishedAt: z.coerce.date().nullable().optional(),
        }),
      )
      .default([]),
    defaultValue: [] as Array<{
      description: string;
      startedAt?: Date | null;
      finishedAt?: Date | null;
    }>,
    debounceMs: 1000, // Increased debounce for array data
  },

  // Cuts - Array of cut objects with measurements
  cuts: {
    schema: z
      .array(
        z.object({
          name: z.string().min(1),
          quantity: z.number().min(1).default(1),
          description: z.string().optional(),
          width: z.number().min(0).optional(),
          height: z.number().min(0).optional(),
          observations: z.string().optional(),
        }),
      )
      .default([]),
    defaultValue: [] as Array<{
      name: string;
      quantity: number;
      description?: string;
      width?: number;
      height?: number;
      observations?: string;
    }>,
    debounceMs: 1000, // Increased debounce for array data
  },

  // Airbrushing - Single object (nullable)
  airbrushing: {
    schema: z
      .object({
        description: z.string().min(1),
        complexity: z.string(),
        estimatedTime: z.number().min(0).optional(),
        observations: z.string().optional(),
      })
      .nullable()
      .optional(),
    defaultValue: null as {
      description: string;
      complexity: string;
      estimatedTime?: number;
      observations?: string;
    } | null,
    debounceMs: 1000, // Increased debounce for complex objects
  },

  // Paint Selections
  generalPaintingId: {
    schema: z.string().uuid().optional(),
    defaultValue: undefined as string | undefined,
    debounceMs: 0,
  },
  logoPaintIds: {
    schema: z.array(z.string().uuid()).default([]),
    defaultValue: [] as string[],
    debounceMs: 0,
  },

  // Truck Information
  truck: {
    schema: z
      .object({
        xPosition: z.number().nullable().optional(),
        yPosition: z.number().nullable().optional(),
        garageId: z.string().uuid().nullable().optional(),
      })
      .optional(),
    defaultValue: {
      xPosition: null,
      yPosition: null,
      garageId: null,
    } as {
      xPosition?: number | null;
      yPosition?: number | null;
      garageId?: string | null;
    },
    debounceMs: 300,
  },

  // File Upload References (not actual files)
  artworkIds: {
    schema: z.array(z.string().uuid()).default([]),
    defaultValue: [] as string[],
    debounceMs: 0,
  },
} as const;

export function useTaskFormUrlState(options: UseTaskFormUrlStateOptions = {}) {
  const { initialData } = options;

  // Update config with initial data if provided
  const configWithDefaults = useMemo(() => {
    const config = { ...taskFormFilterConfig };

    if (initialData) {
      if (initialData.name !== undefined) {
        config.name = { ...config.name, defaultValue: initialData.name as "" };
      }
      if (initialData.customerId !== undefined) {
        config.customerId = { ...config.customerId, defaultValue: initialData.customerId };
      }
      if (initialData.sectorId !== undefined) {
        config.sectorId = { ...config.sectorId, defaultValue: initialData.sectorId };
      }
      if (initialData.serialNumber !== undefined) {
        config.serialNumber = { ...config.serialNumber, defaultValue: initialData.serialNumber as "" };
      }
      if (initialData.details !== undefined) {
        config.details = { ...config.details, defaultValue: initialData.details as "" };
      }
      if (initialData.entryDate !== undefined) {
        config.entryDate = { ...config.entryDate, defaultValue: initialData.entryDate };
      }
      if (initialData.term !== undefined) {
        config.term = { ...config.term, defaultValue: initialData.term };
      }
      if (initialData.services !== undefined) {
        config.services = { ...config.services, defaultValue: initialData.services };
      }
      if (initialData.cuts !== undefined) {
        config.cuts = { ...config.cuts, defaultValue: initialData.cuts };
      }
      if (initialData.airbrushing !== undefined) {
        config.airbrushing = { ...config.airbrushing, defaultValue: initialData.airbrushing };
      }
      if (initialData.generalPaintingId !== undefined) {
        config.generalPaintingId = { ...config.generalPaintingId, defaultValue: initialData.generalPaintingId };
      }
      if (initialData.logoPaintIds !== undefined) {
        config.logoPaintIds = { ...config.logoPaintIds, defaultValue: initialData.logoPaintIds };
      }
      if (initialData.truck !== undefined) {
        config.truck = { ...config.truck, defaultValue: initialData.truck };
      }
      if (initialData.artworkIds !== undefined) {
        config.artworkIds = { ...config.artworkIds, defaultValue: initialData.artworkIds };
      }
    }

    return config;
  }, [initialData]);

  const { filters, setFilter, setFilters, resetFilter, resetFilters, isFilterActive, activeFilterCount } = useUrlFilters(configWithDefaults);

  // Extract state values
  const name = filters.name || "";
  const customerId = filters.customerId;
  const sectorId = filters.sectorId;
  const serialNumber = filters.serialNumber || "";
  const details = filters.details || "";
  const entryDate = filters.entryDate;
  const term = filters.term;
  const services = filters.services || [];
  const cuts = filters.cuts || [];
  const airbrushing = filters.airbrushing;
  const generalPaintingId = filters.generalPaintingId;
  const logoPaintIds = filters.logoPaintIds || [];
  const truck = filters.truck || { xPosition: null, yPosition: null, garageId: null };
  const artworkIds = filters.artworkIds || [];

  // Update functions
  const updateName = useCallback(
    (value: string) => {
      setFilter("name", value === "" ? undefined : value);
    },
    [setFilter],
  );

  const updateCustomerId = useCallback(
    (id: string | undefined) => {
      setFilter("customerId", id);
    },
    [setFilter],
  );

  const updateSectorId = useCallback(
    (id: string | undefined) => {
      setFilter("sectorId", id);
    },
    [setFilter],
  );

  const updateSerialNumber = useCallback(
    (value: string) => {
      setFilter("serialNumber", value === "" ? undefined : value);
    },
    [setFilter],
  );

  const updateDetails = useCallback(
    (value: string) => {
      setFilter("details", value === "" ? undefined : value);
    },
    [setFilter],
  );

  const updateEntryDate = useCallback(
    (date: Date | null | undefined) => {
      setFilter("entryDate", date);
    },
    [setFilter],
  );

  const updateTerm = useCallback(
    (date: Date | null | undefined) => {
      setFilter("term", date);
    },
    [setFilter],
  );

  const updateServices = useCallback(
    (newServices: typeof services) => {
      setFilter("services", newServices.length > 0 ? newServices : undefined);
    },
    [setFilter],
  );

  const updateCuts = useCallback(
    (newCuts: typeof cuts) => {
      setFilter("cuts", newCuts.length > 0 ? newCuts : undefined);
    },
    [setFilter],
  );

  const updateAirbrushing = useCallback(
    (airbrushingData: typeof airbrushing) => {
      setFilter("airbrushing", airbrushingData);
    },
    [setFilter],
  );

  const updateGeneralPaintingId = useCallback(
    (id: string | undefined) => {
      setFilter("generalPaintingId", id);
    },
    [setFilter],
  );

  const updateLogoPaintIds = useCallback(
    (ids: string[]) => {
      setFilter("logoPaintIds", ids.length > 0 ? ids : undefined);
    },
    [setFilter],
  );

  const updateTruck = useCallback(
    (truckData: typeof truck) => {
      setFilter("truck", truckData);
    },
    [setFilter],
  );

  const updateArtworkIds = useCallback(
    (ids: string[]) => {
      setFilter("artworkIds", ids.length > 0 ? ids : undefined);
    },
    [setFilter],
  );

  // Service management helpers
  const addService = useCallback(() => {
    const newService = {
      description: "",
      startedAt: null,
      finishedAt: null,
    };
    updateServices([...services, newService]);
  }, [services, updateServices]);

  const removeService = useCallback(
    (index: number) => {
      const newServices = services.filter((_, i) => i !== index);
      updateServices(newServices);
    },
    [services, updateServices],
  );

  const updateService = useCallback(
    (index: number, serviceData: Partial<(typeof services)[0]>) => {
      const newServices = services.map((service, i) => (i === index ? { ...service, ...serviceData } : service));
      updateServices(newServices);
    },
    [services, updateServices],
  );

  // Cut management helpers
  const addCut = useCallback(() => {
    const newCut = {
      name: "",
      quantity: 1,
      description: "",
      observations: "",
    };
    updateCuts([...cuts, newCut]);
  }, [cuts, updateCuts]);

  const removeCut = useCallback(
    (index: number) => {
      const newCuts = cuts.filter((_, i) => i !== index);
      updateCuts(newCuts);
    },
    [cuts, updateCuts],
  );

  const updateCut = useCallback(
    (index: number, cutData: Partial<(typeof cuts)[0]>) => {
      const newCuts = cuts.map((cut, i) => (i === index ? { ...cut, ...cutData } : cut));
      updateCuts(newCuts);
    },
    [cuts, updateCuts],
  );

  // Logo paint management helpers
  const toggleLogoPaint = useCallback(
    (paintId: string) => {
      const currentIds = logoPaintIds;
      if (currentIds.includes(paintId)) {
        updateLogoPaintIds(currentIds.filter((id) => id !== paintId));
      } else {
        updateLogoPaintIds([...currentIds, paintId]);
      }
    },
    [logoPaintIds, updateLogoPaintIds],
  );

  // Form validation logic
  const validation = useMemo((): TaskFormValidationState => {
    const errors: TaskFormValidationState["errors"] = {};
    let isValid = true;

    // Validate name (only required field)
    if (!name.trim() || name.length < 3) {
      errors.name = "Nome da tarefa é obrigatório (mínimo 3 caracteres)";
      isValid = false;
    } else if (name.length > 200) {
      errors.name = "Nome deve ter no máximo 200 caracteres";
      isValid = false;
    }

    // Validate dates
    if (entryDate && term && term <= entryDate) {
      errors.term = "Prazo deve ser posterior à data de entrada";
      isValid = false;
    }

    // Validate services (only if services are provided, ensure they have descriptions)
    if (services.length > 0) {
      const hasInvalidService = services.some((service) => !service.description.trim());
      if (hasInvalidService) {
        errors.services = "Todos os serviços devem ter descrição";
        isValid = false;
      }
    }

    // Validate cuts
    const cutErrors: Record<number, { name?: string; quantity?: string; measurements?: string }> = {};
    cuts.forEach((cut, index) => {
      const cutError: { name?: string; quantity?: string; measurements?: string } = {};

      if (!cut.name.trim()) {
        cutError.name = "Nome do corte é obrigatório";
        isValid = false;
      }

      if (!cut.quantity || cut.quantity <= 0) {
        cutError.quantity = "Quantidade deve ser maior que 0";
        isValid = false;
      }

      if (Object.keys(cutError).length > 0) {
        cutErrors[index] = cutError;
      }
    });

    if (Object.keys(cutErrors).length > 0) {
      errors.cuts = cutErrors;
    }

    // Validate airbrushing if present
    if (airbrushing) {
      const airbrushingError: { description?: string } = {};

      if (!airbrushing.description.trim()) {
        airbrushingError.description = "Descrição da aerografia é obrigatória";
        isValid = false;
      }

      if (Object.keys(airbrushingError).length > 0) {
        errors.airbrushing = airbrushingError;
      }
    }

    // Truck validation (position only - dimensions removed)
    // No specific truck validation needed for position fields

    return {
      isValid,
      errors,
    };
  }, [name, customerId, entryDate, term, services, cuts, airbrushing, truck]);

  // Get form data for submission
  const getFormData = useCallback(() => {
    return {
      // Basic information
      name: name.trim(),
      status: TASK_STATUS.PENDING,
      customerId: customerId || undefined,
      sectorId: sectorId || undefined,
      serialNumber: serialNumber.trim() || undefined,
      details: details.trim() || undefined,

      // Dates
      entryDate: entryDate || undefined,
      term: term || undefined,

      // Services
      services: services.length > 0 ? services : undefined,

      // Cuts
      cuts: cuts.length > 0 ? cuts : undefined,

      // Airbrushing
      airbrushing: airbrushing || undefined,

      // Paint selections
      generalPaintingId: generalPaintingId || undefined,
      paintIds: logoPaintIds.length > 0 ? logoPaintIds : undefined,

      // Truck
      truck: truck,

      // Files
      artworkIds: artworkIds.length > 0 ? artworkIds : undefined,
    };
  }, [name, customerId, sectorId, serialNumber, details, entryDate, term, services, cuts, airbrushing, generalPaintingId, logoPaintIds, truck, artworkIds]);

  const resetForm = useCallback(() => {
    resetFilters();
  }, [resetFilters]);

  // Check if form has any data
  const hasFormData = useMemo(() => {
    return (
      name.trim() !== "" ||
      customerId !== undefined ||
      sectorId !== undefined ||
      serialNumber.trim() !== "" ||
      details.trim() !== "" ||
      entryDate !== undefined ||
      term !== undefined ||
      services.length > 0 ||
      cuts.length > 0 ||
      airbrushing !== null ||
      generalPaintingId !== undefined ||
      logoPaintIds.length > 0 ||
      artworkIds.length > 0 ||
      truck.xPosition !== null ||
      truck.yPosition !== null ||
      truck.garageId !== null
    );
  }, [name, customerId, sectorId, serialNumber, details, entryDate, term, services, cuts, airbrushing, generalPaintingId, logoPaintIds, artworkIds, truck]);

  return {
    // Core Form State
    name,
    customerId,
    sectorId,
    serialNumber,
    details,
    entryDate,
    term,
    services,
    cuts,
    airbrushing,
    generalPaintingId,
    logoPaintIds,
    truck,
    artworkIds,
    validation,

    // Update Functions
    updateName,
    updateCustomerId,
    updateSectorId,
    updateSerialNumber,
    updateDetails,
    updateEntryDate,
    updateTerm,
    updateServices,
    updateCuts,
    updateAirbrushing,
    updateGeneralPaintingId,
    updateLogoPaintIds,
    updateTruck,
    updateArtworkIds,

    // Helper Functions
    addService,
    removeService,
    updateService,
    addCut,
    removeCut,
    updateCut,
    toggleLogoPaint,

    // Form Management
    getFormData,
    resetForm,
    hasFormData,

    // Computed Values
    serviceCount: services.length,
    cutCount: cuts.length,
    hasAirbrushing: airbrushing !== null,
    hasGeneralPainting: generalPaintingId !== undefined,
    logoPaintCount: logoPaintIds.length,
    artworkCount: artworkIds.length,

    // URL State Management Functions
    resetFilter,
    resetFilters,
    isFilterActive,
    activeFilterCount,

    // Raw Filters Access (for advanced usage)
    filters,
    setFilter,
    setFilters,
  };
}
