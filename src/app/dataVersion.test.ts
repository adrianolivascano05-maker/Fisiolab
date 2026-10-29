// Los cambios con tabla solo despiertan a quien escucha esa tabla (o a quien escucha todo); los cambios sin tabla, a todos.
import { describe, expect, it } from "vitest";
import { bumpData, dataVersion } from "./dataVersion";

describe("versión de los datos por tabla", () => {
  it("sin tablas, todo cambia con todo; con tablas, solo lo suyo y lo que no dice tabla", () => {
    const all0 = dataVersion();
    const staff0 = dataVersion(["members"]);
    const agenda0 = dataVersion(["appointments", "patients"]);
    bumpData("appointments");
    expect(dataVersion()).toBe(all0 + 1);
    expect(dataVersion(["members"])).toBe(staff0);
    expect(dataVersion(["appointments", "patients"])).toBe(agenda0 + 1);
    bumpData();
    expect(dataVersion()).toBe(all0 + 2);
    expect(dataVersion(["members"])).toBe(staff0 + 1);
    expect(dataVersion(["appointments", "patients"])).toBe(agenda0 + 2);
    bumpData("members", "settings");
    expect(dataVersion(["members"])).toBe(staff0 + 2);
    expect(dataVersion(["appointments", "patients"])).toBe(agenda0 + 2);
  });
});
