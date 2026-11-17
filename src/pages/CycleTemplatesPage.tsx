// Ajustes › Plantillas de plan por ciclos (src/data/cycleTemplates.ts): las que ha guardado la clínica desde un plan
// («Guardar como plantilla»), para renombrarlas, duplicarlas o archivarlas. Archivar no borra: deja de salir al crear
// un plan y se puede recuperar.
import { Archive, ArchiveRestore, Copy, Layers, Pencil } from "lucide-react";
import { useState } from "react";
import { bumpData } from "../app/dataVersion";
import { LoadError, Loading, Page } from "../app/Page";
import { useAsync } from "../app/useAsync";
import { duplicateTemplate, listTemplates, NAME_MAX, saveTemplate, templateSummary, type CycleTemplate } from "../data/cycleTemplates";
import { getDb } from "../data/db";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { TextField } from "../ui/Field";
import { Sheet } from "../ui/Sheet";
import { useToast } from "../ui/Toast";

export function CycleTemplatesPage() {
  const toast = useToast();
  const data = useAsync(() => listTemplates(getDb()), [], { tables: ["settings"] });
  const [renaming, setRenaming] = useState<{ t: CycleTemplate; name: string } | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  async function put(t: CycleTemplate, done: string) {
    try {
      await saveTemplate(getDb(), t, { touch: true });
      bumpData("settings");
      toast(done, "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "danger");
    }
  }

  const title = "Plantillas de plan por ciclos";
  if (data.error) return <Page title={title} backTo="/ajustes"><LoadError error={data.error} /></Page>;
  if (!data.data) return <Page title={title} backTo="/ajustes"><Loading /></Page>;
  const live = data.data.filter((t) => !t.archived);
  const archived = data.data.filter((t) => t.archived);

  const card = (t: CycleTemplate) => (
    <li key={t.id}>
      <Card className="flex flex-col gap-2">
        <p className="flex items-center gap-2 font-semibold">
          <Layers aria-hidden="true" className="size-5 shrink-0 text-accent" />
          {t.name}
        </p>
        <p className="text-sm text-text-muted">{templateSummary(t)}</p>
        <p className="text-sm text-text-muted">{t.phases.map((p, i) => `${i + 1} · ${p.name} (${p.weeks})`).join(" · ")}</p>
        <div className="flex flex-wrap gap-2">
          {!t.archived && (
            <Button size="sm" variant="secondary" icon={<Pencil aria-hidden="true" className="size-4" />} onClick={() => setRenaming({ t, name: t.name })}>
              Renombrar<span className="sr-only"> «{t.name}»</span>
            </Button>
          )}
          {!t.archived && (
            <Button size="sm" variant="secondary" icon={<Copy aria-hidden="true" className="size-4" />} onClick={() => void put(duplicateTemplate(t), "Plantilla duplicada")}>
              Duplicar<span className="sr-only"> «{t.name}»</span>
            </Button>
          )}
          {t.archived ? (
            <Button size="sm" variant="secondary" icon={<ArchiveRestore aria-hidden="true" className="size-4" />} onClick={() => void put({ ...t, archived: false }, "Plantilla recuperada")}>
              Recuperar<span className="sr-only"> «{t.name}»</span>
            </Button>
          ) : (
            <Button size="sm" variant="ghost" icon={<Archive aria-hidden="true" className="size-4" />} onClick={() => void put({ ...t, archived: true }, "Plantilla archivada: ya no sale al crear un plan")}>
              Archivar<span className="sr-only"> «{t.name}»</span>
            </Button>
          )}
        </div>
      </Card>
    </li>
  );

  return (
    <Page title={title} backTo="/ajustes">
      <p className="text-text-muted">
        Se guardan desde el plan de un paciente con «Guardar como plantilla» y salen al organizar otro plan. Llevan las fases, sus semanas y los ejercicios;
        no llevan fechas, objetivos ni el 1RM de nadie. Son de toda la clínica.
      </p>
      {live.length === 0 ? (
        <p className="text-sm text-text-muted">Aún no hay ninguna. Ábrela desde el plan de un paciente: «Guardar como plantilla».</p>
      ) : (
        <ul aria-label="Plantillas" className="flex flex-col gap-2">
          {live.map(card)}
        </ul>
      )}
      {archived.length > 0 && (
        <>
          <Button variant="ghost" className="self-start" aria-expanded={showArchived} onClick={() => setShowArchived(!showArchived)}>
            {showArchived ? "Ocultar las archivadas" : `Ver las archivadas (${archived.length})`}
          </Button>
          {showArchived && (
            <ul aria-label="Archivadas" className="flex flex-col gap-2">
              {archived.map(card)}
            </ul>
          )}
        </>
      )}
      <Sheet open={!!renaming} onClose={() => setRenaming(null)} title="Renombrar la plantilla">
        {renaming && (
          <>
            <TextField label="Nombre de la plantilla" maxLength={NAME_MAX} value={renaming.name} onChange={(e) => setRenaming({ ...renaming, name: e.target.value })} />
            <Button
              block
              disabled={!renaming.name.trim()}
              onClick={() => {
                void put({ ...renaming.t, name: renaming.name }, "Plantilla renombrada");
                setRenaming(null);
              }}
            >
              Guardar el nombre
            </Button>
          </>
        )}
      </Sheet>
    </Page>
  );
}
