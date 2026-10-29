// La bandeja de respuestas de los pacientes (FormInbox) solo hace falta con una clínica en el servidor. Su código
// arrastra el catálogo de cuestionarios (src/clinical/patientForms.ts): se carga aparte y solo entonces, no en cada
// arranque de la app.
import { lazy, Suspense } from "react";
import { useCloud } from "../cloud/cloudContext";

const FormInbox = lazy(() => import("./FormInbox").then((m) => ({ default: m.FormInbox })));

export function FormInboxGate() {
  const cloud = useCloud();
  if (!cloud?.clinic) return null;
  return (
    <Suspense fallback={null}>
      <FormInbox />
    </Suspense>
  );
}
