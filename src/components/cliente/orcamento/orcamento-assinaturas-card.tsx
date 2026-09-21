// web/src/components/cliente/orcamento/orcamento-assinaturas-card.tsx
//
// AS ASSINATURAS — o que deste orçamento está COMIGO para assinar.
//
// ⚠️ Assinatura não é uma das sete seções, e o portão dela não é `hasSection`:
// é ter recorte NENHUM. `sectionsForRoles` devolve conjunto vazio para o Gestor
// de Frota e o Motorista, e vazio quer dizer literalmente "este contato não
// assina esta coleta" (`withAlwaysSections` preserva o vazio de propósito,
// justamente para sustentar essa leitura). Para eles o card não existe.
//
// ⚠️ A FONTE É `GET /cliente/me/resumo`, E NÃO `/cliente/me/assinaturas`.
// A rota dedicada do §4 ainda NÃO EXISTE no servidor — `portal-read.controller`
// tem seis rotas e nenhuma delas é `assinaturas`. O que existe é
// `resumo.waitingOnMe.signatures.envelopes`, que traz exatamente os envelopes
// parados nesta pessoa, com o recorte que ela assina e o orçamento de cada um.
// Chamar a rota inexistente fazia TODO detalhe de orçamento pintar um toast
// vermelho de "Não encontrado" ao abrir.
//
// O que o card responde continua sendo "falta a MINHA assinatura?" — não o
// roster do documento: ninguém aqui vê quem mais assinou nem quem falta. É a
// pergunta que traz o contato ao portal.
//
// ⛔ O PORTÃO DO PEDIDO DE COMPRA (quem tem `PURCHASING` como ÚNICO papel só
// assina com o número do pedido na mão) mora na tela de Assinaturas: é lá que a
// pessoa pode consertar sem sair do lugar. O resumo não carrega `canSign` —
// então este card leva até lá em vez de prometer um estado que não conhece.
import { Link } from "react-router-dom";
import { IconChevronRight, IconSignature } from "@tabler/icons-react";

import { usePortalSummary } from "@/api-client/portal";
import type { QuoteSection } from "@/api-client/signature";
import { describeSections } from "@/api-client/signature";
import { routes } from "@/constants/routes";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/utils";
import { PortalCard } from "../portal-detail";
import { portalRoleSigns } from "./sections";

/**
 * O estado do signatário, em português. Local e pequeno porque não existe mapa
 * compartilhado para isto — `pages/public/signature/verify.tsx` faz o mesmo, e
 * pela mesma razão. Desconhecido cai no valor cru em vez de sumir.
 */
const SIGNER_STATUS_LABEL: Record<string, string> = {
  PENDING: "Aguardando sua assinatura",
  VIEWED: "Você abriu o documento",
  AUTHENTICATED: "Autenticado — falta assinar",
  SIGNED: "Assinado por você",
  REFUSED: "Recusado por você",
};

export function OrcamentoAssinaturasCard({
  budgetId,
  roles,
}: {
  budgetId: string;
  /**
   * ⛔ OS PAPÉIS, e não a lista de seções que a tela está desenhando.
   *
   * "Esta pessoa assina?" é a RÉGUA DA ASSINATURA (`sectionsForRoles`), em que
   * conjunto vazio significa "não assina" — o padrão do Gestor de Frota e do
   * Motorista. A lista que a TELA usa é outra régua (une o que as capacidades
   * implicam) e NUNCA é vazia para quem tem capacidade alguma: derivar o portão
   * dela faria este card aparecer para quem nunca vai receber envelope.
   */
  roles: readonly string[] | null | undefined;
}) {
  const signs = portalRoleSigns(roles);
  // `enabled` e não um `if` depois do hook: sem recorte não há o que assinar, e
  // a requisição não chega nem a sair. O resumo já está no cache na maioria das
  // visitas (o Início é a primeira tela do portal), então na prática isto não
  // custa uma chamada.
  const { data, isLoading, isError, refetch, isFetching } = usePortalSummary({ enabled: signs });

  if (!signs) return null;

  const pending = (data?.data?.waitingOnMe?.signatures?.envelopes ?? []).filter(
    (envelope) => envelope.budget?.id === budgetId,
  );

  return (
    <PortalCard icon={IconSignature} title="Assinaturas" description="O que deste orçamento está esperando por você.">
      {isLoading ? (
        <Skeleton className="h-16 w-full" />
      ) : isError ? (
        // Sem toast: o interceptor do portal já toastou. O que falta aqui é o
        // caminho de volta, e toast não é caminho de volta.
        <div className="flex flex-col items-start gap-2 py-2">
          <p className="text-sm text-muted-foreground">
            Não foi possível carregar as assinaturas pendentes agora.
          </p>
          <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
            Tentar de novo
          </Button>
        </div>
      ) : pending.length === 0 ? (
        <EmptyState
          className="py-8"
          icon={<IconSignature className="h-8 w-8" />}
          title="Nada esperando sua assinatura"
          description="Quando a Ankaa emitir o documento deste orçamento, ele aparece aqui."
        />
      ) : (
        <ul className="space-y-2">
          {pending.map((envelope) => (
            <li key={envelope.signerId}>
              <Link
                to={routes.customer.portal.assinaturas}
                className="block rounded-lg bg-muted/50 px-4 py-2.5 transition-colors hover:bg-muted"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 space-y-0.5">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {SIGNER_STATUS_LABEL[envelope.signerStatus] ?? envelope.signerStatus}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {describeSections(envelope.sections as QuoteSection[])}
                      {envelope.deadlineAt ? ` · vence em ${formatDate(envelope.deadlineAt)}` : ""}
                    </p>
                  </div>
                  <IconChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PortalCard>
  );
}
