// Ajustes → Equipo de la clínica (clinic.ts): quién forma parte de ella y, para quien la administra, añadir y quitar
// gente, cambiar el nombre o borrarla del servidor. También cambiar de clínica o salir de ella en este dispositivo.
import { Building2, LogOut, Pencil, Repeat, ShieldCheck, Trash, UserPlus, UserRound } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Navigate } from "react-router";
import { Page } from "../app/Page";
import { useAsync } from "../app/useAsync";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { TextField } from "../ui/Field";
import { Group, Row, RowButton } from "../ui/Grouped";
import { Sheet } from "../ui/Sheet";
import { useToast } from "../ui/Toast";
import { getDb } from "../data/db";
import { ensureStaff, removeStaff } from "../data/schedule";
import { getToken } from "./auth";
import { ROLE_LABELS, type Member, type Role } from "./clinic";
import { useCloud } from "./CloudGate";

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function TeamPage() {
  const cloud = useCloud();
  const toast = useToast();
  const clinic = cloud?.clinic;
  const api = cloud?.clinics;
  const members = useAsync(async () => {
    if (!clinic || !api) return null;
    const token = getToken();
    if (!token) throw new Error("Vuelve a entrar con Google para ver el equipo.");
    if (!navigator.onLine) throw new Error("Sin conexión: el equipo se ve con internet.");
    const list = await api.members(token, clinic.id);
    // Todo el equipo sale en el horario (con el nombre de su correo hasta que entre y ponga el suyo).
    for (const m of list) await ensureStaff(getDb(), m.email, "");
    return list;
  }, [clinic?.id]);
  const [email, setEmail] = useState("");
  const [canManage, setCanManage] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Member | null>(null);
  const [confirm, setConfirm] = useState<null | "leave" | "delete" | "rename">(null);
  const [newName, setNewName] = useState("");
  if (!cloud || !clinic || !api) return <Navigate to="/ajustes" replace />;
  const admin = clinic.role === "admin";
  const me = cloud.account.email.trim().toLowerCase();

  /** Una llamada al servidor con la sesión de Google; `done`, el aviso si va bien. */
  async function run(work: (token: NonNullable<ReturnType<typeof getToken>>) => Promise<unknown>, done?: string): Promise<boolean> {
    const token = getToken();
    if (!token) {
      cloud!.reconnect();
      return false;
    }
    setBusy(true);
    try {
      await work(token);
      if (done) toast(done, "success");
      return true;
    } catch (e) {
      toast(errText(e), "danger");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function add(e: FormEvent) {
    e.preventDefault();
    const clean = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return setEmailError("Escribe su correo de Google (nombre@gmail.com o el de la clínica).");
    if (members.data?.some((m) => m.email === clean)) return setEmailError("Ya forma parte del equipo.");
    if (
      await run(async (t) => {
        await api!.putMember(t, clinic!.id, clean, canManage ? "admin" : "member");
        await ensureStaff(getDb(), clean, "");
      }, `${clean} añadido al equipo`)
    ) {
      setEmail("");
      setCanManage(false);
      members.reload();
    }
  }

  const setRole = async (m: Member, role: Role) => {
    if (await run((t) => api.putMember(t, clinic.id, m.email, role), role === "admin" ? `${m.email} ya puede gestionar el equipo` : `${m.email} ya no gestiona el equipo`)) {
      setSelected(null);
      if (m.email === me) cloud.updateClinic({ ...clinic, role });
      members.reload();
    }
  };
  const remove = async (m: Member) => {
    if (
      await run(async (t) => {
        await api.removeMember(t, clinic.id, m.email);
        await removeStaff(getDb(), m.email);
      }, `${m.email} ya no está en el equipo`)
    ) {
      setSelected(null);
      members.reload();
    }
  };

  return (
    <Page title="Equipo de la clínica" backTo="/ajustes">
      <Card className="flex flex-col gap-2">
        <p className="flex items-center gap-2 text-lg font-semibold">
          <Building2 aria-hidden="true" className="size-5 shrink-0 text-accent" /> {clinic.name}
        </p>
        <p className="text-sm text-text-muted">
          {admin ? "La administras: añades y quitas a la gente del equipo." : "Formas parte del equipo."} Todos veis los mismos pacientes; nadie de
          fuera de la clínica puede verlos, tampoco quien gestiona el servidor: la copia va cifrada con la contraseña de la clínica.
        </p>
        {admin && (
          <Button
            variant="secondary"
            icon={<Pencil aria-hidden="true" className="size-5" />}
            onClick={() => {
              setNewName(clinic.name);
              setConfirm("rename");
            }}
          >
            Cambiar el nombre
          </Button>
        )}
      </Card>

      {members.error ? (
        <Alert tone="warning" title={members.error.message} />
      ) : (
        <Group title="Equipo" footer={members.data ? `${members.data.length === 1 ? "1 persona" : `${members.data.length} personas`}` : "Cargando…"}>
          {(members.data ?? []).map((m) => {
            const props = { icon: m.role === "admin" ? ShieldCheck : UserRound, title: m.email === me ? `${m.email} (tú)` : m.email, subtitle: ROLE_LABELS[m.role] };
            return admin ? <RowButton key={m.email} {...props} onClick={() => setSelected(m)} /> : <Row key={m.email} {...props} />;
          })}
        </Group>
      )}

      {admin && (
        <Card>
          <form className="flex flex-col gap-3" noValidate onSubmit={add}>
            <h2 className="font-semibold">Añadir a alguien</h2>
            <TextField
              label="Su correo de Google"
              type="email"
              autoComplete="off"
              value={email}
              error={emailError ?? undefined}
              onChange={(e) => {
                setEmail(e.target.value);
                setEmailError(null);
              }}
            />
            <label className="flex min-h-11 items-start gap-3">
              <input type="checkbox" className="mt-1 size-5 shrink-0 accent-accent" checked={canManage} onChange={(e) => setCanManage(e.target.checked)} />
              <span>También puede gestionar el equipo</span>
            </label>
            <Button type="submit" loading={busy} icon={<UserPlus aria-hidden="true" className="size-5" />}>
              Añadir al equipo
            </Button>
          </form>
        </Card>
      )}

      <Card className="flex flex-col gap-2">
        <h2 className="font-semibold">Para que alguien nuevo empiece</h2>
        <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm">
          <li>Que entre en la app con ese correo de Google: verá la clínica.</li>
          <li>Dale en persona la contraseña de cifrado de la clínica (nunca por correo ni por mensaje): la app se la pedirá una vez.</li>
          <li>Que firme el compromiso de confidencialidad de la clínica antes de ver pacientes.</li>
        </ol>
      </Card>

      <Group title="Este dispositivo">
        <RowButton icon={Repeat} title="Cambiar de clínica" subtitle="Sus datos se quedan en este dispositivo" onClick={() => void cloud.switchClinic()} />
        <RowButton icon={LogOut} tone="danger" title="Salir de la clínica" subtitle="Dejas el equipo y se borran sus datos de aquí" onClick={() => setConfirm("leave")} />
        {admin && (
          <RowButton icon={Trash} tone="danger" title="Borrar la clínica del servidor" subtitle="Su equipo y su copia, para todos" onClick={() => setConfirm("delete")} />
        )}
      </Group>

      <Sheet open={selected !== null} onClose={() => setSelected(null)} title={selected?.email ?? ""}>
        {selected && (
          <>
            <p>{selected.role === "admin" ? "Gestiona el equipo de la clínica." : "Forma parte del equipo: ve y trabaja con los pacientes de la clínica."}</p>
            {selected.role === "admin" ? (
              <Button variant="secondary" block loading={busy} onClick={() => void setRole(selected, "member")}>
                Que deje de gestionar el equipo
              </Button>
            ) : (
              <Button variant="secondary" block loading={busy} onClick={() => void setRole(selected, "admin")}>
                Que también gestione el equipo
              </Button>
            )}
            {selected.email !== me && (
              <>
                <p className="text-sm text-text-muted">
                  Al quitarle del equipo deja de poder bajar la copia de la clínica y, la próxima vez que abra la app con conexión, sus pacientes se borran de
                  sus dispositivos. Sale del horario: sus turnos desde hoy se borran y sus citas pendientes quedan sin asignar. Por más seguridad, cambia
                  después la contraseña de cifrado (Ajustes → Cuenta).
                </p>
                <Button variant="danger" block loading={busy} onClick={() => void remove(selected)}>
                  Quitar del equipo
                </Button>
              </>
            )}
          </>
        )}
      </Sheet>

      <Sheet open={confirm === "rename"} onClose={() => setConfirm(null)} title="Nombre de la clínica">
        <form
          className="flex flex-col gap-3"
          noValidate
          onSubmit={async (e) => {
            e.preventDefault();
            if (!newName.trim()) return;
            if (await run((t) => api.rename(t, clinic.id, newName.trim()), "Nombre cambiado")) {
              setConfirm(null);
              cloud.updateClinic({ ...clinic, name: newName.trim().replace(/\s+/g, " ") });
            }
          }}
        >
          <TextField label="Nombre" autoComplete="organization" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <Button type="submit" block loading={busy} disabled={!newName.trim()}>
            Guardar el nombre
          </Button>
        </form>
      </Sheet>

      <Sheet open={confirm === "leave"} onClose={() => setConfirm(null)} title={`¿Salir de ${clinic.name}?`}>
        <p>Dejas el equipo y se borran de este dispositivo los pacientes de la clínica. La clínica y su copia siguen para el resto del equipo.</p>
        {admin && <p className="text-sm text-text-muted">Si eres quien la administra, nombra antes a otra persona: la clínica no puede quedarse sin nadie que la gestione.</p>}
        <Button
          variant="danger"
          block
          loading={busy}
          onClick={async () => {
            if (await run((t) => api.removeMember(t, clinic.id, me))) await cloud.leaveClinic(`Has salido de «${clinic.name}»: sus pacientes se han borrado de este dispositivo.`);
          }}
        >
          Salir de la clínica
        </Button>
        <Button variant="secondary" block onClick={() => setConfirm(null)}>
          Cancelar
        </Button>
      </Sheet>

      <Sheet open={confirm === "delete"} onClose={() => setConfirm(null)} title={`¿Borrar ${clinic.name} del servidor?`}>
        <p>Se borran del servidor la clínica, su equipo y la copia de sus pacientes, para todos. Cada dispositivo borra sus datos al abrir la app.</p>
        <p className="flex items-start gap-2 rounded-md bg-warning-soft p-3 text-sm">
          Antes, guarda una copia de seguridad (Ajustes → Copias de seguridad y exportar): la historia clínica hay que conservarla los años que marca la
          ley.
        </p>
        <Button
          variant="danger"
          block
          loading={busy}
          onClick={async () => {
            if (await run((t) => api.remove(t, clinic.id))) await cloud.leaveClinic(`Has borrado «${clinic.name}» del servidor y de este dispositivo.`);
          }}
        >
          Borrar la clínica
        </Button>
        <Button variant="secondary" block onClick={() => setConfirm(null)}>
          Cancelar
        </Button>
      </Sheet>
    </Page>
  );
}
