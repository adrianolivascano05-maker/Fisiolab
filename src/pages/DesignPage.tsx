import { Activity, Dumbbell, Footprints, Plus, Rotate3d, Timer, Upload, Users } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Alert } from "../ui/Alert";
import { TabBar, TopBar } from "../ui/AppBar";
import { Button, IconButton } from "../ui/Button";
import { MetricCard } from "../ui/Card";
import { CategoryTile } from "../ui/CategoryTile";
import { EmptyState } from "../ui/EmptyState";
import { NumberField, SelectField, TextField } from "../ui/Field";
import { FrameControls, FrameScrubber, MarkButton, type Marker } from "../ui/FrameScrubber";
import { List, PatientRow } from "../ui/ListItem";
import { Scale } from "../ui/Scale";
import { Sheet } from "../ui/Sheet";
import { useToast } from "../ui/Toast";

/** Página de comprobación del sistema de diseño: cada pieza, aislada, con sus estados. */
export function DesignPage() {
  const toast = useToast();
  const [sheet, setSheet] = useState(false);
  const [sleep, setSleep] = useState<number | null>(4);
  const [frame, setFrame] = useState(288);
  const [playing, setPlaying] = useState(false);
  const [markers, setMarkers] = useState<Marker[]>([{ frame: 240, kind: "takeoff" }]);
  const frameCount = 1200;

  function mark(kind: Marker["kind"]) {
    setMarkers((list) => [...list.filter((m) => m.kind !== kind), { frame, kind }]);
  }

  return (
    <>
      <TopBar
        title="Sistema de diseño"
        backTo="/"
        action={
          <IconButton label="Nuevo paciente">
            <Plus aria-hidden="true" className="size-6" />
          </IconButton>
        }
      />
      <main className="mx-auto flex max-w-[var(--layout-content-max)] flex-col gap-8 px-4 pb-32 pt-4">
        <Section title="Botones">
          <div className="flex flex-wrap gap-2">
            <Button>Guardar</Button>
            <Button variant="secondary">Repetir</Button>
            <Button variant="ghost">Ver ayuda</Button>
            <Button variant="danger">Borrar paciente</Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm">Pequeño</Button>
            <Button size="lg" icon={<Upload aria-hidden="true" className="size-5" />}>
              Subir vídeo
            </Button>
            <Button loading>Calculando</Button>
            <Button disabled>Desactivado</Button>
          </div>
          <Button block onClick={() => toast("Test guardado", "success")}>
            Botón a todo el ancho (muestra un aviso)
          </Button>
        </Section>

        <Section title="Campos">
          <TextField label="Nombre" placeholder="Nombre y apellidos" />
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="Peso" unit="kg" defaultValue="62,5" />
            <NumberField label="Estatura" unit="cm" defaultValue="170" />
          </div>
          <NumberField label="Distancia de empuje" unit="cm" hint="Longitud de la pierna estirada menos la altura en sentadilla a 90°." />
          <NumberField label="Altura de caída" unit="cm" defaultValue="0" error="Indica la altura del cajón para el drop jump." />
          <SelectField label="Tipo de salto" defaultValue="cmj">
            <option value="cmj">CMJ (con contramovimiento)</option>
            <option value="sj">SJ (desde sentadilla)</option>
            <option value="dj">Drop jump</option>
          </SelectField>
          <TextField label="Desactivado" disabled defaultValue="No editable" />
        </Section>

        <Section title="Escala (bienestar)">
          <Scale label="Calidad del sueño" value={sleep} onChange={setSleep} lowLabel="Muy mala" highLabel="Muy buena" />
        </Section>

        <Section title="Métricas">
          <MetricCard size="lg" label="Altura del salto" value="31,2" unit="cm" detail="Tiempo de vuelo 504 ms" />
          <div className="grid grid-cols-2 gap-3">
            <MetricCard label="Potencia" value="2.814" unit="W" />
            <MetricCard label="RSI" value="1,84" />
          </div>
          <MetricCard label="Altura del salto" value="92,0" unit="cm" warning="Valor poco habitual: revisa las marcas del vídeo." />
        </Section>

        <Section title="Lista de pacientes">
          <List label="Pacientes">
            <PatientRow to="#" name="Ana Martín López" meta="Último test: CMJ · 12 oct" />
            <PatientRow to="#" name="Jorge Ruiz" meta="Sin mediciones todavía" />
          </List>
          <EmptyState icon={Users} title="Todavía no hay pacientes" action={<Button icon={<Plus aria-hidden="true" className="size-5" />}>Añadir paciente</Button>}>
            Añade a tu primer paciente y mide su salto en un par de minutos.
          </EmptyState>
        </Section>

        <Section title="Categorías de test">
          <div className="grid grid-cols-2 gap-3">
            <CategoryTile to="#" icon={Activity} title="Saltos" detail="CMJ, SJ, drop jump" />
            <CategoryTile to="#" icon={Dumbbell} title="Fuerza" detail="Velocidad de barra, 1RM" />
            <CategoryTile to="#" icon={Timer} title="Sprint" detail="Tiempos y cambios de dirección" />
            <CategoryTile to="#" icon={Footprints} title="Carrera" detail="Contacto y frecuencia" />
            <CategoryTile to="#" icon={Rotate3d} title="Movilidad" detail="Tobillo, cadera, hombro" />
          </div>
        </Section>

        <Section title="Avisos">
          <Alert tone="warning" title="Este vídeo va a 30 fps">
            Para medir saltos hace falta cámara lenta (120 o 240 fps). Con 30 fps el error puede ser de varios centímetros.
          </Alert>
          <Alert tone="info" title="Haz una copia de seguridad">Han pasado 8 días desde la última.</Alert>
          <Alert tone="success" title="Copia guardada" />
          <Alert tone="danger" title="No se pudo leer el vídeo">Prueba a guardarlo primero en la app Archivos.</Alert>
        </Section>

        <Section title="Hoja inferior">
          <Button variant="secondary" onClick={() => setSheet(true)}>
            Cómo grabar un CMJ
          </Button>
          <Sheet open={sheet} onClose={() => setSheet(false)} title="Cómo grabar un CMJ">
            <ol className="list-decimal space-y-2 pl-5 text-base">
              <li>Activa la cámara lenta del móvil (240 fps si puede).</li>
              <li>Coloca el móvil a la altura de los pies, a unos 2-3 metros, quieto.</li>
              <li>Que se vean los pies en todo momento, antes y después del salto.</li>
            </ol>
            <Button block onClick={() => setSheet(false)}>
              Entendido
            </Button>
          </Sheet>
        </Section>

        <Section title="Visor de vídeo (marcado por fotograma)">
          <div className="flex flex-col gap-4 rounded-lg bg-media-bg p-4">
            <div className="flex aspect-[9/12] items-center justify-center rounded-md bg-media-surface text-sm text-media-muted">
              aquí va el vídeo
            </div>
            <FrameScrubber frameCount={frameCount} frame={frame} fps={240} markers={markers} onFrame={setFrame} />
            <FrameControls
              playing={playing}
              onTogglePlay={() => setPlaying((p) => !p)}
              onStep={(d) => setFrame((f) => Math.max(0, Math.min(frameCount - 1, f + d)))}
            />
            <p className="text-sm text-media-muted">Marca en el fotograma actual:</p>
            <div className="flex gap-2">
              <MarkButton kind="takeoff" done={markers.some((m) => m.kind === "takeoff")} onClick={() => mark("takeoff")} />
              <MarkButton kind="landing" done={markers.some((m) => m.kind === "landing")} onClick={() => mark("landing")} />
            </div>
            <MarkButton kind="contact" done={false} onClick={() => mark("contact")} />
          </div>
        </Section>

      </main>
      <TabBar />
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg">{title}</h2>
      {children}
    </section>
  );
}
