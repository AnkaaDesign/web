import { describe, expect, it } from "vitest";
import { allLiveVehiclesArtApproved } from "./quote-attention";

const approved = { status: "APPROVED" };
const draft = { status: "DRAFT" };

describe("allLiveVehiclesArtApproved", () => {
  it("todo veículo vivo com arte aprovada → true", () => {
    expect(
      allLiveVehiclesArtApproved([
        { status: "PREPARATION", implement: { layouts: [draft, approved] } },
        { status: "PREPARATION", implement: { layouts: [approved] } },
      ]),
    ).toBe(true);
  });
  it("um veículo sem arte aprovada → false", () => {
    expect(
      allLiveVehiclesArtApproved([
        { status: "PREPARATION", implement: { layouts: [approved] } },
        { status: "PREPARATION", implement: { layouts: [draft] } },
      ]),
    ).toBe(false);
  });
  it("veículo sem implemento conta como sem arte", () => {
    expect(allLiveVehiclesArtApproved([{ status: "PREPARATION", implement: null }])).toBe(false);
  });
  it("o veículo cancelado sai da conta", () => {
    expect(
      allLiveVehiclesArtApproved([
        { status: "PREPARATION", implement: { layouts: [approved] } },
        { status: "CANCELLED", implement: { layouts: [] } },
      ]),
    ).toBe(true);
  });
  it("sem resposta (undefined) quando a arte não veio ou não há veículo vivo", () => {
    expect(allLiveVehiclesArtApproved([{ status: "PREPARATION", implement: {} }])).toBeUndefined();
    expect(allLiveVehiclesArtApproved([{ status: "PREPARATION" }])).toBeUndefined();
    expect(allLiveVehiclesArtApproved([])).toBeUndefined();
    expect(allLiveVehiclesArtApproved(undefined)).toBeUndefined();
  });
});
