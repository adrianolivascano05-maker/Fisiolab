// Detección automática del despegue y el aterrizaje a partir de la pose de cada fotograma.
// Se sigue el punto más bajo de los pies (talones y puntas): en el suelo está a la altura del suelo;
// en el aire, por encima. Funciones puras: reciben las muestras ya detectadas.
import type { JumpType, MarkInput } from "../calc/results";
import type { Landmark3D } from "./types";

/** Muestra de un fotograma: posiciones verticales en la imagen (0 arriba, 1 abajo). */
export type JumpSample = {
  frame: number;
  /** Punto más bajo de los pies, o null si no se ven. */
  foot: number | null;
  /** Altura media de las caderas. */
  hip: number | null;
  /** Longitud de la pierna (cadera-tobillo) en la imagen, para escalar los umbrales. */
  leg: number | null;
};

const VISIBLE = 0.5;

/** Extrae de una pose lo que necesita la detección del salto. */
export function jumpSample(frame: number, points: Landmark3D[] | null): JumpSample {
  if (!points) return { frame, foot: null, hip: null, leg: null };
  const seen = (i: number) => (points[i] && (points[i]!.visibility ?? 1) >= VISIBLE ? points[i]! : null);
  const feet = [29, 30, 31, 32].map(seen).filter((p) => p !== null);
  const hips = [23, 24].map(seen).filter((p) => p !== null);
  const legs = [
    [23, 27],
    [24, 28],
  ]
    .map(([h, a]) => {
      const p = seen(h!);
      const q = seen(a!);
      return p && q ? Math.hypot(p.x - q.x, p.y - q.y) : null;
    })
    .filter((v) => v !== null);
  return {
    frame,
    foot: feet.length ? Math.max(...feet.map((p) => p.y)) : null,
    hip: hips.length ? hips.reduce((s, p) => s + p.y, 0) / hips.length : null,
    leg: legs.length ? legs.reduce((s, v) => s + v, 0) / legs.length : null,
  };
}

export type Detection = { marks: MarkInput[]; warnings: string[] } | { error: string };

const median = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b);
  return s.length ? s[Math.floor((s.length - 1) / 2)]! : NaN;
};

type Run = { air: boolean; from: number; to: number };

/** Tramos seguidos en el aire o en el suelo, sin los que duran demasiado poco para ser reales (ruido). */
function runsOf(samples: { frame: number; foot: number }[], isAir: (y: number) => boolean, fps: number): Run[] {
  const state = samples.map((s) => isAir(s.foot));
  const build = () => {
    const runs: Run[] = [];
    state.forEach((air, i) => {
      const last = runs.at(-1);
      if (last && last.air === air) last.to = i;
      else runs.push({ air, from: i, to: i });
    });
    return runs;
  };
  const span = (r: Run) => (samples[r.to]!.frame - samples[r.from]!.frame + 1) / fps;
  // Un vuelo de menos de 80 ms (≈ 1 cm) o un apoyo de menos de 30 ms en mitad del aire es ruido.
  for (let pass = 0; pass < 3; pass++) {
    const runs = build();
    let changed = false;
    runs.forEach((r, i) => {
      const inner = i > 0 && i < runs.length - 1;
      if ((r.air && span(r) < 0.08 && inner) || (!r.air && span(r) < 0.03 && inner)) {
        for (let k = r.from; k <= r.to; k++) state[k] = !r.air;
        changed = true;
      }
    });
    if (!changed) break;
  }
  return build();
}

/**
 * Propone las marcas de un salto. El despegue es el primer fotograma con los pies en el aire; el
 * aterrizaje, el primero en que un pie vuelve al suelo; el contacto (caída), el primero en que toca
 * el suelo al bajar del cajón; el inicio del movimiento (CMJ), el primero en que la cadera baja.
 */
export function detectJump(type: JumpType, all: JumpSample[], fps: number): Detection {
  const samples = all.filter((s): s is JumpSample & { foot: number } => s.foot !== null).sort((a, b) => a.frame - b.frame);
  if (samples.length < 10) return { error: "No se ven bien los pies. Graba de lado, con el cuerpo entero en el cuadro y buena luz." };
  const warnings: string[] = [];
  const hidden = 1 - samples.length / all.length;
  if (hidden > 0.2) warnings.push(`En el ${Math.round(hidden * 100)} % de los fotogramas no se ven los pies: revisa las marcas.`);

  const leg = median(samples.map((s) => s.leg).filter((v): v is number => v !== null)) || 0.25;
  const th = Math.max(0.01, 0.08 * leg);
  // El suelo: la altura de los pies cuando están más abajo (mediana del 30 % más bajo en la imagen).
  const lowest = samples.map((s) => s.foot).sort((a, b) => b - a);
  const ground = median(lowest.slice(0, Math.max(3, Math.ceil(lowest.length * 0.3))));
  // Umbral fino para afinar el borde: justo por encima del temblor de los pies apoyados.
  const still = samples.filter((s) => Math.abs(s.foot - ground) < th).map((s) => Math.abs(s.foot - ground));
  const thLow = Math.max(0.003, Math.min(th / 3, 4 * median(still)));
  const runs = runsOf(samples, (y) => y < ground - th, fps);

  /** Primer fotograma en el aire de un tramo (se retrocede hasta donde los pies empiezan a subir). */
  const airStart = (r: Run) => {
    let i = r.from;
    while (i > 0 && samples[i - 1]!.foot < ground - thLow) i--;
    return samples[i]!.frame;
  };
  /** Primer fotograma en el suelo de un tramo que sigue a un vuelo (se avanza hasta que los pies llegan abajo). */
  const groundStart = (r: Run) => {
    let i = r.from;
    while (i < r.to && samples[i]!.foot < ground - thLow) i++;
    return samples[i]!.frame;
  };
  const peak = (r: Run) => ground - Math.min(...samples.slice(r.from, r.to + 1).map((s) => s.foot));
  /** Vuelos completos: con suelo antes y después. */
  const flights = runs.map((r, i) => ({ r, i })).filter(({ r, i }) => r.air && i > 0 && i < runs.length - 1);

  if (type === "rj_10_5") {
    if (!flights.length) return { error: "No se encuentra ningún salto completo en el vídeo." };
    const marks: MarkInput[] = flights.flatMap(({ r, i }, k) => [
      { event: "takeoff" as const, frame: airStart(r), seriesIndex: k },
      { event: "landing" as const, frame: groundStart(runs[i + 1]!), seriesIndex: k },
    ]);
    return { marks, warnings };
  }

  if (type === "dj") {
    // Caída: en el cajón (por encima del suelo), contacto, despegue y aterrizaje.
    const c = runs.findIndex((r, i) => !r.air && i > 0 && runs[i - 1]!.air);
    if (c < 0 || c + 2 >= runs.length) {
      return { error: "No se ve la caída desde el cajón y el salto completos. Graba desde antes de bajar hasta después de aterrizar." };
    }
    const contact = groundStart(runs[c]!);
    const takeoff = airStart(runs[c + 1]!);
    const landing = groundStart(runs[c + 2]!);
    return {
      marks: [
        { event: "contact", frame: contact, seriesIndex: 0 },
        { event: "takeoff", frame: takeoff, seriesIndex: 0 },
        { event: "landing", frame: landing, seriesIndex: 0 },
      ],
      warnings,
    };
  }

  if (!flights.length) return { error: "No se encuentra el salto: tiene que verse el despegue y el aterrizaje en el vídeo." };
  const best = flights.reduce((a, b) => (peak(b.r) > peak(a.r) ? b : a));
  if (flights.length > 1) warnings.push(`Hay ${flights.length} saltos en el vídeo: se ha tomado el más alto.`);
  const takeoff = airStart(best.r);
  const landing = groundStart(runs[best.i + 1]!);
  const marks: MarkInput[] = [
    { event: "takeoff", frame: takeoff, seriesIndex: 0 },
    { event: "landing", frame: landing, seriesIndex: 0 },
  ];
  if (type === "cmj" || type === "cmj_arms") {
    const start = movementStart(all, takeoff, leg);
    if (start !== null) marks.unshift({ event: "movement_start", frame: start, seriesIndex: 0 });
  }
  return { marks, warnings };
}

/** Primer fotograma en que la cadera empieza a bajar antes del despegue, o null si no se ve. */
function movementStart(all: JumpSample[], takeoff: number, leg: number): number | null {
  const pre = all.filter((s): s is JumpSample & { hip: number } => s.hip !== null && s.frame < takeoff).sort((a, b) => a.frame - b.frame);
  if (pre.length < 6) return null;
  const base = median(pre.slice(0, Math.max(3, Math.floor(pre.length * 0.2))).map((s) => s.hip));
  let deepest = 0;
  pre.forEach((s, i) => {
    if (s.hip > pre[deepest]!.hip) deepest = i;
  });
  if (pre[deepest]!.hip - base < 0.15 * leg) return null; // Sin contramovimiento claro.
  // Se busca cuándo la cadera baja 1 y 2 veces el temblor, y se prolonga esa bajada hacia atrás.
  const tol = Math.max(0.003, 4 * median(pre.slice(0, deepest).map((s) => Math.abs(s.hip - base))));
  const first = (k: number) => pre.slice(0, deepest + 1).find((s) => s.hip > base + k * tol)?.frame ?? pre[deepest]!.frame;
  const f1 = first(1);
  const f2 = first(2);
  return Math.max(pre[0]!.frame, Math.round(f1 - (f2 - f1)));
}

/** Fotogramas en los que conviene mirar cada fotograma: alrededor de cada marca propuesta. */
export function refineFrames(marks: MarkInput[], sampled: Set<number>, step: number, last: number): number[] {
  const out = new Set<number>();
  for (const m of marks) {
    for (let f = Math.max(0, m.frame - step); f <= Math.min(last, m.frame + step); f++) if (!sampled.has(f)) out.add(f);
  }
  return [...out].sort((a, b) => a - b);
}
