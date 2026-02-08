import { useNavigate, useSearchParams } from "react-router-dom";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { EpiForm } from "@/components/inventory/epi/form/epi-form";
import { PageHeader } from "@/components/ui/page-header";
import { useItemMutations } from "../../../hooks";
import { itemCreateSchema } from "../../../schemas";
import type { ItemCreateFormData } from "../../../schemas";
import { routes, FAVORITE_PAGES } from "../../../constants";
import { getDefaultItemFormValues } from "@/utils/url-form-state";
import { IconCheck, IconLoader2, IconShield } from "@tabler/icons-react";

export const PpeCreatePage = () => {
  usePageTracker({
    title: "Cadastrar EPI",
    icon: "shield-plus",
  });
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { createAsync, createMutation } = useItemMutations();

  // Get default values from URL parameters
  const defaultValues = getDefaultItemFormValues(searchParams);

  const handleSubmit = async (data: ItemCreateFormData) => {
    try {
      // Ensure barcodes is an array (fix for empty object issue)
      const sanitizedData = {
        ...data,
        barcodes: Array.isArray(data.barcodes) ? data.barcodes : [],
      }; // Validate data with schema
      let validatedData;
      try {
        validatedData = itemCreateSchema.parse(sanitizedData);
      } catch (schemaError) {
        if (process.env.NODE_ENV !== 'production') {
          console.error("3. Schema validation failed:", schemaError);
          if (schemaError instanceof Error) {
            console.error("Schema error details:", schemaError.message);
          }
        }
        throw schemaError;
      }
      const result = await createAsync(validatedData);
      if (result?.success && result?.data) {
        // Clear URL parameters after successful submission
        navigate(routes.inventory.ppe.root, { replace: true });
      }
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("=== ERROR IN EPI CREATION ===");
        console.error("Error type:", error?.constructor?.name);
        console.error("Error message:", error instanceof Error ? error.message : "Unknown error");
        console.error("Full error object:", error);

        // Check if it's a validation error
        if (error && typeof error === "object" && "errors" in error) {
          console.error("Validation errors:", (error as any).errors);
        }

        // Check if it's an API error
        if (error && typeof error === "object" && "response" in error) {
          console.error("API response error:", (error as any).response);
        }
      }

      // Re-throw to let React Query handle it
      throw error;
    }
  };

  const handleCancel = () => {
    // Clear URL parameters when cancelling
    navigate(routes.inventory.ppe.root, { replace: true });
  };

  const actions = [
    {
      key: "cancel",
      label: "Cancelar",
      onClick: handleCancel,
      variant: "outline" as const,
      disabled: createMutation.isPending,
    },
    {
      key: "submit",
      label: "Cadastrar",
      icon: createMutation.isPending ? IconLoader2 : IconCheck,
      onClick: async () => {
        // First try to find and click the submit button
        const submitButton = document.getElementById("epi-form-submit") as HTMLButtonElement;
        if (submitButton) {
          submitButton.click();
        } else {
          if (process.env.NODE_ENV !== 'production') {
            console.error("Submit button not found!");
          }

          // Try alternative: trigger form submit directly
          const form = document.getElementById("epi-form") as HTMLFormElement;
          if (form) {
            // Try to trigger submit event
            const submitEvent = new Event("submit", { bubbles: true, cancelable: true });
            const result = form.dispatchEvent(submitEvent);
            if (result) {
              form.requestSubmit();
            }
          } else {
            if (process.env.NODE_ENV !== 'production') {
              console.error("Form element not found!");
            }
          }
        }
      },
      variant: "default" as const,
      disabled: createMutation.isPending,
      loading: createMutation.isPending,
    },
  ];

  return (
    <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
      <div className="container mx-auto max-w-4xl flex-shrink-0">
        <PageHeader
          variant="form"
          title="Cadastrar EPI"
          icon={IconShield}
          breadcrumbs={[{ label: "Estoque", href: routes.inventory.root }, { label: "EPIs", href: routes.inventory.ppe.root }, { label: "Cadastrar" }]}
          actions={actions}
          favoritePage={FAVORITE_PAGES.ESTOQUE_EPI_CADASTRAR}
        />
      </div>
      <div className="flex-1 overflow-y-auto pb-6">
        <EpiForm mode="create" onSubmit={handleSubmit} isSubmitting={createMutation.isPending} defaultValues={defaultValues} />
      </div>
    </div>
  );
};

export default PpeCreatePage;
