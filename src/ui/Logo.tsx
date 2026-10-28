// La marca que se ve en la barra, en la entrada y en los documentos. Sin marca de clínica (src/brand/brand.ts) es la
// de OmniClin: un anillo de tres arcos (medir · organizar · acompañar) con el sol de oro arriba. Dibujo propio; mismo
// trazo que tools/build-icons.py (ARCS y SUN). Con marca de clínica: su logo (o su inicial sobre su color) y su nombre.
import { initialOf, useBrand, type Brand } from "../brand/brand";
import { cx } from "./cx";

type MarkProps = {
  size?: number;
  title?: string;
  /** Va sobre la cabecera oscura (la barra): el de OmniClin lleva borde dorado; el de la clínica, placa si la pidió. */
  bordered?: boolean;
  /** Una marca concreta (la vista previa de Ajustes); sin esto, la que está puesta. */
  brand?: Brand | null;
};

/**
 * El anillo de OmniClin en una caja de 100: centro (50, 52), radio 27, trazo 9. Tres arcos con huecos en lo alto, abajo
 * a la derecha y abajo a la izquierda (−90°, 30° y 150°, 12° a cada lado); el sol de oro tapa el hueco de arriba.
 */
export const RING = { cx: 50, cy: 52, r: 27, width: 9, gap: 12, sun: { cx: 50, cy: 25, r: 7.65 } };
/** Los tres arcos (grados, 0 = a la derecha, en el sentido de las agujas): arriba a la derecha, abajo, arriba a la izquierda. */
export const ARCS: [number, number][] = [
  [-90 + RING.gap, 30 - RING.gap],
  [30 + RING.gap, 150 - RING.gap],
  [150 + RING.gap, 270 - RING.gap],
];

function arcPath([from, to]: [number, number]) {
  const at = (deg: number) => [RING.cx + RING.r * Math.cos((deg * Math.PI) / 180), RING.cy + RING.r * Math.sin((deg * Math.PI) / 180)].map((n) => n.toFixed(2)).join(" ");
  return `M ${at(from)} A ${RING.r} ${RING.r} 0 0 1 ${at(to)}`;
}

/** Símbolo: se ve bien desde 16 px. */
export function LogoMark({ size = 28, title, bordered, brand: given }: MarkProps) {
  const applied = useBrand();
  const brand = given === undefined ? applied : given;
  if (brand) return <BrandMark size={size} title={title} bordered={bordered} brand={brand} />;
  const base = "var(--color-brand)";
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role={title ? "img" : undefined} aria-hidden={title ? undefined : true}>
      {title && <title>{title}</title>}
      {/* Sobre el mismo verde (la barra de arriba), un borde dorado lo separa del fondo. */}
      {bordered ? <rect x="2.5" y="2.5" width="95" height="95" rx="24" fill={base} stroke="var(--color-highlight)" strokeWidth="5" /> : <rect width="100" height="100" rx="24" fill={base} />}
      {ARCS.map((arc, i) => (
        <path key={i} d={arcPath(arc)} fill="none" stroke={i === 1 ? "var(--color-on-brand-accent)" : "var(--color-on-brand)"} strokeWidth={RING.width} strokeLinecap="round" />
      ))}
      <circle cx={RING.sun.cx} cy={RING.sun.cy} r={RING.sun.r} fill="var(--color-highlight)" />
    </svg>
  );
}

/** El logo de la clínica (o su inicial), del tamaño pedido; con placa blanca en fondos oscuros si la clínica lo quiere. */
function BrandMark({ size, title, bordered, brand }: Required<Pick<MarkProps, "size" | "brand">> & Pick<MarkProps, "title" | "bordered"> & { brand: Brand }) {
  const radius = Math.round(size * 0.26);
  if (brand.logo) {
    // La placa: fondo blanco en la barra (siempre oscura) y en modo oscuro (clase en index.css).
    const plate = brand.logoPlate ? (bordered ? "logo-plate-on" : "logo-plate") : "";
    const pad = brand.logoPlate ? Math.max(2, Math.round(size * 0.08)) : 0;
    return (
      <span className={cx("inline-flex shrink-0 overflow-hidden", plate)} style={{ borderRadius: radius, padding: pad }} role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
        <img src={brand.logo} alt="" width={size - pad * 2} height={size - pad * 2} className="block object-contain" style={{ width: size - pad * 2, height: size - pad * 2 }} />
      </span>
    );
  }
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center font-display font-bold leading-none"
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        fontSize: Math.round(size * 0.55),
        background: bordered ? "var(--color-on-brand)" : "var(--color-accent)",
        color: bordered ? "var(--color-brand)" : "var(--color-on-accent)",
      }}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {initialOf(brand.name)}
    </span>
  );
}

/** El nombre como en el logo: «Omni» en el color de la marca y «Clin» en el verde (menta sobre fondo oscuro). */
export function Wordmark({ onDark, className }: { onDark?: boolean; className?: string }) {
  return (
    <span className={cx("font-display leading-none font-bold tracking-tight", className)}>
      <span className={onDark ? "text-on-brand" : "text-brand-ink"}>Omni</span>
      <span className={onDark ? "text-on-brand-accent" : "text-accent"}>Clin</span>
    </span>
  );
}

/** Símbolo + nombre, para la cabecera de la pantalla principal. */
export function Logo({ onDark, brand: given }: { onDark?: boolean; brand?: Brand | null }) {
  const applied = useBrand();
  const brand = given === undefined ? applied : given;
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <LogoMark size={34} bordered={onDark} brand={brand} />
      {/* Con nombre largo, la barra sigue dejando sitio al título y a las acciones: se corta con «…». */}
      {brand ? (
        <span className={cx("min-w-0 max-w-[42vw] truncate font-display text-[18px] leading-tight font-semibold tracking-tight sm:max-w-[200px]", onDark ? "text-on-brand" : "text-brand-ink")}>{brand.name}</span>
      ) : (
        <Wordmark onDark={onDark} className="text-[22px]" />
      )}
    </span>
  );
}
