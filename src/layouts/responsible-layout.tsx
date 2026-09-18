// web/src/layouts/responsible-layout.tsx
//
// A terceira layout do app. `auth-layout` é a moldura das telas de entrada do
// funcionário; `main-layout` é o sistema interno (Header + Sidebar + eixo de
// visibilidade de preço). Nenhuma das duas serve ao portal do cliente:
//
//   • `main-layout` chama `usePricing()`, e aquele contexto lê a preferência do
//     FUNCIONÁRIO logado (`Preferences.pricesVisibleByDefault`). Para um contato
//     de cliente, o preço do próprio orçamento é sempre visível — o eixo inteiro
//     não se aplica.
//   • `Header` e `Sidebar` são navegação interna: setores, produção, estoque, DP.
//     Nada disso existe para quem está de fora.
//
// O que esta layout dá é o mínimo honesto: quem é a pessoa, de que empresa, e
// uma saída.
import { Outlet } from "react-router-dom";
import { IconLogout } from "@tabler/icons-react";
import { useResponsibleAuth } from "@/contexts/responsible-auth-context";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Button } from "@/components/ui/button";

export const ResponsibleLayout = () => {
  const { responsible, logout } = useResponsibleAuth();

  return (
    <div className="min-h-full w-full bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{responsible?.name}</p>
            {responsible?.companyName && (
              <p className="truncate text-xs text-muted-foreground">{responsible.companyName}</p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void logout()}
              aria-label="Sair"
            >
              <IconLogout className="h-4 w-4" />
              <span className="ml-2 hidden sm:inline">Sair</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
};
