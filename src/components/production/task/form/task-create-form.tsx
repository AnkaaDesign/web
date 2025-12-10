import { useState, useCallback, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
  IconX,
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
import type { TaskCreateFormData } from "../../../../schemas";
import { taskCreateSchema } from "../../../../schemas";
import { useTaskMutations, useTaskFormUrlState, useLayoutMutations, useCurrentUser } from "../../../../hooks";
import { TASK_STATUS, CUT_TYPE, COMMISSION_STATUS, COMMISSION_STATUS_LABELS, SECTOR_PRIVILEGES } from "../../../../constants";
import { createFormDataWithContext } from "@/utils/form-data-helper";
import { getCustomerById } from "../../../../api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { SizeInput } from "@/components/ui/size-input";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { Combobox } from "@/components/ui/combobox";
import { CustomerSelector } from "./customer-selector";
import { SectorSelector } from "./sector-selector";
import { ServiceSelectorFixed } from "./service-selector";
import { BudgetSelector, type BudgetSelectorRef } from "./budget-selector";
import { MultiCutSelector, type MultiCutSelectorRef } from "./multi-cut-selector";
import { GeneralPaintingSelector } from "./general-painting-selector";
import { LogoPaintsSelector } from "./logo-paints-selector";
import { MultiAirbrushingSelector, type MultiAirbrushingSelectorRef } from "./multi-airbrushing-selector";
import { FileUploadField, type FileWithPreview } from "@/components/common/file";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { LayoutForm } from "@/components/production/layout/layout-form";
import { FormMoneyInput } from "@/components/ui/form-money-input";

export const TaskCreateForm = () => {
  // Get current user to check if they're from financial sector
  const { data: currentUser } = useCurrentUser();
  const isFinancialSector = currentUser?.sector?.privileges === SECTOR_PRIVILEGES.FINANCIAL;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<FileWithPreview[]>([]);
  const [observationFiles, setObservationFiles] = useState<FileWithPreview[]>([]);
  const [budgetFile, setBudgetFile] = useState<FileWithPreview[]>([]);
  const [nfeFile, setNfeFile] = useState<FileWithPreview[]>([]);
  const [receiptFile, setReceiptFile] = useState<FileWithPreview[]>([]);
  const multiCutSelectorRef = useRef<MultiCutSelectorRef>(null);
  const multiAirbrushingSelectorRef = useRef<MultiAirbrushingSelectorRef>(null);
  const budgetSelectorRef = useRef<BudgetSelectorRef>(null);
  const [cutsCount, setCutsCount] = useState(0);
  const [airbrushingsCount, setAirbrushingsCount] = useState(0);
  const [budgetCount, setBudgetCount] = useState(0);
  const [selectedLayoutSide, setSelectedLayoutSide] = useState<"left" | "right" | "back">("left");
  const [isLayoutOpen, setIsLayoutOpen] = useState(false);
  const [isObservationOpen, setIsObservationOpen] = useState(false);
  const [isFinancialInfoOpen, setIsFinancialInfoOpen] = useState(false);
  const [layoutWidthError, setLayoutWidthError] = useState<string | null>(null);
  const [layouts, setLayouts] = useState<{
    left?: any;
    right?: any;
    back?: any;
  }>({
    left: { height: 2.4, sections: [{ width: 8, hasDoor: false }], photoId: null },
    right: { height: 2.4, sections: [{ width: 8, hasDoor: false }], photoId: null },
    back: { height: 2.42, sections: [{ width: 2.42, hasDoor: false }], photoId: null },  // Back defaults to 2.42m x 2.42m
  });

  // Real-time validation of layout width balance (same as edit form)
  useEffect(() => {
    if (!isLayoutOpen) {
      setLayoutWidthError(null);
      return;
    }

    // Get layoutSections from current layout state
    const leftLayout = layouts.left;
    const rightLayout = layouts.right;
    const leftSections = leftLayout?.layoutSections;
    const rightSections = rightLayout?.layoutSections;

    // Only validate if both sides exist and have layoutSections
    if (leftSections && leftSections.length > 0 && rightSections && rightSections.length > 0) {
      const leftTotalWidth = leftSections.reduce((sum: number, s: any) => sum + (s.width || 0), 0);
      const rightTotalWidth = rightSections.reduce((sum: number, s: any) => sum + (s.width || 0), 0);
      const widthDifference = Math.abs(leftTotalWidth - rightTotalWidth);
      const maxAllowedDifference = 0.04; // 4cm in meters

      if (widthDifference > maxAllowedDifference) {
        const errorMessage = `O layout possui diferença de largura maior que 4cm entre os lados. Lado Motorista: ${leftTotalWidth.toFixed(2)}m, Lado Sapo: ${rightTotalWidth.toFixed(2)}m (diferença de ${(widthDifference * 100).toFixed(1)}cm). Ajuste as medidas antes de enviar o formulário.`;
        setLayoutWidthError(errorMessage);
      } else {
        setLayoutWidthError(null);
      }
    } else {
      // Clear error if one side doesn't have sections
      setLayoutWidthError(null);
    }
  }, [layouts, isLayoutOpen]);

  // Debug logging for cuts count changes
  const handleSetCutsCount = useCallback((count: number) => {
    setCutsCount(count);
  }, []); // No dependencies - setCutsCount is stable

  // URL state management for form data persistence
  const urlState = useTaskFormUrlState({
    initialData: {
      entryDate: null,
      term: null,
      truck: {
        xPosition: null,
        yPosition: null,
      },
      services: [],
      cuts: [],
      artworkIds: [],
    },
  });

  // Helper to update file while preserving File object properties
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

  // Initialize form with URL state data
  const form = useForm<TaskCreateFormData>({
    resolver: zodResolver(taskCreateSchema),
    mode: "onChange", // Validate on every change for real-time feedback
    reValidateMode: "onChange", // Re-validate on every change
    criteriaMode: "all", // Show all errors, not just the first one
    shouldFocusError: true, // Focus on first error field when validation fails
    defaultValues: {
      status: TASK_STATUS.PENDING,
      name: urlState.name || "",
      customerId: urlState.customerId || "",
      sectorId: urlState.sectorId || undefined,
      serialNumber: urlState.serialNumber,
      details: urlState.details,
      entryDate: urlState.entryDate || null,
      term: urlState.term || null,
      services: urlState.services || [],
      cuts: urlState.cuts,
      airbrushings: urlState.airbrushings || [],
      paintId: urlState.generalPaintingId,
      paintIds: urlState.logoPaintIds,
      truck: urlState.truck,
      artworkIds: urlState.artworkIds,
      price: null,
      budgetId: null,
      nfeId: null,
      receiptId: null,
    },
  });

  // Don't sync URL state changes back to form to avoid input lag
  // The form manages its own state and updates URL state as needed

  // Mutations
  const { createAsync } = useTaskMutations();
  const { createOrUpdateTruckLayout } = useLayoutMutations();

  // Handle budget file change (no longer uploads immediately)
  const handleBudgetFileChange = (files: FileWithPreview[]) => {
    setBudgetFile(files);
    // Files will be submitted with the form, not uploaded separately
  };

  // Handle NFe file change (no longer uploads immediately)
  const handleNfeFileChange = (files: FileWithPreview[]) => {
    setNfeFile(files);
    // Files will be submitted with the form, not uploaded separately
  };

  // Handle receipt file change (no longer uploads immediately)
  const handleReceiptFileChange = (files: FileWithPreview[]) => {
    setReceiptFile(files);
    // Files will be submitted with the form, not uploaded separately
  };

  // Handle artwork files change (no longer uploads immediately)
  const handleFilesChange = (files: FileWithPreview[]) => {
    setUploadedFiles(files);
    // Files will be submitted with the form, not uploaded separately
  };

  // Handle observation files change
  const handleObservationFilesChange = (files: FileWithPreview[]) => {
    setObservationFiles(files);
    // Update form value with file IDs
    const fileIds = files.map((f) => f.uploadedFileId || f.id).filter(Boolean);
    const currentObservation = form.getValues("observation");
    form.setValue("observation", {
      ...currentObservation,
      artworkIds: fileIds,
    });
  };

  // Handle form submission with files
  const handleSubmit = useCallback(
    async (data: TaskCreateFormData) => {
      try {
        setIsSubmitting(true);

        // Set entry date to 7:30 if provided (since the date picker only allows date selection)
        if (data.entryDate) {
          const entryDate = new Date(data.entryDate);
          entryDate.setHours(7, 30, 0, 0);
          data.entryDate = entryDate;
        }

        // Get customer data for file organization
        const customerId = data.customerId;
        const { data: customerResponse } = customerId ? await getCustomerById(customerId) : { data: null };
        const customer = customerResponse?.data;

        // Prepare files object
        const files = {
          budgets: budgetFile.filter(f => f instanceof File) as File[],
          invoices: nfeFile.filter(f => f instanceof File) as File[],
          receipts: receiptFile.filter(f => f instanceof File) as File[],
          artworks: uploadedFiles.filter(f => f instanceof File) as File[],
        };

        // Handle cut files - need special processing for organization
        const cuts = data.cuts as any[] || [];
        const cutFiles: File[] = [];
        const cutsWithContext = cuts.map(cut => {
          if (cut.file && cut.file instanceof File) {
            cutFiles.push(cut.file);
            // Add metadata for file organization
            return {
              ...cut,
              _fileContext: {
                cutType: cut.type === CUT_TYPE.VINYL ? 'vinyl' : 'stencil',
                customerName: customer?.fantasyName || customer?.corporateName || '',
              }
            };
          }
          return cut;
        });

        // Handle airbrushing files
        const airbrushings = data.airbrushings as any[] || [];
        const airbrushingFiles: Record<string, File[]> = {};

        console.log('[TaskCreateForm] ========== AIRBRUSHINGS BEFORE FILE EXTRACTION ==========');
        console.log('[TaskCreateForm] Airbrushings count:', airbrushings.length);
        airbrushings.forEach((airbrushing, index) => {
          console.log(`[TaskCreateForm] Airbrushing ${index}:`, {
            id: airbrushing.id,
            status: airbrushing.status,
            price: airbrushing.price,
            priceType: typeof airbrushing.price,
            startDate: airbrushing.startDate,
            finishDate: airbrushing.finishDate,
          });
        });

        if (airbrushings.length > 0) {
          airbrushings.forEach((airbrushing, index) => {
            // Extract files from airbrushing objects
            if (airbrushing.receiptFiles && Array.isArray(airbrushing.receiptFiles)) {
              const receipts = airbrushing.receiptFiles.filter((f: any) => f instanceof File);
              if (receipts.length > 0) {
                airbrushingFiles[`airbrushings[${index}].receipts`] = receipts;
              }
              // Remove file objects from airbrushing data
              delete airbrushing.receiptFiles;
            }

            if (airbrushing.nfeFiles && Array.isArray(airbrushing.nfeFiles)) {
              const invoices = airbrushing.nfeFiles.filter((f: any) => f instanceof File);
              if (invoices.length > 0) {
                airbrushingFiles[`airbrushings[${index}].invoices`] = invoices;
              }
              // Remove file objects from airbrushing data
              delete airbrushing.nfeFiles;
            }

            if (airbrushing.artworkFiles && Array.isArray(airbrushing.artworkFiles)) {
              const artworks = airbrushing.artworkFiles.filter((f: any) => f instanceof File);
              if (artworks.length > 0) {
                airbrushingFiles[`airbrushings[${index}].artworks`] = artworks;
              }
              // Remove file objects from airbrushing data
              delete airbrushing.artworkFiles;
            }
          });
        }

        console.log('[TaskCreateForm] ========== AIRBRUSHINGS AFTER FILE EXTRACTION ==========');
        console.log('[TaskCreateForm] Airbrushings for FormData:', JSON.stringify(airbrushings, null, 2));

        // Backend doesn't support 'cuts' (plural) field - remove it from data
        // Cuts will be created separately after task creation
        console.log('[SUBMIT] Before deleting cuts:', 'cuts' in data ? 'PRESENT' : 'NOT PRESENT');
        delete (data as any).cuts;
        console.log('[SUBMIT] After deleting cuts:', 'cuts' in data ? 'STILL PRESENT (BUG!)' : 'DELETED (OK)');

        // IMPORTANT: Keep cuts metadata in data for API
        if (cutFiles.length > 0 && cuts.length > 0) {
          data.cuts = cutsWithContext.map(cut => ({
            type: cut.type,
            quantity: cut.quantity || 1,
          })) as any;
        }

        // Create FormData with proper context
        // CRITICAL: Field name must be 'cutFiles' not 'cuts' - API expects cutFiles
        const formData = createFormDataWithContext(
          data,
          { ...files, cutFiles: cutFiles, ...airbrushingFiles },
          {
            entityType: 'task',
            customer: customer ? {
              id: customer.id,
              name: customer.corporateName || customer.fantasyName,
              fantasyName: customer.fantasyName,
            } : undefined,
          }
        );

        const result = await createAsync(formData as any); // Navigate to the task list after successful creation
        if (result?.success && result.data) {
          // Get the truck ID from the created task
          const createdTask = result.data;
          const truckId = createdTask.truck?.id;

          // Create layouts if truck was created and layouts exist
          if (truckId && layouts) {
            console.log(`🔍 LAYOUT DEBUG - truckId: ${truckId}`);
            console.log(`🔍 LAYOUT DEBUG - layouts object:`, layouts);
            console.log(`🔍 LAYOUT DEBUG - layouts.left:`, layouts.left);
            console.log(`🔍 LAYOUT DEBUG - layouts.right:`, layouts.right);
            console.log(`🔍 LAYOUT DEBUG - layouts.back:`, layouts.back);

            const layoutPromises = [];

            // Transform layout data to match API schema
            const transformLayoutForAPI = (layoutData: any, side: string) => {
              console.log(`🔧 Transforming ${side} layout data:`, layoutData);

              if (!layoutData || !layoutData.layoutSections) {
                console.log(`❌ No ${side} layout data or layoutSections`);
                return null;
              }

              // Ensure layoutSections is an actual array, not an object
              let sectionsArray = layoutData.layoutSections;
              if (!Array.isArray(sectionsArray)) {
                console.log(`⚠️ Converting layoutSections object to array for ${side}`);
                sectionsArray = Object.values(sectionsArray);
              }

              // Create a proper array (not object) for layoutSections
              const sectionsAsArray = sectionsArray.map((section: any, index: number) => {
                const transformedSection = {
                  width: typeof section.width === 'number' ? section.width : 1, // Width in meters
                  isDoor: typeof section.isDoor === 'boolean' ? section.isDoor : false,
                  doorHeight: section.isDoor && typeof section.doorHeight === 'number' ? section.doorHeight : null,
                  position: typeof section.position === 'number' ? section.position : index,
                };
                console.log(`  Section ${index}:`, section, '=>', transformedSection);
                return transformedSection;
              });

              const transformed = {
                height: typeof layoutData.height === 'number' ? layoutData.height : 2.4, // Height in meters
                layoutSections: sectionsAsArray, // Ensure this is an actual array
                photoId: layoutData.photoId || null,
              };

              console.log(`✅ Transformed ${side} layout (array check):`, {
                ...transformed,
                layoutSectionsIsArray: Array.isArray(transformed.layoutSections),
                layoutSectionsLength: transformed.layoutSections.length
              });

              // Force JSON serialization to verify structure
              const jsonString = JSON.stringify(transformed);
              console.log(`🔍 JSON serialized ${side} layout:`, jsonString);

              // CRITICAL FIX: Clone the object to ensure arrays don't get corrupted by Axios
              const finalData = JSON.parse(JSON.stringify(transformed));
              console.log(`🛡️ Final data after JSON roundtrip:`, finalData, 'layoutSections is array:', Array.isArray(finalData.layoutSections));

              return finalData;
            };

            // Create layouts for each side that has data
            console.log(`🔍 Checking left layout:`, layouts.left, 'Has layoutSections:', layouts.left?.layoutSections, 'Length:', layouts.left?.layoutSections?.length);
            if (layouts.left && layouts.left.layoutSections && layouts.left.layoutSections.length > 0) {
              console.log(`✅ Creating left layout`);
              const leftLayoutData = transformLayoutForAPI(layouts.left, 'left');
              if (leftLayoutData) {
                layoutPromises.push(createOrUpdateTruckLayout({ truckId, side: 'left', data: leftLayoutData }));
              }
            } else {
              console.log(`❌ Skipping left layout - no valid data`);
            }

            console.log(`🔍 Checking right layout:`, layouts.right, 'Has layoutSections:', layouts.right?.layoutSections, 'Length:', layouts.right?.layoutSections?.length);
            if (layouts.right && layouts.right.layoutSections && layouts.right.layoutSections.length > 0) {
              console.log(`✅ Creating right layout`);
              const rightLayoutData = transformLayoutForAPI(layouts.right, 'right');
              if (rightLayoutData) {
                layoutPromises.push(createOrUpdateTruckLayout({ truckId, side: 'right', data: rightLayoutData }));
              }
            } else {
              console.log(`❌ Skipping right layout - no valid data`);
            }

            console.log(`🔍 Checking back layout:`, layouts.back, 'Has layoutSections:', layouts.back?.layoutSections, 'Length:', layouts.back?.layoutSections?.length);
            if (layouts.back && layouts.back.layoutSections && layouts.back.layoutSections.length > 0) {
              console.log(`✅ Creating back layout`);
              const backLayoutData = transformLayoutForAPI(layouts.back, 'back');
              if (backLayoutData) {
                layoutPromises.push(createOrUpdateTruckLayout({ truckId, side: 'back', data: backLayoutData }));
              }
            } else {
              console.log(`❌ Skipping back layout - no valid data`);
            }

            // Create all layouts in parallel
            if (layoutPromises.length > 0) {
              try {
                console.log(`🎯 Creating ${layoutPromises.length} layout(s) for truck ${truckId}`);

                // Debug each layout creation individually
                for (let i = 0; i < layoutPromises.length; i++) {
                  const promise = layoutPromises[i];
                  console.log(`🚀 Layout ${i + 1}:`, promise);
                }

                await Promise.all(layoutPromises);
                console.log(`✅ Successfully created ${layoutPromises.length} layout(s) for truck ${truckId}`);
              } catch (layoutError: any) {
                console.error("❌ Error creating layouts:", layoutError);
                console.error("Layout error details:", {
                  message: layoutError?.message,
                  response: layoutError?.response?.data,
                  status: layoutError?.response?.status,
                  truckId,
                  layoutCount: layoutPromises.length,
                });

                // Show detailed error message
                const errorMessage = layoutError?.response?.data?.message ||
                                   layoutError?.message ||
                                   "Erro desconhecido ao criar layouts";

                toast.error(`Tarefa criada, mas erro ao criar layouts: ${errorMessage}`, {
                  duration: 8000, // Show error for 8 seconds
                });

                // Don't redirect immediately if there are layout errors
                setIsSubmitting(false);
                return;
              }
            }
          }

          // Clear URL state after successful submission
          urlState.resetForm();

          // Success toast for task creation is handled automatically by API client

          // Navigate after success message
          window.location.href = "/producao/cronograma";
        } else {
          // Log if the result is not successful
          console.error("Task creation failed:", result);
          toast.error(result?.message || "Erro ao criar tarefa");
        }
      } catch (error) {
        console.error("🔴 Error creating task:", error);
        toast.error("Erro ao criar tarefa. Por favor, tente novamente.");
      } finally {
        setIsSubmitting(false);
      }
    },
    [createAsync, createOrUpdateTruckLayout, layouts, urlState, budgetFile, nfeFile, receiptFile, uploadedFiles],
  );

  const handleCancel = useCallback(() => {
    window.location.href = "/producao/cronograma";
  }, []);

  // Get form state
  const { formState } = form;
  const hasErrors = Object.keys(formState.errors).length > 0;
  const isDirty = formState.isDirty;

  // Debug form state
  console.log('📋 [FORM STATE]', {
    isDirty,
    isValid: formState.isValid,
    hasErrors,
    isSubmitting,
    errorCount: Object.keys(formState.errors).length,
    errors: formState.errors,
  });

  // Log errors separately for better visibility in tests
  if (hasErrors) {
    try {
      console.log('📋 [FORM ERRORS - RAW]', formState.errors);

      // Try to extract readable error info
      const errorKeys = Object.keys(formState.errors);
      console.log('📋 [FORM ERROR FIELDS]', errorKeys.join(', '));

      // Log each error field individually
      errorKeys.forEach(key => {
        const err = formState.errors[key as keyof typeof formState.errors];
        console.log(`📋 [ERROR ${key}]`, typeof err, err);
      });
    } catch (e) {
      console.log('📋 [ERROR LOGGING FAILED]', String(e));
    }
  }

  // Check if all required fields are filled (only name is required)
  const name = form.watch("name");

  const hasRequiredFields = Boolean(
    name &&
    name.trim().length >= 3
  );

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
      disabled: isSubmitting || hasErrors || !hasRequiredFields || !!layoutWidthError,
      loading: isSubmitting,
    },
  ];

  return (
    <div className="h-full flex flex-col space-y-4">
      {/* Fixed Header */}
      <div className="flex-shrink-0">
        <div className="max-w-5xl mx-auto px-4">
          <PageHeader
            title="Cadastrar Tarefa"
            icon={IconClipboardList}
            variant="form"
            breadcrumbs={[{ label: "Início", href: "/" }, { label: "Produção", href: "/producao" }, { label: "Cronograma", href: "/producao/cronograma" }, { label: "Cadastrar" }]}
            actions={navigationActions}
          />
        </div>
      </div>

      {/* Main Content Card - Dashboard style scrolling */}
      <div className="flex-1 overflow-hidden max-w-5xl mx-auto px-4 w-full">
        <div className="h-full bg-card rounded-lg shadow-md border-muted overflow-hidden">
          <div className="h-full overflow-y-auto p-6">
            <Form {...form}>
              <form className="space-y-8">
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
                                  urlState.updateName(value || "");
                                }}
                                name={field.name}
                                onBlur={field.onBlur}
                                ref={field.ref}
                                placeholder="Ex: Pintura completa do caminhão"
                                disabled={isSubmitting}
                                className="bg-transparent"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Customer */}
                      <CustomerSelector control={form.control} disabled={isSubmitting} />
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
                                value={field.value || ""}
                                placeholder="Ex: ABC-123456"
                                className="uppercase bg-transparent"
                                onChange={(value) => {
                                  const upperValue = (value || "").toUpperCase();
                                  field.onChange(upperValue);
                                  urlState.updateSerialNumber(upperValue);
                                }}
                                disabled={isSubmitting}
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
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2">
                              <IconLicense className="h-4 w-4" />
                              Placa
                            </FormLabel>
                            <FormControl>
                              <Input
                                value={field.value || ""}
                                placeholder="Ex: ABC1234"
                                className="uppercase bg-transparent"
                                onChange={(value) => {
                                  const upperValue = (value || "").toUpperCase();
                                  field.onChange(upperValue);
                                }}
                                disabled={isSubmitting}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Chassis - 2/4 (col-span-2) */}
                      <FormField
                        control={form.control}
                        name="truck.chassisNumber"
                        render={({ field }) => (
                          <FormItem className="md:col-span-2">
                            <FormLabel className="flex items-center gap-2">
                              <IconId className="h-4 w-4" />
                              Chassi
                            </FormLabel>
                            <FormControl>
                              <Input
                                value={field.value || ""}
                                placeholder="Ex: 9BWZZZ377VT004251"
                                className="uppercase bg-transparent"
                                onChange={(value) => {
                                  const upperValue = (value || "").toUpperCase();
                                  field.onChange(upperValue);
                                }}
                                disabled={isSubmitting}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Dates - Entry Date and Deadline */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Entry Date - Date only */}
                      <FormField
                        control={form.control}
                        name="entryDate"
                        render={({ field }) => (
                          <DateTimeInput field={field} label={<span className="flex items-center gap-2"><IconCalendar className="h-4 w-4" />Data de Entrada</span>} placeholder="Selecione a data de entrada" disabled={isSubmitting} mode="date" context="start" />
                        )}
                      />

                      {/* Deadline - DateTime */}
                      <FormField
                        control={form.control}
                        name="term"
                        render={({ field }) => (
                          <DateTimeInput field={field} label={<span className="flex items-center gap-2"><IconCalendar className="h-4 w-4" />Prazo de Entrega</span>} placeholder="Selecione o prazo de entrega" disabled={isSubmitting} mode="datetime" context="due" />
                        )}
                      />
                    </div>

                    {/* Sector */}
                    <SectorSelector control={form.control} disabled={isSubmitting} productionOnly />

                    {/* Commission Status */}
                    <FormField
                      control={form.control}
                      name="commission"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <IconStatusChange className="h-4 w-4" />
                            Status de Comissão
                          </FormLabel>
                          <FormControl>
                            <Combobox
                              value={field.value || COMMISSION_STATUS.FULL_COMMISSION}
                              onValueChange={(value) => {
                                field.onChange(value);
                                urlState.updateCommission(value || null);
                              }}
                              disabled={isSubmitting || isFinancialSector}
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
                            <Textarea
                              {...field}
                              value={field.value || ""}
                              onChange={(e) => {
                                const value = e.target.value;
                                field.onChange(value || null);
                                urlState.updateDetails(value || null);
                              }}
                              placeholder="Detalhes adicionais sobre a tarefa..."
                              rows={4}
                              disabled={isSubmitting}
                              className="bg-transparent"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                {/* Services Card */}
                <Card className="bg-transparent">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <IconClipboardList className="h-5 w-5" />
                      Serviços
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <FormField
                      control={form.control}
                      name="services"
                      render={() => (
                        <FormItem>
                          <ServiceSelectorFixed control={form.control} disabled={isSubmitting} />
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                {/* Paint Selection */}
                <Card className="bg-transparent">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <IconPalette className="h-5 w-5" />
                      Tintas
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* General Painting Selector */}
                    <GeneralPaintingSelector control={form.control} disabled={isSubmitting} />

                    {/* Logo Paints Multi-selector */}
                    <LogoPaintsSelector control={form.control} disabled={isSubmitting} />
                  </CardContent>
                </Card>

                {/* Layout Section - Hidden for Financial sector */}
                {!isFinancialSector && (
                <Card className="bg-transparent">
                  <CardHeader className={`transition-all duration-200 ${!isLayoutOpen ? "pt-3 pb-0" : ""}`}>
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
                          Adicionar
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setIsLayoutOpen(false);
                            setLayouts({
                              left: { height: 2.4, sections: [{ width: 8, hasDoor: false }], photoId: null },
                              right: { height: 2.4, sections: [{ width: 8, hasDoor: false }], photoId: null },
                              back: { height: 2.42, sections: [{ width: 2.42, hasDoor: false }], photoId: null },
                            });
                          }}
                          disabled={isSubmitting}
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          title="Remover layout"
                        >
                          <IconX className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className={`transition-all duration-200 ${!isLayoutOpen ? "p-2" : ""}`}>
                    {isLayoutOpen ? (
                      <div className="space-y-4">
                        {/* Layout Side Selector with Total Length */}
                        <div className="flex justify-between items-center">
                          <div className="flex gap-2">
                            <Button type="button" variant={selectedLayoutSide === "left" ? "default" : "outline"} size="sm" onClick={() => setSelectedLayoutSide("left")}>
                              Motorista
                            </Button>
                            <Button type="button" variant={selectedLayoutSide === "right" ? "default" : "outline"} size="sm" onClick={() => setSelectedLayoutSide("right")}>
                              Sapo
                            </Button>
                            <Button type="button" variant={selectedLayoutSide === "back" ? "default" : "outline"} size="sm" onClick={() => setSelectedLayoutSide("back")}>
                              Traseira
                            </Button>
                          </div>

                          {/* Total Length Display */}
                          <div className="px-3 py-1 bg-primary/10 rounded-md">
                            <span className="text-sm text-muted-foreground">Comprimento Total: </span>
                            <span className="text-sm font-semibold text-foreground">
                              {(() => {
                                const currentLayout = layouts[selectedLayoutSide];
                                if (!currentLayout || !currentLayout.layoutSections) return "0,00m";
                                const totalWidth = currentLayout.layoutSections.reduce((sum, s) => sum + (s.width || 0), 0);
                                return totalWidth.toFixed(2).replace(".", ",") + "m";
                              })()}
                            </span>
                          </div>
                        </div>

                        {/* Layout Form */}
                        <LayoutForm
                          selectedSide={selectedLayoutSide}
                          layouts={layouts}
                          onChange={(side, layoutData) => {
                            setLayouts((prev) => ({
                              ...prev,
                              [side]: layoutData,
                            }));
                          }}
                          disabled={isSubmitting}
                          taskName={form.watch('name')}
                          validationError={layoutWidthError}
                        />
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
                )}

                {/* Budget Card */}
                <Card className="bg-transparent">
                  <CardHeader className={`transition-all duration-200 ${budgetCount === 0 ? "pt-3 pb-0" : ""}`}>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <IconFileInvoice className="h-5 w-5" />
                        Orçamento Detalhado
                      </CardTitle>
                      {budgetCount === 0 ? (
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
                          Adicionar
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (budgetSelectorRef.current) {
                              budgetSelectorRef.current.clearAll();
                            }
                          }}
                          disabled={isSubmitting}
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          title="Remover orçamento"
                        >
                          <IconX className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className={`transition-all duration-200 ${budgetCount === 0 ? "p-2" : ""}`}>
                    <BudgetSelector ref={budgetSelectorRef} control={form.control} disabled={isSubmitting} onBudgetCountChange={setBudgetCount} />
                  </CardContent>
                </Card>

                {/* Cut Plans Section - Improved Multiple Cuts Support */}
                <Card className="bg-transparent">
                  <CardHeader className={`transition-all duration-200 ${cutsCount === 0 ? "pt-3 pb-0" : ""}`}>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <IconScissors className="h-5 w-5" />
                        Plano de Corte
                      </CardTitle>
                      {cutsCount === 0 ? (
                        <Button
                          type="button"
                          onClick={() => {
                            if (multiCutSelectorRef.current) {
                              multiCutSelectorRef.current.addCut();
                            }
                          }}
                          disabled={isSubmitting}
                          size="sm"
                          className="gap-2"
                        >
                          <IconPlus className="h-4 w-4" />
                          Adicionar
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (multiCutSelectorRef.current) {
                              multiCutSelectorRef.current.clearAll();
                            }
                          }}
                          disabled={isSubmitting}
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          title="Remover todos os recortes"
                        >
                          <IconX className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className={`transition-all duration-200 ${cutsCount === 0 ? "p-2" : ""}`}>
                    <MultiCutSelector ref={multiCutSelectorRef} control={form.control} disabled={isSubmitting} onCutsCountChange={handleSetCutsCount} />
                  </CardContent>
                </Card>

                {/* Airbrushing Section */}
                <Card className="bg-transparent">
                  <CardHeader className={`transition-all duration-200 ${airbrushingsCount === 0 ? "pt-3 pb-0" : ""}`}>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <IconSparkles className="h-5 w-5" />
                        Aerografias
                      </CardTitle>
                      {airbrushingsCount === 0 ? (
                        <Button
                          type="button"
                          onClick={() => {
                            if (multiAirbrushingSelectorRef.current) {
                              multiAirbrushingSelectorRef.current.addAirbrushing();
                            }
                          }}
                          disabled={isSubmitting}
                          size="sm"
                          className="gap-2"
                        >
                          <IconPlus className="h-4 w-4" />
                          Adicionar
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (multiAirbrushingSelectorRef.current) {
                              multiAirbrushingSelectorRef.current.clearAll();
                            }
                          }}
                          disabled={isSubmitting}
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          title="Remover todas as aerografias"
                        >
                          <IconX className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className={`transition-all duration-200 ${airbrushingsCount === 0 ? "p-2" : ""}`}>
                    <MultiAirbrushingSelector ref={multiAirbrushingSelectorRef} control={form.control} disabled={isSubmitting} onAirbrushingsCountChange={setAirbrushingsCount} />
                  </CardContent>
                </Card>

                {/* Financial Information Card */}
                <Card className="bg-transparent">
                  <CardHeader className={`transition-all duration-200 ${!isFinancialInfoOpen ? "pt-3 pb-0" : ""}`}>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <IconCurrencyReal className="h-5 w-5" />
                        Informações Financeiras
                      </CardTitle>
                      {!isFinancialInfoOpen ? (
                        <Button
                          type="button"
                          onClick={() => setIsFinancialInfoOpen(true)}
                          disabled={isSubmitting}
                          size="sm"
                          className="gap-2"
                        >
                          <IconPlus className="h-4 w-4" />
                          Adicionar
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setIsFinancialInfoOpen(false);
                            setBudgetFile([]);
                            setNfeFile([]);
                            setReceiptFile([]);
                          }}
                          disabled={isSubmitting}
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          title="Remover arquivos financeiros"
                        >
                          <IconX className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className={`transition-all duration-200 ${!isFinancialInfoOpen ? "p-2" : ""}`}>
                    {isFinancialInfoOpen ? (
                      <div className="space-y-4">
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
                              showPreview={false}
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
                              showPreview={false}
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
                              showPreview={false}
                              existingFiles={receiptFile}
                              variant="compact"
                              placeholder="Adicionar recibos"
                              label=""
                            />
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>

                {/* Artworks Card (optional) */}
                <Card className="bg-transparent">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <IconFile className="h-5 w-5" />
                      Artes (Opcional)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
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
              </form>
            </Form>
          </div>
        </div>
      </div>
    </div>
  );
};
