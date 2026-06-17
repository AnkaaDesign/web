/**
 * Centralized company information used across the application.
 * This is static branding/contact data for Ankaa Design.
 *
 * Used by:
 * - Budget public page (src/pages/public/budget/[id].tsx)
 * - Budget PDF generator (src/utils/budget-pdf-generator.ts)
 */
export const COMPANY_INFO = {
  name: "Ankaa Design",
  address: "Rua: Luis Carlos Zani, 2493 - Santa Paula, Ibipora-PR",
  phone: "43 9 8428-3228",
  phoneClean: "5543984283228",
  website: "ankaadesign.com.br",
  websiteUrl: "https://ankaadesign.com.br",
  directorName: "Sergio Rodrigues",
  directorTitle: "Diretor Comercial",
} as const;

/**
 * Brand colors used in budgets and PDFs.
 * Deep forest green matching the reference PDF template.
 */
export const BRAND_COLORS = {
  primaryGreen: "#0a5c1e",
  textDark: "#1a1a1a",
  textGray: "#666666",
} as const;

/**
 * NFS-e issuer data — Prefeitura de Ibiporã / Elotech OXY (the real DANFS-e the
 * integration emits). These values are transcribed verbatim from an authorized
 * NFS-e PDF so the pre-emission preview matches the document the prefeitura
 * actually produces. The `numeroNfse`, código de verificação, chave de acesso
 * and final ISS values only exist AFTER emission — the preview shows those as
 * "a ser atribuído".
 *
 * Used by:
 * - NFS-e preview (src/components/financial/billing/preview/nfse-preview.tsx)
 */
export const NFSE_ISSUER = {
  municipio: "PREFEITURA DO MUNICÍPIO DE IBIPORÃ",
  secretaria: "SECRETARIA MUNICIPAL DE FAZENDA",
  municipioEndereco: "PADRE VITORIANO VALENTE, 540 - 86200000 - CENTRO - IBIPORA - PR",
  prestador: {
    inscricaoMunicipal: "53459",
    cnpj: "13.636.938/0001-44",
    razaoSocial: "S. RODRIGUES & G. RODRIGUES LTDA",
    fantasia: "Ankaa Design",
    regimeFiscal: "LUCRO PRESUMIDO",
    endereco: "RUA LUIZ CARLOS ZANI, 2493 - JARDIM SANTA PAULA",
    municipioUf: "IBIPORA-PR",
    cep: "86.200-000",
    telefone: "(43) 98428-3228",
    email: "ankaadesign@outlook.com",
  },
  /** Item da Lista de Serviços da LC nº 116/03 (ELOTECH_OXY_SERVICO_LC_ID + descrição). */
  itemListaServico: "141201 Funilaria e lanternagem.",
  cnae: "4520002",
  localPrestacao: "IBIPORA-PR",
  naturezaOperacao: "Tributado no Município",
  /** Alíquota do ISSQN em % (ELOTECH_OXY_SERVICO_LC_ALIQUOTA). */
  issAliquota: 2,
  siteAutenticidade: "https://ibipora.oxy.elotech.com.br/iss/autenticar-documento-fiscal",
} as const;

/**
 * Sicredi beneficiário / cobrança data — the fixed issuer side of the boleto
 * (the pagador/valores/vencimento come from the invoice). `nossoNumero`,
 * `linhaDigitavel` and `codigoBarras` only exist AFTER Sicredi registers the
 * boleto, so the preview renders those as placeholders.
 *
 * Banco Cooperativo Sicredi = 748. Used by:
 * - Boleto preview (src/components/financial/billing/preview/boleto-preview.tsx)
 */
export const SICREDI_BENEFICIARIO = {
  nome: "S RODRIGUES E G RODRIGUES LTDA",
  cnpj: "13.636.938/0001-44",
  agenciaCodigo: "0718.58.18078",
  bancoCodigo: "748-X",
  bancoNome: "BANCO COOPERATIVO SICREDI S.A.",
  /** Espécie do documento — DUPLICATA_MERCANTIL_INDICACAO → "DMI" na ficha. */
  especieDoc: "DMI",
  especieMoeda: "REAL",
  localPagamento: "Preferencialmente em canais eletrônicos da sua instituição financeira.",
} as const;

/**
 * Company fiscal setup — the actual tax/payroll parameters for Ankaa Design.
 *
 * Used to pre-fill the "Custo de Funcionário" simulator so the owner doesn't
 * re-enter what the company already knows. All values remain editable in the
 * tool (the simulator may model hypotheticals).
 *
 * Used by:
 * - Employee cost calculator (src/pages/tools/employee-cost-calculator.tsx)
 */
export const COMPANY_FISCAL = {
  /** Regime tributário da empresa: Lucro Presumido (compartilha o cálculo com Lucro Real). */
  taxRegime: "LUCRO_PRESUMIDO_REAL",
  /**
   * CNAE da atividade preponderante. Funilaria e pintura de veículos automotores
   * → 4520-0/02 ("Serviços de lanternagem ou funilaria e pintura de veículos
   * automotores"). CONFIRMAR contra o cartão CNPJ — define o RAT abaixo.
   */
  cnae: "4520-0/02",
  /**
   * RAT — Riscos Ambientais do Trabalho (%): 1 (leve) / 2 (médio) / 3 (grave),
   * conforme o grau de risco da atividade preponderante (CNAE). Funilaria/pintura
   * de veículos (CNAE 4520-0/02) é classificada como RISCO GRAVE → 3% (Anexo V do
   * Decreto 6.957/2009). CONFIRMAR no cartão CNPJ / com a contabilidade, pois
   * altera o custo de folha. Mantido editável por ser risco-dependente.
   */
  ratPct: 3,
  /**
   * FAP — Fator Acidentário de Prevenção: multiplicador 0,5–2,0 sobre o RAT,
   * calculado anualmente pela Previdência conforme o histórico de acidentes da
   * empresa. 1,0 = neutro (sem bônus nem malus).
   */
  fapFactor: 1.0,
  /** Terceiros / Sistema S + salário-educação (%). Padrão 5,8% para o Lucro Presumido/Real. */
  terceirosPct: 5.8,
} as const;
