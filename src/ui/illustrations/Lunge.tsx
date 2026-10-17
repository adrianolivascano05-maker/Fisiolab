/** Test de lunge en carga: rodilla a la pared sin levantar el talón y el móvil a lo largo de la tibia. */
export function Lunge() {
  const stroke = { stroke: "var(--color-text)", strokeWidth: 3.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
  const muted = "var(--color-text-muted)";
  const accent = "var(--color-accent)";
  // Tibia del tobillo (205,165) a la rodilla (248,110): 38° respecto a la vertical.
  return (
    <svg viewBox="0 0 320 200" role="img" aria-labelledby="lunge-title" className="h-auto w-full rounded-md bg-surface">
      <title id="lunge-title">
        Persona de perfil frente a una pared con un pie delante: la rodilla toca la pared, el talón sigue en el suelo y el
        móvil va apoyado a lo largo de la tibia, que se inclina respecto a la vertical.
      </title>
      {/* Suelo y pared */}
      <line x1="12" y1="170" x2="262" y2="170" stroke="var(--color-border-input)" strokeWidth="2" />
      <rect x="252" y="12" width="14" height="158" fill="var(--color-border)" />
      {/* Pierna de atrás, tronco y brazos a la pared */}
      <polyline {...stroke} points="118,170 150,140 200,78" />
      <polyline {...stroke} points="200,78 205,30" />
      <polyline {...stroke} points="204,40 228,52 250,50" />
      <circle cx="207" cy="18" r="8" fill="var(--color-text)" />
      {/* Pierna de delante: pie, tibia y muslo */}
      <polyline {...stroke} points="234,170 200,170 205,165 248,110 200,78" />
      {/* Vertical y ángulo */}
      <line x1="205" y1="165" x2="205" y2="104" stroke={muted} strokeWidth="1.5" strokeDasharray="4 3" />
      <path d="M205 133 A32 32 0 0 1 224.7 139.8" stroke={accent} strokeWidth="2" fill="none" />
      <text x="186" y="128" fontSize="12" fontWeight="600" fill="var(--color-text)">α</text>
      {/* Móvil sobre la tibia */}
      <rect x="236" y="117" width="8" height="26" rx="2" fill={accent} transform="rotate(38 240 130)" />
      {/* Distancia a la pared */}
      <g stroke={muted} strokeWidth="1.5" fill={muted}>
        <line x1="236" y1="182" x2="250" y2="182" />
        <path d="M234 182 l6 -3.5 v7 z M252 182 l-6 -3.5 v7 z" stroke="none" />
      </g>
      <text x="243" y="196" textAnchor="middle" fontSize="11" fill={muted}>cm</text>
      <text x="16" y="40" fontSize="11" fill={muted}>
        <tspan x="16">rodilla a la pared,</tspan>
        <tspan x="16" dy="14">talón en el suelo</tspan>
      </text>
    </svg>
  );
}
