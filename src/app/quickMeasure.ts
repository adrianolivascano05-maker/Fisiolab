// Medir ya, sin rellenar una ficha: usa (o crea) la ficha «Medición rápida». Se ofrece en la Biblioteca
// («Medir ahora, sin ficha»), en general o para un tipo de medición (saltos, fuerza…).
import { useState } from "react";
import { useNavigate } from "react-router";
import { getDb } from "../data/db";
import { createPatient, listPatients, QUICK_PATIENT } from "../data/repo";
import { useToast } from "../ui/Toast";

export function useQuickMeasure() {
  const navigate = useNavigate();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  async function start(category?: string) {
    setBusy(true);
    try {
      const db = getDb();
      const found = (await listPatients(db, QUICK_PATIENT)).find((p) => p.name === QUICK_PATIENT);
      const id =
        found?.id ??
        (await createPatient(db, {
          name: QUICK_PATIENT,
          birthDate: null,
          sex: null,
          bodyMassKg: null,
          heightCm: null,
          legLengthCm: null,
          pushOffDistanceCm: null,
          notes: "Mediciones hechas sin elegir paciente. Puedes cambiarle el nombre y los datos cuando quieras.",
        }));
      navigate(category ? `/pacientes/${id}/test/${category}` : `/pacientes/${id}/test`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "No se pudo empezar", "danger");
      setBusy(false);
    }
  }
  return { start, busy };
}
