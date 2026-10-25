// La marca que se ve en la barra, en la entrada y en los documentos. Sin marca de clínica (src/brand/brand.ts) es la
// de Cénit: una «C» que es también el arco de un goniómetro, con el sol de oro en su punto más alto (el cénit: lo
// máximo de un salto, de una velocidad o de un recorrido). Dibujo propio; mismo trazo que tools/build-icons.py.
// Con marca de clínica: su logo (o su inicial sobre su color) y su nombre.
import { initialOf, useBrand, type Brand } from "../brand/brand";
import { cx } from "./cx";

type MarkProps = {
  size?: number;
  title?: string;
  /** Va sobre la cabecera oscura (la barra): el de Cénit lleva borde dorado; el de la clínica, placa si la pidió. */
  bordered?: boolean;
  /** Una marca concreta (la vista previa de Ajustes); sin esto, la que está puesta. */
  brand?: Brand | null;
};

/** Símbolo: se ve bien desde 16 px. */
export function LogoMark({ size = 28, title, bordered, brand: given }: MarkProps) {
  const applied = useBrand();
  const brand = given === undefined ? applied : given;
  if (brand) return <BrandMark size={size} title={title} bordered={bordered} brand={brand} />;
  const base = "var(--color-brand)";
  const stroke = "var(--color-on-brand)";
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role={title ? "img" : undefined} aria-hidden={title ? undefined : true}>
      {title && <title>{title}</title>}
      {/* Sobre el mismo verde (la barra de arriba), un borde dorado lo separa del fondo. */}
      {bordered ? <rect x="2.5" y="2.5" width="95" height="95" rx="24" fill={base} stroke="var(--color-highlight)" strokeWidth="5" /> : <rect width="100" height="100" rx="26" fill={base} />}
      {/* La C abre a la derecha: se corre un poco a la derecha y arriba para que se vea en medio del cuadrado. */}
      <g transform="translate(3 -2)">
        <path d="M70.68 39.64 A27 27 0 1 0 70.68 74.36" fill="none" stroke={stroke} strokeWidth="9" strokeLinecap="round" />
        <circle cx="50" cy="30" r="14" fill={base} />
        <circle cx="50" cy="30" r="9.5" fill="var(--color-highlight)" />
      </g>
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
        <span className="flex flex-col leading-none">
          <span className={cx("font-display text-[22px] font-semibold tracking-tight", onDark ? "text-on-brand" : "text-brand-ink")}>Cénit</span>
          <span className={cx("mt-0.5 text-[10px] font-semibold uppercase tracking-[0.16em]", onDark ? "text-highlight" : "text-text-muted")}>Fisiolab</span>
        </span>
      )}
    </span>
  );
}
