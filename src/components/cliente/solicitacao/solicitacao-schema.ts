// web/src/components/cliente/solicitacao/solicitacao-schema.ts
//
// A BORDA DA REQUISIÇÃO — zod do portal, e o construtor do payload de §5.
//
// Três regras deste arquivo valem mais que o resto dele:
//
//  1. ⛔ NUNCA existe produto cartesiano. `Task.serialNumber` e `Truck.plate`
//     são `@unique` GLOBAIS: N placas × 1 série viraria N tarefas com a MESMA
//     série e o servidor devolve 400 na primeira. Cada veículo é uma tupla
//     EXPLÍCITA (série, placa, chassi). A faixa de série ("1001 1005") expande
//     no cliente em 5 LINHAS editáveis — nunca em um multiplicador.
//
//  2. ⚠️ Documento é OBRIGATÓRIO ao criar cliente aqui. `customerQuickCreateSchema`
//     (o do sistema interno) não tem esse refine de propósito, e um cliente sem
//     CNPJ nem CPF trava a NFS-e lá na frente — quando já é tarde, porque o
//     serviço foi feito. O portal exige na entrada.
//
//  3. ⚠️ Medidas são CENTÍMETROS na borda. O banco guarda METROS; quem divide
//     por 100 é o SERVIDOR (contrato §5, armadilha 3). Daqui sai centímetro.
//
//  4. ⛔ AS MEDIDAS SÃO UMA SÓ, DA REQUISIÇÃO INTEIRA — não uma por veículo.
//     Quem pede dez caminhões pede dez caminhões DO MESMO MODELO; digitar a
//     mesma altura e o mesmo comprimento dez vezes era trabalho inventado, e
//     cada repetição era uma chance a mais de duas linhas divergirem sem
//     ninguém perceber. O que continua por linha é o que de fato muda de
//     caminhão para caminhão: série, placa e chassi.
//     O payload de §5 segue tendo `medidas` DENTRO de cada veículo (é assim que
//     o servidor grava, uma medida por `Truck`) — quem replica é
//     `buildSolicitacaoPayload`, e cada veículo recebe uma CÓPIA própria.
import { z } from "zod";
import {
  CHASSIS_FORBIDDEN_LETTERS,
  CHASSIS_FORBIDDEN_LETTERS_MESSAGE,
  CHASSIS_INVALID_MESSAGE,
  CHASSIS_LENGTH_REGEX,
  CHASSIS_REGEX,
  PLATE_INVALID_MESSAGE,
  PLATE_REGEX,
  cleanChassis,
  cleanPlate,
  isValidCNPJ,
  isValidCPF,
} from "@/utils";
import { PAINT_FINISH } from "@/constants";
import type {
  PortalBudgetRequestInput,
  PortalBudgetRequestVehicleInput,
  PortalMeasureSectionInput,
  PortalMeasureSideInput,
  PortalNewCustomerInput,
} from "@/api-client/portal";
import type { ImplementFace } from "@/constants/implement-faces";

/**
 * O valor que o combobox de cliente carrega enquanto o cliente ainda NÃO existe
 * no banco — quem o criou foi o diálogo "criar" de dentro do próprio combobox,
 * e ele só nasce de verdade no POST da requisição (`novoCliente`, §5).
 *
 * É sentinela e não UUID de propósito: se algum dia ele escapar para o payload,
 * o servidor recusa em vez de gravar um id inventado.
 */
export const NOVO_CLIENTE_VALUE = "__novo_cliente__";

/** O mesmo, para a tinta criada na hora (`novaTinta`, §5). */
export const NOVA_TINTA_VALUE = "__nova_tinta__";

/** Teto do que uma faixa de série pode expandir de uma vez. */
export const MAX_VEICULOS = 60;

/** Teto de arquivos-base que o multipart aceita (contrato §5). */
export const MAX_BASE_FILES = 30;

// ─────────────────────────────────────────────────────────────────────────────
// Cliente novo
// ─────────────────────────────────────────────────────────────────────────────

const onlyDigits = (value: string | null | undefined) => (value ?? "").replace(/\D/g, "");

export const novoClienteSchema = z
  .object({
    fantasyName: z.string().trim().min(1, "Nome fantasia é obrigatório"),
    corporateName: z.string().trim().nullable().optional(),
    cnpj: z
      .string()
      .nullable()
      .optional()
      .refine((val) => !val || isValidCNPJ(val), { message: "CNPJ inválido" }),
    cpf: z
      .string()
      .nullable()
      .optional()
      .refine((val) => !val || isValidCPF(val), { message: "CPF inválido" }),
    email: z
      .string()
      .trim()
      .email("E-mail inválido")
      .nullable()
      .optional()
      .or(z.literal("")),
    phone: z.string().trim().nullable().optional(),
    city: z.string().trim().nullable().optional(),
    state: z
      .string()
      .trim()
      .length(2, "Use a sigla do estado (2 letras)")
      .nullable()
      .optional()
      .or(z.literal("")),
  })
  // ⚠️ ESTE refine é a diferença entre o portal e `customerQuickCreateSchema`.
  // Ver o cabeçalho do arquivo: sem documento não há nota fiscal.
  .refine((data) => !!onlyDigits(data.cnpj) || !!onlyDigits(data.cpf), {
    message: "Informe o CNPJ ou o CPF — sem documento não é possível faturar depois.",
    path: ["cnpj"],
  });

export type NovoClienteFormData = z.infer<typeof novoClienteSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Tinta nova
// ─────────────────────────────────────────────────────────────────────────────

export const novaTintaSchema = z.object({
  name: z.string().trim().min(1, "Nome da cor é obrigatório"),
  hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Cor inválida"),
  finish: z.enum(Object.values(PAINT_FINISH) as [string, ...string[]], {
    errorMap: () => ({ message: "Selecione o acabamento" }),
  }),
  paintTypeId: z.string().uuid("Selecione o tipo de tinta"),
});

export type NovaTintaFormData = z.infer<typeof novaTintaSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// MEDIDAS DO IMPLEMENTO — UMAS SÓ, da requisição inteira
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ⛔ A MEDIDA DO SERVIDOR É UM OBJETO, NÃO UM NÚMERO.
 *
 * `portalMedidaLadoSchema` (`api/src/schemas/portal-request.ts`) é
 * `{ height, sections: [{ width, isDoor, doorHeight?, position? }] }`, com
 * `height` OBRIGATÓRIO e ao menos UMA seção. Esta tela já mandou
 * `medidas.esquerda = 780` — um número onde o zod espera objeto —, e o efeito
 * não era a medida sumir em silêncio: era `invalid_type` e **400 na requisição
 * inteira**. Quem preenchesse qualquer medida não conseguia enviar o formulário.
 *
 * ⛔ E ELAS SÃO UMAS SÓ PARA TODOS OS VEÍCULOS (ver a regra 4 do cabeçalho).
 * Quem preenche é o `ImplementMeasureForm` — o MESMO componente do formulário
 * interno de tarefa —, e o que ele desenha é um implemento com altura, seções e
 * portas, não três caixinhas de comprimento.
 *
 * ⚠️ Os tetos são os do servidor: altura 1000 cm (10 m), largura 2000 cm (20 m)
 * e 10 seções por lado. Dizer não aqui é dizer no campo, e não no envio.
 */
const ALTURA_MAX_CM = 1000;
const LARGURA_MAX_CM = 2000;
const MAX_SECOES = 10;

/**
 * O implemento que o `ImplementMeasureForm` desenha quando ainda não há nada:
 * 2,00 m × 2,00 m, uma seção, sem porta.
 *
 * ⚠️ Tem de ser IGUAL ao padrão interno do componente
 * (`sideStates` inicial, `{ height: 200, totalWidth: 200, doors: [] }`), senão o
 * primeiro render mostra um número e o estado do formulário guarda outro.
 */
export const MEDIDA_PADRAO_ALTURA_CM = 200;
export const MEDIDA_PADRAO_LARGURA_CM = 200;

const numeroCm = (max: number, rotulo: string) =>
  z
    .number({ invalid_type_error: "Informe um número" })
    .positive(`${rotulo} precisa ser maior que zero`)
    .max(max, `${rotulo}: máximo de ${max} cm`);

/** Uma seção do lado — um pedaço de chapa, ou uma PORTA. Em CENTÍMETROS. */
export const medidaSecaoSchema = z
  .object({
    width: numeroCm(LARGURA_MAX_CM, "A largura da seção"),
    isDoor: z.boolean(),
    doorHeight: numeroCm(ALTURA_MAX_CM, "A altura da porta").nullable().optional(),
    position: z.number().int().min(0),
  })
  .refine((secao) => !secao.isDoor || typeof secao.doorHeight === "number", {
    message: "Seção marcada como porta precisa da altura da porta",
    path: ["doorHeight"],
  });

/** Um lado do implemento, em CENTÍMETROS. Espelha `portalMedidaLadoSchema`. */
export const medidaLadoSchema = z
  .object({
    height: numeroCm(ALTURA_MAX_CM, "A altura do implemento"),
    sections: z
      .array(medidaSecaoSchema)
      .min(1, "A medida precisa de ao menos uma seção")
      .max(MAX_SECOES, `Máximo de ${MAX_SECOES} seções por lado`),
  })
  .refine(
    (lado) => lado.sections.every((s) => !s.isDoor || (s.doorHeight ?? 0) <= lado.height),
    { message: "A porta não pode ser mais alta que o implemento", path: ["sections"] },
  );

/**
 * Os três lados. Cada um é opcional; o que NÃO existe é "meio preenchido".
 *
 * ⛔ Ou a requisição tem medidas (e então tem os três lados, porque um
 * implemento tem os três) ou não tem nenhuma. O estado intermediário — um
 * veículo com medida e o do lado sem — é justamente o que esta mudança existe
 * para extinguir.
 */
export const medidasSchema = z.object({
  esquerda: medidaLadoSchema.nullable().optional(),
  direita: medidaLadoSchema.nullable().optional(),
  traseira: medidaLadoSchema.nullable().optional(),
});

export type MedidaLadoFormData = z.infer<typeof medidaLadoSchema>;
export type MedidasFormData = z.infer<typeof medidasSchema>;

/** Um lado novo, no padrão do `ImplementMeasureForm`. */
export function novaMedidaLado(): MedidaLadoFormData {
  return {
    height: MEDIDA_PADRAO_ALTURA_CM,
    sections: [{ width: MEDIDA_PADRAO_LARGURA_CM, isDoor: false, position: 0 }],
  };
}

/** Os três lados novos — o que o interruptor "Informar medidas" liga. */
export function novasMedidas(): MedidasFormData {
  return { esquerda: novaMedidaLado(), direita: novaMedidaLado(), traseira: novaMedidaLado() };
}

/**
 * O lado do `ImplementMeasureForm` ↔ a chave das medidas da requisição.
 *
 * Cobre EXATAMENTE as faces de `IMPLEMENT_FACES` (G18): quando a frente entrar
 * lá, o `tsc` aponta este mapa, e a requisição do portal decide a sua chave.
 */
export const LADO_DO_IMPLEMENTO = {
  left: "esquerda",
  right: "direita",
  back: "traseira",
} as const satisfies Record<ImplementFace, string>;

export type LadoImplemento = ImplementFace;

/** Os rótulos do formulário INTERNO — "Motorista" e "Sapo" são os do chão. */
export const ROTULO_DO_LADO: Record<ImplementFace, string> = {
  left: "Motorista",
  right: "Sapo",
  back: "Traseira",
};

// ── A FRONTEIRA DE UNIDADE COM O `ImplementMeasureForm` ──────────────────────
//
// ⛔ AQUI MORA A ÚNICA CONVERSÃO DO LADO DO CLIENTE, E ELA É UM PAR QUE SE
// CANCELA.
//
// Três unidades convivem nesta tela e confundi-las é silencioso:
//
//   · o FORMULÁRIO do portal guarda CENTÍMETROS (é o que §5 recebe);
//   · o `ImplementMeasureForm` recebe e devolve METROS nas props `layout`
//     e `onChange` — por dentro ele multiplica por 100 e trabalha em cm, que é
//     o que o usuário vê;
//   · o BANCO guarda metros, e quem divide por 100 é o SERVIDOR.
//
// Logo: `medidaLadoParaFormulario` divide por 100 na ida, `medidaLadoDoFormulario`
// multiplica por 100 na volta, e o resultado líquido é IDENTIDADE. A conversão
// que conta acontece UMA vez, na API. Uma divisão a mais em qualquer um dos dois
// sentidos não estoura nada: produz um implemento de 7,8 cm, aceito por todos os
// zods do caminho.
type MedidaLadoEmMetros = {
  height: number;
  sections: Array<{ width: number; isDoor: boolean; doorHeight: number | null; position: number }>;
};

/** CENTÍMETROS → METROS, para a prop `layout` do `ImplementMeasureForm`. */
export function medidaLadoParaFormulario(
  lado: MedidaLadoFormData | null | undefined,
): MedidaLadoEmMetros | undefined {
  if (!lado) return undefined;
  return {
    height: lado.height / 100,
    sections: (lado.sections ?? []).map((secao, index) => ({
      width: secao.width / 100,
      isDoor: !!secao.isDoor,
      doorHeight: typeof secao.doorHeight === "number" ? secao.doorHeight / 100 : null,
      position: typeof secao.position === "number" ? secao.position : index,
    })),
  };
}

/**
 * METROS → CENTÍMETROS, para o que o `onChange` do `ImplementMeasureForm` emite.
 *
 * ⚠️ `Math.round`: o componente já arredonda para o centímetro inteiro na
 * digitação (`MeasurementInput`), e sem o arredondamento aqui a volta de
 * 2,455 m devolve 245,49999999999997 cm — um número que passa em todo zod e
 * aparece inteiro na tela, mas que nunca é igual ao que entrou.
 */
export function medidaLadoDoFormulario(dados: {
  height?: number | null;
  sections?: Array<{
    width?: number | null;
    isDoor?: boolean;
    doorHeight?: number | null;
    position?: number;
  }> | null;
}): MedidaLadoFormData {
  return {
    height: Math.round((dados?.height ?? 0) * 100),
    sections: (dados?.sections ?? []).map((secao, index) => ({
      width: Math.round((secao?.width ?? 0) * 100),
      isDoor: !!secao?.isDoor,
      doorHeight: typeof secao?.doorHeight === "number" ? Math.round(secao.doorHeight * 100) : null,
      position: index,
    })),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Veículo — UMA linha, UMA tupla
// ─────────────────────────────────────────────────────────────────────────────

export const veiculoSchema = z
  .object({
    /** Chave local da linha. NUNCA vai no payload. */
    uid: z.string(),
    serialNumber: z.string().trim().max(60, "Número de série longo demais"),
    plate: z.string().trim(),
    chassisNumber: z.string().trim(),
    // ⛔ NÃO HÁ MEDIDA AQUI. Ela é da REQUISIÇÃO (ver `medidasSchema` acima e a
    // regra 4 do cabeçalho). O que muda de caminhão para caminhão é a
    // identificação; o implemento é o mesmo modelo no lote inteiro.
  })
  .superRefine((row, ctx) => {
    const plate = cleanPlate(row.plate ?? "");
    if (plate && !PLATE_REGEX.test(plate)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: PLATE_INVALID_MESSAGE, path: ["plate"] });
    }

    const chassis = cleanChassis(row.chassisNumber ?? "");
    if (chassis) {
      // DUAS mensagens distintas de propósito: dizer "17 caracteres" a quem
      // digitou um O no lugar do 0 num chassi que JÁ tem 17 não ajuda em nada.
      if (!CHASSIS_LENGTH_REGEX.test(chassis)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: CHASSIS_INVALID_MESSAGE,
          path: ["chassisNumber"],
        });
      } else if (CHASSIS_FORBIDDEN_LETTERS.test(chassis) || !CHASSIS_REGEX.test(chassis)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: CHASSIS_FORBIDDEN_LETTERS_MESSAGE,
          path: ["chassisNumber"],
        });
      }
    }

    if (!row.serialNumber?.trim() && !plate && !chassis) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Informe ao menos o número de série, a placa ou o chassi deste veículo.",
        path: ["serialNumber"],
      });
    }
  });

export type VeiculoFormData = z.infer<typeof veiculoSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// A requisição inteira
// ─────────────────────────────────────────────────────────────────────────────

export const solicitacaoSchema = z
  .object({
    customerId: z.string().nullable().optional(),
    novoCliente: novoClienteSchema.nullable().optional(),
    faturarParaCustomerId: z.string().uuid("Escolha para quem o orçamento será faturado"),
    briefing: z
      .string()
      .trim()
      .min(10, "Explique o serviço em pelo menos 10 caracteres")
      .max(5000, "Explicação longa demais"),
    logoName: z.string().trim().max(200, "Nome da logomarca longo demais").nullable().optional(),
    paintId: z.string().nullable().optional(),
    novaTinta: novaTintaSchema.nullable().optional(),
    veiculos: z.array(veiculoSchema).min(1, "Adicione ao menos um veículo"),
    /**
     * AS MEDIDAS DO IMPLEMENTO, em CENTÍMETROS, DE TODOS OS VEÍCULOS.
     *
     * `null` é a resposta legítima "não sei / não quero informar" — e é o
     * padrão. O que NÃO pode existir é um lado com número que ninguém digitou:
     * o `ImplementMeasureForm` nasce com 2,00 m × 2,00 m, e se este campo
     * começasse preenchido toda requisição carregaria um implemento inventado
     * até o orçamento. Ligar o interruptor é o ato afirmativo que cria os lados.
     */
    medidas: medidasSchema.nullable().optional(),
    /**
     * CATEGORIA E IMPLEMENTO — perguntados UMA vez, como as medidas.
     *
     * ⚠️ Mesma doutrina da regra 4 do cabeçalho: o que muda de caminhão para
     * caminhão é a IDENTIFICAÇÃO (série, placa, chassi); o implemento é o mesmo
     * modelo no lote inteiro. Perguntar por linha encheria o formulário de
     * repetição e produziria lotes incoerentes por descuido.
     *
     * ⚠️ `null` é "não sei", e é o padrão: o cliente que não souber segue, e o
     * campo continua corrigível no portal depois, veículo a veículo.
     */
    category: z.string().trim().nullable().optional(),
    implementType: z.string().trim().nullable().optional(),
  })
  .superRefine((data, ctx) => {
    const temExistente = !!data.customerId && data.customerId !== NOVO_CLIENTE_VALUE;
    const temNovo = !!data.novoCliente;
    if (!temExistente && !temNovo) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Escolha o cliente do serviço ou cadastre um novo.",
        path: ["customerId"],
      });
    }
    if (temExistente && temNovo) {
      // Nunca deve acontecer pela tela; se acontecer, o servidor teria de
      // adivinhar qual dos dois vale — e adivinhar aqui é criar cliente duplicado.
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Escolha um cliente existente OU cadastre um novo — não os dois.",
        path: ["customerId"],
      });
    }

    if (data.paintId && data.paintId !== NOVA_TINTA_VALUE && data.novaTinta) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Escolha uma tinta do catálogo OU cadastre uma nova.",
        path: ["paintId"],
      });
    }

    // Série e placa são `@unique` GLOBAIS. Repetir dentro da própria requisição
    // é 400 garantido, e o 400 chega DEPOIS de o contato ter preenchido tudo.
    const seenSerial = new Map<string, number>();
    const seenPlate = new Map<string, number>();
    data.veiculos.forEach((row, index) => {
      const serial = row.serialNumber?.trim().toUpperCase();
      if (serial) {
        if (seenSerial.has(serial)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Número de série repetido (já usado no veículo ${seenSerial.get(serial)! + 1}).`,
            path: ["veiculos", index, "serialNumber"],
          });
        } else {
          seenSerial.set(serial, index);
        }
      }
      const plate = cleanPlate(row.plate ?? "");
      if (plate) {
        if (seenPlate.has(plate)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Placa repetida (já usada no veículo ${seenPlate.get(plate)! + 1}).`,
            path: ["veiculos", index, "plate"],
          });
        } else {
          seenPlate.set(plate, index);
        }
      }
    });
  });

export type SolicitacaoFormData = z.infer<typeof solicitacaoSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// A FAIXA DE SÉRIE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * "1001 1005", "1001 a 1005", "1001-1005" → ["1001","1002","1003","1004","1005"].
 * Um número sozinho → uma linha só. Texto que não é número → uma linha com o
 * texto (a série é TEXTO no portal; contrato §5, armadilha 2).
 *
 * O zero à esquerda sobrevive: a largura vem do maior dos dois extremos, então
 * "0998 1002" devolve 0998, 0999, 1000, 1001, 1002 — e não 998.
 *
 * ⛔ O resultado vira N LINHAS, cada uma com a sua placa e o seu chassi. Nunca
 * um multiplicador sobre as placas: ver o cabeçalho do arquivo.
 */
export function expandSerialRange(raw: string): { series: string[]; truncated: boolean } {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return { series: [], truncated: false };

  let from: number | null = null;
  let to: number | null = null;
  let width = 0;

  // Forma EXPLÍCITA de intervalo. O hífen só separa aqui, entre dois números —
  // solto ele quebraria "AB-12", que é um número de série válido e inteiro.
  const explicito = trimmed.match(/^(\d+)\s*(?:a|à|ate|até|-|–|—|→|\.\.\.?)\s*(\d+)$/i);
  if (explicito) {
    from = parseInt(explicito[1], 10);
    to = parseInt(explicito[2], 10);
    width = Math.max(explicito[1].length, explicito[2].length);
  } else {
    // Sem separador explícito: espaço, vírgula e ponto-e-vírgula. Se TODOS os
    // pedaços forem numéricos, é intervalo (é assim que o campo interno já se
    // comporta); senão, cada pedaço é uma série literal.
    const parts = trimmed.split(/[\s,;]+/).filter(Boolean);
    if (parts.length === 0) return { series: [], truncated: false };
    const numericos = parts.every((p) => /^\d+$/.test(p));
    if (!numericos) return { series: [...new Set(parts)], truncated: false };
    if (parts.length === 1) return { series: [parts[0]], truncated: false };
    const numeros = parts.map((p) => parseInt(p, 10));
    from = Math.min(...numeros);
    to = Math.max(...numeros);
    width = Math.max(...parts.map((p) => p.length));
  }

  if (from === null || to === null || !Number.isFinite(from) || !Number.isFinite(to)) {
    return { series: [], truncated: false };
  }

  const series: string[] = [];
  let truncated = false;
  for (let n = from; n <= to; n++) {
    if (series.length >= MAX_VEICULOS) {
      truncated = true;
      break;
    }
    series.push(String(n).padStart(width, "0"));
  }
  return { series, truncated };
}

let uidCounter = 0;
export function novoVeiculo(serialNumber = ""): VeiculoFormData {
  uidCounter += 1;
  return {
    uid: `veiculo-${Date.now()}-${uidCounter}`,
    serialNumber,
    plate: "",
    chassisNumber: "",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// O PAYLOAD de §5
// ─────────────────────────────────────────────────────────────────────────────
//
// Os TIPOS são os de `api-client/portal.ts` (pacote WEB-1) — importados, nunca
// redeclarados. Uma segunda declaração do mesmo payload é como as tabelas de
// cor de estado divergiram: os dois lados compilam, e só a produção descobre
// qual deles estava certo.

const trimOrUndefined = (value: string | null | undefined): string | undefined => {
  const v = (value ?? "").trim();
  return v ? v : undefined;
};

/**
 * Um lado do formulário para um lado de §5 — CENTÍMETRO ENTRA, CENTÍMETRO SAI.
 *
 * ⚠️ NÃO HÁ DIVISÃO POR 100 AQUI, e não pode haver. Quem converte para metros é
 * o servidor (`medidaParaPrisma`, contrato §5 armadilha 3). Uma segunda divisão
 * não estoura nada: ela passa pelo zod, é gravada e produz um implemento de 7,8
 * centímetros — descoberto meses depois, pelo desenhista.
 *
 * Devolve `undefined` quando o lado não dá uma medida VÁLIDA, porque
 * `portalMedidaLadoSchema` exige `height` e ao menos uma seção: mandar um lado
 * pela metade é 400 na requisição inteira, não um campo que some.
 */
function ladoParaPayload(
  lado: MedidaLadoFormData | null | undefined,
): PortalMeasureSideInput | undefined {
  if (!lado || typeof lado.height !== "number" || lado.height <= 0) return undefined;
  if (!Array.isArray(lado.sections)) return undefined;

  const sections: PortalMeasureSectionInput[] = [];
  for (const secao of lado.sections) {
    if (typeof secao?.width !== "number" || secao.width <= 0) continue;
    // ⛔ Porta sem altura é 400 no servidor (`portalSecaoSchema` refina
    // `!isDoor || doorHeight != null`). O zod do formulário já acusa; esta
    // segunda rede REBAIXA a porta a chapa em vez de descartar a seção, porque
    // descartá-la encolheria o implemento em um metro sem ninguém ver.
    const ehPorta = !!secao.isDoor && typeof secao.doorHeight === "number";
    const saida: PortalMeasureSectionInput = {
      width: secao.width,
      isDoor: ehPorta,
      // ⚠️ Reindexado pela ORDEM FINAL: descartar uma seção de largura zero
      // deixaria um buraco na numeração, e `position` é o que ordena o desenho.
      position: sections.length,
    };
    // Só a PORTA carrega altura. `implementMeasureSectionCreateSchema` recusa
    // `doorHeight` em seção que não é porta, e o `.nullable()` do servidor
    // engoliria o `null` calado — omitir é o que diz a verdade.
    if (ehPorta) saida.doorHeight = secao.doorHeight as number;
    sections.push(saida);
  }

  if (sections.length === 0) return undefined;
  return { height: lado.height, sections };
}

/**
 * As medidas da requisição, montadas DE NOVO para cada veículo.
 *
 * ⚠️ Uma CÓPIA por veículo, e não a mesma referência N vezes: o payload é
 * serializado uma vez só hoje, mas um objeto compartilhado entre N veículos é a
 * classe de defeito em que alguém normaliza um deles e move os outros junto.
 */
/**
 * O lado está EXATAMENTE no padrão que o formulário semeou?
 *
 * Existe porque as medidas deixaram de ter interruptor (20/09): o
 * `ImplementMeasureForm` fica sempre à vista, e ele nasce com 2,00 × 2,00 m
 * sozinho. Sem esta comparação, TODA requisição — inclusive a de quem nem rolou
 * até aquele card — viajaria afirmando um implemento de dois metros que ninguém
 * mediu. E medida errada é pior que medida ausente: ausente o comercial mede na
 * entrada do veículo; errada ele monta o orçamento em cima dela.
 */
function ladoIntocado(lado: MedidaLadoFormData | null | undefined): boolean {
  if (!lado) return true;
  if (lado.height !== MEDIDA_PADRAO_ALTURA_CM) return false;
  const secoes = lado.sections ?? [];
  if (secoes.length !== 1) return false;
  const [unica] = secoes;
  return (
    unica.width === MEDIDA_PADRAO_LARGURA_CM &&
    !unica.isDoor &&
    (unica.doorHeight == null || unica.doorHeight === 0)
  );
}

/** Os três lados no padrão = ninguém encostou nas medidas. */
export function medidasIntocadas(medidas: MedidasFormData | null | undefined): boolean {
  if (!medidas) return true;
  return (
    ladoIntocado(medidas.esquerda) && ladoIntocado(medidas.direita) && ladoIntocado(medidas.traseira)
  );
}

function medidasParaPayload(
  medidas: MedidasFormData | null | undefined,
): NonNullable<PortalBudgetRequestVehicleInput["medidas"]> | undefined {
  if (!medidas) return undefined;
  // Intocadas não viajam — ver `medidasIntocadas`.
  if (medidasIntocadas(medidas)) return undefined;
  const saida: NonNullable<PortalBudgetRequestVehicleInput["medidas"]> = {};
  const esquerda = ladoParaPayload(medidas.esquerda);
  if (esquerda) saida.esquerda = esquerda;
  const direita = ladoParaPayload(medidas.direita);
  if (direita) saida.direita = direita;
  const traseira = ladoParaPayload(medidas.traseira);
  if (traseira) saida.traseira = traseira;
  return Object.keys(saida).length > 0 ? saida : undefined;
}

/**
 * Do que o formulário guarda para o que §5 descreve.
 *
 * Tudo que é vazio SAI do objeto em vez de virar `""` ou `null`: nada na API é
 * `.strict()` (contrato §10), então uma chave vazia não é recusada — ela é
 * GRAVADA, e uma placa `""` no `Truck` é tão `@unique` quanto uma placa de
 * verdade, o que reprova o segundo veículo do mesmo lote.
 */
export function buildSolicitacaoPayload(values: SolicitacaoFormData): PortalBudgetRequestInput {
  const usaNovoCliente = !!values.novoCliente;

  const payload: PortalBudgetRequestInput = {
    faturarParaCustomerId: values.faturarParaCustomerId,
    briefing: values.briefing.trim(),
    veiculos: values.veiculos.map((row) => {
      const veiculo: PortalBudgetRequestVehicleInput = {};
      const serial = trimOrUndefined(row.serialNumber);
      if (serial) veiculo.serialNumber = serial;
      const plate = cleanPlate(row.plate ?? "");
      if (plate) veiculo.plate = plate;
      const chassis = cleanChassis(row.chassisNumber ?? "");
      if (chassis) veiculo.chassisNumber = chassis;
      // ⛔ AS MESMAS MEDIDAS EM TODOS OS VEÍCULOS. O formulário guarda uma só
      // (regra 4 do cabeçalho); o servidor grava uma por `Truck`. É aqui, e só
      // aqui, que uma vira N — em cópias independentes.
      const medidas = medidasParaPayload(values.medidas);
      if (medidas) veiculo.medidas = medidas;
      // A MESMA cópia-para-todos das medidas, e pela mesma razão.
      const categoria = trimOrUndefined(values.category ?? undefined);
      if (categoria) veiculo.category = categoria;
      const implemento = trimOrUndefined(values.implementType ?? undefined);
      if (implemento) veiculo.implementType = implemento;
      return veiculo;
    }),
  };

  if (usaNovoCliente && values.novoCliente) {
    const nc = values.novoCliente;
    const novoCliente: PortalNewCustomerInput = { fantasyName: nc.fantasyName.trim() };
    const corporateName = trimOrUndefined(nc.corporateName);
    if (corporateName) novoCliente.corporateName = corporateName;
    const cnpj = onlyDigits(nc.cnpj);
    if (cnpj) novoCliente.cnpj = cnpj;
    const cpf = onlyDigits(nc.cpf);
    if (cpf) novoCliente.cpf = cpf;
    const email = trimOrUndefined(nc.email);
    if (email) novoCliente.email = email;
    const phone = onlyDigits(nc.phone);
    if (phone) novoCliente.phones = [phone];
    const city = trimOrUndefined(nc.city);
    if (city) novoCliente.city = city;
    const state = trimOrUndefined(nc.state);
    if (state) novoCliente.state = state.toUpperCase();
    payload.novoCliente = novoCliente;
  } else if (values.customerId && values.customerId !== NOVO_CLIENTE_VALUE) {
    payload.customerId = values.customerId;
  }

  const logoName = trimOrUndefined(values.logoName);
  if (logoName) payload.logoName = logoName;

  if (values.novaTinta) {
    payload.novaTinta = values.novaTinta;
  } else if (values.paintId && values.paintId !== NOVA_TINTA_VALUE) {
    payload.paintId = values.paintId;
  }

  return payload;
}
