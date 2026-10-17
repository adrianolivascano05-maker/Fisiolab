// Monigote de las ilustraciones de ayuda. Dibujo propio, trazos con los colores del sistema.

export type Pose = "stand" | "crouch" | "air" | "land";

/** Dibuja una persona de perfil con los pies en (x, feetY). Alto total ≈ 80 unidades de pie. */
export function Figure({ x, feetY, pose }: { x: number; feetY: number; pose: Pose }) {
  const stroke = { stroke: "var(--color-text)", strokeWidth: 3.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
  if (pose === "crouch") {
    // Sentadilla a 90° de perfil (mirando a la derecha): rodilla adelante, cadera atrás, tronco algo inclinado.
    const foot = { x: x + 2, y: feetY };
    const knee = { x: x + 14, y: feetY - 24 };
    const hip = { x: x - 8, y: feetY - 30 };
    const shoulder = { x: x + 4, y: feetY - 60 };
    return (
      <g>
        <polyline {...stroke} points={`${foot.x},${foot.y} ${knee.x},${knee.y} ${hip.x},${hip.y} ${shoulder.x},${shoulder.y}`} />
        <polyline {...stroke} points={`${shoulder.x - 1},${shoulder.y + 6} ${shoulder.x + 10},${shoulder.y + 16} ${hip.x + 4},${hip.y - 3}`} />
        <circle cx={shoulder.x + 4} cy={shoulder.y - 10} r={8} fill="var(--color-text)" />
      </g>
    );
  }
  // De pie, en el aire o aterrizando: piernas estiradas, manos en la cintura, pies en punta si no tocan.
  const toe = pose === "air" ? 5 : 0;
  return (
    <g>
      <polyline {...stroke} points={`${x - 5 + toe / 2},${feetY} ${x},${feetY - 36} ${x + 5 - toe / 2},${feetY}`} />
      <line {...stroke} x1={x} y1={feetY - 36} x2={x} y2={feetY - 66} />
      <polyline {...stroke} points={`${x},${feetY - 60} ${x - 11},${feetY - 50} ${x - 3},${feetY - 39}`} />
      <polyline {...stroke} points={`${x},${feetY - 60} ${x + 11},${feetY - 50} ${x + 3},${feetY - 39}`} />
      <circle cx={x} cy={feetY - 75} r={8} fill="var(--color-text)" />
    </g>
  );
}
