import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Supplier, BatchOperationResult } from "../../../../types";
import { useBatchUpdateSuppliers } from "../../../../hooks";
import { SupplierBatchResultDialog } from "@/components/ui/batch-operation-result-dialog";
import { BRAZILIAN_STATES, routes } from "../../../../constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { FormInput } from "@/components/ui/form-input";
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
import { CnpjCell } from "./cells/cnpj-cell";
import { CepCell } from "./cells/cep-cell";
import { TagsCell } from "./cells/tags-cell";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { IconLoader2, IconDeviceFloppy, IconX } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { TABLE_LAYOUT } from "@/components/ui/table-constants";

// Schema for batch edit form - common fields only for bulk update
// Schema for batch edit form - common fields only for bulk update
const supplierBatchEditSchema = z.object({
  suppliers: z.array(
    z.object({
      id: z.string(),
      data: z
        .object({
          // Identification fields
          fantasyName: z.string().min(1, "Nome fantasia é obrigatório").max(200, "Nome fantasia deve ter no máximo 200 caracteres").optional(),
          corporateName: z.string().max(200, "Razão social deve ter no máximo 200 caracteres").nullable().optional(),
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

type SupplierBatchEditFormData = z.infer<typeof supplierBatchEditSchema>;

interface SupplierBatchEditTableProps {
  suppliers: Supplier[];
  onCancel: () => void;
  onSubmit?: () => void;
}

export function SupplierBatchEditTable({ suppliers, onCancel, onSubmit }: SupplierBatchEditTableProps) {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [batchResult, setBatchResult] = useState<BatchOperationResult<Supplier, Supplier> | null>(null);
  const [showResultDialog, setShowResultDialog] = useState(false);
  const { mutateAsync: batchUpdateAsync } = useBatchUpdateSuppliers();

  const form = useForm<SupplierBatchEditFormData>({
    resolver: zodResolver(supplierBatchEditSchema),
    defaultValues: {
      suppliers: suppliers.map((supplier: Supplier) => ({
        id: supplier.id,
        data: {
          fantasyName: supplier.fantasyName,
          corporateName: supplier.corporateName,
          cnpj: supplier.cnpj,
          email: supplier.email,
          site: supplier.site,
          phones: supplier.phones || [],
          address: supplier.address,
          addressNumber: supplier.addressNumber,
          addressComplement: supplier.addressComplement,
          neighborhood: supplier.neighborhood,
          city: supplier.city,
          state: supplier.state,
          zipCode: supplier.zipCode,
          tags: supplier.tags || [],
        },
      })),
    },
  });

  const { fields } = useFieldArray({
    control: form.control,
    name: "suppliers",
  });

  const handleSubmit = async (data: SupplierBatchEditFormData) => {
    // Filter out suppliers with no changes
    const updatedSuppliers = data.suppliers.filter((supplier: any) => {
      const originalSupplier = suppliers.find((s: Supplier) => s.id === supplier.id);
      if (!originalSupplier) return false;

      const hasChanges =
        supplier.data.fantasyName !== originalSupplier.fantasyName ||
        supplier.data.corporateName !== originalSupplier.corporateName ||
        supplier.data.cnpj !== originalSupplier.cnpj ||
        supplier.data.email !== originalSupplier.email ||
        supplier.data.site !== originalSupplier.site ||
        JSON.stringify(supplier.data.phones) !== JSON.stringify(originalSupplier.phones || []) ||
        supplier.data.address !== originalSupplier.address ||
        supplier.data.addressNumber !== originalSupplier.addressNumber ||
        supplier.data.addressComplement !== (originalSupplier.addressComplement || "") ||
        supplier.data.neighborhood !== (originalSupplier.neighborhood || "") ||
        supplier.data.city !== originalSupplier.city ||
        supplier.data.state !== originalSupplier.state ||
        supplier.data.zipCode !== originalSupplier.zipCode ||
        JSON.stringify(supplier.data.tags) !== JSON.stringify(originalSupplier.tags || []);

      return hasChanges;
    });

    if (updatedSuppliers.length === 0) {
      toast.info("Nenhuma alteração detectada");
      return;
    } // Transform the data to ensure proper array structures
    const transformedSuppliers = updatedSuppliers.map((supplier: any) => ({
      id: supplier.id,
      data: {
        ...supplier.data,
        // Transform phones from object to array
        phones: supplier.data.phones ? Object.values(supplier.data.phones).filter((phone: any) => phone !== null && phone !== undefined && phone !== "") : [],
        // Transform tags from object to array
        tags: supplier.data.tags
          ? Array.isArray(supplier.data.tags)
            ? supplier.data.tags
            : Object.values(supplier.data.tags).filter((tag: any) => tag !== null && tag !== undefined && tag !== "")
          : [],
      },
    }));
    const batchPayload = { suppliers: transformedSuppliers };
    setIsSubmitting(true);
    try {
      const result = await batchUpdateAsync(batchPayload);
      if (result?.data) {
        // Show the detailed result dialog
        setBatchResult(result.data);
        setShowResultDialog(true);
      } else {
        // Even if we don't have detailed results, navigate back on apparent success
        navigate(routes.inventory.suppliers.root);
      }
    } catch (error) {
      console.error("Step 6 - Error during batch update:", error);
      console.error("Error details:", {
        message: (error as Error).message,
        response: (error as any).response?.data,
        status: (error as any).response?.status,
        stack: (error as Error).stack,
      });
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
        navigate(routes.inventory.suppliers.root);
      }
    }
  };

  return (
    <Form {...form}>
      <Card className="h-full flex flex-col">
        {/* Hidden submit button for page header to trigger */}
        <button id="supplier-batch-form-submit" type="button" onClick={form.handleSubmit(handleSubmit)} style={{ display: "none" }} disabled={isSubmitting} />
        <CardContent className="p-6 flex-1 overflow-hidden flex flex-col">
          <div className="mb-4 p-3 bg-muted/50 rounded-lg border border-border">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
              <h3 className="text-sm font-medium text-foreground">
                Editando {suppliers.length} {suppliers.length === 1 ? "fornecedor selecionado" : "fornecedores selecionados"}
              </h3>
            </div>
            <p className="text-xs text-muted-foreground">As alterações serão aplicadas apenas aos campos modificados em cada fornecedor</p>
          </div>

          {/* Global Actions Panel - Commented out for simplicity as users will edit individually */}
          {/* Uncomment if you want to apply the same value to all suppliers at once
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
                <Combobox
                  onValueChange={(value) => handleGlobalUpdate("state", value === "none" ? null : value)}
                  options={[
                    { label: "Nenhum", value: "none" },
                    ...BRAZILIAN_STATES.map((state) => ({
                      label: state,
                      value: state,
                    })),
                  ]}
                  placeholder="Selecionar estado para todos"
                  searchPlaceholder="Buscar estado..."
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </div>
          */}

          {/* Suppliers Table */}
          <div className="border border-border rounded-lg overflow-x-auto overflow-y-auto flex-1">
            <Table className={cn("w-full min-w-[2800px] [&>div]:border-0 [&>div]:rounded-none", TABLE_LAYOUT.tableLayout)}>
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
                  <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0 w-56">
                    <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">
                      <span className="truncate">CNPJ</span>
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
                  <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0 w-24">
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
                {fields.map((field, index) => {
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
                          <FormField
                            control={form.control as any}
                            name={`suppliers.${index}.data.fantasyName`}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input
                                    value={field.value || ""}
                                    onChange={(value) => {
                                      field.onChange(value);
                                    }}
                                    name={field.name}
                                    onBlur={field.onBlur}
                                    ref={field.ref}
                                    className="w-full h-8 border-muted-foreground/20"
                                    placeholder="Nome Fantasia"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </TableCell>

                      {/* Razão Social */}
                      <TableCell className="w-64 p-0 !border-r-0">
                        <div className="px-4 py-2">
                          <FormField
                            control={form.control as any}
                            name={`suppliers.${index}.data.corporateName`}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input
                                    value={field.value || ""}
                                    onChange={(value) => {
                                      field.onChange(value);
                                    }}
                                    name={field.name}
                                    onBlur={field.onBlur}
                                    ref={field.ref}
                                    className="w-full h-8 border-muted-foreground/20"
                                    placeholder="Razão Social"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </TableCell>

                      {/* CNPJ */}
                      <TableCell className="w-56 p-0 !border-r-0">
                        <div className="px-4 py-2">
                          <CnpjCell control={form.control as any} index={index} />
                        </div>
                      </TableCell>

                      {/* Email */}
                      <TableCell className="w-72 p-0 !border-r-0">
                        <div className="px-4 py-2">
                          <FormInput
                            name={`suppliers.${index}.data.email`}
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
                            name={`suppliers.${index}.data.phones.0`}
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
                            name={`suppliers.${index}.data.site`}
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
                          <CepCell
                            control={form.control as any}
                            index={index}
                            onAddressFound={(data) => {
                              // Always update address fields when CEP is found, even if they already have values
                              // This ensures the address is always in sync with the CEP
                              form.setValue(`suppliers.${index}.data.address`, data.address, {
                                shouldDirty: true,
                                shouldValidate: true,
                              });
                              form.setValue(`suppliers.${index}.data.neighborhood`, data.neighborhood, {
                                shouldDirty: true,
                                shouldValidate: true,
                              });
                              form.setValue(`suppliers.${index}.data.city`, data.city, {
                                shouldDirty: true,
                                shouldValidate: true,
                              });
                              form.setValue(`suppliers.${index}.data.state`, data.state, {
                                shouldDirty: true,
                                shouldValidate: true,
                              });
                            }}
                          />
                        </div>
                      </TableCell>

                      {/* Endereço */}
                      <TableCell className="w-64 p-0 !border-r-0">
                        <div className="px-4 py-2">
                          <FormField
                            control={form.control as any}
                            name={`suppliers.${index}.data.address`}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input
                                    value={field.value || ""}
                                    onChange={(value) => {
                                      field.onChange(value);
                                    }}
                                    name={field.name}
                                    onBlur={field.onBlur}
                                    ref={field.ref}
                                    className="w-full h-8 border-muted-foreground/20"
                                    placeholder="Rua, Avenida..."
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </TableCell>

                      {/* Número */}
                      <TableCell className="w-24 p-0 !border-r-0">
                        <div className="px-4 py-2">
                          <FormInput name={`suppliers.${index}.data.addressNumber`} placeholder="N°" className="h-8 border-muted-foreground/20" disabled={isSubmitting} />
                        </div>
                      </TableCell>

                      {/* Complemento */}
                      <TableCell className="w-48 p-0 !border-r-0">
                        <div className="px-4 py-2">
                          <FormInput
                            name={`suppliers.${index}.data.addressComplement`}
                            placeholder="Apto, Sala..."
                            className="h-8 border-muted-foreground/20"
                            disabled={isSubmitting}
                          />
                        </div>
                      </TableCell>

                      {/* Bairro */}
                      <TableCell className="w-48 p-0 !border-r-0">
                        <div className="px-4 py-2">
                          <FormInput name={`suppliers.${index}.data.neighborhood`} placeholder="Bairro" className="h-8 border-muted-foreground/20" disabled={isSubmitting} />
                        </div>
                      </TableCell>

                      {/* Cidade */}
                      <TableCell className="w-48 p-0 !border-r-0">
                        <div className="px-4 py-2">
                          <FormInput name={`suppliers.${index}.data.city`} placeholder="Cidade" className="h-8 border-muted-foreground/20" disabled={isSubmitting} />
                        </div>
                      </TableCell>

                      {/* Estado */}
                      <TableCell className="w-24 p-0 !border-r-0">
                        <div className="px-4 py-2">
                          <FormField
                            control={form.control as any}
                            name={`suppliers.${index}.data.state`}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Combobox
                                    value={field.value || "none"}
                                    onValueChange={(value) => field.onChange(value === "none" ? null : value)}
                                    options={[
                                      { label: "Nenhum", value: "none" },
                                      ...BRAZILIAN_STATES.map((state) => ({
                                        label: state,
                                        value: state,
                                      })),
                                    ]}
                                    placeholder="UF"
                                    searchPlaceholder="Buscar UF..."
                                    className="w-full h-8 border-muted-foreground/20"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </TableCell>

                      {/* Tags */}
                      <TableCell className="w-64 p-0 !border-r-0">
                        <div className="px-4 py-2">
                          <TagsCell control={form.control as any} index={index} fieldName="suppliers" />
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
      <SupplierBatchResultDialog open={showResultDialog} onOpenChange={handleResultDialogClose} result={batchResult} />
    </Form>
  );
}
