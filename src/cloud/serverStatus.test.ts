import { describe, expect, it } from "vitest";
import { cloudflarePending, EXPECTED_SERVER_VERSION } from "./serverStatus";

describe("lo pendiente en Cloudflare", () => {
  const steps = (s: Parameters<typeof cloudflarePending>[0]) => cloudflarePending(s).map((p) => p.short);

  it("un servidor anterior (no dice su versión) hay que actualizarlo; de R2 aún no se sabe", () => {
    expect(steps(undefined)).toEqual(["actualizar el servidor"]);
  });

  it("uno pegado antes de la versión que necesita la app, también", () => {
    expect(steps({ version: "2026-10-01", docs: true })).toEqual(["actualizar el servidor"]);
  });

  it("al día y sin almacén R2: activarlo", () => {
    expect(steps({ version: EXPECTED_SERVER_VERSION, docs: false })).toEqual(["activar R2"]);
    expect(steps({ version: "2026-09-01", docs: false })).toEqual(["actualizar el servidor", "activar R2"]);
  });

  it("al día y con R2: nada pendiente", () => {
    expect(steps({ version: EXPECTED_SERVER_VERSION, docs: true })).toEqual([]);
    expect(steps({ version: "2027-01-15", docs: true })).toEqual([]);
  });
});
