// El inicio en el ordenador: a la izquierda queda la lista de pacientes (PatientsLayout) y aquí, lo de hoy (las citas
// con Atender y Cobrar, lo pendiente, mañana y la lista de espera: la misma vista que Agenda › Hoy) y los avisos.
import { useState } from "react";
import { Page } from "../app/Page";
import { useAsync } from "../app/useAsync";
import { AppointmentSheet } from "../clinical/AppointmentSheet";
import type { AgendaItem } from "../data/appointments";
import { getDb } from "../data/db";
import { hasOwnPatients } from "../data/patientSearch";
import { QUICK_PATIENT } from "../data/repo";
import { SEED_PREFIX } from "../data/seed";
import { TodayView } from "../schedule/TodayView";
import { PatientNotices } from "./PatientsPage";

const todayText = () => {
  const t = new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Madrid" });
  return t.charAt(0).toUpperCase() + t.slice(1);
};

export function DesktopHome() {
  const [managing, setManaging] = useState<AgendaItem | null>(null);
  const own = useAsync(() => hasOwnPatients(getDb(), SEED_PREFIX, QUICK_PATIENT), []);
  return (
    <Page title="Hoy" header={<h1 className="text-[2rem] leading-tight font-bold">{todayText()}</h1>}>
      <TodayView onOpen={setManaging} />
      <PatientNotices hasRealPatients={!!own.data} />
      {managing && <AppointmentSheet open onClose={() => setManaging(null)} patientId={managing.patientId} patientName={managing.name} appointment={managing} backToToday />}
    </Page>
  );
}
