import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Form } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { paintBrandCreateSchema, paintBrandUpdateSchema, type PaintBrandCreateFormData, type PaintBrandUpdateFormData } from "../../../../schemas";
import { serializePaintBrandFormToUrlParams, getDefaultPaintBrandFormValues, debounce } from "@/utils/url-form-state";

// Import form field components
import { NameInput } from "./name-input";
import { ComponentItemsSelector } from "./component-items-selector";
import type { Item } from "../../../../types";

interface BaseFormProps {
  isSubmitting?: boolean;
  onCancel?: () => void;
  onDirtyChange?: (isDirty: boolean) => void;
  onFormStateChange?: (formState: { isValid: boolean; isDirty: boolean }) => void;
  initialComponentItems?: Item[];
}

interface CreateFormProps extends BaseFormProps {
  mode: "create";
  onSubmit: (data: PaintBrandCreateFormData) => Promise<void>;
  defaultValues?: Partial<PaintBrandCreateFormData>;
}

interface UpdateFormProps extends BaseFormProps {
  mode: "update";
  onSubmit: (data: PaintBrandUpdateFormData) => Promise<void>;
  defaultValues?: Partial<PaintBrandUpdateFormData>;
  paintBrandId: string;
}

type PaintBrandFormProps = CreateFormProps | UpdateFormProps;

export function PaintBrandForm(props: PaintBrandFormProps) {
  const { isSubmitting, defaultValues, mode, onDirtyChange, onFormStateChange, initialComponentItems } = props;
  const [searchParams, setSearchParams] = useSearchParams();

  // Get URL-aware default values for create mode only
  const createDefaults: PaintBrandCreateFormData =
    mode === "create"
      ? getDefaultPaintBrandFormValues(searchParams, defaultValues)
      : {
          name: "",
          componentItemIds: [],
          ...defaultValues,
        };

  const form = useForm<PaintBrandCreateFormData | PaintBrandUpdateFormData>({
    resolver: zodResolver(mode === "create" ? paintBrandCreateSchema : paintBrandUpdateSchema),
    defaultValues: mode === "create" ? createDefaults : defaultValues,
    mode: "onBlur", // Validate on blur for better UX
    reValidateMode: "onChange", // Re-validate on change after first validation
    shouldFocusError: true, // Focus on first error field when validation fails
    criteriaMode: "firstError", // Stop at first error per field for better performance
  });

  // Track dirty state without triggering validation
  useEffect(() => {
    if (onDirtyChange && mode === "update") {
      const isDirty = form.formState.isDirty;
      onDirtyChange(isDirty);
    }
  }, [form.formState.isDirty, onDirtyChange, mode]);

  // Track form state changes for submit button
  useEffect(() => {
    if (onFormStateChange) {
      onFormStateChange({
        isValid: form.formState.isValid,
        isDirty: form.formState.isDirty,
      });
    }
  }, [form.formState.isValid, form.formState.isDirty, onFormStateChange]);

  // Debounced URL update function
  const updateUrl = useMemo(
    () =>
      debounce((formData: Partial<PaintBrandCreateFormData>) => {
        if (mode === "create") {
          // Clean up empty/null/undefined values before serializing
          const cleanedData = Object.entries(formData).reduce((acc, [key, value]) => {
            // Keep the value if it's not null, undefined, or empty string
            if (value !== null && value !== undefined && value !== "") {
              acc[key as keyof PaintBrandCreateFormData] = value;
            }
            return acc;
          }, {} as Partial<PaintBrandCreateFormData>);

          const params = serializePaintBrandFormToUrlParams(cleanedData);
          const currentParams = new URLSearchParams(searchParams);

          // Only update if params have actually changed
          if (params.toString() !== currentParams.toString()) {
            setSearchParams(params, { replace: true });
          }
        }
      }, 300),
    [mode, setSearchParams, searchParams],
  );

  // Cleanup debounced function on unmount
  useEffect(() => {
    return () => {
      updateUrl.cancel();
    };
  }, [updateUrl]);

  // Update URL when form values change (create mode only)
  useEffect(() => {
    if (mode === "create") {
      const subscription = form.watch((values) => {
        updateUrl(values as PaintBrandCreateFormData);
      });

      return () => subscription.unsubscribe();
    }
  }, [form, updateUrl, mode]);

  const handleSubmit = async (data: PaintBrandCreateFormData | PaintBrandUpdateFormData) => {
    try {
      // Ensure componentItemIds is an array
      const cleanedData = {
        ...data,
        componentItemIds: Array.isArray(data.componentItemIds)
          ? data.componentItemIds
          : data.componentItemIds
            ? Object.values(data.componentItemIds as any).filter((id) => typeof id === "string")
            : [],
      };

      await props.onSubmit(cleanedData as any);
      // Clear URL parameters on successful submission
      if (mode === "create") {
        setSearchParams({}, { replace: true });
      }
    } catch (error) {
      // Error is handled by the parent component
      console.error("Form submission error:", error);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
          {/* Basic Information */}
          <Card className="bg-transparent">
            <CardHeader>
              <CardTitle>Informações Básicas</CardTitle>
              <CardDescription>Nome e identificação da marca de tinta</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-6">
                <NameInput control={form.control} disabled={isSubmitting} required />
              </div>
            </CardContent>
          </Card>

          {/* Component Items Section */}
          <Card className="bg-transparent">
            <CardHeader>
              <CardTitle>Componentes</CardTitle>
              <CardDescription>
                Selecione os itens que podem ser usados como componentes desta marca de tinta
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ComponentItemsSelector
                control={form.control}
                disabled={isSubmitting}
                initialItems={initialComponentItems}
              />
            </CardContent>
          </Card>

          {/* Hidden submit button that can be triggered by the header button */}
          <button
            id="paint-brand-form-submit"
            type="submit"
            className="hidden"
            disabled={isSubmitting}
          >
            Submit
          </button>
        </form>
      </Form>
    </div>
  );
}
