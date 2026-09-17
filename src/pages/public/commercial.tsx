import { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { IconBrandWhatsapp } from "@tabler/icons-react";

import { COMPANY_INFO, whatsappLinkFor } from "@/config/company";

/**
 * Ponte para o WhatsApp do comercial.
 *
 * POR QUE UMA PÁGINA, E NÃO O LINK DIRETO
 *   O botão "Falar com o comercial" do template `orcamento_vencido` precisava
 *   abrir a conversa com o comercial. A Cloud API RECUSA isso no cadastro:
 *
 *     POST /{template_id} → 100 / 2388081
 *     "Direct links to WhatsApp aren't allowed for buttons."
 *
 *   Nenhum tipo de botão da Meta resolve. `PHONE_NUMBER` abre o discador (era o
 *   que estava lá), `QUICK_REPLY` responde na própria conversa (e a resposta
 *   morre no nosso webhook, que só registra em log) e `VOICE_CALL` liga para a
 *   WABA — que é um número da Cloud API, sem aparelho que atenda. O único
 *   caminho até a conversa com OUTRO número é o deep link, e ele só pode sair
 *   de fora do WhatsApp. Daí esta página: a Meta valida a string da URL, que é
 *   do nosso domínio, e quem manda para o `wa.me` somos nós.
 *
 * O DESTINO MORA AQUI, NÃO NO TEMPLATE
 *   É a vantagem de não ter conseguido o link direto: trocar o número do
 *   comercial passa a ser um deploy, e não uma edição de template — que custa
 *   uma nova rodada de aprovação da Meta e é limitada a uma por dia.
 */

/** Só o que cabe num número de orçamento. Ver `budgetNumberFromQuery`. */
const BUDGET_NUMBER_PATTERN = /^[A-Za-z0-9-]{1,20}$/;

/**
 * O número do orçamento que veio na URL, quando veio.
 *
 * O template manda hoje um link SEM parâmetro, e a página funciona assim. O
 * suporte existe porque o botão de URL da Meta aceita uma variável colada no
 * FIM da string (`.../comercial?orcamento={{1}}`): quando quisermos que o
 * comercial já saiba de qual orçamento se trata, é uma edição de template e
 * nada aqui.
 *
 * ⚠️ VALIDADO, e não só escapado. O valor entra no texto que o cliente vai
 * ENVIAR ao comercial; sem a peneira, um link forjado com esta mesma rota faria
 * o aparelho de quem toca redigir a frase que o forjador quisesse.
 */
function budgetNumberFromQuery(raw: string | null): string | null {
  const value = (raw ?? "").trim();
  return BUDGET_NUMBER_PATTERN.test(value) ? value : null;
}

function prefilledMessage(budgetNumber: string | null): string {
  return budgetNumber
    ? `Olá! Gostaria de falar sobre o orçamento nº ${budgetNumber}.`
    : `Olá! Gostaria de falar com o comercial da ${COMPANY_INFO.name}.`;
}

export function CommercialContactPage() {
  const [searchParams] = useSearchParams();
  const budgetNumber = budgetNumberFromQuery(searchParams.get("orcamento"));

  const whatsappUrl = useMemo(() => {
    const base = whatsappLinkFor(COMPANY_INFO.phoneClean);
    return `${base}?text=${encodeURIComponent(prefilledMessage(budgetNumber))}`;
  }, [budgetNumber]);

  useEffect(() => {
    document.title = `Falar com o comercial — ${COMPANY_INFO.name}`;
  }, []);

  useEffect(() => {
    // `replace`, e não `assign`: quem voltar do WhatsApp cai de onde veio, e não
    // nesta página — que o levaria ao WhatsApp de novo, em laço.
    window.location.replace(whatsappUrl);
  }, [whatsappUrl]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6 text-center">
        <IconBrandWhatsapp className="mx-auto h-14 w-14 text-primary" stroke={1.5} />

        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-foreground">Abrindo o WhatsApp…</h1>
          <p className="text-sm text-muted-foreground">
            Você está sendo levado à conversa com {COMPANY_INFO.directorName},{" "}
            {COMPANY_INFO.directorTitle} da {COMPANY_INFO.name}.
          </p>
        </div>

        {/*
          O caminho de quem o redirecionamento não levou: navegador que bloqueia
          o salto, aparelho sem WhatsApp, link aberto no computador. Sem isto a
          página seria uma tela branca dizendo "abrindo" para sempre, e o número
          — que é a informação que a pessoa veio buscar — não estaria em lugar
          nenhum.
        */}
        <div className="space-y-3">
          <a
            href={whatsappUrl}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            <IconBrandWhatsapp className="h-5 w-5" stroke={1.75} />
            Abrir a conversa
          </a>
          <p className="text-xs text-muted-foreground">
            Se nada acontecer, o número é{" "}
            <span className="font-medium text-foreground">{COMPANY_INFO.phone}</span>.
          </p>
        </div>
      </div>
    </div>
  );
}

export default CommercialContactPage;
