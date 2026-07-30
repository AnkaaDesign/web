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
 *   • área reservada ao selo (26 mm no PDF ≈ 98 px aqui), vazia no original;
 *   • linha de assinatura (filete escuro) com nome e cargo centralizados abaixo;
 *   • o próprio selo, com as MESMAS nove linhas que `drawSeal` carimba.
 *
 * É o mesmo bloco no orçamento e no dossiê (`pages/public/service-report/[id].tsx`),
 * porque nos dois casos o documento por baixo é o mesmo orçamento.
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
import { IconAlertTriangle, IconCircleCheck, IconClock, IconShieldCheck, IconX } from "@tabler/icons-react";
import { COMPANY_INFO, BRAND_COLORS } from "@/config/company";
import { QuoteChangeList, type QuoteChange } from "@/components/signature/quote-change-list";

interface Summary {
  hasEnvelope: boolean;
  status?: string;
  verificationCode?: string;
  deadlineAt?: string | null;
  completedAt?: string | null;
  sealedAt?: string | null;
  padesLevel?: string | null;
  invalidatedReason?: string | null;
  /** O que mudou no orçamento desde que este documento foi congelado. */
  changes?: QuoteChange[];
  /**
   * Um signatário, com EXATAMENTE os campos que o selo do PDF imprime — ver
   * `drawSeal` em `api/.../document/quote-assembler.service.ts`. O resumo
   * público os devolve mascarados, e só para quem de fato assinou.
   */
  signers?: Array<{
    name: string;
    cargo: string | null;
    companyLabel: string | null;
    cpfMasked: string | null;
    phoneMasked: string | null;
    authMethodLabel: string | null;
    ipAddress: string | null;
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
  /** Conteúdo do selo — as mesmas linhas, na mesma ordem, que `drawSeal` desenha. */
  seal: SealLines;
}

/** Linhas do selo, na ordem em que `drawSeal` as empilha dentro da moldura. */
interface SealLines {
  cargo: string | null;
  companyLabel: string | null;
  cpfMasked: string | null;
  phoneMasked: string | null;
  authMethodLabel: string | null;
  ipAddress: string | null;
}

const EMPTY_SEAL: SealLines = {
  cargo: null,
  companyLabel: null,
  cpfMasked: null,
  phoneMasked: null,
  authMethodLabel: null,
  ipAddress: null,
};

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
  const invalidated = data?.status === "INVALIDATED";
  const signers = hasEnvelope ? data?.signers ?? [] : [];
  const changes = hasEnvelope ? data?.changes ?? [] : [];

  // O SUBTÍTULO sob a linha é o do documento, não o da tela: no PDF o lado
  // CUSTOMER recebe a razão social pura e o lado ANKAA recebe
  // "Diretor Comercial — Ankaa Design" (ver `signerSeeds` e
  // `renderUnsignedQuoteDocument` na API). Antes daqui saía
  // "Gestor de Frota · TRANSPORTES XYZ" de um lado e o cargo informado no ato do
  // outro — dois textos que o documento nunca imprime. O cargo não se perde: ele
  // é linha do SELO, logo acima, exatamente como no PDF.
  const ankaaSubtitle = `${COMPANY_INFO.directorTitle} — ${COMPANY_INFO.name}`;

  // Sem coleta emitida (ou ainda carregando): linhas de assinatura em branco,
  // exatamente como no orçamento impresso. A ordem é a do PDF — os responsáveis
  // do cliente (orderGroup 0) primeiro, a Ankaa (orderGroup 1) por último.
  const boxes: SignatureBox[] = signers.length
    ? signers.map(s => ({
        name: s.name,
        subtitle: s.side === "ANKAA" ? ankaaSubtitle : customerName ?? "",
        state: sealState(s.status),
        signedAt: s.signedAt,
        seal: {
          cargo: s.cargo ?? null,
          companyLabel: s.companyLabel ?? null,
          cpfMasked: s.cpfMasked ?? null,
          phoneMasked: s.phoneMasked ?? null,
          authMethodLabel: s.authMethodLabel ?? null,
          ipAddress: s.ipAddress ?? null,
        },
      }))
    : [
        {
          name: "Responsável — Cliente",
          subtitle: customerName ?? "",
          state: "BLANK",
          signedAt: null,
          seal: EMPTY_SEAL,
        },
        {
          name: COMPANY_INFO.directorName,
          subtitle: ankaaSubtitle,
          state: "BLANK",
          signedAt: null,
          seal: EMPTY_SEAL,
        },
      ];

  // Três colunas a partir de 4 signatários — a MESMA regra do `.signature-grid`
  // do PDF, que passa a `cols-3` quando duas colunas empilhariam três fileiras.
  const cols3 = boxes.length > 3;

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

      {/* O QUE MUDOU — a peça que dava ao cliente o direito de conferir.
          Antes daqui saía uma frase só ("Alteração em: valor total, serviços."),
          e quem tivera a assinatura anulada não tinha como saber qual serviço,
          nem de quanto para quanto. Esconder o detalhe de quem foi desvinculado
          por causa dele é o oposto da boa-fé que sustenta a cerimônia.

          A moldura é discreta de propósito: isto é um aviso dentro de uma folha
          de orçamento, não um alerta de aplicativo. */}
      {changes.length > 0 && (
        <div className="mb-6 rounded border border-gray-200 bg-white px-4 py-3">
          <div className="flex items-start gap-2">
            <IconAlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900">
                {invalidated
                  ? "O orçamento mudou e as assinaturas foram invalidadas"
                  : "O orçamento mudou depois deste documento"}
              </p>
              <p className="mt-0.5 text-xs" style={{ color: GRAY }}>
                {invalidated
                  ? "Uma nova versão será enviada para sua revisão e assinatura. O documento abaixo continua sendo exatamente o que foi apresentado antes."
                  : "O documento abaixo é o que foi apresentado e assinado; ele não muda. Estas são as diferenças em relação ao orçamento atual."}
              </p>
            </div>
          </div>
          <QuoteChangeList changes={changes} variant="paper" className="mt-3" />
        </div>
      )}

      {/* Sem lista (envelope antigo, ou snapshot que o comparador não entende),
          a frase de resumo ainda é melhor do que silêncio. */}
      {!changes.length && data?.invalidatedReason && (
        <p className="mb-5 text-sm text-gray-700">
          {data.invalidatedReason} Uma nova versão será enviada para revisão.
        </p>
      )}

      {/* flex-wrap + justify-center (não grid): com 3 signatários o terceiro
          fica centralizado em vez de órfão encostado à esquerda — mesma decisão
          tomada no `.signature-grid` do PDF. */}
      <div className="flex flex-wrap justify-center gap-x-8 gap-y-10">
        {boxes.map((box, i) => (
          <div
            key={i}
            className={
              cols3
                ? "w-full sm:w-[calc(50%-1rem)] lg:w-[calc(33.333%-1.34rem)]"
                : "w-full sm:w-[calc(50%-1rem)]"
            }
          >
            {/* Área reservada ao selo: 26 mm no PDF ≈ 98 px aqui (96 dpi). */}
            <div className="mb-2 flex h-[98px] items-stretch justify-center">
              {box.state === "SIGNED" ? (
                <Seal
                  name={box.name}
                  lines={box.seal}
                  signedAt={box.signedAt}
                  code={data?.verificationCode}
                  muted={bad}
                  compact={cols3}
                />
              ) : box.state === "BLANK" ? null : (
                <p
                  className={`self-end pb-1 text-xs italic ${
                    box.state === "REFUSED" ? "text-red-500" : "text-gray-400"
                  }`}
                >
                  {SLOT_LABEL[box.state]}
                </p>
              )}
            </div>
            <div className="border-t border-gray-900 pt-3 text-center">
              <p className={`font-semibold text-gray-900 ${cols3 ? "text-xs" : "text-sm"}`}>
                {box.name}
              </p>
              <p className={cols3 ? "text-[10px] leading-snug" : "text-xs"} style={{ color: GRAY }}>
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
 * Selo visual — o gêmeo na tela do retângulo que o montador carimba no PDF.
 *
 * PARIDADE LINHA A LINHA com `drawSeal`
 * (`api/.../document/quote-assembler.service.ts`), na MESMA ordem:
 *
 *   1. ASSINADO ELETRONICAMENTE   (negrito, versalete)
 *   2. Nome do signatário          (negrito)
 *   3. Cargo                       (cinza)
 *   4. Empresa                     (cinza)
 *   5. CPF mascarado + telefone mascarado, na mesma linha  (cinza)
 *   6. Data e hora da assinatura   (cinza)
 *   7. Método de autenticação      (cinza)
 *   8. IP                          (cinza)
 *   9. Envelope <código>           (cinza)
 *
 * Antes daqui saíam TRÊS linhas — a chamada, a data e o código — enquanto o PDF
 * que a mesma página oferece para download carimbava nove. Quem conferisse a
 * tela contra o documento via dois selos diferentes para o mesmo ato, e o que
 * sustenta o valor probatório (quem, com qual CPF, por qual canal, de qual IP)
 * só existia no PDF. A repetição de nome e cargo, que antes se justificava
 * evitar "porque a linha de assinatura logo abaixo já os mostra", é justamente o
 * que o selo faz no papel: ele é uma marca aposta AO documento e se descreve
 * inteiro, sem depender do que está impresso embaixo.
 *
 * O selo real corta o que não couber na moldura em vez de vazar (o `cutoff` de
 * `drawSeal`); aqui o equivalente é `overflow-hidden` — nada escapa do
 * retângulo, e as linhas menos importantes são as últimas a entrar.
 */
function Seal({
  name,
  lines,
  signedAt,
  code,
  muted,
  compact,
}: {
  name: string;
  lines: SealLines;
  signedAt: string | null;
  code?: string;
  muted?: boolean;
  /** Grade de 3 colunas: a caixa é ~1/3 mais estreita, como no PDF. */
  compact?: boolean;
}) {
  const ink = muted ? GRAY : DARK;
  // Mesma composição da linha de identidade do selo: CPF e telefone juntos,
  // separados por espaço duplo.
  const identity = [lines.cpfMasked && `CPF ${lines.cpfMasked}`, lines.phoneMasked]
    .filter(Boolean)
    .join("  ");

  const meta = [
    lines.cargo,
    lines.companyLabel,
    identity || null,
    signedAt
      ? new Date(signedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
      : null,
    lines.authMethodLabel,
    lines.ipAddress ? `IP ${lines.ipAddress}` : null,
    code ? `Envelope ${code}` : null,
  ].filter(Boolean) as string[];

  return (
    <div
      /* py-0.5 + entrelinha apertada nas linhas de metadado: as NOVE linhas
         precisam caber nos 26 mm da moldura sem serem cortadas — é o mesmo
         problema que `drawSeal` resolve derivando o `leading` da altura
         disponível, e lá as duas últimas (IP e código do envelope) já sumiram
         em silêncio uma vez por causa de um espaçamento fixo. */
      className="flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-sm border px-1.5 py-0.5 text-center"
      /* Moldura preta e sem fundo, igual ao selo que o `drawSeal` carimba no
         PDF: o carimbo é aposto AO documento e precisa se distinguir do
         impresso, em vez de parecer parte da identidade visual da Ankaa. */
      style={{ borderColor: muted ? "#d1d5db" : DARK }}
    >
      <span
        className={`font-bold uppercase leading-tight tracking-[0.12em] ${
          compact ? "text-[7px]" : "text-[8px]"
        }`}
        style={{ color: ink }}
      >
        Assinado eletronicamente
      </span>
      <span
        className={`w-full truncate font-semibold leading-tight ${
          compact ? "text-[9px]" : "text-[10px]"
        }`}
        style={{ color: ink }}
      >
        {name}
      </span>
      {meta.map((line, i) => (
        <span
          key={i}
          className={`w-full truncate leading-[1.15] ${compact ? "text-[7px]" : "text-[8px]"}`}
          style={{ color: GRAY }}
        >
          {line}
        </span>
      ))}
    </div>
  );
}
