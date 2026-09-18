import { NFSE_ISSUER } from "@/config/company";

/**
 * Prévia fiel, ANTES da emissão, do DANFSe (Documento Auxiliar da NFS-e) que a
 * Prefeitura de Ibiporã / Elotech passou a produzir no **padrão nacional** —
 * layout da Nota Técnica nº 008 SE/CGNFS-e ("Especificações Técnicas do
 * DANFSe"), a mesma que `api/src/modules/integrations/nfse/painter/
 * danfse.layout.ts` implementa em pdfkit para a nota do aerografista.
 *
 * O layout municipal antigo SAIU inteiro: brasão da prefeitura, cabeçalho da
 * Secretaria de Fazenda, campos de RPS, a tabela "ITENS DO SERVIÇO" e a tabela
 * "TRIBUTOS INCIDENTES" não existem no documento nacional. Em lugar deles há
 * uma GRADE CONTÍNUA de quatro colunas de 5,09 cm (20,40 cm de corpo útil), em
 * que a faixa de título de cada bloco ocupa APENAS a primeira coluna e as
 * outras três carregam campos — é o detalhe que mais distingue o DANFSe
 * nacional do DANFS-e municipal.
 *
 * Geometria: a página é A4 (21 cm) e este componente a desenha com 760 px de
 * largura; `cm()` e `pt()` fazem a conversão, de modo que todo número aqui tem
 * origem na NT e não no olho. Blocos sem dado (destinatário, intermediário)
 * aparecem COLAPSADOS com a frase literal da NT, como no documento real.
 *
 * O que a prefeitura só atribui DEPOIS da emissão — chave de acesso, QR Code,
 * número e série da DPS, data e hora de processamento — aparece como "a ser
 * atribuída". Todo valor monetário e todo dado de parte são exatamente os que
 * seguirão no payload da emissão.
 */
export interface NfsePreviewItem {
  descricao: string;
  quantidade: number;
  valor: number;
  desconto: number;
  descontoCondicionado: number;
  valorServico: number;
  valorLiquido: number;
}

export interface NfsePreviewData {
  /** Predicted NFS-e number (last emitted + 1). Undefined → "a ser atribuído". */
  numeroNfse?: string;
  tomador: {
    razao: string;
    cnpjCpf: string;
    isJuridica: boolean;
    inscricaoMunicipal?: string;
    /** Mantido por compatibilidade — o DANFSe nacional não tem este campo. */
    inscricaoEstadual?: string;
    endereco: string;
    municipioUf: string;
    cep: string;
    telefone: string;
    email: string;
    /** Código IBGE do município do tomador, quando conhecido. */
    codigoIbge?: string;
  };
  competencia: string;
  discriminacao: string;
  itens: NfsePreviewItem[];
  totalServicos: number;
  totalDescontos: number;
  totalDeducoes: number;
  baseCalculoIss: number;
  valorIss: number;
  valorLiquido: number;
}

const money = (v: number) =>
  new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);
const brl = (v: number) => `R$ ${money(v)}`;

/** Página A4 desenhada com 760 px de largura. */
const PAGE_WIDTH = 760;
const PX_PER_CM = PAGE_WIDTH / 21;
const cm = (v: number) => v * PX_PER_CM;
/** 1 pt = 1/72 pol = 2,54/72 cm. */
const pt = (v: number) => cm((v * 2.54) / 72);

/** NT 2.4.5: as quatro colunas de 5,09 cm sobre o corpo útil de 20,40 cm. */
const COL = { one: "24.951%", two: "49.902%", three: "74.853%", full: "100%" };

const C = {
  ink: "#000",
  line: "#000",
  /** NT 2.2.3: sombreamento em cinza claro (5% de densidade). */
  shade: "#f2f2f2",
  muted: "#6b7280",
};

/** NT: campo sem conteúdo se imprime com um traço — nunca "R$ 0,00" inventado. */
const DASH = "-";
const PENDING = "a ser atribuída";

const labelStyle: React.CSSProperties = {
  fontSize: pt(6),
  fontWeight: 700,
  lineHeight: 1.15,
  color: C.ink,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};
/** NT: só o bloco de identificação usa rótulo 7 pt em caixa alta. */
const identLabelStyle: React.CSSProperties = { ...labelStyle, fontSize: pt(7) };
const valueStyle: React.CSSProperties = {
  fontSize: pt(7),
  lineHeight: 1.2,
  color: C.ink,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

/**
 * A grade fecha por fora com `borderTop`+`borderLeft` no quadro e
 * `borderBottom`/`borderRight` em cada linha e célula: sem borda dupla nas
 * bordas do papel e sem `border-collapse`.
 */
function Row({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ display: "flex", alignItems: "stretch", borderBottom: `1px solid ${C.line}`, ...style }}>
      {children}
    </div>
  );
}

function Cell({
  label,
  value,
  width = COL.one,
  shaded = false,
  ident = false,
  children,
  style,
}: {
  label?: string;
  value?: React.ReactNode;
  width?: string;
  shaded?: boolean;
  ident?: boolean;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        width,
        boxSizing: "border-box",
        minWidth: 0,
        borderRight: `1px solid ${C.line}`,
        background: shaded ? C.shade : undefined,
        padding: `${cm(0.05)}px ${cm(0.08)}px`,
        minHeight: cm(0.63),
        ...style,
      }}
    >
      {label ? <div style={ident ? identLabelStyle : labelStyle}>{label}</div> : null}
      {children ?? <div style={valueStyle}>{value ?? DASH}</div>}
    </div>
  );
}

/** Faixa de título do bloco — NT 2.4.5: UMA coluna, cinza 5%, 7 pt caixa alta. */
function TitleCell({ children, width = COL.one }: { children: React.ReactNode; width?: string }) {
  return (
    <div
      style={{
        width,
        boxSizing: "border-box",
        borderRight: `1px solid ${C.line}`,
        background: C.shade,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: `0 ${cm(0.08)}px`,
        minHeight: cm(0.63),
        fontSize: pt(7),
        fontWeight: 700,
        lineHeight: 1.1,
      }}
    >
      {children}
    </div>
  );
}

/** Bloco colapsado — NT 2.3.1: faixa de 0,32 cm, sem cinza, frase centralizada. */
function CollapsedRow({ children }: { children: React.ReactNode }) {
  return (
    <Row>
      <div
        style={{
          width: COL.full,
          boxSizing: "border-box",
          borderRight: `1px solid ${C.line}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: cm(0.38),
          fontSize: pt(7),
          fontWeight: 700,
        }}
      >
        {children}
      </div>
    </Row>
  );
}

/** QR falso: o verdadeiro só existe com a chave de acesso, atribuída na emissão. */
function FauxQR({ size }: { size: number }) {
  return (
    <div
      title="QR Code gerado com a chave de acesso, após a emissão"
      style={{
        width: size,
        height: size,
        background: "conic-gradient(#000 25%, #fff 0 50%, #000 0 75%, #fff 0) 0 0 / 8px 8px",
        opacity: 0.18,
        border: "3px solid #000",
        boxSizing: "border-box",
      }}
    />
  );
}

function Watermark() {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
        zIndex: 0,
        overflow: "hidden",
      }}
    >
      <span
        style={{
          transform: "rotate(-22deg)",
          fontSize: 80,
          fontWeight: 800,
          color: "rgba(120,120,140,0.06)",
          whiteSpace: "nowrap",
          letterSpacing: 6,
        }}
      >
        PRÉVIA · NÃO EMITIDA
      </span>
    </div>
  );
}

/** "141201 Funilaria e lanternagem." → { codigo, descricao }. */
function splitItemListaServico(raw: string) {
  const match = /^(\d+)\s*(.*)$/.exec(raw.trim());
  return { codigo: match?.[1] ?? raw.trim(), descricao: (match?.[2] ?? "").trim() };
}

/** "9/2026" → "09/2026"; qualquer outra coisa passa intacta. */
function competenciaLabel(raw: string) {
  const parts = (raw || "").split("/");
  if (parts.length === 2) return `${parts[0].padStart(2, "0")}/${parts[1]}`;
  return raw || DASH;
}

/** "IBIPORA-PR" → "IBIPORA / PR / Brasil", como o DANFSe escreve o local. */
function localLabel(municipioUf: string) {
  const [municipio, uf] = (municipioUf || "").split("-");
  if (!municipio) return DASH;
  return [municipio.trim(), (uf || "").trim(), "Brasil"].filter(Boolean).join(" / ");
}

const pending = <span style={{ color: C.muted }}>{PENDING}</span>;

export function NfsePreview({ data }: { data: NfsePreviewData }) {
  const P = NFSE_ISSUER.prestador;
  const t = data.tomador;
  const servico = splitItemListaServico(NFSE_ISSUER.itemListaServico);
  const descontoCondicionado = data.itens.reduce((sum, i) => sum + (i.descontoCondicionado || 0), 0);
  /** A linha de benefício/dedução é suprimível — só aparece quando há o que mostrar. */
  const showBeneficioRow = data.totalDeducoes > 0 || data.totalDescontos > 0;

  return (
    <div
      style={{
        position: "relative",
        background: "#fff",
        color: C.ink,
        fontFamily: "Arial, Helvetica, sans-serif",
        width: PAGE_WIDTH,
        boxSizing: "border-box",
        padding: cm(0.18),
        border: `1px solid ${C.line}`,
      }}
    >
      <Watermark />
      <div style={{ position: "relative", zIndex: 1, borderTop: `1px solid ${C.line}`, borderLeft: `1px solid ${C.line}` }}>
        {/* ── Cabeçalho (NT 2.4.1) — faixa única, cinza 5% ───────────────── */}
        <Row style={{ background: C.shade }}>
          <div
            style={{
              width: COL.one,
              boxSizing: "border-box",
              borderRight: `1px solid ${C.line}`,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              padding: `0 ${cm(0.19)}px`,
              minHeight: cm(1.16),
            }}
          >
            <div style={{ fontSize: pt(13), fontWeight: 700, letterSpacing: 0.5 }}>NFS-e</div>
            <div style={{ fontSize: pt(5.5), fontWeight: 700, letterSpacing: 1.2 }}>PADRÃO NACIONAL</div>
          </div>
          <div
            style={{
              width: COL.two,
              boxSizing: "border-box",
              borderRight: `1px solid ${C.line}`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              minHeight: cm(1.16),
            }}
          >
            <div style={{ fontSize: pt(9), fontWeight: 700 }}>DANFSe v2.0</div>
            <div style={{ fontSize: pt(9), fontWeight: 700 }}>Documento Auxiliar da NFS-e</div>
          </div>
          <div
            style={{
              width: COL.one,
              boxSizing: "border-box",
              borderRight: `1px solid ${C.line}`,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              padding: `0 ${cm(0.08)}px`,
              minHeight: cm(1.16),
            }}
          >
            <div style={{ fontSize: pt(8), fontWeight: 700 }}>Município: {P.municipioUf.replace("-", " - ")}</div>
            <div style={{ fontSize: pt(6) }}>Ambiente Gerador: 2</div>
            <div style={{ fontSize: pt(6) }}>Tipo de Ambiente: 1</div>
          </div>
        </Row>

        {/* ── Dados da NFS-e (NT 2.4.2) — 3 colunas + QR na quarta ───────── */}
        <Row>
          <div style={{ width: COL.three, boxSizing: "border-box", minWidth: 0 }}>
            <Row>
              <Cell
                ident
                width={COL.full}
                label="CHAVE DE ACESSO DA NFS-e"
                value={pending}
                style={{ minHeight: cm(0.77) }}
              />
            </Row>
            <Row>
              <Cell
                ident
                width="33.334%"
                label="NÚMERO DA NFS-e"
                value={
                  data.numeroNfse ? (
                    <>
                      {data.numeroNfse}{" "}
                      <span style={{ fontSize: pt(6), color: C.muted }}>(previsto)</span>
                    </>
                  ) : (
                    pending
                  )
                }
                style={{ minHeight: cm(0.67) }}
              />
              <Cell ident width="33.333%" label="COMPETÊNCIA DA NFS-e" value={competenciaLabel(data.competencia)} style={{ minHeight: cm(0.67) }} />
              <Cell ident width="33.333%" label="DATA E HORA DA EMISSÃO DA NFS-e" value={pending} style={{ minHeight: cm(0.67) }} />
            </Row>
            <Row>
              <Cell ident width="33.334%" label="NÚMERO DA DPS" value={pending} style={{ minHeight: cm(0.67) }} />
              <Cell ident width="33.333%" label="SÉRIE DA DPS" value={pending} style={{ minHeight: cm(0.67) }} />
              <Cell ident width="33.333%" label="DATA E HORA DA EMISSÃO DA DPS" value={pending} style={{ minHeight: cm(0.67) }} />
            </Row>
            <Row style={{ borderBottom: "none" }}>
              <Cell ident shaded width="33.334%" label="EMITENTE DA NFS-e" value="Prestador" style={{ minHeight: cm(0.67) }} />
              <Cell ident width="33.333%" label="SITUAÇÃO DA NFS-e" value="Prévia — não emitida" style={{ minHeight: cm(0.67) }} />
              <Cell ident width="33.333%" label="FINALIDADE" value={DASH} style={{ minHeight: cm(0.67) }} />
            </Row>
          </div>
          <div
            style={{
              width: COL.one,
              boxSizing: "border-box",
              borderRight: `1px solid ${C.line}`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: cm(0.1),
              padding: cm(0.1),
            }}
          >
            <FauxQR size={cm(1.52)} />
            <div style={{ fontSize: pt(6), textAlign: "center", lineHeight: 1.15, color: C.muted }}>
              A autenticidade desta NFS-e pode ser verificada pela leitura deste código QR ou pela
              consulta da chave de acesso no portal nacional da NFS-e
            </div>
          </div>
        </Row>

        {/* ── Prestador / Fornecedor (NT 2.4.3) ──────────────────────────── */}
        <Row>
          <TitleCell>PRESTADOR / FORNECEDOR</TitleCell>
          <Cell label="CNPJ / CPF / NIF" value={P.cnpj} />
          <Cell label="Indicador Municipal (Inscrição)" value={P.inscricaoMunicipal} />
          <Cell label="Telefone" value={P.telefone} />
        </Row>
        <Row>
          <Cell width={COL.two} label="Nome / Nome Empresarial" value={P.razaoSocial} />
          <Cell label="Município / Sigla UF" value={P.municipioUf.replace("-", " / ")} />
          <Cell label="Código IBGE / CEP" value={`${P.codigoIbge} / ${P.cep}`} />
        </Row>
        <Row>
          <Cell width={COL.two} label="Endereço" value={P.endereco} />
          <Cell width={COL.two} label="E-mail" value={P.email} />
        </Row>
        <Row>
          <Cell label="Simples Nacional na Data de Competência" value={P.simplesNacional} />
          <Cell label="Regime de Apuração Tributária pelo SN" value={DASH} />
          {/* NT: a 4ª linha do prestador só tem dois campos — o resto da faixa
              fica em branco, mas a moldura da página continua fechando. */}
          <Cell width={COL.two} value="" />
        </Row>

        {/* ── Tomador / Adquirente ───────────────────────────────────────── */}
        <Row>
          <TitleCell>TOMADOR / ADQUIRENTE</TitleCell>
          <Cell label="CNPJ / CPF / NIF" value={t.cnpjCpf || DASH} />
          <Cell label="Indicador Municipal (Inscrição)" value={t.inscricaoMunicipal || DASH} />
          <Cell label="Telefone" value={t.telefone || DASH} />
        </Row>
        <Row>
          <Cell width={COL.two} label="Nome / Nome Empresarial" value={t.razao || DASH} />
          <Cell label="Município / Sigla UF" value={(t.municipioUf || "").replace("-", " / ") || DASH} />
          <Cell label="Código IBGE / CEP" value={`${t.codigoIbge || DASH} / ${t.cep || DASH}`} />
        </Row>
        <Row>
          <Cell width={COL.two} label="Endereço" value={t.endereco || DASH} />
          <Cell width={COL.two} label="E-mail" value={t.email || DASH} />
        </Row>

        {/* ── Destinatário e intermediário — colapsados (NT 2.3.1) ───────── */}
        <CollapsedRow>O DESTINATÁRIO É O PRÓPRIO TOMADOR/ADQUIRENTE DA OPERAÇÃO</CollapsedRow>
        <CollapsedRow>INTERMEDIÁRIO DA OPERAÇÃO NÃO IDENTIFICADO NA NFS-e</CollapsedRow>

        {/* ── Serviço prestado ───────────────────────────────────────────── */}
        <Row>
          <TitleCell>SERVIÇO PRESTADO</TitleCell>
          <Cell label="Código de Tributação Nacional / Municipal" value={`${servico.codigo} / ${servico.codigo}`} />
          <Cell label="Código da NBS" value={DASH} />
          <Cell label="Local da Prestação / Sigla UF / País" value={localLabel(NFSE_ISSUER.localPrestacao)} />
        </Row>
        <Row>
          {/* Quadro sem rótulo: a descrição do código de tributação nacional. */}
          <Cell width={COL.full} style={{ minHeight: cm(0.4) }}>
            <div style={valueStyle}>{servico.descricao || DASH}</div>
          </Cell>
        </Row>
        <Row>
          <Cell width={COL.full} label="Descrição do Serviço" style={{ minHeight: cm(1.6) }}>
            <div style={{ ...valueStyle, whiteSpace: "pre-wrap", overflow: "hidden", textOverflow: "clip" }}>
              {data.discriminacao || DASH}
            </div>
          </Cell>
        </Row>

        {/* ── Tributação municipal (ISSQN) ───────────────────────────────── */}
        <Row>
          <TitleCell>TRIBUTAÇÃO MUNICIPAL (ISSQN)</TitleCell>
          <Cell label="Tipo de Tributação do ISSQN" value="Operação tributável" />
          <Cell
            width={COL.two}
            label="Município / Sigla UF / País da Incidência do ISSQN"
            value={localLabel(NFSE_ISSUER.localPrestacao)}
          />
        </Row>
        {showBeneficioRow && (
          <Row>
            <Cell label="Benefício Municipal" value={DASH} />
            <Cell label="Cálculo do BM" value={DASH} />
            <Cell label="Total Deduções/Reduções" value={brl(data.totalDeducoes)} />
            <Cell label="Desconto Incondicionado" value={brl(data.totalDescontos)} />
          </Row>
        )}
        <Row>
          <Cell label="BC ISSQN" value={brl(data.baseCalculoIss)} />
          <Cell label="Alíquota Aplicada" value={`${money(NFSE_ISSUER.issAliquota)} %`} />
          <Cell label="Retenção do ISSQN" value="Não Retido" />
          <Cell label="ISSQN Apurado" value={brl(data.valorIss)} />
        </Row>

        {/* ── Tributação federal ─────────────────────────────────────────── */}
        <Row>
          <TitleCell>TRIBUTAÇÃO FEDERAL (EXCETO CBS)</TitleCell>
          <Cell label="IRRF" value={DASH} />
          <Cell label="Contribuição Previdenciária - Retida" value={DASH} />
          <Cell label="Contribuições Sociais - Retidas" value={DASH} />
        </Row>
        <Row>
          <Cell label="PIS - Débito Apuração Própria" value={DASH} />
          <Cell label="COFINS - Débito Apuração Própria" value={DASH} />
          <Cell width={COL.two} label="Descrição Contrib. Sociais - Retidas" value={DASH} />
        </Row>

        {/* ── Tributação IBS/CBS ─────────────────────────────────────────── */}
        <Row>
          <TitleCell>TRIBUTAÇÃO IBS/CBS</TitleCell>
          <Cell label="CST / cClassTrib" value={DASH} />
          <Cell
            width={COL.two}
            label="Indicador de Operação / Código IBGE Incidência / Município / UF"
            value={DASH}
          />
        </Row>
        <Row>
          <Cell label="Exclusões e Reduções da Base de Cálculo" value={DASH} />
          <Cell label="Base de Cálculo Após Exclusões e Reduções" value={DASH} />
          <Cell label="Red. Alíquota IBS / Red. Alíquota CBS" value={DASH} />
          <Cell label="Alíquota - IBS UF / IBS Mun" value={DASH} />
        </Row>
        <Row>
          <Cell label="Alíq. Efetiva Municipal - IBS" value={DASH} />
          <Cell label="Valor Apurado Municipal - IBS" value={DASH} />
          <Cell label="Alíq. Efetiva Estadual - IBS" value={DASH} />
          <Cell label="Valor Apurado Estadual - IBS" value={DASH} />
        </Row>
        <Row>
          <Cell label="Valor Total Apurado - IBS" value={DASH} />
          <Cell label="Alíquota - CBS" value={DASH} />
          <Cell label="Alíquota Efetiva - CBS" value={DASH} />
          <Cell label="Valor Total Apurado - CBS" value={DASH} />
        </Row>

        {/* ── Valor total da NFS-e ───────────────────────────────────────── */}
        <Row>
          <TitleCell>VALOR TOTAL DA NFS-e</TitleCell>
          <Cell label="Valor da Operação / Serviço" value={brl(data.totalServicos)} style={{ minHeight: cm(0.67) }} />
          <Cell label="Desconto Incondicionado" value={brl(data.totalDescontos)} style={{ minHeight: cm(0.67) }} />
          <Cell label="Desconto Condicionado" value={brl(descontoCondicionado)} style={{ minHeight: cm(0.67) }} />
        </Row>
        <Row>
          <Cell label="Total das Retenções (ISSQN / Federais)" value={brl(0)} style={{ minHeight: cm(0.67) }} />
          <Cell label="Valor Líquido da NFS-e" value={brl(data.valorLiquido)} style={{ minHeight: cm(0.67) }} />
          <Cell label="Total do IBS/CBS" value={brl(0)} style={{ minHeight: cm(0.67) }} />
          <Cell
            shaded
            label="Valor Líquido da NFS-e + IBS/CBS"
            value={brl(data.valorLiquido)}
            style={{ minHeight: cm(0.67) }}
          />
        </Row>

        {/* ── Informações complementares ─────────────────────────────────── */}
        <Row>
          <div
            style={{
              width: COL.full,
              boxSizing: "border-box",
              borderRight: `1px solid ${C.line}`,
              background: C.shade,
              display: "flex",
              alignItems: "center",
              padding: `0 ${cm(0.08)}px`,
              minHeight: cm(0.39),
              fontSize: pt(7),
              fontWeight: 700,
            }}
          >
            INFORMAÇÕES COMPLEMENTARES
          </div>
        </Row>
        <Row>
          <Cell width={COL.full} style={{ minHeight: cm(1.0) }}>
            <div style={{ ...valueStyle, whiteSpace: "normal" }}>
              Totais aproximados dos Tributos cfe. Lei nº 12.741/2012: Federais: {DASH}; Estaduais:{" "}
              {DASH}; Municipais: {brl(data.valorIss)};
            </div>
          </Cell>
        </Row>

        {/* ── Canhoto (NT 2.4.6) ─────────────────────────────────────────── */}
        <Row style={{ borderTop: `1px dashed ${C.line}`, borderBottom: "none" }}>
          <Cell label="DATA CIENTIFICAÇÃO:" ident value=" " style={{ minHeight: cm(0.67) }} />
          <Cell label="IDENTIFICAÇÃO E ASSINATURA" ident value=" " style={{ minHeight: cm(0.67) }} />
          <Cell
            ident
            width={COL.two}
            label="Nº NFS-e / CHAVE NFS-e"
            value={`${data.numeroNfse ?? PENDING} / ${PENDING}`}
            style={{ minHeight: cm(0.67) }}
          />
        </Row>
      </div>
    </div>
  );
}
