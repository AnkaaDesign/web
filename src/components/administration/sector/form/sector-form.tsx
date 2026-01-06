import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { IconBuildingSkyscraper } from "@tabler/icons-react";

import type { SectorCreateFormData, SectorUpdateFormData, Sector } from "../../../../types";
import { sectorCreateSchema, sectorUpdateSchema } from "../../../../schemas";
import { routes, SECTOR_PRIVILEGES } from "../../../../constants";
import { useSectorMutations } from "../../../../hooks";

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
  const [isInitialized, setIsInitialized] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize form from URL params (create mode only) - runs only once on mount
  useEffect(() => {
    if (props.mode === "create" && !isInitialized) {
      const name = searchParams.get("name");
      const privileges = searchParams.get("privileges");

      if (name) form.setValue("name", name, { shouldValidate: false, shouldDirty: false });
      if (privileges && Object.values(SECTOR_PRIVILEGES).includes(privileges as SECTOR_PRIVILEGES)) {
        form.setValue("privileges", privileges as SECTOR_PRIVILEGES, { shouldValidate: false, shouldDirty: false });
      }
      setIsInitialized(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Watch form changes and update URL (create mode only)
  useEffect(() => {
    if (props.mode !== "create" || !isInitialized) return;

    const subscription = form.watch((value) => {
      // Clear previous timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Set new timer
      debounceTimerRef.current = setTimeout(() => {
        const params = new URLSearchParams();
        if (value.name) params.set("name", value.name);
        if (value.privileges) params.set("privileges", value.privileges);
        setSearchParams(params, { replace: true });
      }, 500);
    });

    return () => {
      subscription.unsubscribe();
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [props.mode, isInitialized, form, setSearchParams]);

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
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error submitting form:", error);
      }
    }
  };

  return (
    <FormProvider {...form}>
      <form id="sector-form" onSubmit={form.handleSubmit(handleSubmit)} className="container mx-auto max-w-4xl">
        {/* Hidden submit button for external form submission */}
        <button id="sector-form-submit" type="submit" className="hidden" disabled={isSubmitting} />

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconBuildingSkyscraper className="h-5 w-5 text-muted-foreground" />
                Informações do Setor
              </CardTitle>
              <CardDescription>Preencha as informações básicas do setor</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <NameInput control={form.control} disabled={isSubmitting} required={props.mode === "create"} />

                <PrivilegesSelect control={form.control} disabled={isSubmitting} required={props.mode === "create"} />
              </div>
            </CardContent>
          </Card>
        </div>
      </form>
    </FormProvider>
  );
}
