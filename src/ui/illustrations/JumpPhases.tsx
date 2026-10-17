import type { JumpType } from "../../calc/results";
import { cx } from "../cx";
import { Figure, type Pose } from "./Figure";

type Panel = {
  pose: Pose;
  /** Altura de los pies sobre el suelo, en unidades del dibujo. */
  lift: number;
  title: string;
  detail: string;
  marker?: { letter: string; color: string };
  box?: boolean;
};

const takeoff = { letter: "D", color: "var(--color-marker-takeoff)" };
const landing = { letter: "A", color: "var(--color-marker-landing)" };
const contact = { letter: "C", color: "var(--color-marker-contact)" };

function panels(type: JumpType): Panel[] {
  const start: Panel =
    type === "dj"
      ? { pose: "land", lift: 0, box: true, title: "Contacto", detail: "Primer fotograma con el pie en el suelo tras caer del cajón.", marker: contact }
      : type === "sj"
        ? { pose: "crouch", lift: 0, title: "Preparado", detail: "Quieto en sentadilla. Aquí no se marca nada." }
        : { pose: "stand", lift: 0, title: "Preparado", detail: "De pie, manos en la cintura. Aquí no se marca nada." };
  return [
    start,
    { pose: "air", lift: 9, title: "Despegue", detail: "Primer fotograma con los dos pies en el aire.", marker: takeoff },
    { pose: "air", lift: 20, title: "Vuelo", detail: "No se marca: es lo que se mide." },
    { pose: "land", lift: 0, title: "Aterrizaje", detail: "Primer fotograma en que un pie vuelve a tocar.", marker: landing },
  ];
}

const GROUND = 112;

/** Qué fotograma marcar en cada momento del salto, con las mismas letras y colores que la barra del vídeo. */
export function JumpPhases({ type }: { type: JumpType }) {
  return (
    <ol className="grid grid-cols-2 gap-3">
      {panels(type).map((p) => (
        <li key={p.title} className="flex flex-col gap-1">
          <svg
            viewBox="0 0 120 124"
            aria-hidden="true"
            className={cx("h-auto w-full rounded-md bg-surface", p.marker && "outline-2 outline-offset-0")}
            style={p.marker ? { outlineColor: p.marker.color, outlineStyle: "solid" } : undefined}
          >
            {p.box && <rect x="6" y={GROUND - 30} width="30" height="30" rx="2" fill="var(--color-border)" stroke="var(--color-border-input)" />}
            <line x1="4" y1={GROUND} x2="116" y2={GROUND} stroke="var(--color-border-input)" strokeWidth="2" />
            <Figure x={70} feetY={GROUND - p.lift} pose={p.pose} />
            {p.marker && p.lift > 0 && (
              // Hueco entre pie y suelo: lo que hay que buscar en el despegue.
              <rect x="56" y={GROUND - p.lift} width="28" height={p.lift} rx="2" fill={p.marker.color} opacity="0.45" />
            )}
            {p.marker && p.lift === 0 && <ellipse cx="70" cy={GROUND} rx="12" ry="4" fill="none" stroke={p.marker.color} strokeWidth="2.5" />}
            {p.marker && (
              <g>
                <rect x="6" y="6" width="20" height="20" rx="4" fill={p.marker.color} />
                <text x="16" y="21" textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--color-media-bg)">
                  {p.marker.letter}
                </text>
              </g>
            )}
          </svg>
          <span className="text-sm font-semibold">{p.title}</span>
          <span className="text-xs text-text-muted">{p.detail}</span>
        </li>
      ))}
    </ol>
  );
}
