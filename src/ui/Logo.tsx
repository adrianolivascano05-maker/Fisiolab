// Marca de Impulso: la trayectoria de un salto (parábola del despegue al aterrizaje) con un punto en lo más
// alto, que es lo que mide la app, sobre la línea del suelo. Dibujo propio; mismo trazo que tools/build-icons.py.

/** Símbolo: se ve bien desde 16 px. */
export function LogoMark({ size = 28, title }: { size?: number; title?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role={title ? "img" : undefined} aria-hidden={title ? undefined : true}>
      {title && <title>{title}</title>}
      <rect width="100" height="100" rx="24" fill="var(--color-accent)" />
      <path d="M18 72 Q50 0 82 72" fill="none" stroke="var(--color-on-accent)" strokeWidth="7" strokeLinecap="round" />
      <circle cx="50" cy="36" r="8.5" fill="var(--color-on-accent)" />
      <line x1="14" y1="83" x2="86" y2="83" stroke="var(--color-on-accent)" strokeWidth="6" strokeLinecap="round" opacity="0.55" />
    </svg>
  );
}

/** Símbolo + nombre, para la cabecera de la pantalla principal. */
export function Logo() {
  return (
    <span className="flex items-center gap-2">
      <LogoMark size={30} />
      <span className="flex flex-col leading-none">
        <span className="text-lg tracking-tight">Impulso</span>
        <span className="text-xs font-medium text-text-muted">Fisiolab</span>
      </span>
    </span>
  );
}
