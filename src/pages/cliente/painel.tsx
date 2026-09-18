// web/src/pages/cliente/painel.tsx
//
// A home do portal. Deliberadamente mínima: é o ponto de partida sobre o qual as
// páginas específicas por papel serão construídas.
//
// O que ela já faz de útil é mostrar o PAPEL do contato, porque é o papel que
// decide o que ele enxerga — e ver isso na tela evita a pergunta "por que o
// fulano vê preço e eu não?".
import { useResponsibleAuth } from "@/contexts/responsible-auth-context";

/**
 * Rótulos dos papéis. Espelha `RESPONSIBLE_ROLE_LABELS` da API.
 *
 * ⚠️ Está duplicado porque web e API não compartilham pacote — `api/pnpm-workspace.yaml`
 * declara a API como pacote único e o `web/package.json` não tem nenhuma
 * dependência `workspace:`. A duplicação já divergiu em outros lugares desta
 * base (o `budget.ts` do web tem 257 linhas contra 1193 na API), então este
 * mapa precisa ser conferido quando o enum mudar.
 */
const ROLE_LABELS: Record<string, string> = {
  COMMERCIAL: "Comercial",
  SELLER: "Vendedor",
  REPRESENTATIVE: "Representante",
  COORDINATOR: "Coordenador",
  PURCHASING: "Compras",
  MARKETING: "Marketing",
  FINANCIAL: "Financeiro",
  FLEET_MANAGER: "Gestor de Frota",
  DRIVER: "Motorista",
};

export default function ClientePainelPage() {
  const { responsible } = useResponsibleAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Olá, {responsible?.name?.split(" ")[0]}</h1>
        {responsible?.companyName && (
          <p className="text-sm text-muted-foreground">{responsible.companyName}</p>
        )}
      </div>

      {responsible?.roles?.length ? (
        <div className="flex flex-wrap gap-2">
          {responsible.roles.map((role) => (
            <span
              key={role}
              className="rounded-full border px-3 py-1 text-xs text-muted-foreground"
            >
              {ROLE_LABELS[role] ?? role}
            </span>
          ))}
        </div>
      ) : null}

      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
        As páginas desta área serão montadas conforme o perfil de cada contato. A sessão, o portão
        por papel e o layout já estão de pé — falta o conteúdo.
      </div>
    </div>
  );
}
