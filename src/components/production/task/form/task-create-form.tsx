import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  IconLoader2,
  IconArrowLeft,
  IconCheck,
  IconClipboardList,
  IconInfoCircle,
  IconTruck,
  IconBox,
  IconPalette,
  IconFile,
  IconRuler,
  IconFileInvoice,
  IconUser,
  IconNotes,
} from "@tabler/icons-react";
import type { TaskCreateFormData } from "../../../../schemas";
import { useTaskMutations } from "../../../../hooks";
import {
  TASK_STATUS,
  TRUCK_CATEGORY,
  IMPLEMENT_TYPE,
  TRUCK_CATEGORY_LABELS,
  IMPLEMENT_TYPE_LABELS,
  SERVICE_ORDER_STATUS,
  SERVICE_ORDER_TYPE,
  SECTOR_PRIVILEGES,
} from "../../../../constants";
import { useAuth } from "../../../../contexts/auth-context";
import { useAccordionScroll } from "@/lib/scroll-utils";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { Combobox } from "@/components/ui/combobox";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { CustomerSelector } from "./customer-selector";
import { PlateTagsInput } from "./plate-tags-input";
import { SerialNumberRangeInput } from "./serial-number-range-input";
import { TaskNameAutocomplete } from "./task-name-autocomplete";
import { ServiceSelectorAutoGrouped } from "./service-selector-auto-grouped";
import { PricingSelector, type PricingSelectorRef } from "../pricing/pricing-selector";
import { GeneralPaintingSelector } from "./general-painting-selector";
import { LogoPaintsSelector } from "./logo-paints-selector";
import { LayoutForm } from "@/components/production/layout/layout-form";
import { RepresentativeManager } from "@/components/administration/customer/representative";
import { FileUploadField, type FileWithPreview } from "@/components/common/file";
import { ArtworkFileUploadField } from "./artwork-file-upload-field";
import type { RepresentativeRowData } from "@/types/representative";
import { RepresentativeRole } from "@/types/representative";
import { useUnsavedChangesGuard } from "@/hooks/common/use-unsaved-changes-guard";
import { UnsavedChangesDialog } from "@/components/ui/unsaved-changes-dialog";
import { toast } from "sonner";
import { getUniqueDescriptions } from "../../../../api-client/serviceOrder";
import { uploadSingleFile } from "../../../../api-client/file";
import {
  normalizeDescription,
  getPricingItemsToAddFromServiceOrders,
  getServiceOrdersToAddFromPricingItems,
  type SyncServiceOrder,
  type SyncPricingItem,
} from "../../../../utils/task-pricing-service-order-sync";

// Extended form schema for the UI (superset of fields for the accordion form)
const taskCreateFormSchema = z.object({
  status: z.string(),
  name: z.string(),
  customerId: z.string().optional(),
  details: z.string().nullable().optional(),
  plates: z.array(z.string()).default([]),
  serialNumbers: z.array(z.number()).default([]),
  category: z.string().optional(),
  implementType: z.string().optional(),
  forecastDate: z.date().nullable().optional(),
  term: z.date().nullable().optional(),
  paintId: z.string().nullable().optional(),
  paintIds: z.array(z.string()).optional(),
  serviceOrders: z.array(z.any()).optional(),
  pricing: z.any().optional(),
}).refine((data) => {
  return data.plates.length > 0 || data.serialNumbers.length > 0 || data.name || data.customerId;
}, {
  message: "Pelo menos um dos seguintes campos deve ser preenchido: Placas, Números de série, Nome ou Cliente",
  path: ["name"],
});

type TaskCreateFormSchemaType = z.infer<typeof taskCreateFormSchema>;

export const TaskCreateForm = () => {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sector-based visibility
  const isCommercialUser = user?.sector?.privileges === SECTOR_PRIVILEGES.COMMERCIAL;
  const isLogisticUser = user?.sector?.privileges === SECTOR_PRIVILEGES.LOGISTIC;
  const isAdminUser = user?.sector?.privileges === SECTOR_PRIVILEGES.ADMIN;

  const showRepresentatives = isAdminUser || isCommercialUser;
  const showPaint = isAdminUser || isCommercialUser;
  const showLogoPaints = isAdminUser; // Commercial can't see logo paints
  const showLayout = isAdminUser || isLogisticUser;
  const showPricing = isAdminUser || isCommercialUser;
  const showArtworks = isAdminUser || isCommercialUser;

  // Initialize form
  const form = useForm<TaskCreateFormSchemaType>({
    resolver: zodResolver(taskCreateFormSchema),
    mode: "onChange",
    defaultValues: {
      status: TASK_STATUS.PREPARATION,
      name: "",
      customerId: "",
      details: "",
      plates: [],
      serialNumbers: [],
      category: "",
      implementType: IMPLEMENT_TYPE.REFRIGERATED,
      forecastDate: null,
      term: null,
      paintId: null,
      paintIds: [],
      serviceOrders: [
        {
          description: "Em Negociação",
          type: SERVICE_ORDER_TYPE.COMMERCIAL,
          status: SERVICE_ORDER_STATUS.PENDING,
          statusOrder: 1,
          assignedToId: null,
          shouldSync: false,
        },
      ],
      pricing: {
        expiresAt: (() => {
          const date = new Date();
          date.setDate(date.getDate() + 30);
          date.setHours(23, 59, 59, 999);
          return date;
        })(),
        status: 'DRAFT',
        subtotal: 0,
        discountType: 'NONE',
        discountValue: null,
        total: 0,
        paymentCondition: null,
        downPaymentDate: null,
        customPaymentText: null,
        guaranteeYears: null,
        customGuaranteeText: null,
        customForecastDays: null,
        layoutFileId: null,
        items: [{ description: "", amount: null, observation: null, shouldSync: true }],
      },
    },
  });

  // Mutations
  const { createAsync } = useTaskMutations();

  // Watch form values for task count calculation and conditional rendering
  const plates = useWatch({ control: form.control, name: "plates" }) || [];
  const serialNumbers = useWatch({ control: form.control, name: "serialNumbers" }) || [];
  const customerIdValue = useWatch({ control: form.control, name: "customerId" });

  // Watch service orders and pricing for sync
  const servicesValues = useWatch({ control: form.control, name: "serviceOrders" });
  const pricingValues = useWatch({ control: form.control, name: "pricing" });

  // Accordion state
  const [openAccordion, setOpenAccordion] = useState<string | undefined>("basic-information");
  const { scrollToAccordion } = useAccordionScroll();

  useEffect(() => {
    if (openAccordion) {
      scrollToAccordion(openAccordion);
    }
  }, [openAccordion, scrollToAccordion]);

  // Representatives state
  const [representativeRows, setRepresentativeRows] = useState<RepresentativeRowData[]>([{
    id: `temp-${Date.now()}-0`,
    name: '',
    phone: '',
    email: '',
    role: 'COMMERCIAL' as RepresentativeRole,
    isActive: true,
    isNew: true,
    isEditing: false,
    isSaving: false,
    error: null,
  }]);

  const handleRepresentativeRowsChange = useCallback((rows: RepresentativeRowData[]) => {
    setRepresentativeRows(rows);
  }, []);

  // Layout state
  const [selectedLayoutSide, setSelectedLayoutSide] = useState<"left" | "right" | "back">("left");
  const [hasLayoutChanges, setHasLayoutChanges] = useState(false);
  const [currentLayoutStates, setCurrentLayoutStates] = useState<Record<'left' | 'right' | 'back', any>>({
    left: {
      height: 2.4,
      layoutSections: [{ width: 8.0, isDoor: false, doorHeight: null, position: 0 }],
      photoId: null,
    },
    right: {
      height: 2.4,
      layoutSections: [{ width: 8.0, isDoor: false, doorHeight: null, position: 0 }],
      photoId: null,
    },
    back: {
      height: 2.42,
      layoutSections: [{ width: 2.42, isDoor: false, doorHeight: null, position: 0 }],
      photoId: null,
    },
  });
  const [modifiedLayoutSides, setModifiedLayoutSides] = useState<Set<'left' | 'right' | 'back'>>(new Set());
  const [layoutWidthError, setLayoutWidthError] = useState<string | null>(null);

  // Layout width validation
  useEffect(() => {
    const leftLayout = currentLayoutStates.left;
    const rightLayout = currentLayoutStates.right;
    const leftSections = leftLayout?.layoutSections;
    const rightSections = rightLayout?.layoutSections;

    if (leftSections && leftSections.length > 0 && rightSections && rightSections.length > 0) {
      const leftTotalWidth = leftSections.reduce((sum: number, s: any) => sum + (s.width || 0), 0);
      const rightTotalWidth = rightSections.reduce((sum: number, s: any) => sum + (s.width || 0), 0);
      const widthDifference = Math.abs(leftTotalWidth - rightTotalWidth);
      const maxAllowedDifference = 0.02;

      if (widthDifference > maxAllowedDifference) {
        setLayoutWidthError(`O layout possui diferença de largura maior que 2cm entre os lados. Lado Motorista: ${(leftTotalWidth * 100).toFixed(0)}cm, Lado Sapo: ${(rightTotalWidth * 100).toFixed(0)}cm (diferença de ${(widthDifference * 100).toFixed(1)}cm).`);
      } else {
        setLayoutWidthError(null);
      }
    } else {
      setLayoutWidthError(null);
    }
  }, [currentLayoutStates]);

  // Pricing state
  const pricingSelectorRef = useRef<PricingSelectorRef>(null);
  const [pricingItemCount, setPricingItemCount] = useState(0);

  // File upload states - base files
  const [baseFiles, setBaseFiles] = useState<FileWithPreview[]>([]);
  const [baseFileIds, setBaseFileIds] = useState<string[]>([]);

  const handleBaseFilesChange = useCallback((files: FileWithPreview[]) => {
    setBaseFiles(files);
    setBaseFileIds(files.filter(f => f.uploaded && f.uploadedFileId).map(f => f.uploadedFileId!));
  }, []);

  // File upload states - artworks
  const [uploadedFiles, setUploadedFiles] = useState<FileWithPreview[]>([]);
  const [uploadedFileIds, setUploadedFileIds] = useState<string[]>([]);
  const [artworkStatuses, setArtworkStatuses] = useState<Record<string, string>>({});

  const handleFilesChange = useCallback((files: FileWithPreview[]) => {
    setUploadedFiles(files);
    setUploadedFileIds(files.filter(f => f.uploaded && f.uploadedFileId).map(f => f.uploadedFileId!));
  }, []);

  // Pricing layout files
  const [pricingLayoutFiles, setPricingLayoutFiles] = useState<FileWithPreview[]>([]);

  // =====================================================================
  // SERVICE ORDER ↔ PRICING BIDIRECTIONAL SYNC (ported from edit form)
  // =====================================================================

  // Sync refs
  const isFormInitializedRef = useRef<boolean>(false);
  const isSyncingRef = useRef<boolean>(false);
  const isSubmittingRef = useRef<boolean>(false);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSyncedServiceOrderCountRef = useRef<number>(0);
  const lastSyncedPricingItemCountRef = useRef<number>(0);
  const historicalDescriptionsRef = useRef<string[]>([]);

  // Track deleted items to prevent sync from recreating them
  const deletedServiceOrderDescriptionsRef = useRef<Set<string>>(new Set());
  const deletedPricingItemDescriptionsRef = useRef<Set<string>>(new Set());

  // Track previous observation values to detect which side changed
  const prevSOObservationsRef = useRef<Map<string, string | null>>(new Map());
  const prevPIObservationsRef = useRef<Map<string, string | null>>(new Map());

  // Callbacks to track deleted items from child components
  const handleServiceOrderDeleted = useCallback((description: string) => {
    const normalizedDesc = normalizeDescription(description);
    if (normalizedDesc) {
      deletedServiceOrderDescriptionsRef.current.add(normalizedDesc);
      if (lastSyncedServiceOrderCountRef.current > 0) {
        lastSyncedServiceOrderCountRef.current -= 1;
      }
    }
  }, []);

  const handlePricingItemDeleted = useCallback((description: string) => {
    const normalizedDesc = normalizeDescription(description);
    if (normalizedDesc) {
      deletedPricingItemDescriptionsRef.current.add(normalizedDesc);
      if (lastSyncedPricingItemCountRef.current > 0) {
        lastSyncedPricingItemCountRef.current -= 1;
      }
    }
  }, []);

  // Reorder synced pricing items to match PRODUCTION service order reorder
  const handleProductionReorder = useCallback((descriptions: string[]) => {
    const currentPricingItems = ((form.getValues('pricing') as any)?.items as any[]) || [];
    if (currentPricingItems.length === 0) return;

    // Build a map: normalized description → target order index
    const orderMap = new Map<string, number>();
    descriptions.forEach((desc, idx) => {
      orderMap.set(normalizeDescription(desc), idx);
    });

    // Separate synced (matched) and unsynced pricing items, keeping original indices
    const synced: { item: any; orderIdx: number; origIdx: number }[] = [];

    currentPricingItems.forEach((item: any, origIdx: number) => {
      const normalized = normalizeDescription(item.description || '');
      const orderIdx = orderMap.get(normalized);
      if (orderIdx !== undefined && item.shouldSync !== false) {
        synced.push({ item, orderIdx, origIdx });
      }
    });

    if (synced.length < 2) return; // Nothing to reorder

    // Sort synced items by the new order
    synced.sort((a, b) => a.orderIdx - b.orderIdx);

    // Reconstruct: place synced items back into the same slot positions they originally occupied
    const syncedSlots = synced.map(s => s.origIdx).sort((a, b) => a - b);
    const newItems = [...currentPricingItems];
    syncedSlots.forEach((slot, i) => {
      newItems[slot] = synced[i].item;
    });

    // Use PricingSelector's useFieldArray replace method instead of form.setValue
    // to ensure proper sync with useFieldArray's internal state
    if (pricingSelectorRef.current) {
      pricingSelectorRef.current.replaceItems(newItems);
    } else {
      form.setValue('pricing.items', newItems, { shouldDirty: true });
    }
  }, [form]);

  // Fetch historical PRODUCTION service order descriptions on mount
  useEffect(() => {
    const fetchHistoricalDescriptions = async () => {
      try {
        const response = await getUniqueDescriptions({ type: SERVICE_ORDER_TYPE.PRODUCTION, limit: 200 });
        if (response.success && response.data) {
          historicalDescriptionsRef.current = response.data;
        }
      } catch (error) {
        // Silent fail - sync will still work without historical data
      }
    };
    fetchHistoricalDescriptions();
  }, []);

  // Initialize sync refs on first render
  useEffect(() => {
    if (!isFormInitializedRef.current) {
      const currentServiceOrders = (servicesValues as any[]) || [];
      const currentPricingItems = ((pricingValues as any)?.items as any[]) || [];

      const validServiceOrders = currentServiceOrders.filter(
        (so: any) => so.type === SERVICE_ORDER_TYPE.PRODUCTION && so.description?.trim().length >= 3
      );
      const validPricingItems = currentPricingItems.filter(
        (item: any) => item.description?.trim().length >= 3
      );

      lastSyncedServiceOrderCountRef.current = validServiceOrders.length;
      lastSyncedPricingItemCountRef.current = validPricingItems.length;

      // Initialize previous observation maps
      const initialSOObsMap = new Map<string, string | null>();
      for (const so of validServiceOrders) {
        const normalizedDesc = normalizeDescription(so.description);
        if (normalizedDesc) {
          initialSOObsMap.set(normalizedDesc, so.observation || null);
        }
      }
      prevSOObservationsRef.current = initialSOObsMap;

      const initialPIObsMap = new Map<string, string | null>();
      for (const item of validPricingItems) {
        const normalizedDesc = normalizeDescription(item.description);
        if (normalizedDesc) {
          initialPIObsMap.set(normalizedDesc, item.observation || null);
        }
      }
      prevPIObservationsRef.current = initialPIObsMap;

      setTimeout(() => {
        isFormInitializedRef.current = true;
      }, 1000);
    }
  }, []); // Only run once on mount

  // Debounced sync effect - only runs after user stops typing for 1.5 seconds
  useEffect(() => {
    if (!isFormInitializedRef.current || isSyncingRef.current || isSubmittingRef.current) return;

    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    syncTimeoutRef.current = setTimeout(() => {
      if (isSubmittingRef.current) return;

      const currentServiceOrders = (servicesValues as any[]) || [];
      const currentPricingItems = ((pricingValues as any)?.items as any[]) || [];

      const validServiceOrders = currentServiceOrders.filter(
        (so: any) => so.type === SERVICE_ORDER_TYPE.PRODUCTION && so.description?.trim().length >= 3
      );
      const validPricingItems = currentPricingItems.filter(
        (item: any) => item.description?.trim().length >= 3
      );

      const currentSOCount = validServiceOrders.length;
      const currentPricingCount = validPricingItems.length;

      const serviceOrdersAdded = currentSOCount > lastSyncedServiceOrderCountRef.current;
      const pricingItemsAdded = currentPricingCount > lastSyncedPricingItemCountRef.current;

      isSyncingRef.current = true;

      try {
        const syncServiceOrders: SyncServiceOrder[] = validServiceOrders.map((so: any) => ({
          id: so.id,
          description: so.description || '',
          observation: so.observation || null,
          type: so.type,
          status: so.status || SERVICE_ORDER_STATUS.PENDING,
          statusOrder: so.statusOrder || 1,
          shouldSync: so.shouldSync !== false,
        }));

        const syncPricingItems: SyncPricingItem[] = validPricingItems.map((item: any) => ({
          id: item.id,
          description: item.description || '',
          observation: item.observation || null,
          amount: item.amount || 0,
          shouldSync: item.shouldSync !== false,
        }));

        const filterEmptyPricingItems = (items: any[]) => items.filter((item: any) => {
          const hasDescription = item.description && item.description.trim() !== "";
          const hasAmount = item.amount !== null && item.amount !== undefined && item.amount > 0;
          return hasDescription || hasAmount;
        });

        const filterEmptyServiceOrders = (orders: any[]) => orders.filter((so: any) => {
          return so.description && so.description.trim().length >= 3;
        });

        // Observation sync with change detection
        const currentSOObsMap = new Map<string, string | null>();
        for (const so of syncServiceOrders) {
          const normalizedDesc = normalizeDescription(so.description);
          if (normalizedDesc) {
            currentSOObsMap.set(normalizedDesc, so.observation || null);
          }
        }

        const currentPIObsMap = new Map<string, string | null>();
        for (const item of syncPricingItems) {
          const normalizedDesc = normalizeDescription(item.description);
          if (normalizedDesc) {
            currentPIObsMap.set(normalizedDesc, item.observation || null);
          }
        }

        const soObsChangedDescs = new Set<string>();
        const piObsChangedDescs = new Set<string>();

        for (const [desc, obs] of currentSOObsMap) {
          const prevObs = prevSOObservationsRef.current.get(desc);
          const normalizedPrev = prevObs || null;
          const normalizedCurrent = obs || null;
          if (normalizedPrev !== normalizedCurrent) {
            soObsChangedDescs.add(desc);
          }
        }

        for (const [desc, obs] of currentPIObsMap) {
          const prevObs = prevPIObservationsRef.current.get(desc);
          const normalizedPrev = prevObs || null;
          const normalizedCurrent = obs || null;
          if (normalizedPrev !== normalizedCurrent) {
            piObsChangedDescs.add(desc);
          }
        }

        // Sync observations: SO→PI if SO changed, PI→SO if PI changed
        let pricingObservationsUpdated = false;
        const pricingItemsWithSyncedObs = currentPricingItems.map((item: any) => {
          if (!item.description || item.description.trim().length < 3) return item;
          const normalizedDesc = normalizeDescription(item.description);
          if (soObsChangedDescs.has(normalizedDesc) && !piObsChangedDescs.has(normalizedDesc)) {
            const soObs = currentSOObsMap.get(normalizedDesc);
            const currentItemObs = item.observation || null;
            if (currentItemObs !== soObs) {
              pricingObservationsUpdated = true;
              return { ...item, observation: soObs };
            }
          }
          return item;
        });

        let soObservationsUpdated = false;
        const serviceOrdersWithSyncedObs = currentServiceOrders.map((so: any) => {
          if (so.type !== SERVICE_ORDER_TYPE.PRODUCTION) return so;
          if (!so.description || so.description.trim().length < 3) return so;
          const normalizedDesc = normalizeDescription(so.description);
          if (piObsChangedDescs.has(normalizedDesc) && !soObsChangedDescs.has(normalizedDesc)) {
            const piObs = currentPIObsMap.get(normalizedDesc);
            const currentSOObs = so.observation || null;
            if (currentSOObs !== piObs) {
              soObservationsUpdated = true;
              return { ...so, observation: piObs };
            }
          }
          return so;
        });

        // SYNC 1: Service Orders → Pricing Items
        const pricingItemsToAddRaw = serviceOrdersAdded
          ? getPricingItemsToAddFromServiceOrders(syncServiceOrders, syncPricingItems)
          : [];

        const pricingItemsToAdd = pricingItemsToAddRaw.filter((item: any) => {
          const normalizedDesc = normalizeDescription(item.description);
          return !deletedPricingItemDescriptionsRef.current.has(normalizedDesc);
        });

        if (pricingItemsToAdd.length > 0 || pricingObservationsUpdated) {
          const basePricingItems = pricingItemsToAdd.length > 0
            ? filterEmptyPricingItems(pricingItemsWithSyncedObs)
            : pricingItemsWithSyncedObs;
          const finalPricingItems = [...basePricingItems, ...pricingItemsToAdd];

          // Use PricingSelector's useFieldArray replace method instead of form.setValue
          if (pricingSelectorRef.current) {
            pricingSelectorRef.current.replaceItems(finalPricingItems);
          } else {
            form.setValue('pricing.items', finalPricingItems, {
              shouldDirty: true,
              shouldTouch: true,
            });
          }
        }

        // SYNC 2: Pricing Items → Service Orders
        const serviceOrdersToAddRaw = pricingItemsAdded
          ? getServiceOrdersToAddFromPricingItems(syncPricingItems, syncServiceOrders, historicalDescriptionsRef.current)
          : [];

        const serviceOrdersToAdd = serviceOrdersToAddRaw.filter((so: any) => {
          const normalizedDesc = normalizeDescription(so.description);
          return !deletedServiceOrderDescriptionsRef.current.has(normalizedDesc);
        });

        if (serviceOrdersToAdd.length > 0 || soObservationsUpdated) {
          const baseServiceOrders = serviceOrdersToAdd.length > 0
            ? filterEmptyServiceOrders(serviceOrdersWithSyncedObs)
            : serviceOrdersWithSyncedObs;
          const finalServiceOrders = [...serviceOrdersToAdd, ...baseServiceOrders];

          form.setValue('serviceOrders', finalServiceOrders, {
            shouldDirty: true,
            shouldTouch: true,
          });
        }

        // Update previous observation refs
        const newPrevSOMap = new Map<string, string | null>();
        const finalSOsForPrevMap = soObservationsUpdated ? serviceOrdersWithSyncedObs : currentServiceOrders;
        for (const so of finalSOsForPrevMap) {
          if (so.type !== SERVICE_ORDER_TYPE.PRODUCTION) continue;
          const normalizedDesc = normalizeDescription(so.description);
          if (normalizedDesc) {
            newPrevSOMap.set(normalizedDesc, so.observation || null);
          }
        }
        prevSOObservationsRef.current = newPrevSOMap;

        const newPrevPIMap = new Map<string, string | null>();
        const finalPIsForPrevMap = pricingObservationsUpdated ? pricingItemsWithSyncedObs : currentPricingItems;
        for (const item of finalPIsForPrevMap) {
          const normalizedDesc = normalizeDescription(item.description);
          if (normalizedDesc) {
            newPrevPIMap.set(normalizedDesc, item.observation || null);
          }
        }
        prevPIObservationsRef.current = newPrevPIMap;

        // Update refs with new counts
        lastSyncedServiceOrderCountRef.current = currentSOCount + serviceOrdersToAdd.length;
        lastSyncedPricingItemCountRef.current = currentPricingCount + pricingItemsToAdd.length;

      } finally {
        setTimeout(() => {
          isSyncingRef.current = false;
        }, 500);
      }
    }, 1500);

    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [servicesValues, pricingValues, form]);

  // Calculate how many tasks will be created
  const taskCount = useMemo(() => {
    const platesCount = plates.length;
    const serialNumbersCount = serialNumbers.length;

    if (platesCount > 0 && serialNumbersCount > 0) {
      return platesCount * serialNumbersCount;
    } else if (platesCount > 0) {
      return platesCount;
    } else if (serialNumbersCount > 0) {
      return serialNumbersCount;
    } else {
      return 1;
    }
  }, [plates, serialNumbers]);

  // Handle form submission
  const handleSubmit = useCallback(
    async (data: TaskCreateFormSchemaType) => {
      try {
        setIsSubmitting(true);
        isSubmittingRef.current = true;

        // Cancel any pending sync
        if (syncTimeoutRef.current) {
          clearTimeout(syncTimeoutRef.current);
        }

        const { plates, serialNumbers, name, customerId, status, category, implementType, forecastDate, term, details, paintId, paintIds } = data;

        // Upload artwork files that haven't been uploaded yet
        const artworkFileIds: string[] = [...uploadedFileIds];
        const remappedArtworkStatuses: Record<string, string> = {};
        for (const file of uploadedFiles) {
          if (file.uploaded && file.uploadedFileId) {
            // Already uploaded - keep existing ID and remap status
            if (artworkStatuses[file.id]) {
              remappedArtworkStatuses[file.uploadedFileId] = artworkStatuses[file.id];
            }
          } else if (!file.error) {
            try {
              const response = await uploadSingleFile(file, { fileContext: 'artwork' });
              if (response.success && response.data) {
                artworkFileIds.push(response.data.id);
                // Remap artwork status from local file ID to backend File ID
                if (artworkStatuses[file.id]) {
                  remappedArtworkStatuses[response.data.id] = artworkStatuses[file.id];
                }
              }
            } catch (error: any) {
              toast.error(`Erro ao enviar artwork ${file.name}: ${error.message}`);
            }
          }
        }

        // Upload base files that haven't been uploaded yet
        const uploadedBaseFileIds: string[] = [...baseFileIds];
        for (const file of baseFiles) {
          if (!file.uploaded && !file.error) {
            try {
              const response = await uploadSingleFile(file, { fileContext: 'basefile' });
              if (response.success && response.data) {
                uploadedBaseFileIds.push(response.data.id);
              }
            } catch (error: any) {
              toast.error(`Erro ao enviar arquivo base ${file.name}: ${error.message}`);
            }
          }
        }

        // Get service orders from form
        const serviceOrdersRaw = data.serviceOrders || [];
        const serviceOrders = serviceOrdersRaw.filter(
          (so: any) => so && so.description && so.description.trim().length >= 3
        );

        // Get pricing from form
        const pricingRaw = data.pricing;
        const hasPricingItems = pricingRaw?.items?.some((item: any) => item.description && item.description.trim().length > 0);

        // Build representative data
        const existingRepIds = representativeRows
          .filter(row => !row.isNew && row.id && row.id.trim() !== '')
          .map(row => row.id);
        const newRepresentatives = representativeRows
          .filter(row => row.isNew && row.name?.trim() && row.phone?.trim())
          .map(row => ({
            name: row.name.trim(),
            phone: row.phone.trim(),
            email: row.email?.trim() || undefined,
            role: row.role,
            isActive: row.isActive,
            customerId: customerIdValue || undefined,
          }));

        // Build layout section data from modified sides (for first task only - creates new layout records)
        const buildLayoutSectionData = () => {
          if (!hasLayoutChanges || modifiedLayoutSides.size === 0) return {};
          const layoutData: any = {};
          for (const side of modifiedLayoutSides) {
            const sideData = currentLayoutStates[side];
            if (sideData) {
              const key = side === "left" ? "leftSideLayout" : side === "right" ? "rightSideLayout" : "backSideLayout";
              layoutData[key] = {
                height: sideData.height,
                layoutSections: sideData.layoutSections || sideData.sections,
                photoId: sideData.photoId || null,
              };
            }
          }
          return layoutData;
        };

        // Build base task data with common fields
        const buildTaskData = (additionalData: Partial<TaskCreateFormData>): TaskCreateFormData => {
          const taskData: TaskCreateFormData = {
            status,
            name: name || undefined,
            customerId: customerId || undefined,
            details: details || undefined,
            forecastDate: forecastDate || undefined,
            term: term || undefined,
            paintId: paintId || undefined,
            paintIds: paintIds && paintIds.length > 0 ? paintIds : undefined,
            artworkIds: artworkFileIds.length > 0 ? artworkFileIds : undefined,
            artworkStatuses: artworkFileIds.length > 0 && Object.keys(remappedArtworkStatuses).length > 0 ? remappedArtworkStatuses : undefined,
            baseFileIds: uploadedBaseFileIds.length > 0 ? uploadedBaseFileIds : undefined,
            representativeIds: existingRepIds.length > 0 ? existingRepIds : undefined,
            // Service orders and pricing are cloned per task (individual instances)
            serviceOrders: serviceOrders.length > 0 ? serviceOrders.map((so: any) => ({
              description: so.description,
              type: so.type,
              status: so.status || SERVICE_ORDER_STATUS.PENDING,
              statusOrder: so.statusOrder || 1,
              assignedToId: so.assignedToId || null,
              shouldSync: so.shouldSync !== false,
            })) : undefined,
            pricing: hasPricingItems ? {
              ...pricingRaw,
              items: pricingRaw.items.filter((item: any) => item.description && item.description.trim().length > 0),
            } : undefined,
            ...additionalData,
          } as TaskCreateFormData;
          return taskData;
        };

        // Build truck object with layout data (sections for first task, IDs for subsequent tasks)
        const buildTruckData = (plate?: string, sharedLayoutIds?: any) => {
          const layoutSectionData = buildLayoutSectionData();
          const hasTruckFields = plate || category || implementType || hasLayoutChanges;
          if (!hasTruckFields) return {};

          if (sharedLayoutIds) {
            // Subsequent tasks: connect to shared layouts by ID
            return {
              truck: {
                ...(plate && { plate }),
                category: category || undefined,
                implementType: implementType || undefined,
                ...sharedLayoutIds,
              },
            };
          } else {
            // First task: create new layout records with section data
            return {
              truck: {
                ...(plate && { plate }),
                category: category || undefined,
                implementType: implementType || undefined,
                ...layoutSectionData,
              },
            };
          }
        };

        // Build the list of plate + serial number combinations
        const combinations: { plate?: string; serialNumber?: string }[] = [];
        if (plates.length > 0 && serialNumbers.length > 0) {
          for (const plate of plates) {
            for (const serialNumber of serialNumbers) {
              combinations.push({ plate, serialNumber: serialNumber.toString() });
            }
          }
        } else if (plates.length > 0) {
          for (const plate of plates) {
            combinations.push({ plate });
          }
        } else if (serialNumbers.length > 0) {
          for (const serialNumber of serialNumbers) {
            combinations.push({ serialNumber: serialNumber.toString() });
          }
        } else {
          combinations.push({});
        }

        // Create all tasks sequentially
        // First task creates layout records; subsequent tasks share them by ID
        let successCount = 0;
        let errorCount = 0;
        let firstCreatedRepIds: string[] | undefined;
        let sharedLayoutIds: any = null;

        for (let i = 0; i < combinations.length; i++) {
          const { plate, serialNumber } = combinations[i];
          const truckData = buildTruckData(plate, i > 0 ? sharedLayoutIds : null);
          const task = buildTaskData({
            ...(serialNumber && { serialNumber }),
            ...truckData,
          });

          // For the first task, include newRepresentatives
          // For subsequent tasks, use the created representative IDs
          if (i === 0 && newRepresentatives.length > 0) {
            (task as any).newRepresentatives = newRepresentatives;
          } else if (i > 0 && firstCreatedRepIds && firstCreatedRepIds.length > 0) {
            const existing = task.representativeIds || [];
            task.representativeIds = [...existing, ...firstCreatedRepIds];
          }

          try {
            const result = await createAsync(task as any);
            if (result?.success) {
              successCount++;

              // After first task, extract shared data for subsequent tasks
              if (i === 0) {
                // Extract representative IDs
                if (newRepresentatives.length > 0 && result.data?.representatives) {
                  firstCreatedRepIds = result.data.representatives
                    .filter((r: any) => newRepresentatives.some(nr => nr.name === r.name && nr.phone === r.phone))
                    .map((r: any) => r.id);
                }
                // Extract layout IDs from the created truck for shared layouts
                if (hasLayoutChanges && result.data?.truck) {
                  const truck = result.data.truck;
                  const ids: any = {};
                  if (truck.leftSideLayoutId) ids.leftSideLayoutId = truck.leftSideLayoutId;
                  if (truck.rightSideLayoutId) ids.rightSideLayoutId = truck.rightSideLayoutId;
                  if (truck.backSideLayoutId) ids.backSideLayoutId = truck.backSideLayoutId;
                  if (Object.keys(ids).length > 0) {
                    sharedLayoutIds = ids;
                  }
                }
              }
            } else {
              errorCount++;
            }
          } catch (error) {
            errorCount++;
          }
        }

        // Show summary message
        if (successCount > 0 && errorCount === 0) {
          toast.success(
            combinations.length === 1
              ? "Tarefa criada com sucesso!"
              : `${successCount} tarefas criadas com sucesso!`
          );
          window.location.href = "/producao/agenda";
        } else if (successCount > 0 && errorCount > 0) {
          toast.warning(
            `${successCount} tarefas criadas, mas ${errorCount} falharam. Verifique os detalhes.`
          );
          window.location.href = "/producao/agenda";
        } else {
          toast.error("Erro ao criar tarefas");
        }
      } catch (error) {
        toast.error("Erro ao criar tarefas");
      } finally {
        setIsSubmitting(false);
        isSubmittingRef.current = false;
      }
    },
    [createAsync, representativeRows, customerIdValue, uploadedFileIds, baseFileIds, uploadedFiles, baseFiles, hasLayoutChanges, modifiedLayoutSides, currentLayoutStates, artworkStatuses],
  );

  // Get form state
  const { formState } = form;
  const hasErrors = Object.keys(formState.errors).length > 0;

  // Unsaved changes guard
  const { showDialog, confirmNavigation, cancelNavigation, guardedNavigate } = useUnsavedChangesGuard({
    isDirty: formState.isDirty,
    isSubmitting,
  });

  const handleCancel = useCallback(() => {
    guardedNavigate("/producao/agenda");
  }, [guardedNavigate]);

  // Navigation actions
  const navigationActions = [
    {
      key: "cancel",
      label: "Cancelar",
      onClick: handleCancel,
      variant: "outline" as const,
      icon: IconArrowLeft,
      disabled: isSubmitting,
    },
    {
      key: "submit",
      label: "Cadastrar",
      icon: isSubmitting ? IconLoader2 : IconCheck,
      onClick: form.handleSubmit(handleSubmit),
      variant: "default" as const,
      disabled: isSubmitting || hasErrors || !!layoutWidthError,
      loading: isSubmitting,
    },
  ];

  return (
    <>
      <div className="container mx-auto max-w-5xl flex-shrink-0">
        <PageHeader
          title="Cadastrar Tarefa"
          icon={IconClipboardList}
          variant="form"
          breadcrumbs={[
            { label: "Início", href: "/" },
            { label: "Produção", href: "/producao" },
            { label: "Agenda", href: "/producao/agenda" },
            { label: "Cadastrar" }
          ]}
          actions={navigationActions}
          onBreadcrumbNavigate={guardedNavigate}
        />
      </div>
      <div className="flex-1 overflow-y-auto pb-6">
        <Form {...form}>
          <form id="task-form-submit" className="container mx-auto max-w-5xl">
            <div className={openAccordion === 'base-files' || openAccordion === 'artworks' ? 'pb-64' : ''}>
              <Accordion
                type="single"
                collapsible
                value={openAccordion}
                onValueChange={setOpenAccordion}
                className="space-y-4"
              >
                {/* 1. Basic Information */}
                <AccordionItem
                  value="basic-information"
                  id="accordion-item-basic-information"
                  className="border border-border rounded-lg"
                >
                  <Card className="border-0">
                    <AccordionTrigger className="px-0 hover:no-underline">
                      <CardHeader className="flex-1 py-4">
                        <CardTitle className="flex items-center gap-2">
                          <IconClipboardList className="h-5 w-5" />
                          Informações Básicas
                        </CardTitle>
                      </CardHeader>
                    </AccordionTrigger>
                    <AccordionContent>
                      <CardContent className="space-y-6 pt-0">
                        {/* Name */}
                        <TaskNameAutocomplete control={form.control} disabled={isSubmitting} />

                        {/* Customer */}
                        <CustomerSelector control={form.control} disabled={isSubmitting} />

                        {/* Truck Category and Implement Type */}
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="category"
                            render={({ field }) => (
                              <FormItem className="flex flex-col">
                                <FormLabel className="flex items-center gap-2">
                                  <IconTruck className="h-4 w-4" />
                                  Categoria do Caminhão
                                </FormLabel>
                                <Combobox
                                  value={field.value || ""}
                                  onValueChange={field.onChange}
                                  options={[
                                    { value: "", label: "Nenhuma" },
                                    ...Object.values(TRUCK_CATEGORY).map((cat) => ({
                                      value: cat,
                                      label: TRUCK_CATEGORY_LABELS[cat],
                                    })),
                                  ]}
                                  placeholder="Selecione a categoria"
                                  searchPlaceholder="Buscar categoria..."
                                  emptyText="Nenhuma categoria encontrada"
                                  disabled={isSubmitting}
                                />
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="implementType"
                            render={({ field }) => (
                              <FormItem className="flex flex-col">
                                <FormLabel className="flex items-center gap-2">
                                  <IconBox className="h-4 w-4" />
                                  Tipo de Implemento
                                </FormLabel>
                                <Combobox
                                  value={field.value || ""}
                                  onValueChange={field.onChange}
                                  options={[
                                    { value: "", label: "Nenhum" },
                                    ...Object.values(IMPLEMENT_TYPE).map((type) => ({
                                      value: type,
                                      label: IMPLEMENT_TYPE_LABELS[type],
                                    })),
                                  ]}
                                  placeholder="Selecione o tipo de implemento"
                                  searchPlaceholder="Buscar tipo de implemento..."
                                  emptyText="Nenhum tipo de implemento encontrado"
                                  disabled={isSubmitting}
                                />
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        {/* Plates + Serial Numbers in same row */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <SerialNumberRangeInput
                            control={form.control}
                            disabled={isSubmitting || plates.length > 1}
                          />
                          <PlateTagsInput
                            control={form.control}
                            disabled={isSubmitting || serialNumbers.length > 1}
                          />
                        </div>

                        {/* Task Count Preview */}
                        {plates.length > 0 && serialNumbers.length > 0 && taskCount > 1 && (
                          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                            <div className="flex items-start gap-3">
                              <IconInfoCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                              <div className="flex-1">
                                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                                  {taskCount} tarefas serão criadas
                                </p>
                                <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                                  {plates.length} {plates.length === 1 ? 'placa' : 'placas'} × {serialNumbers.length} {serialNumbers.length === 1 ? 'número de série' : 'números de série'}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Forecast Date + Term in same row */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="forecastDate"
                            render={({ field }) => (
                              <DateTimeInput
                                {...{ onChange: field.onChange, onBlur: field.onBlur, value: field.value ?? null }}
                                mode="datetime"
                                label="Data de Previsão de Liberação"
                                disabled={isSubmitting}
                              />
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="term"
                            render={({ field }) => (
                              <DateTimeInput
                                {...{ onChange: field.onChange, onBlur: field.onBlur, value: field.value ?? null }}
                                mode="datetime"
                                label="Prazo de Entrega"
                                disabled={isSubmitting}
                              />
                            )}
                          />
                        </div>

                        {/* Details - last field */}
                        <FormField
                          control={form.control}
                          name="details"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="flex items-center gap-2">
                                <IconNotes className="h-4 w-4" />
                                Detalhes
                              </FormLabel>
                              <FormControl>
                                <Textarea
                                  value={field.value || ""}
                                  onChange={(e) => field.onChange(e.target.value)}
                                  placeholder="Detalhes adicionais sobre a tarefa..."
                                  rows={3}
                                  disabled={isSubmitting}
                                  className="bg-transparent"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </CardContent>
                    </AccordionContent>
                  </Card>
                </AccordionItem>

                {/* 2. Representatives - COMMERCIAL/ADMIN only */}
                {showRepresentatives && (
                  <AccordionItem
                    value="representatives"
                    id="accordion-item-representatives"
                    className="border border-border rounded-lg"
                  >
                    <Card className="border-0">
                      <AccordionTrigger className="px-0 hover:no-underline">
                        <CardHeader className="flex-1 py-4">
                          <CardTitle className="flex items-center gap-2">
                            <IconUser className="h-5 w-5" />
                            Representantes
                          </CardTitle>
                        </CardHeader>
                      </AccordionTrigger>
                      <AccordionContent>
                        <CardContent className="pt-0">
                          <RepresentativeManager
                            customerId={customerIdValue}
                            value={representativeRows}
                            onChange={handleRepresentativeRowsChange}
                            disabled={isSubmitting}
                            minRows={0}
                            maxRows={10}
                            control={form.control}
                          />
                        </CardContent>
                      </AccordionContent>
                    </Card>
                  </AccordionItem>
                )}

                {/* 3. Service Orders - All users */}
                <AccordionItem
                  value="serviceOrders"
                  id="accordion-item-serviceOrders"
                  className="border border-border rounded-lg"
                >
                  <Card className="border-0">
                    <AccordionTrigger className="px-0 hover:no-underline">
                      <CardHeader className="flex-1 py-4">
                        <CardTitle className="flex items-center gap-2">
                          <IconClipboardList className="h-5 w-5" />
                          Serviços
                        </CardTitle>
                      </CardHeader>
                    </AccordionTrigger>
                    <AccordionContent>
                      <CardContent className="pt-0">
                        <FormField
                          control={form.control}
                          name="serviceOrders"
                          render={() => (
                            <FormItem>
                              <ServiceSelectorAutoGrouped
                                control={form.control}
                                disabled={isSubmitting}
                                currentUserId={user?.id}
                                userPrivilege={user?.sector?.privileges}
                                onItemDeleted={handleServiceOrderDeleted}
                                isAccordionOpen={openAccordion === "serviceOrders"}
                                onProductionReorder={handleProductionReorder}
                              />
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </CardContent>
                    </AccordionContent>
                  </Card>
                </AccordionItem>

                {/* 4. Paint - COMMERCIAL/ADMIN */}
                {showPaint && (
                  <AccordionItem
                    value="paint"
                    id="accordion-item-paint"
                    className="border border-border rounded-lg"
                  >
                    <Card className="border-0">
                      <AccordionTrigger className="px-0 hover:no-underline">
                        <CardHeader className="flex-1 py-4">
                          <CardTitle className="flex items-center gap-2">
                            <IconPalette className="h-5 w-5" />
                            Tintas
                          </CardTitle>
                        </CardHeader>
                      </AccordionTrigger>
                      <AccordionContent>
                        <CardContent className="space-y-6 pt-0">
                          <GeneralPaintingSelector
                            control={form.control}
                            disabled={isSubmitting}
                            userPrivilege={user?.sector?.privileges}
                          />

                          {/* Logo Paints - ADMIN only */}
                          {showLogoPaints && (
                            <LogoPaintsSelector
                              control={form.control}
                              disabled={isSubmitting}
                            />
                          )}
                        </CardContent>
                      </AccordionContent>
                    </Card>
                  </AccordionItem>
                )}

                {/* 5. Layout - LOGISTIC/ADMIN */}
                {showLayout && (
                  <AccordionItem
                    value="layout"
                    id="accordion-item-layout"
                    className="border border-border rounded-lg"
                  >
                    <Card className="border-0">
                      <AccordionTrigger className="px-0 hover:no-underline">
                        <CardHeader className="flex-1 py-4">
                          <CardTitle className="flex items-center gap-2">
                            <IconRuler className="h-5 w-5" />
                            Layout do Caminhão
                          </CardTitle>
                        </CardHeader>
                      </AccordionTrigger>
                      <AccordionContent>
                        <CardContent className="pt-0">
                          <div className="space-y-4">
                            {/* Layout Side Selector */}
                            <div className="flex justify-between items-center">
                              <div className="flex gap-2">
                                <Button
                                  type="button"
                                  variant={selectedLayoutSide === "left" ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => setSelectedLayoutSide("left")}
                                >
                                  Motorista
                                  {modifiedLayoutSides.has("left") && (
                                    <Badge variant="success" className="ml-2">Modificado</Badge>
                                  )}
                                </Button>
                                <Button
                                  type="button"
                                  variant={selectedLayoutSide === "right" ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => setSelectedLayoutSide("right")}
                                >
                                  Sapo
                                  {modifiedLayoutSides.has("right") && (
                                    <Badge variant="success" className="ml-2">Modificado</Badge>
                                  )}
                                </Button>
                                <Button
                                  type="button"
                                  variant={selectedLayoutSide === "back" ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => setSelectedLayoutSide("back")}
                                >
                                  Traseira
                                  {modifiedLayoutSides.has("back") && (
                                    <Badge variant="success" className="ml-2">Modificado</Badge>
                                  )}
                                </Button>
                              </div>

                              {/* Total Length Display */}
                              <div className="px-3 py-1 bg-primary/10 rounded-md">
                                <span className="text-sm text-muted-foreground">Comprimento Total: </span>
                                <span className="text-sm font-semibold text-foreground">
                                  {(() => {
                                    const currentLayout = currentLayoutStates[selectedLayoutSide];
                                    const sections = currentLayout?.layoutSections;
                                    if (!sections || sections.length === 0) return "0cm";
                                    const totalWidthMeters = sections.reduce((sum: number, s: any) => sum + (s.width || 0), 0);
                                    const totalWidthCm = Math.round(totalWidthMeters * 100);
                                    return totalWidthCm + "cm";
                                  })()}
                                </span>
                              </div>
                            </div>

                            {/* Layout Form */}
                            <LayoutForm
                              selectedSide={selectedLayoutSide}
                              layout={currentLayoutStates[selectedLayoutSide]}
                              validationError={layoutWidthError}
                              onChange={(side, layoutData) => {
                                // In the create form, LayoutForm never emits initial state
                                // because we pass a layout prop with layoutSections.
                                // Every onChange call is a real user change.
                                setModifiedLayoutSides(prev => {
                                  const newSet = new Set(prev);
                                  newSet.add(side);
                                  return newSet;
                                });

                                setHasLayoutChanges(true);

                                setCurrentLayoutStates(prev => ({
                                  ...prev,
                                  [side]: layoutData,
                                }));
                              }}
                              onSave={async (layoutData) => {
                                if (layoutData) {
                                  setHasLayoutChanges(true);
                                }
                              }}
                              showPhoto={selectedLayoutSide === "back"}
                              disabled={isSubmitting}
                            />
                          </div>
                        </CardContent>
                      </AccordionContent>
                    </Card>
                  </AccordionItem>
                )}

                {/* 6. Pricing - COMMERCIAL/ADMIN */}
                {showPricing && (
                  <AccordionItem
                    value="pricing"
                    id="accordion-item-pricing"
                    className="border border-border rounded-lg"
                  >
                    <Card className="border-0">
                      <AccordionTrigger className="px-0 hover:no-underline">
                        <CardHeader className="flex-1 py-4">
                          <CardTitle className="flex items-center gap-2">
                            <IconFileInvoice className="h-5 w-5" />
                            Precificação
                            {pricingItemCount > 0 && (
                              <Badge variant="secondary" className="ml-2">
                                {pricingItemCount}
                              </Badge>
                            )}
                          </CardTitle>
                        </CardHeader>
                      </AccordionTrigger>
                      <AccordionContent>
                        <CardContent className="pt-0">
                          <PricingSelector
                            ref={pricingSelectorRef}
                            control={form.control}
                            disabled={isSubmitting}
                            userRole={user?.sector?.privileges}
                            onItemCountChange={setPricingItemCount}
                            layoutFiles={pricingLayoutFiles}
                            onLayoutFilesChange={setPricingLayoutFiles}
                            onItemDeleted={handlePricingItemDeleted}
                          />
                        </CardContent>
                      </AccordionContent>
                    </Card>
                  </AccordionItem>
                )}

                {/* 7. Base Files - All users */}
                <AccordionItem
                  value="base-files"
                  id="accordion-item-base-files"
                  className="border border-border rounded-lg"
                >
                  <Card className="border-0">
                    <AccordionTrigger className="px-0 hover:no-underline">
                      <CardHeader className="flex-1 py-4">
                        <CardTitle className="flex items-center gap-2">
                          <IconFile className="h-5 w-5" />
                          Arquivos Base
                        </CardTitle>
                      </CardHeader>
                    </AccordionTrigger>
                    <AccordionContent>
                      <CardContent className="pt-0">
                        <FileUploadField
                          onFilesChange={handleBaseFilesChange}
                          maxFiles={30}
                          maxSize={500 * 1024 * 1024}
                          disabled={isSubmitting}
                          showPreview={true}
                          existingFiles={baseFiles}
                          variant="compact"
                          placeholder="Adicione arquivos base para a tarefa (vídeos, imagens, PDFs)"
                          label="Arquivos base anexados"
                          acceptedFileTypes={{
                            "image/*": [".jpeg", ".jpg", ".png", ".gif", ".webp", ".svg"],
                            "application/pdf": [".pdf"],
                            "video/mp4": [".mp4"],
                            "video/quicktime": [".mov"],
                            "video/webm": [".webm"],
                            "video/x-msvideo": [".avi"],
                            "video/x-matroska": [".mkv"],
                            "application/postscript": [".eps", ".ai"],
                          }}
                        />
                      </CardContent>
                    </AccordionContent>
                  </Card>
                </AccordionItem>

                {/* 8. Artworks - COMMERCIAL/ADMIN */}
                {showArtworks && (
                  <AccordionItem
                    value="artworks"
                    id="accordion-item-artworks"
                    className="border border-border rounded-lg"
                  >
                    <Card className="border-0">
                      <AccordionTrigger className="px-0 hover:no-underline">
                        <CardHeader className="flex-1 py-4">
                          <CardTitle className="flex items-center gap-2">
                            <IconFile className="h-5 w-5" />
                            Artes
                          </CardTitle>
                        </CardHeader>
                      </AccordionTrigger>
                      <AccordionContent>
                        <CardContent className="pt-0">
                          <ArtworkFileUploadField
                            onFilesChange={handleFilesChange}
                            onStatusChange={(fileId, status) => {
                              setArtworkStatuses(prev => ({
                                ...prev,
                                [fileId]: status,
                              }));
                            }}
                            maxFiles={5}
                            disabled={isSubmitting}
                            showPreview={true}
                            existingFiles={uploadedFiles}
                            placeholder="Adicione artes relacionadas à tarefa"
                            label="Artes anexadas"
                          />
                        </CardContent>
                      </AccordionContent>
                    </Card>
                  </AccordionItem>
                )}
              </Accordion>
            </div>
          </form>
        </Form>
      </div>
      <UnsavedChangesDialog open={showDialog} onConfirm={confirmNavigation} onCancel={cancelNavigation} />
    </>
  );
};
