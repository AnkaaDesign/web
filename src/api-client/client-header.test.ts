import { describe, it, expect } from "vitest";
import { CLIENT_HEADER, clientHeaderValue, isClientHeaderEnabled } from "./client-header";

describe("X-Client", () => {
  it("identifica o web e o build", () => {
    expect(CLIENT_HEADER).toBe("X-Client");
    expect(clientHeaderValue()).toMatch(/^web@[0-9a-z]+$/);
  });

  it("fica desligado sem a variável (a API ainda não aceita o cabeçalho no CORS)", () => {
    expect(isClientHeaderEnabled({})).toBe(false);
    expect(isClientHeaderEnabled({ VITE_SEND_X_CLIENT: "0" })).toBe(false);
    expect(isClientHeaderEnabled({ VITE_SEND_X_CLIENT: "" })).toBe(false);
  });

  it("liga com VITE_SEND_X_CLIENT=1", () => {
    expect(isClientHeaderEnabled({ VITE_SEND_X_CLIENT: "1" })).toBe(true);
    expect(isClientHeaderEnabled({ VITE_SEND_X_CLIENT: "true" })).toBe(true);
  });
});
