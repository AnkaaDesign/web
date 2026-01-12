import { useEffect, useMemo, forwardRef, useImperativeHandle } from "react";
import { useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { debounce } from "../../../../../utils";
import { secullumCreateHolidaySchema, type SecullumCreateHolidayFormData } from "../../../../../schemas";

import { Form } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { DateInput } from "./date-input";
import { DescriptionInput } from "./description-input";

// Schema and types are now imported from @ankaa/schemas

interface CreateModeProps {
  mode: "create";
  onSubmit?: (data: SecullumCreateHolidayFormData) => Promise<void>;
  defaultValues?: Partial<SecullumCreateHolidayFormData>;
}

type HolidayFormProps = CreateModeProps & {
  isSubmitting?: boolean;
};

export const HolidayForm = forwardRef<{ submit: () => void; isSubmitting: boolean; isValid: boolean }, HolidayFormProps>((props, ref) => {
  const [searchParams, setSearchParams] = useSearchParams();

  const form = useForm<SecullumCreateHolidayFormData>({
    resolver: zodResolver(secullumCreateHolidaySchema),
    mode: "onChange",
    defaultValues: props.defaultValues || {
      Data: "",
      Descricao: "",
    },
  });

  const isSubmitting = props.isSubmitting || form.formState.isSubmitting;

  // Expose form methods via ref
  useImperativeHandle(ref, () => ({
    submit: () => form.handleSubmit(handleSubmit)(),
    isSubmitting,
    isValid: form.formState.isValid,
  }), [form, handleSubmit, isSubmitting]);

  // URL state persistence for create mode
  const debouncedUpdateUrl = useMemo(
    () =>
      debounce((formData: Partial<SecullumCreateHolidayFormData>) => {
        if (props.mode === "create") {
          const params = new URLSearchParams();
          if (formData.Data) params.set("data", formData.Data);
          if (formData.Descricao) params.set("descricao", formData.Descricao);
          setSearchParams(params, { replace: true });
        }
      }, 1000),
    [props.mode, setSearchParams],
  );

  // Initialize form from URL params (create mode only)
  useEffect(() => {
    if (props.mode === "create") {
      const data = searchParams.get("data");
      const descricao = searchParams.get("descricao");

      if (data) form.setValue("Data", data);
      if (descricao) form.setValue("Descricao", descricao);
    }
  }, []);

  // Watch form changes and update URL (create mode only)
  useEffect(() => {
    if (props.mode === "create") {
      const subscription = form.watch((value) => {
        debouncedUpdateUrl(value as Partial<SecullumCreateHolidayFormData>);
      });
      return () => subscription.unsubscribe();
    }
  }, [form, debouncedUpdateUrl, props.mode]);

  const handleSubmit = async (data: SecullumCreateHolidayFormData) => {
    try {
      if (props.onSubmit) {
        await props.onSubmit(data);
      } else {
        // Fallback if no onSubmit provided
        if (process.env.NODE_ENV !== 'production') {
          console.warn("No onSubmit handler provided to HolidayForm");
        }
      }
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error submitting form:", error);
      }
    }
  };

  return (
    <Card className="flex-1 min-h-0 flex flex-col shadow-sm border border-border">
      <CardContent className="flex-1 flex flex-col p-4 space-y-4 overflow-hidden min-h-0">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex-1 flex flex-col overflow-y-auto space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Informações do Feriado</CardTitle>
                <CardDescription>Preencha as informações do feriado</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  <DateInput control={form.control as any} disabled={isSubmitting} required={props.mode === "create"} />

                  <DescriptionInput control={form.control as any} disabled={isSubmitting} required={props.mode === "create"} />
                </div>
              </CardContent>
            </Card>

            {/* Hidden submit button for external form submission */}
            <button id="holiday-form-submit" type="submit" className="hidden" disabled={isSubmitting} />
          </form>
        </Form>
      </CardContent>
    </Card>
  );
});

HolidayForm.displayName = "HolidayForm";
