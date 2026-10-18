// Escena 3D de un test: paciente y examinador como maniquíes, camilla, flechas de fuerza y movimiento,
// zona del síntoma y etiquetas. La cámara se elige sola (la que mejor deja ver las manos, las flechas y el
// síntoma, cerca de la vista que pide la figura) y se puede girar un poco arrastrando (no la vuelta entera).
import {
  AmbientLight,
  BoxGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  NeutralToneMapping,
  Object3D,
  PCFShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  Quaternion,
  Raycaster,
  Scene,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  TorusGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import type { Arrow, FigureSpec } from "../figure";
import { mirrorText, sideLabel, sideLetter } from "../describe";
import { clockOf, extremeU, type Clock, type Key, type Moment } from "../script";
import { keysOf } from "./anatomy";
import { CAMERAS, cameraKey, type CamState } from "./cameras";
import { buildMarks, MARK_COLORS, type BuiltMark } from "./marks";
import { mixFor, planExaminer, stoolOf, type ExaminerPlan } from "./examiner";
import { layoutPatient, patientPose, type Layout, type Table } from "./layout";
import { Person, type Style } from "./person";
import { applyNatural, naturalAt } from "./natural";
import { scenePoses } from "./scene";
import { anatDir, anchorInfo, LYING, sgn, surfaceRadius, surfaceSamples, type Pose3 } from "./rig";

const COLORS = { force: "#1f6f54", move: "#6f675b", pain: "#d43a2a", table: "#c2b08f", tableSide: "#a8987a", tableLeg: "#7c7262", floor: "#efe6d6" };
/** Escena «clean» (por defecto): fondo neutro que contrasta con la piel y la ropa, camilla tapizada en gris pizarra. */
const CLEAN = { bg: "#e9ecef", floor: "#dde1e5", table: "#5b6673", tableSide: "#47505b", tableLeg: "#383e46" };

/**
 * Sombreado de contacto: la piel y la ropa se oscurecen un poco junto a la camilla y el suelo (como la luz
 * que no llega a los apoyos), para que los cuerpos no parezcan flotar. Solo cambia el color.
 */
function contactShade(m: MeshStandardMaterial, table: Table | null) {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTable = { value: table ? [table.x0, table.x1, table.z0, table.z1] : [0, 0, 0, 0] };
    sh.uniforms.uTop = { value: table?.top ?? -1000 };
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vCW;").replace("#include <project_vertex>", "#include <project_vertex>\nvCW = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vCW;\nuniform vec4 uTable;\nuniform float uTop;")
      .replace(
        "#include <opaque_fragment>",
        `float occ = 1.0 - 0.32 * exp(-max(vCW.y, 0.0) / 2.5);
        float inT = step(uTable.x - 2.0, vCW.x) * step(vCW.x, uTable.y + 2.0) * step(uTable.z - 2.0, vCW.z) * step(vCW.z, uTable.w + 2.0);
        occ *= 1.0 - inT * 0.36 * exp(-max(vCW.y - uTop, 0.0) / 2.2);
        outgoingLight *= occ;
        #include <opaque_fragment>`,
      );
  };
  m.customProgramCacheKey = () => "contact";
  m.needsUpdate = true;
}
const FOV = 30;
/** Cuánto se puede girar la vista a cada lado (grados). */
const MAX_TURN = 40;

const rad = (d: number) => (d * Math.PI) / 180;

export function webglAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") ?? c.getContext("webgl"));
  } catch {
    return false;
  }
}

/** Clínico: con flechas, etiquetas y dolor. Natural: el gesto limpio (la misma animación). */
export type StageMode = "clinical" | "natural";

/** Lado explorado de una figura: el que dice, o el de la mayoría de lo que toca y mueve (por defecto, el derecho). */
export function sideOf(spec: FigureSpec): "r" | "l" | "both" {
  if (spec.side) return spec.side;
  const keys = [...(spec.hands ?? []), ...(spec.pain ?? []), ...(spec.arrows ?? []).map((a) => a.at), ...Object.keys(spec.to ?? {}), ...Object.keys(spec.to3d ?? {})];
  const l = keys.filter((k) => k.startsWith("l_")).length;
  const r = keys.filter((k) => k.startsWith("r_")).length;
  return l > r ? "l" : "r";
}

/** Segmento junto al que va la letra del lado (el miembro explorado; en cabeza, cuello o tronco, el hombro de ese lado). */
export function sideSegment(spec: FigureSpec, side: "r" | "l" | "both"): string | null {
  if (side === "both") return null;
  const s = side;
  const all = [...(spec.pain ?? []), ...(spec.hands ?? []), ...Object.keys(spec.script?.steps.reduce((a, st) => ({ ...a, ...st.to }), {}) ?? {})];
  const arm = all.some((a) => a.startsWith(`${s}_`) && /shoulder|upperarm|elbow|forearm|wrist|hand/.test(a));
  const leg = all.some((a) => a.startsWith(`${s}_`) && /hip|thigh|knee|shank|ankle|foot/.test(a));
  return leg && !arm ? `${s}_thigh@0.45` : arm ? `${s}_upperarm@0.5` : `${s}_upperarm@0.05`;
}

export type StageOptions = {
  /** Aspecto: «clean» (maniquí con la ropa de la clínica, luz de tres puntos, sombreado de contacto) o «classic». */
  style?: Style;
  /** Capa natural (respiración, mirada del examinador): por defecto, sí. Nunca cambia los ángulos del paciente. */
  natural?: boolean;
  /** Quien mira ha girado la figura. */
  onRotate?: () => void;
  /** El navegador ha retirado el contexto WebGL (poca memoria): hay que volver al dibujo plano. */
  onLost?: () => void;
  /** Calcular la cámara aunque esté en la tabla (para rehacerla). */
  fresh?: boolean;
};

type ArrowObj = { spec: Exclude<Arrow, { rotate: string }>; group: Group; shaft: Object3D[]; mats: MeshStandardMaterial[]; label?: HTMLSpanElement };
type RotObj = { spec: Extract<Arrow, { rotate: string }>; group: Group; mats: MeshStandardMaterial[]; label?: HTMLSpanElement };

function glowTexture(): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, "rgba(255,255,255,0.95)");
  r.addColorStop(0.35, "rgba(255,255,255,0.55)");
  r.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

export class Stage {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(FOV, 4 / 3, 5, 5000);
  private readonly patient: Person;
  private readonly rim = new DirectionalLight("#ffffff", 0.9);
  private natural: boolean;
  private readonly examiner: Person | null;
  private readonly plan: ExaminerPlan | null;
  private readonly rootQ: Quaternion;
  private readonly layout: Layout;
  private readonly table: Table | null = null;
  private readonly arrows: ArrowObj[] = [];
  private readonly rots: RotObj[] = [];
  private readonly pains: Sprite[] = [];
  private readonly overlay: HTMLDivElement;
  private readonly ro: ResizeObserver | null = null;
  private readonly key = new DirectionalLight("#fff6ea", 2.2);
  private readonly disposables: { dispose(): void }[] = [];
  private view = { center: new Vector3(), dist: 300, az: 0, el: 0 };
  private base = { az: 0, el: 0 };
  private lastT = 0.6;
  private drag: { x: number; y: number; az: number; el: number } | null = null;
  private custom = false;
  private tableGroup: Group | null = null;
  /** Test de la cara (ATM): plano cercano de la cabeza. */
  private readonly faceOnly: boolean;
  /** Reloj de la animación (el del guion o el de siempre). */
  readonly clock: Clock;
  private readonly keys: Key[] | null;
  private scriptMarks: { steps: BuiltMark[][]; always: BuiltMark[] } | null = null;
  private readonly markLabels = new Map<BuiltMark, HTMLSpanElement>();
  private mode: StageMode = "clinical";
  private mirrored = false;
  readonly side: "r" | "l" | "both";
  private sideTag?: HTMLSpanElement;
  private badge!: HTMLDivElement;

  constructor(
    private readonly host: HTMLElement,
    private readonly spec: FigureSpec,
    title: string,
    private readonly opts: StageOptions = {},
  ) {
    const style = opts.style ?? "clean";
    this.natural = opts.natural ?? true;
    this.patient = new Person("patient", style);
    const clean = style === "clean";
    const bg = clean ? CLEAN.bg : getComputedStyle(host).getPropertyValue("--color-bg").trim() || "#fbf7f0";
    this.renderer = new WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: false });
    const r = this.renderer;
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.outputColorSpace = SRGBColorSpace;
    r.toneMapping = NeutralToneMapping;
    r.toneMappingExposure = 1.05;
    r.shadowMap.enabled = true;
    r.shadowMap.type = PCFShadowMap;
    r.setClearColor(new Color(bg));
    const canvas = r.domElement;
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", title);
    canvas.style.cssText = "display:block;width:100%;height:100%;touch-action:pan-y;cursor:grab";
    canvas.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      this.opts.onLost?.();
    });
    host.appendChild(canvas);
    this.overlay = document.createElement("div");
    this.overlay.setAttribute("aria-hidden", "true");
    this.overlay.style.cssText = "position:absolute;inset:0;pointer-events:none;overflow:hidden";
    host.appendChild(this.overlay);

    this.scene.background = new Color(bg);
    this.scene.fog = new Fog(new Color(bg), 400, 900);
    // Luz de tres puntos: principal (con sombra suave), relleno frío del otro lado y contraluz que separa la
    // silueta del fondo; más cielo y suelo.
    this.scene.add(clean ? new HemisphereLight("#ffffff", "#b8b3aa", 1.0) : new HemisphereLight("#ffffff", "#d8c9ae", 1.25), new AmbientLight("#ffffff", clean ? 0.16 : 0.25));
    if (clean) this.key.intensity = 2.5;
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(1024, 1024);
    this.key.shadow.bias = -0.0006;
    this.key.shadow.normalBias = 0.6;
    this.key.shadow.radius = clean ? 7 : 4;
    this.scene.add(this.key, this.key.target);
    const fill = new DirectionalLight(clean ? "#eaf0ff" : "#fff3e2", clean ? 0.6 : 0.55);
    fill.position.set(-200, 120, -150);
    this.scene.add(fill);
    if (clean) this.scene.add(this.rim, this.rim.target);

    const anchors = [...(spec.hands ?? []), ...(spec.pain ?? []), ...(spec.arrows ?? []).map((a) => a.at)];
    this.faceOnly = anchors.length > 0 && anchors.every((a) => /^(jaw|mouth|depressor|[rl]_tmj)$/.test(a));

    // Paciente colocado en el suelo, la camilla o sentado en el borde de la camilla.
    this.layout = layoutPatient(spec);
    this.keys = spec.script ? keysOf(spec) : null;
    this.clock = clockOf(spec, this.keys ?? undefined);
    this.side = sideOf(spec);
    this.rootQ = this.layout.rootQ;
    this.table = this.layout.table;
    if (this.table) this.addTable(this.table, clean);

    this.plan = planExaminer(spec, this.layout);
    this.examiner = this.plan ? new Person("examiner", style) : null;
    if (clean) for (const p of [this.patient, this.examiner]) for (const m of p?.materials() ?? []) contactShade(m, this.table);
    const stool = this.plan ? stoolOf(this.plan) : null;
    if (stool) this.addStool(stool);
    if (spec.prop === "depressor") this.patient.addDepressor();
    this.scene.add(this.patient.group);
    if (this.examiner) this.scene.add(this.examiner.group);

    const floor = new Mesh(new PlaneGeometry(4000, 4000), new MeshStandardMaterial({ color: clean ? CLEAN.floor : COLORS.floor, roughness: 1 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);
    this.disposables.push(floor.geometry, floor.material as MeshStandardMaterial);

    if (spec.script) this.buildScriptMarks();
    else this.buildMarks();
    this.buildSide();
    this.pose(this.stillMoment());
    const cached = opts.fresh ? undefined : CAMERAS[cameraKey(spec)];
    if (cached) {
      const [az, el, cx, cy, cz, dist] = cached;
      this.base = { az, el };
      this.view = { center: new Vector3(cx, cy, cz), dist, az, el };
      this.updateCamera();
    } else this.chooseCamera();
    this.attachPointer(canvas);
    if (typeof ResizeObserver !== "undefined") {
      this.ro = new ResizeObserver(() => this.render(this.lastT));
      this.ro.observe(host);
    }
  }

  private patientPose(m: number, nudge: number): Pose3 {
    return patientPose(this.layout, m, nudge);
  }

  private addTable(t: Table, clean: boolean) {
    const g = new Group();
    const C = clean ? CLEAN : COLORS;
    const top = new Mesh(new BoxGeometry(t.x1 - t.x0, 9, t.z1 - t.z0), new MeshStandardMaterial({ color: C.table, roughness: 0.9 }));
    top.position.set((t.x0 + t.x1) / 2, t.top - 4.5, (t.z0 + t.z1) / 2);
    const base = new Mesh(new BoxGeometry(t.x1 - t.x0 - 4, 4, t.z1 - t.z0 - 4), new MeshStandardMaterial({ color: C.tableSide, roughness: 0.8 }));
    base.position.set(top.position.x, t.top - 11, top.position.z);
    g.add(top, base);
    const legMat = new MeshStandardMaterial({ color: C.tableLeg, roughness: 0.6, metalness: 0.2 });
    for (const x of [t.x0 + 9, t.x1 - 9]) {
      for (const z of [t.z0 + 7, t.z1 - 7]) {
        const leg = new Mesh(new CylinderGeometry(1.8, 1.8, t.top - 13, 10), legMat);
        leg.position.set(x, (t.top - 13) / 2, z);
        g.add(leg);
      }
    }
    g.traverse((o) => {
      if (o instanceof Mesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        this.disposables.push(o.geometry);
      }
    });
    this.disposables.push(top.material as MeshStandardMaterial, base.material as MeshStandardMaterial, legMat);
    this.tableGroup = g;
    this.scene.add(g);
  }

  /** Taburete del examinador cuando explora sentado. */
  private addStool(st: { x: number; z: number; h: number }) {
    const g = new Group();
    const seatMat = new MeshStandardMaterial({ color: "#3b3b3e", roughness: 0.7 });
    const metal = new MeshStandardMaterial({ color: "#a3a19c", roughness: 0.35, metalness: 0.6 });
    const seat = new Mesh(new CylinderGeometry(17, 16, 6, 28), seatMat);
    seat.position.set(st.x, st.h - 3, st.z);
    const pole = new Mesh(new CylinderGeometry(2.2, 2.2, st.h - 8, 12), metal);
    pole.position.set(st.x, (st.h - 6) / 2 + 1, st.z);
    g.add(seat, pole);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const leg = new Mesh(new BoxGeometry(2.2, 2, 26), metal);
      leg.position.set(st.x + Math.sin(a) * 12, 2, st.z + Math.cos(a) * 12);
      leg.rotation.y = a;
      g.add(leg);
    }
    g.traverse((o) => {
      if (o instanceof Mesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        this.disposables.push(o.geometry);
      }
    });
    this.disposables.push(seatMat, metal);
    this.scene.add(g);
  }

  /** Etiqueta sobre la escena; con `color`, una franja del color de su marca para saber de cuál es. */
  private label(text?: string, color?: string) {
    if (!text) return undefined;
    const s = document.createElement("span");
    s.textContent = text;
    s.dataset.text = text;
    s.style.cssText =
      "position:absolute;left:0;top:0;transform:translate(-50%,-50%);padding:1px 7px;border-radius:10px;font:600 11.5px/1.4 var(--font-sans,system-ui);letter-spacing:.01em;width:max-content;max-width:min(230px,58%);background:color-mix(in srgb,var(--color-bg,#fbf7f0) 90%,transparent);color:var(--color-text,#1b1b1d);box-shadow:0 0 0 1px var(--color-border,#dacbb0)" +
      (color ? `;border-left:5px solid ${color};border-radius:6px 10px 10px 6px` : "");
    this.overlay.appendChild(s);
    return s;
  }

  /** Marcas de una figura con guion: recorrido de cada paso, empujes y resistencias. */
  private buildScriptMarks() {
    const built = buildMarks(this.spec, this.layout);
    this.disposables.push(...built.geos);
    for (const mk of [...built.steps.flat(), ...built.always]) {
      this.disposables.push(...mk.mats);
      mk.group.visible = false;
      for (const c of mk.group.children) c.renderOrder = 5;
      this.scene.add(mk.group);
      const color = mk.kind === "push" || mk.kind === "pull" ? MARK_COLORS.push : mk.kind === "resist" ? MARK_COLORS.resist : MARK_COLORS.path;
      const l = this.label(mk.label, color);
      if (l) this.markLabels.set(mk, l);
    }
    this.scriptMarks = { steps: built.steps, always: built.always };
    if (this.spec.pain?.length) {
      const tex = glowTexture();
      this.disposables.push(tex);
      for (const _ of this.spec.pain) {
        const m = new SpriteMaterial({ map: tex, color: COLORS.pain, transparent: true, depthTest: false, depthWrite: false });
        const s = new Sprite(m);
        s.renderOrder = 20;
        this.disposables.push(m);
        this.scene.add(s);
        this.pains.push(s);
      }
    }
  }

  /** Lado explorado: rótulo fijo en una esquina y letra junto al miembro explorado (en modo clínico). */
  private buildSide() {
    const b = document.createElement("div");
    b.style.cssText =
      "position:absolute;right:8px;top:8px;display:flex;align-items:center;gap:6px;padding:2px 9px 2px 3px;border-radius:999px;font:600 12px/1.6 var(--font-sans,system-ui);background:color-mix(in srgb,var(--color-bg,#fbf7f0) 92%,transparent);color:var(--color-text,#1b1b1d);box-shadow:0 0 0 1px var(--color-border,#dacbb0)";
    this.badge = b;
    this.overlay.appendChild(b);
    if (this.side !== "both") {
      const t = this.label(sideLetter(this.side));
      if (t) {
        t.style.font = "700 12px/1 var(--font-sans,system-ui)";
        t.style.padding = "4px 6px";
        t.style.background = "#1b1b1d";
        t.style.color = "#fff";
        t.style.boxShadow = "0 0 0 2px #fff";
        this.sideTag = t;
      }
    }
    this.updateSideTexts();
  }

  private updateSideTexts() {
    const side = this.side === "both" ? "both" : this.mirrored ? (this.side === "r" ? "l" : "r") : this.side;
    this.badge.innerHTML = "";
    const dot = document.createElement("span");
    dot.textContent = sideLetter(side);
    dot.style.cssText = "display:inline-flex;align-items:center;justify-content:center;min-width:22px;height:22px;padding:0 4px;border-radius:999px;background:#1b1b1d;color:#fff;font-size:11.5px";
    const txt = document.createElement("span");
    txt.textContent = sideLabel(side);
    this.badge.append(dot, txt);
    if (this.sideTag) this.sideTag.textContent = sideLetter(side);
    for (const l of this.markLabels.values()) l.textContent = this.mirrored ? mirrorText(l.dataset.text ?? "") : (l.dataset.text ?? "");
  }

  /** Punto del miembro explorado junto al que va la letra D o I. */
  private sideAnchor(pat: Pose3): Vector3 | null {
    const seg = sideSegment(this.spec, this.side);
    if (!seg || this.side === "both") return null;
    const s = this.side;
    const info = anchorInfo(pat, seg);
    if (!info) return null;
    const out = new Vector3(sgn(s), 0, 0).applyQuaternion(pat.trunkQ);
    return info.p.clone().addScaledVector(out, surfaceRadius(info, out) + 7);
  }

  /** Instante que enseña la maniobra en una imagen fija: la pose más alejada de la partida, con sus marcas. */
  private stillMoment(): Moment {
    if (!this.keys) return { m: 1, mix: 1, reach: 1, arrows: 1, pain: 1, pulse: 0.5, step: 0, markStep: 0, phase: "look" };
    const S = this.keys.length - 1;
    const u = extremeU(this.keys);
    const step = Math.max(0, Math.round(u * S) - 1);
    return { m: u, mix: 1, reach: 1, arrows: 1, pain: 1, pulse: 0.5, step, markStep: step, phase: "look" };
  }

  /** Capa natural (respiración, mirada): activada o no. No cambia ningún ángulo del paciente. */
  setNatural(on: boolean) {
    this.natural = on;
    this.render(this.lastT);
  }

  /** Modo clínico (ayudas visibles) o natural (el gesto limpio). */
  setMode(mode: StageMode) {
    this.mode = mode;
    this.render(this.lastT);
  }

  /** El mismo test en el otro lado: la imagen en espejo (exacto: no cambia ningún ángulo). */
  setMirror(on: boolean) {
    this.mirrored = on;
    this.renderer.domElement.style.transform = on ? "scaleX(-1)" : "";
    this.updateSideTexts();
    this.render(this.lastT);
  }

  private buildMarks() {
    const mk = (color: string, xray: boolean) => {
      const m = new MeshStandardMaterial({ color, emissive: new Color(color).multiplyScalar(0.35), roughness: 0.45, transparent: true, opacity: xray ? 0.28 : 1, depthTest: !xray, depthWrite: !xray });
      this.disposables.push(m);
      return m;
    };
    const geo = { shaft: new CylinderGeometry(0.8, 0.8, 1, 12), head: new ConeGeometry(2.4, 6, 18), dash: new CylinderGeometry(0.65, 0.65, 1, 10) };
    this.disposables.push(geo.shaft, geo.head, geo.dash);
    for (const ar of this.spec.arrows ?? []) {
      if ("rotate" in ar) {
        const group = new Group();
        const mats = [mk(COLORS.force, false), mk(COLORS.force, true)];
        for (const mat of mats) {
          const torus = new Mesh(new TorusGeometry(1, 0.07, 8, 48, Math.PI * 1.45), mat);
          const head = new Mesh(new ConeGeometry(0.24, 0.55, 16), mat);
          // Punta al final del arco, tangente a él.
          const a = Math.PI * 1.45;
          head.position.set(Math.cos(a), Math.sin(a), 0);
          head.rotation.z = a;
          torus.renderOrder = head.renderOrder = mat.depthTest ? 0 : 10;
          group.add(torus, head);
          this.disposables.push(torus.geometry, head.geometry);
        }
        this.scene.add(group);
        this.rots.push({ spec: ar, group, mats, label: this.label(ar.label) });
        continue;
      }
      const kind = ar.kind ?? "force";
      const color = kind === "force" ? COLORS.force : COLORS.move;
      const group = new Group();
      const mats = [mk(color, false), mk(color, true)];
      const shaft: Object3D[] = [];
      for (const mat of mats) {
        if (kind === "force") {
          const s = new Mesh(geo.shaft, mat);
          shaft.push(s);
          group.add(s);
        } else {
          for (let i = 0; i < 3; i++) {
            const s = new Mesh(geo.dash, mat);
            s.userData.dash = i;
            shaft.push(s);
            group.add(s);
          }
        }
        group.add(new Mesh(geo.head, mat));
      }
      // La copia «en transparencia» (se ve aunque la tape el cuerpo) se dibuja al final.
      for (const c of group.children) if (!((c as Mesh).material as MeshStandardMaterial).depthTest) c.renderOrder = 10;
      this.scene.add(group);
      this.arrows.push({ spec: ar, group, shaft, mats, label: this.label(ar.label) });
    }
    if (this.spec.pain?.length) {
      const tex = glowTexture();
      this.disposables.push(tex);
      for (const _ of this.spec.pain) {
        const m = new SpriteMaterial({ map: tex, color: COLORS.pain, transparent: true, depthTest: false, depthWrite: false });
        const s = new Sprite(m);
        s.renderOrder = 20;
        this.disposables.push(m);
        this.scene.add(s);
        this.pains.push(s);
      }
    }
  }

  private showMark(mk: BuiltMark, vis: number, pat: Pose3, ctsAt: Vector3[], toCam: Vector3, pulse: number) {
    mk.group.visible = vis > 0.01;
    mk.mats[0]!.opacity = vis;
    mk.mats[1]!.opacity = vis;
    if (mk.group.visible && mk.update) mk.update(pat, ctsAt, toCam, pulse);
    const l = this.markLabels.get(mk);
    if (l) this.place(l, mk.labelAt, vis);
  }

  /** Coloca todo en el instante dado. */
  private pose(tl: Moment, sec = 0) {
    const spec = this.spec;
    const { m, reach, arrows, pain, pulse } = tl;
    const clinical = this.mode === "clinical";
    const { pat, ex, cts } = scenePoses(spec, this.layout, this.plan, tl);
    // Capa natural: solo la piel, los dedos libres y la mirada del examinador (los ángulos del paciente, iguales).
    const nat = this.natural ? naturalAt(sec) : null;
    const shown = nat ? applyNatural(pat, ex, sec, cts.map((c) => c.p)) : { pat, ex };
    this.patient.apply(shown.pat, nat?.breath.patient ?? 0);
    if (shown.ex && this.examiner) this.examiner.apply(shown.ex, nat?.breath.examiner ?? 0);
    const toCam = this.camera.position.clone().sub(this.view.center).normalize();
    void m;

    if (this.sideTag) {
      const at = clinical ? this.sideAnchor(pat) : null;
      // La letra solo si se ve el miembro (no flotando sobre el examinador que lo tapa).
      if (at && this.examiner) {
        const cam = this.camera.position;
        const to = at.clone().sub(cam);
        const ray = new Raycaster(cam.clone(), to.clone().normalize(), 0, to.length() - 6);
        this.scene.updateMatrixWorld();
        if (ray.intersectObject(this.examiner.group, true).length) this.sideTag.style.opacity = "0";
        else this.place(this.sideTag, at, 1);
      } else if (at) this.place(this.sideTag, at, 1);
      else this.sideTag.style.opacity = "0";
    }
    if (this.scriptMarks) {
      const ctsAt = cts.map((c) => c.p);
      this.scriptMarks.steps.forEach((ms, i) => {
        for (const mk of ms) this.showMark(mk, clinical && i === tl.markStep ? arrows : 0, pat, ctsAt, toCam, pulse);
      });
      const during = tl.phase === "move" || tl.phase === "look" ? Math.min(1, reach) : 0;
      for (const mk of this.scriptMarks.always) this.showMark(mk, clinical ? during : 0, pat, ctsAt, toCam, pulse);
      (spec.pain ?? []).forEach((a, i) => {
        const s = this.pains[i]!;
        const info = anchorInfo(pat, a);
        s.visible = clinical && pain > 0.01 && !!info;
        if (!info) return;
        s.position.copy(info.p);
        s.scale.setScalar((17 + 5 * pulse) * (this.faceOnly ? 0.45 : 1));
        (s.material as SpriteMaterial).opacity = 0.85 * pain;
      });
      return;
    }

    for (const a of this.arrows) {
      const info = anchorInfo(pat, a.spec.at);
      a.group.visible = clinical && arrows > 0.01 && !!info;
      if (!info) {
        if (a.label) a.label.style.opacity = "0";
        continue;
      }
      const d = anatDir(pat, a.spec.dir, a.spec.at, info);
      const kind = a.spec.kind ?? "force";
      const len = (a.spec.len ?? 22) * 0.75;
      const push = kind === "force" ? (pulse - 0.5) * 2.2 : 0;
      let tip: Vector3;
      let tail: Vector3;
      if (kind === "force") {
        const out = d.clone().negate();
        tip = info.p.clone().addScaledVector(out, surfaceRadius(info, out) + 1.2 - push);
        tail = tip.clone().addScaledVector(d, -len);
      } else {
        tail = info.p.clone().addScaledVector(d, surfaceRadius(info, d) + 2);
        tip = tail.clone().addScaledVector(d, len);
      }
      // Si hay una mano en ese mismo punto, la flecha va al lado para que no la tape.
      if (cts.some((c) => c.anchor === a.spec.at || c.p.distanceTo(tip) < 6)) {
        const side = toCam.clone().addScaledVector(d, -toCam.dot(d));
        if (side.lengthSq() < 1e-3) side.set(0, 1, 0).addScaledVector(d, -d.y);
        side.normalize().multiplyScalar(7);
        tip.add(side);
        tail.add(side);
      }
      const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), d);
      const headLen = 6;
      const shaftEnd = tip.clone().addScaledVector(d, -headLen);
      const shaftLen = Math.max(1, tail.distanceTo(shaftEnd));
      for (const s of a.shaft) {
        s.quaternion.copy(q);
        if (kind === "force") {
          s.scale.set(1, shaftLen, 1);
          s.position.copy(tail).lerp(shaftEnd, 0.5);
        } else {
          const i = s.userData.dash as number;
          const seg = shaftLen / 3;
          s.scale.set(1, seg * 0.6, 1);
          s.position.copy(tail).addScaledVector(d, seg * (i + 0.3));
        }
      }
      for (const c of a.group.children) {
        if ((c as Mesh).geometry instanceof ConeGeometry) {
          c.quaternion.copy(q);
          c.position.copy(tip).addScaledVector(d, -headLen / 2);
        }
      }
      a.mats[0]!.opacity = arrows;
      a.mats[1]!.opacity = 0.28 * arrows;
      if (a.label) this.place(a.label, kind === "force" ? tail.clone().addScaledVector(d, -4) : tip.clone().addScaledVector(d, 4), clinical ? arrows : 0);
    }

    for (const r of this.rots) {
      const info = anchorInfo(pat, r.spec.at);
      r.group.visible = clinical && arrows > 0.01 && !!info;
      if (!info) {
        if (r.label) r.label.style.opacity = "0";
        continue;
      }
      // El arco rodea el eje del segmento; gira como en el dibujo visto desde la cámara.
      let axis = info.axis.clone();
      if (axis.dot(toCam) < 0) axis.negate();
      // De canto no se ve: se inclina hacia la cámara hasta verse como una elipse.
      if (axis.dot(toCam) < 0.6) {
        const perp = axis.clone().addScaledVector(toCam, -axis.dot(toCam)).normalize();
        axis = toCam.clone().multiplyScalar(0.6).addScaledVector(perp, 0.8).normalize();
      }
      const radius = Math.max(info.sec.xp, info.sec.xn, info.sec.zp, info.sec.zn) + 4.5;
      const q = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), axis);
      if (r.spec.rotate === "cw") q.multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI));
      r.group.quaternion.copy(q);
      r.group.position.copy(info.p);
      r.group.scale.setScalar(radius);
      r.mats[0]!.opacity = arrows;
      r.mats[1]!.opacity = 0.28 * arrows;
      if (r.label) this.place(r.label, info.p.clone().add(new Vector3(0, radius + 5, 0)), clinical ? arrows : 0);
    }

    (spec.pain ?? []).forEach((a, i) => {
      const s = this.pains[i]!;
      const info = anchorInfo(pat, a);
      s.visible = clinical && pain > 0.01 && !!info;
      if (!info) return;
      s.position.copy(info.p);
      s.scale.setScalar((17 + 5 * pulse) * (this.faceOnly ? 0.45 : 1));
      (s.material as SpriteMaterial).opacity = 0.85 * pain;
    });
  }

  private place(el: HTMLSpanElement, p: Vector3, opacity: number) {
    el.dataset.x = String(p.x);
    el.dataset.y = String(p.y);
    el.dataset.z = String(p.z);
    el.style.opacity = String(opacity);
  }

  private layoutLabels() {
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    const v = new Vector3();
    const placed: { x: number; y: number; hw: number; hh: number }[] = [];
    // El rótulo del lado, arriba a la derecha, tampoco se pisa; ni la punta y la mitad de las flechas que se ven.
    if (this.badge.offsetWidth) placed.push({ x: w - 8 - this.badge.offsetWidth / 2, y: 8 + this.badge.offsetHeight / 2, hw: this.badge.offsetWidth / 2 + 3, hh: this.badge.offsetHeight / 2 + 2 });
    for (const mk of this.scriptMarks ? [...this.scriptMarks.steps.flat(), ...this.scriptMarks.always] : []) {
      if (!mk.group.visible) continue;
      for (const k of mk.keep ?? []) {
        v.copy(k).project(this.camera);
        placed.push({ x: ((this.mirrored ? 1 - v.x : v.x + 1) / 2) * w, y: ((1 - v.y) / 2) * h, hw: 9, hh: 9 });
      }
    }
    for (const el of this.overlay.children as HTMLCollectionOf<HTMLSpanElement>) {
      if (el === this.badge) continue;
      if (el.dataset.x === undefined || el.style.opacity === "0") {
        el.style.visibility = "hidden";
        continue;
      }
      v.set(Number(el.dataset.x), Number(el.dataset.y), Number(el.dataset.z)).project(this.camera);
      const hw = el.offsetWidth / 2 + 3;
      const hh = el.offsetHeight / 2 + 1;
      let x = Math.min(w - hw, Math.max(hw, ((this.mirrored ? 1 - v.x : v.x + 1) / 2) * w));
      let y = Math.min(h - hh - 2, Math.max(hh + 2, ((1 - v.y) / 2) * h));
      // Si se pisa con otra etiqueta, se aparta en vertical.
      for (let k = 0; k < 6; k++) {
        const o = placed.find((q) => Math.abs(q.x - x) < q.hw + hw && Math.abs(q.y - y) < q.hh + hh);
        if (!o) break;
        const down = y >= o.y ? 1 : -1;
        y = o.y + down * (o.hh + hh + 1);
        if (y > h - hh - 2 || y < hh + 2) {
          y = o.y - down * (o.hh + hh + 1);
          x = Math.min(w - hw, Math.max(hw, x));
        }
      }
      placed.push({ x, y, hw, hh });
      el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
      el.style.visibility = v.z > 1 ? "hidden" : "visible";
    }
  }

  // ---------- Cámara ----------

  private focusPoints(): { p: Vector3; w: number; allow: string[] }[] {
    const spec = this.spec;
    const { pat, cts } = scenePoses(spec, this.layout, this.plan, this.stillMoment());
    const pts: { p: Vector3; w: number; allow: string[] }[] = [];
    for (const c of cts) pts.push({ p: c.p, w: 1, allow: [`p:${c.part}`, "e:r_hand", "e:l_hand"] });
    for (const a of spec.pain ?? []) {
      const i = anchorInfo(pat, a);
      if (i) pts.push({ p: i.p, w: 1.2, allow: [`p:${i.part}`] });
    }
    for (const a of spec.arrows ?? []) {
      const i = anchorInfo(pat, a.at);
      if (i) pts.push({ p: i.p, w: 0.8, allow: [`p:${i.part}`] });
    }
    // Lo que se mueve.
    const p0 = this.patientPose(0, 0);
    for (const k of Object.keys(pat.pt)) {
      if (pat.pt[k]!.distanceTo(p0.pt[k]!) > 4) pts.push({ p: pat.pt[k]!, w: 0.6, allow: [] });
    }
    return pts;
  }

  /** Dirección preferida: la de la figura plana, un poco girada para que se vea el volumen. */
  private preferred(): { az: number; el: number } {
    const spec = this.spec;
    const near = spec.near ?? (this.side === "l" ? "l" : "r");
    const local = spec.view === "side" ? new Vector3(near === "l" ? 1 : -1, 0, 0) : new Vector3(0, 0, 1);
    const d = local.applyQuaternion(this.rootQ);
    const lying = LYING.includes(spec.posture);
    const fromTop = d.y > 0.7;
    const turn = (v: Vector3, deg: number) => v.clone().applyAxisAngle(new Vector3(0, 1, 0), rad(deg));
    let h = new Vector3(d.x, 0, d.z);
    if (fromTop) h = new Vector3(0, 0, 1).applyQuaternion(this.rootQ).setY(0);
    if (h.lengthSq() < 1e-3) h = new Vector3(0, 0, 1);
    h.normalize();
    let el: number;
    if (fromTop) {
      el = 62;
      h = turn(h, 0);
    } else if (lying) {
      el = 30;
      h = turn(h, spec.view === "side" ? 18 : -18);
    } else {
      el = 12;
      // La cara se ve mejor de tres cuartos por delante.
      const t = this.faceOnly ? 58 : 28;
      h = turn(h, spec.view === "side" ? (near === "l" ? -t : t) : this.side === "l" ? -24 : 24);
    }
    return { az: Math.atan2(h.x, h.z), el: rad(el) };
  }

  private dirOf(az: number, el: number) {
    return new Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
  }

  private chooseCamera() {
    const pref = this.preferred();
    const focus = this.focusPoints();
    const fp = this.framePoints();
    // Cámara fijada a mano en la figura (acimut desde delante del paciente, + hacia su derecha).
    if (this.spec.camera) {
      const c = this.spec.camera;
      const d = new Vector3(...c.from).normalize().applyQuaternion(this.rootQ);
      const az = Math.atan2(d.x, d.z);
      const el = Math.asin(Math.max(-0.2, Math.min(0.95, d.y)));
      const fit = this.fit(this.dirOf(az, el), fp);
      this.base = { az, el };
      this.view = { center: fit.center, dist: fit.dist / (c.zoom ?? 1), az, el };
      this.updateCamera();
      return;
    }
    // Lado explorado: mejor verlo desde su lado (que el miembro sano no quede delante).
    const lat = this.side === "both" ? null : new Vector3(sgn(this.side), 0, 0).applyQuaternion(this.rootQ).setY(0);
    if (lat && lat.lengthSq() > 0.05) lat.normalize();
    // Flechas: el recorrido debe verse largo (no de punta) y las rectas, de lado.
    const marks = this.scriptMarks ? [...this.scriptMarks.steps.flat(), ...this.scriptMarks.always] : [];
    const pat1 = this.patientPose(this.stillMoment().m, 1);
    const paths = marks.filter((mk) => mk.path).map((mk) => mk.path!.pts);
    const straights = marks.filter((mk) => mk.dir).map((mk) => mk.dir!(pat1));
    const meshes: Mesh[] = [];
    const who = new Map<Object3D, string>();
    for (const [o, part] of this.patient.parts) who.set(o, `p:${part}`);
    if (this.examiner) for (const [o, part] of this.examiner.parts) who.set(o, `e:${part}`);
    for (const o of who.keys()) if (o instanceof Mesh) meshes.push(o);
    this.tableGroup?.traverse((o) => {
      if (o instanceof Mesh) {
        meshes.push(o);
        who.set(o, "table");
      }
    });
    this.scene.updateMatrixWorld(true);
    // Además de los puntos clave, la superficie del paciente alrededor (que el examinador no la tape).
    const near = surfaceSamples(this.patientPose(1, 1)).filter((x) => focus.some((f) => f.w >= 1 && f.p.distanceTo(x.p) < 28));
    const stride = Math.max(1, Math.ceil(near.length / 28));
    const area = near.filter((_, i) => i % stride === 0).map((x) => ({ p: x.p, n: x.n, w: 1.6 / Math.max(1, Math.ceil(near.length / stride)), allow: [`p:${x.part}`] }));
    const pts: { p: Vector3; w: number; allow: string[]; n?: Vector3 | null }[] = [...focus, ...area];
    // Las flechas tampoco pueden quedar tapadas.
    for (const mk of this.scriptMarks ? [...this.scriptMarks.steps.flat(), ...this.scriptMarks.always] : []) {
      const ps = mk.path ? mk.path.pts.filter((_, i, a) => i % Math.max(1, Math.floor(a.length / 5)) === 0) : [];
      for (const p of ps) pts.push({ p, w: 0.7 / Math.max(1, ps.length / 3), allow: [] });
    }
    // De qué lado está el examinador: la cámara prefiere no ponerse a su espalda.
    const exDir = this.plan ? new Vector3(-Math.sin(this.plan.yaw), 0, -Math.cos(this.plan.yaw)) : null;
    const prefDir = this.dirOf(pref.az, pref.el);
    // El lado contrario enseña el mismo plano del movimiento (perfil izquierdo en vez de derecho).
    const planeN = new Vector3(this.spec.view === "side" ? 1 : 0, 0, this.spec.view === "side" ? 0 : 1).applyQuaternion(this.rootQ);
    const mirror = Math.abs(planeN.y) < 0.5 ? prefDir.clone().addScaledVector(planeN.setY(0).normalize(), -2 * prefDir.dot(planeN)) : null;
    const mirrorCost = this.spec.view === "side" ? 0.4 : 3.2;
    const sitFwd = this.spec.posture === "sitting" ? new Vector3(0, 0, 1).applyQuaternion(this.rootQ).setY(0).normalize() : null;
    const cranial = LYING.includes(this.spec.posture) ? new Vector3(0, 1, 0).applyQuaternion(this.rootQ).setY(0) : null;
    const exFinal = scenePoses(this.spec, this.layout, this.plan, { m: 1, reach: 1, arrows: 1 }).ex;
    const exBody = exFinal ? surfaceSamples(exFinal, (part) => part === "torso" || part === "head").map((x) => x.p) : [];
    const clutter = exBody.map((p) => ({ p, w: 8 / exBody.length }));
    if (this.table && this.spec.posture === "sitting") {
      const t = this.table;
      const top: Vector3[] = [];
      for (let i = 0; i <= 6; i++) for (let j = 0; j <= 3; j++) for (const y of [t.top, t.top * 0.55, t.top * 0.1]) top.push(new Vector3(t.x0 + ((t.x1 - t.x0) * i) / 6, y, t.z0 + ((t.z1 - t.z0) * j) / 3));
      clutter.push(...top.map((p) => ({ p, w: 5 / top.length })));
    }
    const ray = new Raycaster();
    let best = { cost: Infinity, az: pref.az, el: pref.el, fit: this.fit(prefDir, fp) };
    for (let daz = -165; daz <= 180; daz += 15) {
      for (const elDeg of [8, 18, 30, 42, 56]) {
        const az = pref.az + rad(daz);
        const el = rad(elDeg);
        const dir = this.dirOf(az, el);
        const deg = (v: Vector3) => Math.acos(Math.min(1, dir.dot(v))) * (180 / Math.PI);
        const angle = mirror ? Math.min(deg(prefDir), deg(mirror) + mirrorCost / 0.035) : deg(prefDir);
        let cost = angle * 0.035;
        if (exDir) cost += 6 * Math.max(0, dir.dot(exDir)) ** 2;
        if (lat && lat.lengthSq() > 0.5) cost += 4 * Math.max(0, -dir.dot(lat)) ** 2;
        for (const pts of paths) {
          // Lo que se ve del recorrido: su largo proyectado en la imagen frente al real.
          let real = 0;
          let seen = 0;
          for (let i = 1; i < pts.length; i++) {
            const d = pts[i]!.clone().sub(pts[i - 1]!);
            real += d.length();
            seen += d.addScaledVector(dir, -d.dot(dir)).length();
          }
          if (real > 0) cost += 5 * (1 - seen / real) ** 2;
        }
        for (const d of straights) cost += 1.5 * dir.dot(d) ** 2;
        // Sentado en el borde de la camilla: desde delante o desde un lado, nunca por detrás de la camilla.
        if (sitFwd && dir.dot(sitFwd) < -0.05) cost += 6;
        if (cost >= best.cost) continue;
        // Tumbado: mejor no mirarlo desde la cabeza (se vería del revés).
        if (cranial) cost += 3 * Math.max(0, dir.dot(cranial)) ** 2;
        if (cost >= best.cost) continue;
        const fit = this.fit(dir, fp);
        const cam = fit.center.clone().addScaledVector(dir, fit.dist);
        // Ni el cuerpo del examinador ni la camilla deben tapar la zona del test (por delante de ella).
        if (clutter.length) {
          const right = new Vector3().crossVectors(new Vector3(0, 1, 0), dir).normalize();
          const up = new Vector3().crossVectors(dir, right);
          let x0 = Infinity;
          let x1 = -Infinity;
          let y0 = Infinity;
          let y1 = -Infinity;
          for (const p of fp.roi) {
            const q = p.clone().sub(fit.center);
            x0 = Math.min(x0, q.dot(right));
            x1 = Math.max(x1, q.dot(right));
            y0 = Math.min(y0, q.dot(up));
            y1 = Math.max(y1, q.dot(up));
          }
          let front = 0;
          for (const c of clutter) {
            const q = c.p.clone().sub(fit.center);
            const x = q.dot(right);
            const y = q.dot(up);
            if (q.dot(dir) > 12 && x > x0 - 10 && x < x1 + 10 && y > y0 - 10 && y < y1 + 10) front += c.w;
          }
          cost += front;
          if (cost >= best.cost) continue;
        }
        let hidden = 0;
        let total = 0;
        for (const f of pts) {
          total += f.w;
          // Lo que queda de espaldas a la cámara tampoco se ve (la propia pieza lo tapa).
          if (f.n && f.n.dot(cam.clone().sub(f.p).normalize()) < 0.15) {
            hidden += f.w * 0.7;
            continue;
          }
          const to = f.p.clone().sub(cam);
          const dist = to.length();
          ray.set(cam, to.normalize());
          ray.far = dist + 1;
          const hit = ray.intersectObjects(meshes, false)[0];
          if (!hit) continue;
          const tag = who.get(hit.object) ?? "";
          if (hit.distance > dist - 11 || f.allow.includes(tag) || f.allow.includes(tag.replace(/_arm$/, "_upperarm")) || f.allow.includes(tag.replace(/_arm$/, "_forearm")) || f.allow.includes(tag.replace(/_leg$/, "_thigh")) || f.allow.includes(tag.replace(/_leg$/, "_shank"))) continue;
          hidden += f.w * (tag.startsWith("e:") && /arm|hand/.test(tag) ? 0.5 : 1);
        }
        cost += total ? (hidden / total) * 10 : 0;
        if (cost < best.cost) best = { cost, az, el, fit };
      }
    }
    this.base = { az: best.az, el: best.el };
    this.view.az = best.az;
    this.view.el = best.el;
    this.view.center.copy(best.fit.center);
    this.view.dist = best.fit.dist;
    this.updateCamera();
  }

  /** Puntos para encuadrar: la zona del test (manos, flechas, síntoma, lo que se mueve) y todo. */
  private framePoints(): { roi: Vector3[]; all: Vector3[] } {
    const spec = this.spec;
    const roi: Vector3[] = [];
    const all: Vector3[] = [];
    const p0 = this.patientPose(0, 0);
    // Con guion, cada pose clave (la más alejada, la última); sin guion, principio, mitad y final.
    const S = this.keys ? this.keys.length - 1 : 0;
    const end = this.stillMoment().m;
    const ms = this.keys ? [...Array.from({ length: S }, (_, i) => i / S).filter((u) => u !== end), end] : [0, 0.5, 1];
    for (const m of ms) {
      const { pat, ex, cts } = scenePoses(spec, this.layout, this.plan, { m, reach: 1, arrows: m, mix: this.keys ? mixFor(spec, m) : m });
      all.push(...surfaceSamples(pat).map((x) => x.p));
      if (ex) all.push(...surfaceSamples(ex).map((x) => x.p));
      for (const c of cts) roi.push(c.p);
      for (const a of [...(spec.pain ?? []), ...(spec.arrows ?? []).map((x) => x.at)]) {
        const i = anchorInfo(pat, a);
        if (i) roi.push(i.p);
      }
      // Contexto: el miembro entero (o cabeza y hombros) donde está la zona del test.
      for (const a of [...(spec.hands ?? []), ...(spec.pain ?? [])]) {
        const side = /^[rl]_tmj/.test(a) ? null : a.match(/^(r|l)_(\w+)/);
        const keys = side
          ? /shoulder|upperarm|elbow|forearm|wrist|hand/.test(side[2]!)
            ? ["shoulder", "elbow", "wrist", "handtip"].map((k) => `${side[1]}_${k}`)
            : ["hip", "knee", "ankle", "foottip"].map((k) => `${side[1]}_${k}`)
          : /^(head|neck|jaw|mouth|depressor|[rl]_tmj)/.test(a)
            ? this.faceOnly
              ? ["head"]
              : ["head", "neck", "chest"]
            : ["pelvis", "chest"];
        for (const k of keys) if (pat.pt[k]) roi.push(pat.pt[k]!);
      }
      if (m === end || this.keys) for (const k of Object.keys(pat.pt)) if (pat.pt[k]!.distanceTo(p0.pt[k]!) > 4) roi.push(pat.pt[k]!, p0.pt[k]!);
    }
    // Las flechas de recorrido enteras dentro de la imagen.
    for (const mk of this.scriptMarks ? [...this.scriptMarks.steps.flat(), ...this.scriptMarks.always] : []) if (mk.path) roi.push(...mk.path.pts.filter((_, i) => i % 3 === 0));
    // Las cabezas, si están cerca de la zona del test, enteras (mejor que cortadas por el borde).
    if (roi.length && !this.faceOnly) {
      const c = roi.reduce((a, b) => a.add(b), new Vector3()).multiplyScalar(1 / roi.length);
      const { pat, ex } = scenePoses(spec, this.layout, this.plan, this.stillMoment());
      const head = (p: Pose3) => [p.head.p, p.head.p.clone().add(new Vector3(0, 13, 0).applyQuaternion(p.head.q)), p.head.p.clone().add(new Vector3(0, -11, 0).applyQuaternion(p.head.q))];
      if (pat.head.p.distanceTo(c) < 50) roi.push(...head(pat));
      if (ex && ex.head.p.distanceTo(c) < 55) roi.push(...head(ex));
    }
    return { roi, all };
  }

  /** Centro y distancia de la cámara en una dirección: plano cercano de la zona del test si es bastante más pequeña que todo. */
  private fit(dir: Vector3, { roi, all }: { roi: Vector3[]; all: Vector3[] }) {
    const right = new Vector3().crossVectors(new Vector3(0, 1, 0), dir).normalize();
    const up = new Vector3().crossVectors(dir, right).normalize();
    const extent = (pts: Vector3[]) => {
      let x0 = Infinity;
      let x1 = -Infinity;
      let y0 = Infinity;
      let y1 = -Infinity;
      for (const p of pts) {
        const x = p.dot(right);
        const y = p.dot(up);
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
      return { x0, x1, y0, y1 };
    };
    const aspect = this.aspect();
    const size = (e: { x0: number; x1: number; y0: number; y1: number }) => Math.max(e.x1 - e.x0, (e.y1 - e.y0) * aspect);
    const full = extent(all);
    let use = all;
    if (roi.length) {
      const r = extent(roi);
      const need = this.faceOnly ? Math.max(size(r) + 26, 52) : Math.max(size(r) + 60, 110);
      if (need < size(full) * 0.92) {
        const cx = (r.x0 + r.x1) / 2;
        const cy = (r.y0 + r.y1) / 2;
        const hw = need / 2;
        const hh = need / aspect / 2;
        const d0 = roi.reduce((s2, p) => s2 + p.dot(dir), 0) / roi.length;
        const corner = (sx: number, sy: number) => new Vector3().addScaledVector(right, cx + sx * hw).addScaledVector(up, cy + sy * hh).addScaledVector(dir, d0);
        use = [...roi, corner(-1, -1), corner(1, 1)];
      }
    }
    const e = extent(use);
    const depth = use.reduce((s2, p) => s2 + p.dot(dir), 0) / use.length;
    const center = new Vector3().addScaledVector(right, (e.x0 + e.x1) / 2).addScaledVector(up, (e.y0 + e.y1) / 2).addScaledVector(dir, depth);
    const tanV = Math.tan(rad(FOV / 2));
    const tanH = tanV * aspect;
    let dist = 60;
    for (const p of use) {
      const q = p.clone().sub(center);
      const sd = q.dot(dir);
      dist = Math.max(dist, Math.abs(q.dot(right)) / (tanH * 0.9) + sd, Math.abs(q.dot(up)) / (tanV * 0.88) + sd);
    }
    return { center, dist };
  }

  private aspect() {
    const w = this.host.clientWidth || 4;
    const h = this.host.clientHeight || 3;
    return w / h;
  }

  private updateCamera() {
    const dir = this.dirOf(this.view.az, this.view.el);
    this.camera.aspect = this.aspect();
    this.camera.position.copy(this.view.center).addScaledVector(dir, this.view.dist);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(this.view.center);
    this.camera.near = Math.max(5, this.view.dist * 0.2);
    this.camera.far = this.view.dist * 6;
    this.camera.updateProjectionMatrix();
    const fog = this.scene.fog as Fog;
    fog.near = this.view.dist * 1.4;
    fog.far = this.view.dist * 3.2;
    // Luz principal por encima y a un lado de la cámara; sombra que cubre la escena.
    const L = this.view.dist * 0.9 + 150;
    const baseDir = this.dirOf(this.base.az, this.base.el);
    const bRight = new Vector3().crossVectors(new Vector3(0, 1, 0), baseDir).normalize();
    this.key.position.copy(this.view.center).addScaledVector(bRight, -0.55 * L).addScaledVector(new Vector3(0, 1, 0), 1.25 * L).addScaledVector(baseDir, 0.55 * L);
    this.key.target.position.copy(this.view.center);
    // Contraluz: detrás de las personas respecto a la cámara, algo alto.
    this.rim.position.copy(this.view.center).addScaledVector(baseDir, -0.9 * L).addScaledVector(new Vector3(0, 1, 0), 0.7 * L).addScaledVector(bRight, 0.3 * L);
    this.rim.target.position.copy(this.view.center);
    const sc = this.key.shadow.camera;
    const R = Math.max(130, this.view.dist * 0.6);
    sc.left = -R;
    sc.right = R;
    sc.top = R;
    sc.bottom = -R;
    sc.near = 10;
    sc.far = L * 3;
    sc.updateProjectionMatrix();
  }

  private attachPointer(canvas: HTMLCanvasElement) {
    canvas.addEventListener("pointerdown", (e) => {
      this.drag = { x: e.clientX, y: e.clientY, az: this.view.az, el: this.view.el };
      canvas.setPointerCapture?.(e.pointerId);
      canvas.style.cursor = "grabbing";
    });
    const end = () => {
      this.drag = null;
      canvas.style.cursor = "grab";
    };
    canvas.addEventListener("pointerup", end);
    canvas.addEventListener("pointercancel", end);
    canvas.addEventListener("pointermove", (e) => {
      if (!this.drag) return;
      const dx = e.clientX - this.drag.x;
      const dy = e.pointerType === "mouse" ? e.clientY - this.drag.y : 0;
      if (Math.abs(dx) + Math.abs(dy) < 3 && !this.custom) return;
      this.view.az = this.drag.az - (this.mirrored ? -dx : dx) * 0.012;
      this.view.el = this.drag.el + dy * 0.01;
      this.limitView();
      this.custom = true;
      this.updateCamera();
      this.render(this.lastT);
      this.opts.onRotate?.();
    });
  }

  /** Solo se gira un poco alrededor de la vista elegida (la que mejor enseña la maniobra), nunca la vuelta entera. */
  private limitView() {
    const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
    this.view.az = clamp(this.view.az, this.base.az - rad(MAX_TURN), this.base.az + rad(MAX_TURN));
    this.view.el = clamp(this.view.el, Math.max(rad(2), this.base.el - rad(15)), Math.min(rad(80), this.base.el + rad(15)));
  }

  /** Gira la cámara alrededor de la figura (grados; positivo, hacia la derecha), dentro de lo permitido. */
  rotateBy(deg: number) {
    this.view.az -= rad(this.mirrored ? -deg : deg);
    this.limitView();
    this.custom = true;
    this.updateCamera();
    this.render(this.lastT);
  }

  /** Vuelve a la vista elegida automáticamente. */
  resetView() {
    this.view.az = this.base.az;
    this.view.el = this.base.el;
    this.custom = false;
    this.updateCamera();
    this.render(this.lastT);
  }

  /** Dibuja el instante t (0-1) del bucle; con `still`, la imagen fija de la maniobra. */
  render(t: number, still = false) {
    this.lastT = t;
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    if (!w || !h) return;
    const size = this.renderer.getSize(new Vector2());
    if (size.x !== w || size.y !== h) {
      this.renderer.setSize(w, h, false);
      this.updateCamera();
    }
    this.pose(still ? this.stillMoment() : this.clock.at(t), t * this.clock.duration);
    this.renderer.render(this.scene, this.camera);
    this.layoutLabels();
  }

  /** Vista elegida (para la tabla de cámaras precalculadas). */
  cameraState(): CamState {
    const r = (v: number, d = 3) => +v.toFixed(d);
    const c = this.view.center;
    return [r(this.base.az, 4), r(this.base.el, 4), r(c.x, 1), r(c.y, 1), r(c.z, 1), r(this.view.dist, 1)];
  }

  /** Imagen del lienzo (para revisar las figuras). */
  snapshot(): string {
    return this.renderer.domElement.toDataURL("image/png");
  }

  dispose() {
    this.ro?.disconnect();
    this.patient.dispose();
    this.examiner?.dispose();
    for (const d of this.disposables) d.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
    this.overlay.remove();
  }
}

export function createStage(host: HTMLElement, spec: FigureSpec, title: string, opts: StageOptions = {}): Stage {
  return new Stage(host, spec, title, opts);
}
