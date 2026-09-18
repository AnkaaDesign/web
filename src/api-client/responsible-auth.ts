// web/src/api-client/responsible-auth.ts
//
// O cliente HTTP do PORTAL DO CLIENTE.
//
// É um axios PRÓPRIO, e não o `apiClient` compartilhado, por uma razão que
// custaria caro descobrir depois: o cliente compartilhado tem um interceptor que
// injeta o token do FUNCIONÁRIO (`ankaa_token`) e um interceptor de 401 que,
// ao falhar o refresh, desloga o funcionário. Um contato de cliente navegando
// pelo portal na mesma máquina em que alguém da Ankaa está logado derrubaria a
// sessão do funcionário — e, pior, mandaria o bearer do funcionário para as
// rotas do portal.
//
// Sessões separadas, clientes separados, chaves de armazenamento separadas.
import axios, { type AxiosInstance } from "axios";

export interface ResponsibleSessionUser {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  roles: string[];
  companyId: string | null;
  companyName: string | null;
}

export interface CodeRequestResult {
  challengeId: string;
  /** Para onde o código foi, já mascarado pelo servidor. */
  destinationMask: string;
  channel: "WHATSAPP" | "EMAIL" | "NONE";
  expiresInMinutes: number;
}

export interface ResponsibleSessionResult {
  token: string;
  expiresAt: string;
  responsible: ResponsibleSessionUser;
}

const RESPONSIBLE_TOKEN_KEY = "ankaa_cliente_token";

export const getResponsibleToken = (): string | null => {
  try {
    return localStorage.getItem(RESPONSIBLE_TOKEN_KEY);
  } catch {
    return null;
  }
};

export const setResponsibleToken = (token: string): void => {
  try {
    localStorage.setItem(RESPONSIBLE_TOKEN_KEY, token);
  } catch {
    // Navegador em modo privado / storage bloqueado: a sessão vive só nesta aba.
  }
};

export const removeResponsibleToken = (): void => {
  try {
    localStorage.removeItem(RESPONSIBLE_TOKEN_KEY);
  } catch {
    // ignorado
  }
};

function resolveBaseUrl(): string {
  const injected = (window as unknown as { __ANKAA_API_URL__?: string }).__ANKAA_API_URL__;
  if (injected) return injected;
  const fromEnv = import.meta.env?.VITE_API_URL;
  if (fromEnv) return fromEnv;
  return `http://localhost:${import.meta.env?.VITE_API_PORT ?? 3030}`;
}

const client: AxiosInstance = axios.create({
  baseURL: resolveBaseUrl(),
  headers: { "Content-Type": "application/json" },
});

client.interceptors.request.use((config) => {
  const token = getResponsibleToken();
  if (token) {
    config.headers = config.headers ?? {};
    (config.headers as Record<string, string>).Authorization = `Bearer ${token}`;
  }
  return config;
});

export const responsibleAuthClient = client;

export const responsibleAuthApi = {
  /** Passo 1 — pede o código no canal do cadastro. */
  async requestCode(contact: string): Promise<CodeRequestResult> {
    const { data } = await client.post("/cliente/auth/codigo", { contact });
    return data;
  },

  /** Passo 2 — troca o código por uma sessão. */
  async verifyCode(args: {
    contact: string;
    challengeId: string;
    code: string;
  }): Promise<ResponsibleSessionResult> {
    const { data } = await client.post("/cliente/auth/entrar", args);
    return data;
  },

  /**
   * Quem sou eu. O servidor relê a sessão do banco a cada requisição, então um
   * 401 aqui significa revogada ou cadastro desativado — não "token velho".
   */
  async me(): Promise<Pick<ResponsibleSessionUser, "id" | "name" | "roles" | "companyId">> {
    const { data } = await client.get("/cliente/auth/eu");
    return data;
  },

  async logout(): Promise<void> {
    await client.post("/cliente/auth/sair");
  },
};
