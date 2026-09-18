// web/src/components/navigation/responsible-route.tsx
//
// A guarda de rota do portal do cliente. É o análogo de `AutoPrivilegeRoute`,
// com uma diferença de eixo que importa.
//
// O funcionário tem UM privilégio (`Sector.privileges`) e a guarda dele resolve
// o privilégio exigido a partir do PATH, numa tabela central
// (`utils/route-privileges.ts`). O contato de cliente tem uma LISTA de papéis, e
// o portão é declarado na própria rota — porque as páginas do portal são poucas
// e cada uma sabe a que perfil serve, enquanto a tabela central existe para
// cobrir centenas de rotas internas.
//
// ⚠️ NUNCA compare papel de responsável com `SECTOR_PRIVILEGES`. Os dois
// compartilham os literais 'COMMERCIAL' e 'FINANCIAL', e significam coisas
// opostas: um é o comercial DA ANKAA, o outro é o contato comercial DO CLIENTE.
// É por isso que esta guarda lê `useResponsibleAuth()` e nunca `useAuth()`.
import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useResponsibleAuth } from "@/contexts/responsible-auth-context";
import { Button } from "@/components/ui/button";
import { routes } from "@/constants/routes";

interface ResponsibleRouteProps {
  children: ReactNode;
  /**
   * Papéis aceitos. Vazio/omitido = qualquer contato autenticado.
   *
   * Referência de quem vê o quê, herdada da cerimônia de assinatura
   * (`signature/quote-sections.ts` na API) — vale manter coerente, senão a tela
   * mostra o que o PDF assinado pela mesma pessoa esconde:
   *   COMMERCIAL, SELLER, REPRESENTATIVE, COORDINATOR, PURCHASING → tudo
   *   FINANCIAL   → tudo menos a arte (vê preço, prazo, pagamento, garantia)
   *   MARKETING   → só a arte, NÃO vê preço
   *   FLEET_MANAGER, DRIVER → contato operacional do veículo, não vê valor
   */
  roles?: string[];
}

export function ResponsibleRoute({ children, roles }: ResponsibleRouteProps) {
  const { responsible, isLoading, restoreFailed, retryRestore, hasRole } = useResponsibleAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-current border-t-transparent"
          role="status"
          aria-label="Carregando"
        />
      </div>
    );
  }

  // Existe token guardado, mas o servidor não respondeu — rede caída, 5xx, 429.
  // NÃO mandamos para a tela de entrada: "não sei se a sessão vale" não é "a
  // sessão não vale", e aqui o custo do engano é alto. Sem senha para
  // redigitar, voltar ao login significa pedir outro código: uma mensagem, um
  // cooldown de 2 minutos e uma das 5 do teto horário — tudo isso para uma
  // pessoa que, quase sempre, continua logada.
  if (!responsible && restoreFailed) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-lg font-semibold">Não foi possível falar com o servidor</h1>
        <p className="text-sm text-muted-foreground">
          Sua sessão continua guardada neste aparelho. Verifique sua conexão e tente de novo — você
          não precisa pedir um código novo.
        </p>
        <Button onClick={retryRestore}>Tentar de novo</Button>
      </div>
    );
  }

  if (!responsible) {
    // `state.from` para voltar ao destino depois de entrar — quem clicou num
    // link de e-mail espera cair no que o link prometia, não numa home.
    return <Navigate to={routes.customer.portal.login} state={{ from: location }} replace />;
  }

  if (roles?.length && !hasRole(...roles)) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="text-lg font-semibold">Esta área não está disponível para você</h1>
        <p className="text-sm text-muted-foreground">
          Seu perfil de contato não dá acesso a esta informação. Se precisar dela, fale com o
          comercial da Ankaa.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
