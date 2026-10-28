// Piezas comunes de los documentos imprimibles (informes, alta, derivación, justificante, recibo, ejercicios): el
// membrete con la marca y los datos de la clínica (o la marca de la app si aún no están en Ajustes), la marca de
// agua y los apartados con su título. Los documentos se generan cada vez: llevan la marca que haya ahora.
import type { ReactNode } from "react";
import { useBrand } from "../brand/brand";
import { MADE_WITH, Watermark } from "../brand/docs";
import type { ClinicInfo } from "../data/privacy";
import { LogoMark, Wordmark } from "../ui/Logo";

export function Letterhead({ clinic, title, subtitle }: { clinic: ClinicInfo; title: string; subtitle: string }) {
  const brand = useBrand();
  const details = [clinic.taxId && `NIF ${clinic.taxId}`, clinic.address, clinic.phone, clinic.email].filter(Boolean).join(" · ");
  return (
    <header className="flex items-start justify-between gap-4 border-b border-border pb-3">
      <Watermark brand={brand} />
      <div className="flex flex-col">
        <span className="text-xl font-semibold text-brand-ink" style={{ fontFamily: "var(--font-display)" }}>
          {title}
        </span>
        <span className="text-sm text-text-muted">{subtitle}</span>
      </div>
      {brand ? (
        <span className="flex max-w-[55%] items-start justify-end gap-2 text-right">
          <span className="flex min-w-0 flex-col items-end">
            <span className="text-lg leading-tight font-semibold text-brand-ink" style={{ fontFamily: "var(--font-display)" }}>
              {brand.name}
            </span>
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

/** Firma del fisioterapeuta (el de Ajustes → Clínica) y la fecha, al pie. */
/** Lo que es la app: registra y organiza; no decide nada clínico (va al pie de los informes y en la ayuda). */
export const RECORD_ONLY = "OmniClin registra y organiza; las decisiones clínicas son del profesional.";

export function SignatureLine({ name, license, date }: { name: string; license: string; date: string }) {
  return (
    <footer className="mt-4 flex flex-col gap-3 border-t border-border pt-4 text-sm">
      <div className="flex flex-wrap justify-between gap-6">
        <span>
          Firma del fisioterapeuta: <span className="inline-block min-w-48 border-b border-text-muted">{name}</span>
          {license && <span className="block text-text-muted">Nº de colegiado {license}</span>}
        </span>
        <span>Fecha: {date}</span>
      </div>
      <p className="text-xs text-text-muted">
        {MADE_WITH} {RECORD_ONLY}
      </p>
    </footer>
  );
}
