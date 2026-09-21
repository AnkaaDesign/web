// web/src/pages/cliente/solicitar.tsx
//
// A REQUISIÇÃO DE ORÇAMENTO — a tela-título do portal do responsável.
//
// É aqui que o cliente PEDE, em vez de esperar. O que nasce daqui é
// `Budget{ status: REQUESTED, statusOrder: 1, subtotal: 0, total: 0 }`, SEM
// nenhum `BudgetItem`, com uma `Task` por veículo e UM `BudgetPayer`.
//
// ⛔ NÃO HÁ PREÇO EM NENHUM DOS CINCO PASSOS, e isso é a tese da tela: uma
// requisição não tem valor por construção. Serviço e preço são do comercial.
//
// ── As armadilhas que este arquivo respeita (contrato §5) ───────────────────
//
//  1. Produto cartesiano viola as unicidades → cada veículo é uma tupla
//     explícita, e a faixa de série expande em LINHAS (ver `step-veiculos`).
//  2. Série é TEXTO, nunca número.
//  3. Medidas saem daqui em CENTÍMETROS; quem divide por 100 é o servidor — e
//     elas são UMAS SÓ, da requisição inteira: o passo de veículos guarda
//     `medidas` no topo do formulário e `buildSolicitacaoPayload` copia para
//     cada veículo. Pedir a mesma altura dez vezes, uma por linha, era trabalho
//     inventado e divergência garantida.
//  4. Nada na API é `.strict()` → o construtor do payload OMITE o que é vazio
//     em vez de mandar `""` (ver `buildSolicitacaoPayload`).
//  5. Os arquivos-base viajam no MESMO POST; não há upload prévio no portal.
//
// ⚠️ `allowNavigation()` ANTES do `navigate()` do pós-envio. Sem isso o
// formulário ainda está "sujo" quando a rota muda e o diálogo de alterações não
// salvas rearma em cima de um envio que deu certo.
//
// ⚠️ NENHUM toast de sucesso ou de erro de API sai daqui: o interceptor de
// `api-client/portal.ts` já os emite. O que esta tela toasta é só o que é DELA
// — validação de passo, que o servidor nunca viu.
import { useCallback, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  IconArrowLeft,
  IconArrowRight,
  IconCheck,
  IconFilePlus,
  IconLoader2,
  IconLock,
} from "@tabler/icons-react";

import { routes } from "@/constants/routes";
import { useResponsibleAuth } from "@/contexts/responsible-auth-context";
import { PORTAL_CAPABILITY, hasPortalCapability } from "@/utils/portal-capabilities";
import { usePortalRequestBudget, type PortalReusedCustomer } from "@/api-client/portal";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { useUnsavedChangesGuard } from "@/hooks/common/use-unsaved-changes-guard";

import { PageHeader } from "@/components/ui/page-header";
import { FormSteps, type FormStep } from "@/components/ui/form-steps";
import { UnsavedChangesDialog } from "@/components/ui/unsaved-changes-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import type { FileWithPreview } from "@/components/common/file";

import { SolicitacaoStepCliente } from "@/components/cliente/solicitacao/step-cliente";
import { SolicitacaoStepBriefing } from "@/components/cliente/solicitacao/step-briefing";
import { SolicitacaoStepVeiculos } from "@/components/cliente/solicitacao/step-veiculos";
import { SolicitacaoStepPintura } from "@/components/cliente/solicitacao/step-pintura";
import { SolicitacaoStepRevisao } from "@/components/cliente/solicitacao/step-revisao";
import { ClienteReaproveitadoDialog } from "@/components/cliente/solicitacao/cliente-reaproveitado-dialog";
import type {
  PortalCustomerOption,
  PortalPaintOption,
} from "@/components/cliente/solicitacao/solicitacao-api";
import {
  buildSolicitacaoPayload,
  novoVeiculo,
  solicitacaoSchema,
  type SolicitacaoFormData,
} from "@/components/cliente/solicitacao/solicitacao-schema";

const STEPS: FormStep[] = [
  { id: 1, name: "Cliente", description: "Serviço e faturamento" },
  { id: 2, name: "Briefing", description: "O que você precisa" },
  { id: 3, name: "Veículos", description: "Série, placa e medidas" },
  { id: 4, name: "Pintura", description: "Cor e arquivos" },
  { id: 5, name: "Resumo", description: "Conferência final" },
];

/**
 * Que campos pertencem a cada passo.
 *
 * Serve para DUAS coisas diferentes e é importante não confundi-las: decidir se
 * o passo passa (pela raiz do zod, que enxerga as regras entre campos) e decidir
 * que mensagens PINTAR (pelo `trigger` do react-hook-form, restrito a estes
 * nomes). Pintar tudo mostraria erro em campo que a pessoa ainda não viu.
 */
const STEP_FIELDS: Record<number, Array<keyof SolicitacaoFormData>> = {
  1: ["customerId", "novoCliente", "faturarParaCustomerId"],
  2: ["briefing", "logoName"],
  3: ["veiculos", "medidas"],
  4: ["paintId", "novaTinta"],
  5: ["customerId", "novoCliente", "faturarParaCustomerId", "briefing", "logoName", "veiculos", "medidas", "paintId", "novaTinta"],
};

export const ClientePortalSolicitarPage = () => {
  const navigate = useNavigate();
  const { responsible } = useResponsibleAuth();

  usePageTracker({ title: "Portal - Solicitar orçamento", icon: "file-plus" });

  const podeSolicitar = hasPortalCapability(
    responsible?.roles,
    PORTAL_CAPABILITY.REQUEST_BUDGET,
  );

  const [currentStep, setCurrentStep] = useState(1);
  const [baseFiles, setBaseFiles] = useState<FileWithPreview[]>([]);

  /**
   * O CADASTRO QUE O SERVIDOR REAPROVEITOU, e para onde ir quando a pessoa der
   * ciência dele.
   *
   * ⛔ O DOCUMENTO QUE JÁ EXISTE NÃO É MAIS 400 — o servidor usa o cadastro que
   * já havia. Com isso a pessoa digitou um nome e a requisição nasceu com
   * OUTRO, e navegar direto trocaria o nome do cliente EM SILÊNCIO: ela chegaria
   * no orçamento lendo "Carrellii Implementos Rodoviarios" onde digitou
   * "Carrelli Implementos", ou ligaria para o comercial perguntando por um
   * cliente que não existe. Então a navegação espera o "Ver a requisição".
   *
   * ⚠️ `destino` viaja junto porque o `navigate` acontece DEPOIS: guardar só o
   * reuso obrigaria a recalcular a rota a partir de uma resposta que já saiu de
   * escopo.
   */
  const [reaproveitamento, setReaproveitamento] = useState<{
    reuso: PortalReusedCustomer;
    destino: string;
  } | null>(null);

  // Re-entrância: o clique pode chegar antes de o React re-renderizar o botão
  // desabilitado, e um segundo envio criaria uma segunda requisição inteira.
  const enviandoRef = useRef(false);
  const requisicao = usePortalRequestBudget();
  const isSubmitting = requisicao.isPending;

  /**
   * Nomes já vistos pelos comboboxes, para o Resumo poder escrever "Furgões
   * Ideal" onde o formulário só guarda um UUID. Mesmo papel do `customersCache`
   * do assistente interno de orçamento, e pelo mesmo motivo: não existe rota
   * para resolver um cliente pelo id no portal.
   */
  const customersCache = useRef<Map<string, PortalCustomerOption>>(new Map());
  const paintsCache = useRef<Map<string, PortalPaintOption>>(new Map());

  const handleCustomersSeen = useCallback((options: PortalCustomerOption[]) => {
    for (const option of options) customersCache.current.set(option.id, option);
  }, []);
  const handlePaintsSeen = useCallback((options: PortalPaintOption[]) => {
    for (const option of options) paintsCache.current.set(option.id, option);
  }, []);

  const form = useForm<SolicitacaoFormData>({
    resolver: zodResolver(solicitacaoSchema) as never,
    mode: "onTouched",
    defaultValues: {
      customerId: null,
      novoCliente: null,
      faturarParaCustomerId: "",
      briefing: "",
      logoName: "",
      paintId: null,
      novaTinta: null,
      // UMA linha em branco: é onde a primeira série cabe, e o passo de veículos
      // a reaproveita quando a faixa é expandida.
      veiculos: [novoVeiculo()],
      // ⛔ `null`, e não um implemento padrão. O `ImplementMeasureForm` nasce
      // com 2,00 m × 2,00 m; começar preenchido faria toda requisição sair com
      // uma medida que ninguém tirou. Quem cria os lados é o interruptor
      // "Informar medidas" do passo 3.
      medidas: null,
      // ⛔ `null` e não um valor de partida: "Truck" ou "Sider" escolhidos por
      // omissão entrariam no orçamento como se o cliente os tivesse dito.
      category: null,
      implementType: null,
    },
  });

  const { showDialog, confirmNavigation, cancelNavigation, guardedNavigate, allowNavigation } =
    useUnsavedChangesGuard({
      isDirty: form.formState.isDirty || baseFiles.length > 0,
      isSubmitting,
    });

  /**
   * O passo passa?
   *
   * A decisão vem do zod da RAIZ, e não do `trigger`: as regras que importam
   * aqui são entre campos ("existente OU novo", série repetida entre linhas) e
   * moram no `superRefine` da raiz. O `trigger` vem depois, só para pintar.
   */
  const validateStep = useCallback(
    async (step: number): Promise<boolean> => {
      const campos = STEP_FIELDS[step] ?? [];
      const resultado = solicitacaoSchema.safeParse(form.getValues());
      const falhou = resultado.success
        ? []
        : resultado.error.issues.filter((issue) =>
            campos.includes(issue.path[0] as keyof SolicitacaoFormData),
          );

      if (falhou.length === 0) return true;

      await form.trigger(campos as never, { shouldFocus: true });
      toast.error("Confira os campos", falhou[0]?.message ?? "Há campos a corrigir neste passo.");
      return false;
    },
    [form],
  );

  const nextStep = useCallback(async () => {
    if (await validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, STEPS.length));
    }
  }, [validateStep, currentStep]);

  const prevStep = useCallback(() => setCurrentStep((prev) => Math.max(prev - 1, 1)), []);

  /**
   * Clique no marcador do passo. Voltar é de graça — nada se perde ao revisitar.
   * Avançar roda TODOS os portões entre aqui e o alvo, exatamente como apertar
   * "Próximo" aquele tanto de vezes: a primeira recusa estaciona a pessoa no
   * passo que recusou, que já mostrou o seu próprio motivo.
   */
  const handleStepClick = useCallback(
    async (step: number) => {
      if (step === currentStep) return;
      if (step < currentStep) {
        setCurrentStep(step);
        return;
      }
      const alvo = Math.min(step, STEPS.length);
      for (let s = currentStep; s < alvo; s++) {
        if (!(await validateStep(s))) {
          setCurrentStep(s);
          return;
        }
      }
      setCurrentStep(alvo);
    },
    [currentStep, validateStep],
  );

  const handleSubmit = useCallback(async () => {
    if (enviandoRef.current) return;

    const resultado = solicitacaoSchema.safeParse(form.getValues());
    if (!resultado.success) {
      await form.trigger();
      const primeiro = resultado.error.issues[0];
      toast.error("Requisição incompleta", primeiro?.message ?? "Há campos a corrigir.");
      // Estaciona a pessoa no passo que contém o primeiro problema, em vez de
      // deixá-la no Resumo procurando um campo que o Resumo nem desenha.
      const campo = primeiro?.path?.[0] as keyof SolicitacaoFormData | undefined;
      const passo = Object.entries(STEP_FIELDS).find(
        ([id, campos]) => id !== "5" && campo && campos.includes(campo),
      );
      if (passo) setCurrentStep(Number(passo[0]));
      return;
    }

    enviandoRef.current = true;
    try {
      const payload = buildSolicitacaoPayload(resultado.data);
      // Só blobs de verdade: no portal não há arquivo "já enviado" para reusar,
      // e é `instanceof File` o que o FormData aceita.
      const arquivos = baseFiles.filter((file): file is FileWithPreview => file instanceof File);

      const resposta = await requisicao.mutateAsync({ data: payload, baseFiles: arquivos });

      // ⚠️ ANTES do navigate. Ver o cabeçalho.
      allowNavigation();
      // ⚠️ `budgetId`, e não `id`. `POST /cliente/me/orcamentos` devolve o
      // RECIBO da requisição (`{ budgetId, budgetNumber, requestId, veiculos[] }`),
      // não o orçamento — quem o lê é o `GET` do detalhe. Com `id` o valor era
      // `undefined` e o contato caía na LISTA depois de abrir a requisição, sem
      // nunca ver o que acabou de criar.
      const id = resposta?.data?.budgetId;
      const destino = id
        ? routes.customer.portal.orcamento(id)
        : routes.customer.portal.orcamentos;

      // ⚠️ O toast do interceptor já diz a frase inteira (o servidor a monta em
      // `message`). O diálogo existe porque um toast SOME, e esta é a única
      // chance de a pessoa ver que o nome do cliente não é o que ela digitou.
      const reuso = resposta?.data?.customerReused;
      if (reuso) {
        setReaproveitamento({ reuso, destino });
        return;
      }

      navigate(destino);
    } catch {
      // O toast de erro sai do interceptor de `portal.ts`. Nada foi gravado:
      // a requisição é uma transação só, então não há rascunho a recuperar.
    } finally {
      enviandoRef.current = false;
    }
  }, [form, baseFiles, requisicao, allowNavigation, navigate]);

  const stepErrors = useMemo(() => {
    const erros = form.formState.errors as Record<string, unknown>;
    const mapa: Record<number, boolean> = {};
    for (const [id, campos] of Object.entries(STEP_FIELDS)) {
      if (id === "5") continue;
      mapa[Number(id)] = campos.some((campo) => !!erros[campo as string]);
    }
    return mapa;
  }, [form.formState.errors]);

  if (!podeSolicitar) {
    return (
      <EmptyState
        icon={<IconLock className="h-10 w-10" />}
        title="Requisição indisponível para o seu perfil"
        description="Abrir requisições de orçamento é permitido aos contatos de Comercial, Vendedor, Representante, Coordenador e Marketing. Fale com quem administra o seu cadastro se precisar deste acesso."
        action={
          <Button variant="outline" onClick={() => navigate(routes.customer.portal.root)}>
            <IconArrowLeft className="mr-2 h-4 w-4" />
            Voltar ao início
          </Button>
        }
      />
    );
  }

  const isLastStep = currentStep === STEPS.length;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        variant="form"
        title="Solicitar orçamento"
        // ⚠️ ERA O ÚNICO CABEÇALHO DO PORTAL SEM ÍCONE — as outras oito telas
        // têm. E é o MESMO `IconFilePlus` do botão que traz o contato até aqui,
        // no Início: o ícone é a continuidade entre o convite e a tela.
        icon={IconFilePlus}
        breadcrumbs={[
          { label: "Início", href: routes.customer.portal.root },
          { label: "Orçamentos", href: routes.customer.portal.orcamentos },
          { label: "Solicitar" },
        ]}
        onBreadcrumbNavigate={(path) => guardedNavigate(path)}
        isSubmitting={isSubmitting}
        actions={[
          {
            key: "cancel",
            label: "Cancelar",
            onClick: () => guardedNavigate(routes.customer.portal.root),
            variant: "outline" as const,
            disabled: isSubmitting,
          },
          ...(currentStep > 1
            ? [
                {
                  key: "prev",
                  label: "Anterior",
                  onClick: prevStep,
                  variant: "outline" as const,
                  icon: IconArrowLeft,
                  disabled: isSubmitting,
                },
              ]
            : []),
          isLastStep
            ? {
                key: "submit",
                label: isSubmitting ? "Enviando..." : "Enviar requisição",
                onClick: () => void handleSubmit(),
                variant: "default" as const,
                icon: isSubmitting ? IconLoader2 : IconCheck,
                disabled: isSubmitting,
                loading: isSubmitting,
              }
            : {
                key: "next",
                label: "Próximo",
                onClick: () => void nextStep(),
                variant: "default" as const,
                icon: IconArrowRight,
                disabled: isSubmitting,
              },
        ]}
      />

      <FormSteps
        steps={STEPS}
        currentStep={currentStep}
        stepErrors={stepErrors}
        onStepClick={(step) => void handleStepClick(step)}
        disabled={isSubmitting}
      />

      <FormProvider {...form}>
        {/* Os passos 1–4 ficam MONTADOS (escondidos por CSS), e não é economia
            de re-render: o passo de veículos é um `useFieldArray`, e desmontá-lo
            a cada "Próximo" descartaria as linhas que a faixa de série acabou de
            criar. O mesmo vale para o estado local dos diálogos de cadastro. */}
        <div style={{ display: currentStep === 1 ? undefined : "none" }}>
          <SolicitacaoStepCliente disabled={isSubmitting} onCustomersSeen={handleCustomersSeen} />
        </div>

        <div style={{ display: currentStep === 2 ? undefined : "none" }}>
          <SolicitacaoStepBriefing disabled={isSubmitting} />
        </div>

        <div style={{ display: currentStep === 3 ? undefined : "none" }}>
          <SolicitacaoStepVeiculos disabled={isSubmitting} />
        </div>

        <div style={{ display: currentStep === 4 ? undefined : "none" }}>
          <SolicitacaoStepPintura
            disabled={isSubmitting}
            baseFiles={baseFiles}
            onBaseFilesChange={setBaseFiles}
            onPaintsSeen={handlePaintsSeen}
          />
        </div>

        {/* O Resumo é o único que monta sob demanda: ele só LÊ, e montá-lo na
            hora garante que lê o estado atual, não um render antigo. */}
        {isLastStep && (
          <SolicitacaoStepRevisao
            customers={customersCache.current}
            paints={paintsCache.current}
            baseFiles={baseFiles}
          />
        )}
      </FormProvider>

      <UnsavedChangesDialog
        open={showDialog}
        onConfirm={confirmNavigation}
        onCancel={cancelNavigation}
      />

      <ClienteReaproveitadoDialog
        reuso={reaproveitamento?.reuso ?? null}
        onConfirm={() => {
          const destino = reaproveitamento?.destino;
          setReaproveitamento(null);
          if (destino) navigate(destino);
        }}
      />
    </div>
  );
};

export default ClientePortalSolicitarPage;
