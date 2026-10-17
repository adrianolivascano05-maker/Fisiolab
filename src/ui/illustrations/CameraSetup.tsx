import { Figure } from "./Figure";

/** Cómo colocar el móvil: de lado, a la altura de los pies, quieto y a 2-3 m. */
export function CameraSetup() {
  const muted = "var(--color-text-muted)";
  const accent = "var(--color-accent)";
  return (
    <svg
      viewBox="0 0 320 196"
      role="img"
      aria-labelledby="camera-setup-title"
      className="h-auto w-full rounded-md bg-surface"
    >
      <title id="camera-setup-title">
        Móvil apoyado en el suelo, de lado respecto a la persona y a 2-3 metros, apuntando a los pies, que se ven enteros.
      </title>
      {/* Suelo */}
      <line x1="12" y1="150" x2="308" y2="150" stroke="var(--color-border-input)" strokeWidth="2" />
      {/* Móvil sobre un soporte bajo */}
      <line x1="30" y1="150" x2="38" y2="138" stroke={muted} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="54" y1="150" x2="46" y2="138" stroke={muted} strokeWidth="2.5" strokeLinecap="round" />
      <rect x="35" y="114" width="14" height="26" rx="3" fill={accent} />
      <circle cx="49" cy="121" r="2.2" fill="var(--color-bg)" />
      {/* Campo de visión hacia los pies */}
      <path d="M51 121 L232 104 M51 121 L232 156" stroke={accent} strokeWidth="1.5" strokeDasharray="5 4" fill="none" />
      {/* Persona y zona que debe verse */}
      <Figure x={250} feetY={150} pose="stand" />
      <ellipse cx="250" cy="148" rx="24" ry="9" fill="none" stroke={accent} strokeWidth="2" strokeDasharray="4 3" />
      {/* Distancia */}
      <g stroke={muted} strokeWidth="1.5" fill={muted}>
        <line x1="44" y1="168" x2="248" y2="168" />
        <path d="M44 168 l7 -4 v8 z M248 168 l-7 -4 v8 z" stroke="none" />
      </g>
      <text x="146" y="186" textAnchor="middle" fontSize="12" fontWeight="600" fill="var(--color-text)">
        2-3 m
      </text>
      <text x="16" y="104" fontSize="11" fill={muted}>
        cámara lenta, quieto
      </text>
      <text x="316" y="122" fontSize="11" textAnchor="end" fill={muted}>
        <tspan x="316">pies</tspan>
        <tspan x="316" dy="13">a la vista</tspan>
      </text>
    </svg>
  );
}
