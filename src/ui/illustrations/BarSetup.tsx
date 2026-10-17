/** Cómo grabar la barra: móvil de lado, a la altura de la barra, con todo el recorrido a la vista. */
export function BarSetup() {
  const stroke = { stroke: "var(--color-text)", strokeWidth: 3.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
  const muted = "var(--color-text-muted)";
  const accent = "var(--color-accent)";
  return (
    <svg viewBox="0 0 320 196" role="img" aria-labelledby="bar-setup-title" className="h-auto w-full rounded-md bg-surface">
      <title id="bar-setup-title">
        Persona en sentadilla con una barra a la espalda, vista de lado. El móvil está en un trípode a la altura de la barra y
        enfoca todo el recorrido, de abajo arriba.
      </title>
      <line x1="12" y1="170" x2="308" y2="170" stroke="var(--color-border-input)" strokeWidth="2" />
      {/* Móvil en trípode */}
      <line x1="40" y1="170" x2="48" y2="112" stroke={muted} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="62" y1="170" x2="52" y2="112" stroke={muted} strokeWidth="2.5" strokeLinecap="round" />
      <rect x="43" y="86" width="14" height="26" rx="3" fill={accent} />
      <circle cx="57" cy="93" r="2.2" fill="var(--color-bg)" />
      <path d="M59 93 L220 40 M59 93 L220 150" stroke={accent} strokeWidth="1.5" strokeDasharray="5 4" fill="none" />
      {/* Barra vista de lado: el disco detrás de la persona, con la barra en el centro */}
      <circle cx="244" cy="104" r="15" fill="var(--color-border-input)" />
      {/* Persona en sentadilla con la barra */}
      <polyline {...stroke} points="248,170 262,146 238,140 246,104" />
      <circle cx="252" cy="92" r="8" fill="var(--color-text)" />
      <circle cx="244" cy="104" r="3.5" fill="var(--color-text)" />
      {/* Recorrido de la barra */}
      <g stroke={accent} strokeWidth="1.8" fill={accent}>
        <line x1="290" y1="118" x2="290" y2="56" />
        <path d="M290 50 l-5 9 h10 z" stroke="none" />
      </g>
      <text x="300" y="84" fontSize="11" fill={muted} textAnchor="end" transform="rotate(-90 300 84)">recorrido</text>
      <text x="16" y="188" fontSize="11" fill={muted}>
        quieto, de lado, a la altura de la barra
      </text>
    </svg>
  );
}
