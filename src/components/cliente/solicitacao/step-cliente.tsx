// web/src/components/cliente/solicitacao/step-cliente.tsx
//
// PASSO 1 — DE QUEM É O SERVIÇO, E PARA QUEM VAI A FATURA.
//
// São DUAS perguntas e não uma, e o caso que prova isso é a Furgões: o
// implementador manda pintar o furgão e paga a pintura; o dono do caminhão
// manda aplicar a logomarca e paga a logomarca. Cliente do serviço e pagador
// são pessoas diferentes, e o orçamento precisa dos dois — `Task.customerId` de
// um lado, `BudgetPayer.customerId` ("Faturar Para") do outro.
//
// Quando são o mesmo — que é o caso comum — a caixa de seleção mantém os dois
// em sincronia, para que ninguém preencha a mesma coisa duas vezes.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { IconBuildingStore, IconFileInvoice, IconPencil } from "@tabler/icons-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCNPJ, formatCPF } from "@/utils";
import { useResponsibleAuth } from "@/contexts/responsible-auth-context";
import { PortalCustomerCombobox } from "./portal-customer-combobox";
import { NovoClienteDialog } from "./novo-cliente-dialog";
import type { PortalCustomerOption } from "./solicitacao-api";
import { NOVO_CLIENTE_VALUE, type NovoClienteFormData, type SolicitacaoFormData } from "./solicitacao-schema";

interface StepClienteProps {
  disabled?: boolean;
  /** Alimenta o cache de nomes que o Resumo lê — ver `solicitar.tsx`. */
  onCustomersSeen?: (options: PortalCustomerOption[]) => void;
}

export function SolicitacaoStepCliente({ disabled, onCustomersSeen }: StepClienteProps) {
  const { control, setValue, getValues } = useFormContext<SolicitacaoFormData>();
  const { responsible } = useResponsibleAuth();

  const customerId = useWatch({ control, name: "customerId" });
  const novoCliente = useWatch({ control, name: "novoCliente" });
  const faturarPara = useWatch({ control, name: "faturarParaCustomerId" });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogName, setDialogName] = useState("");
  const pendingCreateResolve = useRef<((option: PortalCustomerOption | null) => void) | null>(null);

  /** A empresa do próprio contato. Opção fixa dos dois combos. */
  const minhaEmpresa = useMemo<PortalCustomerOption | null>(() => {
    if (!responsible?.companyId) return null;
    return {
      id: responsible.companyId,
      fantasyName: responsible.companyName || "Minha empresa",
    };
  }, [responsible?.companyId, responsible?.companyName]);

  /** A opção sintética do cliente que ainda não existe no banco. */
  const opcaoNovoCliente = useMemo<PortalCustomerOption | null>(() => {
    if (!novoCliente) return null;
    return {
      id: NOVO_CLIENTE_VALUE,
      fantasyName: novoCliente.fantasyName,
      corporateName: novoCliente.corporateName ?? null,
      cnpj: novoCliente.cnpj ?? null,
      cpf: novoCliente.cpf ?? null,
    };
  }, [novoCliente]);

  const opcoesServico = useMemo(
    () => [opcaoNovoCliente, minhaEmpresa].filter(Boolean) as PortalCustomerOption[],
    [opcaoNovoCliente, minhaEmpresa],
  );

  // "Faturar Para" precisa de um id REAL (§5: `faturarParaCustomerId: string`),
  // então o cliente que ainda vai nascer não entra aqui.
  const opcoesPagador = useMemo(
    () => (minhaEmpresa ? [minhaEmpresa] : []),
    [minhaEmpresa],
  );

  // Sugestão de abertura: o pagador é a empresa do contato. É o caso comum e
  // poupa um clique; trocar continua sendo um clique.
  const semeadoRef = useRef(false);
  useEffect(() => {
    if (semeadoRef.current) return;
    if (!minhaEmpresa) return;
    if (getValues("faturarParaCustomerId")) {
      semeadoRef.current = true;
      return;
    }
    semeadoRef.current = true;
    // `shouldDirty: false` de propósito: uma sugestão que o contato não digitou
    // não pode disparar o aviso de "alterações não salvas" ao sair da tela.
    setValue("faturarParaCustomerId", minhaEmpresa.id, { shouldDirty: false });
  }, [minhaEmpresa, getValues, setValue]);

  const mesmoCliente =
    !!customerId && customerId !== NOVO_CLIENTE_VALUE && customerId === faturarPara;

  const handleCreateRequested = useCallback((searchText: string) => {
    setDialogName(searchText);
    setDialogOpen(true);
    return new Promise<PortalCustomerOption | null>((resolve) => {
      pendingCreateResolve.current = resolve;
    });
  }, []);

  const handleNovoClienteConfirmado = useCallback(
    (data: NovoClienteFormData) => {
      setValue("novoCliente", data, { shouldDirty: true, shouldValidate: true });
      setValue("customerId", NOVO_CLIENTE_VALUE, { shouldDirty: true, shouldValidate: true });
      const option: PortalCustomerOption = {
        id: NOVO_CLIENTE_VALUE,
        fantasyName: data.fantasyName,
        corporateName: data.corporateName ?? null,
        cnpj: data.cnpj ?? null,
        cpf: data.cpf ?? null,
      };
      // Resolver ANTES de o diálogo fechar: é o que faz o combobox guardar a
      // opção, selecioná-la e fechar o popover.
      pendingCreateResolve.current?.(option);
      pendingCreateResolve.current = null;
    },
    [setValue],
  );

  const handleDialogOpenChange = useCallback((open: boolean) => {
    setDialogOpen(open);
    if (!open && pendingCreateResolve.current) {
      // Desistiu: o combobox precisa saber, senão fica "criando" para sempre.
      pendingCreateResolve.current(null);
      pendingCreateResolve.current = null;
    }
  }, []);

  const handleServicoChange = useCallback(
    (value: string | null) => {
      setValue("customerId", value, { shouldDirty: true, shouldValidate: true });
      if (value !== NOVO_CLIENTE_VALUE) {
        // Trocar para um cliente de verdade descarta o cadastro em rascunho —
        // deixá-lo ali faria o payload carregar os DOIS, que o schema recusa.
        setValue("novoCliente", null, { shouldDirty: true, shouldValidate: true });
      }
      if (mesmoCliente && value && value !== NOVO_CLIENTE_VALUE) {
        setValue("faturarParaCustomerId", value, { shouldDirty: true, shouldValidate: true });
      }
    },
    [setValue, mesmoCliente],
  );

  const handleMesmoClienteChange = useCallback(
    (checked: boolean) => {
      if (checked && customerId && customerId !== NOVO_CLIENTE_VALUE) {
        setValue("faturarParaCustomerId", customerId, { shouldDirty: true, shouldValidate: true });
      } else if (!checked && minhaEmpresa) {
        setValue("faturarParaCustomerId", minhaEmpresa.id, { shouldDirty: true, shouldValidate: true });
      }
    },
    [customerId, minhaEmpresa, setValue],
  );

  const documentoNovoCliente = novoCliente?.cnpj
    ? formatCNPJ(novoCliente.cnpj)
    : novoCliente?.cpf
      ? formatCPF(novoCliente.cpf)
      : null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconBuildingStore className="h-5 w-5" />
            Cliente do serviço
          </CardTitle>
          <CardDescription>
            De quem é o veículo que vai receber o serviço. Se ainda não estiver cadastrado,
            cadastre pela opção "Cadastrar cliente" dentro da própria lista.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormField
            control={control}
            name="customerId"
            render={() => (
              <FormItem>
                <FormLabel>Cliente</FormLabel>
                <PortalCustomerCombobox
                  value={customerId}
                  onValueChange={handleServicoChange}
                  queryKeySuffix="servico"
                  extraOptions={opcoesServico}
                  disabled={disabled}
                  placeholder="Selecione ou cadastre o cliente"
                  onCreateRequested={handleCreateRequested}
                  onOptionsSeen={onCustomersSeen}
                />
                <FormMessage />
              </FormItem>
            )}
          />

          {novoCliente && (
            <div className="flex flex-wrap items-center gap-3 rounded-md border border-dashed border-border p-3">
              <Badge variant="secondary">Será cadastrado no envio</Badge>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{novoCliente.fantasyName}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {documentoNovoCliente ?? "Sem documento"}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled}
                onClick={() => {
                  setDialogName(novoCliente.fantasyName);
                  setDialogOpen(true);
                }}
              >
                <IconPencil className="mr-2 h-4 w-4" />
                Editar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconFileInvoice className="h-5 w-5" />
            Faturar para
          </CardTitle>
          <CardDescription>
            Quem recebe a fatura deste orçamento. Pode ser diferente do cliente do serviço —
            é o caso de quem manda pintar o implemento e cobra a pintura, enquanto o dono do
            caminhão cobra a logomarca.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {customerId && customerId !== NOVO_CLIENTE_VALUE && (
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={mesmoCliente}
                onCheckedChange={(checked) => handleMesmoClienteChange(checked === true)}
                disabled={disabled}
              />
              Faturar para o mesmo cliente do serviço
            </label>
          )}

          <FormField
            control={control}
            name="faturarParaCustomerId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cliente a faturar</FormLabel>
                <PortalCustomerCombobox
                  value={field.value}
                  onValueChange={(value) =>
                    setValue("faturarParaCustomerId", value ?? "", {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                  queryKeySuffix="pagador"
                  extraOptions={opcoesPagador}
                  disabled={disabled || mesmoCliente}
                  placeholder="Selecione quem recebe a fatura"
                  onOptionsSeen={onCustomersSeen}
                />
                <FormMessage />
              </FormItem>
            )}
          />
        </CardContent>
      </Card>

      <NovoClienteDialog
        open={dialogOpen}
        onOpenChange={handleDialogOpenChange}
        initialName={dialogName}
        initialValues={novoCliente ?? null}
        onConfirm={handleNovoClienteConfirmado}
      />
    </div>
  );
}
