// Biblioteca › Cuestionarios › Permisos y licencias: las condiciones de uso de los cuestionarios que las tienen. Los pendientes del permiso de
// su titular se rellenan en la app solo cuando la clínica marca aquí que lo tiene (src/data/questionnairePermissions.ts);
// los de pago se anotan solo con la nota de su hoja oficial; los que piden registro, se pueden usar ya.
import { useEffect, useState, type ReactNode } from "react";
import { bumpData } from "../app/dataVersion";
import { Page } from "../app/Page";
import { formFor } from "../clinical/forms";
import { QUESTIONNAIRES, type QuestionnaireKind } from "../clinical/questionnaires";
import { getDb } from "../data/db";
import { setGranted, useGranted } from "../data/questionnairePermissions";
import { useToast } from "../ui/Toast";

function List({ title, intro, kinds, children }: { title: string; intro: string; kinds: QuestionnaireKind[]; children: (k: QuestionnaireKind) => ReactNode }) {
  if (!kinds.length) return null;
  const id = `h-lic-${title.replace(/\W+/g, "-")}`;
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <h2 id={id} className="text-lg">
        {title}
      </h2>
      <p className="text-sm text-text-muted">{intro}</p>
      <ul aria-label={title} className="flex flex-col divide-y divide-border rounded-lg border border-border bg-bg">
        {kinds.map((k) => (
          <li key={k.id} className="flex flex-col gap-1 p-3">
            {children(k)}
          </li>
        ))}
      </ul>
    </section>
  );
}

const Note = ({ k }: { k: QuestionnaireKind }) => (
  <>
    <span className="font-semibold">{k.name}</span>
    {k.licenseNote && <span className="text-sm text-text-muted">{k.licenseNote}</span>}
  </>
);

export function QuestionnaireLicensesPage() {
  const toast = useToast();
  const saved = useGranted();
  // Se marca al momento; lo guardado (y lo que llegue de otro dispositivo) manda en cuanto se recarga.
  const [local, setLocal] = useState<string[] | null>(null);
  const savedKey = saved.join("|");
  useEffect(() => setLocal(null), [savedKey]);
  const granted = local ?? saved;
  const [busy, setBusy] = useState(false);
  const pending = QUESTIONNAIRES.filter((k) => k.license === "comprobar" && !!formFor(k.id));
  const pendingNoText = QUESTIONNAIRES.filter((k) => k.license === "comprobar" && !formFor(k.id));
  const register = QUESTIONNAIRES.filter((k) => k.license === "permiso");
  const paid = QUESTIONNAIRES.filter((k) => k.license === "licencia");

  const toggle = async (k: QuestionnaireKind, on: boolean) => {
    const next = on ? [...granted, k.id] : granted.filter((x) => x !== k.id);
    setLocal(next);
    setBusy(true);
    try {
      await setGranted(getDb(), next);
      bumpData();
      toast(on ? `${k.name}: ya se puede rellenar en la app` : `${k.name}: solo se anota la nota`, "success");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page title="Permisos y licencias" backTo="/biblioteca/cuestionarios" backLabel="Cuestionarios">
      <p className="text-sm text-text-muted">
        Algunos cuestionarios tienen dueño: piden permiso, registro o licencia para usarlos en una app. Aquí está a quién pedírselo. Lo que marques vale para todo el
        equipo.
      </p>
      <List
        title="Pendientes del permiso de su titular"
        intro="Están programados con sus preguntas, pero hasta que marques que tenéis el permiso solo se anota la nota de la hoja oficial."
        kinds={pending}
      >
        {(k) => (
          <label className="flex min-h-11 items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 size-5 shrink-0 accent-accent"
              checked={granted.includes(k.id)}
              disabled={busy}
              onChange={(e) => void toggle(k, e.target.checked)}
            />
            <span className="flex flex-col gap-0.5">
              <span className="font-semibold">Tenemos el permiso: {k.name}</span>
              {k.licenseNote && <span className="text-sm text-text-muted">{k.licenseNote}</span>}
            </span>
          </label>
        )}
      </List>
      <List title="Libres, con registro o permiso" intro="Se pueden usar ya; la clínica tiene que registrarse o pedir el permiso donde se indica." kinds={register}>
        {(k) => <Note k={k} />}
      </List>
      <List title="De pago: solo la nota" intro="Sin sus preguntas en la app: se pasan con la hoja oficial (con licencia) y aquí se anota la nota." kinds={paid}>
        {(k) => <Note k={k} />}
      </List>
      <List title="Sin comprobar: solo la nota" intro="No se ha podido comprobar el texto original o sus condiciones: se anota solo la nota." kinds={pendingNoText}>
        {(k) => <Note k={k} />}
      </List>
    </Page>
  );
}
