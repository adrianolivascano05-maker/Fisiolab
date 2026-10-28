// Piezas comunes de los documentos imprimibles (informes, alta, derivación, justificante, recibo, ejercicios): el
// membrete con la marca y los datos de la clínica (o la marca de la app si aún no están en Ajustes), la marca de
// agua y los apartados con su título. Los documentos se generan cada vez: llevan la marca que haya ahora. Con marca,
// el membrete sigue sus opciones (src/brand/brand.ts, `letterhead`): el logo a la derecha, a la izquierda o centrado,
// el lema, con o sin datos de contacto, la banda de color y un pie propio junto a la firma.
import { useEffect, useState, type ReactNode } from "react";
import { useBrand } from "../brand/brand";
import { MADE_WITH, Watermark } from "../brand/docs";
import { getSignature } from "../brand/signature";
import { getDb } from "../data/db";
import type { ClinicInfo } from "../data/privacy";
import { cx } from "../ui/cx";
import { LogoMark, Wordmark } from "../ui/Logo";

export function Letterhead({ clinic, title, subtitle }: { clinic: ClinicInfo; title: string; subtitle: string }) {
  const brand = useBrand();
  const lh = brand?.letterhead ?? { logo: "right" as const, contact: true, band: false, footer: "" };
  const details = lh.contact ? [clinic.taxId && `NIF ${clinic.taxId}`, clinic.address, clinic.phone, clinic.email].filter(Boolean).join(" · ") : "";
  const center = !!brand && lh.logo === "center";
  const left = !!brand && lh.logo === "left";
  const heading = (
    <div className={cx("flex flex-col", center && "items-center text-center")}>
      <span className="text-xl font-semibold text-brand-ink" style={{ fontFamily: "var(--font-display)" }}>
        {title}
      </span>
      <span className="text-sm text-text-muted">{subtitle}</span>
    </div>
  );
  return (
    <header
      className={cx("flex gap-4 pb-3", center ? "flex-col items-center" : "items-start justify-between", left && "flex-row-reverse", lh.band && brand ? "border-b-[3px] border-accent" : "border-b border-border")}
      data-letterhead={brand ? lh.logo : undefined}
    >
      <Watermark brand={brand} />
      {heading}
      {brand ? (
        <span className={cx("flex items-start gap-2", center ? "flex-col items-center text-center" : left ? "max-w-[55%] flex-row-reverse text-left" : "max-w-[55%] justify-end text-right")}>
          <span className={cx("flex min-w-0 flex-col", center ? "items-center" : left ? "items-start" : "items-end")}>
            <span className="text-lg leading-tight font-semibold text-brand-ink" style={{ fontFamily: "var(--font-display)" }}>
              {brand.name}
            </span>
            {brand.slogan && <span className="text-sm font-semibold text-brand-ink">{brand.slogan}</span>}
            {details && <span className="text-xs text-text-muted">{details}</span>}
          </span>
          <LogoMark size={40} brand={brand} />
        </span>
      ) : clinic.name ? (
        <span className="flex max-w-[55%] flex-col items-end text-right">
          <span className="text-lg font-semibold text-brand-ink" style={{ fontFamily: "var(--font-display)" }}>
            {clinic.name}
          </span>
          {details && <span className="text-xs text-text-muted">{details}</span>}
        </span>
      ) : (
        <span className="flex items-center gap-2">
          <LogoMark size={36} />
          <Wordmark className="text-lg" />
        </span>
      )}
    </header>
  );
}

export function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="break-after-avoid border-b-2 border-brand-ink pb-1 text-lg text-brand-ink">{title}</h2>
      {children}
    </section>
  );
}

/** Lo que es la app: registra y organiza; no decide nada clínico (va al pie de los informes y en la ayuda). */
export const RECORD_ONLY = "OmniClin registra y organiza; las decisiones clínicas son del profesional.";

/** La firma dibujada de quien usa la app (Ajustes › Clínica), si la tiene; null mientras se lee o si no la hay. */
function usePhysioSignature(): string | null {
  const [png, setPng] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    getSignature(getDb())
      .then((v) => alive && setPng(v))
      .catch(() => {});
    return () => void (alive = false);
  }, []);
  return png;
}

/**
 * Firma del fisioterapeuta (el de Ajustes → Clínica) y la fecha, al pie. Con firma dibujada en Ajustes › Clínica, va
 * sobre la línea (y así sale en el PDF, que es una foto del documento). Debajo, el pie propio de la clínica si lo puso
 * en Ajustes › Marca, y siempre quién hace el programa.
 */
export function SignatureLine({ name, license, date }: { name: string; license: string; date: string }) {
  const brand = useBrand();
  const signature = usePhysioSignature();
  const footer = brand?.letterhead?.footer ?? "";
  return (
    <footer className="mt-4 flex flex-col gap-3 border-t border-border pt-4 text-sm">
      <div className="flex flex-wrap justify-between gap-6">
        <span>
          Firma del fisioterapeuta:{" "}
          <span className="relative inline-block min-w-48 border-b border-text-muted align-baseline">
            {signature && <img src={signature} alt={`Firma de ${name || "la persona que firma"}`} className="pointer-events-none absolute bottom-0 left-2 h-14 w-auto max-w-[12rem]" />}
            {name}
          </span>
          {license && <span className="block text-text-muted">Nº de colegiado {license}</span>}
        </span>
        <span>Fecha: {date}</span>
      </div>
      {footer && <p className="break-inside-avoid border-t border-border pt-2 text-xs text-text-muted">{footer}</p>}
      <p className="text-xs text-text-muted">
        {MADE_WITH} {RECORD_ONLY}
      </p>
    </footer>
  );
}
