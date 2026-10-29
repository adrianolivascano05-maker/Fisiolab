// «Algo no funciona»: problemas frecuentes con su solución y el informe de fallo (src/app/errorLog.ts), que sale
// por correo o se copia, solo cuando la persona lo decide.
import { Copy, Mail, Trash } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import { SUPPORT_EMAIL } from "../app/contact";
import { clearErrors, errorReport, readErrors } from "../app/errorLog";
import { Page } from "../app/Page";
import { syncText } from "../cloud/SyncNotice";
import { useSyncState } from "../cloud/cloudContext";
import { TextArea } from "../clinical/parts";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { useToast } from "../ui/Toast";

const link = "py-3 font-semibold text-accent underline underline-offset-2";

/** Problemas que se repiten, con lo que se hace en cada uno. */
const FAQ: { q: string; a: ReactNode }[] = [
  {
    q: "Lo que apunto en un móvil no aparece en otro",
    a: (
      <>
        Los dos tienen que estar en la misma cuenta y con conexión. En{" "}
        <Link to="/ajustes/cuenta" className={link}>
          Ajustes › Cuenta
        </Link>{" "}
        se ve si la última sincronización fue bien. Si dice que falta la contraseña de la copia o la clave de la clínica, ponla y vuelve a abrir la
        app en el otro móvil.
      </>
    ),
  },
  {
    q: "En el iPhone han desaparecido los datos",
    a: (
      <>
        Safari puede borrar los datos de una web que no se abre en unos días si no está instalada. Instálala (
        <Link to="/instalar" className={link}>
          cómo
        </Link>
        ) y recupera lo último: con la nube, entrando con la misma cuenta; sin nube, desde{" "}
        <Link to="/ajustes/datos" className={link}>
          Ajustes › Copias y exportar
        </Link>{" "}
        › Restaurar una copia.
      </>
    ),
  },
  {
    q: "Dice que la app ya está abierta en otra pestaña",
    a: <>Solo una pestaña puede guardar datos a la vez. Cierra las otras pestañas o ventanas de OmniClin: esta seguirá sola en
        unos segundos (si no, pulsa Reintentar).</>,
  },
  {
    q: "He olvidado el PIN",
    a: (
      <>
        En la pantalla del PIN, «He olvidado el PIN». Con cuenta de Google, vuelves a entrar con ella y eliges otro. Sin cuenta, para entrar hay que
        borrar los datos de este dispositivo: por eso conviene tener una copia reciente.
      </>
    ),
  },
  {
    q: "Sale «Hay una versión nueva»",
    a: <>Pulsa Actualizar cuando no estés marcando un vídeo. La app no se actualiza sola para no cortarte a mitad de algo.</>,
  },
  {
    q: "La pantalla se queda en blanco o algo no responde",
    a: (
      <>
        Recarga la página (o cierra la app y ábrela de nuevo). Si se repite, manda el informe de abajo: lleva lo que ha fallado y en qué pantalla, para
        poder arreglarlo.
      </>
    ),
  },
];

export function ReportProblemPage() {
  const toast = useToast();
  const sync = useSyncState();
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState(readErrors);
  const extra = sync ? [`Sincronización: ${syncText(sync)}`] : ["Sincronización: sin cuenta (solo este dispositivo)"];
  const report = errorReport(note, extra, errors);
  // Los programas de correo cortan los enlaces muy largos: en el correo va el principio; «Copiar» lleva el informe entero.
  const mailBody = report.length > 1800 ? `${report.slice(0, 1800)}\n…(informe recortado: usa «Copiar» para mandarlo entero)` : report;
  const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Informe de fallo de OmniClin")}&body=${encodeURIComponent(mailBody)}`;

  return (
    <Page title="Algo no funciona" backTo="/ayuda">
      <section aria-labelledby="h-faq" className="flex flex-col gap-2">
        <h2 id="h-faq" className="text-lg">
          Problemas frecuentes
        </h2>
        <ul className="flex flex-col gap-2">
          {FAQ.map((f) => (
            <li key={f.q}>
              <details className="group rounded-lg border border-border bg-bg">
                <summary className="flex min-h-12 cursor-pointer list-none items-center px-4 py-2 font-semibold [&::-webkit-details-marker]:hidden">{f.q}</summary>
                <p className="px-4 pb-3 text-sm">{f.a}</p>
              </details>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="h-informe" className="flex flex-col gap-3">
        <h2 id="h-informe" className="text-lg">
          Enviar un informe de fallo
        </h2>
        <p className="text-sm text-text-muted">
          La app apunta en este dispositivo los errores que encuentra ({errors.length === 0 ? "ninguno por ahora" : errors.length === 1 ? "1 anotado" : `${errors.length} anotados`}).
          No sale nada si no lo mandas tú. No lleva datos de pacientes; aun así, puedes leerlo antes de enviarlo.
        </p>
        <TextArea label="Qué pasó" hint="Qué estabas haciendo y qué esperabas que pasara." value={note} onChange={setNote} />
        <details className="rounded-lg border border-border bg-bg">
          <summary className="flex min-h-12 cursor-pointer items-center px-4 font-semibold">Ver el informe</summary>
          <pre aria-label="Informe de fallo" className="max-h-80 overflow-auto px-4 pb-3 text-xs whitespace-pre-wrap break-words">
            {report}
          </pre>
        </details>
        <Card className="flex flex-col gap-2">
          <a href={mailto} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-accent px-4 font-semibold text-on-accent hover:bg-accent-hover">
            <Mail aria-hidden="true" className="size-5" /> Enviar por correo
          </a>
          <Button
            variant="secondary"
            icon={<Copy aria-hidden="true" className="size-5" />}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(report);
                toast("Informe copiado: pégalo en un correo o un WhatsApp", "success");
              } catch {
                toast("No se pudo copiar: ábrelo en «Ver el informe» y cópialo a mano", "danger");
              }
            }}
          >
            Copiar el informe
          </Button>
          {errors.length > 0 && (
            <Button
              variant="ghost"
              icon={<Trash aria-hidden="true" className="size-5" />}
              onClick={() => {
                clearErrors();
                setErrors([]);
                toast("Registro de errores borrado");
              }}
            >
              Borrar los errores anotados
            </Button>
          )}
          <p className="text-xs text-text-muted">El correo va a {SUPPORT_EMAIL}.</p>
        </Card>
      </section>
    </Page>
  );
}
