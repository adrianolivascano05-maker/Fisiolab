// En el ordenador muy ancho (1536 px o más), una columna fija a la derecha de la ficha con lo esencial del paciente en
// todas las pestañas menos el Resumen (que ya lo trae): «Nueva sesión», sus cifras y lo próximo de su calendario.
// Solo se monta (y solo entonces lee la base) cuando la pantalla es así de ancha.
import { NotebookPen } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { todayDay } from "../app/dates";
import { fmtDate } from "../app/format";
import { useAsync } from "../app/useAsync";
import { accountLine, patientAccount } from "../data/billing";
import { listQuestionnaires, listSessions } from "../data/clinical";
import { getDb } from "../data/db";
import { eventNotes, listPatientEvents } from "../data/patientEvents";
import { questionnaireGroups } from "./outcomeParts";
import { kindOf, scoreText, type QDetails } from "./questionnaires";

const WIDE = "(min-width: 1536px)";

/** Si la ventana es lo bastante ancha para la columna de la derecha. */
export function useWideScreen(): boolean {
  const [wide, setWide] = useState(() => typeof matchMedia === "function" && matchMedia(WIDE).matches);
  useEffect(() => {
    if (typeof matchMedia !== "function") return;
    const m = matchMedia(WIDE);
    const on = () => setWide(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return wide;
}

export function PatientAside({ id }: { id: string }) {
  const data = useAsync(async () => {
    const db = getDb();
    const today = todayDay();
    const [sessions, questionnaires, account, events] = await Promise.all([listSessions(db, id), listQuestionnaires(db, id), patientAccount(db, id, today), listPatientEvents(db, id)]);
    return { sessions, questionnaires, account, notes: eventNotes(events, today).slice(0, 3) };
  }, [id]);
  if (!data.data) return null;
  const { sessions, questionnaires, account, notes } = data.data;
  const lastPain = sessions.find((x) => x.pain !== null);
  const group = questionnaireGroups(questionnaires)[0];
  const q = group?.items[0];
  const rows: [string, string, string][] = [
    ["Dolor", lastPain ? `${lastPain.pain}/10 · ${fmtDate(lastPain.performedAt)}` : "Sin apuntar", `/pacientes/${id}/sesiones`],
    ["Sesiones", sessions.length ? `${sessions.length} · la última, el ${fmtDate(sessions[0]!.performedAt)}` : "Ninguna todavía", `/pacientes/${id}/sesiones`],
    ["Cuestionario", group && q ? `${group.name} ${scoreText(kindOf(q.kind, q.details as QDetails), q.score)}` : "Ninguno pasado", `/pacientes/${id}/valoracion`],
    ["Bonos y cobros", accountLine(account) ?? "Nada pendiente apuntado", `/pacientes/${id}/cobros`],
  ];
  return (
    <aside aria-label="Lo esencial del paciente" className="sticky top-[calc(var(--layout-header)+1rem)] flex flex-col gap-3 rounded-lg border border-border bg-bg p-3">
      <Link to={`/pacientes/${id}/sesiones/nueva`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-accent px-3 font-semibold text-on-accent hover:bg-accent-hover">
        <NotebookPen aria-hidden="true" className="size-5" /> Nueva sesión
      </Link>
      <ul className="flex flex-col divide-y divide-border">
        {rows.map(([label, value, to]) => (
          <li key={label}>
            <Link to={to} className="flex min-h-11 flex-col justify-center py-1.5 hover:bg-surface">
              <span className="text-xs font-semibold tracking-wide text-text-muted uppercase">{label}</span>
              <span className="text-sm">{value}</span>
            </Link>
          </li>
        ))}
      </ul>
      {notes.length > 0 && (
        <ul aria-label="De su calendario" className="flex flex-col gap-1 border-t border-border pt-2 text-sm">
          {notes.map((n) => (
            <li key={`${n.event.id}-${n.day}`}>
              <Link to={`/pacientes/${id}/calendario?mes=${n.day.slice(0, 7)}&dia=${n.day}`} className="inline-flex min-h-11 items-center underline underline-offset-2">
                {n.text}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
