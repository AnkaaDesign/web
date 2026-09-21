// web/src/components/cliente/solicitacao/portal-customer-combobox.tsx
//
// O COMBOBOX DE CLIENTE DO PORTAL — e o "criar" que mora DENTRO dele.
//
// Duas diferenças em relação ao `CustomerSelector` do sistema interno, e as
// duas são de portal e não de estilo:
//
//  • a busca vai pelo cliente HTTP do portal, nunca pelo `apiClient` do
//    funcionário (que injetaria o bearer errado — ver `responsible-auth.ts`);
//  • "criar" NÃO faz POST. Ele preenche `novoCliente` do payload §5, e o
//    cliente nasce no mesmo POST da requisição. Um envio que falha não deixa
//    cadastro órfão no banco.
//
// A EMPRESA DO PRÓPRIO CONTATO entra sempre como opção fixa. É o caso comum —
// e é o que mantém a tela utilizável mesmo se a busca de catálogo falhar ou
// ainda não existir no servidor (ver o cabeçalho de `solicitacao-api.ts`).
import { useCallback, useMemo } from "react";
import { IconUser } from "@tabler/icons-react";
import { Combobox } from "@/components/ui/combobox";
import { formatCNPJ, formatCPF } from "@/utils";
import { buscarClientesDoPortal, type PortalCustomerOption } from "./solicitacao-api";

interface PortalCustomerComboboxProps {
  value: string | null | undefined;
  onValueChange: (value: string | null) => void;
  /** Distingue as instâncias no cache do React Query (cliente × faturar para). */
  queryKeySuffix: string;
  /** Opções sempre oferecidas: a empresa do contato e o cliente em cadastro. */
  extraOptions?: PortalCustomerOption[];
  disabled?: boolean;
  placeholder?: string;
  /**
   * Abre o cadastro na hora. Resolve com a opção sintética para que o combobox
   * a guarde, selecione e feche o popover — é o contrato de `onCreate`.
   * Resolve com `null` quando o contato desiste.
   */
  onCreateRequested?: (searchText: string) => Promise<PortalCustomerOption | null>;
  isCreating?: boolean;
  /**
   * Toda opção que passou por aqui, para quem precisa do NOME de um id depois
   * — o Resumo, que não tem rota para resolver um cliente pelo id. É o mesmo
   * `customersCache` que o assistente interno de orçamento mantém.
   */
  onOptionsSeen?: (options: PortalCustomerOption[]) => void;
}

export function PortalCustomerCombobox({
  value,
  onValueChange,
  queryKeySuffix,
  extraOptions = [],
  disabled,
  placeholder = "Selecione o cliente",
  onCreateRequested,
  isCreating,
  onOptionsSeen,
}: PortalCustomerComboboxProps) {
  const getOptionLabel = useCallback(
    (customer: PortalCustomerOption) => customer.fantasyName || customer.corporateName || "Cliente",
    [],
  );
  const getOptionValue = useCallback((customer: PortalCustomerOption) => customer.id, []);

  const queryFn = useCallback(
    async (search: string, page = 1) => {
      const result = await buscarClientesDoPortal(search, page);
      // As opções fixas (empresa do contato, cliente em cadastro) entram na
      // lista, MAS obedecem ao texto buscado.
      //
      // ⚠️ Obedecer é o que faz a opção "criar" existir: o combobox só a
      // oferece quando a busca não devolve NADA
      // (`showCreateOption = allowCreate && search && filteredOptions.length === 0`).
      // Empurrar a empresa do contato em toda busca deixaria a lista com um
      // item sempre, e "Cadastrar cliente" nunca apareceria — que é justamente
      // o caminho que o dono pediu que morasse aqui dentro.
      const termo = (search ?? "").trim().toLowerCase();
      const casa = (option: PortalCustomerOption) =>
        !termo ||
        [option.fantasyName, option.corporateName, option.cnpj, option.cpf]
          .filter(Boolean)
          .some((campo) => String(campo).toLowerCase().includes(termo));

      const extras = extraOptions.filter(
        (extra) => casa(extra) && !result.data.some((row) => row.id === extra.id),
      );
      const options = [...extras, ...result.data];
      onOptionsSeen?.(options);
      return { data: options, hasMore: result.hasMore };
    },
    [extraOptions, onOptionsSeen],
  );

  const initialOptions = useMemo(() => extraOptions, [extraOptions]);

  return (
    <Combobox<PortalCustomerOption>
      value={value ?? ""}
      onValueChange={(next) => onValueChange(typeof next === "string" && next ? next : null)}
      mode="single"
      async
      queryKey={["portal", "customers", queryKeySuffix]}
      queryFn={queryFn}
      initialOptions={initialOptions}
      getOptionLabel={getOptionLabel}
      getOptionValue={getOptionValue}
      placeholder={placeholder}
      searchPlaceholder="Pesquisar por nome ou documento..."
      emptyText="Nenhum cliente encontrado"
      disabled={disabled}
      clearable
      minSearchLength={0}
      debounceMs={400}
      pageSize={20}
      allowCreate={!!onCreateRequested}
      isCreating={isCreating}
      createLabel={(text) => `Cadastrar cliente "${text}"`}
      onCreate={
        onCreateRequested
          ? ((text: string) => onCreateRequested(text) as Promise<PortalCustomerOption>)
          : undefined
      }
      renderOption={(customer) => (
        <div className="flex min-w-0 items-center gap-3">
          <IconUser className="h-4 w-4 shrink-0 opacity-60" />
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-medium">
              {customer.fantasyName || customer.corporateName}
            </span>
            <span className="truncate text-sm opacity-70">
              {customer.cnpj
                ? formatCNPJ(customer.cnpj)
                : customer.cpf
                  ? formatCPF(customer.cpf)
                  : customer.corporateName || "Sem documento cadastrado"}
            </span>
          </div>
        </div>
      )}
    />
  );
}
