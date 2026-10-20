// Piezas comunes de los informes imprimibles (el informe de fisioterapia y el de alta): el membrete con los datos de
// la clínica (o la marca de la app si aún no están en Ajustes) y los apartados con su título.
import type { ReactNode } from "react";
import type { ClinicInfo } from "../data/privacy";
import { LogoMark } from "../ui/Logo";

export function Letterhead({ clinic, title, subtitle }: { clinic: ClinicInfo; title: string; subtitle: string }) {
  const details = [clinic.taxId && `NIF ${clinic.taxId}`, clinic.address, clinic.phone, clinic.email].filter(Boolean).join(" · ");
  return (
    <header className="flex items-start justify-between gap-4 border-b border-border pb-3">
      <div className="flex flex-col">
        <span className="text-xl font-semibold text-brand" style={{ fontFamily: "var(--font-display)" }}>
          {title}
        </span>
        <span className="text-sm text-text-muted">{subtitle}</span>
      </div>
      {clinic.name ? (
        <span className="flex max-w-[55%] flex-col items-end text-right">
          <span className="text-lg font-semibold text-brand" style={{ fontFamily: "var(--font-display)" }}>
            {clinic.name}
          </span>
          {details && <span className="text-xs text-text-muted">{details}</span>}
        </span>
      ) : (
        <span className="flex items-center gap-2">
          <LogoMark size={36} />
          <span className="flex flex-col leading-none">
            <span className="text-lg font-semibold text-brand" style={{ fontFamily: "var(--font-display)" }}>
              Cénit
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">Fisiolab</span>
          </span>
        </span>
      )}
    </header>
  );
}

export function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="break-after-avoid border-b-2 border-brand pb-1 text-lg text-brand">{title}</h2>
      {children}
    </section>
  );
}

/** Firma del fisioterapeuta (el de Ajustes → Clínica) y la fecha, al pie. */
/** Lo que es la app: registra y organiza; no decide nada clínico (va al pie de los informes y en la ayuda). */
export const RECORD_ONLY = "Cénit registra y organiza; las decisiones clínicas son del profesional.";

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
      <p className="text-xs text-text-muted">{RECORD_ONLY}</p>
    </footer>
  );
}
