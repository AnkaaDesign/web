import React, { useState, forwardRef, useImperativeHandle, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { FileUploadField, type FileWithPreview } from "@/components/common/file";
import { GeneralPaintingSelector } from "../form/general-painting-selector";
import { LogoPaintsSelector } from "../form/logo-paints-selector";
import { MultiCutSelector, type MultiCutSelectorRef } from "../form/multi-cut-selector";
import { useTaskBatchMutations } from "../../../../hooks";
import { taskService } from "../../../../api-client/task";
import { IconPhoto, IconFileText, IconPalette, IconCut, IconLoader2, IconAlertTriangle, IconPlus, IconFile, IconFileInvoice, IconReceipt } from "@tabler/icons-react";
import { CUT_TYPE, CUT_ORIGIN } from "../../../../constants";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

// Type definitions for the operations
type BulkOperationType = "arts" | "documents" | "paints" | "cuttingPlans";

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
  const [budgetFiles, setBudgetFiles] = useState<FileWithPreview[]>([]);
  const [invoiceFiles, setInvoiceFiles] = useState<FileWithPreview[]>([]);
  const [receiptFiles, setReceiptFiles] = useState<FileWithPreview[]>([]);
  const [cutsCount, setCutsCount] = useState(0);

  // States for tracking common values across selected tasks
  const [commonValues, setCommonValues] = useState<{
    paintId: string | null;
    generalPainting: any | null;
    paintIds: string[];
    logoPaints: any[];
    artworkFiles: Array<{ id: string; name: string; originalName: string; size: number; type: string; lastModified: number; uploaded: boolean; uploadProgress: number; uploadedFileId: string; thumbnailUrl?: string | null }>;
    budgetFiles: Array<{ id: string; name: string; originalName: string; size: number; type: string; lastModified: number; uploaded: boolean; uploadProgress: number; uploadedFileId: string }>;
    invoiceFiles: Array<{ id: string; name: string; originalName: string; size: number; type: string; lastModified: number; uploaded: boolean; uploadProgress: number; uploadedFileId: string }>;
    receiptFiles: Array<{ id: string; name: string; originalName: string; size: number; type: string; lastModified: number; uploaded: boolean; uploadProgress: number; uploadedFileId: string }>;
    cuts: Array<any>;
  }>({
    paintId: null,
    generalPainting: null,
    paintIds: [],
    logoPaints: [],
    artworkFiles: [],
    budgetFiles: [],
    invoiceFiles: [],
    receiptFiles: [],
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
    setBudgetFiles([]);
    setInvoiceFiles([]);
    setReceiptFiles([]);
    setCutsCount(0);

    // Reset common values
    setCommonValues({
      paintId: null,
      generalPainting: null,
      paintIds: [],
      logoPaints: [],
      artworkFiles: [],
      budgetFiles: [],
      invoiceFiles: [],
      receiptFiles: [],
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
              artworks: true,
              budgets: true,
              invoices: true,
              receipts: true,
              cuts: { include: { file: true } },
              logoPaints: true,
              generalPainting: true,
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
            budgetFiles: [] as Array<{ id: string; name: string; originalName: string; size: number; type: string; lastModified: number; uploaded: boolean; uploadProgress: number; uploadedFileId: string }>,
            invoiceFiles: [] as Array<{ id: string; name: string; originalName: string; size: number; type: string; lastModified: number; uploaded: boolean; uploadProgress: number; uploadedFileId: string }>,
            receiptFiles: [] as Array<{ id: string; name: string; originalName: string; size: number; type: string; lastModified: number; uploaded: boolean; uploadProgress: number; uploadedFileId: string }>,
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
          if (tasks.length > 0) {
            // Collect all unique filenames from all tasks
            const allFilenames = new Set<string>();
            tasks.forEach(task => {
              (task.artworks || []).forEach((a: any) => {
                const filename = a.originalName || a.filename;
                if (filename) allFilenames.add(filename);
              });
            });

            // Filter to only filenames that exist in ALL tasks
            const commonFilenames = Array.from(allFilenames).filter(filename =>
              tasks.every(task => (task.artworks || []).some((a: any) => (a.originalName || a.filename) === filename))
            );

            // Find the first task that has artworks to use as reference
            const taskWithArtworks = tasks.find(t => t.artworks && t.artworks.length > 0);

            if (taskWithArtworks && commonFilenames.length > 0) {
              // For each common filename, use the reference task's file data
              const commonArtworks = taskWithArtworks.artworks.filter((artwork: any) =>
                commonFilenames.includes(artwork.originalName || artwork.filename)
              );

              computed.artworkFiles = commonArtworks.map((a: any) => ({
                id: a.id,
                name: a.filename || a.originalName || 'artwork',
                originalName: a.originalName,
                size: a.size || 0,
                type: a.mimetype || 'application/octet-stream',
                lastModified: a.createdAt ? new Date(a.createdAt).getTime() : Date.now(),
                uploaded: true,
                uploadProgress: 100,
                uploadedFileId: a.id,
                thumbnailUrl: a.thumbnailUrl,
              }));
            }
          }

          // Find budgets that ALL tasks have in common (by filename)
          if (tasks.length > 0) {
            const allBudgetFilenames = new Set<string>();
            tasks.forEach(task => {
              (task.budgets || []).forEach((b: any) => {
                const filename = b.originalName || b.filename;
                if (filename) allBudgetFilenames.add(filename);
              });
            });

            const commonBudgetFilenames = Array.from(allBudgetFilenames).filter(filename =>
              tasks.every(task => (task.budgets || []).some((b: any) => (b.originalName || b.filename) === filename))
            );

            const taskWithBudgets = tasks.find(t => t.budgets && t.budgets.length > 0);
            if (taskWithBudgets && commonBudgetFilenames.length > 0) {
              const commonBudgets = taskWithBudgets.budgets.filter((b: any) =>
                commonBudgetFilenames.includes(b.originalName || b.filename)
              );
              computed.budgetFiles = commonBudgets.map((b: any) => ({
                id: b.id,
                name: b.filename || b.originalName || 'budget',
                originalName: b.originalName,
                size: b.size || 0,
                type: b.mimetype || 'application/octet-stream',
                lastModified: b.createdAt ? new Date(b.createdAt).getTime() : Date.now(),
                uploaded: true,
                uploadProgress: 100,
                uploadedFileId: b.id,
              }));
            }
          }

          // Find invoices that ALL tasks have in common (by filename)
          if (tasks.length > 0) {
            const allInvoiceFilenames = new Set<string>();
            tasks.forEach(task => {
              (task.invoices || []).forEach((i: any) => {
                const filename = i.originalName || i.filename;
                if (filename) allInvoiceFilenames.add(filename);
              });
            });

            const commonInvoiceFilenames = Array.from(allInvoiceFilenames).filter(filename =>
              tasks.every(task => (task.invoices || []).some((i: any) => (i.originalName || i.filename) === filename))
            );

            const taskWithInvoices = tasks.find(t => t.invoices && t.invoices.length > 0);
            if (taskWithInvoices && commonInvoiceFilenames.length > 0) {
              const commonInvoices = taskWithInvoices.invoices.filter((i: any) =>
                commonInvoiceFilenames.includes(i.originalName || i.filename)
              );
              computed.invoiceFiles = commonInvoices.map((i: any) => ({
                id: i.id,
                name: i.filename || i.originalName || 'invoice',
                originalName: i.originalName,
                size: i.size || 0,
                type: i.mimetype || 'application/octet-stream',
                lastModified: i.createdAt ? new Date(i.createdAt).getTime() : Date.now(),
                uploaded: true,
                uploadProgress: 100,
                uploadedFileId: i.id,
              }));
            }
          }

          // Find receipts that ALL tasks have in common (by filename)
          if (tasks.length > 0) {
            const allReceiptFilenames = new Set<string>();
            tasks.forEach(task => {
              (task.receipts || []).forEach((r: any) => {
                const filename = r.originalName || r.filename;
                if (filename) allReceiptFilenames.add(filename);
              });
            });

            const commonReceiptFilenames = Array.from(allReceiptFilenames).filter(filename =>
              tasks.every(task => (task.receipts || []).some((r: any) => (r.originalName || r.filename) === filename))
            );

            const taskWithReceipts = tasks.find(t => t.receipts && t.receipts.length > 0);
            if (taskWithReceipts && commonReceiptFilenames.length > 0) {
              const commonReceipts = taskWithReceipts.receipts.filter((r: any) =>
                commonReceiptFilenames.includes(r.originalName || r.filename)
              );
              computed.receiptFiles = commonReceipts.map((r: any) => ({
                id: r.id,
                name: r.filename || r.originalName || 'receipt',
                originalName: r.originalName,
                size: r.size || 0,
                type: r.mimetype || 'application/octet-stream',
                lastModified: r.createdAt ? new Date(r.createdAt).getTime() : Date.now(),
                uploaded: true,
                uploadProgress: 100,
                uploadedFileId: r.id,
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
          } else if (type === 'documents') {
            setBudgetFiles(computed.budgetFiles as any);
            setInvoiceFiles(computed.invoiceFiles as any);
            setReceiptFiles(computed.receiptFiles as any);
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
      const formData = new FormData();
      const updateData: any = {};

      switch (operationType) {
        case "arts":
          // Add new artwork files
          const newArtworkFiles = artworkFiles.filter(f => f instanceof File);
          newArtworkFiles.forEach((file) => {
            formData.append('artworks', file as File);
          });

          // Get filenames that should be kept (from existing files)
          const keptFilenames = artworkFiles
            .filter(f => !(f instanceof File))
            .map((f: any) => f.originalName || f.name);

          // For each task, find the artwork IDs that match the kept filenames
          // This handles the case where each task has different file IDs for the same artwork
          const perTaskArtworkIds: Record<string, string[]> = {};
          currentTasks.forEach(task => {
            const taskArtworkIds = (task.artworks || [])
              .filter((a: any) => keptFilenames.includes(a.originalName || a.filename))
              .map((a: any) => a.id);
            perTaskArtworkIds[task.id] = taskArtworkIds;
          });

          // Store per-task data - we'll use this when building the batch request
          updateData._perTaskArtworkIds = perTaskArtworkIds;
          break;

        case "documents":
          // Add new document files
          const newBudgets = budgetFiles.filter(f => f instanceof File);
          const newInvoices = invoiceFiles.filter(f => f instanceof File);
          const newReceipts = receiptFiles.filter(f => f instanceof File);

          newBudgets.forEach((file) => formData.append('budgets', file as File));
          newInvoices.forEach((file) => formData.append('invoices', file as File));
          newReceipts.forEach((file) => formData.append('receipts', file as File));

          // Get filenames that should be kept (from existing files)
          const keptBudgetFilenames = budgetFiles
            .filter(f => !(f instanceof File))
            .map((f: any) => f.originalName || f.name);
          const keptInvoiceFilenames = invoiceFiles
            .filter(f => !(f instanceof File))
            .map((f: any) => f.originalName || f.name);
          const keptReceiptFilenames = receiptFiles
            .filter(f => !(f instanceof File))
            .map((f: any) => f.originalName || f.name);

          // For each task, find the file IDs that match the kept filenames
          const perTaskBudgetIds: Record<string, string[]> = {};
          const perTaskInvoiceIds: Record<string, string[]> = {};
          const perTaskReceiptIds: Record<string, string[]> = {};

          currentTasks.forEach(task => {
            perTaskBudgetIds[task.id] = (task.budgets || [])
              .filter((b: any) => keptBudgetFilenames.includes(b.originalName || b.filename))
              .map((b: any) => b.id);
            perTaskInvoiceIds[task.id] = (task.invoices || [])
              .filter((i: any) => keptInvoiceFilenames.includes(i.originalName || i.filename))
              .map((i: any) => i.id);
            perTaskReceiptIds[task.id] = (task.receipts || [])
              .filter((r: any) => keptReceiptFilenames.includes(r.originalName || r.filename))
              .map((r: any) => r.id);
          });

          // Store per-task data
          updateData._perTaskBudgetIds = perTaskBudgetIds;
          updateData._perTaskInvoiceIds = perTaskInvoiceIds;
          updateData._perTaskReceiptIds = perTaskReceiptIds;
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
              const cutFiles: File[] = [];

              updateData.cuts = cuts.map((cut) => {
                const cutData: any = {
                  type: cut.type,
                  quantity: cut.quantity || 1,
                  origin: cut.origin || CUT_ORIGIN.PLAN,
                };

                if (cut.file && cut.file instanceof File) {
                  cutFiles.push(cut.file);
                  cutData._fileIndex = cutFiles.length - 1;
                } else if (cut.file && (cut.file.id || cut.file.uploadedFileId)) {
                  cutData.fileId = cut.file.id || cut.file.uploadedFileId;
                }

                return cutData;
              });

              cutFiles.forEach((file) => formData.append('cutFiles', file));
            } else {
              // All cuts removed
              const allCutIds = commonValues.cuts.map((c: any) => c.id).filter(Boolean);
              if (allCutIds.length > 0) {
                updateData.removeCutIds = allCutIds;
              }
            }
          }
          break;
      }

      // Check if we need to add data or just files
      const hasFiles = Array.from(formData.entries()).length > 0;

      // Extract per-task data
      const perTaskArtworkIds = updateData._perTaskArtworkIds;
      const perTaskBudgetIds = updateData._perTaskBudgetIds;
      const perTaskInvoiceIds = updateData._perTaskInvoiceIds;
      const perTaskReceiptIds = updateData._perTaskReceiptIds;

      delete updateData._perTaskArtworkIds;
      delete updateData._perTaskBudgetIds;
      delete updateData._perTaskInvoiceIds;
      delete updateData._perTaskReceiptIds;

      const hasPerTaskData = perTaskArtworkIds || perTaskBudgetIds || perTaskInvoiceIds || perTaskReceiptIds;
      const hasData = Object.keys(updateData).length > 0 || hasPerTaskData;

      if (!hasFiles && !hasData) {
        handleClose();
        return; // Nothing to update
      }

      // Create batch request structure with per-task data
      const batchRequest = {
        tasks: currentTaskIds.map(id => {
          const taskData = { ...updateData };

          // Add per-task artworkIds if available
          if (perTaskArtworkIds && perTaskArtworkIds[id]) {
            taskData.artworkIds = perTaskArtworkIds[id];
          }

          // Add per-task document IDs if available
          if (perTaskBudgetIds && perTaskBudgetIds[id]) {
            taskData.budgetIds = perTaskBudgetIds[id];
          }
          if (perTaskInvoiceIds && perTaskInvoiceIds[id]) {
            taskData.invoiceIds = perTaskInvoiceIds[id];
          }
          if (perTaskReceiptIds && perTaskReceiptIds[id]) {
            taskData.receiptIds = perTaskReceiptIds[id];
          }

          return {
            id,
            data: taskData,
          };
        }),
      };

      // If we have files, send as FormData, otherwise send as JSON
      if (hasFiles) {
        // Add batch request data to FormData
        // The ArrayFixPipe expects arrays to be serialized with numeric indices
        batchRequest.tasks.forEach((task, index) => {
          // Add task ID
          formData.append(`tasks[${index}][id]`, task.id);

          // Serialize the data object as JSON (even if empty)
          // The ArrayFixPipe will parse JSON strings automatically
          // Empty data is fine - backend will still process file uploads
          formData.append(`tasks[${index}][data]`, JSON.stringify(task.data || {}));
        });

        await batchUpdateAsync(formData as any);
      } else {
        // Send as regular JSON
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
      documents: "Adicionar Documentos",
      paints: "Adicionar Tintas",
      cuttingPlans: "Adicionar Plano de Corte",
    };
    return titles[operationType];
  };

  const getModalIcon = () => {
    if (!operationType) return null;
    const icons: Record<BulkOperationType, React.ReactNode> = {
      arts: <IconPhoto className="h-5 w-5" />,
      documents: <IconFileText className="h-5 w-5" />,
      paints: <IconPalette className="h-5 w-5" />,
      cuttingPlans: <IconCut className="h-5 w-5" />,
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

      case "documents":
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Budget File */}
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <IconFileInvoice className="h-4 w-4 text-muted-foreground" />
                  Orçamento
                </label>
                <FileUploadField
                  onFilesChange={setBudgetFiles}
                  maxFiles={5}
                  disabled={isSubmitting}
                  showPreview={false}
                  existingFiles={budgetFiles}
                  variant="compact"
                  placeholder="Orçamentos"
                  label=""
                />
              </div>

              {/* Invoice File */}
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <IconFile className="h-4 w-4 text-muted-foreground" />
                  Nota Fiscal
                </label>
                <FileUploadField
                  onFilesChange={setInvoiceFiles}
                  maxFiles={5}
                  disabled={isSubmitting}
                  showPreview={false}
                  existingFiles={invoiceFiles}
                  variant="compact"
                  placeholder="Notas Fiscais"
                  label=""
                />
              </div>

              {/* Receipt File */}
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <IconReceipt className="h-4 w-4 text-muted-foreground" />
                  Recibo
                </label>
                <FileUploadField
                  onFilesChange={setReceiptFiles}
                  maxFiles={5}
                  disabled={isSubmitting}
                  showPreview={false}
                  existingFiles={receiptFiles}
                  variant="compact"
                  placeholder="Recibos"
                  label=""
                />
              </div>
            </div>
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
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
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