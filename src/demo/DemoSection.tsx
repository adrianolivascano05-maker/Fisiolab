// Ajustes › Copias y exportar › Clínica de prueba: cargar cientos de pacientes inventados para probar la app con
// volumen, y borrarlos de una vez (src/demo/README.md). Solo en una clínica sin pacientes y solo quien la administra.
import { FlaskConical, Trash2 } from "lucide-react";
import { useState } from "react";
import { bumpData } from "../app/dataVersion";
import { fmtDateTime } from "../app/format";
import { useAsync } from "../app/useAsync";
import { useCloud } from "../cloud/cloudContext";
import { getDb } from "../data/db";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Sheet } from "../ui/Sheet";
import { useToast } from "../ui/Toast";
import { demoState, type DemoMode } from "./state";

// El generador (con sus casos y la galería de tests) solo se carga al usarlo.
const load = () => import("./generate");
const MODES: Record<DemoMode, { title: string; text: string }> = {
  normal: { title: "100 pacientes de prueba", text: "Una clínica con movimiento normal: la agenda a medio llenar." },
  stress: { title: "Modo estrés: 500 pacientes", text: "Seis meses de historia y el mes que viene lleno, con pacientes esperando hueco." },
};

export function DemoSection() {
  const cloud = useCloud();
  const toast = useToast();
  const [ask, setAsk] = useState<DemoMode | "remove" | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const state = useAsync(() => demoState(getDb()), []);
  // En una clínica, solo quien la administra.
  if (cloud?.clinic && cloud.clinic.role !== "admin") return null;

  const run = async (mode: DemoMode) => {
    setAsk(null);
    setBusy("Preparando la clínica");
    try {
      const { generateDemo } = await load();
      const me = cloud?.clinic ? { email: cloud.account.email, name: cloud.account.name } : null;
      const s = await generateDemo(getDb(), { mode, me, clinicName: cloud?.clinic?.name, onProgress: (text, done, total) => setBusy(done < total ? `${text}: ${done} de ${total}` : text) });
      toast(`${s.patients} pacientes, ${s.appointments} citas y ${s.sessions} sesiones en ${Math.max(1, Math.round(s.ms / 1000))} s`, "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "No se pudieron cargar los datos de prueba", "danger");
    } finally {
      setBusy(null);
      bumpData();
      state.reload();
    }
  };
  const remove = async () => {
    setAsk(null);
    setBusy("Borrando los datos de prueba");
    try {
      const n = await (await load()).removeDemo(getDb());
      toast(`${n} pacientes de prueba borrados`, "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "No se pudieron borrar", "danger");
    } finally {
      setBusy(null);
      bumpData();
      state.reload();
    }
  };

  const marker = state.data?.marker;
  const patients = state.data?.patients ?? 0;
  return (
    <section className="flex flex-col gap-3" aria-labelledby="h-prueba">
      <h2 id="h-prueba" className="text-lg">
        Clínica de prueba
      </h2>
      <p className="text-sm text-text-muted">
        Para probar la app con mucho volumen: pacientes inventados con su historia completa, cinco fisios inventados con sus turnos y la agenda de los
        últimos meses hasta final del mes que viene. Los teléfonos son de ficción (+44 7700 900…, reservados para el cine y la televisión): no son de
        nadie.
      </p>
      {busy ? (
        <Card className="flex items-center gap-3" aria-live="polite">
          <span className="size-5 shrink-0 animate-spin rounded-full border-2 border-accent border-t-transparent" aria-hidden="true" />
          <span>{busy}…</span>
        </Card>
      ) : !state.data ? null : marker ? (
        <Card className="flex flex-col gap-3">
          <p>
            Cargados el {fmtDateTime(marker.createdAt)}: <span className="font-semibold">{marker.patients.length} pacientes de prueba</span>
            {marker.mode === "stress" ? " (modo estrés)" : ""}.
          </p>
          <Button variant="danger" icon={<Trash2 aria-hidden="true" className="size-5" />} onClick={() => setAsk("remove")}>
            Borrar los datos de prueba
          </Button>
        </Card>
      ) : patients > 0 ? (
        <Alert tone="info" title={`Esta clínica ya tiene ${patients === 1 ? "1 paciente" : `${patients} pacientes`}`}>
          Los datos de prueba solo se cargan en una clínica vacía, para no mezclarlos con pacientes de verdad.
          {cloud?.clinic ? " Crea una clínica de prueba: Ajustes › Equipo de la clínica › Cambiar de clínica › Dar de alta otra clínica distinta (con equipo)." : ""}
        </Alert>
      ) : (
        <Card className="flex flex-col gap-3">
          {(Object.keys(MODES) as DemoMode[]).map((m) => (
            <Button key={m} variant="secondary" icon={<FlaskConical aria-hidden="true" className="size-5" />} onClick={() => setAsk(m)}>
              {MODES[m].title}
            </Button>
          ))}
        </Card>
      )}

      <Sheet open={ask === "normal" || ask === "stress"} onClose={() => setAsk(null)} title={ask === "stress" ? MODES.stress.title : MODES.normal.title}>
        <p>{ask === "stress" ? MODES.stress.text : MODES.normal.text}</p>
        <p className="text-sm text-text-muted">
          Todo inventado: fichas completas, sesiones, cuestionarios, cobros, consentimientos y la agenda repartida por igual entre los fisios. Se
          sincroniza con tus otros dispositivos. Se borra entero con un botón.
        </p>
        <Button block onClick={() => ask && ask !== "remove" && void run(ask)}>
          Cargar los datos de prueba
        </Button>
      </Sheet>
      <Sheet open={ask === "remove"} onClose={() => setAsk(null)} title="¿Borrar los datos de prueba?">
        <p>
          Se borran los {marker?.patients.length ?? 0} pacientes inventados con todo lo suyo (citas, sesiones, cobros…), los fisios inventados con sus turnos,
          y los precios y bonos vuelven a como estaban. Lo que hayas añadido tú se queda.
        </p>
        <Button variant="danger" block onClick={() => void remove()}>
          Borrar los datos de prueba
        </Button>
      </Sheet>
    </section>
  );
}
