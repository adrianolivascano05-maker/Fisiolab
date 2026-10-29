import { describe, expect, it } from "vitest";
import { packageDir } from "../../tools/licenses";
import { licenseCounts } from "./LicensesPage";

describe("Licencias de terceros", () => {
  it("cada módulo del build va con su paquete, también los anidados y los de ámbito (@algo/paquete)", () => {
    expect(packageDir("/app/node_modules/react/index.js")).toBe("/app/node_modules/react");
    expect(packageDir("/app/node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_internal.wasm?url")).toBe("/app/node_modules/@mediapipe/tasks-vision");
    expect(packageDir("/app/node_modules/recharts/node_modules/react-is/index.js")).toBe("/app/node_modules/recharts/node_modules/react-is");
    expect(packageDir("\0/app/node_modules/clsx/dist/clsx.mjs?commonjs-proxy")).toBe("/app/node_modules/clsx");
    expect(packageDir("/app/src/main.tsx")).toBeNull();
  });

  it("el resumen cuenta cada licencia, de más a menos", () => {
    expect(licenseCounts([{ license: "ISC" }, { license: "MIT" }, { license: "MIT" }, { license: "Apache-2.0" }])).toBe("2 MIT, 1 Apache-2.0, 1 ISC");
  });
});
