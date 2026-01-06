import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Customer, BatchOperationResult } from "../../../../types";
import { useBatchUpdateCustomers } from "../../../../hooks";
import { CustomerBatchResultDialog } from "@/components/ui/batch-operation-result-dialog";
import { BRAZILIAN_STATES, routes } from "../../../../constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { FormInput } from "@/components/ui/form-input";
import { FormDocumentInput } from "@/components/ui/form-document-input";
import { PhoneArrayInput } from "@/components/ui/phone-array-input";
import { StateSelector } from "@/components/ui/form-state-selector";
import { FantasyNameInput } from "../form/fantasy-name-input";
import { CorporateNameInput } from "../form/corporate-name-input";
import { WebsiteInput } from "../form/website-input";
import { AddressInput } from "@/components/ui/form-address-input";
import { AddressNumberInput } from "@/components/ui/form-address-number-input";
import { AddressComplementInput } from "@/components/ui/form-address-complement-input";
import { NeighborhoodInput } from "@/components/ui/form-neighborhood-input";
import { CityInput } from "@/components/ui/form-city-input";
import { TagsInput } from "../form/tags-input";
import { CpfCnpjCell } from "./cells/cpf-cnpj-cell";
import { CepCell } from "./cells/cep-cell";
import { TagsCell } from "./cells/tags-cell";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { IconLoader2, IconDeviceFloppy, IconX } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { TABLE_LAYOUT } from "@/components/ui/table-constants";

// Schema for batch edit form - common fields only for bulk update
const customerBatchEditSchema = z.object({
  customers: z.array(
    z.object({
      id: z.string(),
      data: z
        .object({
          // Identification fields
          fantasyName: z.string().min(1, "Nome fantasia é obrigatório").max(200, "Nome fantasia deve ter no máximo 200 caracteres").optional(),
          corporateName: z.string().max(200, "Razão social deve ter no máximo 200 caracteres").nullable().optional(),
          cpf: z.string().nullable().optional(),
          cnpj: z.string().nullable().optional(),

          // Contact fields
          email: z.string().email("Email inválido").nullable().optional(),
          site: z.string().url("URL inválida").nullable().optional(),
          phones: z.array(z.string().optional()).optional(),

          // Address fields
          address: z.string().max(200, "Endereço deve ter no máximo 200 caracteres").nullable().optional(),
          addressNumber: z.string().max(10, "Número deve ter no máximo 10 caracteres").nullable().optional(),
          addressComplement: z.string().max(100, "Complemento deve ter no máximo 100 caracteres").nullable().optional(),
          neighborhood: z.string().max(100, "Bairro deve ter no máximo 100 caracteres").nullable().optional(),
          city: z.string().max(100, "Cidade deve ter no máximo 100 caracteres").nullable().optional(),
          state: z
            .enum([...BRAZILIAN_STATES] as [string, ...string[]])
            .nullable()
            .optional(),
          zipCode: z.string().nullable().optional(),

          // Other fields
          tags: z.array(z.string()).optional(),
        })
        .partial(),
    }),
  ),
});

type CustomerBatchEditFormData = z.infer<typeof customerBatchEditSchema>;

interface CustomerBatchEditTableProps {
  customers: Customer[];
  onCancel: () => void;
  onSubmit?: () => void;
}

export function CustomerBatchEditTable({ customers, onCancel, onSubmit }: CustomerBatchEditTableProps) {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [batchResult, setBatchResult] = useState<BatchOperationResult<Customer, Customer> | null>(null);
  const [showResultDialog, setShowResultDialog] = useState(false);
  const { mutateAsync: batchUpdateAsync } = useBatchUpdateCustomers();

  const form = useForm<CustomerBatchEditFormData>({
    resolver: zodResolver(customerBatchEditSchema),
    defaultValues: {
      customers: customers.map((customer: Customer) => ({
        id: customer.id,
        data: {
          fantasyName: customer.fantasyName,
          corporateName: customer.corporateName,
          cpf: customer.cpf,
          cnpj: customer.cnpj,
          email: customer.email,
          site: customer.site,
          phones: customer.phones || [],
          address: customer.address,
          addressNumber: customer.addressNumber,
          addressComplement: customer.addressComplement,
          neighborhood: customer.neighborhood,
          city: customer.city,
          state: customer.state,
          zipCode: customer.zipCode,
          tags: customer.tags || [],
        },
      })),
    },
  });

  const { fields } = useFieldArray({
    control: form.control,
    name: "customers",
  });

  const handleSubmit = async (data: CustomerBatchEditFormData) => {
    // Filter out customers with no changes
    const updatedCustomers = data.customers.filter((customer: any) => {
      const originalCustomer = customers.find((c: Customer) => c.id === customer.id);
      if (!originalCustomer) return false;

      const hasChanges =
        customer.data.fantasyName !== originalCustomer.fantasyName ||
        customer.data.corporateName !== originalCustomer.corporateName ||
        customer.data.cpf !== originalCustomer.cpf ||
        customer.data.cnpj !== originalCustomer.cnpj ||
        customer.data.email !== originalCustomer.email ||
        customer.data.site !== originalCustomer.site ||
        JSON.stringify(customer.data.phones) !== JSON.stringify(originalCustomer.phones || []) ||
        customer.data.address !== originalCustomer.address ||
        customer.data.addressNumber !== originalCustomer.addressNumber ||
        customer.data.addressComplement !== (originalCustomer.addressComplement || "") ||
        customer.data.neighborhood !== (originalCustomer.neighborhood || "") ||
        customer.data.city !== originalCustomer.city ||
        customer.data.state !== originalCustomer.state ||
        customer.data.zipCode !== originalCustomer.zipCode ||
        JSON.stringify(customer.data.tags) !== JSON.stringify(originalCustomer.tags || []);

      return hasChanges;
    });

    if (updatedCustomers.length === 0) {
      toast.info("Nenhuma alteração detectada");
      return;
    } // Transform the data to ensure proper array structures
    const transformedCustomers = updatedCustomers.map((customer: any) => ({
      id: customer.id,
      data: {
        ...customer.data,
        // Transform phones from object to array
        phones: customer.data.phones ? Object.values(customer.data.phones).filter((phone: any) => phone !== null && phone !== undefined && phone !== "") : [],
        // Transform tags from object to array
        tags: customer.data.tags
          ? Array.isArray(customer.data.tags)
            ? customer.data.tags
            : Object.values(customer.data.tags).filter((tag: any) => tag !== null && tag !== undefined && tag !== "")
          : [],
      },
    }));
    const batchPayload = { customers: transformedCustomers };
    setIsSubmitting(true);
    try {
      const result = await batchUpdateAsync(batchPayload);
      if (result?.data) {
        // Show the detailed result dialog
        setBatchResult(result.data);
        setShowResultDialog(true);
      } else {
        // Even if we don't have detailed results, navigate back on apparent success
        navigate(routes.administration.customers.root);
      }
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Step 6 - Error during batch update:", error);
        console.error("Error details:", {
          message: (error as Error).message,
          response: (error as any).response?.data,
          status: (error as any).response?.status,
          stack: (error as Error).stack,
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResultDialogClose = (open: boolean) => {
    setShowResultDialog(open);
    if (!open) {
      setBatchResult(null);
      // If there were no failures, navigate back to list
      if (batchResult && batchResult.totalFailed === 0 && batchResult.totalSuccess > 0) {
        navigate(routes.administration.customers.root);
      }
    }
  };

  return (
    <Form {...form}>
      <Card className="h-full flex flex-col">
        {/* Hidden submit button for page header to trigger */}
        <button id="customer-batch-form-submit" type="button" onClick={form.handleSubmit(handleSubmit)} style={{ display: "none" }} disabled={isSubmitting} />
        <CardContent className="p-4 flex-1 overflow-hidden flex flex-col">
          <div className="mb-4 p-3 bg-muted/50 rounded-lg border border-border">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
              <h3 className="text-sm font-medium text-foreground">
                Editando {customers.length} {customers.length === 1 ? "cliente selecionado" : "clientes selecionados"}
              </h3>
            </div>
            <p className="text-xs text-muted-foreground">As alterações serão aplicadas apenas aos campos modificados em cada cliente</p>
          </div>

          {/* Global Actions Panel - Commented out for simplicity as users will edit individually */}
          {/* Uncomment if you want to apply the same value to all customers at once
          <div className="mb-6 p-4 bg-blue-50/50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <h4 className="text-sm font-medium mb-3 text-blue-900 dark:text-blue-100">
              Ações Globais - Aplicar a Todos
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Cidade</label>
                <div className="flex gap-2 mt-1">
                  <Input
                    placeholder="Nova cidade para todos"
                    className="h-8 text-xs"
                    onChange={(e) => {
                      if (e.target.value.trim()) {
                        handleGlobalUpdate("city", e.target.value.trim());
                      }
                    }}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Estado</label>
                <Select onValueChange={(value) => handleGlobalUpdate("state", value === "none" ? null : value)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Selecionar estado para todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {BRAZILIAN_STATES.map((state: string) => (
                      <SelectItem key={state} value={state}>
                        {state}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          */}

          {/* Customers Table */}
          <div className="border border-border rounded-lg overflow-x-auto overflow-y-auto flex-1">
            <Table className={cn("w-full min-w-[3500px] [&>div]:border-0 [&>div]:rounded-none", TABLE_LAYOUT.tableLayout)}>
              <TableHeader className="[&_tr]:border-b-0 [&_tr]:hover:bg-muted sticky top-0 z-10">
                <TableRow className="bg-muted hover:bg-muted even:bg-muted">
                  <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0 w-64">
                    <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">
                      <span className="truncate">Nome Fantasia</span>
                    </div>
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0 w-64">
                    <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">
                      <span className="truncate">Razão Social</span>
                    </div>
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0 w-80">
                    <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">
                      <span className="truncate">CPF/CNPJ</span>
                    </div>
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0 w-72">
                    <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">
                      <span className="truncate">Email</span>
                    </div>
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0 w-48">
                    <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">
                      <span className="truncate">Telefone</span>
                    </div>
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0 w-72">
                    <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">
                      <span className="truncate">Site</span>
                    </div>
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0 w-40">
                    <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">
                      <span className="truncate">CEP</span>
                    </div>
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0 w-64">
                    <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">
                      <span className="truncate">Endereço</span>
                    </div>
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0 w-24">
                    <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">
                      <span className="truncate">Número</span>
                    </div>
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0 w-48">
                    <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">
                      <span className="truncate">Complemento</span>
                    </div>
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0 w-48">
                    <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">
                      <span className="truncate">Bairro</span>
                    </div>
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0 w-48">
                    <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">
                      <span className="truncate">Cidade</span>
                    </div>
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0 w-44">
                    <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">
                      <span className="truncate">Estado</span>
                    </div>
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0 w-64">
                    <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">
                      <span className="truncate">Tags</span>
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.map((field: any, index: number) => {
                  return (
                    <TableRow
                      key={field.id}
                      className={cn(
                        "cursor-default transition-colors border-b border-border",
                        // Alternating row colors
                        index % 2 === 1 && "bg-muted/10",
                        // Hover state that works with alternating colors
                        "hover:bg-muted/20",
                      )}
                    >
                      {/* Nome Fantasia */}
                      <TableCell className="w-64 p-0 !border-r-0">
                        <div className="px-4 py-2">
                          <FormInput name={`customers.${index}.data.fantasyName`} placeholder="Nome Fantasia" className="h-8 border-muted-foreground/20" disabled={isSubmitting} />
                        </div>
                      </TableCell>

                      {/* Razão Social */}
                      <TableCell className="w-64 p-0 !border-r-0">
                        <div className="px-4 py-2">
                          <FormInput name={`customers.${index}.data.corporateName`} placeholder="Razão Social" className="h-8 border-muted-foreground/20" disabled={isSubmitting} />
                        </div>
                      </TableCell>

                      {/* CPF/CNPJ */}
                      <TableCell className="w-80 p-0 !border-r-0">
                        <div className="px-4 py-2">
                          <CpfCnpjCell control={form.control} index={index} />
                        </div>
                      </TableCell>

                      {/* Email */}
                      <TableCell className="w-72 p-0 !border-r-0">
                        <div className="px-4 py-2">
                          <FormInput
                            name={`customers.${index}.data.email`}
                            type="email"
                            placeholder="email@exemplo.com"
                            className="h-8 border-muted-foreground/20"
                            disabled={isSubmitting}
                          />
                        </div>
                      </TableCell>

                      {/* Telefone */}
                      <TableCell className="w-48 p-0 !border-r-0">
                        <div className="px-4 py-2">
                          <FormInput
                            name={`customers.${index}.data.phones.0`}
                            type="phone"
                            placeholder="(00) 00000-0000"
                            className="h-8 border-muted-foreground/20"
                            disabled={isSubmitting}
                          />
                        </div>
                      </TableCell>

                      {/* Site */}
                      <TableCell className="w-72 p-0 !border-r-0">
                        <div className="px-4 py-2">
                          <FormField
                            control={form.control}
                            name={`customers.${index}.data.site`}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input
                                    value={field.value || ""}
                                    onChange={(value) => {
                                      field.onChange(value === "" ? null : value);
                                    }}
                                    onBlur={(e) => {
                                      const val = e.target.value;
                                      if (val && val.trim() !== "") {
                                        // Auto-format URL on blur
                                        const trimmedUrl = val.trim();
                                        let formattedUrl = trimmedUrl;

                                        if (!trimmedUrl.startsWith("http://") && !trimmedUrl.startsWith("https://")) {
                                          if (trimmedUrl.startsWith("www.")) {
                                            formattedUrl = `https://${trimmedUrl}`;
                                          } else {
                                            formattedUrl = `https://www.${trimmedUrl}`;
                                          }
                                        }

                                        field.onChange(formattedUrl);
                                      }
                                      field.onBlur();
                                    }}
                                    type="url"
                                    placeholder="https://exemplo.com"
                                    className="h-8 border-muted-foreground/20"
                                    disabled={isSubmitting}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </TableCell>

                      {/* CEP - with auto-fill functionality */}
                      <TableCell className="w-40 p-0 !border-r-0">
                        <div className="px-4 py-2">
                          <FormInput
                            name={`customers.${index}.data.zipCode`}
                            type="cep"
                            placeholder="00000-000"
                            className="h-8 border-muted-foreground/20"
                            disabled={isSubmitting}
                            addressFieldName={`customers.${index}.data.address`}
                            neighborhoodFieldName={`customers.${index}.data.neighborhood`}
                            cityFieldName={`customers.${index}.data.city`}
                            stateFieldName={`customers.${index}.data.state`}
                          />
                        </div>
                      </TableCell>

                      {/* Endereço */}
                      <TableCell className="w-64 p-0 !border-r-0">
                        <div className="px-4 py-2">
                          <FormInput name={`customers.${index}.data.address`} placeholder="Rua, Avenida..." className="h-8 border-muted-foreground/20" disabled={isSubmitting} />
                        </div>
                      </TableCell>

                      {/* Número */}
                      <TableCell className="w-24 p-0 !border-r-0">
                        <div className="px-4 py-2">
                          <FormInput name={`customers.${index}.data.addressNumber`} placeholder="Número" className="h-8 border-muted-foreground/20" disabled={isSubmitting} />
                        </div>
                      </TableCell>

                      {/* Complemento */}
                      <TableCell className="w-48 p-0 !border-r-0">
                        <div className="px-4 py-2">
                          <FormInput
                            name={`customers.${index}.data.addressComplement`}
                            placeholder="Apto, Sala..."
                            className="h-8 border-muted-foreground/20"
                            disabled={isSubmitting}
                          />
                        </div>
                      </TableCell>

                      {/* Bairro */}
                      <TableCell className="w-48 p-0 !border-r-0">
                        <div className="px-4 py-2">
                          <FormInput name={`customers.${index}.data.neighborhood`} placeholder="Bairro" className="h-8 border-muted-foreground/20" disabled={isSubmitting} />
                        </div>
                      </TableCell>

                      {/* Cidade */}
                      <TableCell className="w-48 p-0 !border-r-0">
                        <div className="px-4 py-2">
                          <FormInput name={`customers.${index}.data.city`} placeholder="Cidade" className="h-8 border-muted-foreground/20" disabled={isSubmitting} />
                        </div>
                      </TableCell>

                      {/* Estado */}
                      <TableCell className="w-44 p-0 !border-r-0">
                        <div className="px-4 py-2">
                          <StateSelector disabled={isSubmitting} />
                        </div>
                      </TableCell>

                      {/* Tags */}
                      <TableCell className="w-64 p-0 !border-r-0">
                        <div className="px-4 py-2">
                          <TagsInput control={form.control} disabled={isSubmitting} name={`customers.${index}.data.tags`} />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Batch Operation Result Dialog */}
      <CustomerBatchResultDialog open={showResultDialog} onOpenChange={handleResultDialogClose} result={batchResult} operationType="update" />
    </Form>
  );
}
