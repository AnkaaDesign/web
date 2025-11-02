import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEditForm } from "../../../../hooks/useEditForm";
import {
  IconLoader2,
  IconArrowLeft,
  IconCheck,
  IconClipboardList,
  IconCalendar,
  IconPalette,
  IconFile,
  IconRuler,
  IconSparkles,
  IconScissors,
  IconPlus,
  IconCurrencyReal,
  IconReceipt,
  IconFileInvoice,
  IconFileText,
  IconHash,
  IconLicense,
  IconId,
  IconNotes,
  IconStatusChange,
} from "@tabler/icons-react";
import type { Task } from "../../../../types";
import { taskUpdateSchema, type TaskUpdateFormData } from "../../../../schemas";
import { useTaskMutations, useCutsByTask, useCutMutations } from "../../../../hooks";
import { cutService } from "../../../../api-client/cut";
import { TASK_STATUS, TASK_STATUS_LABELS, CUT_TYPE, CUT_ORIGIN, SECTOR_PRIVILEGES, COMMISSION_STATUS, COMMISSION_STATUS_LABELS } from "../../../../constants";
import { createFormDataWithContext } from "@/utils/form-data-helper";
import { useAuth } from "../../../../contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { SizeInput } from "@/components/ui/size-input";
import { Combobox } from "@/components/ui/combobox";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { CustomerSelector } from "./customer-selector";
import { SectorSelector } from "./sector-selector";
import { ServiceSelectorFixed } from "./service-selector";
import { BudgetSelector, type BudgetSelectorRef } from "./budget-selector";
import { MultiCutSelector, type MultiCutSelectorRef } from "./multi-cut-selector";
import { GeneralPaintingSelector } from "./general-painting-selector";
import { LogoPaintsSelector } from "./logo-paints-selector";
import { MultiAirbrushingSelector, type MultiAirbrushingSelectorRef } from "./multi-airbrushing-selector";
import { FileUploadField, type FileWithPreview } from "@/components/file";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { LayoutForm } from "@/components/production/layout/layout-form";
import { useLayoutsByTruck, useLayoutMutations } from "../../../../hooks";
import { FormMoneyInput } from "@/components/ui/form-money-input";

interface TaskEditFormProps {
  task: Task;
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

export const TaskEditForm = ({ task }: TaskEditFormProps) => {
  const { user } = useAuth();
  const { updateAsync } = useTaskMutations();
  const { createAsync: createCutAsync } = useCutMutations();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check if the current user is from the Financial, Warehouse, Designer, or Logistic sector
  const isFinancialUser = user?.sector?.privileges === SECTOR_PRIVILEGES.FINANCIAL;
  const isWarehouseUser = user?.sector?.privileges === SECTOR_PRIVILEGES.WAREHOUSE;
  const isDesignerUser = user?.sector?.privileges === SECTOR_PRIVILEGES.DESIGNER;
  const isLogisticUser = user?.sector?.privileges === SECTOR_PRIVILEGES.LOGISTIC;
  const isAdminUser = user?.sector?.privileges === SECTOR_PRIVILEGES.ADMIN;

  // Financial sections should only be visible to ADMIN and FINANCIAL users
  const canViewFinancialSections = isAdminUser || isFinancialUser;

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
  const [uploadedFiles, setUploadedFiles] = useState<FileWithPreview[]>(
    (task.artworks || []).map(file => ({
      id: file.id,
      name: file.filename || file.name || 'artwork',
      size: file.size || 0,
      type: file.mimetype || file.type || 'application/octet-stream',
      lastModified: file.createdAt ? new Date(file.createdAt).getTime() : Date.now(),
      uploaded: true,
      uploadProgress: 100,
      uploadedFileId: file.id,
      thumbnailUrl: file.thumbnailUrl,
    } as FileWithPreview))
  );
  const [uploadedFileIds, setUploadedFileIds] = useState<string[]>(task.artworks?.map((f) => f.id) || []);

  // Initialize document files from existing task data
  // Handle both singular and plural field names for backward compatibility
  const [budgetFile, setBudgetFile] = useState<FileWithPreview[]>(
    convertToFileWithPreview((task as any).budgets)
  );
  const [nfeFile, setNfeFile] = useState<FileWithPreview[]>(
    convertToFileWithPreview((task as any).invoices || task.nfe)
  );
  const [receiptFile, setReceiptFile] = useState<FileWithPreview[]>(
    convertToFileWithPreview((task as any).receipts || task.receipt)
  );

  const multiCutSelectorRef = useRef<MultiCutSelectorRef>(null);
  const [cutsCount, setCutsCount] = useState(0);
  const multiAirbrushingSelectorRef = useRef<MultiAirbrushingSelectorRef>(null);
  const [airbrushingsCount, setAirbrushingsCount] = useState(0);
  const budgetSelectorRef = useRef<BudgetSelectorRef>(null);
  const [budgetCount, setBudgetCount] = useState(0);
  const [selectedLayoutSide, setSelectedLayoutSide] = useState<"left" | "right" | "back">("left");
  const [isLayoutOpen, setIsLayoutOpen] = useState(false);
  const [hasLayoutChanges, setHasLayoutChanges] = useState(false);
  const [hasFileChanges, setHasFileChanges] = useState(false);
  const [isObservationOpen, setIsObservationOpen] = useState(!!task.observation?.description);
  const [layoutWidthError, setLayoutWidthError] = useState<string | null>(null);
  const [observationFiles, setObservationFiles] = useState<FileWithPreview[]>(
    convertToFileWithPreview(task.observation?.files)
  );

  // Get truck ID from task - assuming task has truck relation
  const truckId = task.truck?.id || task.truckId;
  const { data: layoutsData } = useLayoutsByTruck(truckId || "", !!truckId);

  // Debug logging for layouts
  useEffect(() => {
    console.log('[TaskEditForm] Layout data changed:', {
      truckId,
      hasLayoutsData: !!layoutsData,
      leftSideLayout: layoutsData?.leftSideLayout,
      rightSideLayout: layoutsData?.rightSideLayout,
      leftSections: layoutsData?.leftSideLayout?.layoutSections,
      rightSections: layoutsData?.rightSideLayout?.layoutSections,
    });
  }, [layoutsData, truckId]);
  const { createOrUpdateTruckLayout } = useLayoutMutations();

  // Check if any layout exists and open the section automatically
  useEffect(() => {
    if (layoutsData && (layoutsData.leftSideLayout || layoutsData.rightSideLayout || layoutsData.backSideLayout)) {
      setIsLayoutOpen(true);
    }
  }, [layoutsData]);

  // Real-time validation of layout width balance
  useEffect(() => {
    if (!layoutsData || !isLayoutOpen) {
      setLayoutWidthError(null);
      return;
    }

    const leftLayout = layoutsData.leftSideLayout;
    const rightLayout = layoutsData.rightSideLayout;
    const leftSections = leftLayout?.layoutSections;
    const rightSections = rightLayout?.layoutSections;

    // Only validate if both sides exist and have sections
    if (leftSections && leftSections.length > 0 && rightSections && rightSections.length > 0) {
      const leftTotalWidth = leftSections.reduce((sum: number, s: any) => sum + s.width, 0);
      const rightTotalWidth = rightSections.reduce((sum: number, s: any) => sum + s.width, 0);
      const widthDifference = Math.abs(leftTotalWidth - rightTotalWidth);
      const maxAllowedDifference = 0.04; // 4cm in meters

      if (widthDifference > maxAllowedDifference) {
        const errorMessage = `A largura total do lado Motorista (${leftTotalWidth.toFixed(2)}m) difere em mais de 4cm do lado Sapo (${rightTotalWidth.toFixed(2)}m). Diferença: ${(widthDifference * 100).toFixed(1)}cm. Ajuste as medidas para manter o equilíbrio.`;
        setLayoutWidthError(errorMessage);
      } else {
        setLayoutWidthError(null);
      }
    } else {
      // Clear error if one side doesn't have sections
      setLayoutWidthError(null);
    }
  }, [layoutsData, isLayoutOpen]);


  // Map task data to form values
  const mapDataToForm = useCallback((taskData: Task): TaskUpdateFormData => {
    console.log('[TaskEditForm] mapDataToForm called with task:', taskData);
    console.log('[TaskEditForm] Fetched cuts data:', cutsData);

    // Group cuts by fileId and type to get proper quantities
    // Use cutsData from separate query instead of taskData.cuts
    const cuts = cutsData?.data || [];
    const groupedCuts = (() => {
      if (cuts.length === 0) {
        console.log('[TaskEditForm] No cuts found in fetched data');
        return [];
      }

      console.log('[TaskEditForm] Processing', cuts.length, 'cuts from separate query');
      const cutMap = new Map<string, { fileId: string; type: string; quantity: number; file?: any }>();

      for (const cut of cuts) {
        const fileId = cut.file?.id || cut.fileId || "";
        const type = cut.type;
        const key = `${fileId || 'no-file'}|${type}`;

        if (cutMap.has(key)) {
          const existing = cutMap.get(key)!;
          existing.quantity += 1;
        } else {
          cutMap.set(key, {
            fileId: fileId || "",
            type,
            quantity: 1,
            file: cut.file ? convertToFileWithPreview(cut.file)[0] : undefined,
          });
        }
      }

      const grouped = Array.from(cutMap.values());
      console.log('[TaskEditForm] Grouped cuts:', grouped);
      return grouped;
    })();

    console.log('[TaskEditForm] Returning form data with cuts:', groupedCuts);

    return {
      name: taskData.name || "",
      status: taskData.status || TASK_STATUS.PENDING,
      serialNumber: taskData.serialNumber || null,
      chassisNumber: taskData.chassisNumber || null,
      plate: taskData.plate || null,
      details: taskData.details || null,
      entryDate: taskData.entryDate ? new Date(taskData.entryDate) : null,
      term: taskData.term ? new Date(taskData.term) : null,
      startedAt: taskData.startedAt ? new Date(taskData.startedAt) : null,
      finishedAt: taskData.finishedAt ? new Date(taskData.finishedAt) : null,
      customerId: taskData.customerId || null,
      sectorId: taskData.sectorId || null,
      paintId: taskData.paintId || null,
      budgetId: taskData.budgetId || null,
      budget: taskData.budget?.map((b) => ({
        referencia: b.referencia || "",
        valor: typeof b.valor === 'number' ? b.valor : (b.valor ? Number(b.valor) : 0),
      })) || [],
      nfeId: taskData.nfeId || null,
      receiptId: taskData.receiptId || null,
      services:
        taskData.services?.map((so) => ({
          description: so.description || "",
          status: so.status,
          statusOrder: so.statusOrder,
          startedAt: so.startedAt ? new Date(so.startedAt) : null,
          finishedAt: so.finishedAt ? new Date(so.finishedAt) : null,
        })) || [],
      artworkIds: taskData.artworks?.map((f) => f.id) || [],
      truck: {
        xPosition: taskData.truck?.xPosition || null,
        yPosition: taskData.truck?.yPosition || null,
        garageId: taskData.truck?.garageId || null,
      },
      cuts: groupedCuts,
      paintIds: taskData.logoPaints?.map((lp) => lp.id) || [],
      airbrushings:
        taskData.airbrushings?.map((a) => ({
          startDate: a.startDate ? new Date(a.startDate) : null,
          finishDate: a.finishDate ? new Date(a.finishDate) : null,
          price: a.price,
          status: a.status,
          receiptIds: a.receipts?.map((r) => r.id) || [],
          invoiceIds: a.invoices?.map((n) => n.id) || [],
          artworkIds: a.artworks?.map((art) => art.id) || [],
          receipts: a.receipts || [],
          invoices: a.invoices || [],
          artworks: a.artworks || [],
        })) || [],
      observation: taskData.observation ? {
        description: taskData.observation.description || "",
        fileIds: taskData.observation.files?.map((f: any) => f.id) || [],
      } : null,
    } as TaskUpdateFormData;
  }, [cutsData]); // Depend on cutsData to re-run when cuts are fetched

  // Handle form submission with only changed fields
  const handleFormSubmit = useCallback(
    async (changedData: Partial<TaskUpdateFormData>) => {
      try {
        setIsSubmitting(true);

        // DEBUG: Log what fields are in changedData
        console.log('[TaskEditForm] ========== FORM SUBMISSION ==========');
        console.log('[TaskEditForm] Task ID:', task.id);
        console.log('[TaskEditForm] changedData keys:', Object.keys(changedData));
        console.log('[TaskEditForm] changedData:', JSON.stringify(changedData, null, 2).substring(0, 500));
        console.log('[TaskEditForm] hasLayoutChanges:', hasLayoutChanges);
        console.log('[TaskEditForm] hasFileChanges:', hasFileChanges);

        // Check if there are cuts to create (counts as changes)
        const cuts = form.getValues('cuts') as any[] || [];
        const hasCutsToCreate = cuts.length > 0 && cuts.some((cut) => cut.file && cut.file instanceof File);
        console.log('[TaskEditForm] hasCutsToCreate:', hasCutsToCreate, 'cuts:', cuts.length);

        // Validate that we have changes (form, layout, file changes, or cuts to create)
        if (Object.keys(changedData).length === 0 && !hasLayoutChanges && !hasFileChanges && !hasCutsToCreate) {
          console.log('[TaskEditForm] ❌ NO CHANGES DETECTED - aborting submission');
          toast.info("Nenhuma alteração detectada");
          return;
        }

        console.log('[TaskEditForm] ✅ CHANGES DETECTED - proceeding with submission');

        // Validate that all cuts have files attached
        console.log('[TaskEditForm] ========== VALIDATING CUTS BEFORE SUBMISSION ==========');
        console.log('[TaskEditForm] Total cuts:', cuts.length);
        console.log('[TaskEditForm] Cuts validation data:', cuts.map((cut, index) => ({
          index: index + 1,
          type: cut.type,
          hasFile: !!cut.file,
          hasFileId: !!cut.fileId,
          fileName: cut.file?.name,
          fileIsInstance: cut.file instanceof File,
        })));

        if (cuts.length > 0 && cuts.some((cut) => !cut.file && !cut.fileId)) {
          console.error('[TaskEditForm] ❌ VALIDATION FAILED: Some cuts missing files');
          toast.error("Alguns cortes não possuem arquivos anexados. Adicione os arquivos antes de enviar o formulário.");
          return;
        }

        if (cuts.length > 0) {
          console.log('[TaskEditForm] ✅ All cuts have files - validation passed');
        }

        // Validate that all budgets are complete
        const budgets = form.getValues('budget') as any[] || [];
        if (budgets.length > 0 && budgets.some((budget) => {
          const hasRef = budget.referencia && budget.referencia.trim() !== "";
          const hasVal = budget.valor !== null && budget.valor !== undefined && budget.valor !== 0;
          return !hasRef || !hasVal;
        })) {
          toast.error("Alguns orçamentos estão incompletos. Preencha a referência e o valor antes de enviar o formulário.");
          return;
        }

        // Check if there's a layout width error
        if (layoutWidthError) {
          toast.error("Corrija os erros de layout antes de enviar o formulário.");
          return;
        }

        // Validate observation is complete if section is open
        if (isObservationOpen) {
          console.log('[Submit] ========== OBSERVATION VALIDATION ==========');
          console.log('[Submit] isObservationOpen:', isObservationOpen);
          const observation = form.getValues('observation');
          console.log('[Submit] Observation from form:', observation);
          console.log('[Submit] observationFiles state:', observationFiles.length, observationFiles.map(f => ({ name: f.name, id: f.id, uploadedFileId: f.uploadedFileId, uploaded: f.uploaded })));
          const hasDescription = observation?.description && observation.description.trim() !== "";
          console.log('[Submit] hasDescription:', hasDescription, 'description:', observation?.description);
          const hasFiles = (observation?.fileIds && observation.fileIds.length > 0) || observationFiles.length > 0;
          console.log('[Submit] hasFiles:', hasFiles, 'fileIds:', observation?.fileIds, 'observationFiles.length:', observationFiles.length);

          if (!hasDescription) {
            console.log('[Submit] ❌ Validation failed: Missing description');
            toast.error("A observação está incompleta. Preencha a descrição antes de enviar o formulário.");
            return;
          }

          if (!hasFiles) {
            console.log('[Submit] ❌ Validation failed: Missing files');
            toast.error("A observação está incompleta. Adicione pelo menos um arquivo antes de enviar o formulário.");
            return;
          }

          console.log('[Submit] ✅ Observation validation passed');
        }

        console.log('[Submit] ========== CHANGED DATA ==========');
        console.log('[Submit] changedData keys:', Object.keys(changedData));
        console.log('[Submit] changedData.observation:', changedData.observation);

        // If only layout changes exist (no form or file changes), just reload the page
        if (Object.keys(changedData).length === 0 && hasLayoutChanges && !hasFileChanges && !hasCutsToCreate) {
          console.log('[TaskEditForm] Only layout changes - reloading page');
          setHasLayoutChanges(false);
          window.location.href = `/producao/cronograma/detalhes/${task.id}`;
          return;
        }

        // If only cuts exist (no other changes), we still need to update the task to trigger cut creation
        if (Object.keys(changedData).length === 0 && !hasLayoutChanges && !hasFileChanges && hasCutsToCreate) {
          console.log('[TaskEditForm] Only cuts to create - adding marker field to changedData');
          changedData._onlyCuts = true; // Marker field to prevent empty body
        }

        // Check if we have new files that need to be uploaded
        console.log('[Submit] ========== FILE CHECK ==========');
        const newBudgetFiles = budgetFile.filter(f => !f.uploaded);
        const newNnvoiceFiles = nfeFile.filter(f => !f.uploaded);
        const newReceiptFiles = receiptFile.filter(f => !f.uploaded);
        const newArtworkFiles = uploadedFiles.filter(f => !f.uploaded);
        const newObservationFiles = observationFiles.filter(f => !f.uploaded);
        console.log('[Submit] newObservationFiles:', newObservationFiles.length, newObservationFiles.map(f => ({ name: f.name, uploaded: f.uploaded })));

        // Check for cut files
        const changedCuts = changedData.cuts as any[] || [];
        const hasCutFiles = changedCuts.some(cut => cut.file && cut.file instanceof File);

        // Check for airbrushing files
        const airbrushings = changedData.airbrushings as any[] || [];
        const hasAirbrushingFiles = airbrushings.some(a =>
          (a.receiptFiles && a.receiptFiles.some((f: any) => f instanceof File)) ||
          (a.nfeFiles && a.nfeFiles.some((f: any) => f instanceof File)) ||
          (a.artworkFiles && a.artworkFiles.some((f: any) => f instanceof File))
        );

        const hasNewFiles = newBudgetFiles.length > 0 || newNnvoiceFiles.length > 0 ||
                           newReceiptFiles.length > 0 || newArtworkFiles.length > 0 ||
                           hasCutFiles || hasAirbrushingFiles || newObservationFiles.length > 0;
        console.log('[Submit] hasNewFiles:', hasNewFiles, 'newObservationFiles:', newObservationFiles.length);

        let result;

        if (hasNewFiles) {
          // Get customer data for file organization context
          const customer = task.customer;

          // Prepare files object for the helper
          const files: Record<string, File[]> = {};

          if (newBudgetFiles.length > 0) {
            files.budgets = newBudgetFiles.filter(f => f instanceof File) as File[];
          }
          if (newNnvoiceFiles.length > 0) {
            files.invoices = newNnvoiceFiles.filter(f => f instanceof File) as File[];
          }
          if (newReceiptFiles.length > 0) {
            files.receipts = newReceiptFiles.filter(f => f instanceof File) as File[];
          }
          if (newArtworkFiles.length > 0) {
            files.artworks = newArtworkFiles.filter(f => f instanceof File) as File[];
          }
          if (newObservationFiles.length > 0) {
            console.log('[Submit] Adding observation files to FormData:', newObservationFiles.length);
            files.observationFiles = newObservationFiles.filter(f => f instanceof File) as File[];
            console.log('[Submit] observationFiles files:', files.observationFiles.length);
          }

          // DON'T send cuts with task update - they'll be created separately
          // Remove cuts from changedData to avoid sending them with the task
          if (changedData.cuts) {
            console.log('[TaskEditForm] Removing cuts from task update - will create separately');
            delete changedData.cuts;
          }

          // Handle airbrushing files if airbrushings were changed
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
              if (airbrushing.nfeFiles && Array.isArray(airbrushing.nfeFiles)) {
                const airbrushingInvoices = airbrushing.nfeFiles.filter((f: any) => f instanceof File);
                if (airbrushingInvoices.length > 0) {
                  files[`airbrushings[${index}].invoices`] = airbrushingInvoices;
                }
                // Remove file objects from airbrushing data to avoid sending them in JSON body
                delete airbrushing.nfeFiles;
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
          // NOTE: 'airbrushings' are NOT excluded - they can be sent with task
          const excludedFields = new Set([
            'cuts',
            'services',
            'paintIds',
            'artworkIds',
            'budgetIds',
            'invoiceIds',
            'receiptIds',
            'reimbursementIds',
            'reimbursementInvoiceIds'
          ]);

          console.log('[TaskEditForm] ========== PREPARING FORMDATA ==========');
          console.log('[TaskEditForm] Excluded fields:', Array.from(excludedFields));

          // Prepare data object with only changed fields (excluding large arrays unless they changed)
          const dataForFormData: Record<string, any> = {};
          let fieldCount = 0;
          let excludedCount = 0;
          Object.entries(changedData).forEach(([key, value]) => {
            // Skip excluded fields (large arrays) - they should only be sent if explicitly updated
            if (excludedFields.has(key)) {
              console.log(`[TaskEditForm] ⏭️  Excluding field from FormData: ${key} (will be handled separately)`);
              excludedCount++;
              return;
            }

            if (value !== null && value !== undefined) {
              dataForFormData[key] = value;
              fieldCount++;
            }
          });

          // Log summary
          console.log('[TaskEditForm] FormData field processing:', {
            totalChangedFields: Object.keys(changedData).length,
            excludedFields: excludedCount,
            includedFields: fieldCount,
            fileTypes: Object.keys(files).length
          });

          // CRITICAL: If no form fields were added but we have files, add a marker field
          // This prevents the body from being undefined, which causes multer to hang
          if (fieldCount === 0) {
            dataForFormData._hasFiles = true;
            console.log('[TaskEditForm] No changed fields - added marker field to prevent empty body');
          }

          console.log('[TaskEditForm] FormData prepared with', fieldCount, 'changed fields and', Object.keys(files).length, 'file types');

          // Send the IDs of files to KEEP (backend uses 'set' to replace all files)
          // Extract IDs of uploaded (existing) files
          const currentArtworkIds = uploadedFiles.filter(f => f.uploaded).map(f => f.uploadedFileId || f.id).filter(Boolean) as string[];
          const currentBudgetIds = budgetFile.filter(f => f.uploaded).map(f => f.uploadedFileId || f.id).filter(Boolean) as string[];
          const currentInvoiceIds = nfeFile.filter(f => f.uploaded).map(f => f.uploadedFileId || f.id).filter(Boolean) as string[];
          const currentReceiptIds = receiptFile.filter(f => f.uploaded).map(f => f.uploadedFileId || f.id).filter(Boolean) as string[];

          // Always send file IDs arrays when any file operation occurs
          // Backend will replace all files with these IDs + newly uploaded files
          dataForFormData.artworkIds = currentArtworkIds;
          dataForFormData.budgetIds = currentBudgetIds;
          dataForFormData.invoiceIds = currentInvoiceIds;
          dataForFormData.receiptIds = currentReceiptIds;

          console.log('[TaskEditForm] Setting file IDs to keep:', {
            artworks: currentArtworkIds.length,
            budgets: currentBudgetIds.length,
            invoices: currentInvoiceIds.length,
            receipts: currentReceiptIds.length,
          });

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

          result = await updateAsync({
            id: task.id,
            data: formData as any,
            query: {
              include: {
                budgets: true,
                invoices: true,
                receipts: true,
                artworks: true,
              },
            },
          });
        } else {
          // Use regular JSON when no files are present
          const submitData = { ...changedData };

          // Even if no new files, check for deleted files
          // Send the IDs of files to KEEP (backend uses 'set' to replace all files)
          // Extract IDs of uploaded (existing) files
          const currentArtworkIds = uploadedFiles.filter(f => f.uploaded).map(f => f.uploadedFileId || f.id).filter(Boolean) as string[];
          const currentBudgetIds = budgetFile.filter(f => f.uploaded).map(f => f.uploadedFileId || f.id).filter(Boolean) as string[];
          const currentInvoiceIds = nfeFile.filter(f => f.uploaded).map(f => f.uploadedFileId || f.id).filter(Boolean) as string[];
          const currentReceiptIds = receiptFile.filter(f => f.uploaded).map(f => f.uploadedFileId || f.id).filter(Boolean) as string[];

          // Always send file IDs arrays when any file operation occurs
          // Backend will replace all files with these IDs
          submitData.artworkIds = currentArtworkIds;
          submitData.budgetIds = currentBudgetIds;
          submitData.invoiceIds = currentInvoiceIds;
          submitData.receiptIds = currentReceiptIds;

          console.log('[TaskEditForm] Setting file IDs to keep (JSON):', {
            artworks: currentArtworkIds.length,
            budgets: currentBudgetIds.length,
            invoices: currentInvoiceIds.length,
            receipts: currentReceiptIds.length,
          });

          console.log('[TaskEditForm] Using JSON submission (no files)');
          console.log('[TaskEditForm] submitData keys:', Object.keys(submitData));
          console.log('[TaskEditForm] submitData:', JSON.stringify(submitData, null, 2).substring(0, 500));

          result = await updateAsync({
            id: task.id,
            data: submitData,
            query: {
              include: {
                budgets: true,
                invoices: true,
                receipts: true,
                artworks: true,
              },
            },
          });
        }

        if (result.success) {
          console.log('[TaskEditForm] ========== TASK UPDATE SUCCESSFUL ==========');
          console.log('[TaskEditForm] Task update result:', result);

          setHasLayoutChanges(false);
          setHasFileChanges(false);

          // Create cuts separately via POST /cuts with FormData
          console.log('[TaskEditForm] ========== CREATING CUTS SEPARATELY ==========');
          const cuts = form.getValues('cuts') as any[] || [];
          console.log('[TaskEditForm] Cuts to create:', cuts.length);
          console.log('[TaskEditForm] Cuts data:', cuts.map((c, i) => ({
            index: i,
            type: c?.type,
            hasFile: !!c?.file,
            fileType: typeof c?.file,
            fileName: c?.file?.name,
            fileConstructor: c?.file?.constructor?.name,
            isFileInstance: c?.file instanceof File,
          })));

          if (cuts.length > 0) {
            const cutCreationPromises = cuts.map(async (cut, index) => {
              console.log(`[TaskEditForm] Cut ${index}: checking...`, {
                hasFile: !!cut.file,
                fileType: typeof cut.file,
                fileName: cut.file?.name,
                isFileInstance: cut.file instanceof File,
              });

              // Only create cuts with new files
              if (!cut.file || !(cut.file instanceof File)) {
                console.log(`[TaskEditForm] Cut ${index}: skipping (no new file)`);
                return { success: false, skipped: true, index };
              }

              try {
                console.log(`[TaskEditForm] Cut ${index}: creating with file ${cut.file.name}, quantity: ${cut.quantity || 1}`);

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
                  customerName: task.customer?.fantasyName || task.customer?.corporateName || 'Sem-Nome',
                  cutType: cut.type, // Send the actual enum value: 'VINYL' or 'STENCIL'
                };
                formData.append('_context', JSON.stringify(context));

                // Log FormData contents
                console.log(`[TaskEditForm] Cut ${index}: FormData entries:`);
                for (const [key, value] of (formData as any).entries()) {
                  console.log(`  ${key}:`, value instanceof File ? `[File: ${value.name}]` : value);
                }

                console.log(`[TaskEditForm] Cut ${index}: sending FormData to POST /cuts`);
                console.log(`[TaskEditForm] Cut ${index}: FormData type:`, formData.constructor.name);
                console.log(`[TaskEditForm] Cut ${index}: FormData instanceof FormData:`, formData instanceof FormData);

                // Call the cut service directly, bypassing the mutation hooks
                // The hooks wrap FormData in a way that loses the actual data
                const result = await cutService.createCut(formData as any);

                const createdCount = cut.quantity || 1;
                console.log(`[TaskEditForm] Cut ${index}: ✅ created ${createdCount} cut(s) successfully`);
                return { success: true, index, result, createdCount };
              } catch (error: any) {
                console.error(`[TaskEditForm] Cut ${index}: ❌ creation failed:`, error);
                const failedCount = cut.quantity || 1;
                return { success: false, index, error: error?.message, failedCount };
              }
            });

            const results = await Promise.all(cutCreationPromises);
            const totalCreated = results
              .filter(r => r.success)
              .reduce((sum, r) => sum + (r.createdCount || 1), 0);
            const totalFailed = results
              .filter(r => !r.success && !r.skipped)
              .reduce((sum, r) => sum + (r.failedCount || 1), 0);

            console.log(`[TaskEditForm] Cut creation summary: ${totalCreated} created, ${totalFailed} failed`);
          }

          // Navigate to the task detail page
          console.log('[TaskEditForm] ========== NAVIGATING TO TASK DETAILS ==========');
          window.location.href = `/producao/cronograma/detalhes/${task.id}`;
        }
      } catch (error) {
        console.error("🔴 Error updating task:", error);
      } finally {
        setIsSubmitting(false);
      }
    },
    [updateAsync, task.id, hasLayoutChanges, hasFileChanges, budgetFile, nfeFile, receiptFile, uploadedFiles, observationFiles, isObservationOpen, layoutWidthError]
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
    fieldsToOmitIfUnchanged: [
      "cuts",
      "services",
      "paintIds",
      "artworkIds",
      "budgetIds",
      "invoiceIds",
      "receiptIds",
      "reimbursementIds",
      "reimbursementInvoiceIds",
    ],
  });

  // Debug: Log form values after initialization
  useEffect(() => {
    console.log('[TaskEditForm] Form initialized. Cuts value:', form.getValues('cuts'));
  }, []);

  // Debug: Watch cuts field
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === 'cuts') {
        console.log('[TaskEditForm] Cuts field changed to:', value.cuts);
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  // Helper to update file in list
  const updateFileInList = (files: FileWithPreview[], fileId: string, updates: Partial<FileWithPreview>) => {
    return files.map((f) => {
      if (f.id === fileId) {
        // Use Object.assign to preserve the File object prototype and properties
        // This keeps all native File properties (size, name, type, lastModified, etc.)
        return Object.assign(f, updates);
      }
      return f;
    });
  };

  // Handle budget file change (no longer uploads immediately)
  const handleBudgetFileChange = (files: FileWithPreview[]) => {
    setBudgetFile(files);
    setHasFileChanges(true);
    // Files will be submitted with the form, not uploaded separately
  };

  // Handle NFe file change (no longer uploads immediately)
  const handleNfeFileChange = (files: FileWithPreview[]) => {
    setNfeFile(files);
    setHasFileChanges(true);
    // Files will be submitted with the form, not uploaded separately
  };

  // Handle receipt file change (no longer uploads immediately)
  const handleReceiptFileChange = (files: FileWithPreview[]) => {
    setReceiptFile(files);
    setHasFileChanges(true);
    // Files will be submitted with the form, not uploaded separately
  };

  // Handle artwork files change (no longer uploads immediately)
  const handleFilesChange = (files: FileWithPreview[]) => {
    setUploadedFiles(files);
    setHasFileChanges(true);
    // Files will be submitted with the form, not uploaded separately
  };

  // Handle observation files change
  const handleObservationFilesChange = (files: FileWithPreview[]) => {
    console.log('[ObservationFiles] Files changed:', files.length);
    console.log('[ObservationFiles] Files:', files.map(f => ({ name: f.name, id: f.id, uploadedFileId: f.uploadedFileId, uploaded: f.uploaded })));
    setObservationFiles(files);
    setHasFileChanges(true);
    // Update form value with file IDs
    const fileIds = files.map((f) => f.uploadedFileId || f.id).filter(Boolean);
    console.log('[ObservationFiles] File IDs:', fileIds);
    const currentObservation = form.getValues("observation");
    console.log('[ObservationFiles] Current observation before update:', currentObservation);
    form.setValue("observation", {
      ...currentObservation,
      fileIds: fileIds,
    }, { shouldDirty: true, shouldTouch: true, shouldValidate: false });
    console.log('[ObservationFiles] Observation after update:', form.getValues("observation"));
    // Note: Form validation happens automatically via useWatch, no need to manually trigger
  };

  const handleCancel = useCallback(() => {
    window.location.href = `/producao/cronograma/detalhes/${task.id}`;
  }, [task.id]);

  // Watch all form values to trigger re-renders on any change
  // This is CRITICAL - without this, getChangedFields() won't be recalculated
  const formValues = form.watch();

  // Watch specific fields with useWatch for better reactivity
  const budgetValues = useWatch({
    control: form.control,
    name: 'budget',
  });

  const cutsValues = useWatch({
    control: form.control,
    name: 'cuts',
  });

  const observationValue = useWatch({
    control: form.control,
    name: 'observation',
  });


  // Get form state
  const { formState } = form;

  // Check if there are changes (form fields, layout, or files)
  // This will be recalculated on every form value change thanks to form.watch() above
  const hasChanges = Object.keys(getChangedFields()).length > 0 || hasLayoutChanges || hasFileChanges;

  // Check for validation errors that should prevent submission
  const hasCutsWithoutFiles = useMemo(() => {
    const cuts = cutsValues as any[] || [];
    return cuts.length > 0 && cuts.some((cut) => !cut.file && !cut.fileId);
  }, [cutsValues]);

  const hasIncompleteBudgets = useMemo(() => {
    const budgets = budgetValues as any[] || [];
    return budgets.length > 0 && budgets.some((budget) => {
      const hasRef = budget.referencia && budget.referencia.trim() !== "";
      const hasVal = budget.valor !== null && budget.valor !== undefined && budget.valor !== 0;
      return !hasRef || !hasVal;
    });
  }, [budgetValues]);

  const hasIncompleteObservation = useMemo(() => {
    // Only validate if observation section is open
    if (!isObservationOpen) return false;

    const observation = observationValue;
    const hasDescription = observation?.description && observation.description.trim() !== "";
    const hasFiles = (observation?.fileIds && observation.fileIds.length > 0) || observationFiles.length > 0;

    // Observation is incomplete if it's open but missing description OR files
    return !hasDescription || !hasFiles;
  }, [observationValue, observationFiles, isObservationOpen]);

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
      label: "Salvar Alterações",
      icon: isSubmitting ? IconLoader2 : IconCheck,
      onClick: handleSubmitChanges(),
      variant: "default" as const,
      disabled: isSubmitting || !hasChanges || hasCutsWithoutFiles || hasIncompleteBudgets || hasIncompleteObservation || !!layoutWidthError,
      loading: isSubmitting,
    },
  ];

  return (
    <div className="h-full flex flex-col space-y-4">
      {/* Fixed Header */}
      <div className="flex-shrink-0">
        <div className="max-w-5xl mx-auto px-4">
          <PageHeader
            title="Editar Tarefa"
            icon={IconClipboardList}
            variant="form"
            breadcrumbs={[
              { label: "Início", href: "/" },
              { label: "Produção", href: "/producao" },
              { label: "Cronograma", href: "/producao/cronograma" },
              { label: task.name, href: `/producao/cronograma/detalhes/${task.id}` },
              { label: "Editar" },
            ]}
            actions={navigationActions}
          />
        </div>
      </div>

      {/* Main Content Card - Dashboard style scrolling */}
      <div className="flex-1 overflow-hidden max-w-5xl mx-auto px-4 w-full">
        <div className="h-full bg-card rounded-lg shadow-md border-muted overflow-hidden">
          <div className="h-full overflow-y-auto p-6">
            <Form {...form}>
              <form className="space-y-6">
                {/* Basic Information Card */}
                <Card className="bg-transparent">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <IconClipboardList className="h-5 w-5" />
                      Informações Básicas
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
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
                              Nome da Tarefa <span className="text-destructive">*</span>
                            </FormLabel>
                            <FormControl>
                              <Input
                                value={field.value || ""}
                                onChange={(value) => {
                                  field.onChange(value);
                                }}
                                name={field.name}
                                onBlur={field.onBlur}
                                ref={field.ref}
                                placeholder="Ex: Pintura completa do caminhão"
                                disabled={isSubmitting || isFinancialUser || isWarehouseUser || isDesignerUser || isLogisticUser}
                                className="bg-transparent"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Customer */}
                      <CustomerSelector control={form.control} disabled={isSubmitting || isFinancialUser || isWarehouseUser || isDesignerUser} required initialCustomer={task.customer} />
                    </div>

                    {/* Serial Number, Plate and Chassis Number */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      {/* Serial Number - EDITABLE by Financial users */}
                      <FormField
                        control={form.control}
                        name="serialNumber"
                        render={({ field }) => (
                          <FormItem className="md:col-span-1">
                            <FormLabel className="flex items-center gap-2">
                              <IconHash className="h-4 w-4" />
                              Número de Série
                            </FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                value={field.value || ""}
                                placeholder="Ex: ABC-123456"
                                className="uppercase bg-transparent"
                                onChange={(value) => field.onChange(typeof value === "string" ? value.toUpperCase() : "")}
                                disabled={isSubmitting || isWarehouseUser || isDesignerUser}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Plate (optional) - EDITABLE by Financial users, DISABLED for Designer */}
                      <FormField
                        control={form.control}
                        name="plate"
                        render={({ field }) => (
                          <FormItem className="md:col-span-1">
                            <FormLabel className="flex items-center gap-2">
                              <IconLicense className="h-4 w-4" />
                              Placa
                            </FormLabel>
                            <FormControl>
                              <Input type="plate" {...field} value={field.value || ""} disabled={isSubmitting || isWarehouseUser || isDesignerUser} className="bg-transparent" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Chassis Number - EDITABLE by Financial users */}
                      <FormField
                        control={form.control}
                        name="chassisNumber"
                        render={({ field }) => (
                          <FormItem className="md:col-span-2">
                            <FormLabel className="flex items-center gap-2">
                              <IconId className="h-4 w-4" />
                              Número do Chassi (17 caracteres)
                            </FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                type="chassis"
                                value={field.value || ""}
                                placeholder="Ex: 9BW ZZZ37 7V T004251"
                                className="bg-transparent"
                                disabled={isSubmitting || isWarehouseUser || isDesignerUser}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Sector and Status in a row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Sector */}
                      <SectorSelector control={form.control} disabled={isSubmitting || isFinancialUser || isWarehouseUser || isDesignerUser} productionOnly />

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
                                disabled={isSubmitting || isFinancialUser || isWarehouseUser || isDesignerUser || isLogisticUser}
                                options={Object.values(TASK_STATUS).map((status) => ({
                                  value: status,
                                  label: TASK_STATUS_LABELS[status],
                                }))}
                                placeholder="Selecione o status"
                                searchable={false}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Commission Status */}
                    <FormField
                      control={form.control}
                      name="commission"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <IconCurrencyReal className="h-4 w-4" />
                            Status de Comissão
                          </FormLabel>
                          <FormControl>
                            <Combobox
                              value={field.value || COMMISSION_STATUS.FULL_COMMISSION}
                              onValueChange={field.onChange}
                              disabled={isSubmitting || isFinancialUser}
                              options={Object.values(COMMISSION_STATUS).map((status) => ({
                                value: status,
                                label: COMMISSION_STATUS_LABELS[status],
                              }))}
                              placeholder="Selecione o status de comissão"
                              searchable={false}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

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
                            <Textarea {...field} value={field.value || ""} placeholder="Detalhes adicionais sobre a tarefa..." rows={4} disabled={isSubmitting || isFinancialUser || isWarehouseUser || isDesignerUser} className="bg-transparent" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                {/* Dates Card - Hidden for Warehouse and Logistic users, Disabled for Financial and Designer users */}
                {!isWarehouseUser && !isLogisticUser && (
                <Card className="bg-transparent">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <IconCalendar className="h-5 w-5" />
                      Datas
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* First Row: Entry Date and Deadline */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Entry Date - Date only - DISABLED for Financial and Designer users */}
                      <FormField
                        control={form.control}
                        name="entryDate"
                        render={({ field }) => <DateTimeInput field={field} mode="date" context="start" label="Data de Entrada" disabled={isSubmitting || isWarehouseUser || isFinancialUser || isDesignerUser} allowManualInput={true} />}
                      />

                      {/* Deadline - DateTime - DISABLED for Financial and Designer users */}
                      <FormField
                        control={form.control}
                        name="term"
                        render={({ field }) => (
                          <DateTimeInput field={field} mode="datetime" context="due" label="Prazo de Entrega" disabled={isSubmitting || isWarehouseUser || isFinancialUser || isDesignerUser} allowManualInput={true} />
                        )}
                      />
                    </div>

                    {/* Second Row: Started At and Finished At */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Started At - DateTime - DISABLED for Financial and Designer users */}
                      <FormField
                        control={form.control}
                        name="startedAt"
                        render={({ field }) => (
                          <DateTimeInput
                            field={field}
                            mode="datetime"
                            context="start"
                            label="Data de Início"
                            disabled={isSubmitting || isWarehouseUser || isFinancialUser || isDesignerUser}
                            constraints={{
                              maxDate: new Date(), // Cannot start in the future
                            }}
                            allowManualInput={true}
                          />
                        )}
                      />

                      {/* Finished At - DateTime - DISABLED for Financial and Designer users */}
                      <FormField
                        control={form.control}
                        name="finishedAt"
                        render={({ field }) => (
                          <DateTimeInput
                            field={field}
                            mode="datetime"
                            context="end"
                            label="Data de Conclusão"
                            disabled={isSubmitting || isWarehouseUser || isFinancialUser || isDesignerUser}
                            constraints={{
                              maxDate: new Date(), // Cannot finish in the future
                              minDate: form.watch("startedAt") || new Date("1900-01-01"), // Cannot finish before started
                            }}
                            allowManualInput={true}
                          />
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>
                )}

                {/* Services Card - Hidden for Warehouse, Financial, Designer, and Logistic users */}
                {!isWarehouseUser && !isFinancialUser && !isDesignerUser && !isLogisticUser && (
                <Card className="bg-transparent">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <IconClipboardList className="h-5 w-5" />
                      Serviços <span className="text-destructive">*</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <FormField
                      control={form.control}
                      name="services"
                      render={() => (
                        <FormItem>
                          <ServiceSelectorFixed control={form.control} disabled={isSubmitting || isWarehouseUser} />
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
                )}

                {/* Paint Selection (Tintas) - Hidden for Warehouse, Financial, and Logistic users, Disabled for Designer */}
                {!isWarehouseUser && !isFinancialUser && !isLogisticUser && (
                <Card className="bg-transparent">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <IconPalette className="h-5 w-5" />
                      Tintas
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* General Painting Selector */}
                    <GeneralPaintingSelector
                      control={form.control}
                      disabled={isSubmitting || isWarehouseUser || isDesignerUser}
                      initialPaint={task.generalPainting}
                    />

                    {/* Logo Paints Multi-selector */}
                    <LogoPaintsSelector
                      control={form.control}
                      disabled={isSubmitting || isWarehouseUser || isDesignerUser}
                      initialPaints={task.logoPaints}
                    />
                  </CardContent>
                </Card>
                )}

                {/* Layout Section - Hidden for Warehouse and Financial users, Read-only for Designer users, EDITABLE for Logistic users */}
                {!isWarehouseUser && !isFinancialUser && (
                <Card className="bg-transparent">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <IconRuler className="h-5 w-5" />
                        Layout do Caminhão
                      </CardTitle>
                      {!isLayoutOpen ? (
                        <Button
                          type="button"
                          onClick={() => setIsLayoutOpen(true)}
                          disabled={isSubmitting}
                          size="sm"
                          className="gap-2"
                        >
                          <IconPlus className="h-4 w-4" />
                          Adicionar Layout
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setIsLayoutOpen(false)}
                          disabled={isSubmitting}
                        >
                          Remover
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {isLayoutOpen ? (
                      <div className="space-y-4">
                        {/* Layout Side Selector */}
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

                        {/* Layout Form - Read-only for Financial and Designer users */}
                        <LayoutForm
                          selectedSide={selectedLayoutSide}
                          layout={
                            selectedLayoutSide === "left"
                              ? layoutsData?.leftSideLayout
                              : selectedLayoutSide === "right"
                                ? layoutsData?.rightSideLayout
                                : layoutsData?.backSideLayout
                          }
                          validationError={layoutWidthError}
                          onSave={async (layoutData) => {
                            if (layoutData) {
                              console.log('[TaskEditForm] LayoutForm onSave called', {
                                side: selectedLayoutSide,
                                layoutData,
                                sectionsCount: layoutData.sections?.length,
                                currentLayoutsData: layoutsData,
                              });

                              // If no truckId exists, the backend will create one
                              const effectiveTruckId = truckId || task.id; // Use task ID as fallback
                              console.log('[TaskEditForm] Calling createOrUpdateTruckLayout', {
                                effectiveTruckId,
                                side: selectedLayoutSide,
                              });

                              await createOrUpdateTruckLayout({
                                truckId: effectiveTruckId,
                                side: selectedLayoutSide,
                                data: layoutData,
                              });

                              console.log('[TaskEditForm] Layout saved successfully');
                              setHasLayoutChanges(true);
                              // Layout dimensions are now managed by the Layout system
                              // Width validation happens in real-time via useEffect
                            }
                          }}
                          showPhoto={selectedLayoutSide === "back"}
                          disabled={isSubmitting || isFinancialUser || isDesignerUser}
                        />
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
                )}

                {/* Financial Information Card - Only visible to ADMIN and FINANCIAL users */}
                {canViewFinancialSections && (
                <Card className="bg-transparent">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <IconCurrencyReal className="h-5 w-5" />
                      Informações Financeiras
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Budget File */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium flex items-center gap-2">
                          <IconFileInvoice className="h-4 w-4 text-muted-foreground" />
                          Orçamento
                        </label>
                        <FileUploadField
                          onFilesChange={handleBudgetFileChange}
                          maxFiles={5}
                          disabled={isSubmitting}
                          showPreview={true}
                          existingFiles={budgetFile}
                          variant="compact"
                          placeholder="Adicionar orçamentos"
                          label=""
                        />
                      </div>

                      {/* NFe File */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium flex items-center gap-2">
                          <IconFile className="h-4 w-4 text-muted-foreground" />
                          Nota Fiscal
                        </label>
                        <FileUploadField
                          onFilesChange={handleNfeFileChange}
                          maxFiles={5}
                          disabled={isSubmitting}
                          showPreview={true}
                          existingFiles={nfeFile}
                          variant="compact"
                          placeholder="Adicionar NFes"
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
                          onFilesChange={handleReceiptFileChange}
                          maxFiles={5}
                          disabled={isSubmitting}
                          showPreview={true}
                          existingFiles={receiptFile}
                          variant="compact"
                          placeholder="Adicionar recibos"
                          label=""
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
                )}

                {/* Budget Card - Only visible to ADMIN and FINANCIAL users */}
                {canViewFinancialSections && (
                <Card className="bg-transparent">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <IconFileInvoice className="h-5 w-5" />
                        Orçamento Detalhado
                      </CardTitle>
                      <Button
                        type="button"
                        onClick={() => {
                          if (budgetSelectorRef.current) {
                            budgetSelectorRef.current.addBudget();
                          }
                        }}
                        disabled={isSubmitting}
                        size="sm"
                        className="gap-2"
                      >
                        <IconPlus className="h-4 w-4" />
                        Adicionar Orçamento ({budgetCount})
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <BudgetSelector ref={budgetSelectorRef} control={form.control} disabled={isSubmitting} onBudgetCountChange={setBudgetCount} />
                  </CardContent>
                </Card>
                )}

                {/* Observation Section - Hidden for Warehouse, Financial, Designer, and Logistic users */}
                {!isWarehouseUser && !isFinancialUser && !isDesignerUser && !isLogisticUser && (
                <Card className="bg-transparent">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <IconFile className="h-5 w-5" />
                        Observação
                      </CardTitle>
                      {!isObservationOpen ? (
                        <Button
                          type="button"
                          onClick={() => setIsObservationOpen(true)}
                          disabled={isSubmitting}
                          size="sm"
                          className="gap-2"
                        >
                          <IconPlus className="h-4 w-4" />
                          Adicionar Observação
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setIsObservationOpen(false);
                            form.setValue("observation", null, { shouldValidate: true, shouldDirty: true });
                            setObservationFiles([]);
                          }}
                          disabled={isSubmitting}
                        >
                          Remover
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {isObservationOpen ? (
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
                                    // Always preserve the observation object structure to avoid losing fileIds
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
                    ) : null}
                  </CardContent>
                </Card>
                )}

                {/* Cut Plans Section - Multiple Cuts Support - EDITABLE for Designer, Hidden for Financial and Logistic users */}
                {!isFinancialUser && !isLogisticUser && (
                <Card className="bg-transparent">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <IconScissors className="h-5 w-5" />
                        Plano de Corte
                      </CardTitle>
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
                  </CardHeader>
                  <CardContent>
                    <MultiCutSelector ref={multiCutSelectorRef} control={form.control} disabled={isSubmitting} onCutsCountChange={setCutsCount} />
                  </CardContent>
                </Card>
                )}

                {/* Airbrushing Section - Multiple Airbrushings Support - Hidden for Warehouse, Financial, Designer, and Logistic users */}
                {!isWarehouseUser && !isFinancialUser && !isDesignerUser && !isLogisticUser && (
                <Card className="bg-transparent">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <IconSparkles className="h-5 w-5" />
                        Aerografias
                      </CardTitle>
                      <Button
                        type="button"
                        onClick={() => {
                          if (multiAirbrushingSelectorRef.current) {
                            multiAirbrushingSelectorRef.current.addAirbrushing();
                          }
                        }}
                        disabled={isSubmitting || airbrushingsCount >= 10}
                        size="sm"
                        className="gap-2"
                      >
                        <IconPlus className="h-4 w-4" />
                        Adicionar Aerografia ({airbrushingsCount}/10)
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <MultiAirbrushingSelector ref={multiAirbrushingSelectorRef} control={form.control} disabled={isSubmitting} onAirbrushingsCountChange={setAirbrushingsCount} />
                  </CardContent>
                </Card>
                )}

                {/* Artworks Card (optional) - EDITABLE for Designer, Hidden for Warehouse, Financial, and Logistic users */}
                {!isWarehouseUser && !isFinancialUser && !isLogisticUser && (
                <Card className="bg-transparent">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <IconFile className="h-5 w-5" />
                      Artes (Opcional)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {/* Edit-specific: Show existing artworks */}
                    {task.artworks && task.artworks.length > 0 && (
                      <div className="mb-4">
                        <Label className="text-sm text-muted-foreground mb-2">Artes Existentes</Label>
                        <div className="space-y-2">
                          {task.artworks.map((file) => (
                            <div key={file.id} className="flex items-center gap-2 text-sm">
                              <IconFile className="h-4 w-4" />
                              <span>{file.filename}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <FileUploadField
                      onFilesChange={handleFilesChange}
                      maxFiles={5}
                      disabled={isSubmitting}
                      showPreview={true}
                      existingFiles={uploadedFiles}
                      variant="compact"
                      placeholder="Adicione artes relacionadas à tarefa"
                      label="Artes anexadas"
                    />
                  </CardContent>
                </Card>
                )}
              </form>
            </Form>
          </div>
        </div>
      </div>
    </div>
  );
};
