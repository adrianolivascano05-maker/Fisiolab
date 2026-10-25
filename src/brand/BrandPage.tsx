// Ajustes › Marca de la clínica: nombre, dos colores, logo y cómo se usan (src/brand/brand.ts). Lo que se cambia
// se ve al momento en la vista previa (claro y oscuro) y en la app solo al guardar. Sin marca guardada, la app es
// Cénit; «Volver a la marca de Cénit» la quita.
import { ImageUp, Trash2 } from "lucide-react";
import { useId, useRef, useState } from "react";
import { Link } from "react-router";
import { LoadError, Loading, Page } from "../app/Page";
import { useAsync } from "../app/useAsync";
import { useCloud } from "../cloud/CloudGate";
import { getDb } from "../data/db";
import { getClinic } from "../data/privacy";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { TextField } from "../ui/Field";
import { LogoMark } from "../ui/Logo";
import { useToast } from "../ui/Toast";
import { brandProblem, emptyBrand, getBrand, MAX_NAME, saveBrand, tokensOf, type Brand } from "./brand";
import { BrandPreview } from "./BrandPreview";
import { contrast, isHex, scale } from "./engine";
import { logoColors, prepareLogo } from "./logo";

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
          const onWhite = contrast(s.hex, "#FFFFFF") >= 4.5;
          return (
            <span key={s.step} title={s.hex} className="flex h-9 items-end justify-center rounded-sm pb-0.5 font-mono text-[10px]" style={{ background: s.hex, color: onWhite ? "#fff" : "#16201B" }}>
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
      toast(brand ? "Marca guardada: ya se ve en toda la app" : "Vuelve la marca de Cénit", "success");
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
        Tu nombre, tus colores y tu logo en la app, en la página que abren tus pacientes y en los documentos. Con dos colores basta: los tonos, el modo oscuro y
        que el texto se lea bien los calcula la app.
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

          <Card className="flex flex-col gap-2">
            <label className="flex min-h-11 cursor-pointer items-center gap-3 font-semibold">
              <input type="checkbox" className="size-5 accent-accent" checked={b.watermark} onChange={(e) => set({ watermark: e.target.checked })} />
              Marca de agua con el logo en los documentos
            </label>
            <p className="text-sm text-text-muted">Se aplicará a los documentos que se generen a partir de ahora. Los ya firmados no cambian.</p>
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
                Volver a la marca de Cénit
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
