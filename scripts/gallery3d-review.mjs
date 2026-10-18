// Datos para la revisión clínica de las figuras 3D con guion: por cada figura, lado, postura, ángulos de
// partida, pasos (quién mueve y qué cambia, con grados), marcas, qué buscar, cámara y supuestos. Lo escribe
// todo a partir de los guiones (src/gallery/data/*.ts), así que no puede contradecir a la animación.
// Uso: node scripts/gallery3d-review.mjs <salida.json>
import { build } from "esbuild";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const out = process.argv[2] ?? "revision.json";
const dir = mkdtempSync(join(tmpdir(), "review-"));
await build({
  stdin: {
    contents: `
export { tests } from "./src/gallery/data";
export { changeText, jointName, sideLabel, stepTechnical } from "./src/gallery/describe";
export { keysOf } from "./src/gallery/three/anatomy";`,
    resolveDir: process.cwd(),
    loader: "ts",
  },
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: join(dir, "r.mjs"),
  logLevel: "error",
});
const M = await import(pathToFileURL(join(dir, "r.mjs")).href);
rmSync(dir, { recursive: true });

const POSTURE = { standing: "de pie", sitting: "sentado", supine: "supino", hooklying: "supino con rodillas flexionadas", longsitting: "sentado con piernas extendidas", prone: "prono", sidelying: "decúbito lateral", quadruped: "cuadrupedia" };
const MARK = { push: "el examinador empuja", pull: "el examinador tira", resist: "el paciente empuja y el examinador lo frena", slide: "la mano se desliza" };
const WHO = { examiner: "Pasivo (examinador)", patient: "Activo (paciente)" };

const cap = (s) => s[0].toUpperCase() + s.slice(1);
const SEG = { thigh: "muslo", shank: "pierna", foot: "pie", upperarm: "brazo", forearm: "antebrazo", hand: "mano", tmj: "ATM" };
const AXIAL = { pelvis: "pelvis", head: "cabeza", thoracic: "columna dorsal", lumbar: "columna lumbar", neck: "cuello", jaw: "mandíbula", trunk: "tronco", shoulder: "hombros" };
/** «r_thigh@0.9» → «muslo derecho (tercio distal)». */
function anchorName(a) {
  const [name, at] = a.split("@");
  const third = at === undefined ? "" : Number(at) < 0.34 ? " (tercio proximal)" : Number(at) < 0.67 ? " (tercio medio)" : " (tercio distal)";
  const m = name.match(/^(r|l)_(\w+)$/);
  if (!m) return (AXIAL[name] ?? name) + third;
  const fem = m[2] === "shank" || m[2] === "hand";
  if (SEG[m[2]]) return `${SEG[m[2]]} ${m[1] === "r" ? (fem ? "derecha" : "derecho") : fem ? "izquierda" : "izquierdo"}${third}`;
  return M.jointName(name) + third;
}
const figures = [];
for (const t of M.tests)
  t.figures.forEach((f, i) => {
    const base = { id: t.id, fig: i, n: t.figures.length, name: t.name, region: t.region, kind: t.kind };
    if (!f.script) return figures.push({ ...base, migrated: false, caption: f.caption ?? "" });
    const keys = M.keysOf(f);
    const start = Object.entries(f.script.start ?? {}).flatMap(([k, j]) =>
      Object.entries(j)
        .filter(([, v]) => Math.abs(v) >= 1)
        .map(([d, v]) => `${cap(M.jointName(k))}: ${M.changeText({ joint: k, dof: d, from: 0, to: v }, false).toLowerCase()}`),
    );
    const steps = f.script.steps.map((st, s) => ({
      who: st.by ? WHO[st.by] : "",
      technical: M.stepTechnical(keys, s),
      text: st.text,
      marks: (st.marks ?? []).map((mk) => `${MARK[mk.kind]}${mk.label ? ` («${mk.label}»)` : ""}${"joint" in mk ? ` · ${M.jointName(mk.joint)}` : mk.at ? ` · ${anchorName(mk.at)}` : ""}`),
      pain: !!st.pain,
    }));
    figures.push({
      ...base,
      migrated: true,
      side: M.sideLabel(f.side ?? "r"),
      posture: POSTURE[f.posture] ?? f.posture,
      start,
      steps,
      setup: f.text?.setup ?? "",
      look: f.text?.look ?? "",
      camera: f.camera ? `manual: desde [${f.camera.from.join(", ")}], zoom ${f.camera.zoom ?? 1}` : "automática",
      supuestos: f.supuestos ?? [],
    });
  });
writeFileSync(out, JSON.stringify(figures, null, 1));
const mig = figures.filter((x) => x.migrated).length;
console.log(`figuras: ${figures.length}, con guion: ${mig}, sin guion: ${figures.length - mig}`);
