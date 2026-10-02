import { describe, expect, it } from "vitest";
import {
  defaultMeasureLayout,
  measureLayoutFromSaved,
  measurePayloadOf,
  measureTotalWidthCm,
  measuresWidthError,
} from "./implement-measures";

const side = (widths: number[]) => ({
  height: 2.6,
  sections: widths.map((width, position) => ({ width, isDoor: false, doorHeight: null, position })),
});

describe("medidas do implemento", () => {
  it("comprimento em centímetros", () => {
    expect(measureTotalWidthCm(side([4, 4.5]))).toBe(850);
    expect(measureTotalWidthCm(null)).toBe(0);
  });
  it("lados com até 2 cm de diferença passam", () => {
    expect(measuresWidthError({ left: side([8.5]), right: side([8.51]) })).toBeNull();
  });
  it("lados com mais de 2 cm de diferença são recusados, com os números", () => {
    const error = measuresWidthError({ left: side([8.5]), right: side([8.4]) });
    expect(error).toContain("850 cm");
    expect(error).toContain("840 cm");
  });
  it("sem os dois lados não há o que comparar", () => {
    expect(measuresWidthError({ left: side([8.5]) })).toBeNull();
  });
  it("face gravada vira layout do editor, e o payload não leva o File", () => {
    expect(measureLayoutFromSaved({ sections: [] })).toBeNull();
    const layout = measureLayoutFromSaved({ ...side([3]), photoId: "p1", id: "m1" })!;
    expect(layout.photoId).toBe("p1");
    expect(measurePayloadOf({ ...layout, photoFile: {} as File }, "novo")).toEqual({
      height: 2.6,
      sections: layout.sections,
      photoId: "novo",
    });
    expect(defaultMeasureLayout().sections).toHaveLength(1);
  });
});
