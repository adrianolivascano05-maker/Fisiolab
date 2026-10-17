/** Nórdico de lado: de rodillas con los tobillos sujetos, el cuerpo recto se inclina; el ángulo se mide desde la vertical. */
export function NordicSetup() {
  const stroke = { stroke: "var(--color-text)", strokeWidth: 3.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
  const muted = "var(--color-text-muted)";
  const accent = "var(--color-accent)";
  // Rodilla en (150,160); tronco recto inclinado 55° desde la vertical hasta la cabeza.
  const s = Math.sin((55 * Math.PI) / 180);
  const c = Math.cos((55 * Math.PI) / 180);
  const at = (r: number) => `${150 + r * s},${160 - r * c}`;
  return (
    <svg viewBox="0 0 320 196" role="img" aria-labelledby="nordic-title" className="h-auto w-full rounded-md bg-surface">
      <title id="nordic-title">
        Persona de rodillas vista de lado, con los tobillos sujetos y el cuerpo recto inclinándose hacia delante. El ángulo de
        rotura es la inclinación de la línea rodilla-cadera respecto a la vertical. El móvil graba de lado, a la altura de la
        rodilla.
      </title>
      <line x1="12" y1="168" x2="308" y2="168" stroke="var(--color-border-input)" strokeWidth="2" />
      {/* Colchoneta y sujeción de los tobillos */}
      <rect x="70" y="162" width="190" height="6" rx="2" fill="var(--color-border)" />
      <rect x="92" y="150" width="12" height="12" rx="2" fill={muted} />
      {/* Piernas: tobillo, rodilla; cuerpo recto con la cadera estirada; brazos preparados */}
      <polyline {...stroke} points={`98,160 150,160 ${at(52)} ${at(105)}`} />
      <polyline {...stroke} points={`${at(95)} ${158 + 92 * s},${150 - 50 * c} ${170 + 100 * s},${178 - 60 * c}`} />
      <circle cx={150 + 118 * s} cy={160 - 118 * c} r="8" fill="var(--color-text)" />
      {/* Vertical y ángulo */}
      <line x1="150" y1="160" x2="150" y2="60" stroke={muted} strokeWidth="1.5" strokeDasharray="4 3" />
      <path d={`M150 120 A40 40 0 0 1 ${150 + 40 * s} ${160 - 40 * c}`} stroke={accent} strokeWidth="2" fill="none" />
      <text x="160" y="112" fontSize="12" fontWeight="600" fill="var(--color-text)">θ</text>
      {/* Móvil de lado */}
      <rect x="22" y="128" width="14" height="26" rx="3" fill={accent} />
      <circle cx="36" cy="135" r="2.2" fill="var(--color-bg)" />
      <text x="14" y="188" fontSize="11" fill={muted}>
        móvil de lado, quieto, a la altura de la rodilla
      </text>
    </svg>
  );
}
