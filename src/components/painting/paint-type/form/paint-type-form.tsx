import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { IconInfoCircle, IconPackage, IconPaintFilled } from "@tabler/icons-react";
import { Form } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { paintTypeCreateSchema, paintTypeUpdateSchema, type PaintTypeCreateFormData, type PaintTypeUpdateFormData } from "../../../../schemas";
import { serializePaintTypeFormToUrlParams, getDefaultPaintTypeFormValues, debounce } from "@/utils/url-form-state";
import type { Item } from "../../../../types";

// Import form field components
import { NameInput } from "./name-input";
import { NeedGroundSwitch } from "./need-ground-switch";
import { ComponentItemsSelector } from "./component-items-selector";

interface BaseFormProps {
  isSubmitting?: boolean;
  onCancel?: () => void;
  onDirtyChange?: (isDirty: boolean) => void;
  onFormStateChange?: (formState: { isValid: boolean; isDirty: boolean }) => void;
  initialComponentItems?: Item[];
}

interface CreateFormProps extends BaseFormProps {
  mode: "create";
  onSubmit: (data: PaintTypeCreateFormData) => Promise<void>;
  defaultValues?: Partial<PaintTypeCreateFormData>;
}

interface UpdateFormProps extends BaseFormProps {
  mode: "update";
  onSubmit: (data: PaintTypeUpdateFormData) => Promise<void>;
  defaultValues?: Partial<PaintTypeUpdateFormData>;
  paintTypeId: string;
}

type PaintTypeFormProps = CreateFormProps | UpdateFormProps;

export function PaintTypeForm(props: PaintTypeFormProps) {
  const { isSubmitting, defaultValues, mode, onDirtyChange, onFormStateChange, initialComponentItems } = props;
  const [searchParams, setSearchParams] = useSearchParams();

  // Get URL-aware default values for create mode only
  const createDefaults: PaintTypeCreateFormData =
    mode === "create"
      ? getDefaultPaintTypeFormValues(searchParams, defaultValues)
      : {
          name: "",
          needGround: false,
          componentItemIds: [],
          ...defaultValues,
        };

  const form = useForm<PaintTypeCreateFormData | PaintTypeUpdateFormData>({
    resolver: zodResolver(mode === "create" ? paintTypeCreateSchema : paintTypeUpdateSchema),
    defaultValues: mode === "create" ? createDefaults : defaultValues,
    mode: "onBlur", // Validate on blur for better UX
    reValidateMode: "onChange", // Re-validate on change after first validation
    shouldFocusError: true, // Focus on first error field when validation fails
    criteriaMode: "firstError", // Stop at first error per field for better performance
  });

  // Watch needGround to show info message
  const needGround = form.watch("needGround");

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
      debounce((formData: Partial<PaintTypeCreateFormData>) => {
        if (mode === "create") {
          // Clean up empty/null/undefined values before serializing
          const cleanedData = Object.entries(formData).reduce((acc, [key, value]) => {
            // Keep the value if it's not null, undefined, or empty string
            if (value !== null && value !== undefined && value !== "") {
              acc[key as keyof PaintTypeCreateFormData] = value;
            }
            return acc;
          }, {} as Partial<PaintTypeCreateFormData>);

          const params = serializePaintTypeFormToUrlParams(cleanedData);
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
        updateUrl(values as PaintTypeCreateFormData);
      });

      return () => subscription.unsubscribe();
    }
  }, [form, updateUrl, mode]);

  const handleSubmit = async (data: PaintTypeCreateFormData | PaintTypeUpdateFormData) => {
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
              <CardTitle className="flex items-center gap-2">
                <IconInfoCircle className="h-5 w-5 text-muted-foreground" />
                Informações Básicas
              </CardTitle>
              <CardDescription>Nome e identificação do tipo de tinta</CardDescription>
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
              <CardTitle className="flex items-center gap-2">
                <IconPackage className="h-5 w-5 text-muted-foreground" />
                Componentes
              </CardTitle>
              <CardDescription>
                Selecione os itens que podem ser usados como componentes em fórmulas deste tipo de tinta
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ComponentItemsSelector control={form.control} disabled={isSubmitting} initialItems={initialComponentItems} />
            </CardContent>
          </Card>

          {/* Ground Paint Configuration */}
          <Card className="bg-transparent">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconPaintFilled className="h-5 w-5 text-muted-foreground" />
                Configuração de Fundo
              </CardTitle>
              <CardDescription>Define se este tipo de tinta requer aplicação de fundo</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <NeedGroundSwitch control={form.control} disabled={isSubmitting} />
              {needGround && (
                <p className="text-sm text-muted-foreground">
                  Tintas deste tipo exigirão a seleção de fundos apropriados durante o cadastro.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Hidden submit button that can be triggered by the header button */}
          <button
            id="paint-type-form-submit"
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
