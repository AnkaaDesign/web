import { useMemo } from "react";
import { IconFileInvoice, IconBarcode, IconExternalLink } from "@tabler/icons-react";
import { routes } from "@/constants";
import { projectInstallments } from "@/utils/installment-projection";
import { NfsePreview, type NfsePreviewData, type NfsePreviewItem } from "./nfse-preview";
import { BoletoPreview, type BoletoPreviewData } from "./boleto-preview";
import { resolveTomadorContact } from "@/lib/nfse-tomador-contact";
import {
  coveredTaskIds,
  orderNumberLabel,
  hasMultipleCustomers as hasMultipleCustomersOf,
} from "@/utils/quote-tasks";

/**
 * Computes — entirely client-side, from the billing form data — the NFS-e and
 * Sicredi boletos that WILL be generated when billing is approved, and renders
 * small clickable thumbnails. Clicking opens the document full-size in a NEW
 * BROWSER TAB (data handed off via localStorage), keeping the approval modal
 * intact in the original tab.
 *
 * The NFS-e is emitted first, so the boleto carries `NF<nº>` (seuNumero). Since
 * NFS-e numbers are sequential per prestador, `nextNfseNumber` (last emitted + 1)
 * lets us show the actual número that will be assigned and weave it into the
 * boleto's seuNumero and informativos.
 */

// Exact label maps used by the API's discriminação/informativo builders
// (differ from the web display labels, e.g. "Carga seca" vs "Carga Seca").
const API_TRUCK_CATEGORY_LABELS: Record<string, string> = {
  MINI: "Mini",
  VUC: "VUC",
  THREE_QUARTER: "3/4",
  RIGID: "Toco",
  TRUCK: "Truck",
  SEMI_TRAILER: "Semirreboque",
  SEMI_TRAILER_2_AXLES: "Semirreboque 2 Eixos",
  B_DOUBLE_FRONT: "Bitrem Composição Dianteira",
  B_DOUBLE_REAR: "Bitrem Composição Traseira",
  BITRUCK: "Bitruck",
};
const API_IMPLEMENT_TYPE_LABELS: Record<string, string> = {
  DRY_CARGO: "Carga seca",
  REFRIGERATED: "Refrigerado",
  INSULATED: "Isotérmico",
  CURTAIN_SIDE: "Sider",
  TANK: "Tanque",
  FLATBED: "Prancha/Plataforma",
};

interface TaskVehicle {
  plate?: string | null;
  serialNumber?: string | null;
  chassisNumber?: string | null;
  category?: string | null;
  implementType?: string | null;
}

interface BillingDocumentPreviewsProps {
  customerConfigs: any[];
  services: any[];
  task: TaskVehicle;
  /** Predicted next NFS-e number (last emitted + 1); null if unknown. */
  nextNfseNumber?: number | null;
  /**
   * O NÚMERO DO PEDIDO DE COMPRA de cada veículo do orçamento (`id → número`),
   * do FORMULÁRIO — a pré-visualização tem de mostrar o que acabou de ser
   * digitado, não o que está gravado.
   *
   * Mora na TAREFA (`Task.customerOrderNumber`) e já não na configuração de
   * faturamento: uma nota conjunta cobre os N veículos e cita os pedidos de
   * todos, exatamente como `orderNumberLabel` monta no servidor.
   */
  orderNumbersByTask?: Record<string, string | null>;
  /** Os veículos do orçamento, na ordem do documento. */
  quoteTaskIds?: string[];
  /**
   * OS VEÍCULOS do orçamento por id — o que a discriminação da nota nomeia.
   *
   * Uma fatura cobre um caminhão, um lote ou os sessenta, e a nota fala dos que
   * ELA cobre. Sem esta relação a prévia só conhecia o veículo ABERTO e
   * mostrava, numa nota conjunta de quatro, a discriminação de um.
   */
  vehiclesByTask?: Record<string, TaskVehicle>;
  /** Nº do orçamento — a discriminação o cita quando os veículos são muitos. */
  budgetNumber?: number | null;
}

const round2 = (v: number) => Math.round(v * 100) / 100;
const upperFirst = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

function formatCnpjCpf(cnpj?: string, cpf?: string): string {
  const d = (cnpj || cpf || "").replace(/\D/g, "");
  if (cnpj && d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  return cnpj || cpf || "";
}
function formatCep(cep?: string): string {
  const d = (cep || "").replace(/\D/g, "");
  return d.length === 8 ? d.replace(/(\d{5})(\d{3})/, "$1-$2") : cep || "";
}
function formatPhone(phone?: string): string {
  const d = (phone || "").replace(/\D/g, "");
  if (d.length === 11) return d.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  if (d.length === 10) return d.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  return phone || "";
}

/** Um veículo por extenso — espelha `describeOneVehicle` da emissão. */
function describeOneVehicle(v: TaskVehicle): string {
  const typeParts: string[] = [];
  if (v.category) typeParts.push(API_TRUCK_CATEGORY_LABELS[v.category] ?? v.category);
  if (v.implementType) typeParts.push(API_IMPLEMENT_TYPE_LABELS[v.implementType] ?? v.implementType);
  const idParts: string[] = [];
  if (v.serialNumber) idParts.push(`n série: ${v.serialNumber}`);
  if (v.plate) idParts.push(`placa: ${v.plate}`);
  if (v.chassisNumber) idParts.push(`chassi: ${v.chassisNumber}`);
  const typePart = typeParts.join(" ");
  const idPart = idParts.join(", ");
  if (typePart && idPart) return `${typePart} de ${idPart}`;
  return typePart || idPart;
}

/**
 * A DISCRIMINAÇÃO dos veículos que ESTA nota cobre.
 *
 * Mesmas três faixas da emissão (`elotech-oxy-nfse.service.ts`): um por extenso,
 * dois ou três por extenso, e de quatro em diante a CONTAGEM mais a faixa de
 * séries — o teto de 11 linhas da discriminação não cabe sessenta caminhões, e
 * o que o fiscal lê é a lista de serviços.
 */
function buildVehicleRef(vehicles: TaskVehicle[], budgetNumber?: number | null): string {
  const described = vehicles.map(describeOneVehicle).filter(Boolean);
  if (described.length === 0) return "";
  if (described.length === 1) {
    return `Referente aos serviços executados no veículo ${described[0]}.`;
  }
  if (described.length <= 3) {
    return `Referente aos serviços executados nos veículos ${described.join("; ")}.`;
  }
  const serials = vehicles
    .map((v) => v.serialNumber)
    .filter((n): n is string => Boolean(n))
    .sort();
  const range = serials.length > 1 ? ` (séries ${serials[0]} a ${serials[serials.length - 1]})` : "";
  const budgetRef = budgetNumber ? ` Orçamento nº ${budgetNumber}.` : "";
  return `Referente aos serviços executados em ${vehicles.length} veículos${range}.` + budgetRef;
}

/** Greedy packer mirroring sicredi-boleto.scheduler.ts buildServiceLines. */
function packServiceLines(descriptions: string[], maxLines: number, maxChars: number): string[] {
  const lines: string[] = [];
  let current = "";
  for (const raw of descriptions) {
    const item = (raw || "").substring(0, maxChars);
    if (!item) continue;
    if (!current) current = item;
    else if (current.length + 2 + item.length <= maxChars) current += ", " + item;
    else {
      lines.push(current);
      if (lines.length >= maxLines) return lines;
      current = item;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  return lines.slice(0, maxLines);
}

/** Mirrors buildBoletoLines (task path): Pedido-NF / veículo / identificadores / serviços. */
function buildBoletoInformativos(
  orderNumber: string | null,
  nfPart: string | null,
  task: TaskVehicle,
  serviceDescs: string[],
): string[] {
  const parts: string[] = [];
  const pedidoPart = orderNumber ? `Pedido: ${orderNumber}` : null; // raw for boleto
  if (pedidoPart && nfPart) parts.push(`${pedidoPart} - ${nfPart}`);
  else if (pedidoPart) parts.push(pedidoPart);
  else if (nfPart) parts.push(nfPart);

  const vehicleType = [
    task.category ? API_TRUCK_CATEGORY_LABELS[task.category] ?? task.category : "",
    task.implementType ? API_IMPLEMENT_TYPE_LABELS[task.implementType] ?? task.implementType : "",
  ]
    .filter(Boolean)
    .join(" ");
  if (vehicleType) parts.push(`Referente aos servicos no veiculo ${vehicleType}`.trimEnd().substring(0, 80));

  const identifiers: string[] = [];
  if (task.serialNumber) identifiers.push(`N.º serie: ${task.serialNumber}`);
  else if (task.plate) identifiers.push(`Placa: ${task.plate}`);
  if (task.serialNumber && task.plate) identifiers.push(`placa: ${task.plate}`);
  if (task.chassisNumber) identifiers.push(`chassi: ${task.chassisNumber}`);
  if (identifiers.length) parts.push(identifiers.join(", ").substring(0, 80));

  const remaining = 5 - parts.length;
  if (remaining > 0 && serviceDescs.length) {
    const descs = serviceDescs.map((d, i) => (i === 0 ? upperFirst(d) : d)).filter(Boolean);
    parts.push(...packServiceLines(descs, remaining, 80));
  }
  return parts;
}

/** Mirrors buildSeuNumero: NF<last8 nfse> → plate+installment → uuid. */
function buildSeuNumero(
  generateInvoice: boolean,
  predictedNfseNumber: number | null,
  plate: string | null,
  installmentNumber: number,
): { value: string; pending: boolean } {
  if (generateInvoice) {
    if (predictedNfseNumber != null) {
      return { value: `NF${String(predictedNfseNumber).slice(-8)}`, pending: false };
    }
    return { value: "NF‹nº NFS-e›", pending: true };
  }
  if (plate) {
    const clean = plate.replace(/[^A-Za-z0-9]/g, "");
    const num = String(installmentNumber);
    return { value: (clean.slice(0, 10 - num.length) + num).slice(0, 10), pending: false };
  }
  return { value: "(gerado no registro)", pending: true };
}

interface CustomerDoc {
  customerId: string;
  customerName: string;
  nfse?: NfsePreviewData;
  boletos: BoletoPreviewData[];
}

function buildCustomerDoc(
  config: any,
  configServices: any[],
  task: TaskVehicle,
  predictedNfseNumber: number | null,
  orderNumber: string | null,
  /** Os veículos que ESTA fatura cobre — a quantidade de cada linha e a discriminação. */
  coveredVehicles: TaskVehicle[],
  budgetNumber?: number | null,
): CustomerDoc {
  const cd = config.customerData || {};
  const customerName = cd.corporateName || cd.fantasyName || "Cliente";
  const generateInvoice = config.generateInvoice !== false;
  // "Outros" is a generic catch-all description; the real service text lives in the
  // observation. Mirror the backend NFS-e emission so the preview matches the emitted NF.
  const resolveServiceDesc = (s: any): string =>
    s.description === "Outros" && s.observation?.trim() ? s.observation.trim() : s.description;
  const serviceDescs = configServices.map((s) => resolveServiceDesc(s)).filter(Boolean);
  const nfseNumberForThisDoc = generateInvoice ? predictedNfseNumber : null;

  // ═══════════════════════════════════════════════════════════════════════════
  // A QUANTIDADE DE CADA LINHA É O NÚMERO DE VEÍCULOS QUE ESTA FATURA COBRE
  // ═══════════════════════════════════════════════════════════════════════════
  //
  // `svc.amount` é o preço de UM veículo (ver `utils/quote-money.ts`) e
  // `config.total` já é `por veículo × cobertos` — é ele que o boleto ao lado
  // mostra. Somar os unitários aqui punha, no MESMO diálogo de confirmação, uma
  // NFS-e de R$ 1.200,00 encostada num boleto de R$ 2.400,00.
  const quantidade = Math.max(1, coveredVehicles.length);
  const lineTotals = configServices.map((svc) => round2((Number(svc.amount) || 0) * quantidade));
  const servicesSubtotal = round2(lineTotals.reduce((s, v) => s + v, 0));

  // O DESCONTO, pela mesma regra da emissão (`resolveGlobalDiscount`): a
  // diferença entre o que as linhas somam e o que a fatura cobra É o desconto,
  // seja como tiver sido digitado. O par declarado só entra quando não há linha
  // para medir ou quando não há diferença — do contrário a nota e o boleto
  // divergiriam pelos centavos do arredondamento.
  const configTotal = Number(config.total) || 0;
  const gap = round2(servicesSubtotal - configTotal);
  let targetDiscount = 0;
  if (servicesSubtotal > 0 && configTotal > 0 && gap > 0.005) {
    targetDiscount = gap;
  } else if (config.discountType === "PERCENTAGE" && config.discountValue) {
    targetDiscount = round2((servicesSubtotal * Number(config.discountValue)) / 100);
  } else if (config.discountType === "FIXED_VALUE" && config.discountValue) {
    targetDiscount = Math.min(round2(Number(config.discountValue) * quantidade), servicesSubtotal);
  }
  targetDiscount = Math.min(targetDiscount, servicesSubtotal);

  // Repartição por MAIOR RESTO — a mesma da emissão, para a soma das linhas
  // bater no alvo até o centavo.
  const lineDiscounts = new Array(lineTotals.length).fill(0) as number[];
  if (targetDiscount > 0 && servicesSubtotal > 0) {
    const targetCents = Math.round(targetDiscount * 100);
    const subtotalCents = Math.round(servicesSubtotal * 100);
    const raw = lineTotals.map((amt) => (Math.round(amt * 100) * targetCents) / subtotalCents);
    const floored = raw.map((r) => Math.floor(r));
    let leftover = targetCents - floored.reduce((a, b) => a + b, 0);
    const order = raw
      .map((r, i) => ({ i, frac: r - Math.floor(r) }))
      .sort((a, b) => b.frac - a.frac);
    let k = 0;
    while (leftover > 0 && order.length > 0) {
      floored[order[k % order.length].i] += 1;
      leftover -= 1;
      k += 1;
    }
    for (let i = 0; i < floored.length; i++) lineDiscounts[i] = floored[i] / 100;
  }

  let totalDescontos = 0;
  const itens: NfsePreviewItem[] = configServices.map((svc, i) => {
    const unitario = Number(svc.amount) || 0;
    const valorTotal = lineTotals[i] ?? 0;
    const desconto = lineDiscounts[i] ?? 0;
    totalDescontos += desconto;
    return {
      descricao: resolveServiceDesc(svc) || "",
      quantidade,
      valor: unitario,
      desconto,
      descontoCondicionado: 0,
      valorServico: valorTotal,
      valorLiquido: Math.max(0, round2(valorTotal - desconto)),
    };
  });
  totalDescontos = round2(totalDescontos);

  const totalServicos = round2(servicesSubtotal);
  const baseCalculoIss = Math.max(0, round2(totalServicos - totalDescontos));
  const valorIss = round2((baseCalculoIss * 2) / 100);

  // NFS-e discriminação — order number IS cleaned here ("PEDIDO NR 123" → "123")
  const cleanOrderNumber = (orderNumber || "").replace(/^PEDIDO\s+NR\s+/i, "").trim();
  const vehicleRef = buildVehicleRef(
    coveredVehicles.length > 0 ? coveredVehicles : [task],
    budgetNumber,
  );
  const discLines: string[] = [];
  if (cleanOrderNumber) discLines.push(`Pedido: ${cleanOrderNumber}`);
  if (vehicleRef) discLines.push(vehicleRef);
  serviceDescs.forEach((d) => discLines.push(d));
  const discriminacao = discLines.join("\n");

  const enderecoParts = [cd.address, cd.addressNumber].filter(Boolean).join(", ");
  const endereco = [enderecoParts, cd.addressComplement, cd.neighborhood].filter(Boolean).join(" - ");
  const municipioUf = [cd.city, cd.state].filter(Boolean).join("-");
  const cnpjCpf = formatCnpjCpf(cd.cnpj, cd.cpf);
  // Mesma precedência da emissão (cadastro → responsável do faturamento); `phones` é array.
  const tomadorContact = resolveTomadorContact(cd, (config as any)?.responsible);
  const cep = formatCep(cd.zipCode);

  const now = new Date();
  const nfse: NfsePreviewData | undefined = generateInvoice
    ? {
        numeroNfse: nfseNumberForThisDoc != null ? String(nfseNumberForThisDoc) : undefined,
        tomador: {
          razao: customerName,
          cnpjCpf,
          isJuridica: !!cd.cnpj,
          inscricaoMunicipal: cd.municipalRegistration || "",
          inscricaoEstadual: cd.stateRegistration || "",
          endereco,
          municipioUf,
          cep,
          telefone: formatPhone(tomadorContact.phone),
          email: tomadorContact.email,
        },
        competencia: `${now.getMonth() + 1}/${now.getFullYear()}`,
        discriminacao,
        itens,
        totalServicos,
        totalDescontos,
        totalDeducoes: 0,
        baseCalculoIss,
        valorIss,
        valorLiquido: baseCalculoIss,
      }
    : undefined;

  // Boleto informativos — order number RAW; NF part uses the predicted número.
  const nfPart =
    nfseNumberForThisDoc != null ? `NF ${nfseNumberForThisDoc}` : generateInvoice ? "NF ‹nº NFS-e›" : null;
  const informativos = buildBoletoInformativos(orderNumber || null, nfPart, task, serviceDescs);

  const total = Number(config.total) || baseCalculoIss;
  const projected = config.generateBankSlip !== false
    ? projectInstallments(total, config.paymentConfig, config.paymentCondition, now)
    : [];
  const boletos: BoletoPreviewData[] = projected.map((inst) => {
    const seu = buildSeuNumero(generateInvoice, nfseNumberForThisDoc, task.plate || null, inst.number);
    return {
      pagador: { nome: customerName, cnpjCpf, endereco, municipioUf, cep },
      numero: inst.number,
      totalParcelas: projected.length,
      valor: inst.amount,
      vencimento: inst.dueDate,
      seuNumero: seu.value,
      seuNumeroPending: seu.pending,
      dataDocumento: now,
      informativos,
    };
  });

  return { customerId: config.customerId, customerName, nfse, boletos };
}

interface DocEntry {
  key: string;
  kind: "nfse" | "boleto";
  label: string;
  sublabel: string;
  data: NfsePreviewData | BoletoPreviewData;
}

const randomKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${performance.now()}-${Math.floor(Math.random() * 1e9)}`;

/** Renders a document (natural 760px) shrunk to `width` px via CSS zoom. */
function ScaledDoc({ width, children }: { width: number; children: React.ReactNode }) {
  return <div style={{ zoom: width / 760 }}>{children}</div>;
}

function renderDoc(entry: DocEntry) {
  return entry.kind === "nfse" ? (
    <NfsePreview data={entry.data as NfsePreviewData} />
  ) : (
    <BoletoPreview data={entry.data as BoletoPreviewData} />
  );
}

export function BillingDocumentPreviews({
  customerConfigs,
  services,
  task,
  nextNfseNumber,
  orderNumbersByTask,
  quoteTaskIds,
  vehiclesByTask,
  budgetNumber,
}: BillingDocumentPreviewsProps) {
  const docs = useMemo<DocEntry[]>(() => {
    const configs = customerConfigs || [];
    if (configs.length === 0) return [];
    // ⚠️ UM CLIENTE, não UMA FATURA. Num orçamento cobrado veículo a veículo há
    // uma fatura por caminhão, todas do mesmo cliente: contar faturas fazia o
    // filtro por `invoiceToCustomerId` rodar, e como ninguém preenche esse campo
    // num orçamento de um cliente só, as faturas 2..N saíam com ZERO serviços —
    // a pré-visualização da nota fiscal e do boleto mostrando um documento vazio
    // logo antes de emitir.
    const single = !hasMultipleCustomersOf(configs);
    const entries: DocEntry[] = [];
    let nfseSeq = 0; // sequential offset per generated NFS-e
    configs.forEach((config, idx) => {
      const configServices = single
        ? services
        : services.filter((s) => s.invoiceToCustomerId === config.customerId || (!s.invoiceToCustomerId && idx === 0));
      const willEmit = config.generateInvoice !== false;
      const predicted = willEmit && nextNfseNumber != null ? nextNfseNumber + nfseSeq : null;
      if (willEmit) nfseSeq += 1;

      // O PEDIDO DE COMPRA que ESTE documento vai citar — o dos veículos que ESTA
      // fatura cobre: o de um caminhão quando ela cobra um, os do lote quando
      // cobra vinte. É a mesma leitura que `orderNumberLabel` recebe no servidor.
      //
      // Era `config.taskId`, coluna removida em `20260913120000_billing_coverage`:
      // a prévia passou a citar os pedidos do ORÇAMENTO INTEIRO em toda fatia,
      // que é o campo em que a Elotech procura o empenho.
      const numbers = orderNumbersByTask ?? {};
      const covered = coveredTaskIds(config as any);
      const idsForDoc =
        covered.length > 0 ? covered : (quoteTaskIds ?? Object.keys(numbers));
      const orderNumber = orderNumberLabel(
        idsForDoc.map((id) => ({ customerOrderNumber: numbers[id] ?? null })),
      );

      // OS VEÍCULOS QUE ESTA FATURA COBRE, na ordem do documento. Recai no
      // veículo aberto quando a relação não veio — um orçamento de um veículo
      // continua com a discriminação de sempre.
      const coveredVehicles = idsForDoc
        .map((tid) => (vehiclesByTask ?? {})[tid])
        .filter((v): v is TaskVehicle => Boolean(v));
      const doc = buildCustomerDoc(
        config,
        configServices,
        task,
        predicted,
        orderNumber,
        coveredVehicles.length > 0 ? coveredVehicles : [task],
        budgetNumber,
      );
      if (doc.nfse) {
        entries.push({ key: `nfse-${doc.customerId}`, kind: "nfse", label: "NFS-e", sublabel: doc.customerName, data: doc.nfse });
      }
      doc.boletos.forEach((b) => {
        entries.push({
          key: `boleto-${doc.customerId}-${b.numero}`,
          kind: "boleto",
          label: `Boleto ${b.numero}/${b.totalParcelas}`,
          sublabel: doc.customerName,
          data: b,
        });
      });
    });
    return entries;
  }, [
    customerConfigs,
    services,
    task,
    nextNfseNumber,
    orderNumbersByTask,
    quoteTaskIds,
    vehiclesByTask,
    budgetNumber,
  ]);

  const nfseCount = docs.filter((d) => d.kind === "nfse").length;
  const boletoCount = docs.filter((d) => d.kind === "boleto").length;

  const openInNewTab = (entry: DocEntry) => {
    const key = `billing-doc-preview:${randomKey()}`;
    try {
      localStorage.setItem(
        key,
        JSON.stringify({ kind: entry.kind, label: entry.label, sublabel: entry.sublabel, data: entry.data }),
      );
    } catch {
      /* localStorage may be unavailable — open anyway; page will show a friendly error */
    }
    window.open(`${routes.financial.billing.documentPreview}?k=${encodeURIComponent(key)}`, "_blank", "noopener");
  };

  if (docs.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        Nenhum documento a pré-visualizar (sem cliente/serviços ou geração desativada).
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <IconFileInvoice className="h-3.5 w-3.5" /> {nfseCount} nota(s) fiscal(is)
        </span>
        <span className="inline-flex items-center gap-1">
          <IconBarcode className="h-3.5 w-3.5" /> {boletoCount} boleto(s)
        </span>
        <span className="ml-auto">Clique para abrir em nova aba · documentos ainda não emitidos</span>
      </div>

      <div className="flex flex-wrap gap-3 rounded-lg border border-border bg-neutral-100 dark:bg-neutral-800 p-3 max-h-[44vh] overflow-y-auto">
        {docs.map((d) => (
          <button
            key={d.key}
            type="button"
            onClick={() => openInNewTab(d)}
            className="group flex flex-col overflow-hidden rounded-md border border-border bg-white text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md hover:ring-2 hover:ring-primary"
            style={{ width: 224 }}
            title={`Abrir ${d.label} — ${d.sublabel} em nova aba`}
          >
            {/* Scaled thumbnail (top portion of the document) — no overlay over the PDF */}
            <div className="relative" style={{ height: 224, overflow: "hidden", borderBottom: "1px solid #e5e5e5" }}>
              <ScaledDoc width={224}>{renderDoc(d)}</ScaledDoc>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-b from-transparent to-white" />
            </div>
            {/* Always-visible footer affordance (never overlaps the PDF) */}
            <div className="flex items-center gap-1.5 px-2 py-1.5">
              {d.kind === "nfse" ? (
                <IconFileInvoice className="h-4 w-4 shrink-0 text-emerald-600" />
              ) : (
                <IconBarcode className="h-4 w-4 shrink-0 text-blue-600" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-foreground">{d.label}</p>
                <p className="truncate text-[11px] text-muted-foreground">{d.sublabel}</p>
              </div>
              <IconExternalLink className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
