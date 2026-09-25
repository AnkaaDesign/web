// web/src/components/cliente/solicitacao/solicitacao-schema.test.ts
//
// O QUE ESTE ARQUIVO FIXA são as cinco armadilhas do §5 do contrato, e não a
// forma do formulário. Cada `describe` abaixo corresponde a um defeito que já
// aconteceu ou que o contrato diz que aconteceria:
//
//  · produto cartesiano (série × placa) violando `@unique` global;
//  · série numérica onde o modelo pede TEXTO;
//  · medida convertida duas vezes (centímetro virando centímetro de metro);
//  · chave vazia sobrevivendo num schema que não é `.strict()`;
//  · cliente nascendo sem CNPJ nem CPF e travando a NFS-e.
//
// E, desde a queixa do dono de 20/09, a sexta:
//
//  · MEDIDA POR VEÍCULO onde a medida é do LOTE. Quem pede dez caminhões pede
//    dez do mesmo modelo; digitar os mesmos números dez vezes é trabalho
//    inventado e divergência garantida. O formulário guarda UMA medida e é o
//    construtor do payload que a copia para cada veículo.
import { describe, expect, it } from "vitest";
import {
  medidasIntocadas,
  MEDIDA_PADRAO_ALTURA_CM,
  MEDIDA_PADRAO_LARGURA_CM,
  NOVA_TINTA_VALUE,
  NOVO_CLIENTE_VALUE,
  buildSolicitacaoPayload,
  expandSerialRange,
  medidaLadoDoFormulario,
  medidaLadoParaFormulario,
  novasMedidas,
  novoClienteSchema,
  solicitacaoSchema,
  type MedidaLadoFormData,
  type SolicitacaoFormData,
} from "./solicitacao-schema";

const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";
const UUID_TIPO = "33333333-3333-4333-8333-333333333333";

function linha(over: Partial<SolicitacaoFormData["veiculos"][number]> = {}) {
  return {
    uid: "u1",
    serialNumber: "",
    plate: "",
    chassisNumber: "",
    ...over,
  };
}

/** Um lado em CENTÍMETROS, como o formulário o guarda. */
function lado(over: Partial<MedidaLadoFormData> = {}): MedidaLadoFormData {
  return {
    height: 260,
    sections: [{ width: 780, isDoor: false, position: 0 }],
    ...over,
  };
}

function base(over: Partial<SolicitacaoFormData> = {}): SolicitacaoFormData {
  return {
    customerId: UUID_A,
    novoCliente: null,
    faturarParaCustomerId: UUID_B,
    briefing: "Pintura geral do furgão e aplicação da logomarca nas laterais.",
    logoName: "",
    paintId: null,
    novaTinta: null,
    veiculos: [linha({ serialNumber: "1001", plate: "ABC1D23" })],
    medidas: null,
    ...over,
  } as SolicitacaoFormData;
}

describe("expandSerialRange — a faixa vira LINHAS, nunca um multiplicador", () => {
  it("expande uma faixa em uma série por veículo", () => {
    expect(expandSerialRange("1001 1005").series).toEqual([
      "1001",
      "1002",
      "1003",
      "1004",
      "1005",
    ]);
  });

  it('aceita as formas que as pessoas escrevem: "a", hífen e vírgula', () => {
    expect(expandSerialRange("1001 a 1003").series).toEqual(["1001", "1002", "1003"]);
    expect(expandSerialRange("1001-1003").series).toEqual(["1001", "1002", "1003"]);
    expect(expandSerialRange("1001, 1003").series).toEqual(["1001", "1002", "1003"]);
  });

  it("preserva o zero à esquerda pela largura do maior extremo", () => {
    // Sem isto, "0998 1001" devolveria 998 — uma série que nunca existiu, e que
    // segue dali para o documento assinado e para a nota fiscal.
    expect(expandSerialRange("0998 1001").series).toEqual(["0998", "0999", "1000", "1001"]);
  });

  it("série com letra é TEXTO e não vira intervalo", () => {
    // ⚠️ Contrato §5, armadilha 2: o caminho de faixa do sistema interno só
    // aceita `z.array(z.number())`. O portal precisa de string.
    expect(expandSerialRange("AB-12").series).toEqual(["AB-12"]);
  });

  it("corta a faixa no teto da requisição em vez de gerar milhares de linhas", () => {
    const { series, truncated } = expandSerialRange("1 100000");
    expect(truncated).toBe(true);
    expect(series.length).toBeLessThanOrEqual(60);
  });
});

describe("buildSolicitacaoPayload — o que sai na linha", () => {
  it("manda uma entrada por veículo, com a tupla (série, placa) da PRÓPRIA linha", () => {
    // ⛔ A armadilha 1: três placas com uma série NÃO podem virar três tarefas
    // com a mesma série. Aqui cada linha carrega o seu par.
    const payload = buildSolicitacaoPayload(
      base({
        veiculos: [
          linha({ uid: "a", serialNumber: "1001", plate: "ABC1D23" }),
          linha({ uid: "b", serialNumber: "1002", plate: "XYZ4E56" }),
        ],
      }),
    );
    expect(payload.veiculos).toEqual([
      { serialNumber: "1001", plate: "ABC1D23" },
      { serialNumber: "1002", plate: "XYZ4E56" },
    ]);
  });

  it("OMITE o que está vazio em vez de mandar string vazia", () => {
    // ⚠️ Armadilha 4: nada na API é `.strict()`. Uma placa `""` seria GRAVADA, e
    // `Implement.plate` é `@unique` global — o segundo veículo do lote levaria 400.
    const payload = buildSolicitacaoPayload(
      base({ veiculos: [linha({ serialNumber: "1001" })], logoName: "  " }),
    );
    expect(payload.veiculos[0]).toEqual({ serialNumber: "1001" });
    expect("plate" in payload.veiculos[0]).toBe(false);
    expect("chassisNumber" in payload.veiculos[0]).toBe(false);
    expect("medidas" in payload.veiculos[0]).toBe(false);
    expect("logoName" in payload).toBe(false);
  });

  it("manda as medidas em CENTÍMETROS, sem dividir por 100, NA FORMA DO SERVIDOR", () => {
    // ⚠️ Armadilha 3: quem converte para metros é o SERVIDOR. Dividir aqui
    // também deixaria o implemento com um centímetro.
    //
    // ⛔ E a forma é `{ height, sections: [{ width, isDoor, position }] }`, NÃO
    // um número solto. `portalMedidaLadoSchema` exige `height` e ao menos uma
    // seção; um número onde ele espera objeto é `invalid_type` e 400 na
    // requisição INTEIRA — quem preenchesse qualquer medida não conseguia
    // enviar o formulário.
    const payload = buildSolicitacaoPayload(
      base({
        medidas: {
          esquerda: lado(),
          direita: null,
          traseira: lado({ sections: [{ width: 245, isDoor: false, position: 0 }] }),
        },
      }),
    );
    expect(payload.veiculos[0].medidas).toEqual({
      esquerda: { height: 260, sections: [{ width: 780, isDoor: false, position: 0 }] },
      traseira: { height: 260, sections: [{ width: 245, isDoor: false, position: 0 }] },
    });
  });

  it("DESCARTA o lado sem altura — o servidor recusaria a requisição inteira", () => {
    // `height` é obrigatório em `portalMedidaLadoSchema`. O schema do formulário
    // já acusa isso no campo; esta é a segunda rede, para o caso de o payload
    // ser montado a partir de um estado que não passou pelo resolver.
    const payload = buildSolicitacaoPayload(
      base({
        medidas: {
          esquerda: { height: 0, sections: [{ width: 780, isDoor: false, position: 0 }] },
          direita: null,
          traseira: null,
        },
      }),
    );
    expect("medidas" in payload.veiculos[0]).toBe(false);
  });

  it("DESCARTA o lado sem seção — `portalMedidaLadoSchema` exige ao menos uma", () => {
    const payload = buildSolicitacaoPayload(
      base({ medidas: { esquerda: { height: 260, sections: [] }, direita: null, traseira: null } }),
    );
    expect("medidas" in payload.veiculos[0]).toBe(false);
  });

  it("só a PORTA leva `doorHeight`; a chapa não leva a chave", () => {
    const payload = buildSolicitacaoPayload(
      base({
        medidas: {
          esquerda: lado({
            sections: [
              { width: 300, isDoor: false, position: 0 },
              { width: 120, isDoor: true, doorHeight: 210, position: 1 },
              { width: 360, isDoor: false, doorHeight: null, position: 2 },
            ],
          }),
          direita: null,
          traseira: null,
        },
      }),
    );
    expect(payload.veiculos[0].medidas?.esquerda?.sections).toEqual([
      { width: 300, isDoor: false, position: 0 },
      { width: 120, isDoor: true, doorHeight: 210, position: 1 },
      { width: 360, isDoor: false, position: 2 },
    ]);
  });

  it("REBAIXA a porta sem altura a chapa, em vez de encolher o implemento", () => {
    // `portalSecaoSchema` recusa `isDoor` sem `doorHeight` — 400 na requisição
    // inteira. Descartar a seção custaria 1,20 m de comprimento sem ninguém ver;
    // rebaixá-la perde só a anotação da porta.
    const payload = buildSolicitacaoPayload(
      base({
        medidas: {
          esquerda: lado({
            sections: [
              { width: 300, isDoor: false, position: 0 },
              { width: 120, isDoor: true, doorHeight: null, position: 1 },
            ],
          }),
          direita: null,
          traseira: null,
        },
      }),
    );
    expect(payload.veiculos[0].medidas?.esquerda?.sections).toEqual([
      { width: 300, isDoor: false, position: 0 },
      { width: 120, isDoor: false, position: 1 },
    ]);
  });

  it("limpa placa e chassi antes de enviar", () => {
    const payload = buildSolicitacaoPayload(
      base({
        veiculos: [
          linha({ plate: "abc-1d23", chassisNumber: "9bm979026cs006622" }),
        ],
      }),
    );
    expect(payload.veiculos[0].plate).toBe("ABC1D23");
    expect(payload.veiculos[0].chassisNumber).toBe("9BM979026CS006622");
  });

  it("a sentinela do cliente novo NUNCA vaza como customerId", () => {
    const payload = buildSolicitacaoPayload(
      base({
        customerId: NOVO_CLIENTE_VALUE,
        novoCliente: {
          fantasyName: "Furgões Ideal",
          cnpj: "11.222.333/0001-81",
          cpf: null,
          corporateName: null,
          email: "",
          phone: "",
          city: null,
          state: "",
        },
      }),
    );
    expect(payload.customerId).toBeUndefined();
    expect(payload.novoCliente).toEqual({ fantasyName: "Furgões Ideal", cnpj: "11222333000181" });
  });

  it("a sentinela da tinta nova NUNCA vaza como paintId", () => {
    const payload = buildSolicitacaoPayload(
      base({
        paintId: NOVA_TINTA_VALUE,
        novaTinta: { name: "Azul Frota", hex: "#1F2937", finish: "SOLID", paintTypeId: UUID_TIPO },
      }),
    );
    expect(payload.paintId).toBeUndefined();
    expect(payload.novaTinta?.name).toBe("Azul Frota");
  });
});

describe("as medidas são do LOTE, e não da linha", () => {
  it("TODO veículo recebe a MESMA medida, e nenhum recebe a sua própria", () => {
    // ⛔ A queixa do dono: pedir dez caminhões do mesmo modelo e ter de digitar
    // altura e comprimento dez vezes. A medida é UMA no formulário, e é aqui
    // que ela vira N.
    const payload = buildSolicitacaoPayload(
      base({
        veiculos: [
          linha({ uid: "a", serialNumber: "1001", plate: "ABC1D23" }),
          linha({ uid: "b", serialNumber: "1002", plate: "XYZ4E56" }),
          linha({ uid: "c", serialNumber: "1003", plate: "QRS7H89" }),
        ],
        medidas: { esquerda: lado(), direita: lado(), traseira: null },
      }),
    );
    expect(payload.veiculos).toHaveLength(3);
    for (const veiculo of payload.veiculos) {
      expect(veiculo.medidas).toEqual({
        esquerda: { height: 260, sections: [{ width: 780, isDoor: false, position: 0 }] },
        direita: { height: 260, sections: [{ width: 780, isDoor: false, position: 0 }] },
      });
    }
    // ⚠️ E cada veículo leva uma CÓPIA, não a mesma referência: um objeto
    // compartilhado entre N veículos é a classe de defeito em que alguém
    // normaliza um deles e move os outros junto.
    expect(payload.veiculos[0].medidas).not.toBe(payload.veiculos[1].medidas);
    expect(payload.veiculos[0].medidas?.esquerda).not.toBe(payload.veiculos[1].medidas?.esquerda);
  });

  it("sem medidas, NENHUM veículo carrega a chave", () => {
    // `null` é a resposta legítima "não sei". O que não pode existir é o meio
    // termo: um veículo com medida e o do lado sem.
    const payload = buildSolicitacaoPayload(
      base({
        veiculos: [
          linha({ uid: "a", serialNumber: "1001" }),
          linha({ uid: "b", serialNumber: "1002" }),
        ],
        medidas: null,
      }),
    );
    expect(payload.veiculos.every((v) => !("medidas" in v))).toBe(true);
  });

  it("o veículo não tem mais campo de medida nenhum", () => {
    // Uma chave de medida sobrevivente na linha seria a volta do problema —
    // duas verdades sobre o mesmo implemento, e nada na API é `.strict()`.
    const payload = buildSolicitacaoPayload(
      base({ veiculos: [linha({ serialNumber: "1001" })], medidas: { esquerda: lado() } }),
    );
    expect(Object.keys(payload.veiculos[0]).sort()).toEqual(["medidas", "serialNumber"]);
  });
});

describe("a fronteira de unidade com o ImplementMeasureForm", () => {
  // ⛔ O DEFEITO QUE ESTE BLOCO IMPEDE é a divisão por 100 a mais. Ela não
  // estoura nada: passa em todo zod do caminho, é gravada, e produz um
  // implemento de 7,8 centímetros que só o desenhista descobre, meses depois.
  //
  // São TRÊS unidades: o formulário guarda centímetros, o `ImplementMeasureForm`
  // fala metros nas props, e o banco guarda metros porque o SERVIDOR divide.
  // As duas conversões desta tela têm de se CANCELAR.
  it("ida e volta devolvem exatamente o que entrou", () => {
    const original = lado({
      height: 245,
      sections: [
        // `doorHeight: null` explícito nas chapas: é a forma normalizada que a
        // volta produz, e é o `null` (e não a ausência) que `buildSolicitacaoPayload`
        // sabe descartar.
        { width: 300, isDoor: false, doorHeight: null, position: 0 },
        { width: 120, isDoor: true, doorHeight: 210, position: 1 },
        { width: 360, isDoor: false, doorHeight: null, position: 2 },
      ],
    });
    const emMetros = medidaLadoParaFormulario(original);
    expect(emMetros).toEqual({
      height: 2.45,
      sections: [
        { width: 3, isDoor: false, doorHeight: null, position: 0 },
        { width: 1.2, isDoor: true, doorHeight: 2.1, position: 1 },
        { width: 3.6, isDoor: false, doorHeight: null, position: 2 },
      ],
    });
    expect(medidaLadoDoFormulario(emMetros!)).toEqual(original);
  });

  it("a volta ARREDONDA ao centímetro — ponto flutuante não pode virar medida", () => {
    // Sem o `Math.round`, 2,455 m volta como 245,49999999999997 cm: um número
    // que passa em todo zod, aparece inteiro na tela e nunca é igual ao que
    // entrou.
    expect(medidaLadoDoFormulario({ height: 2.455, sections: [{ width: 7.8 }] })).toEqual({
      height: 246,
      sections: [{ width: 780, isDoor: false, doorHeight: null, position: 0 }],
    });
  });

  it("o padrão do formulário é o MESMO que o componente desenha sozinho", () => {
    // Se divergirem, o primeiro render mostra um número e o estado do
    // formulário guarda outro — e o que viaja é o do formulário.
    const padrao = novasMedidas();
    for (const lado of [padrao.esquerda, padrao.direita, padrao.traseira]) {
      expect(lado).toEqual({
        height: MEDIDA_PADRAO_ALTURA_CM,
        sections: [{ width: MEDIDA_PADRAO_LARGURA_CM, isDoor: false, position: 0 }],
      });
    }
    expect(medidaLadoParaFormulario(padrao.esquerda)?.height).toBe(2);
  });

  it("nada a converter devolve `undefined`, e não um implemento zerado", () => {
    expect(medidaLadoParaFormulario(null)).toBeUndefined();
    expect(medidaLadoParaFormulario(undefined)).toBeUndefined();
  });
});

describe("novoClienteSchema — documento é obrigatório no portal", () => {
  it("recusa cliente sem CNPJ e sem CPF", () => {
    // ⚠️ `customerQuickCreateSchema` (o interno) NÃO tem este refine. O cliente
    // sem documento só revela o problema na NFS-e, quando o serviço já foi feito.
    const result = novoClienteSchema.safeParse({ fantasyName: "Sem Documento" });
    expect(result.success).toBe(false);
  });

  it("aceita com CPF", () => {
    const result = novoClienteSchema.safeParse({
      fantasyName: "João Transportes",
      cpf: "529.982.247-25",
    });
    expect(result.success).toBe(true);
  });
});

describe("solicitacaoSchema — as regras entre campos", () => {
  it("exige cliente existente OU novo", () => {
    const result = solicitacaoSchema.safeParse(base({ customerId: null, novoCliente: null }));
    expect(result.success).toBe(false);
  });

  it("recusa série repetida entre linhas antes de o servidor devolver 400", () => {
    const result = solicitacaoSchema.safeParse(
      base({
        veiculos: [
          linha({ uid: "a", serialNumber: "1001", plate: "ABC1D23" }),
          linha({ uid: "b", serialNumber: "1001", plate: "XYZ4E56" }),
        ],
      }),
    );
    expect(result.success).toBe(false);
  });

  it("recusa placa repetida entre linhas", () => {
    const result = solicitacaoSchema.safeParse(
      base({
        veiculos: [
          linha({ uid: "a", serialNumber: "1001", plate: "ABC1D23" }),
          linha({ uid: "b", serialNumber: "1002", plate: "ABC1D23" }),
        ],
      }),
    );
    expect(result.success).toBe(false);
  });

  it("separa a mensagem de tamanho do chassi da mensagem de letra proibida", () => {
    // I, O e Q são proibidas pela ISO 3779 justamente porque se confundem com 1
    // e 0 — dizer "17 caracteres" a quem digitou um O num chassi que já tem 17
    // não ajuda em nada.
    const curto = solicitacaoSchema.safeParse(
      base({ veiculos: [linha({ chassisNumber: "9BM9790" })] }),
    );
    const comO = solicitacaoSchema.safeParse(
      base({ veiculos: [linha({ chassisNumber: "9BM979O26CS006622" })] }),
    );
    expect(curto.success).toBe(false);
    expect(comO.success).toBe(false);
    const msgCurto = curto.success ? "" : curto.error.issues[0].message;
    const msgComO = comO.success ? "" : comO.error.issues[0].message;
    expect(msgCurto).not.toBe(msgComO);
    expect(msgComO).toMatch(/I, O ou Q/);
  });

  it("aceita a linha que só tem placa, ou só série, ou só chassi", () => {
    expect(solicitacaoSchema.safeParse(base({ veiculos: [linha({ plate: "ABC1D23" })] })).success).toBe(true);
    expect(solicitacaoSchema.safeParse(base({ veiculos: [linha({ serialNumber: "1001" })] })).success).toBe(true);
    expect(
      solicitacaoSchema.safeParse(base({ veiculos: [linha({ chassisNumber: "9BM979026CS006622" })] })).success,
    ).toBe(true);
  });

  it("recusa a linha totalmente em branco", () => {
    expect(solicitacaoSchema.safeParse(base({ veiculos: [linha()] })).success).toBe(false);
  });

  it("aceita a requisição SEM medidas — informar é opcional", () => {
    expect(solicitacaoSchema.safeParse(base({ medidas: null })).success).toBe(true);
  });

  it("aceita os três lados com o padrão do componente", () => {
    expect(solicitacaoSchema.safeParse(base({ medidas: novasMedidas() })).success).toBe(true);
  });

  it("recusa porta sem altura ANTES de o servidor devolver 400", () => {
    // `portalSecaoSchema` refina `!isDoor || doorHeight != null`. Acusar aqui é
    // acusar no campo; deixar passar é 400 na requisição inteira.
    const result = solicitacaoSchema.safeParse(
      base({
        medidas: {
          esquerda: lado({ sections: [{ width: 120, isDoor: true, doorHeight: null, position: 0 }] }),
        },
      }),
    );
    expect(result.success).toBe(false);
  });

  it("recusa porta mais alta que o implemento", () => {
    const result = solicitacaoSchema.safeParse(
      base({
        medidas: {
          esquerda: lado({
            height: 200,
            sections: [{ width: 120, isDoor: true, doorHeight: 260, position: 0 }],
          }),
        },
      }),
    );
    expect(result.success).toBe(false);
  });

  it("recusa no CAMPO o que o servidor recusaria no envio: 10 m de altura, 20 m de largura", () => {
    // Os tetos são os de `portal-request.ts` (`ALTURA_MAXIMA_CM`,
    // `LARGURA_MAXIMA_CM`). Um teto mais frouxo aqui passa por esta borda e é
    // recusado lá, com o formulário inteiro já preenchido.
    expect(
      solicitacaoSchema.safeParse(base({ medidas: { esquerda: lado({ height: 1001 }) } })).success,
    ).toBe(false);
    expect(
      solicitacaoSchema.safeParse(
        base({ medidas: { esquerda: lado({ sections: [{ width: 2001, isDoor: false, position: 0 }] }) } }),
      ).success,
    ).toBe(false);
  });

  it("recusa o lado sem nenhuma seção", () => {
    expect(
      solicitacaoSchema.safeParse(base({ medidas: { esquerda: { height: 260, sections: [] } } }))
        .success,
    ).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// MEDIDA INTOCADA NÃO VIAJA — a contrapartida de ter tirado o interruptor
// ─────────────────────────────────────────────────────────────────────────────
//
// O card das medidas passou a ficar SEMPRE visível (o interruptor escondia
// justamente o campo que a pessoa veio preencher). Mas `ImplementMeasureForm`
// semeia 2,00 × 2,00 m sozinho ao montar — então, sem esta regra, toda
// requisição afirmaria um implemento de dois metros que ninguém mediu.
//
// E medida ERRADA é pior que medida AUSENTE: ausente, o comercial mede na
// entrada do veículo; errada, ele monta o orçamento em cima dela.
describe("medidas no padrão não viram dado", () => {
  it("o padrão intocado NÃO vai no payload", () => {
    const payload = buildSolicitacaoPayload(base({ medidas: novasMedidas() }));
    for (const veiculo of payload.veiculos) expect(veiculo.medidas).toBeUndefined();
    expect(medidasIntocadas(novasMedidas())).toBe(true);
  });

  it("mexer na ALTURA de um lado já faz o conjunto viajar", () => {
    const medidas = novasMedidas();
    medidas.esquerda!.height = 265;
    expect(medidasIntocadas(medidas)).toBe(false);
    const payload = buildSolicitacaoPayload(base({ medidas }));
    expect(payload.veiculos[0]?.medidas?.esquerda?.height).toBe(265);
  });

  it("acrescentar uma seção também conta como mexido", () => {
    const medidas = novasMedidas();
    medidas.traseira!.sections.push({ width: 120, isDoor: true, doorHeight: 200, position: 1 });
    expect(medidasIntocadas(medidas)).toBe(false);
    expect(buildSolicitacaoPayload(base({ medidas })).veiculos[0]?.medidas).toBeDefined();
  });

  it("marcar PORTA na seção padrão conta como mexido", () => {
    const medidas = novasMedidas();
    medidas.direita!.sections[0]!.isDoor = true;
    expect(medidasIntocadas(medidas)).toBe(false);
  });

  it("ausência de medidas continua sendo ausência, não erro", () => {
    expect(medidasIntocadas(null)).toBe(true);
    expect(buildSolicitacaoPayload(base({ medidas: null })).veiculos[0]?.medidas).toBeUndefined();
  });
});
