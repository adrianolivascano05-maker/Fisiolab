// Ajustes → Cuenta: quién ha entrado, cómo va la sincronización, los cambios sustituidos y cerrar sesión.
import { History, LogIn, RefreshCw, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { useAsync } from "../app/useAsync";
import { lostCount } from "../data/conflicts";
import { getDb } from "../data/db";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Sheet } from "../ui/Sheet";
import { useCloud, useSyncState } from "./cloudContext";
import { syncText, deWhere } from "./SyncNotice";

/** Ajustes → Cuenta de Google: quién ha entrado, cómo va la sincronización y cerrar sesión. */
export function CloudSettings() {
  const cloud = useCloud();
  const s = useSyncState();
  const [confirm, setConfirm] = useState<null | "logout" | "wipe">(null);
  const [busy, setBusy] = useState(false);
  if (!cloud || !s) return null;
  const { account } = cloud;
  return (
    <section className="flex flex-col gap-3" aria-labelledby="h-cuenta">
      <h2 id="h-cuenta" className="text-lg">
        Cuenta
      </h2>
      <Card className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-lg font-semibold text-accent">
            {account.name.slice(0, 1).toUpperCase()}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-semibold">{account.name}</span>
            <span className="truncate text-sm text-text-muted">{account.email}</span>
          </span>
        </div>
        <p className="text-sm" role="status">
          {syncText(s)}
        </p>
        {s.status === "needs-auth" ? (
          <Button icon={<LogIn aria-hidden="true" className="size-5" />} onClick={cloud.reconnect}>
            Entrar con Google para sincronizar
          </Button>
        ) : (
          <Button icon={<RefreshCw aria-hidden="true" className="size-5" />} loading={s.status === "syncing"} onClick={() => void cloud.sync.sync()}>
            Sincronizar ahora
          </Button>
        )}
        <LostChangesLink />
        <Button variant="secondary" onClick={() => setConfirm("logout")}>
          Cerrar sesión
        </Button>
        <Button variant="ghost" className="text-danger" onClick={() => setConfirm("wipe")}>
          Cerrar sesión y borrar los datos de este dispositivo
        </Button>
      </Card>
      <Sheet open={confirm !== null} onClose={() => setConfirm(null)} title={confirm === "wipe" ? "¿Borrar los datos de este dispositivo?" : "¿Cerrar sesión?"}>
        {s.pending && (
          <p className="flex items-start gap-2 rounded-md bg-warning-soft p-3 text-sm text-warning">
            <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> Hay cambios que aún no están en {s.where}. Sincroniza antes, o se
            {confirm === "wipe" ? " perderán." : " subirán la próxima vez que entres en este dispositivo."}
          </p>
        )}
        <p>
          {confirm === "wipe"
            ? `Se borran tus pacientes de este dispositivo. La copia ${deWhere(s.where)} no se toca: al volver a entrar, vuelven.`
            : "Tus pacientes se quedan en este dispositivo, pero hará falta entrar con tu cuenta para verlos."}
        </p>
        <Button
          variant={confirm === "wipe" ? "danger" : "primary"}
          block
          loading={busy}
          onClick={async () => {
            setBusy(true);
            await cloud.logout(confirm === "wipe");
          }}
        >
          {confirm === "wipe" ? "Borrar y cerrar sesión" : "Cerrar sesión"}
        </Button>
        <Button variant="secondary" block onClick={() => setConfirm(null)}>
          Cancelar
        </Button>
      </Sheet>
    </section>
  );
}

/** Lo que se ha sustituido en este dispositivo (src/data/conflicts.ts), si hay algo. */
function LostChangesLink() {
  const count = useAsync(() => lostCount(getDb()), []);
  if (!count.data) return null;
  return (
    <Link to="/ajustes/sustituidos" className="inline-flex min-h-11 items-center gap-2 font-semibold text-accent underline">
      <History aria-hidden="true" className="size-5" />
      {count.data === 1 ? "1 cambio sustituido" : `${count.data} cambios sustituidos`}: ver y recuperar
    </Link>
  );
}
