import { useCallback, useMemo, useRef } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { CustomerLogoDisplay } from "@/components/ui/avatar-display";
import { formatCNPJ, formatBrazilianPhone } from "@/utils";
import { IconUsers, IconUser, IconAlertTriangle, IconTrash } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { getCustomers } from "@/api-client/customer";
import { missingBillingCustomerLabels } from "@/lib/billing-customer-data";
import { PINNED_CUSTOMERS } from "@/config/company";
import { useResponsibles } from "@/hooks/administration/use-responsible";
import { formatResponsibleRoles, getResponsibleRoles } from "@/types/responsible";
import { cn } from "@/lib/utils";
import { hasNoEffectiveDiscount, pickDiscountTerms } from "@/utils/budget-calculations";
import {
  coverageSummary,
  hasMultipleCustomers as hasMultipleCustomersOf,
} from "@/utils/quote-tasks";

interface BillingStepInfoProps {
  task?: any;
  disabled?: boolean;
  customersCache: React.MutableRefObject<Map<string, any>>;
  /**
   * OS VEÍCULOS do orçamento — só para NOMEAR a fatura.
   *
   * O rótulo de cada responsável era o nome do cliente; num orçamento cobrado
   * veículo a veículo ele se repete N vezes e não identifica nada. O veículo
   * desempata.
   */
  vehicles?: Array<{
    id: string;
    name?: string | null;
    serialNumber?: string | null;
    truck?: { plate?: string | null } | null;
  }>;
  /**
   * As posições, na lista do ORÇAMENTO, dos pagadores DESTA cobrança.
   * Ausente = a lista inteira — é a tela de orçamento, onde a pergunta é do
   * contrato e não de uma cobrança.
   */
  configIdx?: number[];
}

export function BillingStepInfo({
  task,
  disabled,
  customersCache,
  vehicles,
  configIdx,
}: BillingStepInfoProps) {
  const { control, setValue, getValues } = useFormContext();
  const todosConfigs = useWatch({ control, name: "customerConfigs" }) || [];

  // ═══════════════════════════════════════════════════════════════════════════
  // OS PAGADORES DESTA COBRANÇA — não os do orçamento
  // ═══════════════════════════════════════════════════════════════════════════
  //
  // `customerConfigs` é a lista do ORÇAMENTO INTEIRO. Numa cobrança por veículo,
  // três caminhões do mesmo cliente são TRÊS pagadores — um por cobrança — e
  // esta tela, que é de UMA delas, mostrava "3 selecionados" com o mesmo CNPJ
  // repetido três vezes, e três blocos de responsável, um por veículo do
  // orçamento. Nenhuma dessas três linhas é uma escolha desta página.
  //
  // O número de pagadores aqui é o número de CLIENTES que dividem ESTA cobrança:
  // um, quase sempre; dois quando o recorte é cobrado a dois clientes. É essa
  // distinção que a lista do orçamento não sabe fazer.
  //
  // `configIdx` são as posições, na lista do orçamento, que pertencem a esta
  // cobrança. Ausente = a lista inteira (a tela de ORÇAMENTO, onde a pergunta é
  // mesmo sobre o contrato).
  const escopo: number[] = configIdx ?? todosConfigs.map((_: any, i: number) => i);
  const customerConfigs = escopo.map((i) => todosConfigs[i]).filter(Boolean);
  /** A posição REAL no formulário de um config deste recorte. */
  const idxReal = (posNoEscopo: number) => escopo[posNoEscopo];

  // Stores the last single customer config before it was removed, so discount can be
  // carried over when the user does a remove-then-add instead of atomic replacement.
  const lastRemovedSingleConfigRef = useRef<any>(null);

  // ═══════════════════════════════════════════════════════════════════════════
  // OS CONTATOS DO CLIENTE — TODOS, e não só o escolhido
  // ═══════════════════════════════════════════════════════════════════════════
  //
  // ESTE CAMPO É SINGULAR DE PROPÓSITO. `BudgetCustomerConfig.responsibleId` é
  // UMA coluna (relação `CUSTOMER_CONFIG_RESPONSIBLE`), e o zod da API declara
  // uma chave só: é o CONTATO DESTA FATURA — quem a NFS-e e o boleto citam e
  // para quem a cobrança é enviada. Duas pessoas não cabem nesse papel.
  //
  // Quem é PLURAL é outra coisa, e é a origem da confusão: `Task.responsibles`
  // (relação `TaskResponsibles`) guarda os responsáveis do ORÇAMENTO, e é dessa
  // lista que saem os signatários — por isso o dossiê assinado traz dois nomes
  // enquanto este quadro mostrava um. Essa lista se edita no assistente de
  // ORÇAMENTO (o editor de linhas de `budget/details/[taskId].tsx`); daqui ela é
  // contexto, não escolha.
  //
  // O DEFEITO era o quadro não exibir NADA além do escolhido: os demais contatos
  // do cliente não apareciam em lugar nenhum da tela, e a lista do combobox
  // vinha do cadastro inteiro sem distinguir quem é deste cliente de quem não é.
  // Quem faturava não tinha como saber que existiam — muito menos trocar.
  const { data: responsiblesData } = useResponsibles({
    isActive: true,
    // O universo de onde as opções saem. Cortar aqui vira "este contato não
    // existe" na hora de escolher, que é um erro silencioso e caro.
    pageSize: 500,
  });
  // A ordem é nossa: `ResponsibleGetManyFormData` não tem `orderBy` (mandá-lo
  // seria erro de tipo), e uma lista de contatos fora de ordem alfabética obriga
  // a varrer o combobox inteiro para achar um nome.
  const allResponsibles = useMemo(
    () =>
      [...(responsiblesData?.data || [])].sort((a: any, b: any) =>
        String(a?.name ?? "").localeCompare(String(b?.name ?? ""), "pt-BR"),
      ),
    [responsiblesData],
  );

  /**
   * OS RESPONSÁVEIS DO ORÇAMENTO — `Task.responsibles`.
   *
   * É a lista de onde saem os SIGNATÁRIOS do documento, e é ela que explica um
   * dossiê com duas assinaturas num quadro que mostrava um nome. Entra aqui como
   * contexto: quem a edita é o assistente de Orçamento.
   */
  const budgetResponsibles: any[] = (task?.responsibles ?? []) as any[];

  /**
   * Os contatos DESTE cliente.
   *
   * Duas origens, unidas: `Responsible.companyId` (o vínculo do cadastro) e os
   * responsáveis do orçamento. A segunda não é redundância — um contato
   * cadastrado sem empresa some da primeira, e era justamente ele que ficava
   * invisível na tela.
   */
  const responsiblesOfCustomer = (customerId?: string | null): any[] => {
    const porVinculo = customerId
      ? allResponsibles.filter((r: any) => r.companyId === customerId)
      : [];
    const vistos = new Set(porVinculo.map((r: any) => r.id));
    const doOrcamento = budgetResponsibles.filter((r: any) => r?.id && !vistos.has(r.id));
    return [...porVinculo, ...doOrcamento].sort((a: any, b: any) =>
      String(a?.name ?? "").localeCompare(String(b?.name ?? ""), "pt-BR"),
    );
  };

  /** Papéis + telefone, que é o que distingue dois contatos do mesmo cliente. */
  const describeResponsible = (r: any): string | undefined => {
    const parts = [
      formatResponsibleRoles(getResponsibleRoles(r)),
      r.phone ? formatBrazilianPhone(r.phone) : "",
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(" · ") : undefined;
  };

  /**
   * As opções: os do cliente PRIMEIRO, os demais depois e rotulados.
   *
   * Os demais continuam escolhíveis — um contato pode ter sido cadastrado sem
   * empresa, e escondê-lo tornaria impossível reproduzir uma escolha antiga (ou
   * conservar a que já está gravada, que ficaria sem rótulo no gatilho).
   */
  const responsibleOptionsFor = (customerId?: string | null) => {
    const doCliente = responsiblesOfCustomer(customerId);
    const idsDoCliente = new Set(doCliente.map((r: any) => r.id));
    return [
      ...doCliente.map((r: any) => ({
        value: r.id,
        label: r.name,
        description: describeResponsible(r),
      })),
      ...allResponsibles
        .filter((r: any) => !idsDoCliente.has(r.id))
        .map((r: any) => ({
          value: r.id,
          label: r.name,
          description: ["Não cadastrado neste cliente", describeResponsible(r)]
            .filter(Boolean)
            .join(" · "),
        })),
    ];
  };

  // Pin the Ibiporã customer first (the highest-volume invoice-to client).
  const PINNED_CUSTOMER_ID = PINNED_CUSTOMERS.IBIPORA;

  const searchCustomers = useCallback(
    async (search?: string, page: number = 1): Promise<{ data: any[]; hasMore: boolean }> => {
      const params: any = {
        orderBy: { fantasyName: "asc" },
        page,
        take: 50,
        include: { logo: true },
      };
      if (search && search.trim()) {
        params.searchingFor = search.trim();
      }
      try {
        const response = await getCustomers(params);
        const customers = response.data || [];
        const hasMore = response.meta?.hasNextPage || false;
        customers.forEach((c: any) => {
          customersCache.current.set(c.id, c);
        });

        // Pin specific customer to the top on first page with no search
        if (page === 1 && !search?.trim()) {
          const pinnedIndex = customers.findIndex((c: any) => c.id === PINNED_CUSTOMER_ID);
          if (pinnedIndex > 0) {
            const [pinned] = customers.splice(pinnedIndex, 1);
            customers.unshift(pinned);
          } else if (pinnedIndex === -1) {
            try {
              const pinnedResponse = await getCustomers({
                where: { id: PINNED_CUSTOMER_ID },
                take: 1,
                include: { logo: true },
              });
              const pinnedCustomer = pinnedResponse.data?.[0];
              if (pinnedCustomer) {
                customersCache.current.set(pinnedCustomer.id, pinnedCustomer);
                customers.unshift(pinnedCustomer);
              }
            } catch { /* ignore */ }
          }
        }

        return { data: customers, hasMore };
      } catch {
        return { data: [], hasMore: false };
      }
    },
    [customersCache],
  );

  const handleCustomerChange = useCallback(
    (value: any) => {
      const selectedIds: string[] = Array.isArray(value) ? value : value ? [value] : [];
      const todas = getValues("customerConfigs") || [];
      // Trocar o pagador DESTA cobrança não pode mexer nas irmãs: elas têm os
      // seus clientes, os seus descontos e as suas faturas. O gesto é local, e a
      // gravação recompõe a lista do orçamento pondo o resultado no lugar dele.
      const currentConfigs = escopo.map((i: number) => todas[i]).filter(Boolean);

      // Mirror the CURRENT single-customer discount on every change — not only on
      // the 1→0 transition. "Faturar Para" is a multi-select, so every click is a
      // toggle and an atomic 1→1 replacement is unreachable from this UI: the real
      // gesture is tick-new-then-untick-old (1→2→1). The previous code nulled this
      // ref the instant the selection reached two, so by the time it collapsed back
      // to one the discount was already gone, and the 1→1 branch could never fire.
      // Writing `null` when the single config has no discount is what makes a
      // deliberate "Nenhum" stick instead of being resurrected on the next collapse.
      if (currentConfigs.length === 1) {
        lastRemovedSingleConfigRef.current = hasNoEffectiveDiscount(currentConfigs[0])
          ? null
          : pickDiscountTerms(currentConfigs[0]);
      }
      const discountCarry = lastRemovedSingleConfigRef.current;

      const newConfigs = selectedIds.map((customerId) => {
        const existing = currentConfigs.find((c: any) => c.customerId === customerId);
        // Re-apply the remembered terms only when collapsing to exactly ONE customer
        // that has no discount of its own. Multi-customer billing keeps its
        // per-customer discounts untouched.
        if (existing) {
          return selectedIds.length === 1 && discountCarry && hasNoEffectiveDiscount(existing)
            ? { ...existing, ...discountCarry }
            : existing;
        }

        const cached = customersCache.current.get(customerId);
        const inherit = selectedIds.length === 1 ? discountCarry : null;
        return {
          customerId,
          subtotal: 0,
          total: 0,
          discountType: inherit?.discountType ?? "NONE",
          discountValue: inherit?.discountValue ?? null,
          discountReference: inherit?.discountReference ?? null,
          paymentCondition: null,
          customPaymentText: null,
          generateInvoice: true,
          generateBankSlip: true,
          responsibleId: null,
          customerData: {
            corporateName: cached?.corporateName || "",
            fantasyName: cached?.fantasyName || "",
            cnpj: cached?.cnpj || "",
            cpf: cached?.cpf || "",
            address: cached?.address || "",
            addressNumber: cached?.addressNumber || "",
            addressComplement: cached?.addressComplement || "",
            neighborhood: cached?.neighborhood || "",
            city: cached?.city || "",
            state: cached?.state || "",
            zipCode: cached?.zipCode || "",
            stateRegistration: cached?.stateRegistration || "",
            municipalRegistration: cached?.municipalRegistration || "",
            // Contato só para a pré-visualização da NFS-e (Fone/Fax e E-Mail do tomador):
            // não é editado aqui nem reenviado no save.
            email: cached?.email || "",
            phones: cached?.phones || [],
            streetType: cached?.streetType || null,
          },
        };
      });

      // As posições deste recorte recebem o resultado, na ordem; o que sobrar
      // entra no fim. Fora do recorte, nada é tocado.
      const restantes = todas.filter((_: any, i: number) => !escopo.includes(i));
      const recomposto = [...restantes, ...newConfigs];
      setValue("customerConfigs", recomposto, { shouldDirty: true });
    },
    [getValues, setValue, customersCache, escopo],
  );

  const selectedCustomerIds = customerConfigs.map((c: any) => c.customerId);

  // The SHARED requirement list. This used to check five fields while the save gate checked nine,
  // so a customer could show "Dados completos" here and still be refused when approving the
  // billing —
  // and the attention rule, which is built from the same list, would blink over a row this badge
  // called fine. `missing` is surfaced in the badge's tooltip so "incompletos" says WHAT.
  const getCustomerValidationStatus = (customerId: string) => {
    const config = customerConfigs.find((c: any) => c.customerId === customerId);
    const missing = missingBillingCustomerLabels(config?.customerData);
    return { valid: missing.length === 0, missing };
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Faturar Para */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <IconUsers className="h-4 w-4 text-muted-foreground" />
            Faturar Para
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Combobox<any>
            mode="multiple"
            placeholder="Selecione os clientes para faturamento"
            emptyText="Nenhum cliente encontrado"
            // Sem os chips padrão: logo abaixo há um card por cliente, com
            // logotipo, CNPJ, o estado do cadastro para a NFS-e e o botão de
            // remover. O chip repetia o nome e dizia menos — dois lugares para a
            // mesma informação, e o de baixo é o que responde "dá para emitir?".
            hideDefaultBadges
            // ⚠️ O GATILHO DIZ O NOME, não "1 selecionado".
            //
            // Sem `renderValue` o modo múltiplo cai na contagem genérica — e num
            // faturamento com UM cliente, que é a esmagadora maioria, o campo
            // informava exatamente nada: "1 selecionado" ao lado de um bloco
            // "Responsável" que mostra o nome da pessoa. O nome está aqui do
            // lado, nos cartões logo abaixo; faltava no lugar onde o olho bate
            // primeiro.
            //
            // O nome sai dos CONFIGS (e do cache), não de `selectedOptions`: numa
            // busca assíncrona o cliente já escolhido pode não estar na página
            // carregada, e o rótulo sairia vazio justamente no caso em que a tela
            // abre com um cliente salvo.
            renderValue={() => {
              if (selectedCustomerIds.length === 0) {
                return <span className="opacity-70">Selecione os clientes para faturamento</span>;
              }
              const nameOf = (c: any) => {
                const cached = customersCache.current.get(c.customerId);
                return (
                  c.customerData?.corporateName ||
                  c.customerData?.fantasyName ||
                  cached?.corporateName ||
                  cached?.fantasyName ||
                  "Cliente"
                );
              };
              const first = nameOf(customerConfigs[0]);
              const rest = selectedCustomerIds.length - 1;
              return <span className="truncate">{rest > 0 ? `${first} +${rest}` : first}</span>;
            }}
            value={selectedCustomerIds}
            onValueChange={handleCustomerChange}
            async={true}
            queryKey={["customers-billing-detail"]}
            queryFn={searchCustomers}
            minSearchLength={0}
            disabled={disabled}
            getOptionValue={(customer: any) => customer.id}
            getOptionLabel={(customer: any) => customer.corporateName || customer.fantasyName}
            renderOption={(customer: any) => (
              <div className="flex items-center gap-3 w-full">
                <CustomerLogoDisplay
                  logo={customer.logo}
                  customerName={customer.fantasyName || customer.corporateName}
                  size="sm"
                  shape="rounded"
                  className="flex-shrink-0"
                />
                <div className="flex flex-col gap-1 min-w-0 flex-1">
                  <div className="font-medium truncate">{customer.corporateName || customer.fantasyName}</div>
                  {customer.cnpj && <div className="text-xs opacity-70">{formatCNPJ(customer.cnpj)}</div>}
                </div>
              </div>
            )}
          />

          {customerConfigs.length > 0 && (
            <div className="space-y-2">
              {customerConfigs.map((config: any) => {
                const cached = customersCache.current.get(config.customerId);
                const name = config.customerData?.corporateName || config.customerData?.fantasyName || cached?.corporateName || cached?.fantasyName || "Cliente";
                const cnpj = config.customerData?.cnpj || cached?.cnpj;
                const validation = getCustomerValidationStatus(config.customerId);

                return (
                  <div key={config.customerId} className="flex items-center gap-3 bg-muted/30 rounded-lg px-4 py-3">
                    <CustomerLogoDisplay
                      logo={cached?.logo}
                      customerName={name}
                      size="sm"
                      shape="rounded"
                      className="flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{name}</div>
                      {cnpj && (
                        <div className="text-xs text-muted-foreground">{formatCNPJ(cnpj)}</div>
                      )}
                    </div>
                    {!validation.valid ? (
                      <Badge
                        variant="destructive"
                        className="flex items-center gap-1 whitespace-nowrap"
                        title={validation.missing.join(", ")}
                      >
                        <IconAlertTriangle className="h-3 w-3" />
                        Dados incompletos
                      </Badge>
                    ) : (
                      <Badge variant="approved" className="whitespace-nowrap">
                        Dados completos
                      </Badge>
                    )}
                    {!disabled && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => {
                          // Route through handleCustomerChange rather than mutating the
                          // array directly: this button used to bypass the discount
                          // carry-over entirely, so removing the old customer here and
                          // then picking a new one silently dropped the agreed discount.
                          handleCustomerChange(
                            customerConfigs
                              .filter((c: any) => c.customerId !== config.customerId)
                              .map((c: any) => c.customerId),
                          );
                        }}
                      >
                        <IconTrash className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Responsável pelo Orçamento */}
      {customerConfigs.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <IconUser className="h-4 w-4 text-muted-foreground" />
              Responsável pelo Orçamento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {customerConfigs.map((config: any, i: number) => {
              const cached = customersCache.current.get(config.customerId);
              const customerName = config.customerData?.corporateName || config.customerData?.fantasyName || cached?.corporateName || cached?.fantasyName || "Cliente";
              const contatosDoCliente = responsiblesOfCustomer(config.customerId);
              // A escolha gravada pode ser um contato INATIVO (fora de
              // `allResponsibles`): procurar nas três origens é o que impede a
              // tela de dizer "nenhum responsável" sobre uma fatura que tem um.
              const selectedResp =
                contatosDoCliente.find((r: any) => r.id === config.responsibleId) ||
                allResponsibles.find((r: any) => r.id === config.responsibleId) ||
                budgetResponsibles.find((r: any) => r?.id === config.responsibleId);
              // O escolhido entra na relação mesmo sem vínculo com o cliente:
              // esconder a escolha gravada seria mentir sobre o que vai na nota.
              const contatosVisiveis =
                selectedResp && !contatosDoCliente.some((r: any) => r.id === selectedResp.id)
                  ? [...contatosDoCliente, selectedResp]
                  : contatosDoCliente;

              return (
                // A chave não pode ser o cliente: num orçamento cobrado veículo
                // a veículo as N faturas são do MESMO cliente, e a chave repetida
                // faz o React reaproveitar o nó da primeira para todas.
                <div key={config.id || `${config.customerId}-${i}`} className="space-y-4">
                  <div className="space-y-2">
                    {customerConfigs.length > 1 && (
                      // Com fatias do mesmo cliente o nome se repete e não
                      // identifica nada: o que desempata é o VEÍCULO coberto.
                      <Label className="text-xs text-muted-foreground">
                        {hasMultipleCustomersOf(customerConfigs)
                          ? customerName
                          : `${customerName} — ${coverageSummary(config, vehicles?.length ?? 0, vehicles as any)}`}
                      </Label>
                    )}
                    <Combobox
                      value={config.responsibleId || ""}
                      onValueChange={(v) =>
                        setValue(`customerConfigs.${idxReal(i)}.responsibleId`, v || null, {
                          shouldDirty: true,
                        })
                      }
                      options={responsibleOptionsFor(config.customerId)}
                      placeholder="Selecione o responsável..."
                      searchPlaceholder="Buscar responsável..."
                      emptyText="Nenhum responsável encontrado"
                      clearable
                      searchable
                      disabled={disabled}
                      className="w-full"
                    />
                    {contatosDoCliente.length > 1 && (
                      <p className="text-xs text-muted-foreground">
                        {contatosDoCliente.length} contatos cadastrados neste cliente. O escolhido é
                        o que a nota, o boleto e a cobrança citam — os signatários do documento são
                        os responsáveis do orçamento, e se editam lá.
                      </p>
                    )}
                  </div>
                  {/* ─── TODOS OS CONTATOS DO CLIENTE, NÃO SÓ O ESCOLHIDO ──────
                      Era um cartão só, o do selecionado. Um cliente com dois
                      contatos — o caso do orçamento que gerou este conserto —
                      aparecia com um, e o outro só existia dentro do combobox
                      fechado. Agora a relação é a do cadastro: o escolhido vem
                      destacado, e os demais trocam com um clique. */}
                  {contatosVisiveis.length > 0 && (
                    <div className="space-y-2">
                      {contatosVisiveis.map((rep: any) => {
                        const isSelected = rep.id === config.responsibleId;
                        const roles = formatResponsibleRoles(getResponsibleRoles(rep));
                        return (
                          <div
                            key={rep.id}
                            className={cn(
                              "flex items-center gap-3 rounded-lg px-4 py-3",
                              isSelected
                                ? "bg-primary/10 ring-1 ring-primary/30"
                                : "bg-muted/30",
                            )}
                          >
                            <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                              <IconUser className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">{rep.name}</div>
                              <div className="text-xs text-muted-foreground truncate">
                                {[roles, rep.phone ? formatBrazilianPhone(rep.phone) : ""]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </div>
                            </div>
                            {isSelected ? (
                              <>
                                <Badge variant="secondary" className="whitespace-nowrap">
                                  Contato desta fatura
                                </Badge>
                                {/* A LIXEIRA QUE FALTAVA. O cartão do cliente, no
                                    quadro ao lado, tem a dele; este não tinha, e os
                                    dois são visualmente o mesmo objeto. Tirar o
                                    responsável exigia abrir o combobox e achar o
                                    "x" — outro alvo, noutro lugar, para a mesma
                                    ação. */}
                                {!disabled && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                    onClick={() =>
                                      setValue(
                                        `customerConfigs.${idxReal(i)}.responsibleId`,
                                        null,
                                        { shouldDirty: true },
                                      )
                                    }
                                  >
                                    <IconTrash className="h-4 w-4" />
                                  </Button>
                                )}
                              </>
                            ) : (
                              !disabled && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="whitespace-nowrap"
                                  onClick={() =>
                                    setValue(
                                      `customerConfigs.${idxReal(i)}.responsibleId`,
                                      rep.id,
                                      { shouldDirty: true },
                                    )
                                  }
                                >
                                  Usar este
                                </Button>
                              )
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
