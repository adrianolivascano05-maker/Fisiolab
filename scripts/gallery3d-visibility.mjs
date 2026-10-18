// Visibilidad en los fotogramas clave de las figuras 3D con guion: al final de cada paso, ¿se ven (dentro del
// encuadre y sin que nada las tape) las articulaciones que se mueven y las marcas del paso? Con el servidor de
// desarrollo en marcha (npx vite --port 5199). Uso: node scripts/gallery3d-visibility.mjs <salida.json> [región | id1,id2]
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const [out, filter = ""] = process.argv.slice(2);
const port = process.env.PORT ?? "5199";
const b = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const p = await b.newPage({ viewport: { width: 900, height: 700 } });
p.on("pageerror", (e) => console.log("pageerror:", e.message));
await p.goto(`http://localhost:${port}/scripts/gallery3d.html?ids=none`, { waitUntil: "load" });
await p.waitForFunction(() => window.done !== undefined, null, { timeout: 600000 });
const res = await p.evaluate(async ({ filter }) => {
  const { tests } = await import("/src/gallery/data/index.ts");
  const { Stage } = await import("/src/gallery/three/stage.ts");
  const { scenePoses } = await import("/src/gallery/three/scene.ts");
  const { keysOf } = await import("/src/gallery/three/anatomy.ts");
  const { changes, jointName } = await import("/src/gallery/describe.ts");
  const THREE = await import("/node_modules/three/build/three.module.js");
  const ids = filter.includes("-") ? filter.split(",") : null;
  const figs = tests.filter((t) => (ids ? ids.includes(t.id) : !filter || t.region === filter)).flatMap((t) => t.figures.map((f, i) => ({ id: `${t.id}#${i}`, f }))).filter((x) => x.f.script);
  const out = [];
  for (const { id, f } of figs) {
    const host = document.createElement("div");
    host.style.cssText = "position:relative;width:400px;height:300px";
    document.body.append(host);
    const st = new Stage(host, f, id, {});
    const keys = keysOf(f);
    const rc = new THREE.Raycaster();
    rc.camera = st.camera;
    const markObjs = new Set();
    for (const mk of st.scriptMarks ? [...st.scriptMarks.steps.flat(), ...st.scriptMarks.always] : []) mk.group.traverse((o) => markObjs.add(o));
    const isExaminer = (o) => { for (let q = o; q; q = q.parent) if (st.examiner && q === st.examiner.group) return true; return false; };
    // Se ve si alguno de 5 rayos (al centro y a ±6 cm) llega primero a algo a menos de R del punto (su propia
    // piel, o la mano que lo coge); si lo primero que encuentra está más lejos, algo lo tapa.
    const check = (P, R) => {
      const cam = st.camera.position;
      const v = P.clone().project(st.camera);
      const inView = Math.abs(v.x) <= 0.97 && Math.abs(v.y) <= 0.97 && v.z < 1;
      const fwd = P.clone().sub(cam).normalize();
      const up = new st.camera.up.constructor(0, 1, 0);
      const side = fwd.clone().cross(up).normalize();
      const up2 = side.clone().cross(fwd).normalize();
      let by = "?";
      for (const [a, b] of [[0, 0], [6, 0], [-6, 0], [0, 6], [0, -6]]) {
        const T = P.clone().addScaledVector(side, a).addScaledVector(up2, b);
        rc.set(cam, T.clone().sub(cam).normalize());
        rc.far = cam.distanceTo(T) + R;
        const h = rc.intersectObjects(st.scene.children, true).find((x) => x.object.visible && x.object.isMesh && !markObjs.has(x.object));
        if (!h || h.point.distanceTo(T) <= R) { by = null; break; }
        by = isExaminer(h.object) ? "examinador" : "paciente/camilla";
      }
      return { inView, by };
    };
    f.script.steps.forEach((step, s) => {
      const t = st.clock.steps[s].moveTo;
      st.render(t);
      st.scene.updateMatrixWorld(true);
      const { pat } = scenePoses(f, st.layout, st.plan, st.clock.at(t));
      const issues = [];
      for (const c of changes(keys[s].pose, keys[s + 1].pose)) {
        const k = c.joint;
        const P = /^(r|l)_/.test(k) ? pat.pt[k] : k === "neck" || k === "jaw" ? pat.head.p : pat.root.p;
        if (!P) continue;
        const r = check(P.clone(), /pelvis|trunk/.test(k) ? 20 : /hip|shoulder/.test(k) ? 15 : 12);
        if (!r.inView) issues.push(`${jointName(k)} fuera de plano`);
        else if (r.by) issues.push(`${jointName(k)} tapada por ${r.by}`);
      }
      for (const mk of st.scriptMarks?.steps[s] ?? []) {
        if (!mk.group.visible) continue;
        const pts = mk.keep ?? [];
        const bad = pts.map((q) => check(q.clone(), 3)).filter((r) => !r.inView || r.by);
        if (bad.length === pts.length && pts.length) issues.push(`marca «${mk.label || mk.kind}» ${bad[0].inView ? `tapada por ${bad[0].by}` : "fuera de plano"}`);
      }
      out.push({ id, step: s + 1, issues: [...new Set(issues)] });
    });
    st.dispose();
    host.remove();
  }
  return out;
}, { filter });
writeFileSync(out, JSON.stringify(res, null, 1));
const bad = res.filter((r) => r.issues.length);
console.log(`pasos: ${res.length}, con problemas: ${bad.length}`);
for (const r of bad) console.log(`${r.id} paso ${r.step}: ${r.issues.join("; ")}`);
await b.close();
