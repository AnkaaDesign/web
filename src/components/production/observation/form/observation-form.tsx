import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useObservation, useObservationMutations } from "../../../../hooks";
import type { ObservationCreateFormData, ObservationUpdateFormData } from "../../../../schemas";
import { observationCreateSchema, observationUpdateSchema } from "../../../../schemas";
import { routes, FAVORITE_PAGES } from "../../../../constants";
import { PageHeaderWithFavorite } from "@/components/ui/page-header-with-favorite";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/ui/loading";
import { FileUploadField, type FileWithPreview } from "@/components/file";
import { TaskSelector } from "./task-selector";
import { IconAlertCircle, IconPaperclip, IconArrowLeft, IconCheck, IconX } from "@tabler/icons-react";
import { cn, backendFileToFileWithPreview } from "@/lib/utils";
import { toast } from "sonner";

// Helper function for file size formatting
const formatFileSize = (bytes: number): string => {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

interface ObservationFormProps {
  observationId?: string;
  mode: "create" | "edit";
  initialTaskId?: string;
  onSuccess?: (observation: any) => void;
  onCancel?: () => void;
  className?: string;
}

export function ObservationForm({ observationId, mode, initialTaskId, onSuccess, onCancel, className }: ObservationFormProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // State for task selection
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set(initialTaskId ? [initialTaskId] : []));
  const [isTaskSelectorOpen, setIsTaskSelectorOpen] = useState(!initialTaskId);

  // State for file uploads
  const [uploadedFiles, setUploadedFiles] = useState<FileWithPreview[]>([]);
  const [_uploadedFileIds, setUploadedFileIds] = useState<string[]>([]);

  // Fetch existing observation if editing
  const { data: observationResponse, isLoading: isLoadingObservation } = useObservation(observationId || "", {
    enabled: mode === "edit" && !!observationId,
    include: {
      task: {
        include: {
          customer: true,
          sector: true,
        },
      },
      files: true,
    },
  });

  const observation = observationResponse?.data;

  // Mutations
  const { createAsync, updateAsync } = useObservationMutations();

  // Set up form with appropriate schema
  const formSchema = mode === "create" ? observationCreateSchema : observationUpdateSchema;
  const form = useForm<ObservationCreateFormData | ObservationUpdateFormData>({
    resolver: zodResolver(formSchema),
    mode: "onChange",
    defaultValues: {
      description: "",
      taskId: initialTaskId || "",
      fileIds: [],
    },
  });

  // Initialize form with existing data when editing
  useEffect(() => {
    if (mode === "edit" && observation) {
      form.reset({
        description: observation.description,
        taskId: observation.taskId,
        fileIds: observation.files?.map((f) => f.id) || [],
      });

      // Set selected task
      setSelectedTasks(new Set([observation.taskId]));
      setIsTaskSelectorOpen(false);

      // Set uploaded files
      const files: FileWithPreview[] = observation.files?.map(backendFileToFileWithPreview) || [];

      setUploadedFiles(files);
      setUploadedFileIds(files.map((f) => f.id));
    }
  }, [mode, observation, form]);

  // Get initial task ID from URL params
  useEffect(() => {
    const taskIdFromUrl = searchParams.get("taskId");
    if (taskIdFromUrl && mode === "create") {
      setSelectedTasks(new Set([taskIdFromUrl]));
      setIsTaskSelectorOpen(false);
      form.setValue("taskId", taskIdFromUrl);
    }
  }, [searchParams, mode, form]);

  // Handle task selection
  const handleTaskSelection = (taskId: string) => {
    const isSelected = selectedTasks.has(taskId);

    if (isSelected) {
      // Deselect task
      setSelectedTasks(new Set());
      form.setValue("taskId", "");
    } else {
      // Select task (only one can be selected)
      setSelectedTasks(new Set([taskId]));
      form.setValue("taskId", taskId);
      setIsTaskSelectorOpen(false);
    }
  };

  // Handle select all (not really applicable for single selection)
  const handleSelectAll = () => {
    // No-op for observation form since we only allow one task
  };

  // Handle file changes
  const handleFilesChange = (files: FileWithPreview[]) => {
    setUploadedFiles(files);
    const fileIds = files.map((f) => f.id);
    setUploadedFileIds(fileIds);
    form.setValue("fileIds", fileIds);
  };

  // Handle form submission
  const handleSubmit = async (data: ObservationCreateFormData | ObservationUpdateFormData) => {
    try {
      let result;

      if (mode === "create") {
        result = await createAsync(data as ObservationCreateFormData);
      } else {
        result = await updateAsync({
          id: observationId!,
          data: data as ObservationUpdateFormData,
        });
      }

      // Success toast is handled automatically by API client

      if (onSuccess && result?.data) {
        onSuccess(result.data);
      } else if (result?.data) {
        navigate(routes.production.observations.details(result.data.id));
      }
    } catch (error) {
      toast.error(`Erro ao ${mode === "create" ? "criar" : "atualizar"} observação`);
    }
  };

  // Get selected task for display
  const selectedTaskId = Array.from(selectedTasks)[0];

  // Loading state
  if (mode === "edit" && isLoadingObservation) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex-shrink-0">
        <PageHeaderWithFavorite
          title={mode === "create" ? "Nova Observação" : "Editar Observação"}
          icon={IconAlertCircle}
          favoritePage={mode === "create" ? FAVORITE_PAGES.PRODUCAO_OBSERVACOES_CADASTRAR : undefined}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Produção", href: routes.production.root },
            { label: "Observações", href: routes.production.observations.root },
            { label: mode === "create" ? "Criar" : "Editar" },
          ]}
          actions={[
            {
              key: "cancel",
              label: "Cancelar",
              icon: IconArrowLeft,
              onClick: onCancel || (() => navigate(routes.production.observations.root)),
              variant: "outline",
            },
            {
              key: "submit",
              label: mode === "create" ? "Cadastrar" : "Salvar",
              icon: IconCheck,
              onClick: () => {
                const formElement = document.getElementById("observation-form") as HTMLFormElement;
                if (formElement) {
                  formElement.requestSubmit();
                }
              },
              variant: "default",
              disabled: !form.formState.isValid || form.formState.isSubmitting,
            },
          ]}
        />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <Card className={cn("h-full shadow-sm border border-border", className)}>
          {mode === "edit" && observation?.task && (
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-3">
                <Badge variant="outline" className="ml-auto">
                  {observation.task.name}
                </Badge>
              </CardTitle>
            </CardHeader>
          )}

          <CardContent className="flex-1 flex flex-col overflow-hidden">
            <Form {...form}>
              <form id="observation-form" onSubmit={form.handleSubmit(handleSubmit)} className="flex-1 flex flex-col overflow-hidden space-y-6">
                {/* First Row: Description and File Upload Section - Horizontal layout */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-shrink-0">
                  {/* Description Field */}
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Descrição da Observação</FormLabel>
                        <FormControl>
                          <Textarea
                            value={field.value}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            name={field.name}
                            ref={field.ref}
                            placeholder="Descreva detalhadamente a observação sobre a tarefa..."
                            className="min-h-[120px] resize-none"
                            maxLength={1000}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* File Upload Section with horizontal layout */}
                  <FormItem className="flex flex-col">
                    <FormLabel className="flex items-center gap-2">
                      <IconPaperclip className="h-4 w-4" />
                      Arquivos de Evidência (Opcional)
                    </FormLabel>
                    <FormControl>
                      <div className="flex gap-4">
                        {/* Upload area on the left */}
                        <div className="flex-shrink-0 w-1/2">
                          <FileUploadField
                            onFilesChange={handleFilesChange}
                            existingFiles={[]}
                            maxFiles={10}
                            showPreview={false}
                            showFiles={false} // Disable built-in file display
                            variant="compact"
                            placeholder="Adicione arquivos"
                            label=""
                          />
                        </div>

                        {/* File list on the right - compact custom display */}
                        {uploadedFiles.length > 0 && (
                          <div className="flex-1 border-2 border-dashed rounded-lg p-3 bg-green-50/50 dark:bg-green-950/20 max-h-[120px] overflow-y-auto border-green-200 dark:border-green-800">
                            <div className="flex items-center gap-2 mb-2">
                              <IconPaperclip className="h-4 w-4 text-green-600" />
                              <span className="text-sm font-medium text-green-700 dark:text-green-400">
                                {uploadedFiles.length} arquivo{uploadedFiles.length > 1 ? "s" : ""} selecionado{uploadedFiles.length > 1 ? "s" : ""}
                              </span>
                            </div>
                            <div className="space-y-1">
                              {uploadedFiles.map((file, index) => (
                                <div key={file.id || index} className="flex items-center gap-2 text-xs bg-white/60 dark:bg-black/20 rounded px-2 py-1">
                                  <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0"></div>
                                  <span className="truncate flex-1 text-foreground/80" title={file.name}>
                                    {file.name}
                                  </span>
                                  <span className="text-muted-foreground text-[10px] flex-shrink-0">{formatFileSize(file.size)}</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const newFiles = uploadedFiles.filter((f) => f.id !== file.id);
                                      handleFilesChange(newFiles);
                                    }}
                                    className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
                                  >
                                    <IconX className="h-3 w-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </FormControl>
                  </FormItem>
                </div>

                {/* Second Row: Task Selection Section */}
                {mode === "create" && (
                  <div className="mt-6">
                    {!isTaskSelectorOpen && selectedTaskId ? (
                      <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
                        <div className="flex items-center gap-3">
                          <IconCheck className="h-5 w-5 text-green-600" />
                          <div>
                            <div className="font-medium">Tarefa selecionada</div>
                            <div className="text-sm text-muted-foreground">Clique em "Alterar Tarefa" para escolher uma tarefa diferente</div>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setSelectedTasks(new Set()); // Clear selection when reopening
                            form.setValue("taskId", "");
                            setIsTaskSelectorOpen(true);
                          }}
                        >
                          Alterar Tarefa
                        </Button>
                      </div>
                    ) : (
                      <div className="rounded-lg overflow-hidden" style={{ height: "540px" }}>
                        <TaskSelector selectedTasks={selectedTasks} onSelectTask={handleTaskSelection} onSelectAll={handleSelectAll} className="h-full" />
                      </div>
                    )}
                  </div>
                )}
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
