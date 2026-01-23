import React, { useState, forwardRef, useImperativeHandle, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { FileUploadField, type FileWithPreview } from "@/components/common/file";
import { GeneralPaintingSelector } from "../form/general-painting-selector";
import { LogoPaintsSelector } from "../form/logo-paints-selector";
import { MultiCutSelector, type MultiCutSelectorRef } from "../form/multi-cut-selector";
import { useTaskBatchMutations } from "../../../../hooks";
import { taskService } from "../../../../api-client/task";
import { fileService } from "../../../../api-client/file";
import { IconPhoto, IconFileText, IconPalette, IconCut, IconLoader2, IconAlertTriangle, IconPlus, IconFileInvoice, IconLayout } from "@tabler/icons-react";
import { CUT_TYPE, CUT_ORIGIN, SERVICE_ORDER_TYPE, SERVICE_ORDER_STATUS, SERVICE_ORDER_TYPE_LABELS } from "../../../../constants";
import { Textarea } from "@/components/ui/textarea";
import { serviceOrderService } from "../../../../api-client/serviceOrder";
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
  const [isOpen, setIsOpen] = useState(false);
  const [operationType, setOperationType] = useState<BulkOperationType | null>(null);
  const [currentTaskIds, setCurrentTaskIds] = useState<string[]>([]);
  const [currentTasks, setCurrentTasks] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // States for file uploads (new files, like task form)
  const [artworkFiles, setArtworkFiles] = useState<FileWithPreview[]>([]);
  const [baseFiles, setBaseFiles] = useState<FileWithPreview[]>([]);
  const [cutsCount, setCutsCount] = useState(0);

  // States for layout editing - visual editor like task edit form
  const [selectedLayoutSide, setSelectedLayoutSide] = useState<"left" | "right" | "back">("left");
  const [layoutStates, setLayoutStates] = useState<{
    left: any | null;
    right: any | null;
    back: any | null;
  }>({ left: null, right: null, back: null });

  // States for service order form
  const [serviceOrderType, setServiceOrderType] = useState<SERVICE_ORDER_TYPE>(SERVICE_ORDER_TYPE.PRODUCTION);
  const [serviceOrderDescription, setServiceOrderDescription] = useState<string>("");

  // States for tracking common values across selected tasks
  const [commonValues, setCommonValues] = useState<{
    paintId: string | null;
    generalPainting: any | null;
    paintIds: string[];
    logoPaints: any[];
    artworkFiles: Array<{ id: string; name: string; originalName: string; size: number; type: string; lastModified: number; uploaded: boolean; uploadProgress: number; uploadedFileId: string; thumbnailUrl?: string | null }>;
    baseFiles: Array<{ id: string; name: string; originalName: string; size: number; type: string; lastModified: number; uploaded: boolean; uploadProgress: number; uploadedFileId: string }>;
    cuts: Array<any>;
  }>({
    paintId: null,
    generalPainting: null,
    paintIds: [],
    logoPaints: [],
    artworkFiles: [],
    baseFiles: [],
    cuts: [],
  });

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
    },
  });

  const resetForm = (type: BulkOperationType) => {
    // Reset all file states
    setArtworkFiles([]);
    setBaseFiles([]);
    setCutsCount(0);

    // Reset layout states
    setSelectedLayoutSide("left");
    setLayoutStates({ left: null, right: null, back: null });

    // Reset service order states
    setServiceOrderType(SERVICE_ORDER_TYPE.PRODUCTION);
    setServiceOrderDescription("");

    // Reset common values
    setCommonValues({
      paintId: null,
      generalPainting: null,
      paintIds: [],
      logoPaints: [],
      artworkFiles: [],
      baseFiles: [],
      cuts: [],
    });

    // Reset form
    form.reset({
      paintId: null,
      paintIds: [],
      cuts: [],
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
              truck: true,
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

          setCommonValues(computed);

          // Pre-fill form with common values
          form.reset({
            paintId: computed.paintId,
            paintIds: computed.paintIds,
            cuts: computed.cuts,
          });

          // Pre-fill existing files for display
          if (type === 'arts') {
            setArtworkFiles(computed.artworkFiles as any);
          } else if (type === 'baseFiles') {
            setBaseFiles(computed.baseFiles as any);
          } else if (type === 'cuttingPlans') {
            // Cuts are handled by form.reset above
            setCutsCount(computed.cuts.length);
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

      switch (operationType) {
        case "arts":
          // Get new artwork files that need to be uploaded
          newArtworkFiles = artworkFiles.filter(f => f instanceof File) as File[];

          // Get filenames that should be kept (from existing files in artworkFiles state)
          // These are the COMMON artworks that the user chose to keep
          const keptCommonFilenames = artworkFiles
            .filter(f => !(f instanceof File))
            .map((f: any) => f.originalName || f.name);

          // Get filenames of COMMON artworks (files that were shown in the UI)
          // These were pre-populated from commonValues.artworkFiles
          const commonFilenames = commonValues.artworkFiles.map(
            (f: any) => f.originalName || f.name
          );

          // NOTE: We no longer upload files separately. Files will be sent WITH the batch update request.
          // The backend /tasks/batch endpoint now accepts FormData with both JSON data and files.

          // For each task, compute the final artworkIds:
          // 1. Keep ALL non-common artworks (unique to this task) - user couldn't remove them
          // 2. Keep common artworks only if user kept them in keptCommonFilenames
          // 3. New files will be uploaded via FormData and backend will add them automatically
          // NOTE: task.artworks are Artwork entities with { id, fileId, status, file?: File }
          const perTaskArtworkIds: Record<string, string[]> = {};
          currentTasks.forEach(task => {
            const taskArtworkFileIds: string[] = [];

            (task.artworks || []).forEach((artwork: any) => {
              const file = artwork.file || artwork;
              const filename = file.originalName || file.filename;
              const fileId = artwork.fileId || artwork.file?.id;

              if (!fileId) return;

              // Check if this is a common artwork (was shown in UI)
              const isCommon = commonFilenames.includes(filename);

              if (isCommon) {
                // Only keep if user kept it in the UI
                if (keptCommonFilenames.includes(filename)) {
                  taskArtworkFileIds.push(fileId);
                }
              } else {
                // Non-common artwork - always keep (user couldn't modify it)
                taskArtworkFileIds.push(fileId);
              }
            });

            // New artwork files will be appended by the backend when processing FormData
            perTaskArtworkIds[task.id] = taskArtworkFileIds;
          });

          // Store per-task data - we'll use this when building the batch request
          // Set if we have changes (new files to upload OR common artworks being managed)
          if (newArtworkFiles.length > 0 || commonFilenames.length > 0) {
            updateData._perTaskArtworkIds = perTaskArtworkIds;
            updateData._hasNewArtworkFiles = newArtworkFiles.length > 0;
          }
          break;

        case "baseFiles":
          // Get new base files that need to be uploaded
          const newBaseFiles = baseFiles.filter(f => f instanceof File) as File[];

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

          // Upload new base files FIRST to get their IDs
          let uploadedBaseFileIds: string[] = [];
          if (newBaseFiles.length > 0) {
            const uploadResponse = await fileService.uploadFiles(newBaseFiles, {
              fileContext: 'baseFile',
              entityType: 'task',
            });
            if (uploadResponse.success && uploadResponse.data?.successful) {
              uploadedBaseFileIds = uploadResponse.data.successful.map(f => f.id);
            }
          }

          // For each task, compute the final baseFileIds:
          // 1. Keep ALL non-common base files (unique to this task) - user couldn't remove them
          // 2. Keep common base files only if user kept them in keptBaseFileFilenames
          // 3. Add newly uploaded files to all tasks (shared)
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

            // Add newly uploaded files (shared across all tasks)
            taskBaseFileIds.push(...uploadedBaseFileIds);

            perTaskBaseFileIds[task.id] = taskBaseFileIds;
          });

          // Store per-task data
          if (newBaseFiles.length > 0 || commonBaseFilenames.length > 0) {
            updateData._perTaskBaseFileIds = perTaskBaseFileIds;
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

          // For cuts, we replace entirely - if different from common
          const cutsChanged = JSON.stringify(cuts) !== JSON.stringify(commonValues.cuts);

          if (cutsChanged) {
            if (cuts && cuts.length > 0) {
              // Upload cut files FIRST to get their IDs
              const cutsWithFileIds: any[] = [];

              for (const cut of cuts) {
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

                cutsWithFileIds.push(cutData);
              }

              updateData.cuts = cutsWithFileIds;
            } else {
              // All cuts removed
              const allCutIds = commonValues.cuts.map((c: any) => c.id).filter(Boolean);
              if (allCutIds.length > 0) {
                updateData.removeCutIds = allCutIds;
              }
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
          // Create a NEW service order for EACH selected task
          if (serviceOrderDescription.trim()) {
            const serviceOrdersToCreate = currentTaskIds.map(taskId => ({
              taskId,
              type: serviceOrderType,
              status: SERVICE_ORDER_STATUS.PENDING,
              description: serviceOrderDescription.trim(),
            }));

            // Use batch create to create all service orders at once
            await serviceOrderService.batchCreateServiceOrders({
              serviceOrders: serviceOrdersToCreate,
            });

            // Close and clear after successful creation
            handleClose();
            onClearSelection();
            return; // Exit early - no need for batch task update
          }
          break;
      }

      // Extract per-task data and internal flags
      const perTaskArtworkIds = updateData._perTaskArtworkIds;
      const perTaskBaseFileIds = updateData._perTaskBaseFileIds;
      const perTaskTruckUpdates = updateData._perTaskTruckUpdates;
      const hasNewArtworkFiles = updateData._hasNewArtworkFiles;
      const layoutPhotoFiles = updateData._layoutPhotoFiles as Array<{ side: string; file: File }> | undefined;

      delete updateData._perTaskArtworkIds;
      delete updateData._perTaskBaseFileIds;
      delete updateData._perTaskTruckUpdates;
      delete updateData._hasNewArtworkFiles;
      delete updateData._layoutPhotoFiles;

      const hasPerTaskData = perTaskArtworkIds || perTaskBaseFileIds || perTaskTruckUpdates;
      const hasData = Object.keys(updateData).length > 0 || hasPerTaskData;

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

          return {
            id,
            data: taskData,
          };
        }),
      };

      // Check if we need to send as FormData (files present)
      const hasArtworkFilesToUpload = hasNewArtworkFiles && newArtworkFiles.length > 0;
      const hasLayoutPhotoFiles = layoutPhotoFiles && layoutPhotoFiles.length > 0;
      const needsFormData = hasArtworkFilesToUpload || hasLayoutPhotoFiles;

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
            <FileUploadField
              onFilesChange={setArtworkFiles}
              maxFiles={10}
              disabled={isSubmitting}
              showPreview={true}
              existingFiles={artworkFiles}
              variant="compact"
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
                  {totalLength.toFixed(2).replace(".", ",")}m
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
          <div className="space-y-4">
            {/* Service Type Selector */}
            <div className="space-y-2">
              <Label>Tipo de Servico</Label>
              <Select
                value={serviceOrderType}
                onValueChange={(value) => setServiceOrderType(value as SERVICE_ORDER_TYPE)}
                disabled={isSubmitting}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(SERVICE_ORDER_TYPE).map((type) => (
                    <SelectItem key={type} value={type}>
                      {SERVICE_ORDER_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Description Field */}
            <div className="space-y-2">
              <Label>Descricao</Label>
              <Textarea
                value={serviceOrderDescription}
                onChange={(e) => setServiceOrderDescription(e.target.value)}
                placeholder="Descreva o servico a ser realizado..."
                disabled={isSubmitting}
                rows={4}
              />
            </div>

            {/* Info about creating separate service orders */}
            <Alert>
              <AlertDescription>
                Sera criada uma ordem de servico separada para cada tarefa selecionada ({currentTaskIds.length} {currentTaskIds.length === 1 ? "tarefa" : "tarefas"}).
              </AlertDescription>
            </Alert>
          </div>
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
      <DialogContent className={`${operationType === "layout" ? "sm:max-w-4xl" : "sm:max-w-2xl"} max-h-[85vh] flex flex-col`}>
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