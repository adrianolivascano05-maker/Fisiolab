// Postura natural de lo que el guion de una figura no menciona, y el lado que queda arriba tumbado de lado.
// Puro (sin three): lo usan la escena, el reproductor (textos con grados) y las pruebas.
import type { BodyKey, FigureSpec, Joint3D, Posture, Side } from "./figure";

/** En decúbito lateral, el lado que queda arriba: el que dice la figura o el de sus manos, flechas y articulaciones que se mueven. */
export function upSideOf(spec: FigureSpec): Side {
  if (spec.side === "r" || spec.side === "l") return spec.side;
  const keys = [...(spec.hands ?? []), ...(spec.arrows ?? []).map((a) => a.at), ...(spec.pain ?? []), ...Object.keys(spec.joints ?? {}), ...Object.keys(spec.to ?? {})];
  const r = keys.filter((k) => k.startsWith("r_")).length;
  const l = keys.filter((k) => k.startsWith("l_")).length;
  return r > l ? "r" : "l";
}

const LIMB_JOINTS = ["shoulder", "elbow", "wrist", "hip", "knee", "ankle"] as const;
type LimbJoint = (typeof LIMB_JOINTS)[number];

/** Antebrazo relajado (pronación desde la posición neutra): de pie, la palma hacia el muslo; sentado, hacia
 *  los muslos; tumbado, hacia el cuerpo. */
const PRON_REST: Partial<Record<Posture, number>> = { standing: -20, sitting: 60, supine: -10, hooklying: -10, longsitting: 30, prone: -10, sidelying: -10, quadruped: -50 };

/** Postura natural de cada articulación (lo que el guion no menciona) en una postura. */
export function restValue(spec: FigureSpec, k: BodyKey, dof: keyof Joint3D): number {
  const p = spec.posture;
  const m = k.match(/^(r|l)_(\w+)$/);
  if (!m) {
    if (k === "neck" && dof === "rot" && p === "prone") return 80;
    if (k === "neck" && dof === "lat" && p === "sidelying") return upSideOf(spec) === "l" ? -12 : 12;
    if (k === "trunk" && dof === "flex" && p === "quadruped") return 75;
    return 0;
  }
  const s = m[1] as Side;
  const j = m[2] as LimbJoint;
  const up = p === "sidelying" ? upSideOf(spec) : null;
  const table: Partial<Record<Posture, Partial<Record<LimbJoint, Joint3D>>>> = {
    standing: { shoulder: { abd: 10 }, elbow: { flex: 8 }, hip: { abd: 3 }, knee: { flex: 2 } },
    sitting: { shoulder: { abd: 9 }, elbow: { flex: 75 }, hip: { flex: 90, abd: 6 }, knee: { flex: 90 } },
    supine: { shoulder: { abd: 9 }, elbow: { flex: 6 }, hip: { abd: 4 } },
    hooklying: { shoulder: { abd: 9 }, elbow: { flex: 6 }, hip: { flex: 45, abd: 4 }, knee: { flex: 90 } },
    longsitting: { shoulder: { abd: 12 }, elbow: { flex: 6 }, hip: { flex: 90, abd: 4 } },
    prone: { shoulder: { abd: 9 }, elbow: { flex: 6 }, hip: { abd: 4 } },
    quadruped: { shoulder: { flex: 75 }, wrist: { flex: -90 }, hip: { flex: 75 }, knee: { flex: 90 }, ankle: { flex: -90 } },
    sidelying:
      s === up
        ? { shoulder: { flex: 8, abd: 14 }, elbow: { flex: 15 }, knee: { flex: 5 } }
        : { shoulder: { flex: 80 }, elbow: { flex: 95 }, hip: { flex: 25 }, knee: { flex: 35 } },
  };
  if (j === "elbow" && dof === "pron") return PRON_REST[p] ?? 0;
  return table[p]?.[j]?.[dof] ?? 0;
}

