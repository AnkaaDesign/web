import React, { useState, forwardRef, useImperativeHandle, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { FileUploadField, type FileWithPreview } from "@/components/common/file";
import { ArtworkFileUploadField } from "../form/artwork-file-upload-field";
import { GeneralPaintingSelector } from "../form/general-painting-selector";
import { LogoPaintsSelector } from "../form/logo-paints-selector";
import { MultiCutSelector, type MultiCutSelectorRef } from "../form/multi-cut-selector";
import { useTaskBatchMutations, taskKeys, serviceOrderKeys } from "../../../../hooks";
import { taskService } from "../../../../api-client/task";
import { fileService } from "../../../../api-client/file";
import { IconPhoto, IconFileText, IconPalette, IconCut, IconLoader2, IconPlus, IconFileInvoice, IconLayout } from "@tabler/icons-react";
import { CUT_TYPE, CUT_ORIGIN, SERVICE_ORDER_TYPE, SERVICE_ORDER_STATUS, SERVICE_ORDER_TYPE_LABELS } from "../../../../constants";
import { Textarea } from "@/components/ui/textarea";
import { serviceOrderService } from "../../../../api-client/serviceOrder";
import { ServiceSelectorAutoGrouped } from "../form/service-selector-auto-grouped";
import { useCurrentUser } from "../../../../hooks";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { LayoutForm } from "@/components/production/layout/layout-form";

// Type definitions for the operations
type BulkOperationType = "arts" | "baseFiles" | "paints" | "cuttingPlans" | "layout" | "serviceOrder";

// Schema for form validation
const bulkOperationSchema = z.object({
  // For paints
  paintId: z.string().nullable().optional(),
  paintIds: z.array(z.string()).optional(),

  // For cuts
  cuts: z.array(z.object({
    type: z.nativeEnum(CUT_TYPE),
    quantity: z.number().min(1).optional(),
    origin: z.nativeEnum(CUT_ORIGIN),
    fileId: z.string().optional(),
    file: z.any().optional(),
  })).optional(),

  // For service orders batch editing
  serviceOrders: z.array(z.object({
    id: z.string().optional(),
    type: z.nativeEnum(SERVICE_ORDER_TYPE),
    status: z.nativeEnum(SERVICE_ORDER_STATUS),
    statusOrder: z.number().optional(),
    description: z.string().min(3, "Descrição deve ter pelo menos 3 caracteres"),
    observation: z.string().nullable().optional(),
    assignedToId: z.string().nullable().optional(),
    _isCommon: z.boolean().optional(),
    _commonKey: z.string().optional(),
  })).optional(),
});

type BulkOperationFormData = z.infer<typeof bulkOperationSchema>;

interface AdvancedBulkActionsHandlerProps {
  selectedTaskIds: Set<string>;
  onClearSelection: () => void;
}

export const AdvancedBulkActionsHandler = forwardRef<
  { openModal: (type: BulkOperationType, taskIds: string[]) => void },
  AdvancedBulkActionsHandlerProps
>(({ selectedTaskIds, onClearSelection }, ref) => {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [operationType, setOperationType] = useState<BulkOperationType | null>(null);
  const [currentTaskIds, setCurrentTaskIds] = useState<string[]>([]);
  const [currentTasks, setCurrentTasks] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // States for file uploads (new files, like task form)
  const [artworkFiles, setArtworkFiles] = useState<FileWithPreview[]>([]);
  const [artworkStatuses, setArtworkStatuses] = useState<Record<string, 'DRAFT' | 'APPROVED' | 'REPROVED'>>({});
  const [baseFiles, setBaseFiles] = useState<FileWithPreview[]>([]);
  const [cutsCount, setCutsCount] = useState(0);

  // States for layout editing - visual editor like task edit form
  const [selectedLayoutSide, setSelectedLayoutSide] = useState<"left" | "right" | "back">("left");
  const [layoutStates, setLayoutStates] = useState<{
    left: any | null;
    right: any | null;
    back: any | null;
  }>({ left: null, right: null, back: null });

  // States for service order form (legacy - for creating new ones)
  const [serviceOrderType, setServiceOrderType] = useState<SERVICE_ORDER_TYPE>(SERVICE_ORDER_TYPE.PRODUCTION);
  const [serviceOrderDescription, setServiceOrderDescription] = useState<string>("");

  // State for common service orders (for batch editing existing ones)
  const [commonServiceOrders, setCommonServiceOrders] = useState<any[]>([]);
  // Track original service order IDs per task for computing updates
  const [originalServiceOrdersMap, setOriginalServiceOrdersMap] = useState<Record<string, any[]>>({});
  // Map of _commonKey -> array of all service order IDs across all tasks (for batch updates)
  const [commonKeyToIdsMap, setCommonKeyToIdsMap] = useState<Record<string, string[]>>({});

  // States for tracking common values across selected tasks
  const [commonValues, setCommonValues] = useState<{
    paintId: string | null;
    generalPainting: any | null;
    paintIds: string[];
    logoPaints: any[];
    artworkFiles: Array<{ id: string; name: string; originalName: string; size: number; type: string; lastModified: number; uploaded: boolean; uploadProgress: number; uploadedFileId: string; thumbnailUrl?: string | null }>;
    baseFiles: Array<{ id: string; name: string; originalName: string; size: number; type: string; lastModified: number; uploaded: boolean; uploadProgress: number; uploadedFileId: string }>;
    cuts: Array<any>;
    serviceOrders: Array<any>;
  }>({
    paintId: null,
    generalPainting: null,
    paintIds: [],
    logoPaints: [],
    artworkFiles: [],
    baseFiles: [],
    cuts: [],
    serviceOrders: [],
  });

  // Get current user for service order permissions
  const { data: user } = useCurrentUser();

  const { batchUpdateAsync } = useTaskBatchMutations();

  // Ref for MultiCutSelector
  const multiCutSelectorRef = useRef<MultiCutSelectorRef>(null);

  // Form setup - single form for all operations
  const form = useForm<BulkOperationFormData>({
    resolver: zodResolver(bulkOperationSchema),
    defaultValues: {
      paintId: null,
      paintIds: [],
      cuts: [],
      serviceOrders: [],
    },
  });

  const resetForm = (type: BulkOperationType) => {
    // Reset all file states
    setArtworkFiles([]);
    setArtworkStatuses({});
    setBaseFiles([]);
    setCutsCount(0);

    // Reset layout states
    setSelectedLayoutSide("left");
    setLayoutStates({ left: null, right: null, back: null });

    // Reset service order states
    setServiceOrderType(SERVICE_ORDER_TYPE.PRODUCTION);
    setServiceOrderDescription("");
    setCommonServiceOrders([]);
    setOriginalServiceOrdersMap({});
    setCommonKeyToIdsMap({});

    // Reset common values
    setCommonValues({
      paintId: null,
      generalPainting: null,
      paintIds: [],
      logoPaints: [],
      artworkFiles: [],
      baseFiles: [],
      cuts: [],
      serviceOrders: [],
    });

    // Reset form
    form.reset({
      paintId: null,
      paintIds: [],
      cuts: [],
      serviceOrders: [],
    });
  };

  // Expose the openModal method to parent component
  useImperativeHandle(ref, () => ({
    openModal: async (type: BulkOperationType, taskIds: string[]) => {
      setOperationType(type);
      setCurrentTaskIds(taskIds);
      setIsOpen(true);
      setIsLoadingData(true);

      // Fetch selected tasks to compute common values
      if (taskIds.length > 0) {
        try {
          const tasksResponse = await taskService.getTasks({
            where: {
              id: { in: taskIds },
            },
            include: {
              artworks: { include: { file: true } },
              baseFiles: true,
              cuts: { include: { file: true } },
              logoPaints: true,
              generalPainting: true,
              truck: {
                include: {
                  leftSideLayout: { include: { layoutSections: true } },
                  rightSideLayout: { include: { layoutSections: true } },
                  backSideLayout: { include: { layoutSections: true } },
                },
              },
              serviceOrders: { include: { assignedTo: true } },
            },
          });

          const tasks = tasksResponse.data;
          setCurrentTasks(tasks);

          // Compute common values across all tasks
          const computed = {
            paintId: null as string | null,
            generalPainting: null as any,
            paintIds: [] as string[],
            logoPaints: [] as any[],
            artworkFiles: [] as Array<{ id: string; name: string; originalName: string; size: number; type: string; lastModified: number; uploaded: boolean; uploadProgress: number; uploadedFileId: string; thumbnailUrl?: string | null }>,
            baseFiles: [] as Array<{ id: string; name: string; originalName: string; size: number; type: string; lastModified: number; uploaded: boolean; uploadProgress: number; uploadedFileId: string }>,
            cuts: [] as Array<any>,
            serviceOrders: [] as Array<any>,
          };

          // Check if all tasks have the same general painting
          const firstPaintId = tasks[0]?.paintId;
          if (firstPaintId && tasks.every(t => t.paintId === firstPaintId)) {
            computed.paintId = firstPaintId;
            computed.generalPainting = tasks[0].generalPainting;
          }

          // Find logo paints that ALL tasks have in common
          if (tasks.length > 0 && tasks[0].logoPaints) {
            const firstTaskPaintIds = new Set(tasks[0].logoPaints.map(p => p.id));
            const commonPaintIds = Array.from(firstTaskPaintIds).filter(paintId =>
              tasks.every(task => task.logoPaints?.some(p => p.id === paintId))
            );
            computed.paintIds = commonPaintIds;
            // Also store the full paint objects
            computed.logoPaints = tasks[0].logoPaints.filter(p => commonPaintIds.includes(p.id));
          }

          // Find artworks that ALL tasks have in common (by filename, since each task may have different file IDs)
          // NOTE: task.artworks are now Artwork entities with a nested file property
          // Artwork entity: { id: artworkId, fileId, status, file?: { id, filename, originalName, thumbnailUrl, ... } }
          if (tasks.length > 0) {
            // Collect all unique filenames from all tasks
            const allFilenames = new Set<string>();
            tasks.forEach(task => {
              (task.artworks || []).forEach((artwork: any) => {
                // artwork.file contains the actual File data
                const file = artwork.file || artwork;
                const filename = file.originalName || file.filename;
                if (filename) allFilenames.add(filename);
              });
            });

            // Filter to only filenames that exist in ALL tasks
            const commonFilenames = Array.from(allFilenames).filter(filename =>
              tasks.every(task => (task.artworks || []).some((artwork: any) => {
                const file = artwork.file || artwork;
                return (file.originalName || file.filename) === filename;
              }))
            );

            // Find the first task that has artworks to use as reference
            const taskWithArtworks = tasks.find(t => t.artworks && t.artworks.length > 0);

            if (taskWithArtworks && commonFilenames.length > 0) {
              // For each common filename, use the reference task's file data
              const commonArtworks = taskWithArtworks.artworks.filter((artwork: any) => {
                const file = artwork.file || artwork;
                return commonFilenames.includes(file.originalName || file.filename);
              });

              computed.artworkFiles = commonArtworks.map((artwork: any) => {
                // Extract File data from Artwork entity
                const file = artwork.file || artwork;
                const fileId = artwork.fileId || file.id;
                return {
                  id: fileId, // File ID (not Artwork entity ID)
                  name: file.filename || file.originalName || 'artwork',
                  originalName: file.originalName,
                  size: file.size || 0,
                  type: file.mimetype || 'application/octet-stream',
                  lastModified: file.createdAt ? new Date(file.createdAt).getTime() : Date.now(),
                  uploaded: true,
                  uploadProgress: 100,
                  uploadedFileId: fileId, // File ID for form submission
                  thumbnailUrl: file.thumbnailUrl,
                  status: artwork.status || 'DRAFT', // Include artwork status
                };
              });
            }
          }

          // Find baseFiles that ALL tasks have in common (by filename)
          // Base files are files used as base for artwork design (shared like artwork)
          if (tasks.length > 0) {
            const allBaseFileFilenames = new Set<string>();
            tasks.forEach(task => {
              (task.baseFiles || []).forEach((f: any) => {
                const filename = f.originalName || f.filename;
                if (filename) allBaseFileFilenames.add(filename);
              });
            });

            const commonBaseFileFilenames = Array.from(allBaseFileFilenames).filter(filename =>
              tasks.every(task => (task.baseFiles || []).some((f: any) => (f.originalName || f.filename) === filename))
            );

            const taskWithBaseFiles = tasks.find(t => t.baseFiles && t.baseFiles.length > 0);
            if (taskWithBaseFiles && commonBaseFileFilenames.length > 0) {
              const commonBaseFiles = taskWithBaseFiles.baseFiles.filter((f: any) =>
                commonBaseFileFilenames.includes(f.originalName || f.filename)
              );
              computed.baseFiles = commonBaseFiles.map((f: any) => ({
                id: f.id,
                name: f.filename || f.originalName || 'base-file',
                originalName: f.originalName,
                size: f.size || 0,
                type: f.mimetype || 'application/octet-stream',
                lastModified: f.createdAt ? new Date(f.createdAt).getTime() : Date.now(),
                uploaded: true,
                uploadProgress: 100,
                uploadedFileId: f.id,
              }));
            }
          }

          // Find cuts that ALL tasks have with matching type, quantity, and file
          if (tasks.length > 0 && tasks[0].cuts && tasks[0].cuts.length > 0) {
            // Check if all tasks have the same number of cuts
            if (tasks.every(task => task.cuts?.length === tasks[0].cuts?.length)) {
              // Map first task's cuts and check if all tasks have matching cuts
              const firstTaskCuts = tasks[0].cuts;
              const allCutsMatch = firstTaskCuts.every(firstCut => {
                return tasks.every(task => {
                  return task.cuts?.some(cut =>
                    cut.type === firstCut.type &&
                    cut.quantity === firstCut.quantity &&
                    cut.origin === firstCut.origin &&
                    cut.file?.originalName === firstCut.file?.originalName
                  );
                });
              });

              if (allCutsMatch) {
                computed.cuts = firstTaskCuts.map(cut => ({
                  type: cut.type,
                  quantity: cut.quantity,
                  origin: cut.origin,
                  fileId: cut.fileId,
                  file: cut.file ? { id: cut.file.id, originalName: cut.file.originalName, url: cut.file.url } : undefined,
                }));
              }
            }
          }

          // Find service orders that ALL tasks have in common (by type + description)
          // A service order is "common" if all tasks have a service order with the same type AND description
          if (tasks.length > 0 && type === 'serviceOrder') {
            // Build map of original service orders per task (for tracking updates later)
            const serviceOrdersPerTask: Record<string, any[]> = {};
            tasks.forEach(task => {
              serviceOrdersPerTask[task.id] = (task.serviceOrders || []).map((so: any) => ({
                id: so.id,
                type: so.type,
                status: so.status,
                statusOrder: so.statusOrder,
                description: so.description,
                observation: so.observation,
                assignedToId: so.assignedToId,
                assignedTo: so.assignedTo,
                taskId: so.taskId,
              }));
            });
            setOriginalServiceOrdersMap(serviceOrdersPerTask);

            // Find common service orders (matching by type + description across ALL tasks)
            const firstTaskServiceOrders = tasks[0].serviceOrders || [];
            const commonSOs: any[] = [];
            // Map to track all IDs for each common key
            const keyToIdsMap: Record<string, string[]> = {};
            // Track processed keys to avoid duplicates (if task has duplicate service orders)
            const processedCommonKeys = new Set<string>();

            firstTaskServiceOrders.forEach((firstSO: any) => {
              const commonKey = `${firstSO.type}:${firstSO.description?.trim().toLowerCase()}`;

              // Skip if we already processed this commonKey (handles duplicate SOs in same task)
              if (processedCommonKeys.has(commonKey)) {
                return;
              }

              // Check if all other tasks have a service order with same type and description
              const isCommon = tasks.every(task => {
                return (task.serviceOrders || []).some((so: any) =>
                  so.type === firstSO.type &&
                  so.description?.trim().toLowerCase() === firstSO.description?.trim().toLowerCase()
                );
              });

              if (isCommon) {
                processedCommonKeys.add(commonKey);

                // Collect ALL service order IDs across all tasks for this common key
                // Note: If a task has multiple SOs with same type+description, we only take the first match
                const allIdsForThisKey: string[] = [];
                tasks.forEach(task => {
                  const matchingSO = (task.serviceOrders || []).find((so: any) =>
                    so.type === firstSO.type &&
                    so.description?.trim().toLowerCase() === firstSO.description?.trim().toLowerCase()
                  );
                  if (matchingSO) {
                    allIdsForThisKey.push(matchingSO.id);
                  }
                });
                keyToIdsMap[commonKey] = allIdsForThisKey;

                // Use the first task's service order as the reference
                // Include a unique identifier based on type + description for form tracking
                commonSOs.push({
                  id: firstSO.id,
                  type: firstSO.type,
                  status: firstSO.status,
                  statusOrder: firstSO.statusOrder || 1,
                  description: firstSO.description,
                  observation: firstSO.observation,
                  assignedToId: firstSO.assignedToId,
                  // Mark as common so we know this is an existing service order
                  _isCommon: true,
                  _commonKey: commonKey,
                });
              }
            });

            computed.serviceOrders = commonSOs;
            setCommonServiceOrders(commonSOs);
            setCommonKeyToIdsMap(keyToIdsMap);
          }

          setCommonValues(computed);

          // Pre-fill form with common values
          form.reset({
            paintId: computed.paintId,
            paintIds: computed.paintIds,
            cuts: computed.cuts,
            serviceOrders: computed.serviceOrders,
          });

          // Pre-fill existing files for display
          if (type === 'arts') {
            setArtworkFiles(computed.artworkFiles as any);
            // Initialize artwork statuses from existing artwork data
            const initialStatuses: Record<string, 'DRAFT' | 'APPROVED' | 'REPROVED'> = {};
            computed.artworkFiles.forEach((f: any) => {
              if (f.uploadedFileId) {
                initialStatuses[f.uploadedFileId] = f.status || 'DRAFT';
              }
            });
            setArtworkStatuses(initialStatuses);
          } else if (type === 'baseFiles') {
            setBaseFiles(computed.baseFiles as any);
          } else if (type === 'cuttingPlans') {
            // Cuts are handled by form.reset above
            setCutsCount(computed.cuts.length);
          } else if (type === 'layout') {
            // Pre-load existing common layouts from trucks
            // Check if all tasks share the same layout per side (by layoutId)
            const tasksWithTrucks = tasks.filter((t: any) => t.truck);

            if (tasksWithTrucks.length > 0) {
              const convertLayoutToFormState = (layout: any) => {
                if (!layout || !layout.layoutSections || layout.layoutSections.length === 0) return null;
                return {
                  height: layout.height,
                  photoId: layout.photoId || null,
                  layoutSections: layout.layoutSections
                    .sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0))
                    .map((s: any) => ({
                      width: s.width,
                      isDoor: s.isDoor || false,
                      doorHeight: s.doorHeight,
                      position: s.position,
                    })),
                };
              };

              // Check left side
              const firstLeftId = tasksWithTrucks[0].truck?.leftSideLayoutId;
              const allShareLeft = firstLeftId && tasksWithTrucks.every(
                (t: any) => t.truck?.leftSideLayoutId === firstLeftId
              );

              // Check right side
              const firstRightId = tasksWithTrucks[0].truck?.rightSideLayoutId;
              const allShareRight = firstRightId && tasksWithTrucks.every(
                (t: any) => t.truck?.rightSideLayoutId === firstRightId
              );

              // Check back side
              const firstBackId = tasksWithTrucks[0].truck?.backSideLayoutId;
              const allShareBack = firstBackId && tasksWithTrucks.every(
                (t: any) => t.truck?.backSideLayoutId === firstBackId
              );

              const preloadedLayouts = {
                left: allShareLeft ? convertLayoutToFormState(tasksWithTrucks[0].truck?.leftSideLayout) : null,
                right: allShareRight ? convertLayoutToFormState(tasksWithTrucks[0].truck?.rightSideLayout) : null,
                back: allShareBack ? convertLayoutToFormState(tasksWithTrucks[0].truck?.backSideLayout) : null,
              };

              setLayoutStates(preloadedLayouts);
            }
          } else if (type === 'serviceOrder') {
            // Service orders are handled by form.reset above
            // The ServiceSelectorAutoGrouped component will use the form's serviceOrders field
          }
        } catch (error) {
          if (process.env.NODE_ENV !== 'production') {
            console.error("Error fetching tasks for bulk operations:", error);
          }
        } finally {
          setIsLoadingData(false);
        }
      } else {
        // No tasks, just reset to empty
        resetForm(type);
        setIsLoadingData(false);
      }
    },
  }), [form, resetForm]);

  const handleClose = () => {
    if (!isSubmitting && !isLoadingData) {
      setIsOpen(false);
      setOperationType(null);
      setCurrentTaskIds([]);
      setCurrentTasks([]);
      setIsLoadingData(false);
      resetForm("arts");
    }
  };

  const handleSubmit = async () => {
    if (!operationType || currentTaskIds.length === 0) return;

    setIsSubmitting(true);

    try {
      const updateData: any = {};
      // Declare file arrays at function scope so they're accessible later
      let newArtworkFiles: File[] = [];
      let newBaseFiles: File[] = [];

      switch (operationType) {
        case "arts":
          // New files to upload via FormData
          newArtworkFiles = artworkFiles.filter(f => f instanceof File) as File[];

          // Determine which common artworks were explicitly REMOVED (user clicked X)
          const currentFilenames = artworkFiles
            .filter(f => !(f instanceof File))
            .map((f: any) => f.originalName || f.name);
          const originalCommonFilenames = commonValues.artworkFiles.map(
            (f: any) => f.originalName || f.name
          );
          const removedFileIds = commonValues.artworkFiles
            .filter((f: any) => !currentFilenames.includes(f.originalName || f.name))
            .map((f: any) => f.uploadedFileId || f.id);

          const hasRemovals = removedFileIds.length > 0;

          // Only compute per-task artworkIds (SET mode) when files were REMOVED.
          // When only adding new files (no removals), skip artworkIds so the backend
          // uses ADD mode (merge with existing) instead of SET/REPLACE mode.
          // For status-only changes, skip artworkIds entirely so the backend
          // won't touch task-artwork connections — only updates Artwork entity statuses.
          if (hasRemovals) {
            const perTaskArtworkIds: Record<string, string[]> = {};
            currentTasks.forEach(task => {
              const keptIds: string[] = [];
              (task.artworks || []).forEach((artwork: any) => {
                // In flattened format from API: artwork.id = File ID, artwork.artworkId = Artwork entity ID
                // artwork.fileId and artwork.file don't exist in flattened format
                const file = artwork.file || artwork;
                const artworkFileId = artwork.fileId || file.id;
                if (artworkFileId && !removedFileIds.includes(artworkFileId)) {
                  // Send File IDs so the backend conversion path applies artworkStatuses
                  keptIds.push(artworkFileId);
                }
              });
              perTaskArtworkIds[task.id] = keptIds;
            });
            updateData._perTaskArtworkIds = perTaskArtworkIds;
          }

          if (newArtworkFiles.length > 0) {
            updateData._hasNewArtworkFiles = true;
          }

          // Send artwork statuses for status changes
          if (Object.keys(artworkStatuses).length > 0) {
            updateData._artworkStatuses = artworkStatuses;
          }
          break;

        case "baseFiles":
          // Get new base files that need to be uploaded (via FormData, like artworks)
          newBaseFiles = baseFiles.filter(f => f instanceof File) as File[];

          // Get filenames that should be kept (from existing files in baseFiles state)
          // These are the COMMON base files that the user chose to keep
          const keptBaseFileFilenames = baseFiles
            .filter(f => !(f instanceof File))
            .map((f: any) => f.originalName || f.name);

          // Get filenames of COMMON base files (files that were shown in the UI)
          // These were pre-populated from commonValues.baseFiles
          const commonBaseFilenames = commonValues.baseFiles.map(
            (f: any) => f.originalName || f.name
          );

          // NOTE: We no longer upload files separately. Files will be sent WITH the batch update request.
          // The backend /tasks/batch endpoint now accepts FormData with both JSON data and files.

          // For each task, compute the final baseFileIds:
          // 1. Keep ALL non-common base files (unique to this task) - user couldn't remove them
          // 2. Keep common base files only if user kept them in keptBaseFileFilenames
          // 3. New files will be uploaded via FormData and backend will add them automatically
          const perTaskBaseFileIds: Record<string, string[]> = {};
          currentTasks.forEach(task => {
            const taskBaseFileIds: string[] = [];

            (task.baseFiles || []).forEach((file: any) => {
              const filename = file.originalName || file.filename;
              const fileId = file.id;

              if (!fileId) return;

              // Check if this is a common base file (was shown in UI)
              const isCommon = commonBaseFilenames.includes(filename);

              if (isCommon) {
                // Only keep if user kept it in the UI
                if (keptBaseFileFilenames.includes(filename)) {
                  taskBaseFileIds.push(fileId);
                }
              } else {
                // Non-common base file - always keep (user couldn't modify it)
                taskBaseFileIds.push(fileId);
              }
            });

            // New base files will be appended by the backend when processing FormData
            perTaskBaseFileIds[task.id] = taskBaseFileIds;
          });

          // Store per-task data
          if (newBaseFiles.length > 0 || commonBaseFilenames.length > 0) {
            updateData._perTaskBaseFileIds = perTaskBaseFileIds;
            updateData._hasNewBaseFiles = newBaseFiles.length > 0;
          }
          break;

        case "paints":
          const paintFormData = form.getValues();

          // Handle general painting
          if (paintFormData.paintId !== commonValues.paintId) {
            if (paintFormData.paintId) {
              updateData.paintId = paintFormData.paintId;
            } else if (commonValues.paintId) {
              // Was set, now cleared → remove it
              updateData.paintId = null;
            }
          }

          // Handle logo paints
          const currentPaintIds = paintFormData.paintIds || [];
          const addedPaintIds = currentPaintIds.filter(id => !commonValues.paintIds.includes(id));
          const removedPaintIds = commonValues.paintIds.filter(id => !currentPaintIds.includes(id));

          if (addedPaintIds.length > 0 || removedPaintIds.length > 0) {
            // Set the full array (backend will handle the difference)
            updateData.paintIds = currentPaintIds;
          }
          break;

        case "cuttingPlans":
          const cuts = form.getValues("cuts");

          // Determine which cuts are new (added by user) vs existing (from commonValues)
          // A cut is "existing" if it matches a commonValues cut by type+origin+fileId
          const isExistingCut = (cut: any) => {
            return commonValues.cuts.some((common: any) =>
              common.type === cut.type &&
              common.origin === cut.origin &&
              (common.fileId === cut.fileId ||
                common.fileId === cut.file?.id ||
                common.fileId === cut.file?.uploadedFileId)
            );
          };

          // Find NEW cuts (not in commonValues)
          const newCuts = (cuts || []).filter((cut: any) => !isExistingCut(cut));

          // Find REMOVED cuts (in commonValues but not in current form)
          const isKeptCut = (common: any) => {
            return (cuts || []).some((cut: any) =>
              common.type === cut.type &&
              common.origin === cut.origin &&
              (common.fileId === cut.fileId ||
                common.fileId === cut.file?.id ||
                common.fileId === cut.file?.uploadedFileId)
            );
          };
          const removedCommonCuts = commonValues.cuts.filter((common: any) => !isKeptCut(common));

          // Handle new cuts: upload files and send as additive cuts
          if (newCuts.length > 0) {
            const cutsToAdd: any[] = [];

            for (const cut of newCuts) {
              const cutData: any = {
                type: cut.type,
                quantity: cut.quantity || 1,
                origin: cut.origin || CUT_ORIGIN.PLAN,
              };

              if (cut.file && cut.file instanceof File) {
                // Upload the file
                const uploadResponse = await fileService.uploadFiles([cut.file], {
                  fileContext: 'cut',
                  entityType: 'task',
                });
                if (uploadResponse.success && uploadResponse.data?.successful?.[0]) {
                  cutData.fileId = uploadResponse.data.successful[0].id;
                }
              } else if (cut.file && (cut.file.id || cut.file.uploadedFileId)) {
                cutData.fileId = cut.file.id || cut.file.uploadedFileId;
              }

              cutsToAdd.push(cutData);
            }

            // Send as additive cuts — backend will create without destroying existing ones
            updateData.cuts = cutsToAdd;
          }

          // Handle removed cuts: send specific IDs to delete
          if (removedCommonCuts.length > 0) {
            // Collect cut IDs from ALL tasks for the removed common cuts
            // Each common cut maps to one cut per task (matched by type+origin+file)
            const removeCutIds: string[] = [];
            currentTasks.forEach((task: any) => {
              (task.cuts || []).forEach((taskCut: any) => {
                const isRemoved = removedCommonCuts.some((removed: any) =>
                  removed.type === taskCut.type &&
                  removed.origin === taskCut.origin &&
                  removed.fileId === taskCut.fileId
                );
                if (isRemoved && taskCut.id) {
                  removeCutIds.push(taskCut.id);
                }
              });
            });

            if (removeCutIds.length > 0) {
              updateData.removeCutIds = removeCutIds;
            }
          }
          break;

        case "layout":
          // Pass layout data embedded in truck object for ALL tasks
          // This works for both:
          // - Tasks WITH trucks: truck is updated with new layouts
          // - Tasks WITHOUT trucks: truck is created with embedded layouts
          const hasAnyLayoutState =
            (layoutStates.left?.layoutSections?.length > 0) ||
            (layoutStates.right?.layoutSections?.length > 0) ||
            (layoutStates.back?.layoutSections?.length > 0);

          if (hasAnyLayoutState) {
            // Build truck object with embedded layout data (following taskTruckCreateSchema)
            const truckWithLayouts: any = {};
            // Collect layout photo files for upload
            const layoutPhotoFiles: Array<{ side: string; file: File }> = [];

            // Left side layout data
            if (layoutStates.left?.layoutSections?.length > 0) {
              truckWithLayouts.leftSideLayout = {
                height: layoutStates.left.height,
                layoutSections: layoutStates.left.layoutSections.map((s: any, idx: number) => ({
                  width: s.width,
                  isDoor: s.isDoor || false,
                  doorHeight: s.doorHeight,
                  position: idx,
                })),
                photoId: layoutStates.left.photoId || null,
              };
              // Collect photo file if present
              if (layoutStates.left.photoFile instanceof File) {
                layoutPhotoFiles.push({ side: 'leftSide', file: layoutStates.left.photoFile });
              }
            }

            // Right side layout data
            if (layoutStates.right?.layoutSections?.length > 0) {
              truckWithLayouts.rightSideLayout = {
                height: layoutStates.right.height,
                layoutSections: layoutStates.right.layoutSections.map((s: any, idx: number) => ({
                  width: s.width,
                  isDoor: s.isDoor || false,
                  doorHeight: s.doorHeight,
                  position: idx,
                })),
                photoId: layoutStates.right.photoId || null,
              };
              // Collect photo file if present
              if (layoutStates.right.photoFile instanceof File) {
                layoutPhotoFiles.push({ side: 'rightSide', file: layoutStates.right.photoFile });
              }
            }

            // Back side layout data
            if (layoutStates.back?.layoutSections?.length > 0) {
              truckWithLayouts.backSideLayout = {
                height: layoutStates.back.height,
                layoutSections: layoutStates.back.layoutSections.map((s: any, idx: number) => ({
                  width: s.width,
                  isDoor: s.isDoor || false,
                  doorHeight: s.doorHeight,
                  position: idx,
                })),
                photoId: layoutStates.back.photoId || null,
              };
              // Collect photo file if present
              if (layoutStates.back.photoFile instanceof File) {
                layoutPhotoFiles.push({ side: 'backSide', file: layoutStates.back.photoFile });
              }
            }

            // Set truck data for ALL tasks - this will create truck if missing
            // or update existing truck with new layout data
            if (Object.keys(truckWithLayouts).length > 0) {
              const truckLayoutUpdates: Record<string, any> = {};

              currentTasks.forEach(task => {
                // Pass the same layout data to all tasks
                // Backend will handle creating/updating trucks and layouts
                truckLayoutUpdates[task.id] = truckWithLayouts;
              });

              updateData._perTaskTruckUpdates = truckLayoutUpdates;

              // Store layout photo files for later use in FormData
              if (layoutPhotoFiles.length > 0) {
                updateData._layoutPhotoFiles = layoutPhotoFiles;
              }
            }
          }
          break;

        case "serviceOrder":
          // Handle batch update/create of service orders
          const currentFormServiceOrders = form.getValues("serviceOrders") || [];

          // Build a map of original ID -> commonKey for robust matching
          // (in case form doesn't preserve _commonKey)
          const originalIdToCommonKey: Record<string, string> = {};
          commonServiceOrders.forEach((origSO: any) => {
            if (origSO.id && origSO._commonKey) {
              originalIdToCommonKey[origSO.id] = origSO._commonKey;
            }
          });

          // Separate into updates (common service orders) and creates (new ones)
          const serviceOrdersToUpdate: Array<{ id: string; data: any }> = [];
          const serviceOrdersToCreate: Array<any> = [];
          const processedCommonKeys: Set<string> = new Set();

          currentFormServiceOrders.forEach((formSO: any, index: number) => {
            // Try to get commonKey from form field first, then fallback to matching by ID
            let commonKey = formSO._commonKey;
            if (!commonKey && formSO.id) {
              commonKey = originalIdToCommonKey[formSO.id];
            }

            const isCommonServiceOrder = commonKey && commonKeyToIdsMap[commonKey];

            if (isCommonServiceOrder) {
              // This is a common service order - update ALL matching ones across tasks
              const allIds = commonKeyToIdsMap[commonKey];
              processedCommonKeys.add(commonKey);

              allIds.forEach((soId: string) => {
                serviceOrdersToUpdate.push({
                  id: soId,
                  data: {
                    type: formSO.type,
                    status: formSO.status,
                    statusOrder: formSO.statusOrder,
                    description: formSO.description?.trim(),
                    observation: formSO.observation || null,
                    assignedToId: formSO.assignedToId || null,
                  },
                });
              });
            } else if (!formSO.id || (typeof formSO.id === 'string' && formSO.id.startsWith('temp-'))) {
              // This is a new service order - create for all tasks
              currentTaskIds.forEach(taskId => {
                serviceOrdersToCreate.push({
                  taskId,
                  type: formSO.type,
                  status: formSO.status || SERVICE_ORDER_STATUS.PENDING,
                  statusOrder: formSO.statusOrder || 1,
                  description: formSO.description?.trim(),
                  observation: formSO.observation || null,
                  assignedToId: formSO.assignedToId || null,
                });
              });
            }
          });

          // Check for removed common service orders (ones that were in commonKeyToIdsMap but not processed)
          const serviceOrdersToDelete: string[] = [];
          Object.entries(commonKeyToIdsMap).forEach(([commonKey, ids]) => {
            if (!processedCommonKeys.has(commonKey)) {
              // This common key was removed from the form - delete all associated service orders
              serviceOrdersToDelete.push(...ids);
            }
          });

          // Execute batch operations
          const operations: Promise<any>[] = [];

          if (serviceOrdersToUpdate.length > 0) {
            operations.push(
              serviceOrderService.batchUpdateServiceOrders({
                serviceOrders: serviceOrdersToUpdate,
              })
            );
          }

          if (serviceOrdersToCreate.length > 0) {
            operations.push(
              serviceOrderService.batchCreateServiceOrders({
                serviceOrders: serviceOrdersToCreate,
              })
            );
          }

          if (serviceOrdersToDelete.length > 0) {
            operations.push(
              serviceOrderService.batchDeleteServiceOrders({
                serviceOrderIds: serviceOrdersToDelete,
              })
            );
          }

          if (operations.length > 0) {
            await Promise.all(operations);

            // Invalidate task and service order queries to refresh the UI with fresh data
            queryClient.invalidateQueries({
              queryKey: taskKeys.all,
            });
            queryClient.invalidateQueries({
              queryKey: serviceOrderKeys.all,
            });
          }

          // Close and clear after successful operations
          handleClose();
          onClearSelection();
          return; // Exit early - no need for batch task update
      }

      // Extract per-task data and internal flags
      const perTaskArtworkIds = updateData._perTaskArtworkIds;
      const perTaskBaseFileIds = updateData._perTaskBaseFileIds;
      const perTaskTruckUpdates = updateData._perTaskTruckUpdates;
      const hasNewArtworkFiles = updateData._hasNewArtworkFiles;
      const hasNewBaseFiles = updateData._hasNewBaseFiles;
      const layoutPhotoFiles = updateData._layoutPhotoFiles as Array<{ side: string; file: File }> | undefined;
      const artworkStatusesMap = updateData._artworkStatuses as Record<string, 'DRAFT' | 'APPROVED' | 'REPROVED'> | undefined;

      delete updateData._perTaskArtworkIds;
      delete updateData._perTaskBaseFileIds;
      delete updateData._perTaskTruckUpdates;
      delete updateData._hasNewArtworkFiles;
      delete updateData._hasNewBaseFiles;
      delete updateData._layoutPhotoFiles;
      delete updateData._artworkStatuses;

      const hasPerTaskData = perTaskArtworkIds || perTaskBaseFileIds || perTaskTruckUpdates;
      const hasData = Object.keys(updateData).length > 0 || hasPerTaskData || artworkStatusesMap || hasNewArtworkFiles;

      if (!hasData) {
        handleClose();
        return; // Nothing to update
      }

      // Create batch request structure with per-task data
      const batchRequest = {
        tasks: currentTaskIds.map(id => {
          const taskData = { ...updateData };

          // Add per-task artworkIds if available
          // Always send artworkIds when perTaskArtworkIds is set (even if empty for some tasks)
          // because we need to tell backend the final state of artworks
          if (perTaskArtworkIds) {
            const ids = perTaskArtworkIds[id] || [];
            // Always include the array - this tells backend what files to keep/set
            taskData.artworkIds = ids;
          }

          // Add per-task baseFileIds if available
          if (perTaskBaseFileIds) {
            taskData.baseFileIds = perTaskBaseFileIds[id] || [];
          }

          // Add per-task truck layout updates if available
          if (perTaskTruckUpdates && perTaskTruckUpdates[id]) {
            taskData.truck = perTaskTruckUpdates[id];
          }

          // Add artwork statuses for status changes
          if (artworkStatusesMap) {
            taskData.artworkStatuses = artworkStatusesMap;
          }

          return {
            id,
            data: taskData,
          };
        }),
      };

      // Check if we need to send as FormData (files present)
      const hasArtworkFilesToUpload = hasNewArtworkFiles && newArtworkFiles.length > 0;
      const hasBaseFilesToUpload = hasNewBaseFiles && newBaseFiles.length > 0;
      const hasLayoutPhotoFiles = layoutPhotoFiles && layoutPhotoFiles.length > 0;
      const needsFormData = hasArtworkFilesToUpload || hasBaseFilesToUpload || hasLayoutPhotoFiles;

      if (needsFormData) {
        const formData = new FormData();

        // Add the batch request structure as JSON string
        formData.append('tasks', JSON.stringify(batchRequest.tasks));

        // Add artwork files if present
        if (hasArtworkFilesToUpload) {
          newArtworkFiles.forEach((file) => {
            formData.append('artworks', file);
          });
        }

        // Add base files if present (same pattern as artworks)
        if (hasBaseFilesToUpload) {
          newBaseFiles.forEach((file) => {
            formData.append('baseFiles', file);
          });
        }

        // Add layout photo files if present
        // Backend expects: layoutPhotos.leftSide, layoutPhotos.rightSide, layoutPhotos.backSide
        if (hasLayoutPhotoFiles) {
          layoutPhotoFiles.forEach(({ side, file }) => {
            formData.append(`layoutPhotos.${side}`, file);
          });
        }

        // Get customer name from first task for file organization context
        const firstTask = currentTasks[0];
        const customerName = firstTask?.customer?.fantasyName || firstTask?.customer?.corporateName;

        // Add context for file organization
        if (customerName) {
          formData.append('_context', JSON.stringify({
            entityType: 'task',
            customerName: customerName,
          }));
        }

        await batchUpdateAsync(formData);
      } else {
        // Send as regular JSON (no files to upload)
        await batchUpdateAsync(batchRequest);
      }

      handleClose();
      onClearSelection();
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Bulk operation error:", error);
      }
      // Error toast is handled by the API client
    } finally {
      setIsSubmitting(false);
    }
  };

  const getModalTitle = () => {
    if (!operationType) return "";
    const titles: Record<BulkOperationType, string> = {
      arts: "Adicionar Artes",
      baseFiles: "Arquivos Base",
      paints: "Adicionar Tintas",
      cuttingPlans: "Adicionar Plano de Corte",
      layout: "Aplicar Layout",
      serviceOrder: "Ordem de Servico",
    };
    return titles[operationType];
  };

  const getModalIcon = () => {
    if (!operationType) return null;
    const icons: Record<BulkOperationType, React.ReactNode> = {
      arts: <IconPhoto className="h-5 w-5" />,
      baseFiles: <IconFileText className="h-5 w-5" />,
      paints: <IconPalette className="h-5 w-5" />,
      cuttingPlans: <IconCut className="h-5 w-5" />,
      layout: <IconLayout className="h-5 w-5" />,
      serviceOrder: <IconFileInvoice className="h-5 w-5" />,
    };
    return icons[operationType];
  };

  const renderOperationContent = () => {
    if (!operationType) return null;

    switch (operationType) {
      case "arts":
        return (
          <div className="space-y-4">
            <ArtworkFileUploadField
              onFilesChange={setArtworkFiles}
              onStatusChange={(fileId, status) => {
                setArtworkStatuses(prev => ({ ...prev, [fileId]: status }));
              }}
              maxFiles={10}
              disabled={isSubmitting}
              showPreview={true}
              existingFiles={artworkFiles}
              placeholder="Selecione artes para as tarefas"
              label="Artes"
            />
          </div>
        );

      case "baseFiles":
        return (
          <div className="space-y-4">
            <FileUploadField
              onFilesChange={setBaseFiles}
              maxFiles={10}
              disabled={isSubmitting}
              showPreview={true}
              existingFiles={baseFiles}
              variant="compact"
              placeholder="Selecione arquivos base para as tarefas"
              label="Arquivos Base"
            />
            <Alert>
              <AlertDescription>
                Arquivos base são usados como referência para criação das artes. Eles serão compartilhados entre todas as {currentTaskIds.length} tarefas selecionadas.
              </AlertDescription>
            </Alert>
          </div>
        );

      case "paints":
        return (
          <FormProvider {...form} key={currentTaskIds.join(',')}>
            <div className="space-y-4">
              <GeneralPaintingSelector
                control={form.control}
                disabled={isSubmitting}
                initialPaint={commonValues.generalPainting}
              />

              <Separator />

              <LogoPaintsSelector
                control={form.control}
                disabled={isSubmitting}
                initialPaints={commonValues.logoPaints}
              />
            </div>
          </FormProvider>
        );

      case "cuttingPlans":
        return (
          <FormProvider {...form} key={currentTaskIds.join(',')}>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Planos de Corte</Label>
                <Button
                  type="button"
                  onClick={() => {
                    if (multiCutSelectorRef.current) {
                      multiCutSelectorRef.current.addCut();
                    }
                  }}
                  disabled={isSubmitting || cutsCount >= 10}
                  size="sm"
                  className="gap-2"
                >
                  <IconPlus className="h-4 w-4" />
                  Adicionar Recorte ({cutsCount}/10)
                </Button>
              </div>

              <MultiCutSelector
                ref={multiCutSelectorRef}
                control={form.control}
                disabled={isSubmitting}
                onCutsCountChange={setCutsCount}
              />
            </div>
          </FormProvider>
        );

      case "layout":
        // Calculate total length for the current side
        const currentLayoutState = layoutStates[selectedLayoutSide];
        const totalLength = currentLayoutState?.layoutSections?.reduce(
          (sum: number, s: any) => sum + (s.width || 0), 0
        ) || 0;

        return (
          <div className="space-y-4">
            {/* Layout Side Selector with Total Length - exactly like task edit form */}
            <div className="flex flex-wrap justify-between items-center gap-3">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={selectedLayoutSide === "left" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedLayoutSide("left")}
                  disabled={isSubmitting}
                >
                  Motorista
                  {layoutStates.left?.layoutSections?.length > 0 && (
                    <Badge variant="success" className="ml-2">
                      Configurado
                    </Badge>
                  )}
                </Button>
                <Button
                  type="button"
                  variant={selectedLayoutSide === "right" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedLayoutSide("right")}
                  disabled={isSubmitting}
                >
                  Sapo
                  {layoutStates.right?.layoutSections?.length > 0 && (
                    <Badge variant="success" className="ml-2">
                      Configurado
                    </Badge>
                  )}
                </Button>
                <Button
                  type="button"
                  variant={selectedLayoutSide === "back" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedLayoutSide("back")}
                  disabled={isSubmitting}
                >
                  Traseira
                  {layoutStates.back?.layoutSections?.length > 0 && (
                    <Badge variant="success" className="ml-2">
                      Configurado
                    </Badge>
                  )}
                </Button>
              </div>

              {/* Total Length Display - exactly like task edit form */}
              <div className="px-3 py-1 bg-primary/10 rounded-md">
                <span className="text-sm text-muted-foreground">Comprimento Total: </span>
                <span className="text-sm font-semibold text-foreground">
                  {Math.round(totalLength * 100)}cm
                </span>
              </div>
            </div>

            {/* Visual Layout Editor - exactly like task edit form */}
            <LayoutForm
              selectedSide={selectedLayoutSide}
              layout={currentLayoutState}
              disabled={isSubmitting}
              onChange={(side, layoutData) => {
                setLayoutStates(prev => ({
                  ...prev,
                  [side]: layoutData,
                }));
              }}
            />

            {/* Info alert */}
            {(layoutStates.left?.layoutSections?.length > 0 ||
              layoutStates.right?.layoutSections?.length > 0 ||
              layoutStates.back?.layoutSections?.length > 0) && (
              <Alert className="mt-2">
                <IconLayout className="h-4 w-4" />
                <AlertDescription>
                  O layout configurado sera aplicado a todos os caminhoes das {currentTaskIds.length} tarefas selecionadas.
                </AlertDescription>
              </Alert>
            )}
          </div>
        );

      case "serviceOrder":
        return (
          <FormProvider {...form} key={`serviceOrder-${currentTaskIds.join(',')}`}>
            <div className="max-h-[60vh] overflow-y-auto">
              {/* Service Orders Selector - exactly like task edit form */}
              <ServiceSelectorAutoGrouped
                control={form.control}
                disabled={isSubmitting}
                currentUserId={user?.id}
                userPrivilege={user?.sector?.privileges}
                isTeamLeader={false}
              />
            </div>
          </FormProvider>
        );

      default:
        return null;
    }
  };

  const canSubmit = () => {
    if (!operationType || isSubmitting) return false;

    // Allow submit even with no changes (for clearing values)
    return true;
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className={`${operationType === "layout" || operationType === "serviceOrder" ? "sm:max-w-4xl" : "sm:max-w-2xl"} max-h-[85vh] flex flex-col`}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getModalIcon()}
            {getModalTitle()}
          </DialogTitle>
          <DialogDescription>
            Aplicando para {currentTaskIds.length} {currentTaskIds.length === 1 ? "tarefa" : "tarefas"}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="p-4">
            {isLoadingData ? (
              <div className="flex items-center justify-center py-12">
                <IconLoader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              renderOperationContent()
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit()}
          >
            {isSubmitting ? (
              <>
                <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                Aplicando...
              </>
            ) : (
              "Aplicar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

AdvancedBulkActionsHandler.displayName = "AdvancedBulkActionsHandler";