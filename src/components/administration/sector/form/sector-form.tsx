import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { debounce } from "../../../../utils";

import type { SectorCreateFormData, SectorUpdateFormData, Sector } from "../../../../types";
import { sectorCreateSchema, sectorUpdateSchema } from "../../../../schemas";
import { routes, SECTOR_PRIVILEGES } from "../../../../constants";
import { useSectorMutations } from "../../../../hooks";

import { Form } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { NameInput } from "./name-input";
import { PrivilegesSelect } from "./privileges-select";

interface CreateModeProps {
  mode: "create";
  onSubmit?: (data: SectorCreateFormData) => Promise<void>;
  defaultValues?: Partial<SectorCreateFormData>;
}

interface UpdateModeProps {
  mode: "update";
  sector: Sector;
  onSubmit?: (data: SectorUpdateFormData) => Promise<void>;
  defaultValues?: Partial<SectorUpdateFormData>;
}

type SectorFormProps = (CreateModeProps | UpdateModeProps) & {
  isSubmitting?: boolean;
};

export function SectorForm(props: SectorFormProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const sectorMutations = useSectorMutations();

  const form = useForm<SectorCreateFormData | SectorUpdateFormData>({
    resolver: zodResolver(props.mode === "create" ? sectorCreateSchema : sectorUpdateSchema),
    defaultValues:
      props.defaultValues ||
      (props.mode === "create"
        ? {
            name: "",
            privileges: SECTOR_PRIVILEGES.BASIC,
          }
        : {
            name: props.sector.name,
            privileges: props.sector.privileges,
          }),
  });

  const isSubmitting = props.isSubmitting || form.formState.isSubmitting;

  // URL state persistence for create mode
  const debouncedUpdateUrl = useMemo(
    () =>
      debounce((formData: Partial<SectorCreateFormData>) => {
        if (props.mode === "create") {
          const params = new URLSearchParams();
          if (formData.name) params.set("name", formData.name);
          if (formData.privileges) params.set("privileges", formData.privileges);
          setSearchParams(params, { replace: true });
        }
      }, 1000),
    [props.mode, setSearchParams],
  );

  // Initialize form from URL params (create mode only)
  useEffect(() => {
    if (props.mode === "create") {
      const name = searchParams.get("name");
      const privileges = searchParams.get("privileges");

      if (name) form.setValue("name", name);
      if (privileges && Object.values(SECTOR_PRIVILEGES).includes(privileges as SECTOR_PRIVILEGES)) {
        form.setValue("privileges", privileges as SECTOR_PRIVILEGES);
      }
    }
  }, [props.mode, searchParams, form]);

  // Watch form changes and update URL (create mode only)
  useEffect(() => {
    if (props.mode === "create") {
      const subscription = form.watch((value) => {
        debouncedUpdateUrl(value as Partial<SectorCreateFormData>);
      });
      return () => subscription.unsubscribe();
    }
  }, [form, debouncedUpdateUrl, props.mode]);

  const handleSubmit = async (data: SectorCreateFormData | SectorUpdateFormData) => {
    try {
      if (props.onSubmit) {
        if (props.mode === "create") {
          // Ensure privileges is typed as enum and name is defined
          const createData: SectorCreateFormData = {
            name: (data as SectorCreateFormData).name,
            privileges: data.privileges as SECTOR_PRIVILEGES,
          };
          await props.onSubmit(createData);
        } else {
          await props.onSubmit(data as SectorUpdateFormData);
        }
      } else {
        if (props.mode === "create") {
          // Ensure privileges is typed as enum and name is defined
          const createData: SectorCreateFormData = {
            name: (data as SectorCreateFormData).name,
            privileges: data.privileges as SECTOR_PRIVILEGES,
          };
          const result = await sectorMutations.createAsync(createData);
          navigate(routes.administration.sectors.details(result.data?.id || ""));
        } else {
          await sectorMutations.updateAsync({
            id: props.sector.id,
            data: data as SectorUpdateFormData,
          });
          navigate(routes.administration.sectors.details(props.sector.id));
        }
      }
    } catch (error) {
      console.error("Error submitting form:", error);
    }
  };

  return (
    <Card className="flex-1 min-h-0 flex flex-col shadow-sm border border-border">
      <CardContent className="flex-1 flex flex-col p-6 space-y-4 overflow-hidden min-h-0">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex-1 flex flex-col overflow-y-auto space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Informações do Setor</CardTitle>
                <CardDescription>Preencha as informações básicas do setor</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  <NameInput control={form.control} disabled={isSubmitting} required={props.mode === "create"} />

                  <PrivilegesSelect control={form.control} disabled={isSubmitting} required={props.mode === "create"} />
                </div>
              </CardContent>
            </Card>

            {/* Hidden submit button for external form submission */}
            <button id="sector-form-submit" type="submit" className="hidden" disabled={isSubmitting} />
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
