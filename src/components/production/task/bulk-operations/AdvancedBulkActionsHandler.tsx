import React, { useState, forwardRef, useImperativeHandle, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { FileUploadField, type FileWithPreview, FileSuggestions } from "@/components/common/file";
import { LayoutFileUploadField } from "../form/layout-file-upload-field";
import { GeneralPaintingSelector } from "../form/general-painting-selector";
import { LogoPaintsSelector } from "../form/logo-paints-selector";
import { MultiCutSelector, type MultiCutSelectorRef } from "../form/multi-cut-selector";
import { useTaskBatchMutations, taskKeys, serviceOrderKeys } from "../../../../hooks";
import { taskService } from "../../../../api-client/task";
import { fileService } from "../../../../api-client/file";
import { IconPhoto, IconFileText, IconPalette, IconCut, IconLoader2, IconPlus, IconFileInvoice, IconLayout } from "@tabler/icons-react";
import { CUT_TYPE, CUT_ORIGIN, SERVICE_ORDER_TYPE, SERVICE_ORDER_STATUS } from "../../../../constants";
import { serviceOrderService } from "../../../../api-client/serviceOrder";
import { ServiceSelectorAutoGrouped } from "../form/service-selector-auto-grouped";
import { useCurrentUser } from "../../../../hooks";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ImplementMeasureForm } from "@/components/production/implement-measure/implement-measure-form";
import type { Task } from "../../../../types";
import { toast } from "@/components/ui/sonner";

// Type definitions for the operations
type BulkOperationType = "arts" | "baseFiles" | "paints" | "cuttingPlans" | "layout" | "serviceOrder";

// Schema for form validation
const bulkOperationSchema = z.object({
  // For paints
  paintId: z.string().nullable().optional(),
  paintIds: z.array(z.string()).optional(),

  // For cuts - note: quantity is not stored on Cut entity, only used when creating
  cuts: z.array(z.object({
    type: z.nativeEnum(CUT_TYPE),
    quantity: z.number().min(1).optional(), // Only for new cuts being created
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
>(({ selectedTaskIds: _selectedTaskIds, onClearSelection }, ref) => {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [operationType, setOperationType] = useState<BulkOperationType | null>(null);
  const [currentTaskIds, setCurrentTaskIds] = useState<string[]>([]);
  const [currentTasks, setCurrentTasks] = useState<Task[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // States for file uploads (new files, like task form)
  const [layouts, setLayouts] = useState<FileWithPreview[]>([]);
  const [layoutStatuses, setLayoutStatuses] = useState<Record<string, 'DRAFT' | 'APPROVED' | 'REPROVED'>>({});
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
  const [_serviceOrderType, setServiceOrderType] = useState<SERVICE_ORDER_TYPE>(SERVICE_ORDER_TYPE.PRODUCTION);
  const [_serviceOrderDescription, setServiceOrderDescription] = useState<string>("");

  // State for common service orders (for batch editing existing ones)
  const [commonServiceOrders, setCommonServiceOrders] = useState<any[]>([]);
  // Track original service order IDs per task for computing updates
  const [_originalServiceOrdersMap, setOriginalServiceOrdersMap] = useState<Record<string, any[]>>({});
  // Map of _commonKey -> array of all service order IDs across all tasks (for batch updates)
  const [commonKeyToIdsMap, setCommonKeyToIdsMap] = useState<Record<string, string[]>>({});

  // States for tracking common values across selected tasks
  const [commonValues, setCommonValues] = useState<{
    paintId: string | null;
    generalPainting: any | null;
    paintIds: string[];
    logoPaints: any[];
    layouts: Array<{ id: string; name: string; originalName: string; size: number; type: string; lastModified: number; uploaded: boolean; uploadProgress: number; uploadedFileId: string; thumbnailUrl?: string | null }>;
    baseFiles: Array<{ id: string; name: string; originalName: string; size: number; type: string; lastModified: number; uploaded: boolean; uploadProgress: number; uploadedFileId: string }>;
    cuts: Array<any>;
    serviceOrders: Array<any>;
  }>({
    paintId: null,
    generalPainting: null,
    paintIds: [],
    logoPaints: [],
    layouts: [],
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

  const resetForm = (_type: BulkOperationType) => {
    // Reset all file states
    setLayouts([]);
    setLayoutStatuses({});
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
      layouts: [],
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
          // Chunk requests to avoid URL length limits when many tasks are selected
          const CHUNK_SIZE = 20;
          const chunks: string[][] = [];
          for (let i = 0; i < taskIds.length; i += CHUNK_SIZE) {
            chunks.push(taskIds.slice(i, i + CHUNK_SIZE));
          }
          // Paints are selected down to display fields only — `true` would pull every Paint scalar
          // incl. the base64 data-URL `colorPreview` and the `previewConfig` JSON for every paint of
          // every selected task. The selectors render id/name/hex/finish (+ paintType name + formula
          // count badge) and fall back to a hex/finish canvas preview, so the heavy columns aren't needed.
          const PAINT_DISPLAY_SELECT = {
            select: {
              id: true,
              name: true,
              hex: true,
              finish: true,
              paintType: { select: { id: true, name: true } },
              _count: { select: { formulas: true } },
            },
          };
          const include = {
            layouts: { include: { file: true } },
            baseFiles: true,
            cuts: { include: { file: true } },
            logoPaints: PAINT_DISPLAY_SELECT,
            generalPainting: PAINT_DISPLAY_SELECT,
            truck: {
              include: {
                leftSideMeasure: { include: { sections: true } },
                rightSideMeasure: { include: { sections: true } },
                backSideMeasure: { include: { sections: true } },
              },
            },
            serviceOrders: { include: { assignedTo: true } },
          };
          const chunkResponses = await Promise.all(
            chunks.map(chunk => taskService.getTasks({ where: { id: { in: chunk } }, include }))
          );
          const tasks = chunkResponses.flatMap(r => r.data || []);
          setCurrentTasks(tasks);

          // Compute common values across all tasks
          const computed = {
            paintId: null as string | null,
            generalPainting: null as any,
            paintIds: [] as string[],
            logoPaints: [] as any[],
            layouts: [] as Array<{ id: string; name: string; originalName: string; size: number; type: string; lastModified: number; uploaded: boolean; uploadProgress: number; uploadedFileId: string; thumbnailUrl?: string | null }>,
            baseFiles: [] as Array<{ id: string; name: string; originalName: string; size: number; type: string; lastModified: number; uploaded: boolean; uploadProgress: number; uploadedFileId: string }>,
            cuts: [] as Array<any>,
            serviceOrders: [] as Array<any>,
          };

          // Check if all tasks have the same general painting
          const firstTask = tasks[0];
          const firstPaintId = firstTask?.paintId;
          if (firstPaintId && tasks.every(t => t.paintId === firstPaintId)) {
            computed.paintId = firstPaintId;
            computed.generalPainting = firstTask?.generalPainting;
          }

          // Find logo paints that ALL tasks have in common
          const firstTaskForPaints = tasks[0];
          if (tasks.length > 0 && firstTaskForPaints?.logoPaints) {
            const firstTaskPaintIds = new Set(firstTaskForPaints.logoPaints.map(p => p.id));
            const commonPaintIds = Array.from(firstTaskPaintIds).filter(paintId =>
              tasks.every(task => task.logoPaints?.some(p => p.id === paintId))
            );
            computed.paintIds = commonPaintIds;
            // Also store the full paint objects
            computed.logoPaints = firstTaskForPaints.logoPaints.filter(p => commonPaintIds.includes(p.id));
          }

          // Find layouts that ALL tasks have in common (by filename, since each task may have different file IDs)
          // NOTE: task.layouts are now Layout entities with a nested file property
          // Layout entity: { id: layoutId, fileId, status, file?: { id, filename, originalName, thumbnailUrl, ... } }
          if (tasks.length > 0) {
            // Collect all unique filenames from all tasks
            const allFilenames = new Set<string>();
            tasks.forEach(task => {
              (task.layouts || []).forEach((artwork: any) => {
                // artwork.file contains the actual File data
                const file = artwork.file || artwork;
                const filename = file.originalName || file.filename;
                if (filename) allFilenames.add(filename);
              });
            });

            // Filter to only filenames that exist in ALL tasks
            const commonFilenames = Array.from(allFilenames).filter(filename =>
              tasks.every(task => (task.layouts || []).some((artwork: any) => {
                const file = artwork.file || artwork;
                return (file.originalName || file.filename) === filename;
              }))
            );

            // Find the first task that has layouts to use as reference
            const taskWithLayouts = tasks.find(t => t.layouts && t.layouts.length > 0);

            if (taskWithLayouts && taskWithLayouts.layouts && commonFilenames.length > 0) {
              // For each common filename, use the reference task's file data
              const commonLayouts = taskWithLayouts.layouts.filter((artwork: any) => {
                const file = artwork.file || artwork;
                return commonFilenames.includes(file.originalName || file.filename);
              });

              computed.layouts = commonLayouts.map((artwork: any) => {
                // Extract File data from Layout entity
                const file = artwork.file || artwork;
                const fileId = artwork.fileId || file.id;
                return {
                  id: fileId, // File ID (not Layout entity ID)
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
            if (taskWithBaseFiles && taskWithBaseFiles.baseFiles && commonBaseFileFilenames.length > 0) {
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

          // Find cuts that ALL tasks have with matching type, origin, and file
          // Note: Cut entities from API don't have 'quantity' field - it's only used when creating cuts
          const firstTaskForCuts = tasks[0];
          if (tasks.length > 0 && firstTaskForCuts?.cuts && firstTaskForCuts.cuts.length > 0) {
            // Check if all tasks have the same number of cuts
            const firstTaskCutsLength = firstTaskForCuts.cuts.length;
            if (tasks.every(task => task.cuts?.length === firstTaskCutsLength)) {
              // Map first task's cuts and check if all tasks have matching cuts
              const firstTaskCuts = firstTaskForCuts.cuts;
              const allCutsMatch = firstTaskCuts.every(firstCut => {
                return tasks.every(task => {
                  return task.cuts?.some(cut =>
                    cut.type === firstCut.type &&
                    cut.origin === firstCut.origin &&
                    cut.file?.originalName === firstCut.file?.originalName
                  );
                });
              });

              if (allCutsMatch) {
                computed.cuts = firstTaskCuts.map(cut => ({
                  type: cut.type,
                  // Don't include quantity since it's not on Cut entity from API
                  origin: cut.origin,
                  fileId: cut.fileId,
                  // Build a COMPLETE FileWithPreview (mirroring the layouts/baseFiles maps above) so the
                  // uploader shows the real name + size. Stripping to {id,originalName,url} was making the
                  // uploader render a "0 Bytes" nameless phantom that filled the maxFiles={1} slot.
                  file: cut.file
                    ? {
                        id: cut.file.id,
                        name: cut.file.filename || cut.file.originalName || 'cut-file',
                        originalName: cut.file.originalName,
                        size: cut.file.size || 0,
                        type: cut.file.mimetype || 'application/octet-stream',
                        lastModified: cut.file.createdAt ? new Date(cut.file.createdAt).getTime() : Date.now(),
                        uploaded: true,
                        uploadProgress: 100,
                        uploadedFileId: cut.file.id,
                        thumbnailUrl: cut.file.thumbnailUrl,
                      }
                    : undefined,
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
            const firstTaskForSO = tasks[0];
            const firstTaskServiceOrders = firstTaskForSO?.serviceOrders || [];
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
            setLayouts(computed.layouts as any);
            // Initialize artwork statuses from existing artwork data
            const initialStatuses: Record<string, 'DRAFT' | 'APPROVED' | 'REPROVED'> = {};
            computed.layouts.forEach((f: any) => {
              if (f.uploadedFileId) {
                initialStatuses[f.uploadedFileId] = f.status || 'DRAFT';
              }
            });
            setLayoutStatuses(initialStatuses);
          } else if (type === 'baseFiles') {
            setBaseFiles(computed.baseFiles as any);
          } else if (type === 'cuttingPlans') {
            // Cuts are handled by form.reset above
            setCutsCount(computed.cuts.length);
          } else if (type === 'layout') {
            // Pre-load existing layouts from the first task's truck
            // Since layouts are individual (each task has its own layout record),
            // we compare layout content (height + sections) to determine if all tasks
            // share the same measurements per side
            const tasksWithTrucks = tasks.filter((t: any) => t.truck);

            if (tasksWithTrucks.length > 0) {
              const convertLayoutToFormState = (layout: any) => {
                if (!layout || !layout.sections || layout.sections.length === 0) return null;
                return {
                  height: layout.height,
                  photoId: layout.photoId || null,
                  sections: layout.sections
                    .sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0))
                    .map((s: any) => ({
                      width: s.width,
                      isDoor: s.isDoor || false,
                      doorHeight: s.doorHeight,
                      position: s.position,
                    })),
                };
              };

              // Compare two layouts by their measurements (not by ID)
              const layoutsMatch = (a: any, b: any): boolean => {
                if (!a && !b) return true;
                if (!a || !b) return false;
                if (a.height !== b.height) return false;
                const aSections = a.sections || [];
                const bSections = b.sections || [];
                if (aSections.length !== bSections.length) return false;
                const aSorted = [...aSections].sort((x: any, y: any) => (x.position ?? 0) - (y.position ?? 0));
                const bSorted = [...bSections].sort((x: any, y: any) => (x.position ?? 0) - (y.position ?? 0));
                return aSorted.every((s: any, i: number) =>
                  s.width === bSorted[i].width && s.isDoor === bSorted[i].isDoor && s.doorHeight === bSorted[i].doorHeight
                );
              };

              const firstTaskWithTruck = tasksWithTrucks[0];
              if (firstTaskWithTruck?.truck) {
                const firstLeft = firstTaskWithTruck.truck.leftSideMeasure;
                const firstRight = firstTaskWithTruck.truck.rightSideMeasure;
                const firstBack = firstTaskWithTruck.truck.backSideMeasure;

                // Check if all tasks share the same layout content per side
                const allShareLeft = firstLeft && tasksWithTrucks.every(
                  (t: any) => layoutsMatch(t.truck?.leftSideMeasure, firstLeft)
                );
                const allShareRight = firstRight && tasksWithTrucks.every(
                  (t: any) => layoutsMatch(t.truck?.rightSideMeasure, firstRight)
                );
                const allShareBack = firstBack && tasksWithTrucks.every(
                  (t: any) => layoutsMatch(t.truck?.backSideMeasure, firstBack)
                );

                const preloadedLayouts = {
                  left: allShareLeft ? convertLayoutToFormState(firstLeft) : null,
                  right: allShareRight ? convertLayoutToFormState(firstRight) : null,
                  back: allShareBack ? convertLayoutToFormState(firstBack) : null,
                };

                setLayoutStates(preloadedLayouts);
              }
            }
          } else if (type === 'serviceOrder') {
            // Service orders are handled by form.reset above
            // The ServiceSelectorAutoGrouped component will use the form's serviceOrders field
          }
        } catch (error) {
          console.error("Error fetching tasks for bulk operations:", error);
          toast.error("Erro ao carregar tarefas", {
            description: error instanceof Error ? error.message : "Tente novamente.",
          });
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
    console.log('[BulkActions] handleSubmit called', { operationType, currentTaskIds, currentTasksCount: currentTasks.length, layoutStates });
    if (!operationType || currentTaskIds.length === 0) {
      if (currentTaskIds.length === 0) toast.error("Nenhuma tarefa selecionada");
      return;
    }

    setIsSubmitting(true);

    try {
      const updateData: any = {};
      // Declare file arrays at function scope so they're accessible later
      let newLayouts: File[] = [];
      let newBaseFiles: File[] = [];

      switch (operationType) {
        case "arts":
          // New files to upload via FormData
          newLayouts = layouts.filter(f => f instanceof File) as File[];

          // Determine which common layouts were explicitly REMOVED (user clicked X)
          const currentFilenames = layouts
            .filter(f => !(f instanceof File))
            .map((f: any) => f.originalName || f.name);
          const removedFileIds = commonValues.layouts
            .filter((f: any) => !currentFilenames.includes(f.originalName || f.name))
            .map((f: any) => f.uploadedFileId || f.id);

          const hasRemovals = removedFileIds.length > 0;

          // Detect suggestion files: already-uploaded files the user added from the
          // suggestion picker that are NOT part of the pre-loaded common layouts.
          const commonLayoutIds = new Set(
            commonValues.layouts.map((f: any) => f.uploadedFileId || f.id).filter(Boolean)
          );
          const addedSuggestionFileIds = layouts
            .filter(f => !(f instanceof File) && (f as any).uploaded && ((f as any).uploadedFileId || (f as any).id))
            .map((f: any) => f.uploadedFileId || f.id)
            .filter((id: string) => id && !commonLayoutIds.has(id));
          const hasAddedSuggestions = addedSuggestionFileIds.length > 0;

          // Send layoutIds (SET mode) when files were removed OR suggestions were added.
          // For pure new-file uploads (no removals, no suggestions), skip layoutIds so
          // the backend uses ADD mode and doesn't touch existing task-artwork connections.
          if (hasRemovals || hasAddedSuggestions) {
            const perTaskLayoutIds: Record<string, string[]> = {};
            currentTasks.forEach(task => {
              const keptIds: string[] = [];
              (task.layouts || []).forEach((artwork: any) => {
                // In flattened format from API: artwork.id = File ID, artwork.layoutId = Layout entity ID
                // artwork.fileId and artwork.file don't exist in flattened format
                const file = artwork.file || artwork;
                const layoutFileId = artwork.fileId || file.id;
                if (layoutFileId && !removedFileIds.includes(layoutFileId)) {
                  // Send File IDs so the backend conversion path applies layoutStatuses
                  keptIds.push(layoutFileId);
                }
              });
              // Append suggestion file IDs that aren't already on this task
              addedSuggestionFileIds.forEach((id: string) => {
                if (!keptIds.includes(id)) keptIds.push(id);
              });
              perTaskLayoutIds[task.id] = keptIds;
            });
            updateData._perTaskLayoutIds = perTaskLayoutIds;
          }

          if (newLayouts.length > 0) {
            updateData._hasNewLayouts = true;
          }

          // Artwork statuses must be split into the two channels the backend expects
          // (mirrors the single-task edit form):
          //  - layoutStatuses:    UUID-keyed map (File ID → status) for EXISTING / suggestion files.
          //  - newLayoutStatuses: array aligned to the uploaded `layouts` file order (new files).
          // New files carry a local non-UUID id (`${Date.now()}-${rand}` from LayoutFileUploadField),
          // so dumping their status into layoutStatuses makes the backend zod schema
          // (z.record(z.string().uuid(), ...)) reject the whole batch with 400 "Invalid uuid".
          const isLayoutFileUuid = (s: string) =>
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

          const existingLayoutStatuses: Record<string, 'DRAFT' | 'APPROVED' | 'REPROVED'> = {};
          Object.entries(layoutStatuses).forEach(([fileId, status]) => {
            if (isLayoutFileUuid(fileId)) existingLayoutStatuses[fileId] = status;
          });
          if (Object.keys(existingLayoutStatuses).length > 0) {
            updateData._layoutStatuses = existingLayoutStatuses;
          }

          // Statuses for brand-new uploads, in the same order they are appended to FormData
          // (newLayouts preserves `layouts` order, and FormData appends newLayouts in order).
          if (newLayouts.length > 0) {
            updateData._newLayoutStatuses = newLayouts.map(
              (f: any) => layoutStatuses[f.id] || f.status || 'DRAFT',
            );
          }
          break;

        case "baseFiles":
          // Get new base files that need to be uploaded (via FormData, like layouts)
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
          // Detect suggestion files: already-uploaded files added from the suggestion
          // picker that are NOT part of the pre-loaded common base files.
          const commonBaseFileIds = new Set(
            commonValues.baseFiles.map((f: any) => f.uploadedFileId || f.id).filter(Boolean)
          );
          const addedBaseFileSuggestionIds = baseFiles
            .filter(f => !(f instanceof File) && (f as any).uploaded && ((f as any).uploadedFileId || (f as any).id))
            .map((f: any) => f.uploadedFileId || f.id)
            .filter((id: string) => id && !commonBaseFileIds.has(id));

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

            // Append suggestion file IDs that aren't already on this task
            addedBaseFileSuggestionIds.forEach((id: string) => {
              if (!taskBaseFileIds.includes(id)) taskBaseFileIds.push(id);
            });

            perTaskBaseFileIds[task.id] = taskBaseFileIds;
          });

          // Store per-task data — also triggered when suggestion files were added
          if (newBaseFiles.length > 0 || commonBaseFilenames.length > 0 || addedBaseFileSuggestionIds.length > 0) {
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
                const uploadedFile = uploadResponse.data?.success?.[0];
                if (uploadResponse.success && uploadedFile) {
                  cutData.fileId = uploadedFile.id;
                }
              } else if (cut.file && (cut.file.id || cut.file.uploadedFileId)) {
                cutData.fileId = cut.file.id || cut.file.uploadedFileId;
              }

              // A cut with no file is a blank/default row — skip it (the backend ignores fileless
              // cuts too, but this avoids shipping empty entries).
              if (!cutData.fileId) continue;

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
          console.log('[BulkActions] layout case - layoutStates:', JSON.stringify({ left: layoutStates.left, right: layoutStates.right, back: layoutStates.back }));
          const hasAnyLayoutState =
            (layoutStates.left?.sections?.length && layoutStates.left.sections.length > 0) ||
            (layoutStates.right?.sections?.length && layoutStates.right.sections.length > 0) ||
            (layoutStates.back?.sections?.length && layoutStates.back.sections.length > 0);

          console.log('[BulkActions] hasAnyLayoutState:', hasAnyLayoutState, 'currentTasks:', currentTasks.length);
          if (hasAnyLayoutState) {
            // Build truck object with embedded layout data (following taskTruckCreateSchema)
            const truckWithLayouts: any = {};
            // Collect layout photo files for upload
            const layoutPhotoFiles: Array<{ side: string; file: File }> = [];

            // Left side layout data
            const leftLayout = layoutStates.left;
            if (leftLayout?.sections?.length && leftLayout.sections.length > 0) {
              truckWithLayouts.leftSideMeasure = {
                height: leftLayout.height,
                sections: leftLayout.sections.map((s: any, idx: number) => ({
                  width: s.width,
                  isDoor: s.isDoor || false,
                  // api implementMeasureSectionSchema.doorHeight is z.number().nullable() — it
                  // REJECTS undefined and would 400 the ENTIRE batch. Normalize to null.
                  doorHeight: s.isDoor ? (s.doorHeight ?? null) : null,
                  position: idx,
                })),
                photoId: leftLayout.photoId || null,
              };
              // Collect photo file if present
              if (leftLayout.photoFile instanceof File) {
                layoutPhotoFiles.push({ side: 'leftSide', file: leftLayout.photoFile });
              }
            }

            // Right side layout data
            const rightLayout = layoutStates.right;
            if (rightLayout?.sections?.length && rightLayout.sections.length > 0) {
              truckWithLayouts.rightSideMeasure = {
                height: rightLayout.height,
                sections: rightLayout.sections.map((s: any, idx: number) => ({
                  width: s.width,
                  isDoor: s.isDoor || false,
                  // api implementMeasureSectionSchema.doorHeight is z.number().nullable() — it
                  // REJECTS undefined and would 400 the ENTIRE batch. Normalize to null.
                  doorHeight: s.isDoor ? (s.doorHeight ?? null) : null,
                  position: idx,
                })),
                photoId: rightLayout.photoId || null,
              };
              // Collect photo file if present
              if (rightLayout.photoFile instanceof File) {
                layoutPhotoFiles.push({ side: 'rightSide', file: rightLayout.photoFile });
              }
            }

            // Back side layout data
            const backLayout = layoutStates.back;
            if (backLayout?.sections?.length && backLayout.sections.length > 0) {
              truckWithLayouts.backSideMeasure = {
                height: backLayout.height,
                sections: backLayout.sections.map((s: any, idx: number) => ({
                  width: s.width,
                  isDoor: s.isDoor || false,
                  // api implementMeasureSectionSchema.doorHeight is z.number().nullable() — it
                  // REJECTS undefined and would 400 the ENTIRE batch. Normalize to null.
                  doorHeight: s.isDoor ? (s.doorHeight ?? null) : null,
                  position: idx,
                })),
                photoId: backLayout.photoId || null,
              };
              // Collect photo file if present
              if (backLayout.photoFile instanceof File) {
                layoutPhotoFiles.push({ side: 'backSide', file: backLayout.photoFile });
              }
            }

            // Set truck data for ALL tasks - this will create truck if missing
            // or update existing truck with new layout data
            if (Object.keys(truckWithLayouts).length > 0) {
              const truckLayoutUpdates: Record<string, any> = {};

              currentTasks.forEach(task => {
                if (task.id) {
                  // Pass the same layout data to all tasks
                  // Backend will handle creating/updating trucks and layouts
                  truckLayoutUpdates[task.id] = truckWithLayouts;
                }
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

          currentFormServiceOrders.forEach((formSO: any, _index: number) => {
            // Try to get commonKey from form field first, then fallback to matching by ID
            let commonKey = formSO._commonKey;
            if (!commonKey && formSO.id) {
              commonKey = originalIdToCommonKey[formSO.id];
            }

            const allIds = commonKey ? commonKeyToIdsMap[commonKey] : undefined;
            const isCommonServiceOrder = commonKey && allIds;

            if (isCommonServiceOrder && commonKey && allIds) {
              // This is a common service order - update ALL matching ones across tasks
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
            if (!processedCommonKeys.has(commonKey) && ids) {
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
      const perTaskLayoutIds = updateData._perTaskLayoutIds;
      const perTaskBaseFileIds = updateData._perTaskBaseFileIds;
      const perTaskTruckUpdates = updateData._perTaskTruckUpdates;
      const hasNewLayouts = updateData._hasNewLayouts;
      const hasNewBaseFiles = updateData._hasNewBaseFiles;
      const layoutPhotoFiles = updateData._layoutPhotoFiles as Array<{ side: string; file: File }> | undefined;
      const layoutStatusesMap = updateData._layoutStatuses as Record<string, 'DRAFT' | 'APPROVED' | 'REPROVED'> | undefined;
      const newLayoutStatuses = updateData._newLayoutStatuses as ('DRAFT' | 'APPROVED' | 'REPROVED')[] | undefined;

      delete updateData._perTaskLayoutIds;
      delete updateData._perTaskBaseFileIds;
      delete updateData._perTaskTruckUpdates;
      delete updateData._hasNewLayouts;
      delete updateData._hasNewBaseFiles;
      delete updateData._layoutPhotoFiles;
      delete updateData._layoutStatuses;
      delete updateData._newLayoutStatuses;

      const hasPerTaskData = perTaskLayoutIds || perTaskBaseFileIds || perTaskTruckUpdates;
      const hasData = Object.keys(updateData).length > 0 || hasPerTaskData || layoutStatusesMap || hasNewLayouts;
      console.log('[BulkActions] hasPerTaskData:', hasPerTaskData, 'hasData:', hasData, 'updateData keys:', Object.keys(updateData), 'perTaskTruckUpdates:', perTaskTruckUpdates);

      if (!hasData) {
        toast.info("Nenhuma alteração para aplicar");
        handleClose();
        return;
      }

      // Create batch request structure with per-task data
      const batchRequest = {
        tasks: currentTaskIds.map(id => {
          const taskData = { ...updateData };

          // Add per-task layoutIds if available
          // Always send layoutIds when perTaskLayoutIds is set (even if empty for some tasks)
          // because we need to tell backend the final state of layouts
          if (perTaskLayoutIds) {
            const ids = perTaskLayoutIds[id];
            // Always include the array - this tells backend what files to keep/set
            taskData.layoutIds = ids || [];
          }

          // Add per-task baseFileIds if available and this task has explicit IDs set
          // Only send baseFileIds when the bulk action specifically targets base files
          // to prevent accidental clearing
          if (perTaskBaseFileIds && perTaskBaseFileIds[id] !== undefined) {
            taskData.baseFileIds = perTaskBaseFileIds[id];
          }

          // Add per-task truck layout updates if available
          const truckUpdate = perTaskTruckUpdates?.[id];
          if (perTaskTruckUpdates && truckUpdate) {
            taskData.truck = truckUpdate;
          }

          // Add artwork statuses for status changes
          if (layoutStatusesMap) {
            taskData.layoutStatuses = layoutStatusesMap;
          }

          // Statuses for new files being uploaded (array aligned to the uploaded `layouts` order)
          if (newLayoutStatuses) {
            taskData.newLayoutStatuses = newLayoutStatuses;
          }

          return {
            id,
            data: taskData,
          };
        }),
      };

      // Check if we need to send as FormData (files present)
      const hasLayoutsToUpload = hasNewLayouts && newLayouts.length > 0;
      const hasBaseFilesToUpload = hasNewBaseFiles && newBaseFiles.length > 0;
      const hasLayoutPhotoFiles = layoutPhotoFiles && layoutPhotoFiles.length > 0;
      const needsFormData = hasLayoutsToUpload || hasBaseFilesToUpload || hasLayoutPhotoFiles;
      console.log('[BulkActions] about to call batchUpdateAsync, needsFormData:', needsFormData, 'batchRequest tasks:', batchRequest.tasks.length, JSON.stringify(batchRequest.tasks[0]));

      if (needsFormData) {
        const formData = new FormData();

        // Add the batch request structure as JSON string
        formData.append('tasks', JSON.stringify(batchRequest.tasks));

        // Add artwork files if present
        if (hasLayoutsToUpload) {
          newLayouts.forEach((file) => {
            formData.append('layouts', file);
          });
        }

        // Add base files if present (same pattern as layouts)
        if (hasBaseFilesToUpload) {
          newBaseFiles.forEach((file) => {
            formData.append('baseFiles', file);
          });
        }

        // Add layout photo files if present
        // Backend expects: implementMeasurePhotos.leftSide, implementMeasurePhotos.rightSide, implementMeasurePhotos.backSide
        if (hasLayoutPhotoFiles) {
          layoutPhotoFiles.forEach(({ side, file }) => {
            formData.append(`implementMeasurePhotos.${side}`, file);
          });
        }

        // Get customer name from first task for file organization context
        const firstTaskForContext = currentTasks[0];
        const customerName = firstTaskForContext?.customer?.corporateName || firstTaskForContext?.customer?.fantasyName;

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
      console.error("Bulk operation error:", error);
      toast.error("Erro ao aplicar operação", {
        description: error instanceof Error ? error.message : "Erro desconhecido. Tente novamente.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getModalTitle = () => {
    if (!operationType) return "";
    const titles: Record<BulkOperationType, string> = {
      arts: "Adicionar Layouts",
      baseFiles: "Arquivos Base",
      paints: "Adicionar Tintas",
      cuttingPlans: "Adicionar Plano de Corte",
      layout: "Aplicar Medidas do Implemento",
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

  // Compute common customer ID for file suggestions (only if all tasks share the same customer)
  const commonCustomerId = currentTasks.length > 0 &&
    currentTasks.every(t => t.customerId === currentTasks[0].customerId)
    ? currentTasks[0].customerId ?? undefined
    : undefined;

  const renderOperationContent = () => {
    if (!operationType) return null;

    switch (operationType) {
      case "arts":
        return (
          <div className="space-y-4">
            <LayoutFileUploadField
              onFilesChange={setLayouts}
              onStatusChange={(fileId, status) => {
                setLayoutStatuses(prev => ({ ...prev, [fileId]: status }));
              }}
              maxFiles={10}
              disabled={isSubmitting}
              showPreview={true}
              existingFiles={layouts}
              placeholder="Selecione layouts para as tarefas"
              label="Layouts"
              variant="card"
            >
              <FileSuggestions
                customerId={commonCustomerId}
                fileContext="tasksLayouts"
                excludeFileIds={layouts.map(f => f.uploadedFileId || f.id).filter(Boolean)}
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
                  setLayouts(prev => [...prev, fileWithPreview]);
                }}
                disabled={isSubmitting}
              />
            </LayoutFileUploadField>
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
            >
              <FileSuggestions
                customerId={commonCustomerId}
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
                }}
                disabled={isSubmitting}
              />
            </FileUploadField>
            <Alert>
              <AlertDescription>
                Arquivos base são usados como referência para criação dos layouts. Eles serão compartilhados entre todas as {currentTaskIds.length} tarefas selecionadas.
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
              {/* MultiCutSelector renders its OWN "Planos de Corte" header + add button, so no wrapper
                  header here (a second one produced the duplicated "Planos de Corte / Adicionar Recorte"). */}
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
        const totalLength = currentLayoutState?.sections?.reduce(
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
                  {layoutStates.left?.sections?.length && layoutStates.left.sections.length > 0 && (
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
                  {layoutStates.right?.sections?.length > 0 && (
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
                  {layoutStates.back?.sections?.length > 0 && (
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
            <ImplementMeasureForm
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
            {(layoutStates.left?.sections?.length > 0 ||
              layoutStates.right?.sections?.length > 0 ||
              layoutStates.back?.sections?.length > 0) && (
              <Alert className="mt-2">
                <AlertDescription>
                  Os layouts configurados serão aplicados a todos os caminhões das {currentTaskIds.length} tarefas selecionadas.
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
    if (!operationType || isSubmitting || isLoadingData) return false;

    // Allow submit even with no changes (for clearing values)
    return true;
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className={`${operationType === "layout" || operationType === "serviceOrder" ? "sm:max-w-4xl" : operationType === "arts" ? "sm:max-w-5xl" : "sm:max-w-2xl"} max-h-[85vh] flex flex-col`}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getModalIcon()}
            {getModalTitle()}
          </DialogTitle>
          <DialogDescription>
            Aplicando para {currentTaskIds.length} {currentTaskIds.length === 1 ? "tarefa" : "tarefas"}
          </DialogDescription>
        </DialogHeader>

        {/* For the "arts" layout strip, force Radix's internal `display:table` viewport
            wrapper to `block` so it's bounded to the modal width — otherwise it grows to
            the strip's content width and the strip's own `overflow-x-auto` never scrolls. */}
        <ScrollArea className={`flex-1 min-h-0${operationType === "arts" ? " [&_[data-radix-scroll-area-viewport]>div]:!block" : ""}`}>
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