// Ajustes › Marca de la clínica: nombre y lema, dos colores (o una paleta lista), cabecera, letra, esquinas, acabado,
// logo y cómo se usan (src/brand/brand.ts, src/brand/options.ts). Lo que se cambia se ve al momento en la vista previa
// (claro y oscuro) y en la app solo al guardar. Sin marca guardada, la app es OmniClin; «Volver a la marca de OmniClin»
// la quita.
import { ImageUp, Trash2 } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { LoadError, Loading, Page } from "../app/Page";
import { useAsync } from "../app/useAsync";
import { useCloud } from "../cloud/CloudGate";
import { getDb } from "../data/db";
import { getClinic } from "../data/privacy";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { TextAreaField, TextField } from "../ui/Field";
import { LogoMark } from "../ui/Logo";
import { useToast } from "../ui/Toast";
import { brandProblem, emptyBrand, getBrand, MAX_FOOTER, MAX_NAME, MAX_SLOGAN, MAX_WELCOME, saveBrand, tokensOf, type Brand, type Letterhead } from "./brand";
import { BrandPreview } from "./BrandPreview";
import { contrast, isHex, scale } from "./engine";
import { logoColors, prepareLogo } from "./logo";
import { CORNERS, FINISHES, FONTS, HEADERS, loadFont, PALETTES, type Option } from "./options";

const LOGO_POSITIONS: Option<Letterhead["logo"]>[] = [
  { id: "right", label: "A la derecha", hint: "como hasta ahora" },
  { id: "left", label: "A la izquierda", hint: "y el título a la derecha" },
  { id: "center", label: "Centrado", hint: "logo y nombre arriba, el título debajo" },
];

/** Una opción entre varias (cabecera, esquinas, acabado, letra): botones de radio con su nombre y una pista. */
function Choices<T extends string>({ legend, name, options, value, onChange, render }: { legend: string; name: string; options: Option<T>[]; value: T; onChange: (v: T) => void; render?: (o: Option<T>) => ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="text-sm font-semibold">{legend}</legend>
      {options.map((o) => (
        <label key={o.id} className="flex min-h-11 cursor-pointer items-center gap-3">
          <input type="radio" name={name} className="size-5 shrink-0 accent-accent" checked={value === o.id} onChange={() => onChange(o.id)} />
          <span className="min-w-0">
            {render ? render(o) : o.label} <span className="text-text-muted">({o.hint})</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}

/** Las ocho paletas listas: dos muestras y el nombre; la que coincide con los colores puestos va marcada. */
function Palettes({ primary, secondary, onPick }: { primary: string; secondary: string; onPick: (primary: string, secondary: string) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm font-semibold">Paletas listas</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {PALETTES.map((p) => {
          const on = p.primary === primary && p.secondary === secondary;
          return (
            <button
              key={p.name}
              type="button"
              aria-label={`Paleta ${p.name}`}
              aria-pressed={on}
              onClick={() => onPick(p.primary, p.secondary)}
              className={`flex min-h-11 items-center gap-2 rounded-md border px-2 py-1 text-left text-sm ${on ? "border-accent bg-accent-soft font-semibold" : "border-border bg-bg hover:bg-surface"}`}
            >
              <span className="flex shrink-0 overflow-hidden rounded-sm" aria-hidden="true">
                <span className="block h-7 w-4" style={{ background: p.primary }} />
                <span className="block h-7 w-4" style={{ background: p.secondary }} />
              </span>
              <span className="min-w-0 leading-tight">{p.name}</span>
            </button>
          );
        })}
      </div>
      <p className="text-sm text-text-muted">Un toque y listo. Los dos colores se pueden afinar a mano debajo.</p>
    </div>
  );
}

/** Un color: el selector del navegador y su valor en hexadecimal, que también se puede escribir. */
function ColorField({ label, hint, value, onChange }: { label: string; hint: string; value: string; onChange: (hex: string) => void }) {
  const id = useId();
  // Lo que se está escribiendo mientras aún no es un color válido; en cuanto lo es, manda el valor de fuera.
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? value;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="color"
          value={isHex(value) ? value : "#000000"}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="h-11 w-14 shrink-0 cursor-pointer rounded-md border border-border-input bg-bg p-1"
        />
        <input
          type="text"
          aria-label={`${label} en hexadecimal`}
          value={text}
          maxLength={7}
          spellCheck={false}
          onChange={(e) => {
            const v = e.target.value.trim();
            if (isHex(v)) {
              setDraft(null);
              onChange(v.toUpperCase());
            } else setDraft(v);
          }}
          onBlur={() => setDraft(null)}
          className="h-11 w-28 rounded-md border border-border-input bg-bg px-3 font-mono text-base text-text"
        />
      </div>
      <p className="text-sm text-text-muted">{hint}</p>
    </div>
  );
}

function Swatches({ hex, label }: { hex: string; label: string }) {
  return (
    <div>
      <p className="mb-1 text-sm text-text-muted">{label}</p>
      <div className="grid grid-cols-10 gap-1" aria-hidden="true">
        {scale(hex).map((s) => {
          // ✓: sirve para texto sobre blanco. El número, en blanco o negro, el que más se lea (siempre más de 4,5:1).
          const onWhite = contrast(s.hex, "#FFFFFF") >= 4.5;
          const ink = contrast(s.hex, "#FFFFFF") >= contrast(s.hex, "#000000") ? "#FFFFFF" : "#000000";
          return (
            <span key={s.step} title={s.hex} className="flex h-9 items-end justify-center rounded-sm pb-0.5 font-mono text-[10px]" style={{ background: s.hex, color: ink }}>
              {s.step}
              {onWhite ? "✓" : ""}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function BrandPage() {
  const cloud = useCloud();
  const toast = useToast();
  const data = useAsync(async () => {
    const db = getDb();
    const [saved, clinic] = await Promise.all([getBrand(db), getClinic(db)]);
    return { saved, clinicName: clinic.name || cloud?.clinic?.name || "" };
  }, []);
  if (data.error) return <Page title="Marca de la clínica" backTo="/ajustes"><LoadError error={data.error} /></Page>;
  if (!data.data) return <Page title="Marca de la clínica" backTo="/ajustes"><Loading /></Page>;
  return <BrandForm key={JSON.stringify(data.data.saved)} saved={data.data.saved} clinicName={data.data.clinicName} onSaved={data.reload} toast={toast} />;
}

function BrandForm({ saved, clinicName, onSaved, toast }: { saved: Brand | null; clinicName: string; onSaved: () => void; toast: ReturnType<typeof useToast> }) {
  const [b, setB] = useState<Brand>(saved ?? emptyBrand(clinicName));
  const [suggested, setSuggested] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"save" | "reset" | "logo" | null>(null);
  const [forced, setForced] = useState(b.accentOverride ?? "");
  const file = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<Brand>) => setB((v) => ({ ...v, ...patch }));
  const t = tokensOf(b);
  const forcedRatio = isHex(forced) ? contrast(forced, t.light.surface!) : null;
  // La letra elegida se carga para que la vista previa (y la app al guardar) la enseñen de verdad.
  useEffect(() => void loadFont(b.font), [b.font]);

  async function pickLogo(f: File | undefined) {
    if (!f) return;
    setBusy("logo");
    setError(null);
    try {
      const logo = await prepareLogo(f);
      set({ logo });
      setSuggested(await logoColors(logo).catch(() => []));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se ha podido leer el logo.");
    } finally {
      setBusy(null);
      if (file.current) file.current.value = "";
    }
  }

  async function save(brand: Brand | null) {
    setBusy(brand ? "save" : "reset");
    setError(null);
    try {
      if (brand) {
        const problem = brandProblem(brand);
        if (problem) return setError(problem);
      }
      await saveBrand(getDb(), brand);
      toast(brand ? "Marca guardada: ya se ve en toda la app" : "Vuelve la marca de OmniClin", "success");
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se ha podido guardar.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Page title="Marca de la clínica" backTo="/ajustes" width="record">
      <p className="text-text-muted">
        Tu nombre, tus colores, tu letra y tu logo en la app, en la página que abren tus pacientes y en los documentos. Con dos colores basta: los tonos, el modo
        oscuro y que el texto se lea bien los calcula la app. Lo demás (cabecera, letra, esquinas, acabado) es opcional.
      </p>
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start lg:gap-6">
        <form
          className="flex flex-col gap-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void save({ ...b, accentOverride: forced.trim() || null });
          }}
        >
          <Card className="flex flex-col gap-4">
            <TextField label="Nombre de la clínica" maxLength={MAX_NAME} autoComplete="organization" value={b.name} onChange={(e) => set({ name: e.target.value })} hint="Se ve en la barra, en la pestaña y en los documentos." />
            <TextField label="Lema" maxLength={MAX_SLOGAN} value={b.slogan} onChange={(e) => set({ slogan: e.target.value })} placeholder="Opcional" hint="Una línea bajo el nombre en los documentos y en la página del paciente." />
          </Card>

          <Card className="flex flex-col gap-4">
            <h2 className="text-lg">Colores</h2>
            <Palettes primary={b.primary} secondary={b.secondary} onPick={(primary, secondary) => set({ primary, secondary })} />
            <div className="grid gap-4 sm:grid-cols-2">
              <ColorField label="Color principal" hint="Botones, cabecera y enlaces." value={b.primary} onChange={(primary) => set({ primary })} />
              <ColorField label="Color de acento" hint="La línea de la cabecera y los destacados." value={b.secondary} onChange={(secondary) => set({ secondary })} />
            </div>
            {t.light.accent !== b.primary && !b.accentOverride && (
              <p className="text-sm text-text-muted">
                En los botones y enlaces tu color principal se oscurece un poco ({t.light.accent}) para que el texto se lea; en fondos y etiquetas va tal cual.
              </p>
            )}
          </Card>

          <Card className="flex flex-col gap-4">
            <h2 className="text-lg">Aspecto</h2>
            <Choices legend="La barra de arriba" name="cabecera" options={HEADERS} value={b.header} onChange={(header) => set({ header })} />
            <Choices
              legend="La letra"
              name="letra"
              options={FONTS}
              value={b.font}
              onChange={(font) => set({ font })}
              render={(o) => {
                const f = FONTS.find((x) => x.id === o.id)!;
                return (
                  <>
                    <span className="text-lg leading-none font-bold" style={{ fontFamily: f.display }} aria-hidden="true">
                      Ag{" "}
                    </span>
                    {o.label}
                  </>
                );
              }}
            />
            <Choices legend="Las esquinas de botones, campos y tarjetas" name="esquinas" options={CORNERS} value={b.corners} onChange={(corners) => set({ corners })} />
            <Choices legend="El acabado de los colores" name="acabado" options={FINISHES} value={b.finish} onChange={(finish) => set({ finish })} />
            <p className="text-sm text-text-muted">Las etiquetas redondas siguen redondas. Los documentos van siempre planos y en claro, como en papel.</p>
          </Card>

          <Card className="flex flex-col gap-3">
            <h2 className="text-lg">Logo</h2>
            <div className="flex items-center gap-4">
              <span className="flex size-16 items-center justify-center rounded-lg border border-border bg-surface">
                <LogoMark size={48} brand={b} />
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <input ref={file} type="file" accept="image/png,image/svg+xml,image/jpeg,image/webp" className="sr-only" aria-label="Elegir el archivo del logo" onChange={(e) => void pickLogo(e.target.files?.[0])} />
                <Button type="button" variant="secondary" icon={<ImageUp aria-hidden="true" className="size-5" />} loading={busy === "logo"} onClick={() => file.current?.click()}>
                  {b.logo ? "Cambiar el logo" : "Subir el logo"}
                </Button>
                {b.logo && (
                  <Button type="button" variant="ghost" icon={<Trash2 aria-hidden="true" className="size-5" />} onClick={() => set({ logo: null })}>
                    Quitar el logo
                  </Button>
                )}
              </div>
            </div>
            <p className="text-sm text-text-muted">PNG con fondo transparente o SVG. Sin logo se usa la inicial del nombre sobre tu color.</p>
            {suggested.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 rounded-md bg-warning-soft p-3 text-sm">
                <span>Colores que salen del logo:</span>
                {suggested.map((h) => (
                  <span key={h} className="inline-flex items-center gap-1">
                    <span className="inline-block size-6 rounded-md border border-border" style={{ background: h }} aria-hidden="true" />
                    <code className="font-mono">{h}</code>
                  </span>
                ))}
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    set({ primary: suggested[0]!, ...(suggested[1] ? { secondary: suggested[1] } : {}) });
                    setSuggested([]);
                  }}
                >
                  Usar estos colores
                </Button>
              </div>
            )}
            <fieldset className="flex flex-col gap-1">
              <legend className="text-sm font-semibold">En la barra y en modo oscuro, el logo va…</legend>
              {[
                [true, "sobre una placa blanca", "si tiene partes oscuras o transparentes"],
                [false, "tal cual", "si ya se ve bien sobre fondo oscuro"],
              ].map(([v, label, hint]) => (
                <label key={String(v)} className="flex min-h-11 cursor-pointer items-center gap-3">
                  <input type="radio" name="placa" className="size-5 accent-accent" checked={b.logoPlate === v} onChange={() => set({ logoPlate: v as boolean })} />
                  <span>
                    {label as string} <span className="text-text-muted">({hint as string})</span>
                  </span>
                </label>
              ))}
            </fieldset>
          </Card>

          <Card className="flex flex-col gap-4">
            <h2 className="text-lg">Documentos</h2>
            <p className="text-sm text-text-muted">Informes, altas, derivaciones, justificantes, recibos y hojas de ejercicios. Lo que cambies vale para los que se generen a partir de ahora; los consentimientos ya firmados no cambian.</p>
            <Choices legend="El logo en el membrete" name="membrete" options={LOGO_POSITIONS} value={b.letterhead.logo} onChange={(logo) => set({ letterhead: { ...b.letterhead, logo } })} />
            <label className="flex min-h-11 cursor-pointer items-center gap-3">
              <input type="checkbox" className="size-5 shrink-0 accent-accent" checked={b.letterhead.contact} onChange={(e) => set({ letterhead: { ...b.letterhead, contact: e.target.checked } })} />
              <span>
                Datos de contacto bajo el nombre <span className="text-text-muted">(NIF, dirección, teléfono y correo de Ajustes › Clínica)</span>
              </span>
            </label>
            <label className="flex min-h-11 cursor-pointer items-center gap-3">
              <input type="checkbox" className="size-5 shrink-0 accent-accent" checked={b.letterhead.band} onChange={(e) => set({ letterhead: { ...b.letterhead, band: e.target.checked } })} />
              <span>Banda de color bajo el membrete</span>
            </label>
            <label className="flex min-h-11 cursor-pointer items-center gap-3">
              <input type="checkbox" className="size-5 shrink-0 accent-accent" checked={b.watermark} onChange={(e) => set({ watermark: e.target.checked })} />
              <span>Marca de agua con el logo</span>
            </label>
            <TextField
              label="Pie de página propio"
              maxLength={MAX_FOOTER}
              value={b.letterhead.footer}
              onChange={(e) => set({ letterhead: { ...b.letterhead, footer: e.target.value } })}
              placeholder="Opcional: web, redes, nº de registro sanitario…"
              hint="Va junto a la firma, encima de «Documento generado con OmniClin»."
            />
            <p className="text-sm text-text-muted">
              La firma dibujada de cada fisio se pone en{" "}
              <Link to="/ajustes/clinica" className="font-semibold text-accent underline">
                Ajustes › Clínica
              </Link>
              .
            </p>
          </Card>

          <Card className="flex flex-col gap-4">
            <h2 className="text-lg">Página del paciente</h2>
            <p className="text-sm text-text-muted">La que abre el paciente para rellenar la anamnesis, un cuestionario o subir sus informes. Lleva tu marca, tu letra y tu acabado.</p>
            <TextAreaField
              label="Texto de bienvenida"
              maxLength={MAX_WELCOME}
              rows={2}
              value={b.patient.welcome}
              onChange={(e) => set({ patient: { ...b.patient, welcome: e.target.value } })}
              placeholder="Opcional. Por ejemplo: Gracias por rellenarlo antes de venir: así aprovechamos mejor tu primera visita."
              hint="Debajo del «Hola, nombre»."
            />
            <label className="flex min-h-11 cursor-pointer items-center gap-3">
              <input type="checkbox" className="size-5 shrink-0 accent-accent" checked={b.patient.contact} onChange={(e) => set({ patient: { ...b.patient, contact: e.target.checked } })} />
              <span>
                Teléfono y correo de la clínica al pie <span className="text-text-muted">(los de Ajustes › Clínica)</span>
              </span>
            </label>
          </Card>

          <details className="rounded-lg border border-border bg-bg">
            <summary className="flex min-h-11 cursor-pointer items-center px-4 font-semibold">Avanzado: los tonos y el color de los botones</summary>
            <div className="flex flex-col gap-4 px-4 pb-4">
              <p className="text-sm text-text-muted">La escala de cada color, de claro (50) a oscuro (900). Los tonos con ✓ sirven para texto sobre blanco; los demás, para fondos.</p>
              <Swatches hex={b.primary} label="Color principal" />
              <Swatches hex={b.secondary} label="Color de acento" />
              <TextField
                label="Forzar el color de los botones (hexadecimal)"
                value={forced}
                maxLength={7}
                spellCheck={false}
                placeholder="Vacío: lo elige la app"
                onChange={(e) => setForced(e.target.value.trim().toUpperCase())}
                hint="Solo en modo claro. En oscuro se corrige siempre."
                error={forced && !isHex(forced) ? "Escríbelo como #1F6B4F." : undefined}
              />
              {forcedRatio !== null && forcedRatio < 4.5 && (
                <Alert tone="warning" title={`Ese tono da ${forcedRatio.toFixed(1)}:1 de contraste (el mínimo es 4,5)`}>
                  Se puede guardar, pero el texto de los botones y los enlaces se leerá mal.
                </Alert>
              )}
            </div>
          </details>

          {error && <Alert tone="danger" title={error} />}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="submit" size="lg" loading={busy === "save"} disabled={busy !== null}>
              Guardar la marca
            </Button>
            {saved && (
              <Button type="button" variant="secondary" size="lg" loading={busy === "reset"} disabled={busy !== null} onClick={() => void save(null)}>
                Volver a la marca de OmniClin
              </Button>
            )}
          </div>
          <p className="text-sm text-text-muted">
            El icono de la app instalada en el móvil no cambia hasta que se desinstala y se vuelve a instalar. Claro u oscuro se elige en cada dispositivo, en{" "}
            <Link to="/ajustes/aspecto" className="font-semibold text-accent underline">
              Aspecto
            </Link>
            .
          </p>
        </form>
        <div className="flex flex-col gap-2 lg:sticky lg:top-20">
          <h2 className="text-lg">Así se verá</h2>
          <BrandPreview brand={{ ...b, accentOverride: isHex(forced) ? forced : null }} />
        </div>
      </div>
    </Page>
  );
}
