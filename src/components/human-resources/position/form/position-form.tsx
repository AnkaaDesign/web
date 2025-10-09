import { useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { IconCheck, IconLoader2, IconX } from "@tabler/icons-react";

import type { Position } from "../../../../types";
import type { PositionCreateFormData, PositionUpdateFormData } from "../../../../schemas";
import { positionCreateSchema, positionUpdateSchema } from "../../../../schemas";
import { routes } from "../../../../constants";
import { usePositionMutations } from "../../../../hooks";

import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

import { NameInput } from "./name-input";
import { RemunerationInput } from "./remuneration-input";
import { BonifiableToggle } from "./bonifiable-toggle";

interface CreateModeProps {
  mode: "create";
  onSubmit?: (data: PositionCreateFormData) => Promise<void>;
  defaultValues?: Partial<PositionCreateFormData>;
}

interface UpdateModeProps {
  mode: "update";
  position: Position;
  onSubmit?: (data: PositionUpdateFormData) => Promise<void>;
  defaultValues?: Partial<PositionUpdateFormData>;
}

type PositionFormProps = (CreateModeProps | UpdateModeProps) & {
  isSubmitting?: boolean;
};

export function PositionForm(props: PositionFormProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { create, update } = usePositionMutations();

  const form = useForm<PositionCreateFormData | PositionUpdateFormData>({
    resolver: zodResolver(props.mode === "create" ? positionCreateSchema : positionUpdateSchema),
    mode: "onChange",
    defaultValues:
      props.defaultValues ||
      (props.mode === "create"
        ? {
            name: "",
            remuneration: 0,
            bonifiable: false,
          }
        : {
            name: props.position.name,
            remuneration: undefined, // Remuneration is optional for updates
            bonifiable: props.position.bonifiable,
          }),
  });

  const isSubmitting = props.isSubmitting || form.formState.isSubmitting;

  // URL state persistence for create mode with debounce
  const debouncedUpdateUrl = useCallback(
    (() => {
      let timeout: NodeJS.Timeout;
      return (formData: Partial<PositionCreateFormData>) => {
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => {
          if (props.mode === "create") {
            const params = new URLSearchParams();
            if (formData.name) params.set("name", formData.name);
            if (formData.remuneration !== undefined && formData.remuneration !== null) params.set("remuneration", formData.remuneration.toString());
            if (formData.bonifiable !== undefined && formData.bonifiable !== null) params.set("bonifiable", formData.bonifiable.toString());
            setSearchParams(params, { replace: true });
          }
        }, 1000);
      };
    })(),
    [props.mode, setSearchParams],
  );

  // Initialize form from URL params (create mode only)
  useEffect(() => {
    if (props.mode === "create") {
      const name = searchParams.get("name");
      const remuneration = searchParams.get("remuneration");
      const bonifiable = searchParams.get("bonifiable");

      if (name) form.setValue("name", name);
      if (remuneration) form.setValue("remuneration", Number(remuneration));
      if (bonifiable) form.setValue("bonifiable", bonifiable === "true");
    }
  }, [props.mode, searchParams, form]);

  // Watch form changes and update URL (create mode only)
  useEffect(() => {
    if (props.mode === "create") {
      const subscription = form.watch((value) => {
        debouncedUpdateUrl(value as Partial<PositionCreateFormData>);
      });
      return () => subscription.unsubscribe();
    }
  }, [form, debouncedUpdateUrl, props.mode]);

  const handleSubmit = async (data: PositionCreateFormData | PositionUpdateFormData) => {
    try {
      if (props.onSubmit) {
        await props.onSubmit(data as any);
      } else {
        if (props.mode === "create") {
          await create(data as PositionCreateFormData);
          // Success toast is handled automatically by API client
          navigate(routes.humanResources.positions.root);
        } else {
          await update({
            id: props.position.id,
            data: data as PositionUpdateFormData,
          });
          // Success toast is handled automatically by API client
          navigate(routes.humanResources.positions.details(props.position.id));
        }
      }
    } catch (error) {
      console.error("Error submitting form:", error);
    }
  };

  const handleCancel = () => {
    if (props.mode === "create") {
      navigate(routes.humanResources.positions.root);
    } else {
      navigate(routes.humanResources.positions.details(props.position.id));
    }
  };

  return (
    <Card className="flex-1 min-h-0 flex flex-col shadow-sm border border-border">
      <CardContent className="flex-1 flex flex-col p-6 space-y-4 overflow-hidden min-h-0">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex-1 flex flex-col overflow-y-auto space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Informações do Cargo</CardTitle>
                <CardDescription>Preencha as informações básicas do cargo</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                  <div className="lg:col-span-3">
                    <NameInput control={form.control} disabled={isSubmitting} required={props.mode === "create"} />
                  </div>

                  <div className="lg:col-span-1">
                    <RemunerationInput disabled={isSubmitting} required={props.mode === "create"} />
                  </div>
                </div>

                <BonifiableToggle control={form.control} disabled={isSubmitting} />

                {props.mode === "update" && (
                  <p className="text-sm text-muted-foreground">
                    Nota: Ao atualizar a remuneração, um novo registro será criado no histórico. Deixe em branco para manter a remuneração atual.
                  </p>
                )}
              </CardContent>
            </Card>

            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={handleCancel} disabled={isSubmitting}>
                <IconX className="h-4 w-4 mr-2" />
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting || !form.formState.isValid}>
                {isSubmitting ? <IconLoader2 className="h-4 w-4 mr-2 animate-spin" /> : <IconCheck className="h-4 w-4 mr-2" />}
                {props.mode === "create" ? "Criar" : "Salvar"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
