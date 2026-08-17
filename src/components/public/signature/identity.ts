/**
 * Regras de identificação da cerimônia pública de assinatura.
 *
 * Espelho, no cliente, do que `api/src/modules/common/signature/utils/identity.ts`
 * faz no servidor. Duplicar as três linhas de máscara aqui evita uma ida à API
 * só para formatar um CPF que a página já tem em memória — e mantém a página
 * pública sem nenhuma dependência do bundle autenticado.
 *
 * A invariante do §5.9 do design vale igual aqui: **mascare a exibição, nunca o
 * registro.** Nada neste arquivo persiste coisa alguma; o CPF completo só existe
 * no corpo do POST que o signatário dispara.
 */

/** Partes conhecidas de um identificador mascarado, como a API as devolve. */
export interface SignatureMaskParts {
  prefix: string;
  hiddenLength: number;
  suffix: string;
}

export function onlyDigits(value: string | number | null | undefined): string {
  return String(value ?? "").replace(/\D+/g, "");
}

/**
 * mod-11. Filtro de digitação — NÃO prova titularidade, e a UI não diz que prova.
 *
 * Aqui ele tem um segundo uso: quando o cadastro já traz as âncoras do CPF
 * (3 primeiros + 2 verificadores), um miolo digitado errado quase sempre quebra
 * o mod-11 do número montado. Isso deixa a página recusar a divergência **antes**
 * de gastar uma requisição — e devolver a mensagem certa, em vez do "CPF
 * inválido." genérico que a API responderia.
 */
export function isCpfWellFormed(value: string): boolean {
  const d = onlyDigits(value);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
}

/**
 * `12345678901` → `***.456.789-**`
 *
 * Oculta os três primeiros dígitos e os dois verificadores. É o formato do
 * PARECER n. 00001/2021/CONJUR-CGU/CGU/AGU (§5.9 do design), e não o
 * `123.***.***-01` de banco e e-commerce. Sem os 11 dígitos, devolve a forma
 * inteiramente oculta — exatamente como `maskCpf` no servidor.
 */
export function maskCpfCgu(value: string | null | undefined): string {
  const d = onlyDigits(value);
  if (d.length !== 11) return "***.***.***-**";
  return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
}

/** Monta o CPF completo a partir das âncoras do cadastro + o miolo digitado. */
export function assembleCpf(parts: SignatureMaskParts, hiddenDigits: string): string {
  return `${onlyDigits(parts.prefix)}${onlyDigits(hiddenDigits)}${onlyDigits(parts.suffix)}`;
}

/**
 * Espelha `emailMaskParts` / `phoneMaskParts` da API — as duas têm a mesma
 * forma, e `domain` vem vazio no telefone.
 *
 * Aqui morava um `buildPhoneConfirm`, que remendava os dígitos digitados para o
 * que a API comparava na época (`phoneDigits.slice(-8, -4)`, sempre quatro,
 * pegando um dígito emprestado do prefixo quando o fixo só escondia três). Essa
 * regra não existe mais: o servidor compara exatamente os `hiddenLength` dígitos
 * do meio (`rest.slice(1, rest.length - 4)`), que é o mesmo número de caixas que
 * a tela desenha. Emprestar um dígito hoje enviaria `3228` onde se espera `228`
 * e travaria todo signatário de telefone fixo — o oposto do que o remendo fazia.
 * O que se digita sobe verbatim.
 */
export interface SignatureEmailMaskParts {
  prefix: string;
  hiddenLength: number;
  suffix: string;
  domain: string;
}

/**
 * Lê o "Aguarde 42s" do cooldown de reenvio devolvido pela API.
 *
 * Existe para o botão poder mostrar a contagem em vez de repetir a mesma recusa
 * a cada toque. O `\d+` é obrigatório: "Aguarde os responsáveis do cliente
 * assinarem" também começa com "Aguarde" e não é cooldown.
 */
export function parseCooldownSeconds(message: string): number | null {
  const m = /aguarde\s+(\d+)\s*s/i.exec(message ?? "");
  if (!m) return null;
  const seconds = Number(m[1]);
  return Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds, 300) : null;
}

/**
 * Mensagem legível de um erro do api-client.
 *
 * O interceptor do axios **rejeita com um `Error` sintético**: a mensagem já vem
 * extraída em `error.message`, e o `response` original só sobrevive em
 * `error.originalError`. Ler apenas `error.response.data.message` — como a página
 * fazia — devolvia `undefined` sempre, e o signatário via o texto genérico de
 * fallback no lugar de "Os dígitos do CPF não conferem com o cadastro".
 */
export function extractApiMessage(error: unknown, fallback: string): string {
  const e = error as
    | {
        message?: unknown;
        response?: { data?: { message?: unknown } };
        originalError?: { response?: { data?: { message?: unknown } } };
      }
    | null
    | undefined;

  const candidates: unknown[] = [
    e?.response?.data?.message,
    e?.originalError?.response?.data?.message,
    e?.message,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
    if (Array.isArray(candidate)) {
      const first = candidate.find(item => typeof item === "string" && item.trim());
      if (typeof first === "string") return first.trim();
    }
  }
  return fallback;
}

/** Código HTTP do erro, tanto na forma sintética do interceptor quanto na crua. */
export function apiStatusCode(error: unknown): number | null {
  const e = error as
    | {
        _statusCode?: unknown;
        response?: { status?: unknown };
        originalError?: { response?: { status?: unknown } };
      }
    | null
    | undefined;
  const raw = e?._statusCode ?? e?.response?.status ?? e?.originalError?.response?.status;
  return typeof raw === "number" && raw > 0 ? raw : null;
}

/**
 * O TOKEN do link venceu — distinto do prazo do envelope.
 *
 * O servidor agora confere `tokenExpiresAt` em TODAS as rotas por token e
 * responde 403 com a data ("Este link de assinatura expirou em 25/08/2026.
 * Solicite um novo link à Ankaa."). É um estado de tela próprio: não adianta
 * tentar de novo nem falar em prazo do orçamento — o que morreu foi este link.
 */
export function isExpiredLinkError(error: unknown, message: string): boolean {
  if (!/link de assinatura expirou/i.test(message ?? "")) return false;
  const status = apiStatusCode(error);
  return status === null || status === 403;
}

/**
 * Erro que torna esta página inútil como está: prazo vencido, coleta cancelada,
 * link já usado, orçamento alterado depois do envio.
 *
 * Nesses casos não adianta manter o formulário aberto — o certo é recarregar o
 * estado público e deixar a página se redesenhar (assinado / recusado / aviso de
 * coleta inativa). Divergência de dígitos e cooldown **não** entram aqui: são
 * corrigíveis ali mesmo, sem perder o que foi digitado.
 */
export function isTerminalSignatureError(error: unknown, message: string): boolean {
  if (apiStatusCode(error) === 403) return true;
  return /não está mais ativa|prazo para assinatura|não está mais válido|já assinou|alterado desde o envio/i.test(
    message ?? "",
  );
}
