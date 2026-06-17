import { SICREDI_BENEFICIARIO } from "@/config/company";

/**
 * Faithful pre-registration preview of the Sicredi boleto (ficha de
 * compensação) that will be registered for an installment when billing is
 * approved. Layout transcribed block-for-block from a real Sicredi boleto PDF:
 *
 *   Recibo do Pagador:  [INFORMATIVO box] → [logo | 748-X | "Recibo do Pagador"]
 *                       → grid → Instruções/deduções → Pagador → Beneficiário Final
 *   ── corte ──
 *   Ficha de Compensação: [logo | 748-X | linha digitável] → grid →
 *                       Instruções/deduções → Pagador → barcode + "FICHA DE COMPENSAÇÃO"
 *
 * `nossoNumero`, `linhaDigitavel` and `codigoBarras` are assigned by Sicredi at
 * registration; they show as muted placeholders. `seuNumero` references the
 * NFS-e (NF<nº>) — emitted just before the boleto — so when an invoice is
 * generated it shows the NF linkage. Valor, vencimento, pagador and the
 * informativos are the exact values that will be sent.
 */
export interface BoletoPreviewData {
  pagador: { nome: string; cnpjCpf: string; endereco: string; municipioUf: string; cep: string };
  numero: number;
  totalParcelas: number;
  valor: number;
  vencimento: Date;
  /** Nº do documento (seuNumero) display string. */
  seuNumero: string;
  /** True when seuNumero is the NF<nº> placeholder (número assigned on emission). */
  seuNumeroPending?: boolean;
  dataDocumento?: Date;
  /** Informativo / demonstrativo lines (the API's buildBoletoLines output). */
  informativos: string[];
}

const moneyR = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
const dateBR = (d: Date) => d.toLocaleDateString("pt-BR");

const C = {
  ink: "#111",
  line: "#3a3a3a",
  green: "#3a9e3a",
  greenDark: "#178a3a",
  muted: "#9aa0a6",
};

const lbl: React.CSSProperties = { fontSize: 6.5, color: "#555", lineHeight: 1.1 };
const val: React.CSSProperties = { fontSize: 9.5, color: C.ink, lineHeight: 1.2, fontWeight: 700 };
const placeholder: React.CSSProperties = { color: C.muted, fontWeight: 400 };

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
          transform: "rotate(-18deg)",
          fontSize: 64,
          fontWeight: 800,
          color: "rgba(120,120,140,0.07)",
          whiteSpace: "nowrap",
          letterSpacing: 4,
        }}
      >
        PRÉVIA · NÃO EMITIDO
      </span>
    </div>
  );
}

function SicrediLogo() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <div style={{ position: "relative", width: 18, height: 18 }}>
        {[0, 60, 120, 180, 240, 300].map((deg) => (
          <div
            key={deg}
            style={{
              position: "absolute",
              left: 7,
              top: 1,
              width: 4,
              height: 8,
              background: deg % 120 === 0 ? C.green : C.greenDark,
              borderRadius: "0 0 4px 4px",
              transformOrigin: "2px 8px",
              transform: `rotate(${deg}deg)`,
            }}
          />
        ))}
      </div>
      <span style={{ color: C.greenDark, fontWeight: 800, fontSize: 15, letterSpacing: -0.5 }}>Sicredi</span>
    </div>
  );
}

function Cell({
  label,
  value,
  flex = 1,
  borderLeft = false,
  alignRight = false,
  bold = false,
}: {
  label: string;
  value: React.ReactNode;
  flex?: number;
  borderLeft?: boolean;
  alignRight?: boolean;
  bold?: boolean;
}) {
  return (
    <div
      style={{
        flex,
        padding: "2px 6px",
        borderLeft: borderLeft ? `1px solid ${C.line}` : undefined,
        minWidth: 0,
        textAlign: alignRight ? "right" : "left",
      }}
    >
      <div style={lbl}>{label}</div>
      <div
        style={{
          ...val,
          fontWeight: bold ? 800 : 700,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {value ?? " "}
      </div>
    </div>
  );
}

/** Decorative Interleaved-2of5-style bar pattern — NOT a scannable code. */
function FauxBarcode() {
  const widths = [3, 1, 1, 3, 1, 3, 1, 1, 3, 1, 1, 1, 3, 3, 1, 1, 3, 1, 1, 3, 1, 3, 1, 1, 3, 1, 1, 3, 1, 1, 3, 3, 1, 1, 3, 1, 1, 1, 3, 1, 3, 1, 1, 3, 1, 1, 3, 1, 3, 1, 1, 1, 3, 3, 1, 1, 3, 1, 1, 3, 1, 3];
  return (
    <div title="Código de barras gerado pelo Sicredi após o registro" style={{ display: "flex", alignItems: "flex-end", height: 44, gap: 1 }}>
      {widths.map((w, i) => (
        <div key={i} style={{ width: w, height: 44, background: i % 2 === 0 ? "#111" : "transparent" }} />
      ))}
    </div>
  );
}

const linhaDigitavelPlaceholder = "748XX.XXXXX XXXXX.XXXXXX XXXXX.XXXXXX X XXXXXXXXXXXXXX";

function DeductionsStack() {
  const rows = ["(-) Desconto / Abatimento", "(-) Outras Deduções", "(+) Mora / Multa", "(+) Outros Acréscimos", "(=) Valor Cobrado"];
  return (
    <div style={{ flex: 1.05, borderLeft: `1px solid ${C.line}` }}>
      {rows.map((label, i) => (
        <div key={label} style={{ padding: "2px 6px", borderBottom: i < rows.length - 1 ? `1px solid ${C.line}` : undefined, minHeight: 18 }}>
          <div style={lbl}>{label}</div>
        </div>
      ))}
    </div>
  );
}

function BoletoBlock({ data, variant }: { data: BoletoPreviewData; variant: "recibo" | "ficha" }) {
  const B = SICREDI_BENEFICIARIO;
  const dataDoc = data.dataDocumento ?? new Date();
  const isRecibo = variant === "recibo";
  const info = data.informativos.length > 0 ? data.informativos : ["—"];

  return (
    <div style={{ border: `1px solid ${C.line}`, position: "relative" }}>
      <Watermark />
      <div style={{ position: "relative", zIndex: 1 }}>
        {/* INFORMATIVO box — recibo only */}
        {isRecibo && (
          <div style={{ borderBottom: `1px solid ${C.line}` }}>
            <div style={{ textAlign: "center", fontSize: 8.5, padding: "2px 0", borderBottom: `1px solid ${C.line}` }}>INFORMATIVO</div>
            <div style={{ padding: "4px 6px", minHeight: 54, fontSize: 8, lineHeight: 1.4 }}>
              {info.map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </div>
          </div>
        )}

        {/* Header: logo | 748-X | (linha digitável | "Recibo do Pagador") */}
        <div style={{ display: "flex", alignItems: "center", borderBottom: `2px solid ${C.line}` }}>
          <div style={{ padding: "3px 10px", borderRight: `1px solid ${C.line}` }}>
            <SicrediLogo />
          </div>
          <div style={{ padding: "3px 12px", borderRight: `1px solid ${C.line}`, fontWeight: 800, fontSize: 16 }}>{B.bancoCodigo}</div>
          {isRecibo ? (
            <div style={{ flex: 1, padding: "3px 10px", textAlign: "right", fontWeight: 800, fontSize: 13 }}>Recibo do Pagador</div>
          ) : (
            <div style={{ flex: 1, padding: "3px 10px", textAlign: "right", fontFamily: "monospace", fontWeight: 700, fontSize: 12, ...placeholder }}>
              {linhaDigitavelPlaceholder}
            </div>
          )}
        </div>

        {/* Local de Pagamento | Vencimento */}
        <div style={{ display: "flex", borderBottom: `1px solid ${C.line}` }}>
          <Cell label="Local de Pagamento" value={B.localPagamento} flex={3.2} />
          <Cell label="Vencimento" value={<span style={{ fontWeight: 800 }}>{dateBR(data.vencimento)}</span>} flex={1} borderLeft alignRight />
        </div>

        {/* Beneficiário | CNPJ/CPF | Agência/Código */}
        <div style={{ display: "flex", borderBottom: `1px solid ${C.line}` }}>
          <Cell label="Beneficiário" value={B.nome} flex={2.2} />
          <Cell label="CNPJ/CPF" value={B.cnpj} flex={1} borderLeft />
          <Cell label="Agência / Código do Beneficiário" value={B.agenciaCodigo} flex={1.1} borderLeft alignRight />
        </div>

        {/* Data Doc | Nº Doc | Espécie Doc | Aceite | Data Process | Nosso Número */}
        <div style={{ display: "flex", borderBottom: `1px solid ${C.line}` }}>
          <Cell label="Data do Documento" value={dateBR(dataDoc)} flex={1} />
          <Cell label="Nº do Documento" value={data.seuNumeroPending ? <span style={placeholder}>{data.seuNumero}</span> : data.seuNumero} flex={1.2} borderLeft />
          <Cell label="Espécie Doc." value={B.especieDoc} flex={0.7} borderLeft />
          <Cell label="Aceite" value="N" flex={0.5} borderLeft />
          <Cell label="Data de Processamento" value={dateBR(dataDoc)} flex={1} borderLeft />
          <Cell label="Nosso Número / Cód. do Documento" value={<span style={placeholder}>a registrar</span>} flex={1.4} borderLeft alignRight />
        </div>

        {/* Espécie Moeda | Quantidade Moeda | Valor Moeda | (=) Valor do Documento */}
        <div style={{ display: "flex", borderBottom: `1px solid ${C.line}` }}>
          <Cell label="Espécie Moeda" value={B.especieMoeda} flex={1} />
          <Cell label="Quantidade Moeda" value="" flex={1.2} borderLeft />
          <Cell label="Valor Moeda" value="" flex={1.2} borderLeft />
          <Cell label="(=) Valor do Documento" value={<span style={{ fontWeight: 800 }}>{moneyR(data.valor)}</span>} flex={1.4} borderLeft alignRight />
        </div>

        {/* Instruções (left) | deductions stack (right) */}
        <div style={{ display: "flex", borderBottom: `1px solid ${C.line}` }}>
          <div style={{ flex: 3.2, padding: "3px 6px", minHeight: isRecibo ? 40 : 78 }}>
            <div style={lbl}>Instruções (texto de responsabilidade do beneficiário)</div>
            {!isRecibo && (
              <div style={{ fontSize: 8, marginTop: 2, lineHeight: 1.4 }}>
                {info.map((line, i) => (
                  <div key={i}>{line}</div>
                ))}
              </div>
            )}
          </div>
          <DeductionsStack />
        </div>

        {/* Pagador */}
        <div style={{ padding: "3px 6px", borderBottom: `1px solid ${C.line}` }}>
          <div style={lbl}>Pagador</div>
          <div style={val}>{data.pagador.nome} - {data.pagador.cnpjCpf}</div>
          <div style={{ fontSize: 8, color: "#333", fontWeight: 600 }}>{data.pagador.endereco}</div>
          <div style={{ fontSize: 8, color: "#333", fontWeight: 600 }}>{[data.pagador.municipioUf, data.pagador.cep].filter(Boolean).join("  ")}</div>
        </div>

        {/* Beneficiário Final | Código de Baixa */}
        <div style={{ display: "flex", ...(isRecibo ? {} : { borderBottom: `1px solid ${C.line}` }) }}>
          <Cell label="Beneficiário Final" value="" flex={3.2} />
          <Cell label="Código de Baixa" value="" flex={1.05} borderLeft />
        </div>

        {/* Barcode — ficha only */}
        {!isRecibo && (
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", padding: "8px 10px" }}>
            <FauxBarcode />
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 7.5, color: "#555" }}>Autenticação Mecânica</div>
              <div style={{ fontSize: 12, fontWeight: 800 }}>FICHA DE COMPENSAÇÃO</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function BoletoPreview({ data }: { data: BoletoPreviewData }) {
  return (
    <div style={{ background: "#fff", color: C.ink, fontFamily: "Arial, Helvetica, sans-serif", width: 760, padding: 14 }}>
      <div style={{ fontSize: 8, color: "#555", marginBottom: 4, textAlign: "right" }}>
        Parcela {data.numero}/{data.totalParcelas}
      </div>
      <BoletoBlock data={data} variant="recibo" />
      <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "7px 0", color: "#888", fontSize: 7 }}>
        <span>✂</span>
        <div style={{ flex: 1, borderTop: "1px dashed #999" }} />
        <span>Corte na linha pontilhada</span>
        <div style={{ flex: 1, borderTop: "1px dashed #999" }} />
      </div>
      <BoletoBlock data={data} variant="ficha" />
    </div>
  );
}
