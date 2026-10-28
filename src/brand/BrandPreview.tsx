// La vista previa de Ajustes › Marca: dos móviles pequeños (claro y oscuro) con la pantalla de la agenda pintada con
// la marca que se está editando. Los colores, los radios y las letras van como variables en el propio recuadro, y el
// acabado como data-finish: las mismas clases de la app (bg-accent, rounded-md, text-text…) se pintan con la marca
// nueva sin tocar el resto de la página.
import type { CSSProperties } from "react";
import { cx } from "../ui/cx";
import { Logo, LogoMark } from "../ui/Logo";
import { tokensOf, type Brand } from "./brand";
import type { Tokens } from "./engine";
import { brandVars } from "./options";

const cssVars = (t: Tokens, b: Brand): CSSProperties => ({ ...Object.fromEntries(Object.entries(t).map(([k, v]) => [`--color-${k}`, v])), ...brandVars(b) }) as CSSProperties;

const ROWS: [string, string, string, string][] = [
  ["09:00", "Marta Ejemplo", "Primera visita", "Pendiente"],
  ["10:00", "Luis Prueba", "Sesión 3 de 8", ""],
  ["11:30", "Ana Ficticia", "Reevaluación", "Cobrar"],
];

function Phone({ brand, tokens, label }: { brand: Brand; tokens: Tokens; label: string }) {
  return (
    <figure className="m-0 flex min-w-0 flex-col items-center gap-1">
      <div className="w-full max-w-[220px] overflow-hidden rounded-[22px] border-[5px] border-[#1a1d1b] bg-[#1a1d1b] shadow-md">
        <div
          style={{ ...cssVars(tokens, brand), colorScheme: label === "Oscuro" ? "dark" : "light" }}
          data-finish={brand.finish === "matte" ? undefined : brand.finish}
          data-header={brand.header === "dark" ? undefined : brand.header}
          className="flex aspect-[9/17] flex-col overflow-hidden rounded-[17px] bg-canvas font-sans text-[10px] leading-tight text-text"
        >
          <div className="flex items-center gap-1.5 border-b-2 border-highlight bg-brand px-2 pt-5 pb-1.5 text-on-brand">
            <span className="scale-[0.72] origin-left">
              <Logo onDark brand={brand} />
            </span>
          </div>
          <div className="flex gap-1 px-2 pt-1.5 font-semibold text-text-muted">
            <span className="rounded-full bg-accent-soft px-2 py-0.5 text-accent">Hoy</span>
            <span className="px-2 py-0.5">Día</span>
            <span className="px-2 py-0.5">Semana</span>
          </div>
          <div className="flex flex-1 flex-col gap-1.5 p-2">
            <div className="flex items-baseline justify-between">
              <b className="font-display text-[12px]">Martes, 4 de noviembre</b>
              <span className="text-text-muted">5 citas</span>
            </div>
            {ROWS.map(([h, n, w, st]) => (
              <div key={h} className="flex items-center gap-2 rounded-lg border border-border bg-bg px-2 py-1.5">
                <b className="nums text-accent">{h}</b>
                <span className="min-w-0 flex-1">
                  <b className="block truncate">{n}</b>
                  <span className="text-text-muted">{w}</span>
                </span>
                {st && <span className={st === "Cobrar" ? "rounded-full bg-highlight px-1.5 py-0.5 text-[8px] font-bold text-on-highlight" : "rounded-full bg-accent px-1.5 py-0.5 text-[8px] font-bold text-on-accent"}>{st}</span>}
              </div>
            ))}
            <div className="rounded-lg border border-border bg-bg px-2 py-1.5">
              <span className="text-[7px] font-bold tracking-wider text-text-muted uppercase">Esta semana</span>
              <div className="mt-1 flex h-6 items-end gap-1">
                {[5, 7, 4, 8, 6].map((v, i) => (
                  <span key={i} className={i === 1 ? "flex-1 rounded-t-sm bg-highlight" : "flex-1 rounded-t-sm bg-accent"} style={{ height: v * 3 }} />
                ))}
              </div>
            </div>
            <span className="mt-auto flex gap-1.5">
              <span className="flex-1 rounded-md border border-border-input bg-bg py-1.5 text-center font-bold">Editar</span>
              <span className="flex-1 rounded-md bg-accent py-1.5 text-center font-bold text-on-accent">Nueva cita</span>
            </span>
          </div>
          <div className="flex justify-around border-t border-border bg-bg px-1 pt-1 pb-2 text-[7px] font-semibold text-text-muted">
            <span>Pacientes</span>
            <span className="text-accent">Agenda</span>
            <span>Biblioteca</span>
            <span>Ajustes</span>
          </div>
        </div>
      </div>
      <figcaption className="rounded-full bg-canvas px-2 text-sm text-text-muted">{label}</figcaption>
    </figure>
  );
}

/** Un informe en pequeño, siempre en claro y plano (como en papel): el membrete con sus opciones, el lema y el pie. */
function Paper({ brand, tokens }: { brand: Brand; tokens: Tokens }) {
  const lh = brand.letterhead;
  const center = lh.logo === "center";
  const left = lh.logo === "left";
  const who = (
    <span className={cx("flex items-start gap-1.5", center ? "flex-col items-center text-center" : left ? "flex-row-reverse text-left" : "text-right")}>
      <span className={cx("flex min-w-0 flex-col", center ? "items-center" : left ? "items-start" : "items-end")}>
        <b className="font-display text-[10px] leading-tight text-brand-ink">{brand.name.trim() || "Tu clínica"}</b>
        {brand.slogan && <span className="text-[7px] font-semibold text-brand-ink">{brand.slogan}</span>}
        {lh.contact && <span className="text-[6.5px] text-text-muted">NIF B12345678 · C/ Mayor 1 · 600 000 000</span>}
      </span>
      <LogoMark size={18} brand={brand} />
    </span>
  );
  return (
    <figure className="m-0 flex min-w-0 flex-col gap-1">
      <div style={{ ...cssVars(tokens, brand), colorScheme: "light" }} className="theme-light flex aspect-[1/1.2] flex-col gap-1.5 overflow-hidden rounded-md border border-border bg-white p-2.5 font-sans text-[7px] leading-tight text-text shadow-md">
        <header className={cx("flex gap-2 pb-1.5", center ? "flex-col items-center" : "items-start justify-between", left && "flex-row-reverse", lh.band ? "border-b-2 border-accent" : "border-b border-border")}>
          <span className={cx("flex flex-col", center && "items-center text-center")}>
            <b className="font-display text-[10px] text-brand-ink">Informe de fisioterapia</b>
            <span className="text-text-muted">Historia clínica y evolución · 4 de noviembre de 2026</span>
          </span>
          {who}
        </header>
        <b className="border-b border-brand-ink font-display text-[8px] text-brand-ink">Motivo de consulta</b>
        <span className="text-text-muted">Dolor de rodilla derecha al bajar escaleras desde hace tres semanas, sin traumatismo.</span>
        <b className="border-b border-brand-ink font-display text-[8px] text-brand-ink">Plan</b>
        <span className="text-text-muted">Ejercicio terapéutico progresivo y control en dos semanas.</span>
        <span className="mt-auto flex justify-between border-t border-border pt-1.5">
          <span>
            Firma del fisioterapeuta: <span className="inline-block min-w-16 border-b border-text-muted" />
          </span>
          <span>Fecha: 04/11/2026</span>
        </span>
        {lh.footer.trim() && <span className="border-t border-border pt-1 text-[6px] text-text-muted">{lh.footer.trim()}</span>}
        <span className="text-[6px] text-text-muted">Documento generado con OmniClin.</span>
      </div>
      <figcaption className="self-center rounded-full bg-canvas px-2 text-sm text-text-muted">Documentos</figcaption>
    </figure>
  );
}

export function BrandPreview({ brand }: { brand: Brand }) {
  const t = tokensOf(brand);
  return (
    <div aria-label="Vista previa de la marca" role="group" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <Phone brand={brand} tokens={t.light} label="Claro" />
      <Phone brand={brand} tokens={t.dark} label="Oscuro" />
      <Paper brand={brand} tokens={t.light} />
    </div>
  );
}
