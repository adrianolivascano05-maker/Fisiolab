// Ajustes → Equipo de la clínica (clinic.ts): quién forma parte de ella y, para quien la administra, añadir y quitar
// gente, cambiar el nombre o borrarla del servidor. También cambiar de clínica o salir de ella en este dispositivo.
import { setClinicMode, useTeamMode } from "./teamMode";
import { Building2, LogOut, Pencil, Repeat, ShieldCheck, Trash, UserPlus, UserRound } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Navigate } from "react-router";
import { Page } from "../app/Page";
import { useAsync } from "../app/useAsync";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { SelectField, TextField } from "../ui/Field";
import { Group, Row, RowButton } from "../ui/Grouped";
import { Sheet } from "../ui/Sheet";
import { useToast } from "../ui/Toast";
import { getDb } from "../data/db";
import { ensureStaff, removeStaff } from "../data/schedule";
import { FullExportButton } from "../export/FullExportButton";
import { getToken } from "./auth";
import { chooseClinic, ROLE_LABELS, type Member, type Role } from "./clinic";
import { useCloud } from "./CloudGate";

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function TeamPage() {
  const cloud = useCloud();
  const { solo } = useTeamMode();
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
        // Quien trabajaba por su cuenta y añade a alguien pasa a clínica con equipo.
        if (solo) await setClinicMode("team");
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

  const alone = (members.data?.length ?? 0) <= 1;
  return (
    <Page title={solo ? "Mi consulta" : "Equipo de la clínica"} backTo="/ajustes">
      {admin && (solo || alone) && (
        <Card className="flex flex-col gap-2">
          <p className="font-semibold">{solo ? "Trabajas por tu cuenta" : "Clínica con equipo"}</p>
          <p className="text-sm text-text-muted">
            {solo
              ? "Sin turnos ni equipo en la agenda. Si abres una clínica, pasa a clínica con equipo (o añade a alguien abajo): tus pacientes y tu agenda siguen igual."
              : "Aún no hay nadie más en el equipo. Si trabajas solo, puedes quitar de la agenda los turnos y el equipo."}
          </p>
          <Button variant="secondary" onClick={() => void setClinicMode(solo ? "team" : "solo")}>
            {solo ? "Abrir una clínica con equipo" : "Trabajar por mi cuenta"}
          </Button>
        </Card>
      )}
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

      {confirm === "delete" && <DeleteClinicSheet onClose={() => setConfirm(null)} />}
    </Page>
  );
}

/** Lo que declara quien borra la clínica (queda guardado en el servidor con su correo y la fecha). */
const DELETE_DECLARATION =
  "Declaro que la clínica conserva una copia de seguridad de sus historias clínicas y se responsabiliza de custodiarlas durante el plazo que marca la ley. Entiendo que la clínica, su equipo y su copia se borrarán del servidor y que solo podrán recuperarse durante los 30 días siguientes.";

/**
 * Borrar una clínica del servidor: elegir cuál (si se administran varias), descargar antes su copia de seguridad y
 * aceptar la declaración. Va 30 días a la papelera, desde donde se puede recuperar.
 */
function DeleteClinicSheet({ onClose }: { onClose: () => void }) {
  const cloud = useCloud();
  const toast = useToast();
  const [chosen, setChosen] = useState(cloud?.clinic?.id ?? "");
  const [downloaded, setDownloaded] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const mine = useAsync(async () => {
    const token = getToken();
    if (!cloud?.clinics || !token) return [];
    return (await cloud.clinics.me(token)).clinics.filter((c) => c.role === "admin");
  }, []);
  if (!cloud?.clinic || !cloud.clinics) return null;
  const current = cloud.clinic;
  const target = (mine.data ?? []).find((c) => c.id === chosen) ?? current;
  const other = target.id !== current.id;
  return (
    <Sheet open onClose={onClose} title="Borrar una clínica del servidor">
      {(mine.data?.length ?? 0) > 1 && (
        <SelectField
          label="Clínica que quieres borrar"
          value={chosen}
          onChange={(e) => {
            setChosen(e.target.value);
            setDownloaded(false);
            setAgreed(false);
          }}
        >
          {mine.data!.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </SelectField>
      )}
      {other ? (
        <>
          <p>Para borrar «{target.name}», entra en ella: así descargas antes su copia de seguridad.</p>
          <Button
            block
            onClick={() => {
              chooseClinic(cloud.account, target);
              location.assign(`${import.meta.env.BASE_URL}ajustes/equipo`);
            }}
          >
            Entrar en «{target.name}»
          </Button>
        </>
      ) : (
        <>
          <p>
            Se borran del servidor «{current.name}», su equipo y la copia de sus pacientes, para todos. Durante 30 días queda en la papelera y se puede
            recuperar entera desde la pantalla de elegir clínica; después, se borra para siempre.
          </p>
          <ol className="flex list-decimal flex-col gap-3 pl-5">
            <li className="flex flex-col gap-2">
              <span>
                Descarga todos sus datos y guárdalos fuera de este dispositivo: la historia clínica de cada paciente (para leer o imprimir), un Excel
                con todo y la copia de seguridad. La historia clínica hay que conservarla los años que marca la ley.
              </span>
              <FullExportButton name={current.name} label="Descargar todos los datos" doneLabel="Datos descargados" onDone={() => setDownloaded(true)} />
            </li>
            <li>
              <label className="flex min-h-11 items-start gap-3">
                <input type="checkbox" className="mt-1 size-5 shrink-0 accent-accent" checked={agreed} disabled={!downloaded} onChange={(e) => setAgreed(e.target.checked)} />
                <span className="text-sm">{DELETE_DECLARATION}</span>
              </label>
            </li>
          </ol>
          <Button
            variant="danger"
            block
            loading={busy}
            disabled={!downloaded || !agreed}
            onClick={async () => {
              const token = getToken();
              if (!token) return cloud.reconnect();
              setBusy(true);
              try {
                // Un servidor de antes de la papelera borraría la clínica de golpe: se comprueba primero.
                if (!("deleted" in (await cloud.clinics!.me(token)))) throw new Error("El servidor de la clínica está sin actualizar: hasta que se actualice no se puede borrar una clínica.");
                // Desde ya, nada en segundo plano llama al servidor por esta clínica (contestaría que está borrada).
                cloud.closing = true;
                const until = await cloud.clinics!.remove(token, current.id, `${DELETE_DECLARATION} — ${cloud.account.email}`);
                const date = new Date(until).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
                await cloud.leaveClinic(`«${current.name}» está en la papelera: puedes recuperarla aquí hasta el ${date}.`);
              } catch (e) {
                cloud.closing = false;
                toast(errText(e), "danger");
                setBusy(false);
              }
            }}
          >
            Borrar «{current.name}»
          </Button>
        </>
      )}
      <Button variant="secondary" block onClick={onClose}>
        Cancelar
      </Button>
    </Sheet>
  );
}
