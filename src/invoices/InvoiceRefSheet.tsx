// Apuntar en un cobro el número de la factura que la clínica le hizo con su programa de facturación (src/data/toBill.ts).
// Lo usan «Para facturar» y los cobros de la ficha del paciente.
import { useState } from "react";
import { bumpData } from "../app/dataVersion";
import { euros, setInvoiceRef } from "../data/billing";
import { getDb } from "../data/db";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { TextField } from "../ui/Field";
import { Sheet } from "../ui/Sheet";
import { useToast } from "../ui/Toast";
import { dayDmy } from "../app/format";

export type RefTarget = { id: string; amountCents: number; paidOn: string; invoiceRef: string; name?: string };

export function InvoiceRefSheet({ target, onClose }: { target: RefTarget | null; onClose: () => void }) {
  return (
    <Sheet open={!!target} onClose={onClose} title="Nº de factura">
      {/* Con «key», cada cobro empieza con su número, sin arrastrar lo escrito en otro. */}
      {target && <RefForm key={target.id} target={target} onDone={onClose} />}
    </Sheet>
  );
}

function RefForm({ target, onDone }: { target: RefTarget; onDone: () => void }) {
  const toast = useToast();
  const [ref, setRef] = useState(target.invoiceRef);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async (value: string) => {
    setSaving(true);
    setError(null);
    try {
      await setInvoiceRef(getDb(), target.id, value);
      bumpData();
      toast(value.trim() ? `Factura ${value.trim()} apuntada` : "Quitado el número de factura", "success");
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se ha podido guardar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        void save(ref);
      }}
    >
      <p className="text-text-muted">
        Cobro de {euros(target.amountCents)} del {dayDmy(target.paidOn)}
        {target.name ? ` · ${target.name}` : ""}. Escribe el número que le dio tu programa de facturación.
      </p>
      <TextField label="Número de la factura" maxLength={60} value={ref} onChange={(e) => setRef(e.target.value)} />
      {error && <Alert tone="danger" title={error} />}
      <Button type="submit" size="lg" block loading={saving} disabled={!ref.trim()}>
        Guardar
      </Button>
      {target.invoiceRef && (
        <Button type="button" variant="secondary" block onClick={() => void save("")}>
          Quitar el número
        </Button>
      )}
    </form>
  );
}
