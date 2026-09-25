import { describe, expect, it } from "vitest";
import { vehicleCombinations, vehicleCombinationCount } from "./vehicle-combinations";

/**
 * O PRODUTO CARTESIANO QUE A CRIAÇÃO DE ORÇAMENTO GRAVA.
 *
 * Duas telas dependem desta função e precisam concordar: o passo 1 conta quantas
 * tarefas vão nascer ("4 tarefas serão criadas") e o submit monta uma carga por
 * combinação. Enquanto a regra viveu duplicada nos dois lugares, um ajuste num
 * deles bastava para o aviso prometer quatro implementos e o servidor gravar três.
 *
 * O N° do Pedido do passo 1 é gravado em TODAS essas tarefas — o cliente compra
 * os quatro num pedido só —, e é por isso que a contagem precisa ser exata: um
 * veículo a mais ou a menos aqui é uma nota fiscal a mais ou a menos citando o
 * pedido do cliente.
 */
describe("vehicleCombinations", () => {
  it("cruza placas × números de série", () => {
    const combos = vehicleCombinations(["ABC1234", "XYZ9876"], [10, 11]);
    expect(combos).toEqual([
      { plate: "ABC1234", serialNumber: "10" },
      { plate: "ABC1234", serialNumber: "11" },
      { plate: "XYZ9876", serialNumber: "10" },
      { plate: "XYZ9876", serialNumber: "11" },
    ]);
  });

  it("só placas: uma tarefa por placa", () => {
    expect(vehicleCombinations(["ABC1234", "XYZ9876"], [])).toEqual([
      { plate: "ABC1234" },
      { plate: "XYZ9876" },
    ]);
  });

  it("só séries: uma tarefa por série", () => {
    expect(vehicleCombinations([], [10, 11, 12])).toEqual([
      { serialNumber: "10" },
      { serialNumber: "11" },
      { serialNumber: "12" },
    ]);
  });

  /**
   * Sem placa e sem série ainda existe UMA tarefa — um orçamento de um implemento
   * que ainda não tem identificação é o começo normal de uma negociação. Devolver
   * lista vazia aqui faria o submit não criar nada, em silêncio.
   */
  it("sem identificação nenhuma: ainda é uma tarefa", () => {
    expect(vehicleCombinations([], [])).toEqual([{}]);
    expect(vehicleCombinations(undefined, undefined)).toEqual([{}]);
  });

  it("descarta entradas em branco em vez de criar um veículo fantasma", () => {
    expect(vehicleCombinations(["ABC1234", "  ", ""], [])).toEqual([{ plate: "ABC1234" }]);
  });

  it("a contagem é a que o passo 1 anuncia", () => {
    expect(vehicleCombinationCount(["A", "B"], [1, 2])).toBe(4);
    expect(vehicleCombinationCount(["A"], [])).toBe(1);
    expect(vehicleCombinationCount([], [])).toBe(1);
  });
});
