// Quien entra con Google y aún no está en ninguna clínica: o le añade quien administra la suya, o pide al proveedor
// permiso para dar de alta la suya (cloudflare/worker.js, /v1/solicitud). El proveedor lo acepta desde su panel.
import { RefreshCw, Send } from "lucide-react";
import { useState, type FormEvent } from "react";
import { fmtDate } from "../app/format";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { TextField } from "../ui/Field";
import { getToken, startLogin } from "./auth";
import { clinicApi, type AccessRequest, type Me } from "./clinic";

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function AccessRequestCards({ me, baseUrl, clientId }: { me: Me; baseUrl: string; clientId: string }) {
  const [request, setRequest] = useState<AccessRequest | null>(me.request ?? null);
  const [clinic, setClinic] = useState("");
  const [note, setNote] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(work: (api: ReturnType<typeof clinicApi>, t: NonNullable<ReturnType<typeof getToken>>) => Promise<void>) {
    const token = getToken();
    if (!token) return startLogin(clientId, { hint: me.email });
    setBusy(true);
    setFailure(null);
    try {
      await work(clinicApi(baseUrl), token);
    } catch (err) {
      setFailure(errText(err));
    } finally {
      setBusy(false);
    }
  }

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!clinic.trim()) return setNameError("Escribe el nombre de la clínica.");
    await run(async (api, t) => setRequest(await api.requestAccess(t, clinic.trim(), note.trim())));
  }

  const check = (
    <Button variant="secondary" icon={<RefreshCw aria-hidden="true" className="size-5" />} onClick={() => location.reload()}>
      Volver a comprobar
    </Button>
  );

  return (
    <>
      <Card className="flex flex-col gap-3">
        <h2 className="font-semibold">¿Tu clínica ya usa Cénit?</h2>
        <p>
          Tu cuenta (<span className="font-semibold">{me.email}</span>) aún no está en ninguna clínica.
        </p>
        <p className="text-sm text-text-muted">Pide a quien administra la tuya que te añada con este correo y vuelve a comprobarlo.</p>
        {check}
      </Card>

      {request?.status === "pending" ? (
        <Card className="flex flex-col gap-3" role="status">
          <h2 className="font-semibold">Solicitud enviada</h2>
          <p>
            Has pedido dar de alta «{request.clinic}» el {fmtDate(request.createdAt)}. Cuando se acepte, aquí mismo podrás crear tu clínica y añadir a
            tu equipo.
          </p>
          {check}
          <Button variant="ghost" loading={busy} onClick={() => void run(async (api, t) => (await api.withdrawRequest(t), setRequest(null)))}>
            Retirar la solicitud
          </Button>
        </Card>
      ) : request?.status === "rejected" ? (
        <Alert tone="warning" title="Tu solicitud para dar de alta una clínica no se ha aceptado">
          Si crees que es un error, habla con quien te ofreció la app.
        </Alert>
      ) : (
        <Card>
          <form className="flex flex-col gap-3" noValidate onSubmit={send}>
            <h2 className="font-semibold">¿Quieres usar Cénit en tu clínica?</h2>
            <p className="text-sm text-text-muted">
              Pide acceso: cuando se acepte, darás de alta tu clínica, la administrarás tú y añadirás a tu equipo.
            </p>
            <TextField
              label="Nombre de la clínica"
              autoComplete="organization"
              value={clinic}
              error={nameError ?? undefined}
              onChange={(e) => {
                setClinic(e.target.value);
                setNameError(null);
              }}
            />
            <TextField label="Mensaje (opcional)" hint="Por ejemplo, dónde está y cuántas personas sois." maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
            <Button type="submit" loading={busy} icon={<Send aria-hidden="true" className="size-5" />}>
              Solicitar acceso
            </Button>
          </form>
        </Card>
      )}
      {failure && <Alert tone="danger" title={failure} />}
    </>
  );
}
