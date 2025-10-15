import { useEffect, useMemo, useState, forwardRef, useImperativeHandle, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { debounce } from "../../../../utils";
import { createWarningFormData } from "@/utils/form-data-helper";

import type { Warning } from "../../../../types";
import type { WarningCreateFormData, WarningUpdateFormData } from "../../../../schemas";
import { warningCreateSchema, warningUpdateSchema } from "../../../../schemas";
import { routes } from "../../../../constants";
import { useWarningMutations, useUser } from "../../../../hooks";

import { Form } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

import { SeveritySelect } from "./severity-select";
import { CategorySelect } from "./category-select";
import { ReasonInput } from "./reason-input";
import { DescriptionTextarea } from "./description-textarea";
import { CollaboratorSelect } from "./collaborator-select";
import { SupervisorSelect } from "./supervisor-select";
import { FollowUpDatePicker } from "./follow-up-date-picker";
import { HrNotesTextarea } from "./hr-notes-textarea";
import { ActiveSwitch } from "./active-switch";
import { WitnessMultiSelect } from "./witness-multi-select";
import { FileUploadField, type FileWithPreview } from "@/components/file";

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
    severity: undefined,
    category: undefined,
    reason: "",
    description: "",
    isActive: true,
    collaboratorId: "",
    supervisorId: "",
    followUpDate: new Date(),
    hrNotes: "",
    witnessIds: [],
    attachmentIds: [],
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
    // Store the files in form state for submission (not the IDs)
    // IMPORTANT: Mark form as dirty when files change to enable submit button
    form.setValue("attachmentFiles", files, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
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

  // Expose form methods via ref
  useImperativeHandle(ref, () => ({
    submit: () => form.handleSubmit(handleSubmit)(),
    isSubmitting,
    isValid,
  }));

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
    if (process.env.NODE_ENV === "development" && Object.keys(errors).length > 0) {
      console.log("Warning form validation errors:", {
        errors,
        currentValues: form.getValues(),
      });
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

  // Initialize form from URL params (create mode only)
  useEffect(() => {
    if (props.mode === "create") {
      const severity = searchParams.get("severity");
      const category = searchParams.get("category");
      const collaboratorId = searchParams.get("collaboratorId");
      const supervisorId = searchParams.get("supervisorId");

      if (severity) form.setValue("severity", severity as any);
      if (category) form.setValue("category", category as any);
      if (collaboratorId) form.setValue("collaboratorId", collaboratorId);
      if (supervisorId) form.setValue("supervisorId", supervisorId);
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
            navigate(routes.humanResources.warnings.details(result.data?.id || ""));
          } else {
            await updateAsync({
              id: props.warning.id,
              data: formData as any,
            });
            // Success toast is handled automatically by API client
            navigate(routes.humanResources.warnings.details(props.warning.id));
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
            navigate(routes.humanResources.warnings.details(result.data?.id || ""));
          } else {
            await updateAsync({
              id: props.warning.id,
              data: dataWithoutFiles as WarningUpdateFormData,
            });
            // Success toast is handled automatically by API client
            navigate(routes.humanResources.warnings.details(props.warning.id));
          }
        }
      }
    } catch (error) {
      console.error("Error submitting form:", error);
    }
  };

  return (
    <Card className="h-full flex flex-col shadow-sm border border-border overflow-hidden">
      <div className="flex-1 overflow-y-auto p-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
              {/* Basic Information Card */}
              <Card className="bg-transparent">
            <CardHeader>
              <CardTitle>Informações da Advertência</CardTitle>
              <CardDescription>Preencha os detalhes da advertência ao colaborador</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Reason - First field */}
              <ReasonInput control={form.control} disabled={isSubmitting} required={props.mode === "create"} />

              {/* Severity and Category */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <SeveritySelect control={form.control} disabled={isSubmitting} required={props.mode === "create"} />

                <CategorySelect control={form.control} disabled={isSubmitting} required={props.mode === "create"} />
              </div>

              {/* Description */}
              <DescriptionTextarea control={form.control} disabled={isSubmitting} />
            </CardContent>
          </Card>

          {/* People Involved Card */}
          <Card className="bg-transparent">
            <CardHeader>
              <CardTitle>Pessoas Envolvidas</CardTitle>
              <CardDescription>Selecione o colaborador, supervisor e testemunhas</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Collaborator and Supervisor */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <CollaboratorSelect
                  control={form.control}
                  disabled={isSubmitting}
                  required={props.mode === "create"}
                  initialCollaborator={props.mode === "update" ? props.warning.collaborator : undefined}
                />

                <SupervisorSelect
                  control={form.control}
                  disabled={isSubmitting}
                  required={props.mode === "create"}
                  initialSupervisor={props.mode === "update" ? props.warning.supervisor : undefined}
                />
              </div>

              {/* Witnesses */}
              <WitnessMultiSelect
                control={form.control}
                disabled={isSubmitting}
                excludeIds={[form.watch("collaboratorId"), form.watch("supervisorId")].filter((id: string | undefined): id is string => Boolean(id))}
                initialWitnesses={props.mode === "update" ? props.warning.witness : undefined}
              />
            </CardContent>
          </Card>

          {/* Follow-up and Notes Card */}
          <Card className="bg-transparent">
            <CardHeader>
              <CardTitle>Acompanhamento</CardTitle>
              <CardDescription>Defina a data de acompanhamento e adicione observações</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Follow-up Date and Status */}
              {props.mode === "create" ? (
                <FollowUpDatePicker control={form.control} disabled={isSubmitting} required={props.mode === "create"} />
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <FollowUpDatePicker control={form.control} disabled={isSubmitting} required={false} />

                  <ActiveSwitch control={form.control} disabled={isSubmitting} />
                </div>
              )}

              {/* HR Notes */}
              <HrNotesTextarea control={form.control} disabled={isSubmitting} />

              {/* File Upload */}
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
        </form>
      </Form>
    </div>
    </Card>
  );
});

WarningForm.displayName = "WarningForm";
