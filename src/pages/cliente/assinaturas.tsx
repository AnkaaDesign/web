// web/src/pages/cliente/assinaturas.tsx
//
// ASSINATURAS — o que espera a assinatura DESTA pessoa, e o ato de assinar.
//
// ── Assinar aqui é assinar SEM CÓDIGO, e isso é uma decisão, não um atalho ──
//
// A cerimônia pública (`/cliente/assinar/:token`) manda um código de uso único
// e o exige no ato: ela precisa, porque o link pessoal pode ter sido
// encaminhado e é o código que prova quem está do outro lado. No portal essa
// prova já aconteceu — a sessão NASCEU de um OTP no login e o servidor a relê do
// banco a cada requisição. Pedir um segundo código seria pedir duas vezes a
// mesma prova, custando uma mensagem, um cooldown de 2 minutos e uma das 5 do
// teto horário para não provar nada de novo.
//
// É por isso que existe `SignatureAuthMethod.RESPONSIBLE_SESSION` — valor
// PRÓPRIO, nunca `INTERNAL_SESSION`: `ceremonyKindOf` é um ternário com quatro
// dependentes, e dar `INTERNAL_SESSION` a signatário-cliente faria os quatro
// virarem comportamento lado-Ankaa em silêncio.
//
// ── A tela é um instrumento, não um painel ──────────────────────────────────
//
// A estrutura vem de `pages/public/signature/[token].tsx`: o documento aparece
// inteiro, as declarações são texto (não quatro caixas mecânicas), o aceite é um
// ato único num diálogo, e o que a trilha registra é o TEOR declarado. O que
// muda é o método de autenticação, e o texto do termo diz qual é.
//
// ⛔ O PORTÃO DO COMPRAS mora no cartão (`components/cliente/assinatura-card`).
import { useEffect, useMemo, useState } from "react";
import { IconSignature } from "@tabler/icons-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  PortalCardSkeleton,
  PortalErrorBanner,
} from "@/components/cliente/portal-detail";
import { routes } from "@/constants/routes";
import { useResponsibleAuth } from "@/contexts/responsible-auth-context";
import {
  portalErrorMessage,
  usePortalPendingSignatures,
  usePortalSign,
} from "@/api-client/portal";
import { RESPONSIBLE_ROLE_LABELS } from "@/constants";
import type { RESPONSIBLE_ROLE } from "@/constants";
import { AssinaturaCard } from "@/components/cliente/assinatura-card";
import { AssinaturaTermoDialog } from "@/components/cliente/assinatura-termo-dialog";

/**
 * ⛔ AQUI NÃO SE LÊ A FROTA. Nem inteira, nem paginada.
 *
 * Esta tela lia `GET /cliente/me/veiculos?take=500` e `GET /cliente/me/pedidos
 * ?take=500` para responder, no navegador, "quais veículos DESTE envelope estão
 * sem número de pedido?" — a pergunta do ⛔ PORTÃO DO COMPRAS. Duas coisas
 * estavam erradas, e a segunda é a que importa:
 *
 *  1. `take: 500` estoura o teto de 100 dos schemas da borda, e a tela abria com
 *     dois toasts vermelhos de "Parâmetros de consulta inválidos".
 *  2. Mesmo funcionando, era a pergunta errada no lugar errado. O envelope SABE
 *     quais veículos cobre; ler a frota do cliente (358 veículos, no caso da
 *     Marquespan) e filtrar por `vehicle.budget.id` é reconstruir no navegador
 *     um vínculo que o servidor tem de primeira mão — e o veredito do portão
 *     nem sequer era do navegador: `pedidoDeCompra` já vinha decidido.
 *
 * `GET /cliente/me/assinaturas` passou a trazer `veiculos[]` por envelope, com
 * série, placa e número do pedido, recortados pela seção `VEHICLE` como todo o
 * resto. Uma requisição, e ela já era feita.
 */

/**
 * Geolocalização é OPCIONAL e a recusa é registrada como fato.
 *
 * Nunca bloqueia a assinatura: exigir GPS destruiria conversão, e a coordenada
 * não é o que sustenta a autoria — a sessão é. Mesma função, mesmos tempos e
 * mesma semântica da cerimônia pública, para que as duas evidências sejam
 * comparáveis.
 */
const collectGeo = (): Promise<{ lat: number; lon: number; accuracy?: number } | null> =>
  new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    const timer = setTimeout(() => resolve(null), 6000);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        clearTimeout(timer);
        resolve({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 },
    );
  });

export function ClientePortalAssinaturasPage() {
  const { responsible } = useResponsibleAuth();
  const roles = useMemo(() => responsible?.roles ?? [], [responsible?.roles]);

  const signatures = usePortalPendingSignatures();
  const sign = usePortalSign();

  const pendentes = useMemo(() => signatures.data?.data ?? [], [signatures.data]);

  /**
   * ACORDEÃO DE EXPANSÃO ÚNICA (§10) — e aqui ele também é economia: cada
   * documento aberto é um PDF inteiro baixado. Abre sozinho quando há UM só
   * envelope, que é o caso comum; com vários, a pessoa escolhe.
   */
  const [expandedSignerId, setExpandedSignerId] = useState<string | null>(null);
  useEffect(() => {
    if (pendentes.length === 1) setExpandedSignerId(pendentes[0].signerId);
  }, [pendentes]);

  /** O envelope cujo termo está aberto. `null` = nenhum diálogo. */
  const [activeSignerId, setActiveSignerId] = useState<string | null>(null);
  const [signError, setSignError] = useState<string | null>(null);

  const ativa = useMemo(
    () => pendentes.find((item) => item.signerId === activeSignerId) ?? null,
    [pendentes, activeSignerId],
  );

  /**
   * O cargo que entra nas declarações que o citam (`{cargo}`).
   *
   * Vem dos PAPÉIS do cadastro, que é de onde o servidor também o tira — e não
   * de um campo digitado. Um cargo que a própria pessoa escolhesse na hora
   * esvaziaria a declaração de poderes, que é a que sustenta o ato (CC art. 118).
   */
  const cargo = useMemo(
    () =>
      roles
        .map((role) => RESPONSIBLE_ROLE_LABELS[role as RESPONSIBLE_ROLE] ?? role)
        .join(", "),
    [roles],
  );

  const handleSign = async (declarations: string[]) => {
    if (!ativa) return;
    setSignError(null);
    try {
      const geo = await collectGeo();
      await sign.mutateAsync({
        signerId: ativa.signerId,
        data: { declarations, clientTimestamp: new Date().toISOString(), geo },
      });
      // Sem toast próprio: o interceptor de `api-client/portal.ts` já anuncia a
      // mensagem que o servidor devolveu, e a mutation invalida o cache — o
      // envelope some da fila sozinho, que é o aviso que de fato importa.
      setActiveSignerId(null);
    } catch (e) {
      // 403 do portão do Compras cai aqui com a frase do servidor. Fica DENTRO
      // do diálogo, ao lado do botão que falhou.
      setSignError(portalErrorMessage(e, "Não foi possível concluir a assinatura."));
    }
  };

  const loading = signatures.isLoading;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Assinaturas"
        icon={IconSignature}
        // ⚠️ MIGALHAS EM TODA TELA DO PORTAL. Eram quatro telas com e cinco
        // sem, e a barra de abas do portal não substitui o caminho: ela diz
        // ONDE se pode ir, e a migalha diz ONDE SE ESTÁ. O Início é a raiz e
        // por isso é a única sem — é ele o primeiro degrau de todas as outras.
        breadcrumbs={[
          { label: "Início", href: routes.customer.portal.root },
          { label: "Assinaturas" },
        ]}
        actions={[
          {
            key: "refresh",
            label: "Atualizar",
            onClick: () => void signatures.refetch(),
            loading: signatures.isFetching,
          },
        ]}
      />

      {/* O interceptor já toastou; o que FICA é isto, com o caminho de volta
          ao lado. Um toast some em 8 segundos.

          ⚠️ SEM O RAMO DE "A ROTA AINDA NÃO EXISTE". Ele existiu enquanto
          `GET /cliente/me/assinaturas` era só contrato, e desenhava um
          `EmptyState` dizendo que a área não estava no ar. A rota está no ar e
          é fixada em `tests/portal-cliente-boot.test.ts`; um 404 aqui hoje só
          poderia ser falha de verdade, e anunciá-la como "ainda não publicada"
          mandaria o contato desistir de um documento que o espera. */}
      {signatures.isError && (
        <PortalErrorBanner
          message={portalErrorMessage(
            signatures.error,
            "Não foi possível carregar suas assinaturas pendentes.",
          )}
          onRetry={() => void signatures.refetch()}
          retrying={signatures.isFetching}
        />
      )}

      {loading ? (
        // ⚠️ O MESMO cinza de Cobranças e do Início — `PortalCardSkeleton`.
        // Eram três cópias do mesmo retângulo, cada uma com a sua largura.
        <PortalCardSkeleton rows={2} />
      ) : pendentes.length === 0 ? (
        // ⚠️ `<Card>` NU. `border border-border` era redundante (o `Card` já
        // tem as duas) e só existia aqui e em Cobranças — as outras quatro
        // telas usam o card pelado, e lado a lado a borda dupla escurecia.
        <Card>
          <CardContent>
            <EmptyState
              title="Nada para assinar"
              description="Quando um orçamento seu for lançado para assinatura, ele aparece aqui — e você também recebe o aviso no seu contato cadastrado."
              icon={<IconSignature className="h-10 w-10" />}
            />
          </CardContent>
        </Card>
      ) : (
        // Cada envelope no SEU cartão contornado (§10) — nunca um rolo contínuo.
        pendentes.map((assinatura) => (
          <AssinaturaCard
            key={assinatura.signerId}
            assinatura={assinatura}
            roles={roles}
            expanded={expandedSignerId === assinatura.signerId}
            onToggleExpanded={() =>
              setExpandedSignerId((current) =>
                current === assinatura.signerId ? null : assinatura.signerId,
              )
            }
            signing={sign.isPending && activeSignerId === assinatura.signerId}
            onSign={() => {
              setSignError(null);
              setActiveSignerId(assinatura.signerId);
            }}
          />
        ))
      )}

      {ativa && (
        <AssinaturaTermoDialog
          open
          onOpenChange={(next) => {
            if (!next) {
              setActiveSignerId(null);
              setSignError(null);
            }
          }}
          assinatura={ativa}
          cargo={cargo}
          busy={sign.isPending}
          error={signError}
          onSign={(declarations) => void handleSign(declarations)}
        />
      )}
    </div>
  );
}

// `App.tsx` carrega as telas do portal por `lazy(() => import(...))`, que exige
// exportação padrão. O nome continua valendo para quem importar direto.
export default ClientePortalAssinaturasPage;
