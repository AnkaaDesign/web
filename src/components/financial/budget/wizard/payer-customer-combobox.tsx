/**
 * O CLIENTE DE UM PAGADOR — busca por nome, fantasia ou documento, e aceita
 * CRIAR (com a busca da Receita quando o texto é um CNPJ).
 *
 * No lugar do CNPJ digitado livre do passo de cliente antigo (decisão do dono,
 * 02/10/2026). Criar com um documento que já existe NÃO cria um segundo
 * cadastro: a API responde 409 com o dono, e o combobox seleciona o existente.
 *
 * Devolve o REGISTRO inteiro do cliente — é dele que o pagador copia o cadastro.
 */
import { useCallback, useMemo, useState } from "react";

import { Combobox } from "@/components/ui/combobox";
import { CustomerLogoDisplay } from "@/components/ui/avatar-display";
import { toast } from "@/components/ui/sonner";
import { PINNED_CUSTOMERS } from "@/config/company";
import { getCustomerById, getCustomers, quickCreateCustomer } from "@/api-client";
import { useCnpjAutocomplete } from "@/hooks/common/use-cnpj-autocomplete";
import { formatCNPJ, formatCPF } from "@/utils";
import { existingCustomerIdFromError } from "@/utils/budget-payers";

interface PayerCustomerComboboxProps {
  value: string | null;
  /** O registro escolhido (ou criado). */
  onSelect: (customer: any) => void;
  /** Os já usados por outros pagadores — aparecem, mas não podem ser escolhidos. */
  takenCustomerIds?: readonly string[];
  /** O registro selecionado, para o rótulo aparecer antes da busca. */
  selected?: any | null;
  /** Cache comum da tela: tudo o que a busca trouxer entra nele. */
  customersCache?: React.MutableRefObject<Map<string, any>>;
  disabled?: boolean;
  placeholder?: string;
  queryKey: string;
}

export function PayerCustomerCombobox({
  value,
  onSelect,
  takenCustomerIds = [],
  selected,
  customersCache,
  disabled,
  placeholder = "Selecione ou cadastre o cliente",
  queryKey,
}: PayerCustomerComboboxProps) {
  const [isCreating, setIsCreating] = useState(false);
  const { isLookingUp, getCreateLabel, buildCustomerData, processInput, reset: resetCnpj } = useCnpjAutocomplete();
  const taken = useMemo(() => new Set(takenCustomerIds), [takenCustomerIds]);

  const remember = useCallback(
    (customers: any[]) => customers.forEach((c) => c?.id && customersCache?.current.set(c.id, c)),
    [customersCache],
  );

  const searchCustomers = useCallback(
    async (search?: string, page = 1): Promise<{ data: any[]; hasMore: boolean }> => {
      processInput(search ?? "");
      const params: any = { orderBy: { fantasyName: "asc" }, page, take: 50, include: { logo: true } };
      if (search?.trim()) params.searchingFor = search.trim();
      try {
        const response = await getCustomers(params);
        const customers = response.data || [];
        // O cliente de maior volume de faturamento primeiro, sem busca.
        if (page === 1 && !search?.trim()) {
          const pinnedIndex = customers.findIndex((c: any) => c.id === PINNED_CUSTOMERS.IBIPORA);
          if (pinnedIndex > 0) customers.unshift(...customers.splice(pinnedIndex, 1));
        }
        remember(customers);
        return { data: customers, hasMore: response.meta?.hasNextPage || false };
      } catch {
        return { data: [], hasMore: false };
      }
    },
    [processInput, remember],
  );

  const loadById = useCallback(
    async (id: string) => {
      const response = await getCustomerById(id, { include: { logo: true } } as any);
      const customer = response?.data;
      if (customer) remember([customer]);
      return customer;
    },
    [remember],
  );

  const handleCreate = useCallback(
    async (text: string) => {
      setIsCreating(true);
      try {
        const result = await quickCreateCustomer(buildCustomerData(text));
        if (result.success && result.data) {
          resetCnpj();
          remember([result.data]);
          return result.data;
        }
      } catch (error) {
        // DOCUMENTO JÁ CADASTRADO: seleciona o dono em vez de criar outro.
        const existingId = existingCustomerIdFromError(error);
        if (existingId) {
          const existing = await loadById(existingId);
          if (existing) {
            resetCnpj();
            toast.info(
              `Este documento já é do cliente ${existing.fantasyName || existing.corporateName} — ele foi selecionado.`,
            );
            onSelect(existing);
            return undefined;
          }
        }
        throw error;
      } finally {
        setIsCreating(false);
      }
      return undefined;
    },
    [buildCustomerData, resetCnpj, remember, loadById, onSelect],
  );

  const initialOptions = useMemo(() => (selected?.id ? [selected] : []), [selected]);

  return (
    <Combobox<any>
      value={value ?? ""}
      onValueChange={async (next) => {
        const id = typeof next === "string" ? next : "";
        if (!id || id === value) return;
        if (taken.has(id)) {
          toast.warning("Este cliente já é pagador deste orçamento.");
          return;
        }
        resetCnpj();
        const record = customersCache?.current.get(id) ?? (await loadById(id));
        if (record) onSelect(record);
      }}
      placeholder={placeholder}
      emptyText={isLookingUp ? "Buscando CNPJ..." : "Nenhum cliente encontrado"}
      searchPlaceholder="Pesquisar por nome, fantasia ou CNPJ/CPF..."
      disabled={disabled || isCreating}
      async
      allowCreate
      createLabel={getCreateLabel}
      onCreate={handleCreate as any}
      isCreating={isCreating || isLookingUp}
      queryKey={[queryKey]}
      queryFn={searchCustomers}
      initialOptions={initialOptions}
      minSearchLength={0}
      clearable={false}
      getOptionValue={(customer: any) => customer.id}
      getOptionLabel={(customer: any) => customer.corporateName || customer.fantasyName}
      renderOption={(customer: any) => (
        <div className={`flex w-full items-center gap-3 ${taken.has(customer.id) ? "opacity-50" : ""}`}>
          <CustomerLogoDisplay
            logo={customer.logo}
            customerName={customer.fantasyName || customer.corporateName}
            size="sm"
            shape="rounded"
            className="flex-shrink-0"
          />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <div className="truncate font-medium">{customer.corporateName || customer.fantasyName}</div>
            <div className="truncate text-xs opacity-70">
              {[
                customer.fantasyName && customer.fantasyName !== customer.corporateName ? customer.fantasyName : null,
                customer.cnpj ? formatCNPJ(customer.cnpj) : customer.cpf ? formatCPF(customer.cpf) : null,
                taken.has(customer.id) ? "já é pagador" : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </div>
          </div>
        </div>
      )}
    />
  );
}
