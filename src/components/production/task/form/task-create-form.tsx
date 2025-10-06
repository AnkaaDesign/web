import { useState, useCallback, useRef } from "react";
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
  IconCurrencyReal,
  IconReceipt,
  IconFileInvoice,
} from "@tabler/icons-react";
import type { TaskCreateFormData } from "../../../../schemas";
import { taskCreateSchema } from "../../../../schemas";
import { useTaskMutations, useTaskFormUrlState, useLayoutMutations } from "../../../../hooks";
import { TASK_STATUS } from "../../../../constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { SizeInput } from "@/components/ui/size-input";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { CustomerSelector } from "./customer-selector";
import { SectorSelector } from "./sector-selector";
import { ServiceSelectorFixed } from "./service-selector";
import { MultiCutSelector, type MultiCutSelectorRef } from "./multi-cut-selector";
import { GeneralPaintingSelector } from "./general-painting-selector";
import { LogoPaintsSelector } from "./logo-paints-selector";
import { MultiAirbrushingSelector, type MultiAirbrushingSelectorRef } from "./multi-airbrushing-selector";
import { FileUploadField, type FileWithPreview } from "@/components/file";
import { Badge } from "@/components/ui/badge";
import { uploadSingleFile } from "../../../../api-client";
import { toast } from "sonner";
import { LayoutForm } from "@/components/production/layout/layout-form";
import { FormMoneyInput } from "@/components/ui/form-money-input";

export const TaskCreateForm = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<FileWithPreview[]>([]);
  const [budgetFile, setBudgetFile] = useState<FileWithPreview[]>([]);
  const [nfeFile, setNfeFile] = useState<FileWithPreview[]>([]);
  const [receiptFile, setReceiptFile] = useState<FileWithPreview[]>([]);
  const multiCutSelectorRef = useRef<MultiCutSelectorRef>(null);
  const multiAirbrushingSelectorRef = useRef<MultiAirbrushingSelectorRef>(null);
  const [cutsCount, setCutsCount] = useState(0);
  const [airbrushingsCount, setAirbrushingsCount] = useState(0);
  const [selectedLayoutSide, setSelectedLayoutSide] = useState<"left" | "right" | "back">("left");
  const [isLayoutOpen, setIsLayoutOpen] = useState(false);
  const [layouts, setLayouts] = useState<{
    left?: any;
    right?: any;
    back?: any;
  }>({
    left: { height: 2.4, sections: [{ width: 8, hasDoor: false }], photoId: null },
    right: { height: 2.4, sections: [{ width: 8, hasDoor: false }], photoId: null },
    back: { height: 2.42, sections: [{ width: 2.42, hasDoor: false }], photoId: null },  // Back defaults to 2.42m x 2.42m
  });

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
        garageId: null,
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
        // Create new object with all properties
        const updated: FileWithPreview = {
          ...f,
          ...updates,
          // Explicitly preserve File properties that might not spread correctly
          name: f.name,
          size: f.size,
          type: f.type,
          lastModified: f.lastModified,
        } as FileWithPreview;
        return updated;
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
      plate: urlState.plate,
      details: urlState.details,
      entryDate: urlState.entryDate || null,
      term: urlState.term || null,
      services: urlState.services || [],
      cuts: urlState.cuts,
      airbrushings: urlState.airbrushings || [],
      generalPaintingId: urlState.generalPaintingId,
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

  // Handle budget file upload
  const handleBudgetFileChange = async (files: FileWithPreview[]) => {
    setBudgetFile(files);

    const newFiles = files.filter((file) => !file.uploaded && !file.uploadProgress && !file.error);

    for (const file of newFiles) {
      try {
        setBudgetFile((prev) =>
          updateFileInList(prev, file.id, { uploadProgress: 0, uploaded: false })
        );

        const result = await uploadSingleFile(file, {
          onProgress: (progress) => {
            setBudgetFile((prev) =>
              updateFileInList(prev, file.id, { uploadProgress: progress.percentage })
            );
          },
        });

        if (result.success && result.data) {
          const uploadedFile = result.data;
          setBudgetFile((prev) =>
            updateFileInList(prev, file.id, {
              uploadedFileId: uploadedFile.id,
              uploaded: true,
              uploadProgress: 100,
              thumbnailUrl: uploadedFile.thumbnailUrl || undefined,
              error: undefined,
            })
          );
          form.setValue("budgetId", uploadedFile.id);
        } else {
          throw new Error(result.message || "Upload failed");
        }
      } catch (error) {
        console.error("Budget file upload error:", error);
        setBudgetFile((prev) =>
          updateFileInList(prev, file.id, {
            error: "Erro ao enviar arquivo",
            uploadProgress: 0,
            uploaded: false,
          })
        );
      }
    }

    // Clear budgetId if no files
    if (files.length === 0) {
      form.setValue("budgetId", null);
    }
  };

  // Handle NFe file upload
  const handleNfeFileChange = async (files: FileWithPreview[]) => {
    setNfeFile(files);

    const newFiles = files.filter((file) => !file.uploaded && !file.uploadProgress && !file.error);

    for (const file of newFiles) {
      try {
        setNfeFile((prev) =>
          updateFileInList(prev, file.id, { uploadProgress: 0, uploaded: false })
        );

        const result = await uploadSingleFile(file, {
          onProgress: (progress) => {
            setNfeFile((prev) =>
              updateFileInList(prev, file.id, { uploadProgress: progress.percentage })
            );
          },
        });

        if (result.success && result.data) {
          const uploadedFile = result.data;
          setNfeFile((prev) =>
            updateFileInList(prev, file.id, {
              uploadedFileId: uploadedFile.id,
              uploaded: true,
              uploadProgress: 100,
              thumbnailUrl: uploadedFile.thumbnailUrl || undefined,
              error: undefined,
            })
          );
          form.setValue("nfeId", uploadedFile.id);
        } else {
          throw new Error(result.message || "Upload failed");
        }
      } catch (error) {
        console.error("NFe file upload error:", error);
        setNfeFile((prev) =>
          updateFileInList(prev, file.id, {
            error: "Erro ao enviar arquivo",
            uploadProgress: 0,
            uploaded: false,
          })
        );
      }
    }

    // Clear nfeId if no files
    if (files.length === 0) {
      form.setValue("nfeId", null);
    }
  };

  // Handle receipt file upload
  const handleReceiptFileChange = async (files: FileWithPreview[]) => {
    setReceiptFile(files);

    const newFiles = files.filter((file) => !file.uploaded && !file.uploadProgress && !file.error);

    for (const file of newFiles) {
      try {
        setReceiptFile((prev) =>
          updateFileInList(prev, file.id, { uploadProgress: 0, uploaded: false })
        );

        const result = await uploadSingleFile(file, {
          onProgress: (progress) => {
            setReceiptFile((prev) =>
              updateFileInList(prev, file.id, { uploadProgress: progress.percentage })
            );
          },
        });

        if (result.success && result.data) {
          const uploadedFile = result.data;
          setReceiptFile((prev) =>
            updateFileInList(prev, file.id, {
              uploadedFileId: uploadedFile.id,
              uploaded: true,
              uploadProgress: 100,
              thumbnailUrl: uploadedFile.thumbnailUrl || undefined,
              error: undefined,
            })
          );
          form.setValue("receiptId", uploadedFile.id);
        } else {
          throw new Error(result.message || "Upload failed");
        }
      } catch (error) {
        console.error("Receipt file upload error:", error);
        setReceiptFile((prev) =>
          updateFileInList(prev, file.id, {
            error: "Erro ao enviar arquivo",
            uploadProgress: 0,
            uploaded: false,
          })
        );
      }
    }

    // Clear receiptId if no files
    if (files.length === 0) {
      form.setValue("receiptId", null);
    }
  };

  // Handle file changes and upload
  const handleFilesChange = async (files: FileWithPreview[]) => {
    setUploadedFiles(files);

    // Update file IDs based on current files
    const currentFileIds = files.filter((f) => f.uploadedFileId).map((f) => f.uploadedFileId as string);

    // Update URL state with uploaded file IDs
    urlState.updateArtworkIds(currentFileIds);

    // Upload new files that haven't been uploaded yet
    const newFiles = files.filter((file) => !file.uploaded && !file.uploadProgress && !file.error);

    for (const file of newFiles) {
      try {
        // Update file with upload progress
        setUploadedFiles((prev) =>
          updateFileInList(prev, file.id, {
            uploadProgress: 0,
            uploaded: false,
          }),
        );

        const result = await uploadSingleFile(file, {
          onProgress: (progress) => {
            setUploadedFiles((prev) =>
              updateFileInList(prev, file.id, {
                uploadProgress: progress.percentage,
              }),
            );
          },
        });

        if (result.success && result.data) {
          const uploadedFile = result.data; // Update file with uploaded data
          setUploadedFiles((prev) =>
            updateFileInList(prev, file.id, {
              uploadedFileId: uploadedFile.id,
              uploaded: true,
              uploadProgress: 100,
              thumbnailUrl: uploadedFile.thumbnailUrl || undefined,
              error: undefined,
            }),
          );

          // Update URL state with the new file ID
          const currentIds = urlState.artworkIds;
          if (!currentIds.includes(uploadedFile.id)) {
            urlState.updateArtworkIds([...currentIds, uploadedFile.id]);
          }
        } else {
          throw new Error(result.message || "Upload failed");
        }
      } catch (error) {
        console.error("File upload error:", error);

        // Update file with error
        setUploadedFiles((prev) =>
          updateFileInList(prev, file.id, {
            error: "Erro ao enviar arquivo",
            uploadProgress: 0,
            uploaded: false,
          }),
        );
      }
    }
  };

  // Handle form submission
  const handleSubmit = useCallback(
    async (data: TaskCreateFormData) => {
      try {
        setIsSubmitting(true);

        // Debug logging});

        // Use form data directly
        const formData = data;
        const result = await createAsync(formData); // Navigate to the task list after successful creation
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

              if (!layoutData || !layoutData.sections) {
                console.log(`❌ No ${side} layout data or sections`);
                return null;
              }

              // Ensure sections is an actual array, not an object
              let sectionsArray = layoutData.sections;
              if (!Array.isArray(sectionsArray)) {
                console.log(`⚠️ Converting sections object to array for ${side}`);
                sectionsArray = Object.values(sectionsArray);
              }

              // Create a proper array (not object) for sections
              const sectionsAsArray = sectionsArray.map((section: any, index: number) => {
                const transformedSection = {
                  width: typeof section.width === 'number' ? section.width : 1, // Width in meters
                  isDoor: typeof section.isDoor === 'boolean' ? section.isDoor : false,
                  doorOffset: section.isDoor && typeof section.doorOffset === 'number' ? section.doorOffset : null,
                  position: typeof section.position === 'number' ? section.position : index,
                };
                console.log(`  Section ${index}:`, section, '=>', transformedSection);
                return transformedSection;
              });

              const transformed = {
                height: typeof layoutData.height === 'number' ? layoutData.height : 2.4, // Height in meters
                sections: sectionsAsArray, // Ensure this is an actual array
                photoId: layoutData.photoId || null,
              };

              console.log(`✅ Transformed ${side} layout (array check):`, {
                ...transformed,
                sectionsIsArray: Array.isArray(transformed.sections),
                sectionsLength: transformed.sections.length
              });

              // Force JSON serialization to verify structure
              const jsonString = JSON.stringify(transformed);
              console.log(`🔍 JSON serialized ${side} layout:`, jsonString);

              // CRITICAL FIX: Clone the object to ensure arrays don't get corrupted by Axios
              const finalData = JSON.parse(JSON.stringify(transformed));
              console.log(`🛡️ Final data after JSON roundtrip:`, finalData, 'sections is array:', Array.isArray(finalData.sections));

              return finalData;
            };

            // Create layouts for each side that has data
            console.log(`🔍 Checking left layout:`, layouts.left, 'Has sections:', layouts.left?.sections, 'Length:', layouts.left?.sections?.length);
            if (layouts.left && layouts.left.sections && layouts.left.sections.length > 0) {
              console.log(`✅ Creating left layout`);
              const leftLayoutData = transformLayoutForAPI(layouts.left, 'left');
              if (leftLayoutData) {
                layoutPromises.push(createOrUpdateTruckLayout({ truckId, side: 'left', data: leftLayoutData }));
              }
            } else {
              console.log(`❌ Skipping left layout - no valid data`);
            }

            console.log(`🔍 Checking right layout:`, layouts.right, 'Has sections:', layouts.right?.sections, 'Length:', layouts.right?.sections?.length);
            if (layouts.right && layouts.right.sections && layouts.right.sections.length > 0) {
              console.log(`✅ Creating right layout`);
              const rightLayoutData = transformLayoutForAPI(layouts.right, 'right');
              if (rightLayoutData) {
                layoutPromises.push(createOrUpdateTruckLayout({ truckId, side: 'right', data: rightLayoutData }));
              }
            } else {
              console.log(`❌ Skipping right layout - no valid data`);
            }

            console.log(`🔍 Checking back layout:`, layouts.back, 'Has sections:', layouts.back?.sections, 'Length:', layouts.back?.sections?.length);
            if (layouts.back && layouts.back.sections && layouts.back.sections.length > 0) {
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

          // Success message
          const layoutCount = truckId && layouts ? Object.keys(layouts).filter(side =>
            layouts[side as keyof typeof layouts]?.sections?.length > 0
          ).length : 0;

          if (formData.cuts && formData.cuts.length > 0) {
            const totalCuts = formData.cuts.reduce((sum, cut) => sum + (cut.quantity || 1), 0);
            if (layoutCount > 0) {
              // Success toast for task creation is handled automatically by API client
              toast.success(`${totalCuts} corte(s) e ${layoutCount} layout(s) criados junto com a tarefa!`);
            } else {
              // Success toast for task creation is handled automatically by API client
              toast.success(`${totalCuts} corte(s) criados junto com a tarefa!`);
            }
          } else {
            if (layoutCount > 0) {
              // Success toast for task creation is handled automatically by API client
              toast.success(`${layoutCount} layout(s) criados junto com a tarefa!`);
            }
            // Success toast for task creation is handled automatically by API client
          }

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
    [createAsync, createOrUpdateTruckLayout, layouts, urlState],
  );

  const handleCancel = useCallback(() => {
    window.location.href = "/producao/cronograma";
  }, []);

  // Get form state
  const { formState } = form;
  const hasErrors = Object.keys(formState.errors).length > 0;
  const isDirty = formState.isDirty;

  // Debug form state// Navigation actions
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
      disabled: isSubmitting,
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
                            <FormLabel>
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
                      <CustomerSelector control={form.control} disabled={isSubmitting} required />
                    </div>

                    {/* Serial Number and Plate */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Serial Number */}
                      <FormField
                        control={form.control}
                        name="serialNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Número de Série</FormLabel>
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

                      {/* Plate (optional) */}
                      <FormField
                        control={form.control}
                        name="plate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Placa</FormLabel>
                            <FormControl>
                              <Input
                                type="plate"
                                value={field.value || ""}
                                onChange={(value) => {
                                  // Input component with type="plate" passes the cleaned value directly
                                  field.onChange(value || null);
                                  urlState.updatePlate(value ? String(value) : "");
                                }}
                                disabled={isSubmitting}
                                className="bg-transparent"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Sector */}
                    <SectorSelector control={form.control} disabled={isSubmitting} productionOnly />

                    {/* Details */}
                    <FormField
                      control={form.control}
                      name="details"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Detalhes</FormLabel>
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

                {/* Dates Card */}
                <Card className="bg-transparent">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <IconCalendar className="h-5 w-5" />
                      Datas
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Entry Date - Date only */}
                      <FormField
                        control={form.control}
                        name="entryDate"
                        render={({ field }) => (
                          <DateTimeInput field={field} label="Data de Entrada" placeholder="Selecione a data de entrada" disabled={isSubmitting} mode="date" context="start" />
                        )}
                      />

                      {/* Deadline - DateTime */}
                      <FormField
                        control={form.control}
                        name="term"
                        render={({ field }) => (
                          <DateTimeInput field={field} label="Prazo de Entrega" placeholder="Selecione o prazo de entrega" disabled={isSubmitting} mode="datetime" context="due" />
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Financial Information Card */}
                <Card className="bg-transparent">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <IconCurrencyReal className="h-5 w-5" />
                      Informações Financeiras
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Price */}
                    <FormMoneyInput
                      name="price"
                      label="Valor Total"
                      placeholder="R$ 0,00"
                      disabled={isSubmitting}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Budget File */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium flex items-center gap-2">
                          <IconFileInvoice className="h-4 w-4 text-muted-foreground" />
                          Orçamento
                        </label>
                        <FileUploadField
                          onFilesChange={handleBudgetFileChange}
                          maxFiles={1}
                          disabled={isSubmitting}
                          showPreview={false}
                          existingFiles={budgetFile}
                          variant="compact"
                          placeholder="Adicionar orçamento"
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
                          maxFiles={1}
                          disabled={isSubmitting}
                          showPreview={false}
                          existingFiles={nfeFile}
                          variant="compact"
                          placeholder="Adicionar NFe"
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
                          maxFiles={1}
                          disabled={isSubmitting}
                          showPreview={false}
                          existingFiles={receiptFile}
                          variant="compact"
                          placeholder="Adicionar recibo"
                          label=""
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Services Card */}
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
                          <ServiceSelectorFixed control={form.control} disabled={isSubmitting} />
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                {/* Layout Section */}
                <Card className="bg-transparent">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <IconRuler className="h-5 w-5" />
                        Layout do Caminhão
                      </CardTitle>
                      {!isLayoutOpen && (
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
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
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
                                if (!currentLayout || !currentLayout.sections) return "0,00m";
                                const totalWidth = currentLayout.sections.reduce((sum, s) => sum + (s.width || 0), 0);
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
                        />

                        <div className="flex justify-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setIsLayoutOpen(false);
                              // Reset layouts to default values
                              setLayouts({
                                left: { height: 2.4, sections: [{ width: 8, hasDoor: false }], photoId: null },
                                right: { height: 2.4, sections: [{ width: 8, hasDoor: false }], photoId: null },
                                back: { height: 2.42, sections: [{ width: 2.42, hasDoor: false }], photoId: null },
                              });
                            }}
                            disabled={isSubmitting}
                          >
                            Remover
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>

                {/* Cut Plans Section - Improved Multiple Cuts Support */}
                <Card className="bg-transparent">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <IconScissors className="h-5 w-5" />
                        Recortes
                      </CardTitle>
                      <Button
                        type="button"
                        onClick={() => {
                          if (multiCutSelectorRef.current) {
                            multiCutSelectorRef.current.addCut();
                          } else {
                            console.error("❌ MultiCutSelector ref not available!");
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
                    <MultiCutSelector ref={multiCutSelectorRef} control={form.control} disabled={isSubmitting} onCutsCountChange={handleSetCutsCount} />
                  </CardContent>
                </Card>

                {/* Airbrushing Section */}
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
