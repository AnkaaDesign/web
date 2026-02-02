import { useState, useCallback, useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { AdminUserSelector } from "@/components/administration/user/form/user-selector";
import { SERVICE_ORDER_STATUS, SERVICE_ORDER_TYPE, SERVICE_ORDER_TYPE_LABELS, SECTOR_PRIVILEGES } from "@/constants";
import { IconLoader2, IconBriefcase } from "@tabler/icons-react";

// Schema for service order creation from the dialog
const designarServiceOrderSchema = z.object({
  description: z.string().min(3, "Mínimo de 3 caracteres").max(400, "Máximo de 400 caracteres"),
  type: z.enum(
    Object.values(SERVICE_ORDER_TYPE) as [string, ...string[]],
    { errorMap: () => ({ message: "Selecione um tipo de serviço" }) }
  ),
  assignedToId: z.string().uuid().nullable().optional(),
});

type DesignarServiceOrderFormData = z.infer<typeof designarServiceOrderSchema>;

export interface ServiceOrderData {
  status: string;
  statusOrder: number;
  description: string;
  type: string;
  assignedToId: string | null;
}

interface DesignarServiceOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onServiceOrderCreated: (serviceOrder: ServiceOrderData) => void;
  userPrivilege?: string;
}

export function DesignarServiceOrderDialog({
  open,
  onOpenChange,
  onServiceOrderCreated,
  userPrivilege,
}: DesignarServiceOrderDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get the default type for the user's sector
  const defaultType = useMemo(() => {
    switch (userPrivilege) {
      case SECTOR_PRIVILEGES.COMMERCIAL:
        return SERVICE_ORDER_TYPE.COMMERCIAL;
      case SECTOR_PRIVILEGES.FINANCIAL:
        return SERVICE_ORDER_TYPE.FINANCIAL;
      case SECTOR_PRIVILEGES.LOGISTIC:
        return SERVICE_ORDER_TYPE.LOGISTIC;
      case SECTOR_PRIVILEGES.DESIGNER:
        return SERVICE_ORDER_TYPE.ARTWORK;
      case SECTOR_PRIVILEGES.PRODUCTION:
      case SECTOR_PRIVILEGES.ADMIN:
      default:
        return SERVICE_ORDER_TYPE.PRODUCTION;
    }
  }, [userPrivilege]);

  // Get allowed types for creation based on user privilege
  const allowedTypes = useMemo(() => {
    if (userPrivilege === SECTOR_PRIVILEGES.ADMIN) {
      return [
        SERVICE_ORDER_TYPE.PRODUCTION,
        SERVICE_ORDER_TYPE.FINANCIAL,
        SERVICE_ORDER_TYPE.COMMERCIAL,
        SERVICE_ORDER_TYPE.LOGISTIC,
        SERVICE_ORDER_TYPE.ARTWORK,
      ];
    }
    if (userPrivilege === SECTOR_PRIVILEGES.COMMERCIAL) {
      return [
        SERVICE_ORDER_TYPE.PRODUCTION,
        SERVICE_ORDER_TYPE.FINANCIAL,
        SERVICE_ORDER_TYPE.COMMERCIAL,
        SERVICE_ORDER_TYPE.LOGISTIC,
        SERVICE_ORDER_TYPE.ARTWORK,
      ];
    }
    if (userPrivilege === SECTOR_PRIVILEGES.FINANCIAL) {
      // Financial users can create FINANCIAL, COMMERCIAL, and LOGISTIC service orders
      return [
        SERVICE_ORDER_TYPE.FINANCIAL,
        SERVICE_ORDER_TYPE.COMMERCIAL,
        SERVICE_ORDER_TYPE.LOGISTIC,
      ];
    }
    if (userPrivilege === SECTOR_PRIVILEGES.DESIGNER) {
      return [SERVICE_ORDER_TYPE.ARTWORK];
    }
    if (userPrivilege === SECTOR_PRIVILEGES.LOGISTIC) {
      return [
        SERVICE_ORDER_TYPE.PRODUCTION,
        SERVICE_ORDER_TYPE.COMMERCIAL,
        SERVICE_ORDER_TYPE.LOGISTIC,
        SERVICE_ORDER_TYPE.ARTWORK,
      ];
    }
    if (userPrivilege === SECTOR_PRIVILEGES.PRODUCTION) {
      return [SERVICE_ORDER_TYPE.PRODUCTION];
    }
    // Default: all types
    return [
      SERVICE_ORDER_TYPE.PRODUCTION,
      SERVICE_ORDER_TYPE.FINANCIAL,
      SERVICE_ORDER_TYPE.COMMERCIAL,
      SERVICE_ORDER_TYPE.LOGISTIC,
      SERVICE_ORDER_TYPE.ARTWORK,
    ];
  }, [userPrivilege]);

  const form = useForm<DesignarServiceOrderFormData>({
    resolver: zodResolver(designarServiceOrderSchema),
    mode: "onChange",
    defaultValues: {
      description: "",
      type: defaultType,
      assignedToId: null,
    },
  });

  // Watch the type field to filter users appropriately
  const selectedType = useWatch({
    control: form.control,
    name: "type",
    defaultValue: defaultType,
  });

  // Determine which sector privileges to include based on service order type
  // Each service order type has specific sectors that can be assigned
  const includeSectorPrivileges = useMemo(() => {
    switch (selectedType) {
      case SERVICE_ORDER_TYPE.PRODUCTION:
        // Production service orders: only production sector users
        return [SECTOR_PRIVILEGES.PRODUCTION];
      case SERVICE_ORDER_TYPE.LOGISTIC:
        // Logistic service orders: logistic and admin users
        return [SECTOR_PRIVILEGES.LOGISTIC, SECTOR_PRIVILEGES.ADMIN];
      case SERVICE_ORDER_TYPE.COMMERCIAL:
        // Commercial service orders: commercial and admin users
        return [SECTOR_PRIVILEGES.COMMERCIAL, SECTOR_PRIVILEGES.ADMIN];
      case SERVICE_ORDER_TYPE.ARTWORK:
        // Artwork service orders: designer and admin users
        return [SECTOR_PRIVILEGES.DESIGNER, SECTOR_PRIVILEGES.ADMIN];
      case SERVICE_ORDER_TYPE.FINANCIAL:
        // Financial service orders: commercial, financial, and admin users
        return [SECTOR_PRIVILEGES.COMMERCIAL, SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.ADMIN];
      default:
        return undefined;
    }
  }, [selectedType]);

  const handleSubmit = useCallback(
    async (data: DesignarServiceOrderFormData) => {
      try {
        setIsSubmitting(true);

        // Create the service order data to be added to the form
        const serviceOrderData: ServiceOrderData = {
          status: SERVICE_ORDER_STATUS.PENDING,
          statusOrder: 1,
          description: data.description,
          type: data.type,
          assignedToId: data.assignedToId || null,
        };

        // Call the callback to add the service order to the form
        onServiceOrderCreated(serviceOrderData);

        // Reset form and close dialog
        form.reset();
        onOpenChange(false);
      } catch (error) {
        console.error("Error creating service order:", error);
      } finally {
        setIsSubmitting(false);
      }
    },
    [onServiceOrderCreated, form, onOpenChange]
  );

  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        form.reset();
      }
      onOpenChange(newOpen);
    },
    [form, onOpenChange]
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconBriefcase className="h-5 w-5" />
            Designar Ordem de Serviço
          </DialogTitle>
          <DialogDescription>
            Crie uma nova ordem de serviço.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {/* Service Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição do Serviço <span className="text-red-500">*</span></FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Digite a descrição do serviço..."
                      disabled={isSubmitting}
                      className="bg-transparent"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Service Order Type */}
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Serviço <span className="text-red-500">*</span></FormLabel>
                  <FormControl>
                    <Combobox
                      value={field.value || defaultType}
                      onValueChange={field.onChange}
                      disabled={isSubmitting || allowedTypes.length === 1}
                      options={allowedTypes.map((type) => ({
                        value: type,
                        label: SERVICE_ORDER_TYPE_LABELS[type],
                      }))}
                      placeholder="Selecione o tipo"
                      searchable={false}
                      clearable={false}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Assigned User (Optional) */}
            <AdminUserSelector
              control={form.control}
              name="assignedToId"
              label="Responsável"
              placeholder="Selecione um responsável (opcional)"
              disabled={isSubmitting}
              required={false}
              includeSectorPrivileges={includeSectorPrivileges}
            />

            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                    Criando...
                  </>
                ) : (
                  <>
                    <IconBriefcase className="mr-2 h-4 w-4" />
                    Designar
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
