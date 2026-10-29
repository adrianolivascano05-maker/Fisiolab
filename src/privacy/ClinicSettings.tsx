// Ajustes → Clínica y protección de datos: los datos del responsable del tratamiento para el texto informativo y los
// consentimientos, cuántos años se conserva la historia clínica y el contrato con el proveedor de la nube.
import { useEffect, useState } from "react";
import { useCloud } from "../cloud/cloudContext";
import { getDb } from "../data/db";
import { getClinic, MIN_RETENTION_YEARS, saveClinic, type ClinicInfo } from "../data/privacy";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { NumberField, TextField } from "../ui/Field";
import { useToast } from "../ui/Toast";

export function ClinicSettings() {
  const cloud = useCloud();
  const toast = useToast();
  const [c, setC] = useState<ClinicInfo | null>(null);
  const [years, setYears] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    void getClinic(getDb()).then((clinic) => {
      setC(clinic);
      setYears(String(clinic.retentionYears));
    });
  }, []);
  if (!c) return null;
  const server = cloud?.sync.store.kind === "server";
  const text = (key: "name" | "taxId" | "address" | "email" | "phone" | "dpo" | "professional" | "license" | "city") => ({
    value: c[key],
    onChange: (e: { target: { value: string } }) => setC({ ...c, [key]: e.target.value }),
  });

  return (
    <section id="proteccion-datos" className="flex scroll-mt-20 flex-col gap-3" aria-labelledby="h-proteccion">
      <h2 id="h-proteccion" className="text-lg">
        Protección de datos
      </h2>
      <p className="text-sm text-text-muted">
        Para el texto informativo que firma cada paciente (ficha del paciente → Protección de datos). La clínica es la responsable del tratamiento.
      </p>
      {cloud && server && !c.cloudflareDpa && (
        <Alert tone="warning" title="Contrato con Cloudflare">
          Cloudflare actúa como encargado del tratamiento: su contrato (DPA) forma parte de sus condiciones. Si el servidor lo gestiona otra persona o
          empresa (quien os da la app), ella también es encargada: firmad con ella un contrato de encargado del tratamiento. Guarda los contratos con tu
          registro de actividades y revísalos con tu delegado de protección de datos; después, márcalo abajo.
        </Alert>
      )}
      {cloud && !server && !c.googleDpa && (
        <Alert tone="warning" title="Historias clínicas en Google Drive">
          Hace falta un contrato de encargado del tratamiento con Google. Lo tienen las cuentas de Google Workspace de la clínica (se acepta en su consola de
          administración); las cuentas de Gmail normales no.
        </Alert>
      )}
      <Card>
        <form
          className="flex flex-col gap-3"
          noValidate
          onSubmit={async (e) => {
            e.preventDefault();
            const n = Number(years.replace(",", "."));
            if (!Number.isFinite(n) || n < MIN_RETENTION_YEARS || n > 100) return setError(`Como mínimo ${MIN_RETENTION_YEARS} años (Ley 41/2002).`);
            setError(null);
            setSaving(true);
            try {
              await saveClinic(getDb(), { ...c, retentionYears: n });
              toast("Datos de la clínica guardados", "success");
            } catch (err) {
              toast(err instanceof Error ? err.message : "No se pudo guardar", "danger");
            } finally {
              setSaving(false);
            }
          }}
        >
          <TextField label="Clínica (nombre o razón social)" autoComplete="organization" {...text("name")} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TextField label="NIF" autoComplete="off" {...text("taxId")} />
            <TextField label="Teléfono" type="tel" autoComplete="tel" {...text("phone")} />
          </div>
          <TextField label="Dirección" autoComplete="street-address" {...text("address")} />
          <TextField label="Correo para ejercer los derechos" type="email" autoComplete="email" {...text("email")} />
          <TextField
            label="Delegado de protección de datos"
            autoComplete="off"
            hint="Nombre y correo. Obligatorio en un centro sanitario; no si trabajas por tu cuenta."
            {...text("dpo")}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TextField
              label="Fisioterapeuta"
              autoComplete="name"
              hint={
                cloud?.clinic
                  ? "Tú: firma tus informes y consentimientos. Cada persona del equipo pone los suyos."
                  : "Firma los informes y, por defecto, los consentimientos."
              }
              {...text("professional")}
            />
            <TextField label="Nº de colegiado" autoComplete="off" {...text("license")} />
          </div>
          <TextField label="Localidad" autoComplete="address-level2" hint="Para «En …, a … de …» de los consentimientos." {...text("city")} />
          <NumberField
            label="Conservar la historia clínica"
            unit="años"
            value={years}
            error={error ?? undefined}
            hint={`Desde la última atención. Mínimo ${MIN_RETENTION_YEARS} (Ley 41/2002); algunas comunidades exigen más.`}
            onChange={(e) => setYears(e.target.value)}
          />
          {cloud && !server && (
            <label className="flex min-h-11 items-start gap-3">
              <input type="checkbox" className="mt-1 size-5 shrink-0 accent-accent" checked={c.googleDpa} onChange={(e) => setC({ ...c, googleDpa: e.target.checked })} />
              <span>Tenemos contrato de encargado del tratamiento con Google (Google Workspace)</span>
            </label>
          )}
          {cloud && server && (
            <label className="flex min-h-11 items-start gap-3">
              <input type="checkbox" className="mt-1 size-5 shrink-0 accent-accent" checked={c.cloudflareDpa} onChange={(e) => setC({ ...c, cloudflareDpa: e.target.checked })} />
              <span>Tenemos revisados y guardados los contratos de encargado del tratamiento del servidor (Cloudflare y, si es otro, quien lo gestiona)</span>
            </label>
          )}
          <Button type="submit" loading={saving}>
            Guardar los datos de la clínica
          </Button>
        </form>
      </Card>
    </section>
  );
}
