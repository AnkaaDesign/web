import { describe, it, expect } from "vitest";
import {
  layoutScopeOf,
  layoutFilesForTask,
  sharedLayoutsPayload,
  perVehicleLayoutsPayload,
  layoutsKey,
  persistedLayoutsKey,
} from "./quote-layout-coverage";

// O caso que abriu isto: orçamento 990, Carlotti, dois implementos com o mesmo preço e
// cada um com a sua arte.
const T1 = "task-39088";
const T2 = "task-39089";
const T3 = "task-39090";
const A = "file-layout-a";
const B = "file-layout-b";

const file = (id: string, taskIds?: string[]) =>
  ({ id, quoteLayoutTasks: taskIds?.map((taskId) => ({ taskId })) }) as any;

describe("layoutScopeOf", () => {
  it("é SHARED quando a API não manda a coluna (resposta anterior a ela)", () => {
    expect(layoutScopeOf({ layoutFiles: [] })).toBe("SHARED");
    expect(layoutScopeOf(null)).toBe("SHARED");
  });
  it("lê PER_VEHICLE", () => {
    expect(layoutScopeOf({ layoutScope: "PER_VEHICLE" })).toBe("PER_VEHICLE");
  });
});

describe("layoutFilesForTask", () => {
  it("SHARED: toda arte vale para todo veículo, mesmo com linhas de cobertura", () => {
    const quote = { layoutScope: "SHARED" as const, layoutFiles: [file(A, [T1]), file(B)] };
    expect(layoutFilesForTask(quote, T2).map((f) => f.id)).toEqual([A, B]);
  });
  it("PER_VEHICLE: só as artes que cobrem o veículo", () => {
    const quote = { layoutScope: "PER_VEHICLE" as const, layoutFiles: [file(A, [T1]), file(B, [T2])] };
    expect(layoutFilesForTask(quote, T1).map((f) => f.id)).toEqual([A]);
    expect(layoutFilesForTask(quote, T2).map((f) => f.id)).toEqual([B]);
    expect(layoutFilesForTask(quote, T3)).toEqual([]);
  });
});

describe("perVehicleLayoutsPayload", () => {
  it("uma arte por implemento vira uma entrada por arte com o seu implemento", () => {
    expect(perVehicleLayoutsPayload([T1, T2], { [T1]: [A], [T2]: [B] })).toEqual([
      { fileId: A, taskIds: [T1] },
      { fileId: B, taskIds: [T2] },
    ]);
  });
  it("a mesma arte em todos os implementos cobre todos (taskIds null)", () => {
    expect(perVehicleLayoutsPayload([T1, T2], { [T1]: [A], [T2]: [A] })).toEqual([
      { fileId: A, taskIds: null },
    ]);
  });
  it("ordena as artes pelo primeiro veículo que as cita e mantém a ordem dos veículos", () => {
    expect(perVehicleLayoutsPayload([T1, T2, T3], { [T3]: [A], [T1]: [B], [T2]: [A] })).toEqual([
      { fileId: B, taskIds: [T1] },
      { fileId: A, taskIds: [T2, T3] },
    ]);
  });
  it("veículo sem arte simplesmente não aparece", () => {
    expect(perVehicleLayoutsPayload([T1, T2], { [T1]: [A] })).toEqual([{ fileId: A, taskIds: [T1] }]);
  });
});

describe("layoutsKey / persistedLayoutsKey", () => {
  it("abrir e salvar sem mexer não é troca de arte (PER_VEHICLE)", () => {
    const quote = { layoutScope: "PER_VEHICLE" as const, layoutFiles: [file(B, [T2]), file(A, [T1])] };
    const fromScreen = perVehicleLayoutsPayload([T1, T2], { [T1]: [A], [T2]: [B] });
    expect(layoutsKey(fromScreen, [T1, T2])).toBe(persistedLayoutsKey(quote, [T1, T2]));
  });
  it("abrir e salvar sem mexer não é troca de arte (SHARED)", () => {
    const quote = { layoutScope: "SHARED" as const, layoutFiles: [file(A), file(B)] };
    expect(layoutsKey(sharedLayoutsPayload([B, A]), [T1, T2])).toBe(persistedLayoutsKey(quote, [T1, T2]));
  });
  it("cobrir todos explicitamente é o mesmo que o compartilhado", () => {
    expect(layoutsKey([{ fileId: A, taskIds: [T2, T1] }], [T1, T2])).toBe(
      layoutsKey(sharedLayoutsPayload([A]), [T1, T2]),
    );
  });
  it("trocar a arte de UM implemento é mudança", () => {
    const quote = { layoutScope: "PER_VEHICLE" as const, layoutFiles: [file(A, [T1]), file(B, [T2])] };
    const fromScreen = perVehicleLayoutsPayload([T1, T2], { [T1]: [A], [T2]: [A] });
    expect(layoutsKey(fromScreen, [T1, T2])).not.toBe(persistedLayoutsKey(quote, [T1, T2]));
  });
  it("passar de compartilhado para por veículo é mudança", () => {
    const quote = { layoutScope: "SHARED" as const, layoutFiles: [file(A), file(B)] };
    const fromScreen = perVehicleLayoutsPayload([T1, T2], { [T1]: [A], [T2]: [B] });
    expect(layoutsKey(fromScreen, [T1, T2])).not.toBe(persistedLayoutsKey(quote, [T1, T2]));
  });
});
