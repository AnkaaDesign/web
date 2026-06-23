import { useEffect, useMemo, useState, forwardRef, useImperativeHandle, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { IconAlertTriangle, IconCalendar, IconUser, IconAlertCircle } from "@tabler/icons-react";
import { debounce } from "../../../../utils";
import { createWarningFormData } from "@/utils/form-data-helper";
import type { Warning } from "../../../../types";
import type { WarningCreateFormData, WarningUpdateFormData } from "../../../../schemas";
import { warningCreateSchema, warningUpdateSchema } from "../../../../schemas";
import { routes } from "../../../../constants";
import { useWarningMutations } from "../../../../hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SeveritySelect } from "./severity-select";
import { CategorySelect } from "./category-select";
import { ReasonInput } from "./reason-input";
import { DescriptionTextarea } from "./description-textarea";
import { CollaboratorSelect } from "./collaborator-select";
import { FollowUpDatePicker } from "./follow-up-date-picker";
import { HrNotesTextarea } from "./hr-notes-textarea";
import { ActiveSwitch } from "./active-switch";
import { WitnessMultiSelect } from "./witness-multi-select";
import { SuspensionDaysInput } from "./suspension-days-input";
import { TerminationSelect } from "./termination-select";
import { FileUploadField, type FileWithPreview } from "@/components/common/file";

interface CreateModeProps {
  mode: "create";
  onSubmit?: (data: WarningCreateFormData) => Promise<void>;
  defaultValues?: Partial<WarningCreateFormData>;
}

interface UpdateModeProps {
  mode: "update";
  warning: Warning;
  onSubmit?: (data: WarningUpdateFormData) => Promise<void>;
  defaultValues?: Partial<WarningUpdateFormData>;
}

type WarningFormProps = (CreateModeProps | UpdateModeProps) & {
  isSubmitting?: boolean;
  onDirtyChange?: (isDirty: boolean) => void;
  onFormStateChange?: (formState: { isValid: boolean; isDirty: boolean }) => void;
};

export const WarningForm = forwardRef<{ submit: () => void; isSubmitting: boolean; isValid: boolean }, WarningFormProps>((props, ref) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [attachmentFiles, setAttachmentFiles] = useState<FileWithPreview[]>([]);
  const [supervisorFromSector, setSupervisorFromSector] = useState<any>(null);
  const { createAsync, updateAsync } = useWarningMutations();

  // Create a custom resolver based on mode
  const customResolver = useMemo(() => {
    if (props.mode === "create") {
      return zodResolver(warningCreateSchema);
    }
    return zodResolver(warningUpdateSchema);
  }, [props.mode]);

  // Default values for create mode - use null for optional fields to match schema expectations
  const createDefaults: WarningCreateFormData = {
    severity: "" as any,
    category: "" as any,
    reason: "",
    description: "",
    isActive: true,
    collaboratorId: "",
    supervisorId: "",
    followUpDate: new Date(),
    hrNotes: "",
    witnessIds: [],
    attachmentIds: [],
    suspensionDays: null,
    terminationId: null,
    ...(props.defaultValues || {}),
  };

  const updateDefaults: WarningUpdateFormData = props.mode === "update" ? {
    severity: props.warning.severity,
    category: props.warning.category,
    reason: props.warning.reason,
    description: props.warning.description || "",
    isActive: props.warning.isActive,
    collaboratorId: props.warning.collaboratorId,
    supervisorId: props.warning.supervisorId,
    followUpDate: new Date(props.warning.followUpDate),
    hrNotes: props.warning.hrNotes || "",
    witnessIds: props.warning.witness?.map((w: any) => w.id) || [],
    attachmentIds: props.warning.attachments?.map((f: any) => f.id) || [],
    resolvedAt: props.warning.resolvedAt ? new Date(props.warning.resolvedAt) : undefined,
    suspensionDays: props.warning.suspensionDays ?? null,
    terminationId: props.warning.terminationId ?? null,
    ...(props.defaultValues || {}),
  } : {} as WarningUpdateFormData;

  const form = useForm<WarningCreateFormData | WarningUpdateFormData>({
    resolver: customResolver,
    defaultValues: props.mode === "create" ? createDefaults : updateDefaults,
    mode: "onTouched", // Validate only after field is touched to avoid premature validation
    reValidateMode: "onChange", // After first validation, check on every change
    shouldFocusError: true, // Focus on first error field when validation fails
    criteriaMode: "all", // Show all errors for better UX
  });

  // Initialize attachment files from existing warning (update mode)
  useEffect(() => {
    if (props.mode === "update" && props.warning.attachments) {
      const existingFiles: FileWithPreview[] = props.warning.attachments.map((file: any) => {
        const fileObj = Object.assign(
          new File([new ArrayBuffer(0)], file.filename || file.originalName || "file", {
            type: file.mimetype || "application/octet-stream",
            lastModified: new Date(file.createdAt || Date.now()).getTime(),
          }),
          {
            id: file.id,
            uploaded: true,
            uploadedFileId: file.id,
            thumbnailUrl: file.thumbnailUrl,
          },
        ) as FileWithPreview;
        return fileObj;
      });
      setAttachmentFiles(existingFiles);
    }
  }, [props.mode, props.mode === "update" ? props.warning : null]);

  // Handle attachment file changes
  const handleAttachmentFilesChange = (files: FileWithPreview[]) => {
    setAttachmentFiles(files);
    // Store the files in local state for submission
    // IMPORTANT: Mark form as dirty when files change to enable submit button
    // Note: attachmentFiles is not part of the schema, files are handled separately via FormData
    // Clear attachmentIds when new files are selected
    form.setValue("attachmentIds", [], { shouldDirty: true, shouldTouch: true });
  };

  // Reset form when defaultValues change in update mode (e.g., new warning data loaded)
  const defaultValuesRef = useRef(props.mode === "update" ? updateDefaults : createDefaults);
  useEffect(() => {
    if (props.mode === "update") {
      const newDefaults = updateDefaults;
      if (newDefaults !== defaultValuesRef.current) {
        // Reset form with new defaults and mark form as untouched/pristine
        form.reset(newDefaults, {
          keepDefaultValues: false,
          keepDirty: false,
          keepTouched: false,
        });
        defaultValuesRef.current = newDefaults;
      }
    }
  }, [props.mode === "update" ? props.warning : null, form]);

  // Access formState properties during render for proper subscription
  const { isValid, isDirty, errors } = form.formState;

  const isSubmitting = props.isSubmitting || form.formState.isSubmitting;

  // URL state persistence for create mode
  const debouncedUpdateUrl = useMemo(
    () =>
      debounce((formData: Partial<WarningCreateFormData>) => {
        if (props.mode === "create") {
          const params = new URLSearchParams();
          if (formData.severity) params.set("severity", formData.severity);
          if (formData.category) params.set("category", formData.category);
          if (formData.collaboratorId) params.set("collaboratorId", formData.collaboratorId);
          if (formData.supervisorId) params.set("supervisorId", formData.supervisorId);
          setSearchParams(params, { replace: true });
        }
      }, 1000),
    [props.mode, setSearchParams],
  );

  // Debug validation errors in development
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' && Object.keys(errors).length > 0) {
      if (process.env.NODE_ENV === "development") {
        console.warn("Warning form validation errors:", {
          errors,
          currentValues: form.getValues(),
        });
      }
    }
  }, [errors, form]);

  // Track dirty state without triggering validation
  useEffect(() => {
    if (props.onDirtyChange && props.mode === "update") {
      props.onDirtyChange(isDirty);
    }
  }, [isDirty, props.onDirtyChange, props.mode]);

  // Track form state changes for submit button
  useEffect(() => {
    if (props.onFormStateChange) {
      props.onFormStateChange({
        isValid,
        isDirty,
      });
    }
  }, [isValid, isDirty, props.onFormStateChange]);

  // Initialize form from URL params (create mode only).
  // Must use shouldTouch + shouldValidate so the resolver runs and isValid updates.
  useEffect(() => {
    if (props.mode === "create") {
      const severity = searchParams.get("severity");
      const category = searchParams.get("category");
      const collaboratorId = searchParams.get("collaboratorId");
      const supervisorId = searchParams.get("supervisorId");

      const opts = { shouldDirty: true, shouldTouch: true, shouldValidate: true } as const;
      if (severity) form.setValue("severity", severity as any, opts);
      if (category) form.setValue("category", category as any, opts);
      if (collaboratorId) form.setValue("collaboratorId", collaboratorId, opts);
      if (supervisorId) form.setValue("supervisorId", supervisorId, opts);

      // Trigger full validation so isValid reflects the pre-populated state.
      if (severity || category || collaboratorId || supervisorId) {
        form.trigger();
      }
    }
  }, []);

  // Watch form changes and update URL (create mode only)
  useEffect(() => {
    if (props.mode === "create") {
      const subscription = form.watch((value: any) => {
        debouncedUpdateUrl(value as Partial<WarningCreateFormData>);
      });
      return () => subscription.unsubscribe();
    }
  }, [form, debouncedUpdateUrl, props.mode]);

  const handleSubmit = async (data: WarningCreateFormData | WarningUpdateFormData) => {
    try {
      // Get attachment files from form state
      const attachmentFilesFromForm = (data as any).attachmentFiles as FileWithPreview[] | undefined;
      const newAttachmentFiles = attachmentFilesFromForm?.filter(f => !f.uploaded && f instanceof File);

      // Get user data for the collaborator to organize files properly
      const collaboratorId = data.collaboratorId;
      // TODO: You'll need to fetch the user data based on collaboratorId
      // For now, using the collaboratorId as a fallback

      // Check if we have new files to upload
      if (newAttachmentFiles && newAttachmentFiles.length > 0) {
        // Remove attachmentFiles from data and prepare clean data object
        const { attachmentFiles: _, attachmentIds: __, ...dataWithoutFiles } = data as any;

        // Add existing attachment IDs for files that are already uploaded
        const existingAttachmentIds = attachmentFilesFromForm
          ?.filter(f => f.uploaded)
          ?.map(f => (f as any).uploadedFileId || f.id)
          ?.filter(Boolean) || [];

        if (existingAttachmentIds.length > 0) {
          dataWithoutFiles.existingAttachmentIds = existingAttachmentIds;
        }

        // Create FormData with proper context for file organization
        const formData = createWarningFormData(
          dataWithoutFiles,
          newAttachmentFiles,
          {
            id: collaboratorId,
            name: collaboratorId, // TODO: Replace with actual user name when available
          }
        );

        if (props.onSubmit) {
          await props.onSubmit(formData as any);
        } else {
          if (props.mode === "create") {
            const result = await createAsync(formData as any);
            // Success toast is handled automatically by API client
            navigate(routes.personnelDepartment.warnings.details(result.data?.id || ""));
          } else {
            await updateAsync({
              id: props.warning.id,
              data: formData as any,
            });
            // Success toast is handled automatically by API client
            navigate(routes.personnelDepartment.warnings.details(props.warning.id));
          }
        }
      } else {
        // No new files, send as regular JSON
        const { attachmentFiles: _, ...dataWithoutFiles } = data as any;

        if (props.onSubmit) {
          await props.onSubmit(dataWithoutFiles as any);
        } else {
          if (props.mode === "create") {
            const result = await createAsync(dataWithoutFiles as WarningCreateFormData);
            // Success toast is handled automatically by API client
            navigate(routes.personnelDepartment.warnings.details(result.data?.id || ""));
          } else {
            await updateAsync({
              id: props.warning.id,
              data: dataWithoutFiles as WarningUpdateFormData,
            });
            // Success toast is handled automatically by API client
            navigate(routes.personnelDepartment.warnings.details(props.warning.id));
          }
        }
      }
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error submitting form:", error);
      }
    }
  };

  // Expose form methods via ref
  useImperativeHandle(ref, () => ({
    submit: () => form.handleSubmit(handleSubmit)(),
    isSubmitting,
    isValid,
  }), [form, handleSubmit, isSubmitting, isValid]);

  return (
    <FormProvider {...form}>
      <form id="warning-form" onSubmit={form.handleSubmit(handleSubmit)} className="container mx-auto max-w-4xl">
        <button id="warning-form-submit" type="submit" className="hidden" disabled={isSubmitting} />

        <div className="space-y-4">
          {/* Card 1 — Advertência + Pessoas */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <IconAlertTriangle className="h-4 w-4 text-muted-foreground" />
                Advertência
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Severity, Category and Reason in one row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <SeveritySelect control={form.control} disabled={isSubmitting} required={props.mode === "create"} />
                <CategorySelect control={form.control} disabled={isSubmitting} required={props.mode === "create"} />
              </div>

              <SuspensionDaysInput control={form.control} disabled={isSubmitting} />

              <ReasonInput control={form.control} disabled={isSubmitting} required={props.mode === "create"} />
              <DescriptionTextarea control={form.control} disabled={isSubmitting} />

              <div className="space-y-4 pt-2">
                  <CollaboratorSelect
                    control={form.control}
                    disabled={isSubmitting}
                    required={props.mode === "create"}
                    initialCollaborator={props.mode === "update" ? props.warning.collaborator : undefined}
                    onUserSelect={(user) => {
                      const leader = (user as any)?.sector?.leader;
                      if (leader?.id) {
                        form.setValue("supervisorId", leader.id, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
                        setSupervisorFromSector(leader);
                      } else {
                        form.setValue("supervisorId", "", { shouldDirty: true, shouldTouch: true, shouldValidate: true });
                        setSupervisorFromSector(null);
                      }
                    }}
                  />

                  {/* Derived supervisor — read-only */}
                  {(() => {
                    const supervisor =
                      props.mode === "update"
                        ? props.warning.supervisor
                        : supervisorFromSector;
                    const collaboratorId = form.watch("collaboratorId");

                    if (!collaboratorId) return null;

                    if (!supervisor) {
                      return (
                        <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400 rounded-md px-3 py-2 border border-amber-200 dark:border-amber-800">
                          <IconAlertCircle className="h-4 w-4 shrink-0" />
                          Setor sem líder definido — atribua um líder ao setor do colaborador
                        </div>
                      );
                    }

                    return (
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <IconUser className="h-4 w-4" />
                          Supervisor
                        </div>
                        <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
                          <p className="font-medium">{(supervisor as any).name}</p>
                          {(supervisor as any).position?.name && (
                            <p className="text-xs text-muted-foreground">{(supervisor as any).position.name}</p>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                  <WitnessMultiSelect
                    control={form.control}
                    disabled={isSubmitting}
                    excludeIds={[form.watch("collaboratorId"), form.watch("supervisorId")].filter((id: string | undefined): id is string => Boolean(id))}
                    initialWitnesses={props.mode === "update" ? props.warning.witness : undefined}
                  />
              </div>
            </CardContent>
          </Card>

          {/* Card 2 — Acompanhamento + Anexos */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <IconCalendar className="h-4 w-4 text-muted-foreground" />
                Acompanhamento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FollowUpDatePicker control={form.control} disabled={isSubmitting} required={props.mode === "create"} />
              {props.mode === "update" && <ActiveSwitch control={form.control} disabled={isSubmitting} />}

              <TerminationSelect disabled={isSubmitting} collaboratorId={form.watch("collaboratorId") || undefined} />
              <HrNotesTextarea control={form.control} disabled={isSubmitting} />

              <div>
                <label className="text-sm font-medium mb-2 block">Anexos</label>
                <FileUploadField
                  onFilesChange={handleAttachmentFilesChange}
                  existingFiles={attachmentFiles}
                  maxFiles={10}
                  disabled={isSubmitting}
                  showPreview
                  variant="compact"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </form>
    </FormProvider>
  );
});

WarningForm.displayName = "WarningForm";
