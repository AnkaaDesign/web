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
  /**
   * Existe token guardado, mas o servidor não pôde ser consultado — rede caída,
   * 5xx, 429. NÃO é "a sessão acabou": é "ainda não sabemos".
   *
   * Quem consome isto é o `ResponsibleRoute`, para oferecer "tentar de novo" em
   * vez de mandar para a tela de entrada uma pessoa que provavelmente continua
   * logada. Mandar para o login aqui seria pior do que parece: a tela de entrada
   * pede um código novo, e o código custa uma mensagem, um cooldown de 2 minutos
   * e uma das 5 do teto horário.
   */
  restoreFailed: boolean;
  /** Tenta restaurar de novo. Só faz sentido quando `restoreFailed`. */
  retryRestore: () => void;
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

/**
 * O servidor RECUSOU a sessão? Só isso encerra a sessão do lado do navegador.
 *
 * 401 é "expirada, revogada ou cadastro desativado" — a guarda do portal relê a
 * sessão do banco a cada requisição, então ela sabe. 403 é o portão de papel.
 * Qualquer outra coisa (sem `response` = rede/CORS/timeout, 5xx, 429) é falha
 * NOSSA ou do caminho, e não diz nada sobre a validade da sessão.
 */
function isSessionRejected(error: unknown): boolean {
  const status = (error as { response?: { status?: number } })?.response?.status;
  return status === 401 || status === 403;
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
  const [restoreFailed, setRestoreFailed] = useState(false);
  // Incrementar re-dispara o efeito de restauração. É o gatilho do "tentar de
  // novo" que o `ResponsibleRoute` oferece quando o servidor não respondeu.
  const [restoreAttempt, setRestoreAttempt] = useState(0);

  const retryRestore = useCallback(() => setRestoreAttempt((n) => n + 1), []);

  // Restaura a sessão no boot. Note que NÃO confiamos no que está guardado: o
  // que vale é o que o servidor responde, porque ele relê a sessão do banco a
  // cada requisição e sabe de revogação e de cadastro desativado.
  useEffect(() => {
    let cancelled = false;

    const restore = async () => {
      if (!getResponsibleToken()) {
        if (!cancelled) {
          setRestoreFailed(false);
          setIsLoading(false);
        }
        return;
      }

      if (!cancelled) setIsLoading(true);

      try {
        // `me()` devolve a sessão INTEIRA, com a mesma forma que o login
        // devolve. Antes vinha um recorte e o resto era preenchido com valores
        // inventados aqui — e o nome da empresa sumia do cabeçalho no F5.
        const me = await responsibleAuthApi.me();
        if (cancelled) return;
        setResponsible(me);
        setRestoreFailed(false);
      } catch (error) {
        if (cancelled) return;

        // Só um caminho encerra a sessão: o servidor dizer que ela não vale
        // mais. Falha de rede NÃO desloga — é a lição que o app Flutter custou
        // caro para aprender (ver docs/AUTH_REFRESH_ROLLOUT.md), e aqui ela
        // custaria mais ainda: sem senha para redigitar, voltar para a tela de
        // entrada significa gastar uma mensagem, esperar o cooldown de 2
        // minutos e queimar uma das 5 do teto horário.
        if (isSessionRejected(error)) {
          removeResponsibleToken();
          setResponsible(null);
          setRestoreFailed(false);
        } else {
          // O token FICA. Não sabemos se a sessão vale — e "não sei" não é
          // "não vale".
          setRestoreFailed(true);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void restore();
    return () => {
      cancelled = true;
    };
  }, [restoreAttempt]);

  const requestCode = useCallback(async (contact: string) => {
    return responsibleAuthApi.requestCode(contact);
  }, []);

  const enter = useCallback(
    async (args: { contact: string; challengeId: string; code: string }) => {
      const result = await responsibleAuthApi.verifyCode(args);
      setResponsibleToken(result.token);
      setResponsible(result.responsible);
      // Entrou: a sessão anterior que não pôde ser conferida deixou de importar.
      setRestoreFailed(false);
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
    setRestoreFailed(false);
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
    () => ({
      responsible,
      isLoading,
      restoreFailed,
      retryRestore,
      requestCode,
      enter,
      logout,
      hasRole,
    }),
    [responsible, isLoading, restoreFailed, retryRestore, requestCode, enter, logout, hasRole],
  );

  return (
    <ResponsibleAuthContext.Provider value={value}>{children}</ResponsibleAuthContext.Provider>
  );
}
