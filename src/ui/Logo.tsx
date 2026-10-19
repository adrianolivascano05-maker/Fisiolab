// Marca de Cénit: una «C» que es también el arco de un goniómetro, con el sol de oro en su punto más
// alto (el cénit: lo máximo de un salto, de una velocidad o de un recorrido). Dibujo propio; mismo trazo
// que tools/build-icons.py.

/** Símbolo: se ve bien desde 16 px. */
export function LogoMark({ size = 28, title, bordered }: { size?: number; title?: string; bordered?: boolean }) {
  const base = "var(--color-brand)";
  const stroke = "var(--color-on-brand)";
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role={title ? "img" : undefined} aria-hidden={title ? undefined : true}>
      {title && <title>{title}</title>}
      {/* Sobre el mismo verde (la barra de arriba), un borde dorado lo separa del fondo. */}
      {bordered ? <rect x="2.5" y="2.5" width="95" height="95" rx="24" fill={base} stroke="var(--color-highlight)" strokeWidth="5" /> : <rect width="100" height="100" rx="26" fill={base} />}
      <path d="M70.68 39.64 A27 27 0 1 0 70.68 74.36" fill="none" stroke={stroke} strokeWidth="9" strokeLinecap="round" />
      <circle cx="50" cy="30" r="14" fill={base} />
      <circle cx="50" cy="30" r="9.5" fill="var(--color-highlight)" />
    </svg>
  );
}

/** Símbolo + nombre, para la cabecera de la pantalla principal. */
export function Logo({ onDark }: { onDark?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark size={34} bordered={onDark} />
      <span className="flex flex-col leading-none">
        <span className={`font-display text-[22px] font-semibold tracking-tight ${onDark ? "text-on-brand" : "text-brand"}`}>Cénit</span>
        <span className={`mt-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${onDark ? "text-highlight" : "text-text-muted"}`}>Fisiolab</span>
      </span>
    </span>
  );
}
