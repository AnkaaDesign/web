/**
 * Bloco de assinaturas da página pública do orçamento (`/cliente/orcamento/:id`).
 *
 * Substitui o upload de imagem de assinatura que existia antes. Aquele fluxo
 * aceitava um PNG qualquer num endpoint sem token, não registrava QUEM assinou,
 * não capturava IP, hora, consentimento nem hash — e sequer mudava o status do
 * orçamento, apesar de a tela afirmar "O orçamento foi confirmado".
 *
 * Agora esta página é um VISUALIZADOR: quem assina é o signatário, pelo link
 * pessoal que recebe por WhatsApp (`/cliente/assinar/:token`). Aqui se mostra
 * apenas o estado real da coleta.
 *
 * FORMA — este bloco é PAPEL, não widget. Ele reproduz na tela a mesma seção
 * "Assinaturas" que o PDF assinado imprime (`api/.../document/quote-html.builder.ts`
 * e o selo desenhado em `quote-assembler.service.ts`):
 *
 *   • título "Assinaturas" em verde da marca com filete verde embaixo;
 *   • grade de caixas de 50% de largura, centralizada;
 *   • área reservada ao selo (26 mm no PDF ≈ h-24 aqui), vazia no original;
 *   • linha de assinatura (filete escuro) com nome e cargo centralizados abaixo.
 *
 * As caixas cinza arredondadas que existiam aqui antes eram vocabulário de
 * aplicação colado numa folha de orçamento: cor, raio, sombra e escala
 * tipográfica não conversavam com nada em volta. Toda cor viva agora vem de
 * BRAND_COLORS, e as réguas/espaçamentos são os mesmos das outras seções da
 * página (`pages/public/budget/[id].tsx`).
 *
 * Esta página é clara (o app é escuro), então as cores são fixas de propósito.
 */

import { useEffect, useState } from "react";
import { signatureService } from "@/api-client/signature";
import { IconCircleCheck, IconClock, IconShieldCheck, IconX } from "@tabler/icons-react";
import { COMPANY_INFO, BRAND_COLORS } from "@/config/company";

interface Summary {
  hasEnvelope: boolean;
  status?: string;
  verificationCode?: string;
  deadlineAt?: string | null;
  completedAt?: string | null;
  sealedAt?: string | null;
  padesLevel?: string | null;
  invalidatedReason?: string | null;
  signers?: Array<{
    name: string;
    cargo: string | null;
    side: "ANKAA" | "CUSTOMER";
    status: string;
    signedAt: string | null;
  }>;
}

const STATUS_TEXT: Record<string, string> = {
  RUNNING: "Aguardando assinaturas",
  COMPLETED: "Assinado eletronicamente",
  REFUSED: "Assinatura recusada",
  EXPIRED: "Prazo de assinatura expirado",
  CANCELLED: "Coleta cancelada",
  INVALIDATED: "Orçamento alterado — assinaturas invalidadas",
  SUPERSEDED: "Substituído por uma versão mais recente",
  DRAFT: "Rascunho",
};

const GREEN = BRAND_COLORS.primaryGreen;
const GRAY = BRAND_COLORS.textGray;
/** Mesmo preto do selo carimbado no PDF (`DARK` em quote-assembler.service.ts). */
const DARK = "#1a1a1a";

/** Estado da área reservada ao selo, acima da linha de assinatura. */
type SealState = "SIGNED" | "REFUSED" | "VOIDED" | "VIEWED" | "PENDING" | "BLANK";

/** O que se escreve no lugar do selo quando ele ainda não existe. */
const SLOT_LABEL: Partial<Record<SealState, string>> = {
  REFUSED: "Assinatura recusada",
  VOIDED: "Assinatura anulada",
  VIEWED: "Documento visualizado",
  PENDING: "Aguardando assinatura",
};

function sealState(status: string): SealState {
  switch (status) {
    case "SIGNED":
    case "REFUSED":
    case "VOIDED":
    case "VIEWED":
      return status;
    default:
      return "PENDING";
  }
}

interface SignatureBox {
  name: string;
  subtitle: string;
  state: SealState;
  signedAt: string | null;
}

export function BudgetSignaturePanel({
  quoteId,
  customerName,
  onEnvelope,
}: {
  quoteId: string;
  /**
   * Reporta o resumo à página, que é quem tem o menu ⋮. Sem isto o código de
   * verificação ficaria preso aqui dentro e o item de menu não teria para onde
   * apontar.
   */
  onEnvelope?: (summary: { verificationCode?: string; status?: string }) => void;
  /**
   * Razão social do cliente, só para o cargo impresso sob a linha bater com o
   * que o PDF imprime (lá o subtítulo do signatário do lado CLIENTE é o nome da
   * empresa). O resumo público não devolve esse campo — a página do orçamento
   * já o tem em mãos.
   */
  customerName?: string;
}) {
  const [data, setData] = useState<Summary | null>(null);

  useEffect(() => {
    let alive = true;
    signatureService
      .getQuoteSummary(quoteId)
      .then((res: any) => {
        if (!alive) return;
        const summary = res?.data?.data ?? res?.data ?? null;
        setData(summary);
        if (summary?.hasEnvelope) onEnvelope?.(summary);
      })
      .catch(() => alive && setData({ hasEnvelope: false }));
    return () => {
      alive = false;
    };
  }, [quoteId, onEnvelope]);

  const hasEnvelope = !!data?.hasEnvelope;
  const completed = data?.status === "COMPLETED";
  const bad = ["REFUSED", "EXPIRED", "CANCELLED", "INVALIDATED"].includes(data?.status ?? "");
  const signers = hasEnvelope ? data?.signers ?? [] : [];

  // Sem coleta emitida (ou ainda carregando): linhas de assinatura em branco,
  // exatamente como no orçamento impresso.
  const boxes: SignatureBox[] = signers.length
    ? signers.map(s => ({
        name: s.name,
        subtitle:
          s.side === "ANKAA"
            ? `${s.cargo || COMPANY_INFO.directorTitle} — ${COMPANY_INFO.name}`
            : [s.cargo, customerName].filter(Boolean).join(" · ") || "Cliente",
        state: sealState(s.status),
        signedAt: s.signedAt,
      }))
    : [
        {
          name: COMPANY_INFO.directorName,
          subtitle: `${COMPANY_INFO.directorTitle} — ${COMPANY_INFO.name}`,
          state: "BLANK",
          signedAt: null,
        },
        {
          name: "Responsável — Cliente",
          subtitle: customerName ?? "",
          state: "BLANK",
          signedAt: null,
        },
      ];

  return (
    <section className="mt-10 mb-8">
      {/* Mesmo tratamento do título de assinaturas no PDF: verde da marca,
          filete verde embaixo, alinhado à esquerda como as demais seções. */}
      {/* Sem régua sob o título, como no PDF: a única divisória da folha é a
          do cabeçalho (e a do rodapé, que a espelha). */}
      <h3 className="mb-5 text-lg font-bold" style={{ color: GREEN }}>
        Assinaturas
      </h3>

      {hasEnvelope && (
        <div className="mb-5 flex flex-wrap items-center gap-x-2 gap-y-1">
          {completed ? (
            <IconCircleCheck className="h-4 w-4 shrink-0" style={{ color: GREEN }} />
          ) : bad ? (
            <IconX className="h-4 w-4 shrink-0 text-red-600" />
          ) : (
            <IconClock className="h-4 w-4 shrink-0 text-gray-400" />
          )}
          <span
            className={`text-sm font-semibold ${bad ? "text-red-700" : "text-gray-900"}`}
            style={completed ? { color: GREEN } : undefined}
          >
            {STATUS_TEXT[data?.status ?? ""] ?? data?.status}
          </span>
          {data?.padesLevel && (
            <span className="flex items-center gap-1 text-xs" style={{ color: GRAY }}>
              <IconShieldCheck className="h-3.5 w-3.5" />
              Selo ICP-Brasil {data.padesLevel}
            </span>
          )}
          {!completed && !bad && data?.deadlineAt && (
            <span className="text-xs" style={{ color: GRAY }}>
              · Prazo até {new Date(data.deadlineAt).toLocaleDateString("pt-BR")}
            </span>
          )}
        </div>
      )}

      {data?.invalidatedReason && (
        <p className="mb-5 text-sm text-gray-700">
          {data.invalidatedReason} Uma nova versão será enviada para revisão.
        </p>
      )}

      {/* flex-wrap + justify-center (não grid): com 3 signatários o terceiro
          fica centralizado em vez de órfão encostado à esquerda — mesma decisão
          tomada no `.signature-grid` do PDF. */}
      <div className="flex flex-wrap justify-center gap-x-8 gap-y-10">
        {boxes.map((box, i) => (
          <div key={i} className="w-full sm:w-[calc(50%-1rem)]">
            {/* Área reservada ao selo: 26 mm no PDF ≈ 96 px aqui. */}
            <div className="mb-2 flex h-24 items-end justify-center">
              {box.state === "SIGNED" ? (
                <Seal signedAt={box.signedAt} code={data?.verificationCode} muted={bad} />
              ) : box.state === "BLANK" ? null : (
                <p
                  className={`pb-1 text-xs italic ${
                    box.state === "REFUSED" ? "text-red-500" : "text-gray-400"
                  }`}
                >
                  {SLOT_LABEL[box.state]}
                </p>
              )}
            </div>
            <div className="border-t border-gray-900 pt-3 text-center">
              <p className="text-sm font-semibold text-gray-900">{box.name}</p>
              <p className="text-xs" style={{ color: GRAY }}>
                {box.subtitle || " "}
              </p>
            </div>
          </div>
        ))}
      </div>

      {hasEnvelope && (
        <div className="mt-8 border-t border-gray-200 pt-3">
          <p className="text-xs leading-relaxed" style={{ color: GRAY }}>
            {/* A citação da MP 2.200-2 só cabe quando as assinaturas VALEM. Numa
                coleta em andamento, recusada ou invalidada, essa frase afirmaria
                exatamente o que não aconteceu. */}
            {completed &&
              "Assinado eletronicamente nos termos da Medida Provisória nº 2.200-2/2001, art. 10, § 2º."}
            {/* O código do envelope NÃO se repete aqui: ele já está impresso no
                rodapé do PDF, e "verificar autenticidade" virou item do menu ⋮. */}
          </p>
          {/* Sem link para o PDF aqui: o acesso ao documento é o de download do
              menu ⋮ da página. Um segundo caminho dentro do papel do orçamento
              duplicava a mesma ação e destoava da tipografia do documento. */}
        </div>
      )}
    </section>
  );
}

/**
 * Selo visual — o gêmeo na tela do retângulo que o montador carimba no PDF
 * (`drawSeal`): moldura verde fina, fundo quase branco esverdeado, chamada em
 * versalete e os metadados da coleta em cinza.
 *
 * Nome e cargo NÃO se repetem aqui: na tela eles já estão logo abaixo, na linha
 * de assinatura. No PDF a repetição existe porque o selo é sobreposto ao papel
 * depois, sem saber o que foi impresso.
 */
function Seal({
  signedAt,
  code,
  muted,
}: {
  signedAt: string | null;
  code?: string;
  muted?: boolean;
}) {
  return (
    <div
      className="flex h-full w-full flex-col items-center justify-center gap-0.5 rounded-sm border px-2 text-center"
      /* Moldura preta e sem fundo, igual ao selo que o `drawSeal` carimba no
         PDF: o carimbo é aposto AO documento e precisa se distinguir do
         impresso, em vez de parecer parte da identidade visual da Ankaa. */
      style={{ borderColor: muted ? "#d1d5db" : DARK }}
    >
      <span
        className="text-[10px] font-bold uppercase leading-tight tracking-[0.12em]"
        style={{ color: muted ? GRAY : DARK }}
      >
        Assinado eletronicamente
      </span>
      {signedAt && (
        <span className="text-[11px] leading-tight" style={{ color: GRAY }}>
          {new Date(signedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
        </span>
      )}
      {code && (
        <span className="font-mono text-[10px] leading-tight" style={{ color: GRAY }}>
          Envelope {code}
        </span>
      )}
    </div>
  );
}
