// Los enlaces de la reserva por internet (…/reservar/<clínica>) y para anular una cita (…/cita/<código>), que la app
// ya no tiene: las citas las dan, cambian y anulan las clínicas por teléfono, WhatsApp o en persona. Algún paciente
// puede tener todavía uno de esos enlaces en un mensaje: le decimos qué hacer en lugar de una página en blanco.
import { Alert } from "../ui/Alert";
import { Logo } from "../ui/Logo";

export function OldLinkPage() {
  return (
    <div className="min-h-dvh bg-surface">
      <header className="border-b-2 border-highlight bg-brand text-on-brand">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <Logo onDark />
        </div>
      </header>
      <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-5 pb-16">
        <h1 className="text-2xl leading-tight font-bold">Este enlace ya no funciona</h1>
        <Alert tone="info" title="Las citas se piden, se cambian y se anulan con la clínica">
          Escribe o llama a tu clínica de fisioterapia y te atenderán.
        </Alert>
      </main>
    </div>
  );
}
