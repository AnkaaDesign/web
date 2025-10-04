import { useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { IconCheck, IconLoader2, IconX } from "@tabler/icons-react";
import { debounce } from "../../../../utils";

import type { Driver } from "../../../../types";
import type { DriverCreateFormData, DriverUpdateFormData } from "../../../../schemas";
import { driverCreateSchema, driverUpdateSchema } from "../../../../schemas";
import { routes } from "../../../../constants";
import { useDriverMutations } from "../../../../hooks";

import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

import { PersonalInfoSection } from "./personal-info-section";
import { AddressSection } from "./address-section";
import { CnhInfoSection } from "./cnh-info-section";
import { EmergencyContactSection } from "./emergency-contact-section";
import { MedicalInfoSection } from "./medical-info-section";
import { EmploymentSection } from "./employment-section";
import { NotesSection } from "./notes-section";
import { FormErrorDisplay } from "./form-error-display";

interface CreateModeProps {
  mode: "create";
  onSubmit?: (data: DriverCreateFormData) => Promise<void>;
  defaultValues?: Partial<DriverCreateFormData>;
}

interface UpdateModeProps {
  mode: "update";
  driver: Driver;
  onSubmit?: (data: DriverUpdateFormData) => Promise<void>;
  defaultValues?: Partial<DriverUpdateFormData>;
}

type DriverFormProps = (CreateModeProps | UpdateModeProps) & {
  isSubmitting?: boolean;
};

export function DriverForm(props: DriverFormProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { createAsync, updateAsync } = useDriverMutations();

  const form = useForm<DriverCreateFormData | DriverUpdateFormData>({
    resolver: zodResolver(props.mode === "create" ? driverCreateSchema : driverUpdateSchema),
    mode: "onChange",
    defaultValues:
      props.defaultValues ||
      (props.mode === "create"
        ? {
            name: "",
            cpf: "",
            cnhNumber: "",
            cnhCategory: undefined,
            cnhExpiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // Default to 1 year later
            licenseType: "DEFINITIVE",
            status: "ACTIVE",
            rg: null,
            birthDate: null,
            phone: null,
            email: null,
            address: null,
            addressNumber: null,
            addressComplement: null,
            neighborhood: null,
            city: null,
            state: null,
            zipCode: null,
            cnhIssueDate: null,
            cnhIssuingState: null,
            emergencyContactName: null,
            emergencyContactPhone: null,
            emergencyContactRelation: null,
            medicalCertificateExpiry: null,
            bloodType: null,
            allergies: null,
            medications: null,
            userId: null,
            hireDate: null,
            employeeId: null,
            notes: null,
          }
        : {
            name: props.driver.name,
            cpf: props.driver.cpf,
            cnhNumber: props.driver.cnhNumber,
            cnhCategory: props.driver.cnhCategory,
            cnhExpiryDate: new Date(props.driver.cnhExpiryDate),
            licenseType: props.driver.licenseType,
            status: props.driver.status,
            rg: props.driver.rg,
            birthDate: props.driver.birthDate ? new Date(props.driver.birthDate) : null,
            phone: props.driver.phone,
            email: props.driver.email,
            address: props.driver.address,
            addressNumber: props.driver.addressNumber,
            addressComplement: props.driver.addressComplement,
            neighborhood: props.driver.neighborhood,
            city: props.driver.city,
            state: props.driver.state,
            zipCode: props.driver.zipCode,
            cnhIssueDate: props.driver.cnhIssueDate ? new Date(props.driver.cnhIssueDate) : null,
            cnhIssuingState: props.driver.cnhIssuingState,
            emergencyContactName: props.driver.emergencyContactName,
            emergencyContactPhone: props.driver.emergencyContactPhone,
            emergencyContactRelation: props.driver.emergencyContactRelation,
            medicalCertificateExpiry: props.driver.medicalCertificateExpiry ? new Date(props.driver.medicalCertificateExpiry) : null,
            bloodType: props.driver.bloodType,
            allergies: props.driver.allergies,
            medications: props.driver.medications,
            userId: props.driver.userId,
            hireDate: props.driver.hireDate ? new Date(props.driver.hireDate) : null,
            employeeId: props.driver.employeeId,
            notes: props.driver.notes,
          }),
  });

  const isSubmitting = props.isSubmitting || form.formState.isSubmitting;

  // URL state persistence for create mode
  const debouncedUpdateUrl = useMemo(
    () =>
      debounce((values: Partial<DriverCreateFormData>) => {
        if (props.mode === "create") {
          const newParams = new URLSearchParams(searchParams);

          // Persist key form fields in URL
          if (values.name) newParams.set("name", values.name);
          if (values.cpf) newParams.set("cpf", values.cpf);
          if (values.cnhNumber) newParams.set("cnhNumber", values.cnhNumber);

          setSearchParams(newParams, { replace: true });
        }
      }, 500),
    [props.mode, searchParams, setSearchParams],
  );

  // Watch form changes and update URL
  const watchedValues = form.watch();
  useEffect(() => {
    if (props.mode === "create") {
      debouncedUpdateUrl(watchedValues);
    }
  }, [watchedValues, debouncedUpdateUrl, props.mode]);

  // Initialize form from URL params on mount
  useEffect(() => {
    if (props.mode === "create" && !props.defaultValues) {
      const urlName = searchParams.get("name");
      const urlCpf = searchParams.get("cpf");
      const urlCnhNumber = searchParams.get("cnhNumber");

      if (urlName || urlCpf || urlCnhNumber) {
        form.reset({
          ...form.getValues(),
          ...(urlName && { name: urlName }),
          ...(urlCpf && { cpf: urlCpf }),
          ...(urlCnhNumber && { cnhNumber: urlCnhNumber }),
        });
      }
    }
  }, [props.mode, props.defaultValues, searchParams, form]);

  const handleSubmit = async (data: DriverCreateFormData | DriverUpdateFormData) => {
    try {
      if (props.onSubmit) {
        await props.onSubmit(data);
      } else if (props.mode === "create") {
        await createAsync(data as DriverCreateFormData);
        // Success toast is handled automatically by API client
        navigate(routes.fleet.drivers.list); // Assuming this route exists
      } else if (props.mode === "update") {
        await updateAsync({
          id: props.driver.id,
          data: data as DriverUpdateFormData,
        });
        // Success toast is handled automatically by API client
        navigate(routes.fleet.drivers.list); // Assuming this route exists
      }
    } catch (error) {
      console.error("Error submitting driver form:", error);
      toast.error("Erro ao salvar motorista. Tente novamente.");
    }
  };

  const hasErrors = Object.keys(form.formState.errors).length > 0;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {/* Header */}
        <Card>
          <CardHeader>
            <CardTitle>{props.mode === "create" ? "Novo Motorista" : "Editar Motorista"}</CardTitle>
            <CardDescription>
              {props.mode === "create" ? "Cadastre um novo motorista com suas informações pessoais e de CNH." : "Atualize as informações do motorista selecionado."}
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Form Error Display */}
        {hasErrors && <FormErrorDisplay errors={form.formState.errors} />}

        {/* Personal Information */}
        <PersonalInfoSection form={form} />

        {/* Address Information */}
        <AddressSection form={form} />

        {/* CNH Information */}
        <CnhInfoSection form={form} />

        {/* Emergency Contact */}
        <EmergencyContactSection form={form} />

        {/* Medical Information */}
        <MedicalInfoSection form={form} />

        {/* Employment Information */}
        <EmploymentSection form={form} />

        {/* Notes */}
        <NotesSection form={form} />

        {/* Submit Actions */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-end gap-4">
              <Button type="button" variant="outline" onClick={() => navigate(-1)} disabled={isSubmitting}>
                <IconX className="mr-2 h-4 w-4" />
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting || hasErrors} className="min-w-32">
                {isSubmitting ? (
                  <>
                    <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <IconCheck className="mr-2 h-4 w-4" />
                    {props.mode === "create" ? "Criar Motorista" : "Salvar Alterações"}
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </Form>
  );
}
