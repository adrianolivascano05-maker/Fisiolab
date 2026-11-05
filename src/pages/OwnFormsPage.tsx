// Ajustes › Cuestionarios propios (docs/cuestionarios-propios.md): la lista de los de la clínica, con «+ Nuevo
// cuestionario» y, en cada fila, un botón «⋯» con Duplicar · Renombrar · Archivar. Solo quien administra la clínica
// los crea o los cambia (sin clínica en la nube, quien usa el móvil); el resto del equipo los usa.
import { Archive, ArchiveRestore, Copy, MoreHorizontal, Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { bumpData } from "../app/dataVersion";
import { fmtDate } from "../app/format";
import { Page } from "../app/Page";
import { useAsync } from "../app/useAsync";
import { OWN_LABEL } from "../clinical/forms/own";
import { useCloud } from "../cloud/cloudContext";
import { getDb } from "../data/db";
import { memberEmail } from "../data/member";
import { archiveOwnForm, duplicateOwnForm, listOwnForms, renameOwnForm, type OwnFormDoc } from "../data/ownForms";
import { questionnaireUrl } from "../gallery/LibraryPages";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { TextField } from "../ui/Field";
import { Sheet } from "../ui/Sheet";
import { useToast } from "../ui/Toast";

export const OWN_FORMS_URL = "/ajustes/cuestionarios-propios";
export const ownFormEditUrl = (id: string) => `${OWN_FORMS_URL}/${encodeURIComponent(id)}`;

/** Enlaces enviados de un cuestionario que aún pueden contestarse (siguen valiendo hasta su fecha). */
async function pendingLinks(id: string): Promise<number> {
  const [r] = await getDb().query<{ n: number }>("select count(*) as n from patient_forms where kind = ? and imported_at is null and cancelled_at is null and expires_at > ?", [id, new Date().toISOString()]);
  return r?.n ?? 0;
}

function summary(d: OwnFormDoc): string {
  const n = d.spec.sections.reduce((acc, s) => acc + s.items.length, 0);
  return `${n === 1 ? "1 pregunta" : `${n} preguntas`} · ${d.spec.scoring ? "con nota" : "sin nota"} · editado el ${fmtDate(d.at)}`;
}

export function OwnFormsPage() {
  const cloud = useCloud();
  const toast = useToast();
  const navigate = useNavigate();
  const canEdit = !cloud?.clinic || cloud.clinic.role === "admin";
  const list = useAsync(() => listOwnForms(getDb()), [], { tables: ["settings"] });
  const [menu, setMenu] = useState<OwnFormDoc | null>(null);
  const [renaming, setRenaming] = useState<OwnFormDoc | null>(null);
  const [name, setName] = useState("");
  const [archiving, setArchiving] = useState<{ doc: OwnFormDoc; pending: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (work: () => Promise<unknown>, done: string) => {
    setError(null);
    try {
      await work();
      bumpData("settings");
      toast(done, "success");
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    }
  };
  const docs = list.data ?? [];
  const active = docs.filter((d) => !d.archived);
  const archived = docs.filter((d) => d.archived);

  const row = (d: OwnFormDoc) => (
    <li key={d.spec.id} className="flex items-center gap-1">
      <Link to={canEdit ? ownFormEditUrl(d.spec.id) : questionnaireUrl(d.spec.id)} className="flex min-h-14 min-w-0 flex-1 flex-col justify-center px-3 py-1 hover:bg-surface">
        <span className="font-semibold break-words">{d.spec.name}</span>
        <span className="text-sm text-text-muted">{summary(d)}</span>
      </Link>
      {canEdit && (
        <button type="button" aria-label={`Más opciones de «${d.spec.name}»`} onClick={() => setMenu(d)} className="mr-1 inline-flex size-11 shrink-0 items-center justify-center rounded-md text-text-muted hover:bg-surface">
          <MoreHorizontal aria-hidden="true" className="size-5" />
        </button>
      )}
    </li>
  );

  return (
    <Page title="Cuestionarios propios" backTo="/ajustes">
      <p className="text-sm text-text-muted">
        Para lo que no está en la Biblioteca: satisfacción, control semanal, adherencia a los ejercicios… Se pasan en consulta o se mandan al móvil como los demás, siempre con la etiqueta «{OWN_LABEL}». La app solo suma, hace la media o el porcentaje; nunca interpreta la nota.
      </p>
      {!canEdit && <Alert tone="info" title="Los crea y los cambia quien administra la clínica. Tú los puedes usar con tus pacientes." />}
      {canEdit && (
        <Button icon={<Plus aria-hidden="true" className="size-5" />} onClick={() => navigate(ownFormEditUrl("nuevo"))}>
          Nuevo cuestionario
        </Button>
      )}
      {list.data && !docs.length && (
        <p className="text-text-muted">Todavía no hay cuestionarios propios. Sirven para lo que no está en la Biblioteca: satisfacción, control semanal, adherencia a los ejercicios…</p>
      )}
      {active.length > 0 && (
        <section aria-label="Cuestionarios de la clínica" className="flex flex-col gap-1.5">
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-bg">{active.map(row)}</ul>
        </section>
      )}
      {archived.length > 0 && (
        <section aria-labelledby="h-own-archived" className="flex flex-col gap-1.5">
          <h2 id="h-own-archived" className="px-1 text-xs font-semibold tracking-wide text-text-muted uppercase">
            Archivados
          </h2>
          <p className="px-1 text-sm text-text-muted">No se pasan ni se mandan; lo respondido se sigue viendo en la ficha de cada paciente.</p>
          <ul aria-label="Cuestionarios archivados" className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-bg">
            {archived.map(row)}
          </ul>
        </section>
      )}
      {error && <Alert tone="danger" title={error} />}

      <Sheet open={!!menu} onClose={() => setMenu(null)} title={menu?.spec.name ?? ""}>
        {menu && (
          <div className="flex flex-col gap-2">
            <Button
              variant="secondary"
              block
              icon={<Copy aria-hidden="true" className="size-4" />}
              onClick={async () => {
                const d = menu;
                setMenu(null);
                await run(() => duplicateOwnForm(getDb(), d.spec.id, memberEmail()), "Cuestionario duplicado");
              }}
            >
              Duplicar
            </Button>
            <Button
              variant="secondary"
              block
              icon={<Pencil aria-hidden="true" className="size-4" />}
              onClick={() => {
                setName(menu.spec.name);
                setRenaming(menu);
                setMenu(null);
              }}
            >
              Renombrar
            </Button>
            {menu.archived ? (
              <Button
                variant="secondary"
                block
                icon={<ArchiveRestore aria-hidden="true" className="size-4" />}
                onClick={async () => {
                  const d = menu;
                  setMenu(null);
                  await run(() => archiveOwnForm(getDb(), d.spec.id, false, memberEmail()), "Se puede volver a usar");
                }}
              >
                Volver a usarlo
              </Button>
            ) : (
              <Button
                variant="secondary"
                block
                icon={<Archive aria-hidden="true" className="size-4" />}
                onClick={async () => {
                  const d = menu;
                  setMenu(null);
                  setArchiving({ doc: d, pending: await pendingLinks(d.spec.id) });
                }}
              >
                Archivar
              </Button>
            )}
          </div>
        )}
      </Sheet>

      <Sheet open={!!renaming} onClose={() => setRenaming(null)} title="Renombrar">
        {renaming && (
          <form
            className="flex flex-col gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await run(() => renameOwnForm(getDb(), renaming.spec.id, name, memberEmail()), "Nombre cambiado")) setRenaming(null);
            }}
          >
            <TextField label="Nombre" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
            <p className="text-sm text-text-muted">Lo respondido antes se sigue viendo con el nombre que tenía.</p>
            {error && <Alert tone="danger" title={error} />}
            <Button type="submit" block>
              Guardar
            </Button>
          </form>
        )}
      </Sheet>

      <Sheet open={!!archiving} onClose={() => setArchiving(null)} title={`¿Archivar «${archiving?.doc.spec.name ?? ""}»?`}>
        {archiving && (
          <div className="flex flex-col gap-3">
            <p>Dejará de salir en «Pasar un cuestionario» y en «Enviar al móvil». Lo respondido se sigue viendo en la ficha, la evolución y la exportación.</p>
            {archiving.pending > 0 && (
              <p className="font-semibold">
                {archiving.pending === 1 ? "Hay 1 enlace enviado sin contestar: se recogerá igual." : `Hay ${archiving.pending} enlaces enviados sin contestar: se recogerán igual.`} Valen hasta su fecha; si quieres, anúlalos desde la ficha del paciente.
              </p>
            )}
            <Button
              block
              onClick={async () => {
                const d = archiving.doc;
                setArchiving(null);
                await run(() => archiveOwnForm(getDb(), d.spec.id, true, memberEmail()), "Cuestionario archivado");
              }}
            >
              Archivar
            </Button>
            <Button variant="secondary" block onClick={() => setArchiving(null)}>
              No
            </Button>
          </div>
        )}
      </Sheet>
    </Page>
  );
}
