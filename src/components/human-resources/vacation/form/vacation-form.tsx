import { useEffect, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { IconCheck, IconLoader2, IconX } from "@tabler/icons-react";
import { debounce } from "../../../../utils";

import type { Vacation } from "../../../../types";
import type { VacationCreateFormData, VacationUpdateFormData } from "../../../../schemas";
import { vacationCreateSchema, vacationUpdateSchema } from "../../../../schemas";
import { routes } from "../../../../constants";
import { useVacationMutations } from "../../../../hooks";

import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

import { CollaboratorSelect } from "./collaborator-select";
import { StartDatePicker } from "./start-date-picker";
import { EndDatePicker } from "./end-date-picker";
import { TypeSelect } from "./type-select";
import { StatusSelect } from "./status-select";
import { CollectiveSwitch } from "./collective-switch";
import { FormErrorDisplay } from "./form-error-display";

interface BaseVacationFormProps {
  isSubmitting?: boolean;
  onDirtyChange?: (isDirty: boolean) => void;
  onFormStateChange?: (formState: { isValid: boolean; isDirty: boolean }) => void;
  onCancel?: () => void;
  onFormSubmit?: (data: VacationCreateFormData | VacationUpdateFormData) => Promise<void>;
}

interface CreateModeProps extends BaseVacationFormProps {
  mode: "create";
  onSubmit?: (data: VacationCreateFormData) => Promise<void>;
  defaultValues?: Partial<VacationCreateFormData>;
}

interface UpdateModeProps extends BaseVacationFormProps {
  mode: "update";
  vacation: Vacation;
  onSubmit?: (data: VacationUpdateFormData) => Promise<void>;
  defaultValues?: Partial<VacationUpdateFormData>;
}

type VacationFormProps = CreateModeProps | UpdateModeProps;

export function VacationForm(props: VacationFormProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { createAsync, updateAsync } = useVacationMutations();
  const { isSubmitting, defaultValues, mode, onDirtyChange, onFormStateChange, onCancel, onFormSubmit } = props;

  // Create a custom resolver based on mode
  const customResolver = useMemo(() => {
    if (mode === "create") {
      return zodResolver(vacationCreateSchema);
    }
    return zodResolver(vacationUpdateSchema);
  }, [mode]);

  // Default values for create mode
  const createDefaults: Partial<VacationCreateFormData> = {
    userId: "",
    startAt: new Date(),
    endAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Default to 1 week later
    type: undefined,
    status: undefined,
    isCollective: false,
    ...defaultValues,
  };

  // Default values for update mode
  const updateDefaults: Partial<VacationUpdateFormData> = mode === "update" ? {
    userId: props.vacation.userId || undefined,
    startAt: new Date(props.vacation.startAt),
    endAt: new Date(props.vacation.endAt),
    type: props.vacation.type,
    status: props.vacation.status,
    isCollective: props.vacation.isCollective,
    ...defaultValues,
  } : {};

  const form = useForm<VacationCreateFormData | VacationUpdateFormData>({
    resolver: customResolver,
    defaultValues: mode === "create" ? createDefaults : updateDefaults,
    mode: "onTouched", // Validate only after field is touched to avoid premature validation
    reValidateMode: "onChange", // After first validation, check on every change
    shouldFocusError: true, // Focus on first error field when validation fails
    criteriaMode: "all", // Show all errors for better UX
  });

  // Reset form when defaultValues change in update mode (e.g., new vacation data loaded)
  const defaultValuesRef = useRef(defaultValues);
  useEffect(() => {
    if (mode === "update" && defaultValues && defaultValues !== defaultValuesRef.current) {
      // Reset form with new defaults and mark form as untouched/pristine
      form.reset(updateDefaults, {
        keepDefaultValues: false,
        keepDirty: false,
        keepTouched: false,
      });
      defaultValuesRef.current = defaultValues;
    }
  }, [defaultValues, form, mode, updateDefaults]);

  // Access formState properties during render for proper subscription
  const { isValid, isDirty, errors } = form.formState;

  const finalIsSubmitting = isSubmitting || form.formState.isSubmitting;

  // Auto-sync date validation to prevent errors
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      // If end date is before start date, show error
      if ((name === "startAt" || name === "endAt") && value.startAt && value.endAt) {
        const startDate = new Date(value.startAt);
        const endDate = new Date(value.endAt);

        if (endDate <= startDate) {
          form.setError("endAt", {
            type: "validate",
            message: "Data de término deve ser posterior à data de início",
          });
        } else {
          // Clear error if dates are valid
          form.clearErrors("endAt");
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  // Debug validation errors in development
  useEffect(() => {
    if (process.env.NODE_ENV === "development" && Object.keys(errors).length > 0) {
      console.log("Vacation form validation errors:", {
        errors,
        currentValues: form.getValues(),
      });
    }
  }, [errors, form]);

  // Track dirty state without triggering validation
  useEffect(() => {
    if (onDirtyChange && mode === "update") {
      onDirtyChange(isDirty);
    }
  }, [isDirty, onDirtyChange, mode]);

  // Track form state changes for submit button
  useEffect(() => {
    if (onFormStateChange) {
      onFormStateChange({
        isValid,
        isDirty,
      });
    }
  }, [isValid, isDirty, onFormStateChange]);

  // URL state persistence for create mode
  const debouncedUpdateUrl = useMemo(
    () =>
      debounce((formData: Partial<VacationCreateFormData>) => {
        if (mode === "create") {
          const params = new URLSearchParams();
          if (formData.userId) params.set("userId", formData.userId);
          if (formData.type) params.set("type", formData.type);
          if (formData.status) params.set("status", formData.status);
          if (formData.isCollective !== undefined) params.set("collective", formData.isCollective.toString());
          setSearchParams(params, { replace: true });
        }
      }, 1000),
    [mode, setSearchParams],
  );

  // Initialize form from URL params (create mode only)
  useEffect(() => {
    if (mode === "create") {
      const userId = searchParams.get("userId");
      const type = searchParams.get("type");
      const status = searchParams.get("status");
      const isCollective = searchParams.get("collective");

      if (userId) form.setValue("userId", userId, { shouldDirty: false });
      if (type) form.setValue("type", type as any, { shouldDirty: false });
      if (status) form.setValue("status", status as any, { shouldDirty: false });
      if (isCollective !== null) form.setValue("isCollective", isCollective === "true", { shouldDirty: false });
    }
  }, []);

  // Watch form changes and update URL (create mode only)
  useEffect(() => {
    if (mode === "create") {
      const subscription = form.watch((value) => {
        debouncedUpdateUrl(value as Partial<VacationCreateFormData>);
      });
      return () => subscription.unsubscribe();
    }
  }, [form, debouncedUpdateUrl, mode]);

  const onSubmit = async (data: VacationCreateFormData | VacationUpdateFormData) => {
    try {
      // Call parent's onFormSubmit if provided
      if (onFormSubmit) {
        await onFormSubmit(data);
        return;
      }

      // Use specific onSubmit callback if provided
      if (props.onSubmit) {
        if (mode === "create") {
          await (props as CreateModeProps).onSubmit?.(data as VacationCreateFormData);
        } else {
          await (props as UpdateModeProps).onSubmit?.(data as VacationUpdateFormData);
        }
      } else {
        // Default behavior
        if (mode === "create") {
          const result = await createAsync(data as VacationCreateFormData);
          // Success toast is handled automatically by API client
          navigate(routes.humanResources.vacations.details(result.data?.id || ""));
        } else {
          await updateAsync({
            id: (props as UpdateModeProps).vacation.id,
            data: data as VacationUpdateFormData,
          });
          // Success toast is handled automatically by API client
          navigate(routes.humanResources.vacations.details((props as UpdateModeProps).vacation.id));
        }
      }
    } catch (error) {
      // Error is handled by the parent component or API client
      console.error("Error submitting vacation form:", error);
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
      return;
    }

    if (mode === "create") {
      navigate(routes.humanResources.vacations.root);
    } else {
      navigate(routes.humanResources.vacations.details((props as UpdateModeProps).vacation.id));
    }
  };

  // Watch isCollective field to conditionally show/hide user selector
  const isCollective = form.watch("isCollective");

  return (
    <Card className="flex-1 flex flex-col shadow-sm border border-border h-full">
      <CardContent className="flex-1 flex flex-col p-6 space-y-4 overflow-y-auto">
        <Form {...form}>
          <form id="vacation-form" onSubmit={form.handleSubmit(onSubmit)} className="flex-1 flex flex-col space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Informações das Férias</CardTitle>
                <CardDescription>Preencha as informações do período de férias</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormErrorDisplay errors={errors} />

                <CollectiveSwitch control={form.control} disabled={finalIsSubmitting} />

                {!isCollective && (
                  <CollaboratorSelect control={form.control} disabled={finalIsSubmitting || mode === "update"} required={mode === "create" && !isCollective} />
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <StartDatePicker control={form.control} disabled={finalIsSubmitting} required={mode === "create"} endDate={form.watch("endAt")} />

                  <EndDatePicker control={form.control} disabled={finalIsSubmitting} required={mode === "create"} startDate={form.watch("startAt")} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <TypeSelect control={form.control} disabled={finalIsSubmitting} />

                  <StatusSelect control={form.control} disabled={finalIsSubmitting} />
                </div>
              </CardContent>
            </Card>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
