// El motivo de consulta en la cabecera de la ficha: qué motivo se está viendo (las pestañas enseñan solo lo suyo),
// cambiar a otro o a todos, empezar uno nuevo con su propia anamnesis, y darle nombre, cerrarlo o borrarlo.
import { Check, ChevronDown, Plus } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { bumpData } from "../app/dataVersion";
import { fmtDate } from "../app/format";
import { useAsync } from "../app/useAsync";
import { getAnamnesis, type Answers } from "../data/clinical";
import { getDb } from "../data/db";
import { ALL, createEpisode, deleteEpisode, episodeCounts, episodeLabel, getFocus, listEpisodes, setFocus, updateEpisode, type Episode } from "../data/episodes";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { cx } from "../ui/cx";
import { TextField } from "../ui/Field";
import { Sheet } from "../ui/Sheet";
import { useToast } from "../ui/Toast";
import { ANAMNESIS } from "./anamnesis";

/** Lo que no cambia de un motivo a otro (datos personales, antecedentes, hábitos): pasa a la anamnesis nueva. */
const KEEP = new Set(ANAMNESIS.filter((s) => ["datos", "antecedentes", "familiares", "habitos"].includes(s.id)).flatMap((s) => s.fields.map((f) => f.id)));
KEEP.delete("fecha_valoracion");

const today = () => new Date().toISOString().slice(0, 10);
const records = (n: number | undefined) => (!n ? "sin registros" : n === 1 ? "1 registro" : `${n} registros`);

export function EpisodePicker({ patientId }: { patientId: string }) {
  const toast = useToast();
  const navigate = useNavigate();
  const data = useAsync(async () => {
    const db = getDb();
    const [episodes, focus, counts] = await Promise.all([listEpisodes(db, patientId), getFocus(db, patientId), episodeCounts(db, patientId)]);
    return { episodes, focus, counts };
  }, [patientId]);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"list" | "new" | "rename" | "delete">("list");
  const [title, setTitle] = useState("");
  const [day, setDay] = useState(today);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!data.data) return null;
  const { episodes, focus, counts } = data.data;
  const several = episodes.length > 1;
  // Con un solo motivo, es ese (aunque no se haya elegido): se puede renombrar o dar por terminado.
  const current = episodes.find((e) => e.id === focus) ?? (several ? undefined : episodes[0]);
  const label = current ? episodeLabel(current) : several ? "Todos los motivos" : episodeLabel(episodes[0]!);

  const close = () => {
    setOpen(false);
    setView("list");
    setError(null);
  };
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const choose = (id: string) =>
    run(async () => {
      await setFocus(getDb(), patientId, id);
      close();
      bumpData();
    });
  const create = () =>
    run(async () => {
      const db = getDb();
      const prev = (await getAnamnesis(db, patientId))?.answers ?? {};
      const answers: Answers = Object.fromEntries(Object.entries(prev).filter(([k]) => KEEP.has(k)));
      answers.fecha_valoracion = day;
      answers.motivo = title.trim();
      const id = await createEpisode(db, patientId, { title, startedAt: new Date(`${day}T12:00:00`).toISOString(), answers });
      close();
      toast("Motivo de consulta creado", "success");
      bumpData();
      navigate(`/pacientes/${patientId}/anamnesis`, { state: { editEpisode: id } });
    });
  const change = (e: Episode, c: { title?: string; closedAt?: string | null }, done: string) =>
    run(async () => {
      await updateEpisode(getDb(), patientId, e.id, c);
      setView("list");
      toast(done, "success");
      bumpData();
      // Al darlo por terminado, su informe de alta.
      if (c.closedAt) {
        close();
        navigate(`/pacientes/${patientId}/alta`);
      }
    });
  const remove = (e: Episode) =>
    run(async () => {
      await deleteEpisode(getDb(), patientId, e.id);
      close();
      toast("Motivo borrado");
      bumpData();
    });

  const option = (id: string, name: string, detail: string, closed = false) => (
    <li key={id}>
      <button
        type="button"
        onClick={() => choose(id)}
        aria-current={focus === id ? "true" : undefined}
        className={cx("flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left hover:bg-surface", focus === id && "bg-accent-soft")}
      >
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-semibold">{name}</span>
          <span className="text-sm text-text-muted">
            {detail}
            {closed && " · terminado"}
          </span>
        </span>
        {focus === id && <Check aria-hidden="true" className="size-5 shrink-0 text-accent" />}
      </button>
    </li>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="inline-flex min-h-9 max-w-full items-center gap-1.5 self-start rounded-pill border border-border bg-bg px-3 text-sm hover:bg-surface"
      >
        <span className="text-text-muted">Motivo:</span>
        <span className="truncate font-semibold">{label}</span>
        <ChevronDown aria-hidden="true" className="size-4 shrink-0" />
      </button>
      <Sheet open={open} onClose={close} title={view === "new" ? "Nuevo motivo de consulta" : "Motivo de consulta"}>
        {view === "list" && (
          <>
            <p className="text-sm text-text-muted">La ficha enseña la anamnesis, las sesiones, la exploración, las mediciones y los cuestionarios del motivo que elijas. Lo que añadas va a ese motivo.</p>
            <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-bg">
              {episodes.map((e) => option(e.id, episodeLabel(e), `Desde el ${fmtDate(e.startedAt)} · ${records(counts[e.id])}`, !!e.closedAt))}
              {several && option(ALL, "Todos los motivos", "Todo junto, del más reciente al más antiguo")}
            </ul>
            <Button icon={<Plus aria-hidden="true" className="size-5" />} block onClick={() => { setTitle(""); setDay(today()); setView("new"); }}>
              Nuevo motivo de consulta
            </Button>
            {current && (
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={() => { setTitle(current.title || episodeLabel(current)); setView("rename"); }}>
                  Cambiar el nombre
                </Button>
                <Button variant="secondary" size="sm" loading={busy} onClick={() => change(current, { closedAt: current.closedAt ? null : new Date().toISOString() }, current.closedAt ? "Motivo reabierto" : "Motivo terminado")}>
                  {current.closedAt ? "Reabrir" : "Dar por terminado"}
                </Button>
                {!current.first && (
                  <Button variant="ghost" size="sm" className="text-danger" onClick={() => setView("delete")}>
                    Borrar este motivo
                  </Button>
                )}
              </div>
            )}
          </>
        )}
        {view === "new" && (
          <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); void create(); }}>
            <p className="text-sm text-text-muted">Tendrá su propia anamnesis (se copian los datos personales, los antecedentes y los hábitos) y sus propias sesiones, exploraciones, mediciones y cuestionarios.</p>
            <TextField label="¿Por qué viene ahora?" placeholder="Por ejemplo: dolor lumbar" value={title} onChange={(e) => setTitle(e.target.value)} />
            <TextField label="Fecha" type="date" value={day} onChange={(e) => setDay(e.target.value)} />
            {error && <Alert tone="danger" title={error} />}
            <Button type="submit" block loading={busy}>
              Crear y rellenar su anamnesis
            </Button>
            <Button variant="secondary" block onClick={() => setView("list")}>
              Cancelar
            </Button>
          </form>
        )}
        {view === "rename" && current && (
          <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); void change(current, { title }, "Nombre cambiado"); }}>
            <TextField label="Nombre del motivo" value={title} onChange={(e) => setTitle(e.target.value)} />
            {error && <Alert tone="danger" title={error} />}
            <Button type="submit" block loading={busy}>
              Guardar
            </Button>
            <Button variant="secondary" block onClick={() => setView("list")}>
              Cancelar
            </Button>
          </form>
        )}
        {view === "delete" && current && (
          <>
            <p>
              Se borrará «{episodeLabel(current)}» con su anamnesis y {records(counts[current.id])} (sesiones, exploraciones, mediciones y cuestionarios). No se puede deshacer.
            </p>
            {error && <Alert tone="danger" title={error} />}
            <Button variant="danger" block loading={busy} onClick={() => remove(current)}>
              Borrar el motivo
            </Button>
            <Button variant="secondary" block onClick={() => setView("list")}>
              Cancelar
            </Button>
          </>
        )}
      </Sheet>
    </>
  );
}
