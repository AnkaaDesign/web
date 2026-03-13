import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEditForm } from "../../../../hooks/common/use-edit-form";
import {
  IconClipboardList,
  IconCalendar,
  IconPalette,
  IconFile,
  IconRuler,
  IconSparkles,
  IconScissors,
  IconCurrencyReal,
  IconFileText,
  IconHash,
  IconLicense,
  IconId,
  IconNotes,
  IconStatusChange,
  IconMapPin,
  IconUser,
  IconCamera,
  IconCameraCheck,
  IconFolderOpen,
  IconPhoto,
} from "@tabler/icons-react";
import type { Task } from "../../../../types";
import { taskUpdateSchema, type TaskUpdateFormData } from "../../../../schemas";
import { useTaskMutations, useCutsByTask } from "../../../../hooks";
import { cutService } from "../../../../api-client/cut";
import type { ResponsibleRowData } from "@/types/responsible";
import { ResponsibleRole } from "@/types/responsible";
import { ResponsibleManager, validateResponsibleRows } from "@/components/administration/customer/responsible";
import { TASK_STATUS, TASK_STATUS_LABELS, CUT_TYPE, CUT_ORIGIN, SECTOR_PRIVILEGES, COMMISSION_STATUS, COMMISSION_STATUS_LABELS, TRUCK_CATEGORY, TRUCK_CATEGORY_LABELS, IMPLEMENT_TYPE, IMPLEMENT_TYPE_LABELS, SERVICE_ORDER_STATUS, SERVICE_ORDER_TYPE, AIRBRUSHING_STATUS } from "../../../../constants";
import { createFormDataWithContext } from "@/utils/form-data-helper";
import { useAuth } from "../../../../contexts/auth-context";
import { useTaskPermissions } from '@/hooks/common/use-task-permissions';
import { useAccordionScroll } from "@/lib/scroll-utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { CustomerSelector } from "./customer-selector";
import { SectorSelector } from "./sector-selector";
import { ServiceSelectorAutoGrouped } from "./service-selector-auto-grouped";
import { MultiCutSelector, type MultiCutSelectorRef } from "./multi-cut-selector";
import { GeneralPaintingSelector } from "./general-painting-selector";
import type { ServiceOrderData } from "./designar-service-order-dialog";
import { LogoPaintsSelector } from "./logo-paints-selector";
import { MultiAirbrushingSelector, type MultiAirbrushingSelectorRef } from "./multi-airbrushing-selector";
import { FileUploadField, FileSuggestions, type FileWithPreview } from "@/components/common/file";
import { ArtworkFileUploadField } from "./artwork-file-upload-field";
import { uploadFiles } from "../../../../api-client/file";
import { getApiBaseUrl } from "@/config/api";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "@/components/ui/sonner";
import { toTitleCase } from "../../../../utils";
// Quote is now accessed via context menu, not from the edit form
import { LayoutForm } from "@/components/production/layout/layout-form";
import { SpotSelector } from "./spot-selector";
import { useLayoutsByTruck, useLayoutMutations } from "../../../../hooks";
import { TRUCK_SPOT } from "../../../../constants";

interface TaskEditFormProps {
  task: Task;
  onFormStateChange?: (state: { isValid: boolean; isDirty: boolean; isSubmitting: boolean }) => void;
  detailsRoute?: (id: string) => string;
  navigationState?: Record<string, any>;
}

// Helper function to convert File entity or array of File entities to FileWithPreview
const convertToFileWithPreview = (file: any | any[] | undefined | null): FileWithPreview[] => {
  if (!file) return [];

  // Handle array of files
  if (Array.isArray(file)) {
    return file.map(f => ({
      id: f.id,
      name: f.filename || f.name || 'file',
      size: f.size || 0,
      type: f.mimetype || f.type || 'application/octet-stream',
      lastModified: f.createdAt ? new Date(f.createdAt).getTime() : Date.now(),
      uploaded: true,
      uploadProgress: 100,
      uploadedFileId: f.id,
      thumbnailUrl: f.thumbnailUrl,
    } as FileWithPreview));
  }

  // Handle single file
  return [{
    id: file.id,
    name: file.filename || file.name || 'file',
    size: file.size || 0,
    type: file.mimetype || file.type || 'application/octet-stream',
    lastModified: file.createdAt ? new Date(file.createdAt).getTime() : Date.now(),
    uploaded: true,
    uploadProgress: 100,
    uploadedFileId: file.id,
    thumbnailUrl: file.thumbnailUrl,
  } as FileWithPreview];
};

export const TaskEditForm = ({ task, onFormStateChange, detailsRoute, navigationState }: TaskEditFormProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const taskMutations = useTaskMutations();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showResponsibleErrors, setShowResponsibleErrors] = useState(false);
  const [showForecastReason, setShowForecastReason] = useState(false);
  const [forecastReason, setForecastReason] = useState<string>("");

  // Wrap updateAsync for debugging/logging
  const updateAsync = async (params: any) => {
    console.log('[Task Update] 🚀 Submitting with params:', params);
    console.log('[Task Update] Quote data being sent:', params.data?.quote ? JSON.stringify(params.data.quote, null, 2) : 'NO QUOTE DATA');
    // NOTE: artworkStatuses is now added in the FormData/JSON preparation sections
    // to avoid duplicates and to properly filter temp IDs vs real UUIDs
    const result = await taskMutations.updateAsync(params);
    return result;
  };

  const {
    privilege, isTeamLeader,
    canViewRestrictedFields,
    canViewCommission: canViewCommissionField,
    canViewDates, canViewServices, canViewLayout, canViewTruckSpot,
    canViewPaint, canViewLogoPaint, canViewCuts,
    canViewAirbrushing, canViewBaseFiles, canViewProjectFiles,
    canViewCheckinCheckout, canViewReimbursement, canViewObservation,
    canEditIdentity, canEditSector, canEditCommission,
    canEditDates, canEditResponsibles, canEditServices,
    canEditLayout, canEditPaint,
  } = useTaskPermissions();

  // Sector-specific business logic (not permission checks)
  const isFinancialUser = privilege === SECTOR_PRIVILEGES.FINANCIAL;
  const isCommercialUser = privilege === SECTOR_PRIVILEGES.COMMERCIAL;
  const isDesignerUser = privilege === SECTOR_PRIVILEGES.DESIGNER;

  // Fetch cuts separately using useCutsByTask hook (same approach as detail page)
  const { data: cutsData } = useCutsByTask({
    taskId: task.id,
    filters: {
      include: {
        file: true,
      },
    },
  });

  // Initialize artwork files from existing task data
  // NOTE: task.artworks are now Artwork entities with a nested file property
  const [uploadedFiles, setUploadedFiles] = useState<FileWithPreview[]>(
    (task.artworks || []).map(artwork => {
      // artwork is an Artwork entity with { id, fileId, status, file?: File }
      const file = (artwork as any).file || artwork; // artwork.file if included, fallback to artwork for backward compat
      return {
        id: file.id, // File ID (not Artwork ID)
        name: file.filename || file.name || 'artwork',
        size: file.size || 0,
        type: file.mimetype || file.type || 'application/octet-stream',
        lastModified: file.createdAt ? new Date(file.createdAt).getTime() : Date.now(),
        uploaded: true,
        uploadProgress: 100,
        uploadedFileId: file.id, // File ID for form submission
        thumbnailUrl: file.thumbnailUrl,
        status: (artwork as any).status || 'DRAFT', // Extract artwork status
      } as FileWithPreview;
    })
  );
  // artworkIds should be File IDs (artwork.fileId or artwork.file.id), not Artwork entity IDs
  const [_uploadedFileIds, setUploadedFileIds] = useState<string[]>(
    task.artworks?.map((artwork: any) => artwork.fileId || artwork.file?.id || artwork.id) || []
  );

  // Track artwork statuses for approval workflow (File ID → status)
  const [artworkStatuses, setArtworkStatuses] = useState<Record<string, 'DRAFT' | 'APPROVED' | 'REPROVED'>>(
    task.artworks?.reduce((acc, artwork) => {
      const fileId = (artwork as any).fileId || (artwork as any).file?.id;
      if (fileId) {
        acc[fileId] = (artwork as any).status || 'DRAFT';
      }
      return acc;
    }, {} as Record<string, 'DRAFT' | 'APPROVED' | 'REPROVED'>) || {}
  );

  // Track if artwork status has been changed (needs to be BEFORE useEffect that uses it)
  const [hasArtworkStatusChanges, setHasArtworkStatusChanges] = useState(false);

  // Track if artworks have been modified (added or removed) - separate from status changes
  const [hasArtworkFileChanges, setHasArtworkFileChanges] = useState(false);

  // Sync uploadedFiles and artworkStatuses when task.artworks changes (after successful update)
  useEffect(() => {
    console.log('[Task Update] 🔄 useEffect triggered for task.artworks sync', {
      taskArtworksLength: task.artworks?.length || 0,
      taskId: task.id,
      currentUploadedFilesLength: uploadedFiles.length,
      hasArtworkStatusChanges,
    });

    // CRITICAL FIX: Don't sync if user has made changes that haven't been submitted yet
    // This prevents the useEffect from clearing user changes when React Query refetches stale data
    if (hasArtworkStatusChanges) {
      console.log('[Task Update] 🔄 SKIPPING full sync - user has unsaved artwork status changes');
      // IMPORTANT: Even when skipping, we need to ensure uploadedFiles structure is correct
      // to prevent empty artworkIds during submission. Only sync the file list, not statuses.
      if (task.artworks && uploadedFiles.length === 0) {
        console.warn('[Task Update] ⚠️ CRITICAL: uploadedFiles is empty but task has artworks! Syncing file list only (preserving status changes)');
        const newUploadedFiles = task.artworks.map(artwork => {
          const file = (artwork as any).file || artwork;
          const fileId = (artwork as any).fileId || file.id;
          // Preserve user's pending status changes from artworkStatuses state
          const pendingStatus = artworkStatuses[fileId];
          return {
            id: file.id,
            name: file.filename || file.name || 'artwork',
            size: file.size || 0,
            type: file.mimetype || file.type || 'application/octet-stream',
            lastModified: file.createdAt ? new Date(file.createdAt).getTime() : Date.now(),
            uploaded: true,
            uploadProgress: 100,
            uploadedFileId: file.id,
            thumbnailUrl: file.thumbnailUrl,
            status: pendingStatus || (artwork as any).status || 'DRAFT', // Use pending status if exists
          } as FileWithPreview;
        });
        console.log('[Task Update] 🔄 Emergency sync: Restored uploadedFiles structure while preserving status changes');
        setUploadedFiles(newUploadedFiles);
        setUploadedFileIds(task.artworks.map((artwork: any) => artwork.fileId || artwork.file?.id || artwork.id));
      }
      return;
    }

    if (task.artworks) {
      const newUploadedFiles = task.artworks.map(artwork => {
        const file = (artwork as any).file || artwork;
        return {
          id: file.id,
          name: file.filename || file.name || 'artwork',
          size: file.size || 0,
          type: file.mimetype || file.type || 'application/octet-stream',
          lastModified: file.createdAt ? new Date(file.createdAt).getTime() : Date.now(),
          uploaded: true,
          uploadProgress: 100,
          uploadedFileId: file.id,
          thumbnailUrl: file.thumbnailUrl,
          status: (artwork as any).status || 'DRAFT',
        } as FileWithPreview;
      });

      console.log('[Task Update] 🔄 Setting new uploadedFiles:', newUploadedFiles);
      setUploadedFiles(newUploadedFiles);
      setUploadedFileIds(task.artworks.map((artwork: any) => artwork.fileId || artwork.file?.id || artwork.id));

      const newStatuses = task.artworks.reduce((acc, artwork) => {
        const fileId = (artwork as any).fileId || (artwork as any).file?.id;
        if (fileId) {
          acc[fileId] = (artwork as any).status || 'DRAFT';
        }
        return acc;
      }, {} as Record<string, 'DRAFT' | 'APPROVED' | 'REPROVED'>);

      console.log('[Task Update] 🔄 Setting new artworkStatuses:', newStatuses);
      setArtworkStatuses(newStatuses);
      setHasArtworkStatusChanges(false); // Reset the flag after sync
      setHasArtworkFileChanges(false); // Reset the file changes flag after sync
      console.log('[Task Update] 🔄 Reset hasArtworkStatusChanges and hasArtworkFileChanges to false');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.artworks, task.id]); // Only re-run when task.artworks or task.id changes (reads from closure for other values)

  // Initialize base files from existing task data
  const [baseFiles, setBaseFiles] = useState<FileWithPreview[]>(
    (task.baseFiles || []).map(file => ({
      id: file.id,
      name: file.filename || file.name || 'base file',
      size: file.size || 0,
      type: file.mimetype || file.type || 'application/octet-stream',
      lastModified: file.createdAt ? new Date(file.createdAt).getTime() : Date.now(),
      uploaded: true,
      uploadProgress: 100,
      uploadedFileId: file.id,
      thumbnailUrl: file.thumbnailUrl,
    } as FileWithPreview))
  );
  const [_baseFileIds, setBaseFileIds] = useState<string[]>(task.baseFiles?.map((f) => f.id) || []);

  // Track if base files have been modified by the user
  const [hasBaseFileChanges, setHasBaseFileChanges] = useState(false);

  // Initialize project files from existing task data
  const [projectFiles, setProjectFiles] = useState<FileWithPreview[]>(
    ((task as any).projectFiles || []).map((file: any) => ({
      id: file.id,
      name: file.filename || file.name || 'project file',
      size: file.size || 0,
      type: file.mimetype || file.type || 'application/octet-stream',
      lastModified: file.createdAt ? new Date(file.createdAt).getTime() : Date.now(),
      uploaded: true,
      uploadProgress: 100,
      uploadedFileId: file.id,
      thumbnailUrl: file.thumbnailUrl,
    } as FileWithPreview))
  );
  const [hasProjectFileChanges, setHasProjectFileChanges] = useState(false);

  // Initialize checkin/checkout files per service order from existing task data
  const mapFilesToPreview = (files: any[]): FileWithPreview[] =>
    (files || []).map((file: any) => ({
      id: file.id,
      name: file.filename || file.name || 'file',
      size: file.size || 0,
      type: file.mimetype || file.type || 'application/octet-stream',
      lastModified: file.createdAt ? new Date(file.createdAt).getTime() : Date.now(),
      uploaded: true,
      uploadProgress: 100,
      uploadedFileId: file.id,
      thumbnailUrl: file.thumbnailUrl,
    } as FileWithPreview));

  const [checkinFilesByServiceOrder, setCheckinFilesByServiceOrder] = useState<Record<string, FileWithPreview[]>>(() => {
    const map: Record<string, FileWithPreview[]> = {};
    if (task.serviceOrders) {
      for (const so of task.serviceOrders) {
        if (so.id) {
          map[so.id] = mapFilesToPreview((so as any).checkinFiles);
        }
      }
    }
    return map;
  });
  const [checkoutFilesByServiceOrder, setCheckoutFilesByServiceOrder] = useState<Record<string, FileWithPreview[]>>(() => {
    const map: Record<string, FileWithPreview[]> = {};
    if (task.serviceOrders) {
      for (const so of task.serviceOrders) {
        if (so.id) {
          map[so.id] = mapFilesToPreview((so as any).checkoutFiles);
        }
      }
    }
    return map;
  });
  const [hasCheckinFileChanges, setHasCheckinFileChanges] = useState(false);
  const [hasCheckoutFileChanges, setHasCheckoutFileChanges] = useState(false);

  // Refs for checkin/checkout file state (avoids stale closures in submit handler)
  const checkinFilesByServiceOrderRef = useRef(checkinFilesByServiceOrder);
  const checkoutFilesByServiceOrderRef = useRef(checkoutFilesByServiceOrder);
  useEffect(() => { checkinFilesByServiceOrderRef.current = checkinFilesByServiceOrder; }, [checkinFilesByServiceOrder]);
  useEffect(() => { checkoutFilesByServiceOrderRef.current = checkoutFilesByServiceOrder; }, [checkoutFilesByServiceOrder]);

  // Track pending pre-upload promises to prevent saving before uploads complete
  const pendingCheckinUploadsRef = useRef(0);
  const pendingCheckoutUploadsRef = useRef(0);

  // Sync baseFiles when task.baseFiles changes (after successful update or initial load)
  useEffect(() => {
    // Skip sync if user has made changes that haven't been submitted yet
    if (hasBaseFileChanges) {
      return;
    }

    if (task.baseFiles) {
      const newBaseFiles = task.baseFiles.map(file => ({
        id: file.id,
        name: file.filename || file.name || 'base file',
        size: file.size || 0,
        type: file.mimetype || file.type || 'application/octet-stream',
        lastModified: file.createdAt ? new Date(file.createdAt).getTime() : Date.now(),
        uploaded: true,
        uploadProgress: 100,
        uploadedFileId: file.id,
        thumbnailUrl: file.thumbnailUrl,
      } as FileWithPreview));

      setBaseFiles(newBaseFiles);
      setBaseFileIds(task.baseFiles.map((f) => f.id));
    }
  }, [task.baseFiles, task.id, hasBaseFileChanges]);


  const multiCutSelectorRef = useRef<MultiCutSelectorRef>(null);
  const [cutsCount, setCutsCount] = useState(0);
  const multiAirbrushingSelectorRef = useRef<MultiAirbrushingSelectorRef>(null);
  const [airbrushingsCount, setAirbrushingsCount] = useState(0);
  const [selectedLayoutSide, setSelectedLayoutSide] = useState<"left" | "right" | "back">("left");
  const [hasLayoutChanges, setHasLayoutChanges] = useState(false);
  const [hasFileChanges, setHasFileChanges] = useState(false);
  // hasArtworkStatusChanges is now defined earlier (line 195) to avoid temporal dead zone
  const [layoutWidthError, setLayoutWidthError] = useState<string | null>(null);
  const [observationFiles, setObservationFiles] = useState<FileWithPreview[]>(
    convertToFileWithPreview(task.observation?.files)
  );
  // Responsibles state - using row-based system
  const [responsibleRows, setResponsibleRows] = useState<ResponsibleRowData[]>(() => {
    // Initialize from task responsibles
    if (task.responsibles && task.responsibles.length > 0) {
      return task.responsibles.map(rep => ({
        id: rep.id,
        name: rep.name,
        phone: rep.phone,
        email: rep.email || '',
        role: rep.role,
        isActive: rep.isActive,
        isNew: false,
        isEditing: false,
        isSaving: false,
        error: null,
      }));
    }
    // Start with a default empty row (like service orders)
    return [{
      id: `temp-${Date.now()}-0`,
      name: '',
      phone: '',
      email: '',
      role: 'COMMERCIAL' as ResponsibleRole,
      isActive: true,
      isNew: true,
      isEditing: false,
      isSaving: false,
      error: null,
    }];
  });

  const handleResponsibleRowsChange = useCallback((rows: ResponsibleRowData[]) => {
    setResponsibleRows(rows);
    if (showResponsibleErrors && validateResponsibleRows(rows)) {
      setShowResponsibleErrors(false);
    }
  }, [showResponsibleErrors]);

  // Accordion state - track which section is open (only one at a time)
  const [openAccordion, setOpenAccordion] = useState<string | undefined>("basic-information");

  // Map form field names to their accordion section IDs
  const fieldToSectionMap: Record<string, string> = useMemo(() => ({
    // Basic Information
    name: "basic-information",
    customerId: "basic-information",
    "truck.category": "basic-information",
    "truck.implementType": "basic-information",
    serialNumber: "basic-information",
    "truck.plate": "basic-information",
    "truck.chassisNumber": "basic-information",
    sectorId: "basic-information",
    status: "basic-information",
    commission: "basic-information",
    details: "basic-information",
    truck: "basic-information",
    // Responsibles
    responsibles: "responsibles",
    // Dates
    forecastDate: "dates",
    entryDate: "dates",
    term: "dates",
    startedAt: "dates",
    finishedAt: "dates",
    // Services
    serviceOrders: "serviceOrders",
    // Layout
    leftSideLayout: "layout",
    rightSideLayout: "layout",
    backSideLayout: "layout",
    // Spot
    spot: "spot",
    // Paint
    paintIds: "paint",
    logoPaintIds: "paint",
    // Cuts
    cuts: "cuts",
    // Airbrushing
    airbrushings: "airbrushing",
    // Files
    baseFileIds: "base-files",
    projectFileIds: "project-files",
    checkinFileIds: "checkin-files",
    checkoutFileIds: "checkout-files",
    artworkIds: "artworks",
    // Observation
    observation: "observation",
  }), []);

  // Find the accordion section that contains the first validation error
  const openSectionWithError = useCallback((errors: Record<string, any>) => {
    const errorKeys = Object.keys(errors);
    if (errorKeys.length === 0) return;

    for (const key of errorKeys) {
      const section = fieldToSectionMap[key];
      if (section) {
        setOpenAccordion(section);
        return;
      }
    }
    // Fallback: open the first section if no mapping found
    setOpenAccordion("basic-information");
  }, [fieldToSectionMap]);

  // Track current layout state during editing (not saved yet)
  // Initialize with default values to support validation before user edits
  const [currentLayoutStates, setCurrentLayoutStates] = useState<Record<'left' | 'right' | 'back', any>>(() => {
    const defaults = {
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
    };
    return defaults;
  });

  // Track which sides were actually modified by the user
  const [modifiedLayoutSides, setModifiedLayoutSides] = useState<Set<'left' | 'right' | 'back'>>(new Set());

  // Track which sides have emitted their initial state (to avoid marking as "modified" on first render)
  const initialLayoutStateEmittedRef = useRef<Set<'left' | 'right' | 'back'>>(new Set());

  // Get truck ID from task - with safety check
  const truckId = task.truck?.id;

  // Safety mechanism: If task doesn't have a truck yet, trigger a refetch
  // This shouldn't happen because backend auto-creates it, but it's a safety net
  useEffect(() => {
    if (!truckId && task.id) {
      // The useTaskDetail query will handle refetching automatically
      // since the backend ensures truck exists in findById
    }
  }, [truckId, task.id]);

  // Initialize accordion scroll hook with proper timing and offset calculation
  const { scrollToAccordion } = useAccordionScroll();

  // Scroll to the opened accordion item
  useEffect(() => {
    if (openAccordion) {
      // Scroll to accordion with proper timing (250ms to wait for 200ms accordion animation + 50ms buffer)
      scrollToAccordion(openAccordion);
    }
  }, [openAccordion, scrollToAccordion]);

  const { data: layoutsData } = useLayoutsByTruck(truckId || "", { enabled: !!truckId });

  // Calculate truck length from layout sections for spot selector
  // Uses the same two-tier cabin logic as garage view and API:
  // < 7m body: 2.0m cabin (small trucks)
  // 7-10m body: 2.4m cabin (larger trucks)
  // >= 10m body: no cabin (semi-trailers)
  const truckLength = useMemo(() => {
    const layout = layoutsData?.leftSideLayout || layoutsData?.rightSideLayout;
    if (!layout?.layoutSections || layout.layoutSections.length === 0) {
      return null;
    }
    const sectionsSum = layout.layoutSections.reduce(
      (sum: number, s: any) => sum + (s.width || 0),
      0
    );
    const CABIN_THRESHOLD_SMALL = 7;
    const CABIN_THRESHOLD_LARGE = 10;
    const CABIN_LENGTH_SMALL = 2.0;
    const CABIN_LENGTH_LARGE = 2.4;
    if (sectionsSum < CABIN_THRESHOLD_SMALL) {
      return sectionsSum + CABIN_LENGTH_SMALL;
    }
    if (sectionsSum < CABIN_THRESHOLD_LARGE) {
      return sectionsSum + CABIN_LENGTH_LARGE;
    }
    return sectionsSum;
  }, [layoutsData]);

  // Debug logging for layouts
  useEffect(() => {
    
  }, [layoutsData, truckId, truckLength]);
  const { createOrUpdateTruckLayout: _createOrUpdateTruckLayout, delete: deleteLayout } = useLayoutMutations();
  const [shouldDeleteLayouts, setShouldDeleteLayouts] = useState(false);

  // CRITICAL FIX: Sync currentLayoutStates with fresh backend data after save
  // This ensures that after saving, we have the latest data from backend
  useEffect(() => {
    // Only sync if we have no pending modifications (modifiedLayoutSides is empty)
    // AND we don't have pending layout changes flag set
    // This prevents overwriting user changes that haven't been saved yet
    if (modifiedLayoutSides.size === 0 && !hasLayoutChanges && layoutsData) {

      const newStates: Record<'left' | 'right' | 'back', any> = {
        left: currentLayoutStates.left,
        right: currentLayoutStates.right,
        back: currentLayoutStates.back,
      };

      // Sync left side
      if (layoutsData.leftSideLayout?.layoutSections) {
        newStates.left = {
          height: layoutsData.leftSideLayout.height,
          layoutSections: layoutsData.leftSideLayout.layoutSections.map((s: any) => ({
            width: s.width,
            isDoor: s.isDoor,
            doorHeight: s.doorHeight,
            position: s.position,
          })),
          photoId: layoutsData.leftSideLayout.photoId,
        };
        
      }

      // Sync right side
      if (layoutsData.rightSideLayout?.layoutSections) {
        newStates.right = {
          height: layoutsData.rightSideLayout.height,
          layoutSections: layoutsData.rightSideLayout.layoutSections.map((s: any) => ({
            width: s.width,
            isDoor: s.isDoor,
            doorHeight: s.doorHeight,
            position: s.position,
          })),
          photoId: layoutsData.rightSideLayout.photoId,
        };
        
      }

      // Sync back side
      if (layoutsData.backSideLayout?.layoutSections) {
        newStates.back = {
          height: layoutsData.backSideLayout.height,
          layoutSections: layoutsData.backSideLayout.layoutSections.map((s: any) => ({
            width: s.width,
            isDoor: s.isDoor,
            doorHeight: s.doorHeight,
            position: s.position,
          })),
          photoId: layoutsData.backSideLayout.photoId,
        };
        
      }

      setCurrentLayoutStates(newStates);

    } else if (modifiedLayoutSides.size > 0) {
      
    }
  }, [layoutsData, modifiedLayoutSides.size, hasLayoutChanges]);

  // When layout section opens WITHOUT existing layouts, mark as having changes
  // Mark layout changes when user starts editing a new layout
  // (because defaults will be created). DON'T mark changes when there are existing layouts.
  useEffect(() => {
    // This effect has been simplified since layout section is always available with accordion
    // Layout changes are now tracked only when user actually modifies the layout via LayoutForm
  }, []);

  // Real-time validation of layout width balance
  useEffect(() => {
    // Use current editing state if available, otherwise use saved data
    const leftLayout = currentLayoutStates.left || layoutsData?.leftSideLayout;
    const rightLayout = currentLayoutStates.right || layoutsData?.rightSideLayout;
    const leftSections = leftLayout?.sections || leftLayout?.layoutSections;
    const rightSections = rightLayout?.sections || rightLayout?.layoutSections;

    // Only validate if both sides exist and have sections
    if (leftSections && leftSections.length > 0 && rightSections && rightSections.length > 0) {
      const leftTotalWidth = leftSections.reduce((sum: number, s: any) => sum + (s.width || 0), 0);
      const rightTotalWidth = rightSections.reduce((sum: number, s: any) => sum + (s.width || 0), 0);
      const widthDifference = Math.abs(leftTotalWidth - rightTotalWidth);
      const maxAllowedDifference = 0.02; // 2cm in meters

      if (widthDifference > maxAllowedDifference) {
        const errorMessage = `O layout possui diferença de largura maior que 2cm entre os lados. Lado Motorista: ${(leftTotalWidth * 100).toFixed(0)}cm, Lado Sapo: ${(rightTotalWidth * 100).toFixed(0)}cm (diferença de ${(widthDifference * 100).toFixed(1)}cm). Ajuste as medidas antes de enviar o formulário.`;
        setLayoutWidthError(errorMessage);
      } else {
        setLayoutWidthError(null);
      }
    } else {
      // Clear error if one side doesn't have sections
      setLayoutWidthError(null);
    }
  }, [layoutsData, currentLayoutStates]);

  // Map task data to form values
  const mapDataToForm = useCallback((taskData: Task): TaskUpdateFormData => {

    // Group cuts by fileId and type to get proper quantities
    // Use cutsData from separate query instead of taskData.cuts
    const cuts = cutsData?.data || [];
    const groupedCuts = (() => {
      if (cuts.length === 0) {
        
        return [];
      }

      const cutMap = new Map<string, { id: string; fileId: string; type: string; quantity: number; file?: any; origin: string }>();

      for (const cut of cuts) {
        const fileId = cut.file?.id || cut.fileId || "";
        const type = cut.type;
        const key = `${fileId || 'no-file'}|${type}`;

        if (cutMap.has(key)) {
          const existing = cutMap.get(key)!;
          existing.quantity += 1;
        } else {
          // Convert file entity to FileWithPreview
          const convertedFile = cut.file ? (() => {
            const fileArray = convertToFileWithPreview(cut.file);
            return fileArray.length > 0 ? fileArray[0] : undefined;
          })() : undefined;

          cutMap.set(key, {
            id: `cut-${fileId}-${type}`, // Stable ID for useFieldArray
            fileId: fileId || "",
            type,
            quantity: 1,
            file: convertedFile,
            origin: cut.origin || CUT_ORIGIN.PLAN,
          });
        }
      }

      const grouped = Array.from(cutMap.values());
      
      return grouped;
    })();

    return {
      name: taskData.name || "",
      status: taskData.status || TASK_STATUS.PREPARATION,
      serialNumber: taskData.serialNumber || null,
      details: taskData.details || null,
      commission: taskData.commission || null,
      entryDate: taskData.entryDate ? new Date(taskData.entryDate) : null,
      term: taskData.term ? new Date(taskData.term) : null,
      startedAt: taskData.startedAt ? new Date(taskData.startedAt) : null,
      finishedAt: taskData.finishedAt ? new Date(taskData.finishedAt) : null,
      forecastDate: taskData.forecastDate ? new Date(taskData.forecastDate) : null,
      customerId: taskData.customerId || null,
      sectorId: taskData.sectorId || null,
      responsibleIds: taskData.responsibleIds || [],
      paintId: taskData.paintId || null,
      // NOTE: Pricing/Quote is now managed on a separate page (/production/schedule/task-quote/[taskId])
      // Initialize serviceOrders with default row - part of initial state
      // Maintain creation order (sorted by createdAt ASC) to preserve user's intended order
      serviceOrders: (() => {
        if (taskData.serviceOrders && taskData.serviceOrders.length > 0) {
          return taskData.serviceOrders
            .map((so) => ({
              id: so.id, // Include the ID to identify existing service orders
              description: so.description || "",
              type: so.type,
              status: so.status,
              statusOrder: so.statusOrder,
              assignedToId: so.assignedToId || null,
              observation: so.observation || null, // Include observation field
              startedAt: so.startedAt ? new Date(so.startedAt) : null,
              finishedAt: so.finishedAt ? new Date(so.finishedAt) : null,
              shouldSync: (so as any).shouldSync !== false, // Include shouldSync flag (default true)
              createdAt: so.createdAt, // Keep createdAt for ordering
            }))
            // Push cancelled items to end, preserve API order (type + position) for the rest
            .sort((a, b) => {
              const aCancelled = a.status === SERVICE_ORDER_STATUS.CANCELLED ? 1 : 0;
              const bCancelled = b.status === SERVICE_ORDER_STATUS.CANCELLED ? 1 : 0;
              if (aCancelled !== bCancelled) return aCancelled - bCancelled;
              return 0; // Preserve API order (ordered by type asc, position asc)
            });
        }
        return [{
          // Default empty service order row - MUST include ALL fields used by ServiceRow
          status: SERVICE_ORDER_STATUS.PENDING,
          statusOrder: 1,
          description: "",
          type: SERVICE_ORDER_TYPE.PRODUCTION,
          assignedToId: null,
          observation: null, // Include observation to prevent useController from adding it
          startedAt: null,
          finishedAt: null,
        }];
      })(),
      // artworkIds must be File IDs (artwork.fileId or artwork.file.id), not Artwork entity IDs
      artworkIds: taskData.artworks?.map((artwork: any) => artwork.fileId || artwork.file?.id || artwork.id) || [],
      baseFileIds: taskData.baseFiles?.map((f) => f.id) || [],
      truck: {
        plate: taskData.truck?.plate || null,
        chassisNumber: taskData.truck?.chassisNumber || null,
        category: taskData.truck?.category || null,
        implementType: taskData.truck?.implementType || null,
        spot: taskData.truck?.spot || null,
      },
      // Initialize cuts with default row - part of initial state
      cuts: groupedCuts.length > 0
        ? groupedCuts
        : [{
            id: `cut-initial`,
            type: CUT_TYPE.VINYL,
            quantity: 1,
            origin: CUT_ORIGIN.PLAN,
            fileId: undefined,
            file: undefined,
          }],
      paintIds: taskData.logoPaints?.map((lp) => lp.id) || [],
      // Initialize airbrushings with default row - part of initial state
      // CRITICAL: Include 'id' field to preserve existing airbrushings during updates
      airbrushings: taskData.airbrushings && taskData.airbrushings.length > 0
        ? taskData.airbrushings.map((a) => ({
            id: a.id, // Preserve original airbrushing ID
            startDate: a.startDate ? new Date(a.startDate) : null,
            finishDate: a.finishDate ? new Date(a.finishDate) : null,
            price: a.price,
            status: a.status,
            receiptIds: a.receipts?.map((r: any) => r.id) || [],
            invoiceIds: a.invoices?.map((n: any) => n.id) || [],
            // CRITICAL: artworkIds should be File IDs (artwork.fileId), not Artwork entity IDs
            artworkIds: a.artworks?.map((art: any) => art.fileId || art.file?.id || art.id) || [],
            receipts: a.receipts || [],
            invoices: a.invoices || [],
            // Map Artwork entities to their File representation for display
            artworks: a.artworks?.map((art: any) => art.file || art) || [],
          }))
        : [{
            // Default empty airbrushing row
            id: `airbrushing-initial`,
            status: AIRBRUSHING_STATUS.PENDING,
            price: null,
            startDate: null,
            finishDate: null,
            receiptIds: [],
            invoiceIds: [],
            artworkIds: [],
            receipts: [],
            invoices: [],
            artworks: [],
          }],
      observation: taskData.observation ? {
        description: taskData.observation.description || "",
        fileIds: taskData.observation.files?.map((f: any) => f.id) || [],
      } : null,
    } as unknown as TaskUpdateFormData;
  }, [cutsData]); // Depend on cutsData to re-run when cuts are fetched

  // Handle form submission with only changed fields
  const handleFormSubmit = useCallback(
    async (changedData: Partial<TaskUpdateFormData>) => {
      console.log('[TaskEditForm] handleFormSubmit called');
      console.log('[TaskEditForm] changedData:', JSON.stringify(changedData, null, 2));

      // CRITICAL FIX: Set submission flag immediately to prevent sync interference
      // This must happen BEFORE any async operations to prevent race conditions
      isSubmittingRef.current = true;

      // NOTE: syncTimeoutRef was removed along with the sync block (now on task-quote page)

      // DEBUG: Log current form values for date fields
      // const _currentFormValues = form.getValues();
      // Current form values for dates: {
      //   forecastDate: currentFormValues.forecastDate,
      //   forecastDateType: typeof currentFormValues.forecastDate,
      //   forecastDateIsNull: currentFormValues.forecastDate === null,
      //   forecastDateIsUndefined: currentFormValues.forecastDate === undefined,
      //   entryDate: currentFormValues.entryDate,
      //   term: currentFormValues.term,
      // }

      // CRITICAL: Log deleted items for debugging
      console.log('[TaskEditForm] Deleted service orders tracked:', Array.from(deletedServiceOrderDescriptionsRef.current));

      try {
        // Validate responsible rows before submitting
        if (!validateResponsibleRows(responsibleRows)) {
          setShowResponsibleErrors(true);
          toast.error("Preencha o nome e telefone dos responsáveis");
          return;
        }

        setIsSubmitting(true);

        console.log('[TaskEditForm] 📋 ========== FORM SUBMISSION START ==========');
        console.log('[TaskEditForm] Raw changedData.quote BEFORE any processing:', JSON.stringify(changedData.quote, null, 2));

        // Set entry date to 7:30 if provided (since the date picker only allows date selection)
        if (changedData.entryDate) {
          const entryDate = new Date(changedData.entryDate);
          entryDate.setHours(7, 30, 0, 0);
          changedData.entryDate = entryDate;
        }


        // Set term date to 18:00 (end of work day) if provided
        if (changedData.term) {
          const termDate = new Date(changedData.term);
          termDate.setHours(18, 0, 0, 0);
          changedData.term = termDate;

        }

        // =====================
        // NORMALIZE DATA TYPES AND FIX ARRAY SERIALIZATION
        // This ensures proper types before submission to API
        // =====================

        // Helper: Convert objects with numeric keys to arrays
        const ensureArray = (value: any): any[] => {
          if (Array.isArray(value)) return value;
          if (value && typeof value === 'object' && !Array.isArray(value)) {
            // Check if it's an object with numeric keys (like {0: {...}, 1: {...}})
            const keys = Object.keys(value);
            if (keys.length > 0 && keys.every(k => /^\d+$/.test(k))) {
              // Convert to array, sorted by numeric key
              return keys.sort((a, b) => Number(a) - Number(b)).map(k => value[k]);
            }
          }
          return [];
        };

        // Helper: Convert string numbers to actual numbers
        const ensureNumber = (value: any): number | null => {
          if (value === null || value === undefined || value === '') return null;
          if (typeof value === 'number') return value;
          if (typeof value === 'string') {
            const num = parseFloat(value.replace(',', '.'));
            return isNaN(num) ? null : num;
          }
          return null;
        };

        // Ensure serviceOrders is an array
        if (changedData.serviceOrders) {
          changedData.serviceOrders = ensureArray(changedData.serviceOrders);
        }

        // Ensure paintIds is an array
        if (changedData.paintIds) {
          changedData.paintIds = ensureArray(changedData.paintIds);
        }

        // Ensure artworkIds is an array
        if (changedData.artworkIds) {
          changedData.artworkIds = ensureArray(changedData.artworkIds);
        }

        // Ensure baseFileIds is an array
        if (changedData.baseFileIds) {
          changedData.baseFileIds = ensureArray(changedData.baseFileIds);
        }

        // Ensure cuts is an array
        if (changedData.cuts) {
          changedData.cuts = ensureArray(changedData.cuts);
        }

        // Ensure airbrushings is an array
        if (changedData.airbrushings) {
          changedData.airbrushings = ensureArray(changedData.airbrushings);
        }

        // Ensure truck layoutSections are arrays
        if (changedData.truck) {
          const truck = changedData.truck as any;
          if (truck.leftSideLayout?.layoutSections) {
            truck.leftSideLayout.layoutSections = ensureArray(truck.leftSideLayout.layoutSections);
          }
          if (truck.rightSideLayout?.layoutSections) {
            truck.rightSideLayout.layoutSections = ensureArray(truck.rightSideLayout.layoutSections);
          }
          if (truck.backSideLayout?.layoutSections) {
            truck.backSideLayout.layoutSections = ensureArray(truck.backSideLayout.layoutSections);
          }
        }

        console.log('[TaskEditForm] Normalized changedData:', JSON.stringify(changedData, null, 2));

        // =====================
        // FILTER EMPTY DEFAULT ITEMS BEFORE CHANGE DETECTION
        // This ensures empty default rows don't count as "changes"
        // =====================

        // Filter out empty service orders (service orders with no description)
        // IMPORTANT: Keep existing service orders (with ID) even if description is short,
        // because they might have status or other field changes
        if (changedData.serviceOrders && Array.isArray(changedData.serviceOrders)) {
          changedData.serviceOrders = changedData.serviceOrders.filter(
            (service: any) => {
              // Keep if it has an ID (existing record) - might have status/field changes
              if (service.id) return true;
              // For new service orders (no ID), require description >= 3 chars
              return service.description && service.description.trim().length >= 3;
            }
          );
          // NOTE: We do NOT delete the serviceOrders array even if empty.
          // An empty array signals to the API that the user wants to delete all service orders.
          // If the array was not in changedData at all, it means service orders weren't modified.
        }

        // Remove quote from changedData - it's now managed on a separate page
        if (changedData.quote) {
          delete changedData.quote;
        }

        // Filter out empty airbrushings (airbrushings with no meaningful data)
        if (changedData.airbrushings && Array.isArray(changedData.airbrushings)) {
          changedData.airbrushings = changedData.airbrushings.filter((airbrushing: any) => {
            const hasPrice = airbrushing.price !== null && airbrushing.price !== undefined;
            const hasStartDate = airbrushing.startDate !== null && airbrushing.startDate !== undefined;
            const hasFinishDate = airbrushing.finishDate !== null && airbrushing.finishDate !== undefined;
            const hasReceiptFiles = airbrushing.receiptIds && airbrushing.receiptIds.length > 0;
            const hasInvoiceFiles = airbrushing.invoiceIds && airbrushing.invoiceIds.length > 0;
            const hasArtworkFiles = airbrushing.artworkIds && airbrushing.artworkIds.length > 0;
            const hasNewReceiptFiles = airbrushing.receiptFiles && airbrushing.receiptFiles.some((f: any) => f instanceof File);
            const hasNewInvoiceFiles = airbrushing.invoiceFiles && airbrushing.invoiceFiles.some((f: any) => f instanceof File);
            const hasNewArtworkFiles = airbrushing.artworkFiles && airbrushing.artworkFiles.some((f: any) => f instanceof File);

            return hasPrice || hasStartDate || hasFinishDate || hasReceiptFiles || hasInvoiceFiles || hasArtworkFiles || hasNewReceiptFiles || hasNewInvoiceFiles || hasNewArtworkFiles;
          });

          // If no valid airbrushings remain, remove entirely
          if (changedData.airbrushings.length === 0) {
            delete changedData.airbrushings;
          }
        }

        // =====================
        // CHECK FOR CHANGES AFTER FILTERING
        // =====================

        // Check if there are cuts to create (counts as changes)
        const cuts = form.getValues('cuts') as any[] || [];
        const hasCutsToCreate = cuts.length > 0 && cuts.some((cut) => cut.file && cut.file instanceof File);

        // Validate that we have changes (form, layout, file changes, artwork status changes, or cuts to create)
        console.log('[TaskEditForm] Change detection:', {
          changedDataKeys: Object.keys(changedData),
          changedDataLength: Object.keys(changedData).length,
          hasLayoutChanges,
          hasFileChanges,
          hasArtworkStatusChanges,
          hasCutsToCreate,
        });
        if (Object.keys(changedData).length === 0 && !hasLayoutChanges && !hasFileChanges && !hasArtworkStatusChanges && !hasCutsToCreate && !hasNewResponsibles) {
          console.log('[TaskEditForm] ❌ Early return: no changes detected');
          return;
        }

        // CRITICAL: Wait for pending checkin/checkout pre-uploads to complete before saving
        // Without this, saving before upload completes would send empty checkinFileIds/checkoutFileIds,
        // causing the API to clear existing file associations via { set: [] }
        if (pendingCheckinUploadsRef.current > 0 || pendingCheckoutUploadsRef.current > 0) {
          console.log('[TaskEditForm] ⏳ Waiting for pending checkin/checkout pre-uploads...');
          toast.info('Aguardando upload das fotos ser concluído...');
          // Poll until uploads complete (check every 200ms, timeout after 30s)
          const maxWait = 30000;
          const pollInterval = 200;
          let waited = 0;
          while ((pendingCheckinUploadsRef.current > 0 || pendingCheckoutUploadsRef.current > 0) && waited < maxWait) {
            await new Promise(resolve => setTimeout(resolve, pollInterval));
            waited += pollInterval;
          }
          if (pendingCheckinUploadsRef.current > 0 || pendingCheckoutUploadsRef.current > 0) {
            console.log('[TaskEditForm] ❌ Pre-upload timed out');
            toast.error('O upload das fotos está demorando. Tente novamente.');
            return;
          }
          console.log('[TaskEditForm] ✅ Pre-uploads completed');
        }

        // Filter out cuts without files (empty/default cuts)
        // Only cuts with files will be submitted
        const validCuts = cuts.filter((cut) => cut.file || cut.fileId);

        // Update the form with filtered cuts
        if (validCuts.length !== cuts.length) {
          form.setValue('cuts', validCuts);
        }

        // Check if there's a layout width error
        if (layoutWidthError) {
          console.log('[TaskEditForm] ❌ Early return: layoutWidthError =', layoutWidthError);
          toast.error("Corrija os erros de layout antes de enviar o formulário.");
          return;
        }

        // Validate observation is complete if data has been entered
        const observation = form.getValues('observation');
        const hasObservationData = observation?.description || observationFiles.length > 0;

        if (hasObservationData) {
          const hasDescription = observation?.description && observation.description.trim() !== "";
          const hasFiles = (observation?.fileIds && observation.fileIds.length > 0) || observationFiles.length > 0;

          if (!hasDescription) {
            console.log('[TaskEditForm] ❌ Early return: observation has data but no description');
            toast.error("A observação está incompleta. Preencha a descrição antes de enviar o formulário.");
            return;
          }

          if (!hasFiles) {
            console.log('[TaskEditForm] ❌ Early return: observation has data but no files');
            toast.error("A observação está incompleta. Adicione pelo menos um arquivo antes de enviar o formulário.");
            return;
          }
        }

        // Track layout photo files
        let layoutPhotoFiles: { side: string; file: File }[] = [];

        // If layout changes exist, add layout data to changedData

        // Handle layout deletion if user clicked the remove button
        if (shouldDeleteLayouts && layoutsData) {

          const deletePromises: Promise<any>[] = [];

          if (layoutsData.leftSideLayout?.id) {
            
            deletePromises.push(deleteLayout(layoutsData.leftSideLayout.id));
          }
          if (layoutsData.rightSideLayout?.id) {
            
            deletePromises.push(deleteLayout(layoutsData.rightSideLayout.id));
          }
          if (layoutsData.backSideLayout?.id) {
            
            deletePromises.push(deleteLayout(layoutsData.backSideLayout.id));
          }

          if (deletePromises.length > 0) {
            try {
              await Promise.all(deletePromises);
            } catch (error) {
              // Layout deletion failed silently
            }
          }

          // Reset the flag after deletion
          setShouldDeleteLayouts(false);
        }

        // Consolidate truck data with layouts into single truck object
        if (hasLayoutChanges && !shouldDeleteLayouts) {

          // Start with existing truck data from form
          const consolidatedTruck: any = changedData.truck || {};

          // Add ONLY the sides that were actually modified by the user
          for (const side of modifiedLayoutSides) {
            
            const sideData = currentLayoutStates[side];

            if (sideData && sideData.layoutSections && sideData.layoutSections.length > 0) {
              // Map internal side names to API field names
              const layoutFieldName = side === 'left' ? 'leftSideLayout' : side === 'right' ? 'rightSideLayout' : 'backSideLayout';
              const sideName = side === 'left' ? 'leftSide' : side === 'right' ? 'rightSide' : 'backSide';

              // Extract photo file if present
              if (sideData.photoFile && sideData.photoFile instanceof File) {
                
                layoutPhotoFiles.push({ side: sideName, file: sideData.photoFile });
              }

              consolidatedTruck[layoutFieldName] = {
                height: sideData.height,
                layoutSections: sideData.layoutSections,
                photoId: sideData.photoId || null,
              };
              
            } else {
              
            }
          }

          // Merge consolidated truck back into changedData
          changedData.truck = consolidatedTruck;

        }

        // If only cuts exist (no other changes), we still need to update the task to trigger cut creation
        if (Object.keys(changedData).length === 0 && !hasLayoutChanges && !hasFileChanges && !hasArtworkStatusChanges && hasCutsToCreate) {

          (changedData as any)._onlyCuts = true; // Marker field to prevent empty body
        }

        // If only new responsibles exist (no other changes), we still need to update the task
        if (Object.keys(changedData).length === 0 && !hasLayoutChanges && !hasFileChanges && !hasArtworkStatusChanges && !hasCutsToCreate && hasNewResponsibles) {
          console.log('[TaskEditForm] Only new responsibles detected, adding marker field');
          (changedData as any)._onlyNewResponsibles = true; // Marker field to prevent empty body
        }

        // Check if we have new files that need to be uploaded
        
        const newArtworkFiles = uploadedFiles.filter(f => !f.uploaded);
        const newBaseFiles = baseFiles.filter(f => !f.uploaded);
        const newProjectFiles = projectFiles.filter(f => !f.uploaded);
        const newObservationFiles = observationFiles.filter(f => !f.uploaded);

        // Check for cut files
        const changedCuts = changedData.cuts as any[] || [];
        const hasCutFiles = changedCuts.some(cut => cut.file && cut.file instanceof File);

        // Check for airbrushing files
        const airbrushings = changedData.airbrushings as any[] || [];
        const hasAirbrushingFiles = airbrushings.some(a =>
          (a.receiptFiles && a.receiptFiles.some((f: any) => f instanceof File)) ||
          (a.invoiceFiles && a.invoiceFiles.some((f: any) => f instanceof File)) ||
          (a.artworkFiles && a.artworkFiles.some((f: any) => f instanceof File))
        );

        // Note: checkin/checkout files are pre-uploaded per SO, their IDs are injected into serviceOrders data
        // They should NOT trigger the FormData path since no binary files need to be sent
        const hasNewFiles = newArtworkFiles.length > 0 ||
                           newBaseFiles.length > 0 || newProjectFiles.length > 0 ||
                           hasCutFiles || hasAirbrushingFiles ||
                           newObservationFiles.length > 0 || layoutPhotoFiles.length > 0;

        let result;

        console.log('[TaskEditForm] ✅ All validations passed, preparing submission');
        console.log('[TaskEditForm] hasNewFiles:', hasNewFiles);

        if (hasNewFiles) {
          // Get customer data for file organization context
          const customer = task.customer;

          // Prepare files object for the helper
          const files: Record<string, File[]> = {};

          if (newArtworkFiles.length > 0) {
            files.artworks = newArtworkFiles.filter(f => f instanceof File) as File[];
          }
          if (newBaseFiles.length > 0) {
            files.baseFiles = newBaseFiles.filter(f => f instanceof File) as File[];
          }
          if (newProjectFiles.length > 0) {
            files.projectFiles = newProjectFiles.filter(f => f instanceof File) as File[];
          }
          // Note: checkin/checkout files are pre-uploaded per service order, not sent as task-level multipart
          if (newObservationFiles.length > 0) {

            files.observationFiles = newObservationFiles.filter(f => f instanceof File) as File[];

          }

          // Add layout photo files if any (sent WITH task update, backend handles them)
          if (layoutPhotoFiles.length > 0) {
            
            layoutPhotoFiles.forEach(({ side, file }) => {
              // Backend expects: layoutPhotos.leftSide, layoutPhotos.rightSide, layoutPhotos.backSide
              files[`layoutPhotos.${side}`] = [file];
              
            });
          }

          // DON'T send cuts with task update - they'll be created separately
          // Remove cuts from changedData to avoid sending them with the task
          if (changedData.cuts) {
            delete changedData.cuts;
          }

          // Extract files from airbrushing objects (filtering was done earlier)
          const airbrushings = changedData.airbrushings as any[] || [];
          if (airbrushings.length > 0) {
            airbrushings.forEach((airbrushing, index) => {
              // Extract files from airbrushing objects
              if (airbrushing.receiptFiles && Array.isArray(airbrushing.receiptFiles)) {
                const airbrushingReceipts = airbrushing.receiptFiles.filter((f: any) => f instanceof File);
                if (airbrushingReceipts.length > 0) {
                  files[`airbrushings[${index}].receipts`] = airbrushingReceipts;
                }
                // Remove file objects from airbrushing data to avoid sending them in JSON body
                delete airbrushing.receiptFiles;
              }
              if (airbrushing.invoiceFiles && Array.isArray(airbrushing.invoiceFiles)) {
                const airbrushingInvoices = airbrushing.invoiceFiles.filter((f: any) => f instanceof File);
                if (airbrushingInvoices.length > 0) {
                  files[`airbrushings[${index}].invoices`] = airbrushingInvoices;
                }
                // Remove file objects from airbrushing data to avoid sending them in JSON body
                delete airbrushing.invoiceFiles;
              }
              if (airbrushing.artworkFiles && Array.isArray(airbrushing.artworkFiles)) {
                const airbrushingArtworks = airbrushing.artworkFiles.filter((f: any) => f instanceof File);
                if (airbrushingArtworks.length > 0) {
                  files[`airbrushings[${index}].artworks`] = airbrushingArtworks;
                }
                // Remove file objects from airbrushing data to avoid sending them in JSON body
                delete airbrushing.artworkFiles;
              }
            });
          }

          // Fields that should NEVER be sent via FormData to avoid huge payloads
          // These are large arrays that bloat the payload size
          // MUST MATCH fieldsToOmitIfUnchanged in useEditForm config
          // NOTE: 'cuts' are excluded - created separately via POST /cuts
          // NOTE: 'airbrushings', 'quote', 'serviceOrders' are NOT excluded - they use filtering logic
          const excludedFields = new Set([
            'cuts',
            'paintIds',
            'artworkIds',
            'baseFileIds',
            'reimbursementIds',
            'reimbursementInvoiceIds',
            'responsibleIds', // Handled separately below
          ]);

          // Prepare data object with only changed fields (excluding large arrays unless they changed)
          const dataForFormData: Record<string, any> = {};
          let fieldCount = 0;
          let excludedCount = 0;

          // Fields that can be explicitly set to null (to clear their value)
          const nullableFields = new Set([
            'forecastDate',
            'entryDate',
            'term',
            'startedAt',
            'finishedAt',
            'customerId',
            'sectorId',
            'paintId',
            'serialNumber',
            'details',
            'commission',
            'observation',
          ]);

          Object.entries(changedData).forEach(([key, value]) => {
            // Skip excluded fields (large arrays) - they should only be sent if explicitly updated
            if (excludedFields.has(key)) {

              excludedCount++;
              return;
            }

            // For nullable fields, always include them (treat undefined as null for clearing)
            if (nullableFields.has(key)) {
              // Convert undefined to null for nullable fields (clearing the field)
              dataForFormData[key] = value ?? null;
              fieldCount++;
            } else if (value !== undefined && value !== null) {
              // For non-nullable fields, only include if has actual value
              dataForFormData[key] = value;
              fieldCount++;
            }
          });

          // Log summary

          // CRITICAL: If no form fields were added but we have files, add a marker field
          // This prevents the body from being undefined, which causes multer to hang
          if (fieldCount === 0) {
            dataForFormData._hasFiles = true;

          }

          // Send the IDs of files to KEEP (backend uses 'set' to replace all files)
          // Extract IDs of uploaded (existing) files from uploadedFiles state
          // IMPORTANT: Always use uploadedFiles as source of truth - it reflects user's current selection
          // including any files they removed. We no longer fall back to task.artworks because
          // that would restore files the user intentionally deleted.
          const currentArtworkIds = uploadedFiles
            .filter(f => f.uploaded)
            .map(f => f.uploadedFileId || f.id)
            .filter(Boolean) as string[];

          console.log('[Task Update] 📦 FormData - Using uploadedFiles as source of truth:', {
            uploadedFilesCount: uploadedFiles.length,
            uploadedFilesUploaded: uploadedFiles.filter(f => f.uploaded).length,
            currentArtworkIds,
            hasArtworkStatusChanges,
          });

          const currentBaseFileIds = baseFiles.filter(f => f.uploaded).map(f => f.uploadedFileId || f.id).filter(Boolean) as string[];
          const currentProjectFileIds = projectFiles.filter(f => f.uploaded).map(f => f.uploadedFileId || f.id).filter(Boolean) as string[];
          console.log('[Task Update] 📦 FormData - File IDs being sent:', {
            hasArtworkStatusChanges,
            hasArtworkFileChanges,
            uploadedFilesLength: uploadedFiles.length,
            taskArtworksLength: task.artworks?.length || 0,
            currentArtworkIds,
            artworkStatuses: Object.keys(artworkStatuses).length > 0 ? artworkStatuses : 'empty',
          });

          // Only send artworkIds if the user actually modified artworks
          // Sending it unconditionally causes accidental clearing when sectors without artwork access submit the form
          // Financial users cannot see/edit artworks (section is hidden), so they should never send artworkIds
          // This matches the pattern used for baseFileIds and other file types
          if (!isFinancialUser && (hasArtworkFileChanges || newArtworkFiles.length > 0 || hasArtworkStatusChanges)) {
            dataForFormData.artworkIds = currentArtworkIds;
          }
          // Only send baseFileIds if the user actually modified base files
          // Sending it unconditionally causes accidental clearing when other sectors submit the form
          if (hasBaseFileChanges || newBaseFiles.length > 0) {
            dataForFormData.baseFileIds = currentBaseFileIds;
          }
          if (hasProjectFileChanges || newProjectFiles.length > 0) {
            dataForFormData.projectFileIds = currentProjectFileIds;
          }
          // Inject checkin/checkout file IDs into service orders data (per service order)
          // Use refs to get the latest file state (avoids stale closure after waiting for uploads)
          if (!isCommercialUser && (hasCheckinFileChanges || hasCheckoutFileChanges)) {
            // Ensure serviceOrders is present — it may not be in changedData if only files changed
            if (!dataForFormData.serviceOrders) {
              const formSOs = form.getValues("serviceOrders") || [];
              dataForFormData.serviceOrders = ensureArray(formSOs).filter((so: any) => so.id);
            }
            const latestCheckinFiles = checkinFilesByServiceOrderRef.current;
            const latestCheckoutFiles = checkoutFilesByServiceOrderRef.current;
            const serviceOrders = dataForFormData.serviceOrders as any[] || [];
            for (const so of serviceOrders) {
              if (so.id) {
                if (hasCheckinFileChanges) {
                  const soCheckinFiles = latestCheckinFiles[so.id] || [];
                  so.checkinFileIds = soCheckinFiles.filter((f: any) => f.uploaded && f.uploadedFileId).map((f: any) => f.uploadedFileId);
                }
                if (hasCheckoutFileChanges) {
                  const soCheckoutFiles = latestCheckoutFiles[so.id] || [];
                  so.checkoutFileIds = soCheckoutFiles.filter((f: any) => f.uploaded && f.uploadedFileId).map((f: any) => f.uploadedFileId);
                }
              }
            }
          }
          // Note: artworkStatuses will be added later (around line 1125) after processing
          // This ensures we use the state variable directly, not a rebuilt version

          // CRITICAL: Clean up malformed data before creating FormData
          const fileIdFields = ['artworkIds', 'baseFileIds'];
          const dateFields = ['startedAt', 'completedAt', 'entryDate', 'forecastDate', 'deliveryDate'];

          for (const field of fileIdFields) {
            if (field in dataForFormData) {
              const value = dataForFormData[field];
              // Check if it's an empty object {} (not an array) and fix it
              if (value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0) {
                dataForFormData[field] = []; // Convert empty objects to empty arrays
              }
              // Convert objects with numeric keys to arrays
              else if (value && typeof value === 'object' && !Array.isArray(value)) {
                const keys = Object.keys(value);
                const isNumericKeys = keys.length > 0 && keys.every((k) => /^\d+$/.test(k));
                if (isNumericKeys) {
                  dataForFormData[field] = Object.values(value);
                }
              }
            }
          }

          // Remove empty object date fields
          for (const field of dateFields) {
            if (field in dataForFormData) {
              const value = dataForFormData[field];
              if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date) && Object.keys(value).length === 0) {
                delete dataForFormData[field]; // Remove empty date objects
              }
            }
          }

          // Fix serviceOrders if it's an object with numeric keys instead of an array
          if ('serviceOrders' in dataForFormData && dataForFormData.serviceOrders) {
            const value = dataForFormData.serviceOrders;
            if (typeof value === 'object' && !Array.isArray(value)) {
              const keys = Object.keys(value);
              const isNumericKeys = keys.length > 0 && keys.every((k) => /^\d+$/.test(k));
              if (isNumericKeys) {
                dataForFormData.serviceOrders = Object.values(value);
              }
            }
          }

          // CRITICAL: Add back excluded fields if they actually changed
          // These were excluded to optimize payload size but need to be sent if modified
          if ('paintIds' in changedData) {
            dataForFormData.paintIds = changedData.paintIds;
            
          }
          if ('serviceOrders' in changedData) {
            dataForFormData.serviceOrders = changedData.serviceOrders;
            // CRITICAL DEBUG: Log service orders being sent to API for deletion tracking
            console.log('[TaskEditForm] 📤 FormData - Service orders to submit:', {
              count: Array.isArray(changedData.serviceOrders) ? changedData.serviceOrders.length : 'not array',
              ids: Array.isArray(changedData.serviceOrders) ? changedData.serviceOrders.map((so: any) => so.id || 'NEW').join(', ') : 'N/A',
              descriptions: Array.isArray(changedData.serviceOrders) ? changedData.serviceOrders.map((so: any) => so.description?.substring(0, 20)).join(', ') : 'N/A',
            });
          }
          if ('reimbursementIds' in changedData) {
            dataForFormData.reimbursementIds = changedData.reimbursementIds;
            
          }
          if ('reimbursementInvoiceIds' in changedData) {
            dataForFormData.reimbursementInvoiceIds = changedData.reimbursementInvoiceIds;
            
          }

          // CRITICAL: Build artworkStatuses as a UUID-keyed OBJECT
          // Backend schema expects: z.record(z.string().uuid(), z.enum(['DRAFT', 'APPROVED', 'REPROVED']))
          // For FormData: wrap in array so it gets sent as artworkStatuses[0]=JSON.stringify(object)
          // Backend preprocess will parse the JSON and merge into proper record format
          const existingArtworkStatusesMap: Record<string, 'DRAFT' | 'APPROVED' | 'REPROVED'> = {};
          currentArtworkIds.forEach(fileId => {
            // Get status from state first (user's pending changes take priority)
            const statusFromState = artworkStatuses[fileId];
            if (statusFromState) {
              existingArtworkStatusesMap[fileId] = statusFromState;
            } else {
              // Try to find the file and get its status
              const file = uploadedFiles.find(f => (f.uploadedFileId || f.id) === fileId);
              const statusFromFile = file?.status;
              existingArtworkStatusesMap[fileId] = (statusFromFile as 'DRAFT' | 'APPROVED' | 'REPROVED') || 'DRAFT';
            }
          });

          // Build newArtworkStatuses for NEW files being uploaded (array matching new files order)
          const newArtworkStatuses: ('DRAFT' | 'APPROVED' | 'REPROVED')[] = [];
          uploadedFiles.forEach((file) => {
            if (!file.uploaded && !file.uploadedFileId) {
              // New file being uploaded - get status from artworkStatuses state or default to DRAFT
              const fileId = file.uploadedFileId || file.name || file.id; // Use name or id as fallback for new files
              const status = artworkStatuses[fileId] || file.status || 'DRAFT';
              newArtworkStatuses.push(status as 'DRAFT' | 'APPROVED' | 'REPROVED');
            }
          });

          console.log('[Task Update] 📦 FormData - Artwork statuses debug:', {
            uploadedFilesCount: uploadedFiles.length,
            artworkStatusesFromState: artworkStatuses,
            currentArtworkIds,
            existingArtworkStatusesMap,
            newFileStatuses: newArtworkStatuses,
            hasArtworkStatusChanges,
          });

          // Send statuses for existing files as UUID-keyed object wrapped in array for FormData
          // FormData helper will send: artworkStatuses[0]=JSON.stringify({uuid1: status1, uuid2: status2})
          // Backend preprocess expects array-like with JSON string values to parse and merge
          if (Object.keys(existingArtworkStatusesMap).length > 0) {
            dataForFormData.artworkStatuses = [existingArtworkStatusesMap];
            console.log('[Task Update] 📦 FormData - Including artworkStatuses (UUID-keyed object in array):', existingArtworkStatusesMap);
          }

          // Send statuses for new files being uploaded (array matching new files order)
          if (newArtworkStatuses.length > 0) {
            dataForFormData.newArtworkStatuses = newArtworkStatuses;
            console.log('[Task Update] 📦 FormData - Including newArtworkStatuses:', newArtworkStatuses);
          }

          // Handle responsibles - only send if there's an actual change
          // Get original responsible IDs from the task
          const originalRepIds = (task.responsibles || []).map(r => r.id).sort();

          // Collect existing responsible IDs from the form
          const existingRepIds = responsibleRows
            .filter(row => !row.isNew && row.id && !row.id.startsWith('temp-'))
            .map(row => row.id)
            .sort();

          // Prepare new responsibles to create inline
          // Use the row's companyId if set (from customer combobox), otherwise fall back to task's customerId
          const defaultCompanyId = changedData.customerId || task.customerId;
          const newReps = responsibleRows
            .filter(row => row.isNew && row.name.trim() && row.phone.trim())
            .map(row => ({
              name: row.name.trim(),
              phone: row.phone.trim(),
              email: row.email?.trim() || undefined,
              role: row.role,
              isActive: row.isActive !== undefined ? row.isActive : true,
              companyId: row.companyId || defaultCompanyId,
            }));

          // Check if responsibles actually changed
          const repIdsChanged = originalRepIds.join(',') !== existingRepIds.join(',');
          const hasNewReps = newReps.length > 0;

          console.log('[Task Update] Processing responsibles:', {
            originalRepIds,
            existingRepIds,
            repIdsChanged,
            hasNewReps,
            newReps: newReps.length,
          });

          // Only send responsible data if there's an actual change
          if (repIdsChanged || hasNewReps) {
            // Always send responsibleIds when changed (even empty to remove all)
            dataForFormData.responsibleIds = existingRepIds;
            console.log('[Task Update] Including responsible IDs (changed):', existingRepIds);

            // Include new responsibles to be created by the backend
            if (hasNewReps) {
              dataForFormData.newResponsibles = newReps;
              console.log('[Task Update] Including new responsibles to create:', JSON.stringify(newReps, null, 2));
            }
          } else {
            console.log('[Task Update] Responsibles unchanged, not sending');
          }

          // Remove marker fields before sending to API
          delete dataForFormData._onlyCuts;
          delete dataForFormData._onlyNewResponsibles;

          // Use the helper to create FormData with proper context
          const formData = createFormDataWithContext(
            dataForFormData,
            files,
            {
              entityType: 'task',
              entityId: task.id,
              customer: customer ? {
                id: customer.id,
                name: customer.corporateName || customer.fantasyName,
                fantasyName: customer.fantasyName,
              } : undefined,
            }
          );

          // Attach forecast reschedule reason to FormData if forecastDate changed
          if (showForecastReason && forecastReason && formData.has('forecastDate')) {
            formData.append('forecastReason', forecastReason);
          }

          // DEBUG: Log what's actually in the FormData
          console.log('[Task Update] 📤 FormData contents:');
          for (const [key, value] of formData.entries()) {
            if (key === 'artworkIds' || key.startsWith('artworkIds[') || key === 'artworkStatuses') {
              console.log(`  ${key}: ${value}`);
            }
          }

          result = await updateAsync({
            id: task.id,
            data: formData as any,
            query: {
              include: {
                artworks: true,
                baseFiles: true,
                projectFiles: true,
                checkinFiles: true,
                checkoutFiles: true,
                serviceOrders: {
                  include: {
                    checkinFiles: true,
                    checkoutFiles: true,
                  },
                },
              },
            },
          });
        } else {
          // Use regular JSON when no files are present
          const submitData = { ...changedData };

          // DEBUG: Log submitData immediately after creation
          console.log('[TaskEditForm] JSON path - changedData received:', JSON.stringify(changedData, (_key, value) => {
            if (value instanceof Date) return `Date(${value.toISOString()})`;
            return value;
          }, 2));
          console.log('[TaskEditForm] JSON path - changedData.forecastDate:', changedData.forecastDate, 'isNull:', changedData.forecastDate === null);
          console.log('[TaskEditForm] JSON path - submitData after spread:', JSON.stringify(submitData, (_key, value) => {
            if (value instanceof Date) return `Date(${value.toISOString()})`;
            return value;
          }, 2));

          // CRITICAL: Convert undefined to null for nullable fields (clearing the field)
          // This ensures the backend receives explicit null values to clear these fields
          const nullableFields = new Set([
            'forecastDate',
            'entryDate',
            'term',
            'startedAt',
            'finishedAt',
            'customerId',
            'sectorId',
            'paintId',
            'serialNumber',
            'details',
            'commission',
            'observation',
          ]);

          // Convert undefined to null for nullable fields that are in changedData
          for (const field of nullableFields) {
            if (field in submitData && (submitData as any)[field] === undefined) {
              (submitData as any)[field] = null;
            }
          }

          // CRITICAL: Exclude cuts from JSON submission - cuts are created separately via POST /cuts
          // Sending cuts here would cause backend to deleteMany + create, losing existing cut statuses
          delete submitData.cuts;

          // Exclude responsibleIds - handled separately below to avoid false changelog entries
          delete submitData.responsibleIds;

          // Even if no new files, check for deleted files
          // Send the IDs of files to KEEP (backend uses 'set' to replace all files)
          // Extract IDs of uploaded (existing) files
          const currentArtworkIds = uploadedFiles.filter(f => f.uploaded).map(f => f.uploadedFileId || f.id).filter(Boolean) as string[];
          const currentBaseFileIds = baseFiles.filter(f => f.uploaded).map(f => f.uploadedFileId || f.id).filter(Boolean) as string[];
          const currentProjectFileIds = projectFiles.filter(f => f.uploaded).map(f => f.uploadedFileId || f.id).filter(Boolean) as string[];
          // Send file IDs arrays when files exist
          // Backend uses these to replace all files via 'set' operation
          // CRITICAL: Always send artworkIds when artworkStatuses is present to prevent removal
          // If only status changed (no file add/remove), we must send existing file IDs
          console.log('[Task Update] 📊 Artwork Debug Info:', {
            uploadedFiles: uploadedFiles,
            uploadedFilesLength: uploadedFiles.length,
            uploadedFilesWithFlag: uploadedFiles.filter(f => f.uploaded),
            currentArtworkIds: currentArtworkIds,
            hasArtworkStatusChanges,
            hasArtworkFileChanges,
            artworkStatuses: Object.keys(artworkStatuses).length > 0 ? artworkStatuses : 'empty',
            taskArtworks: task.artworks?.length || 0,
          });

          // CRITICAL: Always send artworkIds when:
          // 1. There are artwork IDs to send (keeping some artworks)
          // 2. Status changes were made
          // 3. Artwork files were modified (added or removed) - even if resulting in empty array
          // 4. Task originally had artworks (to handle removal case)
          const taskHadArtworks = task.artworks && task.artworks.length > 0;
          const shouldSendArtworkIds = currentArtworkIds.length > 0 || hasArtworkStatusChanges || hasArtworkFileChanges || taskHadArtworks;

          if (shouldSendArtworkIds) {
            submitData.artworkIds = [...currentArtworkIds]; // Spread to ensure it's an array (may be empty for removal)
            console.log('[Task Update] ✅ Including artworkIds:', submitData.artworkIds, {
              reason: {
                hasIds: currentArtworkIds.length > 0,
                hasStatusChanges: hasArtworkStatusChanges,
                hasFileChanges: hasArtworkFileChanges,
                taskHadArtworks,
              }
            });
          } else {
            console.log('[Task Update] ⚠️ NOT including artworkIds (task had no artworks and no changes)');
          }

          // Send artwork statuses for approval workflow as UUID-keyed object
          // Backend schema expects: z.record(z.string().uuid(), z.enum(['DRAFT', 'APPROVED', 'REPROVED']))
          const existingArtworkStatusesJson: Record<string, 'DRAFT' | 'APPROVED' | 'REPROVED'> = {};
          currentArtworkIds.forEach(fileId => {
            // Get status from state first (user's pending changes take priority)
            const statusFromState = artworkStatuses[fileId];
            if (statusFromState) {
              existingArtworkStatusesJson[fileId] = statusFromState;
            } else {
              // Try to find the file and get its status
              const file = uploadedFiles.find(f => (f.uploadedFileId || f.id) === fileId);
              const statusFromFile = file?.status;
              existingArtworkStatusesJson[fileId] = (statusFromFile as 'DRAFT' | 'APPROVED' | 'REPROVED') || 'DRAFT';
            }
          });

          if (Object.keys(existingArtworkStatusesJson).length > 0) {
            (submitData as any).artworkStatuses = existingArtworkStatusesJson;
            console.log('[Task Update] ✅ Including artworkStatuses in JSON (UUID-keyed object):', existingArtworkStatusesJson);
          }
          // Only send baseFileIds if the user actually modified base files
          if (hasBaseFileChanges) {
            submitData.baseFileIds = [...currentBaseFileIds];
          }
          if (hasProjectFileChanges) {
            (submitData as any).projectFileIds = [...currentProjectFileIds];
          }
          // Inject checkin/checkout file IDs into service orders data (per service order)
          // Use refs to get the latest file state (avoids stale closure after waiting for uploads)
          if (!isCommercialUser && (hasCheckinFileChanges || hasCheckoutFileChanges)) {
            // Ensure serviceOrders is present — it may not be in changedData if only files changed
            if (!(submitData as any).serviceOrders) {
              const formSOs = form.getValues("serviceOrders") || [];
              (submitData as any).serviceOrders = ensureArray(formSOs).filter((so: any) => so.id);
            }
            const latestCheckinFiles = checkinFilesByServiceOrderRef.current;
            const latestCheckoutFiles = checkoutFilesByServiceOrderRef.current;
            const serviceOrders = (submitData as any).serviceOrders as any[] || [];
            for (const so of serviceOrders) {
              if (so.id) {
                if (hasCheckinFileChanges) {
                  const soCheckinFiles = latestCheckinFiles[so.id] || [];
                  so.checkinFileIds = soCheckinFiles.filter((f: any) => f.uploaded && f.uploadedFileId).map((f: any) => f.uploadedFileId);
                }
                if (hasCheckoutFileChanges) {
                  const soCheckoutFiles = latestCheckoutFiles[so.id] || [];
                  so.checkoutFileIds = soCheckoutFiles.filter((f: any) => f.uploaded && f.uploadedFileId).map((f: any) => f.uploadedFileId);
                }
              }
            }
          }

          // CRITICAL: Clean up malformed data before sending
          // Remove empty objects that should be arrays or dates
          const fileIdFields = ['artworkIds', 'baseFileIds'];
          const dateFields = ['startedAt', 'completedAt', 'entryDate', 'forecastDate', 'deliveryDate'];

          for (const field of fileIdFields) {
            if (field in submitData) {
              const value = (submitData as any)[field];
              // Check if it's an empty object {} (not an array)
              if (value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0) {
                delete (submitData as any)[field]; // Remove empty objects
              }
              // Convert objects with numeric keys to arrays
              else if (value && typeof value === 'object' && !Array.isArray(value)) {
                const keys = Object.keys(value);
                const isNumericKeys = keys.length > 0 && keys.every((k) => /^\d+$/.test(k));
                if (isNumericKeys) {
                  (submitData as any)[field] = Object.values(value);
                }
              }
            }
          }

          // Remove empty object date fields
          for (const field of dateFields) {
            if (field in submitData) {
              const value = (submitData as any)[field];
              if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date) && Object.keys(value).length === 0) {
                delete (submitData as any)[field]; // Remove empty date objects
              }
            }
          }

          // Fix serviceOrders if it's an object with numeric keys instead of an array
          if ('serviceOrders' in submitData && submitData.serviceOrders) {
            const value = submitData.serviceOrders;
            if (typeof value === 'object' && !Array.isArray(value)) {
              const keys = Object.keys(value);
              const isNumericKeys = keys.length > 0 && keys.every((k) => /^\d+$/.test(k));
              if (isNumericKeys) {
                submitData.serviceOrders = Object.values(value);
              }
            }
          }

          // CRITICAL DEBUG: Log service orders being sent to API for deletion tracking
          if ('serviceOrders' in submitData) {
            console.log('[TaskEditForm] 📤 JSON - Service orders to submit:', {
              count: Array.isArray(submitData.serviceOrders) ? submitData.serviceOrders.length : 'not array',
              ids: Array.isArray(submitData.serviceOrders) ? submitData.serviceOrders.map((so: any) => so.id || 'NEW').join(', ') : 'N/A',
              descriptions: Array.isArray(submitData.serviceOrders) ? submitData.serviceOrders.map((so: any) => so.description?.substring(0, 20)).join(', ') : 'N/A',
            });
          } else {
            console.log('[TaskEditForm] 📤 JSON - NO serviceOrders in submitData (not modified)');
          }

          // CRITICAL: paintIds is already in changedData (not excluded in JSON path)
          // No need to add it separately like in FormData path

          // Handle responsibles - only send if there's an actual change
          // Get original responsible IDs from the task
          const originalRepIdsJson = (task.responsibles || []).map(r => r.id).sort();

          // Collect existing responsible IDs from the form
          const existingRepIdsJson = responsibleRows
            .filter(row => !row.isNew && row.id && !row.id.startsWith('temp-'))
            .map(row => row.id)
            .sort();

          // Prepare new responsibles to create inline
          // Use the row's companyId if set (from customer combobox), otherwise fall back to task's customerId
          const defaultCompanyIdForJson = changedData.customerId || task.customerId;
          const newRepsJson = responsibleRows
            .filter(row => row.isNew && row.name.trim() && row.phone.trim())
            .map(row => ({
              name: row.name.trim(),
              phone: row.phone.trim(),
              email: row.email?.trim() || undefined,
              role: row.role,
              isActive: row.isActive,
              companyId: row.companyId || defaultCompanyIdForJson,
            }));

          // Check if responsibles actually changed
          const repIdsChangedJson = originalRepIdsJson.join(',') !== existingRepIdsJson.join(',');
          const hasNewRepsJson = newRepsJson.length > 0;

          console.log('[TaskEditForm] 📤 JSON - Processing responsibles:', {
            originalRepIdsJson,
            existingRepIdsJson,
            repIdsChangedJson,
            hasNewRepsJson,
          });

          // Only send responsible data if there's an actual change
          if (repIdsChangedJson || hasNewRepsJson) {
            // Always send responsibleIds when changed (even empty to remove all)
            submitData.responsibleIds = existingRepIdsJson;
            console.log('[TaskEditForm] 📤 JSON - Including responsible IDs (changed):', existingRepIdsJson);

            if (hasNewRepsJson) {
              submitData.newResponsibles = newRepsJson;
              console.log('[TaskEditForm] 📤 JSON - Including newResponsibles:', newRepsJson);
            }
          } else {
            console.log('[TaskEditForm] 📤 JSON - Responsibles unchanged, not sending');
          }

          // Remove marker fields before sending to API
          delete (submitData as any)._onlyCuts;
          delete (submitData as any)._onlyNewResponsibles;

          // Attach forecast reschedule reason if forecastDate changed
          if (showForecastReason && forecastReason && 'forecastDate' in submitData) {
            (submitData as any).forecastReason = forecastReason;
          }

          // DEBUG: Log submitData right before API call
          console.log('[TaskEditForm] JSON path - submitData before API call:', JSON.stringify(submitData, (_key, value) => {
            if (value instanceof Date) return `Date(${value.toISOString()})`;
            return value;
          }, 2));
          console.log('[TaskEditForm] JSON path - submitData keys:', Object.keys(submitData));
          console.log('[TaskEditForm] JSON path - submitData.forecastDate:', submitData.forecastDate, 'isNull:', submitData.forecastDate === null);

          result = await updateAsync({
            id: task.id,
            data: submitData,
            query: {
              include: {
                artworks: true,
                baseFiles: true,
                projectFiles: true,
                checkinFiles: true,
                checkoutFiles: true,
                serviceOrders: {
                  include: {
                    checkinFiles: true,
                    checkoutFiles: true,
                  },
                },
              },
            },
          });
        }

        if (result.success) {

          // CRITICAL: Clear flags BEFORE clearing modifiedLayoutSides
          // This order matters because the sync effect depends on these flags
          setHasLayoutChanges(false);
          setHasFileChanges(false);

          // CRITICAL: Clear modified sides AFTER the state flags
          // The sync effect at line 229 checks modifiedLayoutSides.size === 0 && !hasLayoutChanges
          // We need both conditions to be true for the sync to happen
          setModifiedLayoutSides(new Set());

          // CRITICAL FIX: Clear deletion tracking refs after successful submission
          // The deletions have been processed by the backend, so we need to reset the tracking
          // This allows users to add new items with previously deleted descriptions
          console.log('[TaskEditForm] Clearing deletion tracking refs after successful save');
          deletedServiceOrderDescriptionsRef.current.clear();

          // Create cuts separately via POST /cuts with FormData

          const cuts = form.getValues('cuts') as any[] || [];

          if (cuts.length > 0) {
            const cutCreationPromises = cuts.map(async (cut, index) => {

              // Only create cuts with new files
              if (!cut.file || !(cut.file instanceof File)) {
                
                return { success: false, skipped: true, index };
              }

              try {

                // Create FormData with cut metadata + file
                const formData = new FormData();
                formData.append('type', cut.type);
                formData.append('origin', CUT_ORIGIN.PLAN);
                formData.append('taskId', task.id);
                formData.append('quantity', String(cut.quantity || 1));
                formData.append('file', cut.file);

                // Add context for file organization
                const context = {
                  entityType: 'cut',
                  entityId: task.id,
                  customerName: task.customer?.corporateName || task.customer?.fantasyName || 'Sem-Nome',
                  cutType: cut.type, // Send the actual enum value: 'VINYL' or 'STENCIL'
                };
                formData.append('_context', JSON.stringify(context));

                // Log FormData contents
                
                for (const [_key, _value] of (formData as any).entries()) {

                }

                // Call the cut service directly, bypassing the mutation hooks
                // The hooks wrap FormData in a way that loses the actual data
                const result = await cutService.createCut(formData as any);

                const createdCount = cut.quantity || 1;
                
                return { success: true, index, result, createdCount };
              } catch (error: any) {
                const failedCount = cut.quantity || 1;
                return { success: false, index, error: error?.message, failedCount };
              }
            });

            await Promise.all(cutCreationPromises);
            // const _totalCreated = results
            //   .filter(r => r.success)
            //   .reduce((sum, r) => sum + (r.createdCount || 1), 0);
            // const _totalFailed = results
            //   .filter(r => !r.success && !r.skipped)
            //   .reduce((sum, r) => sum + (r.failedCount || 1), 0);

          }

          // Layout photos are uploaded WITH the task update (not separately like cuts)
          // The backend handles them in the transaction at lines 683-728 of task.service.ts

          console.log('[Task Update] ✅ SUCCESS - Update completed, response:', result);
          console.log('[Task Update] Artworks in response:', result?.data?.artworks);

          // Reset artwork changes flags after successful submission
          if (hasArtworkStatusChanges || hasArtworkFileChanges) {
            console.log('[Task Update] 🔄 Resetting artwork flags after successful submission');
            setHasArtworkStatusChanges(false);
            setHasArtworkFileChanges(false);
          }

          // Reset base file changes flag after successful submission
          if (hasBaseFileChanges) {
            setHasBaseFileChanges(false);
          }
          if (hasProjectFileChanges) {
            setHasProjectFileChanges(false);
          }
          if (hasCheckinFileChanges) {
            setHasCheckinFileChanges(false);
          }
          if (hasCheckoutFileChanges) {
            setHasCheckoutFileChanges(false);
          }

          await new Promise(resolve => setTimeout(resolve, 100));
          // Redirect to task details after successful update
          const redirectUrl = detailsRoute ? detailsRoute(task.id) : `/producao/cronograma/detalhes/${task.id}`;
          navigate(redirectUrl, { state: navigationState, replace: true });
        }
      } catch (error) {
        console.error('[TaskEditForm] ❌ Error during form submission:', error);
        // API client already shows error toast, no need to show another one
      } finally {
        setIsSubmitting(false);
        setShowForecastReason(false);
        setForecastReason("");
        // CRITICAL FIX: Reset submission flag to allow sync to resume after submission completes
        // Use setTimeout to ensure this happens after all React state updates settle
        setTimeout(() => {
          isSubmittingRef.current = false;
          console.log('[TaskEditForm] Submission complete, sync re-enabled');
        }, 100);
      }
    },
    [updateAsync, task.id, hasLayoutChanges, hasFileChanges, hasArtworkStatusChanges, hasBaseFileChanges, hasProjectFileChanges, hasCheckinFileChanges, hasCheckoutFileChanges, uploadedFiles, baseFiles, projectFiles, observationFiles, layoutWidthError, modifiedLayoutSides, currentLayoutStates]
  );

  // Use the edit form hook with change detection
  const { handleSubmitChanges, getChangedFields, ...form } = useEditForm<TaskUpdateFormData, any, Task>({
    resolver: zodResolver(taskUpdateSchema),
    originalData: task,
    onSubmit: handleFormSubmit,
    mapDataToForm,
    formOptions: {
      mode: "onChange",
      reValidateMode: "onChange",
      criteriaMode: "all",
    },
    // Don't send these large arrays if they haven't changed (reduces payload size)
    // This must match the excludedFields Set in handleFormSubmit for consistency
    // NOTE: 'cuts' are omitted - created separately via POST /cuts
    // NOTE: 'airbrushings', 'quote', 'serviceOrders' are NOT omitted - they need filtering logic
    fieldsToOmitIfUnchanged: [
      "cuts",
      "paintIds",
      "artworkIds",
      "baseFileIds",
      "reimbursementIds",
      "reimbursementInvoiceIds",
    ],
  });

  // Helper to update file in list
  // const _updateFileInList = (files: FileWithPreview[], fileId: string, updates: Partial<FileWithPreview>) => {
  //   return files.map((f) => {
  //     if (f.id === fileId) {
  //       // Use Object.assign to preserve the File object prototype and properties
  //       // This keeps all native File properties (size, name, type, lastModified, etc.)
  //       return Object.assign(f, updates);
  //     }
  //     return f;
  //   });
  // };

  // Handle artwork files change (no longer uploads immediately)
  const handleFilesChange = (files: FileWithPreview[]) => {
    // Get IDs of files that are being kept
    const keptFileIds = new Set(files.map(f => f.uploadedFileId || f.id).filter(Boolean));

    // Clean up artworkStatuses to remove entries for files that were removed
    setArtworkStatuses(prev => {
      const cleaned = { ...prev };
      for (const fileId of Object.keys(cleaned)) {
        if (!keptFileIds.has(fileId)) {
          console.log('[Task Update] 🗑️ Removing artworkStatus for deleted file:', fileId);
          delete cleaned[fileId];
        }
      }
      return cleaned;
    });

    setUploadedFiles(files);
    setHasFileChanges(true);
    // Mark that artwork files have been modified (added or removed)
    // This ensures artworkIds is always sent when artworks change, even if empty
    setHasArtworkFileChanges(true);
    console.log('[Task Update] 📁 Artwork files changed, count:', files.length);
    // Files will be submitted with the form, not uploaded separately
  };

  // Handle base files change (no longer uploads immediately)
  const handleBaseFilesChange = (files: FileWithPreview[]) => {
    setBaseFiles(files);
    setHasFileChanges(true);
    setHasBaseFileChanges(true);
    // Files will be submitted with the form, not uploaded separately
  };

  // Handle project files change
  const handleProjectFilesChange = (files: FileWithPreview[]) => {
    setProjectFiles(files);
    setHasFileChanges(true);
    setHasProjectFileChanges(true);
  };

  // Pre-upload new files and return updated file list with uploaded IDs
  const preUploadNewFiles = useCallback(async (
    allFiles: FileWithPreview[],
    fileContext: string,
  ): Promise<FileWithPreview[]> => {
    const newFiles = allFiles.filter(f => !f.uploaded && !f.error && f instanceof File);
    if (newFiles.length === 0) return allFiles;

    try {
      const result = await uploadFiles(newFiles, {
        fileContext,
        entityId: task.id,
        entityType: 'TASK',
      });

      if (result?.data) {
        // BatchFileUploadResponse.data has { success: File[], failed: [...] }
        const uploadedRecords = result.data.success || (Array.isArray(result.data) ? result.data : [result.data]);
        // Map uploaded records back to files by matching order
        let uploadIdx = 0;
        return allFiles.map(f => {
          if (!f.uploaded && !f.error && f instanceof File && uploadIdx < uploadedRecords.length) {
            const record = uploadedRecords[uploadIdx++];
            return Object.assign(f, {
              uploaded: true,
              uploadProgress: 100,
              uploadedFileId: record.id,
              thumbnailUrl: record.thumbnailUrl,
            });
          }
          return f;
        });
      }
    } catch (err) {
      console.error('[TaskEditForm] Pre-upload failed:', err);
      toast.error('Erro ao enviar arquivo. Tente novamente.');
    }
    return allFiles;
  }, [task.id]);

  // Handle checkin files change per service order (with pre-upload)
  const handleCheckinFilesChange = useCallback(async (serviceOrderId: string, files: FileWithPreview[]) => {
    // Immediately update state (optimistic)
    setCheckinFilesByServiceOrder(prev => ({ ...prev, [serviceOrderId]: files }));
    setHasFileChanges(true);
    setHasCheckinFileChanges(true);

    // Pre-upload new files (track pending count)
    pendingCheckinUploadsRef.current++;
    try {
      const uploaded = await preUploadNewFiles(files, 'serviceOrderCheckinFiles');
      if (uploaded !== files) {
        setCheckinFilesByServiceOrder(prev => ({ ...prev, [serviceOrderId]: uploaded }));
      }
    } finally {
      pendingCheckinUploadsRef.current--;
    }
  }, [preUploadNewFiles]);

  // Handle checkout files change per service order (with pre-upload)
  const handleCheckoutFilesChange = useCallback(async (serviceOrderId: string, files: FileWithPreview[]) => {
    // Immediately update state (optimistic)
    setCheckoutFilesByServiceOrder(prev => ({ ...prev, [serviceOrderId]: files }));
    setHasFileChanges(true);
    setHasCheckoutFileChanges(true);

    // Pre-upload new files (track pending count)
    pendingCheckoutUploadsRef.current++;
    try {
      const uploaded = await preUploadNewFiles(files, 'serviceOrderCheckoutFiles');
      if (uploaded !== files) {
        setCheckoutFilesByServiceOrder(prev => ({ ...prev, [serviceOrderId]: uploaded }));
      }
    } finally {
      pendingCheckoutUploadsRef.current--;
    }
  }, [preUploadNewFiles]);

  // Handle observation files change
  const handleObservationFilesChange = (files: FileWithPreview[]) => {

    setObservationFiles(files);
    setHasFileChanges(true);
    // Update form value with file IDs
    const fileIds = files.map((f) => f.uploadedFileId || f.id).filter(Boolean) as string[];

    const currentObservation = form.getValues("observation");

    form.setValue("observation", {
      description: currentObservation?.description || "",
      fileIds: fileIds,
    }, { shouldDirty: true, shouldTouch: true, shouldValidate: false });
    
    // Note: Form validation happens automatically via useWatch, no need to manually trigger
  };

  // const _handleCancel = useCallback(() => {
  //   const redirectUrl = detailsRoute ? detailsRoute(task.id) : `/producao/cronograma/detalhes/${task.id}`;
  //   window.location.href = redirectUrl;
  // }, [task.id, detailsRoute]);

  // Handle adding a service order from the Designar dialog in GeneralPaintingSelector
  const handleDesignarServiceOrder = useCallback((serviceOrder: ServiceOrderData) => {
    const currentServiceOrders = form.getValues("serviceOrders") || [];
    // Prepend the new service order to the beginning of the array so it appears at the top
    form.setValue("serviceOrders", [{ ...serviceOrder, shouldSync: true }, ...currentServiceOrders], {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
  }, [form]);

  // Watch all form values to trigger re-renders on any change
  // This is CRITICAL - without this, getChangedFields() won't be recalculated
  const formValues = form.watch();

  // Watch specific fields with useWatch for better reactivity
  const cutsValues = useWatch({
    control: form.control,
    name: 'cuts',
  });

  const servicesValues = useWatch({
    control: form.control,
    name: 'serviceOrders',
  });

  const observationValue = useWatch({
    control: form.control,
    name: 'observation',
  });

  // Watch date fields to trigger re-renders when they change
  const entryDateValue = useWatch({
    control: form.control,
    name: 'entryDate',
  });

  const termValue = useWatch({
    control: form.control,
    name: 'term',
  });

  const startedAtValue = useWatch({
    control: form.control,
    name: 'startedAt',
  });

  const finishedAtValue = useWatch({
    control: form.control,
    name: 'finishedAt',
  });

  const forecastDateValue = useWatch({
    control: form.control,
    name: 'forecastDate',
  });

  const customerIdValue = useWatch({
    control: form.control,
    name: 'customerId',
  });

  // Responsibles are now managed by the ResponsibleManager component

  // NOTE: Bidirectional sync between quote items and service orders has been
  // moved to the separate task quote page (/production/schedule/task-quote/[taskId]).

  // Refs used by the submission handler
  const isSubmittingRef = useRef<boolean>(false);
  const deletedServiceOrderDescriptionsRef = useRef<Set<string>>(new Set());

  // End of sync removal placeholder

  // SYNC BLOCK REMOVED - see task-quote page



  // Get form state
  const { formState: _formState } = form;

  // Refs to track previous state for onFormStateChange callback
  // Declared here but useEffect is below after all validation variables are defined
  const prevIsDirtyRef = useRef<boolean>(false);
  const prevIsValidRef = useRef<boolean>(false);

  // Check if there are changes (form fields, layout, files, or cuts to create)
  // This will be recalculated on every form value change thanks to form.watch() above
  const formFieldChanges = getChangedFields();

  // Check if there are new cuts with files to create
  // Only count cuts with NEW files (not already uploaded)
  const hasCutsToCreate = useMemo(() => {
    const cuts = cutsValues as any[] || [];
    return cuts.length > 0 && cuts.some((cut) => {
      if (!cut.file) return false;
      // Check if it's a new file (File instance without uploaded flag)
      const isNewFile = cut.file instanceof File && !cut.file.uploaded && !cut.file.uploadedFileId;
      return isNewFile;
    });
  }, [cutsValues]);

  // Check if there are new responsibles to be created
  const hasNewResponsibles = useMemo(() => {
    const result = responsibleRows.some(row =>
      row.isNew && row.name && row.name.trim() && row.phone && row.phone.trim()
    );
    console.log('[TaskEditForm] hasNewResponsibles calculation:', {
      result,
      responsibleRows,
      rowsDetail: responsibleRows.map(r => ({
        id: r.id,
        name: r.name,
        phone: r.phone,
        isNew: r.isNew,
        hasName: !!r.name?.trim(),
        hasPhone: !!r.phone?.trim(),
        qualifies: r.isNew && !!r.name?.trim() && !!r.phone?.trim()
      }))
    });
    return result;
  }, [responsibleRows]);

  // Compute hasChanges including cuts to create, artwork status changes, and new responsibles
  const hasChanges = Object.keys(formFieldChanges).length > 0 || hasLayoutChanges || hasFileChanges || hasArtworkStatusChanges || hasCutsToCreate || hasNewResponsibles;

  console.log('[TaskEditForm] hasChanges calculation:', {
    hasChanges,
    formFieldChangesCount: Object.keys(formFieldChanges).length,
    formFieldChanges: Object.keys(formFieldChanges),
    hasLayoutChanges,
    hasFileChanges,
    hasArtworkStatusChanges,
    hasCutsToCreate,
    hasNewResponsibles
  });


  // Check for validation errors that should prevent submission
  // Cuts without files will be filtered out on submit, not blocked
  // Only block if user explicitly modified a cut but forgot to add a file
  const hasCutsWithoutFiles = useMemo(() => {
    const cuts = cutsValues as any[] || [];
    if (cuts.length === 0) return false;

    // Filter to only cuts that have been meaningfully modified
    // A cut is meaningful if it has a file OR if it was modified from defaults
    const meaningfulCuts = cuts.filter((cut) => {
      // Has file - it's meaningful
      if (cut.file || cut.fileId) return true;

      // Check if it's the default unmodified cut
      const isDefaultCut =
        cut.type === CUT_TYPE.VINYL &&
        cut.quantity === 1 &&
        !cut.file &&
        !cut.fileId;

      // Only meaningful if NOT default (user changed something)
      return !isDefaultCut;
    });

    // Block only if there are meaningful cuts without files
    // (user changed settings but forgot the file)
    return meaningfulCuts.some((cut) => !cut.file && !cut.fileId);
  }, [cutsValues]);

  const hasIncompleteServices = useMemo(() => {
    const services = servicesValues as any[] || [];

    if (services.length === 0) return false;

    // Only validate services if they're being changed (in formFieldChanges)
    const areServicesBeingChanged = 'serviceOrders' in formFieldChanges;
    if (!areServicesBeingChanged) return false;

    // Check if any service is incomplete
    // A service is incomplete if it has no description or description is too short
    // Assignment (assignedToId) is optional, so we don't check it
    const hasIncompleteItems = services.some((service: any) => {
      // Skip empty services (they will be filtered out on submit)
      if (!service.description || service.description.trim() === "") return false;

      // If service has a description, it must be at least 3 characters
      const hasValidDescription = service.description.trim().length >= 3;
      return !hasValidDescription;
    });

    return hasIncompleteItems;
  }, [servicesValues, formFieldChanges]);

  const hasIncompleteObservation = useMemo(() => {
    // Only validate if observation has been started (has some data)
    const observation = observationValue;
    const hasObservationData = observation?.description || observationFiles.length > 0;

    if (!hasObservationData) return false;

    const hasDescription = observation?.description && observation.description.trim() !== "";
    const hasFiles = (observation?.fileIds && observation.fileIds.length > 0) || observationFiles.length > 0;

    // Observation is incomplete if data exists but missing description OR files
    return !hasDescription || !hasFiles;
  }, [observationValue, observationFiles]);

  // Notify parent of form state changes
  // MUST come AFTER all validation variables are defined to avoid reference errors
  useEffect(() => {
    if (onFormStateChange) {
      const changedFields = getChangedFields();
      const isDirty = Object.keys(changedFields).length > 0 || hasLayoutChanges || hasFileChanges || hasArtworkStatusChanges || hasCutsToCreate || hasNewResponsibles;

      // Check if form is valid (no blocking validation errors)
      // This matches the form's internal validation but WITHOUT the hasChanges check
      // (isDirty will handle whether there are changes)
      const isValid = !isSubmitting && !hasCutsWithoutFiles && !hasIncompleteServices && !hasIncompleteObservation && !layoutWidthError;

      // Only notify parent if isDirty OR isValid changed to avoid infinite loops
      if (prevIsDirtyRef.current !== isDirty || prevIsValidRef.current !== isValid) {
        prevIsDirtyRef.current = isDirty;
        prevIsValidRef.current = isValid;

        onFormStateChange({
          isValid,
          isDirty,
          isSubmitting,
        });
      }
    }
  }, [
    form.formState.isValid,
    hasLayoutChanges,
    hasFileChanges,
    hasArtworkStatusChanges,
    hasCutsToCreate,
    hasNewResponsibles,
    isSubmitting,
    hasCutsWithoutFiles,
    hasIncompleteServices,
    hasIncompleteObservation,
    layoutWidthError,
    onFormStateChange,
    formValues, // CRITICAL: Ensures useEffect runs when ANY form field changes
    // Date fields are still included for clarity, but formValues covers them too
    entryDateValue,
    termValue,
    startedAtValue,
    finishedAtValue,
    forecastDateValue,
    // DO NOT add getChangedFields to dependencies - it would cause infinite loop
  ]);

  // Navigation actions - wrapped in useMemo to ensure re-renders when dependencies change
  // const _navigationActions = useMemo(() => {
  //   const isSubmitDisabled = isSubmitting || !hasChanges || hasCutsWithoutFiles || hasIncompletePricing || hasIncompleteServices || hasIncompleteObservation || !!layoutWidthError;

  //   console.log('[TaskEditForm] Submit button disabled state:', {
  //     isSubmitDisabled,
  //     isSubmitting,
  //     hasChanges,
  //     hasNewResponsibles,
  //     formFieldChangesCount: Object.keys(formFieldChanges).length,
  //     hasCutsWithoutFiles,
  //   //     hasIncompleteServices,
  //     hasIncompleteObservation,
  //     hasLayoutError: !!layoutWidthError
  //   });


  //   return [
  //     {
  //       key: "cancel",
  //       label: "Cancelar",
  //       onClick: handleCancel,
  //       variant: "outline" as const,
  //       icon: IconArrowLeft,
  //       disabled: isSubmitting,
  //     },
  //     {
  //       key: "submit",
  //       label: "Salvar Alterações",
  //       icon: isSubmitting ? IconLoader2 : IconCheck,
  //       onClick: handleSubmitChanges(),
  //       variant: "default" as const,
  //       disabled: isSubmitDisabled,
  //       loading: isSubmitting,
  //     },
  //   ];
  // }, [isSubmitting, hasChanges, hasCutsWithoutFiles, hasIncompletePricing, hasIncompleteServices, hasIncompleteObservation, layoutWidthError, handleCancel, handleSubmitChanges, hasNewResponsibles]);

  return (
    <Form {...(form as any)}>
      <form
        id="task-form"
        className="container mx-auto max-w-5xl"
        onSubmit={(e) => {
          console.log('[TaskEditForm] Form onSubmit triggered');
          console.log('[TaskEditForm] Form isValid:', form.formState.isValid);
          console.log('[TaskEditForm] Form errors:', form.formState.errors);
          return handleSubmitChanges(undefined, (errors) => {
            console.log('[TaskEditForm] Validation errors:', errors);
            openSectionWithError(errors);
            toast.error("Existem erros no formulário. Verifique os campos destacados.");
          })(e);
        }}
      >
        {/* Hidden submit button for programmatic form submission */}
        <button
          id="task-form-submit"
          type="submit"
          className="hidden"
          disabled={isSubmitting}
          onClick={() => console.log('[TaskEditForm] Hidden submit button clicked')}
        >
          Submit
        </button>

        <div className={openAccordion === 'base-files' || openAccordion === 'artworks' || openAccordion === 'project-files' || openAccordion === 'checkin-files' || openAccordion === 'checkout-files' ? 'pb-64' : ''}>
          <Accordion
            type="single"
            collapsible
            value={openAccordion}
            onValueChange={setOpenAccordion}
            className="space-y-4"
          >
          {/* Basic Information Card */}
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
                    {/* Name and Customer */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Task Name */}
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2">
                              <IconFileText className="h-4 w-4" />
                              Logomarca
                            </FormLabel>
                            <FormControl>
                              <Input
                                value={field.value || ""}
                                onChange={(value: string | number | null) => {
                                  const rawValue = typeof value === "string" ? value : (value as any)?.target?.value || "";
                                  field.onChange(rawValue);
                                }}
                                name={field.name}
                                onBlur={() => {
                                  // Apply title case formatting when user finishes typing
                                  if (field.value) {
                                    field.onChange(toTitleCase(field.value));
                                  }
                                  field.onBlur();
                                }}
                                ref={field.ref}
                                placeholder="Ex: Pintura completa do caminhão"
                                disabled={isSubmitting || !canEditIdentity}
                                className="bg-transparent"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Customer */}
                      <CustomerSelector control={form.control} disabled={isSubmitting || !canEditIdentity} initialCustomer={task.customer} />
                    </div>

                    {/* Truck Category and Implement Type - Side by Side */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Truck Category */}
                      <FormField
                        control={form.control}
                        name="truck.category"
                        render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <FormLabel>Categoria do Caminhão</FormLabel>
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
                              disabled={isSubmitting || !canEditIdentity}
                            />
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Truck Implement Type */}
                      <FormField
                        control={form.control}
                        name="truck.implementType"
                        render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <FormLabel>Tipo de Implemento</FormLabel>
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
                              disabled={isSubmitting || !canEditIdentity}
                            />
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Serial Number, Plate, Chassis - in same row with 1/4, 1/4, 2/4 ratio */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      {/* Serial Number - 1/4 */}
                      <FormField
                        control={form.control}
                        name="serialNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2">
                              <IconHash className="h-4 w-4" />
                              Número de Série
                            </FormLabel>
                            <FormControl>
                              <Input
                                ref={field.ref}
                                value={field.value || ""}
                                placeholder="Ex: ABC-123456"
                                className="uppercase bg-transparent"
                                onChange={(value: string | number | null) => field.onChange(typeof value === "string" ? value.toUpperCase() : "")}
                                onBlur={field.onBlur}
                                disabled={isSubmitting || !canEditIdentity}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Plate - 1/4 */}
                      <FormField
                        control={form.control}
                        name="truck.plate"
                        render={({ field }) => {
                          // Format Brazilian license plate for display
                          // Old format: ABC-1234 (3 letters + hyphen + 4 numbers)
                          // Mercosul format: ABC-1D23 (3 letters + hyphen + 1 number + 1 letter + 2 numbers)
                          const formatPlate = (value: string) => {
                            const clean = value.replace(/[^A-Z0-9]/gi, "").toUpperCase();
                            if (clean.length <= 3) {
                              return clean;
                            }

                            // Check if it's Mercosul format (5th character is a letter)
                            const fifthChar = clean.charAt(4);
                            const isMercosul = fifthChar && /[A-Z]/i.test(fifthChar);

                            if (isMercosul) {
                              // Mercosul format: ABC-1D23
                              return clean.slice(0, 3) + '-' + clean.slice(3, 7);
                            } else {
                              // Old format: ABC-1234
                              return clean.slice(0, 3) + '-' + clean.slice(3, 7);
                            }
                          };

                          return (
                            <FormItem>
                              <FormLabel className="flex items-center gap-2">
                                <IconLicense className="h-4 w-4" />
                                Placa
                              </FormLabel>
                              <FormControl>
                                <Input
                                  value={formatPlate(field.value || "")}
                                  placeholder="Ex: ABC-1234 ou ABC-1D23"
                                  className="uppercase bg-transparent"
                                  maxLength={8}
                                  onChange={(value: string | number | null) => {
                                    // Remove all non-alphanumeric characters, convert to uppercase
                                    const cleanValue = String(value || "").replace(/[^A-Z0-9]/gi, "").toUpperCase();
                                    // Limit to 7 characters (3 letters + 4 chars)
                                    const limitedValue = cleanValue.slice(0, 7);
                                    field.onChange(limitedValue);
                                  }}
                                  disabled={isSubmitting || !canEditIdentity}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          );
                        }}
                      />

                      {/* Chassis - 2/4 (col-span-2) */}
                      <FormField
                        control={form.control}
                        name="truck.chassisNumber"
                        render={({ field }) => {
                          // Format chassis for display: XXX XXXXX XX XXXXXX
                          const formatChassis = (value: string) => {
                            const clean = value.replace(/\s/g, "");
                            if (clean.length > 10) {
                              return clean.slice(0, 3) + ' ' + clean.slice(3, 8) + ' ' + clean.slice(8, 10) + ' ' + clean.slice(10, 17);
                            } else if (clean.length > 8) {
                              return clean.slice(0, 3) + ' ' + clean.slice(3, 8) + ' ' + clean.slice(8, 10);
                            } else if (clean.length > 3) {
                              return clean.slice(0, 3) + ' ' + clean.slice(3, 8);
                            }
                            return clean.slice(0, 3);
                          };

                          return (
                            <FormItem className="md:col-span-2">
                              <FormLabel className="flex items-center gap-2">
                                <IconId className="h-4 w-4" />
                                Chassi
                              </FormLabel>
                              <FormControl>
                                <Input
                                  value={formatChassis(field.value || "")}
                                  placeholder="Ex: 9BW ZZZ37 7V T004251"
                                  className="bg-transparent uppercase"
                                  maxLength={20}
                                  onChange={(value: string | number | null) => {
                                    // Remove all non-alphanumeric characters and spaces, convert to uppercase
                                    const cleanValue = String(value || "").replace(/[^A-Z0-9]/gi, "").toUpperCase();
                                    // Limit to exactly 17 characters (VIN standard)
                                    const limitedValue = cleanValue.slice(0, 17);
                                    field.onChange(limitedValue);
                                  }}
                                  disabled={isSubmitting || !canEditIdentity}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          );
                        }}
                      />
                    </div>

                    {/* Sector, Status and Commission in a row */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Sector */}
                      <SectorSelector control={form.control} disabled={isSubmitting || !canEditSector} productionOnly />

                      {/* Status Field (edit-specific) */}
                      <FormField
                        control={form.control}
                        name="status"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2">
                              <IconStatusChange className="h-4 w-4" />
                              Status
                            </FormLabel>
                            <FormControl>
                              <Combobox
                                value={field.value}
                                onValueChange={field.onChange}
                                disabled={isSubmitting || !canEditSector}
                                options={[
                                  TASK_STATUS.PREPARATION,
                                  TASK_STATUS.WAITING_PRODUCTION,
                                  TASK_STATUS.IN_PRODUCTION,
                                  TASK_STATUS.COMPLETED,
                                  TASK_STATUS.CANCELLED,
                                ].map((status) => ({
                                  value: status,
                                  label: TASK_STATUS_LABELS[status],
                                }))}
                                placeholder="Selecione o status"
                                searchable={false}
                                clearable={false}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Commission Status (only visible to ADMIN, FINANCIAL, COMMERCIAL, PRODUCTION) */}
                      {canViewCommissionField && (
                      <FormField
                        control={form.control}
                        name={"commission" as any}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2">
                              <IconCurrencyReal className="h-4 w-4" />
                              Status de Comissão
                            </FormLabel>
                            <FormControl>
                              <Combobox
                                value={field.value || ""}
                                onValueChange={(value) => field.onChange(value || null)}
                                disabled={isSubmitting || !canEditCommission}
                                options={[
                                  { value: "", label: "Não definido" },
                                  ...Object.values(COMMISSION_STATUS).map((status) => ({
                                    value: status,
                                    label: COMMISSION_STATUS_LABELS[status] || status,
                                  })),
                                ]}
                                placeholder="Selecione o status de comissão"
                                searchable={false}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      )}

                    </div>

                    {/* Details */}
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
                            <Textarea {...field} value={field.value || ""} placeholder="Detalhes adicionais sobre a tarefa..." rows={4} disabled={isSubmitting || !canEditIdentity} className="bg-transparent" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    </CardContent>
                  </AccordionContent>
                </Card>
          </AccordionItem>

          {/* Responsibles Section - Visible to ADMIN, FINANCIAL, COMMERCIAL, LOGISTIC, DESIGNER (edit for ADMIN/COMMERCIAL only, view only for others) */}
          {canViewRestrictedFields && (
            <AccordionItem
              value="responsibles"
              id="accordion-item-responsibles"
              className="border border-border rounded-lg"
            >
              <Card className="border-0">
                <AccordionTrigger className="px-0 hover:no-underline">
                  <CardHeader className="flex-1 py-4">
                    <CardTitle className="flex items-center gap-2">
                      <IconUser className="h-5 w-5" />
                      Responsáveis
                    </CardTitle>
                  </CardHeader>
                </AccordionTrigger>
                <AccordionContent>
                  <CardContent className="pt-0">
                    <ResponsibleManager
                      companyId={customerIdValue || undefined}
                      value={isDesignerUser
                        ? (() => {
                            const marketing = responsibleRows.filter(r => r.role === ResponsibleRole.MARKETING);
                            return marketing.length > 0 ? marketing : responsibleRows.filter(r => r.role === ResponsibleRole.COMMERCIAL);
                          })()
                        : responsibleRows}
                      onChange={handleResponsibleRowsChange}
                      disabled={isSubmitting || !canEditResponsibles}
                      readOnly={!canEditResponsibles}
                      minRows={0}
                      maxRows={10}
                      control={form.control}
                      showErrors={showResponsibleErrors}
                    />
                  </CardContent>
                </AccordionContent>
              </Card>
            </AccordionItem>
          )}

                {/* Dates Card - Hidden for Warehouse users, Disabled for Financial and Designer users */}
                {canViewDates && (
          <AccordionItem
            value="dates"
            id="accordion-item-dates"
            className="border border-border rounded-lg"
          >
                <Card className="border-0">
                  <AccordionTrigger className="px-0 hover:no-underline">
                    <CardHeader className="flex-1 py-4">
                      <CardTitle className="flex items-center gap-2">
                        <IconCalendar className="h-5 w-5" />
                        Datas
                      </CardTitle>
                    </CardHeader>
                  </AccordionTrigger>
                  <AccordionContent>
                    <CardContent className="space-y-4 pt-0">
                    {/* First Row: Forecast Date (only visible to ADMIN, FINANCIAL, COMMERCIAL, LOGISTIC, DESIGNER) */}
                    {canViewRestrictedFields && (
                    <div className="space-y-3">
                      <FormField
                        control={form.control}
                        name="forecastDate"
                        render={({ field }) => (
                          <DateTimeInput
                            {...{
                              field: {
                                onChange: (value: Date | null) => {
                                  field.onChange(value);
                                  // Show reason input when forecastDate changes on a task that already had one
                                  const hadForecast = !!task.forecastDate;
                                  const dateChanged = hadForecast && value && new Date(task.forecastDate!).getTime() !== value.getTime();
                                  setShowForecastReason(!!dateChanged);
                                },
                                onBlur: () => field.onBlur(),
                                value: field.value ?? null,
                                name: field.name,
                              },
                              mode: "datetime",
                              context: "start",
                              label: "Previsao de Liberacao",
                              disabled: isSubmitting || !canEditDates,
                              allowManualInput: true,
                            } as any}
                          />
                        )}
                      />
                      {showForecastReason && (
                        <div className="space-y-1.5">
                          <Label className="text-sm">Motivo do Reagendamento</Label>
                          <Input
                            placeholder="Ex: Solicitacao do cliente, falta de material..."
                            value={forecastReason}
                            onChange={(value) => setForecastReason(String(value ?? ""))}
                          />
                        </div>
                      )}
                    </div>
                    )}

                    {/* Second Row: Entry Date and Deadline */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Entry Date - Date only - DISABLED for Financial and Designer users */}
                      <FormField
                        control={form.control}
                        name="entryDate"
                        render={({ field }) => <DateTimeInput {...{ field: { onChange: (value: Date | null) => field.onChange(value), onBlur: () => field.onBlur(), value: field.value ?? null, name: field.name }, mode: "date", context: "start", label: "Data de Entrada", disabled: isSubmitting || !canEditDates, allowManualInput: true } as any} />}
                      />

                      {/* Deadline - DateTime - DISABLED for Financial and Designer users */}
                      <FormField
                        control={form.control}
                        name="term"
                        render={({ field }) => (
                          <DateTimeInput {...{ field: { onChange: (value: Date | null) => field.onChange(value), onBlur: () => field.onBlur(), value: field.value ?? null, name: field.name }, mode: "datetime", context: "due", label: "Prazo de Entrega", disabled: isSubmitting || !canEditDates, allowManualInput: true } as any} />
                        )}
                      />
                    </div>

                    {/* Third Row: Started At and Finished At */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Started At - DateTime - DISABLED for Financial and Designer users */}
                      <FormField
                        control={form.control}
                        name="startedAt"
                        render={({ field }) => (
                          <DateTimeInput
                            {...{
                              field: { onChange: (value: Date | null) => field.onChange(value), onBlur: () => field.onBlur(), value: field.value ?? null, name: field.name },
                              mode: "datetime",
                              context: "start",
                              label: "Data de Início",
                              disabled: isSubmitting || !canEditDates,
                              constraints: {
                                maxDate: new Date(), // Cannot start in the future
                              },
                              allowManualInput: true,
                            } as any}
                          />
                        )}
                      />

                      {/* Finished At - DateTime - DISABLED for Financial and Designer users */}
                      <FormField
                        control={form.control}
                        name="finishedAt"
                        render={({ field }) => (
                          <DateTimeInput
                            {...{
                              field: { onChange: (value: Date | null) => field.onChange(value), onBlur: () => field.onBlur(), value: field.value ?? null, name: field.name },
                              mode: "datetime",
                              context: "end",
                              label: "Data de Conclusão",
                              disabled: isSubmitting || !canEditDates,
                              constraints: {
                                maxDate: new Date(), // Cannot finish in the future
                                minDate: form.watch("startedAt") || new Date("1900-01-01"), // Cannot finish before started
                              },
                              allowManualInput: true,
                            } as any}
                          />
                        )}
                      />
                    </div>
                    </CardContent>
                  </AccordionContent>
                </Card>
          </AccordionItem>
                )}

                {/* Services Card - Visible for Admin, Financial, Designer, Commercial, and Logistic users */}
                {canViewServices && (
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
                            disabled={isSubmitting || !canEditServices}
                            currentUserId={user?.id}
                            userPrivilege={privilege}
                            isTeamLeader={isTeamLeader}
                            isAccordionOpen={openAccordion === "serviceOrders"}
                          />
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    </CardContent>
                  </AccordionContent>
                </Card>
          </AccordionItem>
                )}

                {/* Quote is now accessed via context menu - removed from edit form */}

                {/* Medidas do Caminhão - Only visible to ADMIN, LOGISTIC, and PRODUCTION team leaders */}
                {canViewLayout && (
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
                        Medidas do Caminhão
                      </CardTitle>
                    </CardHeader>
                  </AccordionTrigger>
                  <AccordionContent>
                    <CardContent className="pt-0">
                      <div className="space-y-4">
                        {/* Layout Side Selector with Total Length */}
                        <div className="flex justify-between items-center">
                          <div className="flex gap-2">
                            <Button type="button" variant={selectedLayoutSide === "left" ? "default" : "outline"} size="sm" onClick={() => setSelectedLayoutSide("left")}>
                              Motorista
                              {layoutsData?.leftSideLayout && (
                                <Badge variant="success" className="ml-2">
                                  Configurado
                                </Badge>
                              )}
                            </Button>
                            <Button type="button" variant={selectedLayoutSide === "right" ? "default" : "outline"} size="sm" onClick={() => setSelectedLayoutSide("right")}>
                              Sapo
                              {layoutsData?.rightSideLayout && (
                                <Badge variant="success" className="ml-2">
                                  Configurado
                                </Badge>
                              )}
                            </Button>
                            <Button type="button" variant={selectedLayoutSide === "back" ? "default" : "outline"} size="sm" onClick={() => setSelectedLayoutSide("back")}>
                              Traseira
                              {layoutsData?.backSideLayout && (
                                <Badge variant="success" className="ml-2">
                                  Configurado
                                </Badge>
                              )}
                            </Button>
                          </div>

                          {/* Total Length Display */}
                          <div className="px-3 py-1 bg-primary/10 rounded-md">
                            <span className="text-sm text-muted-foreground">Comprimento Total: </span>
                            <span className="text-sm font-semibold text-foreground">
                              {(() => {
                                const currentState = currentLayoutStates[selectedLayoutSide];
                                const savedLayout = selectedLayoutSide === "left"
                                  ? layoutsData?.leftSideLayout
                                  : selectedLayoutSide === "right"
                                    ? layoutsData?.rightSideLayout
                                    : layoutsData?.backSideLayout;

                                const currentLayout = currentState || savedLayout;
                                const sections = currentLayout?.sections || currentLayout?.layoutSections;

                                if (!sections || sections.length === 0) return "0cm";
                                const totalWidthMeters = sections.reduce((sum: number, s: any) => sum + (s.width || 0), 0);
                                const totalWidthCm = Math.round(totalWidthMeters * 100);
                                return totalWidthCm + "cm";
                              })()}
                            </span>
                          </div>
                        </div>

                        {/* Layout Form - Read-only for Financial and Designer users */}
                        <LayoutForm
                          selectedSide={selectedLayoutSide}
                          layout={(() => {
                            const savedLayout = selectedLayoutSide === "left"
                              ? layoutsData?.leftSideLayout
                              : selectedLayoutSide === "right"
                                ? layoutsData?.rightSideLayout
                                : layoutsData?.backSideLayout;

                            if (modifiedLayoutSides.has(selectedLayoutSide) && currentLayoutStates[selectedLayoutSide]) {
                              return currentLayoutStates[selectedLayoutSide];
                            }

                            return savedLayout;
                          })()}
                          validationError={layoutWidthError}
                          onChange={(side, layoutData) => {
                            const savedLayout = side === "left"
                              ? layoutsData?.leftSideLayout
                              : side === "right"
                                ? layoutsData?.rightSideLayout
                                : layoutsData?.backSideLayout;

                            const hasSavedLayout = savedLayout?.layoutSections && savedLayout.layoutSections.length > 0;
                            const isFirstEmitForSide = !initialLayoutStateEmittedRef.current.has(side);

                            if (!hasSavedLayout && isFirstEmitForSide) {
                              initialLayoutStateEmittedRef.current.add(side);
                              setCurrentLayoutStates(prev => ({
                                ...prev,
                                [side]: layoutData,
                              }));
                              return;
                            }

                            initialLayoutStateEmittedRef.current.add(side);

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
                          disabled={isSubmitting || !canEditLayout}
                        />
                      </div>
                    </CardContent>
                  </AccordionContent>
                </Card>
          </AccordionItem>
                )}

                {/* Truck Spot - Only visible to ADMIN and LOGISTIC users */}
                {truckId && canViewTruckSpot && (
          <AccordionItem
            value="spot"
            id="accordion-item-spot"
            className="border border-border rounded-lg"
          >
                  <Card className="border-0">
                    <AccordionTrigger className="px-0 hover:no-underline">
                      <CardHeader className="flex-1 py-4">
                        <CardTitle className="flex items-center gap-2">
                          <IconMapPin className="h-5 w-5" />
                          Local do Caminhão
                        </CardTitle>
                      </CardHeader>
                    </AccordionTrigger>
                    <AccordionContent>
                      <CardContent className="pt-0">
                      <SpotSelector
                        truckLength={truckLength}
                        currentSpot={form.watch("truck.spot") as TRUCK_SPOT | null}
                        truckId={truckId}
                        onSpotChange={(spot) => {
                          form.setValue("truck.spot", spot, { shouldDirty: true });
                        }}
                        disabled={isSubmitting || !canEditServices}
                      />
                      </CardContent>
                    </AccordionContent>
                  </Card>
          </AccordionItem>
                )}

                {/* Paint Selection (Tintas) - Hidden for Warehouse, Financial, and Logistic users, Disabled for Designer */}
                {canViewPaint && (
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
                      disabled={isSubmitting || !canEditPaint}
                      initialPaint={task.generalPainting}
                      onDesignarServiceOrder={handleDesignarServiceOrder}
                      userPrivilege={privilege}
                    />

                    {canViewLogoPaint && (
                      <LogoPaintsSelector
                        control={form.control}
                        disabled={isSubmitting || !canEditPaint}
                        initialPaints={task.logoPaints}
                      />
                    )}
                    </CardContent>
                  </AccordionContent>
                </Card>
          </AccordionItem>
                )}

                {/* Cut Plans Section - Multiple Cuts Support - EDITABLE for Designer, Hidden for Financial, Logistic, and Commercial users */}
                {canViewCuts && (
          <AccordionItem
            value="cuts"
            id="accordion-item-cuts"
            className="border border-border rounded-lg"
          >
                <Card className="border-0">
                  <AccordionTrigger className="px-0 hover:no-underline">
                    <CardHeader className="flex-1 py-4">
                      <CardTitle className="flex items-center gap-2">
                        <IconScissors className="h-5 w-5" />
                        Plano de Corte
                        {cutsCount > 0 && (
                          <Badge variant="secondary" className="ml-2">
                            {cutsCount}
                          </Badge>
                        )}
                      </CardTitle>
                    </CardHeader>
                  </AccordionTrigger>
                  <AccordionContent>
                    <CardContent className="pt-0">
                      <MultiCutSelector ref={multiCutSelectorRef} control={form.control} disabled={isSubmitting} onCutsCountChange={setCutsCount} />
                    </CardContent>
                  </AccordionContent>
                </Card>
          </AccordionItem>
                )}

                {/* Airbrushing Section - Multiple Airbrushings Support - Hidden for Warehouse, Financial, Designer, Logistic, and Commercial users */}
                {canViewAirbrushing && (
          <AccordionItem
            value="airbrushing"
            id="accordion-item-airbrushing"
            className="border border-border rounded-lg"
          >
                <Card className="border-0">
                  <AccordionTrigger className="px-0 hover:no-underline">
                    <CardHeader className="flex-1 py-4">
                      <CardTitle className="flex items-center gap-2">
                        <IconSparkles className="h-5 w-5" />
                        Aerografias
                        {airbrushingsCount > 0 && (
                          <Badge variant="secondary" className="ml-2">
                            {airbrushingsCount}
                          </Badge>
                        )}
                      </CardTitle>
                    </CardHeader>
                  </AccordionTrigger>
                  <AccordionContent>
                    <CardContent className="pt-0">
                      <MultiAirbrushingSelector ref={multiAirbrushingSelectorRef} control={form.control} disabled={isSubmitting} onAirbrushingsCountChange={setAirbrushingsCount} />
                    </CardContent>
                  </AccordionContent>
                </Card>
          </AccordionItem>
                )}

                {/* Base Files Card (optional) - EDITABLE for Designer, Commercial, and Logistic, Hidden for Warehouse and Financial users */}
                {canViewBaseFiles && (
          <AccordionItem
            value="base-files"
            id="accordion-item-base-files"
            className="border border-border rounded-lg"
          >
                <Card className="border-0">
                  <AccordionTrigger className="px-0 hover:no-underline">
                    <CardHeader className="flex-1 py-4">
                      <CardTitle className="flex items-center gap-2">
                        <IconFileText className="h-5 w-5" />
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
                        placeholder="Adicione arquivos base (vídeos, imagens, PDFs)"
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
                      >
                        <FileSuggestions
                          customerId={task.customerId ?? undefined}
                          fileContext="taskBaseFiles"
                          excludeFileIds={baseFiles.map(f => f.uploadedFileId || f.id).filter(Boolean)}
                          onSelect={(newFile) => {
                            const fileWithPreview: FileWithPreview = {
                              id: newFile.id,
                              name: newFile.filename || newFile.originalName || 'file',
                              size: newFile.size || 0,
                              type: newFile.mimetype || 'application/octet-stream',
                              lastModified: Date.now(),
                              uploaded: true,
                              uploadProgress: 100,
                              uploadedFileId: newFile.id,
                              thumbnailUrl: newFile.thumbnailUrl || undefined,
                            } as FileWithPreview;
                            setBaseFiles(prev => [...prev, fileWithPreview]);
                            setHasBaseFileChanges(true);
                            setHasFileChanges(true);
                          }}
                          disabled={isSubmitting}
                        />
                      </FileUploadField>
                    </CardContent>
                  </AccordionContent>
                </Card>
          </AccordionItem>
                )}

                {/* Project Files Card - visible to ALL except Warehouse and Financial users */}
                {canViewProjectFiles && (
          <AccordionItem
            value="project-files"
            id="accordion-item-project-files"
            className="border border-border rounded-lg"
          >
                <Card className="border-0">
                  <AccordionTrigger className="px-0 hover:no-underline">
                    <CardHeader className="flex-1 py-4">
                      <CardTitle className="flex items-center gap-2">
                        <IconFolderOpen className="h-5 w-5" />
                        Projetos
                      </CardTitle>
                    </CardHeader>
                  </AccordionTrigger>
                  <AccordionContent>
                    <CardContent className="pt-0">
                      <FileUploadField
                        onFilesChange={handleProjectFilesChange}
                        maxFiles={30}
                        maxSize={500 * 1024 * 1024}
                        disabled={isSubmitting}
                        showPreview={true}
                        existingFiles={projectFiles}
                        variant="compact"
                        placeholder="Adicione arquivos de projeto (vídeos, imagens, PDFs)"
                        label="Projetos anexados"
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
                      >
                        <FileSuggestions
                          customerId={task.customerId ?? undefined}
                          fileContext="taskProjectFiles"
                          excludeFileIds={projectFiles.map(f => f.uploadedFileId || f.id).filter(Boolean)}
                          onSelect={(newFile) => {
                            const fileWithPreview: FileWithPreview = {
                              id: newFile.id,
                              name: newFile.filename || newFile.originalName || 'project file',
                              size: newFile.size || 0,
                              type: newFile.mimetype || 'application/octet-stream',
                              lastModified: Date.now(),
                              uploaded: true,
                              uploadProgress: 100,
                              uploadedFileId: newFile.id,
                              thumbnailUrl: newFile.thumbnailUrl || undefined,
                            } as FileWithPreview;
                            setProjectFiles(prev => [...prev, fileWithPreview]);
                            setHasProjectFileChanges(true);
                            setHasFileChanges(true);
                          }}
                          disabled={isSubmitting}
                        />
                      </FileUploadField>
                    </CardContent>
                  </AccordionContent>
                </Card>
          </AccordionItem>
                )}

                {/* Check-in Files Card - grouped by service order, compact with FileUploadField */}
                {canViewCheckinCheckout && task.serviceOrders && task.serviceOrders.filter(so => so.id && so.type === SERVICE_ORDER_TYPE.PRODUCTION && so.status !== SERVICE_ORDER_STATUS.CANCELLED).length > 0 && (
          <AccordionItem
            value="checkin-files"
            id="accordion-item-checkin-files"
            className="border border-border rounded-lg"
          >
                <Card className="border-0">
                  <AccordionTrigger className="px-0 hover:no-underline">
                    <CardHeader className="flex-1 py-4">
                      <CardTitle className="flex items-center gap-2">
                        <IconCamera className="h-5 w-5" />
                        Check-in
                      </CardTitle>
                    </CardHeader>
                  </AccordionTrigger>
                  <AccordionContent>
                    <CardContent className="pt-0 space-y-3">
                      {task.serviceOrders
                        .filter(so => so.id && so.type === SERVICE_ORDER_TYPE.PRODUCTION && so.status !== SERVICE_ORDER_STATUS.CANCELLED)
                        .map((so) => {
                          const soFiles = checkinFilesByServiceOrder[so.id!] || [];
                          return (
                            <div key={`checkin-${so.id}`} className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <Label className="text-xs font-medium">{so.description}</Label>
                                <span className="text-xs text-muted-foreground">{soFiles.filter(f => f.uploaded).length} foto(s)</span>
                              </div>
                              <FileUploadField
                                onFilesChange={(files) => handleCheckinFilesChange(so.id!, files)}
                                maxFiles={20}
                                maxSize={500 * 1024 * 1024}
                                disabled={isSubmitting}
                                showPreview={true}
                                existingFiles={soFiles}
                                variant="mini"
                                placeholder="Clique ou arraste fotos"
                                showFiles={true}
                                acceptedFileTypes={{
                                  "image/*": [".jpeg", ".jpg", ".png", ".gif", ".webp", ".svg"],
                                  "video/mp4": [".mp4"],
                                  "video/quicktime": [".mov"],
                                  "video/webm": [".webm"],
                                  "video/x-msvideo": [".avi"],
                                  "video/x-matroska": [".mkv"],
                                }}
                              />
                            </div>
                          );
                        })}
                    </CardContent>
                  </AccordionContent>
                </Card>
          </AccordionItem>
                )}

                {/* Check-out Files Card - grouped by service order, shows checkin reference above */}
                {canViewCheckinCheckout && task.status === TASK_STATUS.COMPLETED && task.serviceOrders && task.serviceOrders.filter(so => so.id && so.type === SERVICE_ORDER_TYPE.PRODUCTION && so.status !== SERVICE_ORDER_STATUS.CANCELLED).length > 0 && (
          <AccordionItem
            value="checkout-files"
            id="accordion-item-checkout-files"
            className="border border-border rounded-lg"
          >
                <Card className="border-0">
                  <AccordionTrigger className="px-0 hover:no-underline">
                    <CardHeader className="flex-1 py-4">
                      <CardTitle className="flex items-center gap-2">
                        <IconCameraCheck className="h-5 w-5" />
                        Check-out
                      </CardTitle>
                    </CardHeader>
                  </AccordionTrigger>
                  <AccordionContent>
                    <CardContent className="pt-0 space-y-4">
                      {task.serviceOrders
                        .filter(so => so.id && so.type === SERVICE_ORDER_TYPE.PRODUCTION && so.status !== SERVICE_ORDER_STATUS.CANCELLED)
                        .map((so) => {
                          const soCheckinFiles = checkinFilesByServiceOrder[so.id!] || [];
                          const soCheckoutFiles = checkoutFilesByServiceOrder[so.id!] || [];
                          const checkinCount = soCheckinFiles.filter(f => f.uploaded).length;
                          const checkoutCount = soCheckoutFiles.filter(f => f.uploaded).length;
                          const needsMore = checkinCount > 0 && checkoutCount < checkinCount;
                          return (
                            <div key={`checkout-${so.id}`} className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <Label className="text-xs font-medium">{so.description}</Label>
                                {needsMore && (
                                  <span className="text-xs text-amber-600">
                                    falta {checkinCount - checkoutCount}
                                  </span>
                                )}
                              </div>
                              {/* Checkin reference images - small horizontal row */}
                              {soCheckinFiles.length > 0 && (
                                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                                  {soCheckinFiles.filter(f => f.uploaded).map((file) => {
                                    const apiBase = getApiBaseUrl();
                                    const src = file.thumbnailUrl
                                      ? (file.thumbnailUrl.startsWith("/api") ? `${apiBase}${file.thumbnailUrl}` : file.thumbnailUrl)
                                      : file.preview
                                        ? file.preview
                                        : file.uploadedFileId
                                          ? `${apiBase}/files/thumbnail/${file.uploadedFileId}`
                                          : "";
                                    return (
                                      <div
                                        key={file.id}
                                        className="relative flex-shrink-0 w-14 h-14 rounded-md overflow-hidden border border-border/50 bg-muted opacity-60"
                                      >
                                        {src ? (
                                          <img
                                            src={src}
                                            alt={file.name}
                                            className="w-full h-full object-cover"
                                          />
                                        ) : (
                                          <div className="w-full h-full flex items-center justify-center">
                                            <IconCamera className="h-3 w-3 text-muted-foreground" />
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                              <FileUploadField
                                onFilesChange={(files) => handleCheckoutFilesChange(so.id!, files)}
                                maxFiles={20}
                                maxSize={500 * 1024 * 1024}
                                disabled={isSubmitting}
                                showPreview={true}
                                existingFiles={soCheckoutFiles}
                                variant="mini"
                                placeholder="Clique ou arraste fotos"
                                showFiles={true}
                                acceptedFileTypes={{
                                  "image/*": [".jpeg", ".jpg", ".png", ".gif", ".webp", ".svg"],
                                  "video/mp4": [".mp4"],
                                  "video/quicktime": [".mov"],
                                  "video/webm": [".webm"],
                                  "video/x-msvideo": [".avi"],
                                  "video/x-matroska": [".mkv"],
                                }}
                              />
                            </div>
                          );
                        })}
                    </CardContent>
                  </AccordionContent>
                </Card>
          </AccordionItem>
                )}

                {/* Artworks/Layouts Card - EDITABLE for Designer and Commercial, Hidden for Warehouse, Financial, and Logistic users */}
                {canViewReimbursement && (
          <AccordionItem
            value="artworks"
            id="accordion-item-artworks"
            className="border border-border rounded-lg"
          >
                <Card className="border-0">
                  <AccordionTrigger className="px-0 hover:no-underline">
                    <CardHeader className="flex-1 py-4">
                      <CardTitle className="flex items-center gap-2">
                        <IconPhoto className="h-5 w-5" />
                        Layouts
                      </CardTitle>
                    </CardHeader>
                  </AccordionTrigger>
                  <AccordionContent>
                    <CardContent className="pt-0">
                      <ArtworkFileUploadField
                        onFilesChange={handleFilesChange}
                        onStatusChange={(fileId, status) => {
                          console.log('[Task Update] 🎨 Status changed:', { fileId, status, hasArtworkStatusChanges });
                          setArtworkStatuses(prev => {
                            const newStatuses = {
                              ...prev,
                              [fileId]: status,
                            };
                            console.log('[Task Update] 🎨 New artworkStatuses:', newStatuses);
                            return newStatuses;
                          });
                          setHasArtworkStatusChanges(true);
                          console.log('[Task Update] 🎨 Set hasArtworkStatusChanges to true');
                        }}
                        maxFiles={5}
                        disabled={isSubmitting}
                        showPreview={true}
                        existingFiles={uploadedFiles}
                        placeholder="Adicione layouts relacionados à tarefa"
                        label="Layouts anexados"
                      >
                        <FileSuggestions
                          customerId={task.customerId ?? undefined}
                          fileContext="tasksArtworks"
                          excludeFileIds={uploadedFiles.map(f => f.uploadedFileId || f.id).filter(Boolean)}
                          onSelect={(newFile) => {
                            const fileWithPreview: FileWithPreview = {
                              id: newFile.id,
                              name: newFile.filename || newFile.originalName || 'artwork',
                              size: newFile.size || 0,
                              type: newFile.mimetype || 'application/octet-stream',
                              lastModified: Date.now(),
                              uploaded: true,
                              uploadProgress: 100,
                              uploadedFileId: newFile.id,
                              thumbnailUrl: newFile.thumbnailUrl || undefined,
                              status: 'DRAFT',
                            } as FileWithPreview;
                            setUploadedFiles(prev => [...prev, fileWithPreview]);
                            setHasArtworkFileChanges(true);
                            setHasFileChanges(true);
                          }}
                          disabled={isSubmitting}
                        />
                      </ArtworkFileUploadField>
                    </CardContent>
                  </AccordionContent>
                </Card>
          </AccordionItem>
          )}

                {/* Observation Section - only for completed tasks */}
                {canViewObservation && task.status === TASK_STATUS.COMPLETED && (
          <AccordionItem
            value="observation"
            id="accordion-item-observation"
            className="border border-border rounded-lg"
          >
                <Card className="border-0">
                  <AccordionTrigger className="px-0 hover:no-underline">
                    <CardHeader className="flex-1 py-4">
                      <CardTitle className="flex items-center gap-2">
                        <IconNotes className="h-5 w-5" />
                        Observação
                      </CardTitle>
                    </CardHeader>
                  </AccordionTrigger>
                  <AccordionContent>
                    <CardContent className="pt-0">
                      <div className="space-y-4">
                        <FormField
                          control={form.control}
                          name="observation"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="flex items-center gap-2">
                                <IconNotes className="h-4 w-4" />
                                Descrição da Observação
                              </FormLabel>
                              <FormControl>
                                <Textarea
                                  value={field.value?.description || ""}
                                  onChange={(e) => {
                                    const description = e.target.value;
                                    field.onChange({
                                      ...field.value,
                                      description
                                    });
                                  }}
                                  placeholder="Descreva problemas ou observações sobre a tarefa..."
                                  rows={4}
                                  disabled={isSubmitting}
                                  className="bg-transparent"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Observation Files */}
                        <div className="space-y-2">
                          <Label className="text-sm font-medium flex items-center gap-2">
                            <IconFile className="h-4 w-4 text-muted-foreground" />
                            Arquivos de Evidência <span className="text-destructive">*</span>
                          </Label>
                          <FileUploadField
                            onFilesChange={handleObservationFilesChange}
                            maxFiles={10}
                            disabled={isSubmitting}
                            showPreview={true}
                            existingFiles={observationFiles}
                            variant="compact"
                            placeholder="Adicione fotos, documentos ou outros arquivos"
                            label="Arquivos anexados"
                          />
                        </div>

                        {hasIncompleteObservation && (
                          <Alert variant="destructive">
                            <AlertDescription>A observação está incompleta. Preencha a descrição e adicione pelo menos um arquivo antes de enviar o formulário.</AlertDescription>
                          </Alert>
                        )}
                      </div>
                    </CardContent>
                  </AccordionContent>
                </Card>
          </AccordionItem>
                )}

        </Accordion>
        </div>
      </form>

    </Form>
  );
};
