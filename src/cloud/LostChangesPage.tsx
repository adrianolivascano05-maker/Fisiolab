// Ajustes › Cuenta › Cambios sustituidos (src/data/conflicts.ts): lo que se cambió aquí a la vez que otra persona lo
// cambiaba con otro valor. Se quedó lo suyo; aquí se puede volver a poner lo de este dispositivo o dejarlo como está.
import { History } from "lucide-react";
import { Link } from "react-router";
import { bumpData } from "../app/dataVersion";
import { Page } from "../app/Page";
import { useAsync } from "../app/useAsync";
import { dismissLost, lostChanges, recoverLost } from "../data/conflicts";
import { getDb } from "../data/db";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { useToast } from "../ui/Toast";

const when = (iso: string) =>
  new Date(iso).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" });

export function LostChangesPage() {
  const toast = useToast();
  const list = useAsync(() => lostChanges(getDb()), []);
  const act = async (fn: () => Promise<unknown>, done: string) => {
    try {
      await fn();
      bumpData();
      toast(done, "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "danger");
    }
  };
  return (
    <Page title="Cambios sustituidos" backTo="/ajustes/cuenta">
      <p className="text-text-muted">
        Si dos personas cambian el mismo dato a la vez, se queda el último cambio. Lo que se había cambiado en este dispositivo se guarda aquí tres meses,
        por si hay que recuperarlo. Lo que se cambia a la vez pero en datos distintos se junta solo.
      </p>
      {list.data?.length === 0 && <Alert tone="info" title="No hay cambios sustituidos en este dispositivo." />}
      <ul aria-label="Cambios sustituidos" className="flex flex-col gap-3">
        {list.data?.map((l) => (
          <li key={l.id}>
            <Card className="flex flex-col gap-2">
              <h2 className="flex items-center gap-2 font-semibold">
                <History aria-hidden="true" className="size-5 shrink-0 text-accent" />
                <span className="min-w-0 break-words">
                  {l.what}
                  {l.patient && (
                    <>
                      {" · "}
                      <Link to={`/pacientes/${l.patient.id}`} className="text-accent underline">
                        {l.patient.name}
                      </Link>
                    </>
                  )}
                </span>
              </h2>
              <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
                <dt className="text-text-muted">Lo tuyo</dt>
                <dd className="break-words">{l.mine}</dd>
                <dt className="text-text-muted">Se quedó</dt>
                <dd className="break-words">
                  {l.theirs}
                  <span className="text-text-muted">
                    {" "}
                    ({l.by ? `de ${l.by}, ` : ""}
                    {when(l.at)})
                  </span>
                </dd>
              </dl>
              {l.gone && <p className="text-sm text-text-muted">Ya no se puede recuperar: se ha borrado.</p>}
              <div className="flex flex-wrap gap-2">
                {!l.gone && (
                  <Button onClick={() => void act(() => recoverLost(getDb(), l.id), `${l.what}: se ha vuelto a poner lo tuyo`)}>Recuperar lo mío</Button>
                )}
                <Button variant="secondary" onClick={() => void act(() => dismissLost(getDb(), l.id), "Se queda como está")}>
                  {l.gone ? "Quitar de la lista" : "Dejar lo suyo"}
                </Button>
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </Page>
  );
}
