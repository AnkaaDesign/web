// web/src/contexts/responsible-auth-context.tsx
//
// A sessão do PORTAL DO CLIENTE.
//
// É irmão de `auth-context.tsx`, e deliberadamente NÃO é o mesmo provider. O
// `AuthProvider` carrega um funcionário: `sector.privileges`, `ledSector`,
// `currentContractStatus`, `requirePasswordChange`. Nenhuma dessas perguntas se
// aplica a um contato de cliente, e um provider que tentasse servir aos dois
// acabaria com um `user` cujo tipo depende de quem entrou — a forma mais rápida
// de alguém checar `user.sector.privileges` numa tela do portal e receber
// `undefined`, que em JavaScript costuma virar "pode".
//
// O portal também roda FORA da metade autenticada do `<Routes>` (que abre o
// `AuthProvider` e mais sete providers de funcionário), então nada disto é
// herdado — é montado de propósito.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  responsibleAuthApi,
  getResponsibleToken,
  setResponsibleToken,
  removeResponsibleToken,
  type ResponsibleSessionUser,
} from "@/api-client/responsible-auth";

interface ResponsibleAuthContextValue {
  responsible: ResponsibleSessionUser | null;
  isLoading: boolean;
  /** Passo 1. Devolve o que a tela precisa mostrar ("enviamos para ..."). */
  requestCode: (contact: string) => Promise<{
    challengeId: string;
    destinationMask: string;
    channel: string;
    expiresInMinutes: number;
  }>;
  /** Passo 2. Abre a sessão. */
  enter: (args: { contact: string; challengeId: string; code: string }) => Promise<void>;
  logout: () => Promise<void>;
  /** Tem PELO MENOS UM dos papéis? União, como no servidor. */
  hasRole: (...roles: string[]) => boolean;
}

const ResponsibleAuthContext = createContext<ResponsibleAuthContextValue | null>(null);

export function useResponsibleAuth(): ResponsibleAuthContextValue {
  const ctx = useContext(ResponsibleAuthContext);
  if (!ctx) {
    throw new Error("useResponsibleAuth precisa estar dentro de <ResponsibleAuthProvider>");
  }
  return ctx;
}

export function ResponsibleAuthProvider({ children }: { children: ReactNode }) {
  const [responsible, setResponsible] = useState<ResponsibleSessionUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restaura a sessão no boot. Note que NÃO confiamos no que está guardado: o
  // que vale é o que o servidor responde, porque ele relê a sessão do banco a
  // cada requisição e sabe de revogação e de cadastro desativado.
  useEffect(() => {
    let cancelled = false;

    const restore = async () => {
      if (!getResponsibleToken()) {
        if (!cancelled) setIsLoading(false);
        return;
      }
      try {
        const me = await responsibleAuthApi.me();
        if (cancelled) return;
        setResponsible((previous) =>
          previous
            ? { ...previous, ...me }
            : {
                id: me.id,
                name: me.name,
                roles: me.roles,
                companyId: me.companyId,
                email: null,
                phone: "",
                companyName: null,
              },
        );
      } catch {
        // Só um caminho encerra a sessão: o servidor dizer que ela não vale
        // mais. Falha de rede não desloga — é a lição que o app Flutter custou
        // caro para aprender (ver docs/AUTH_REFRESH_ROLLOUT.md).
        if (!cancelled) {
          removeResponsibleToken();
          setResponsible(null);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void restore();
    return () => {
      cancelled = true;
    };
  }, []);

  const requestCode = useCallback(async (contact: string) => {
    return responsibleAuthApi.requestCode(contact);
  }, []);

  const enter = useCallback(
    async (args: { contact: string; challengeId: string; code: string }) => {
      const result = await responsibleAuthApi.verifyCode(args);
      setResponsibleToken(result.token);
      setResponsible(result.responsible);
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await responsibleAuthApi.logout();
    } catch {
      // Revogar no servidor é o certo, mas não pode prender ninguém na tela:
      // se falhar, ainda assim limpamos o lado do navegador.
    }
    removeResponsibleToken();
    setResponsible(null);
  }, []);

  const hasRole = useCallback(
    (...roles: string[]) => {
      if (!responsible) return false;
      if (roles.length === 0) return true;
      return responsible.roles.some((role) => roles.includes(role));
    },
    [responsible],
  );

  const value = useMemo<ResponsibleAuthContextValue>(
    () => ({ responsible, isLoading, requestCode, enter, logout, hasRole }),
    [responsible, isLoading, requestCode, enter, logout, hasRole],
  );

  return (
    <ResponsibleAuthContext.Provider value={value}>{children}</ResponsibleAuthContext.Provider>
  );
}
