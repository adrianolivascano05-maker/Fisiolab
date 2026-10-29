// Después de darle cita a alguien que está en la lista de espera (desde la lista o desde su ficha): ¿sale de la lista
// o sigue esperando para adelantarla? Se pregunta en vez de quitarlo solo.
import { useState } from "react";
import { bumpData } from "../app/dataVersion";
import { getDb } from "../data/db";
import { removeFromWaitlist, waitlistOf, type WaitItem } from "../data/waitlist";
import { Button } from "../ui/Button";
import { Sheet } from "../ui/Sheet";
import { useToast } from "../ui/Toast";

/** `ask(patientId)`: si está en la lista, abre la pregunta. `sheet`: la hoja, para ponerla en la pantalla. */
export function useLeaveWaitlist() {
  const toast = useToast();
  const [item, setItem] = useState<WaitItem | null>(null);
  const ask = async (patientId: string) => {
    const found = await waitlistOf(getDb(), patientId);
    if (found) setItem(found);
  };
  const sheet = (
    <Sheet open={!!item} onClose={() => setItem(null)} title={item ? `¿Quitar a ${item.name} de la lista de espera?` : ""}>
      <p>Ya tiene su cita. Si aún quiere venir antes, déjalo en la lista y se le seguirán ofreciendo los huecos que se liberen.</p>
      <Button
        block
        onClick={async () => {
          await removeFromWaitlist(getDb(), item!.id);
          bumpData();
          toast(`${item!.name}: fuera de la lista`, "success");
          setItem(null);
        }}
      >
        Sí, quitarlo de la lista
      </Button>
      <Button variant="secondary" block onClick={() => setItem(null)}>
        No, que siga esperando
      </Button>
    </Sheet>
  );
  return { ask, sheet };
}
