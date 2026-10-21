// La rejilla de la agenda, como Google Calendar: las horas a la izquierda y una columna por día (o, en el día de una
// clínica, por persona). Cada cita es un bloque que se arrastra para moverla: arriba y abajo cambia la hora (cada 15
// minutos), a otra columna cambia el día o la persona. Con el ratón basta arrastrar; en el móvil, mantener pulsada la
// cita un momento y moverla. Tocar un hueco vacío da una cita a esa hora. Los turnos se ven de fondo. Con dos dedos
// se cambia la vista: juntándolos se ven más días; separándolos, menos. Tocar el nombre de un día lo abre solo.
import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type TouchList } from "react";
import type { AgendaItem } from "../data/appointments";
import { staffColor, type Shift, type Staff } from "../data/schedule";
import { STATUS_LABELS } from "../data/appointments";
import { cx } from "../ui/cx";
import { HOUR_PX, inColumn, minutesOf, dayOf, hourRange, placeInLanes, snap, type Column } from "./layout";

const hourLabel = (h: number) => `${String(h).padStart(2, "0")}:00`;
const clock = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
/** Un color con transparencia (#rrggbb + alfa). */
const tint = (hex: string, alpha: string) => `${hex}${alpha}`;

type Drag = {
  item: AgendaItem;
  pointerId: number;
  x0: number;
  y0: number;
  from: number;
  col: number;
  active: boolean;
  mouse: boolean;
  timer?: ReturnType<typeof setTimeout>;
};

export type Move = { item: AgendaItem; column: Column; minutes: number };

export function AgendaGrid({
  columns,
  header,
  appointments,
  shifts,
  staff,
  today,
  showPerson,
  onOpen,
  onMove,
  onSlot,
  onShift,
  onHeader,
  onZoom,
}: {
  columns: Column[];
  /** Lo que sale arriba de cada columna. */
  header: (c: Column) => { title: string; subtitle?: string; color?: string; today?: boolean };
  appointments: AgendaItem[];
  shifts: Shift[];
  staff: Staff[];
  today: string;
  /** Poner en cada cita con quién es (cuando las columnas no van por persona). */
  showPerson: boolean;
  onOpen: (a: AgendaItem) => void;
  onMove: (m: Move) => void;
  /** Hueco vacío pulsado: columna y minuto (redondeado a la media hora). */
  onSlot: (column: Column, minutes: number) => void;
  /** Turno pulsado (solo si se puede cambiar). */
  onShift?: (s: Shift) => void;
  /** Cabecera de una columna pulsada (para abrir ese día). */
  onHeader?: (c: Column) => void;
  /** Pellizco con dos dedos: +1 para ver más días, −1 para menos. */
  onZoom?: (by: 1 | -1) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  /** Distancia entre los dos dedos al empezar el pellizco. */
  const pinch = useRef<number | null>(null);
  const fingers = (t: TouchList) => Math.hypot(t[0]!.clientX - t[1]!.clientX, t[0]!.clientY - t[1]!.clientY);
  const cols = useRef<(HTMLDivElement | null)[]>([]);
  const drag = useRef<Drag | null>(null);
  const justDragged = useRef(false);
  const [ghost, setGhost] = useState<{ id: string; col: number; minutes: number } | null>(null);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const range = useMemo(
    () =>
      hourRange([
        ...appointments.map((a) => ({ start: minutesOf(a.startsAt), end: minutesOf(a.startsAt) + a.minutes })),
        ...shifts.map((s) => ({ start: minutesOf(s.startsAt), end: dayOf(s.endsAt) === dayOf(s.startsAt) ? minutesOf(s.endsAt) : 24 * 60 })),
      ]),
    [appointments, shifts],
  );
  const top = (m: number) => ((m - range.from * 60) / 60) * HOUR_PX;
  const height = (range.to - range.from) * HOUR_PX;

  // Al abrir, a las 8 (o a la hora de ahora, si es más tarde).
  const scrolledOnce = useRef(false);
  useEffect(() => {
    if (scrolledOnce.current || !scroller.current) return;
    scrolledOnce.current = true;
    const target = Math.max(8, now.getHours() - 1);
    scroller.current.scrollTop = Math.max(0, top(target * 60));
  });

  // En el móvil, mientras se arrastra una cita, la pantalla no se desplaza.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const block = (e: TouchEvent) => {
      if (drag.current?.active) e.preventDefault();
    };
    el.addEventListener("touchmove", block, { passive: false });
    return () => el.removeEventListener("touchmove", block);
  }, []);

  const columnAt = (x: number) => {
    const i = cols.current.findIndex((el) => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return x >= r.left && x < r.right;
    });
    return i;
  };

  function start(e: ReactPointerEvent, item: AgendaItem, col: number) {
    if (e.button !== 0) return;
    const d: Drag = { item, pointerId: e.pointerId, x0: e.clientX, y0: e.clientY, from: minutesOf(item.startsAt), col, active: false, mouse: e.pointerType === "mouse" };
    drag.current = d;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    if (!d.mouse) {
      d.timer = setTimeout(() => {
        if (drag.current !== d) return;
        d.active = true;
        navigator.vibrate?.(15);
        setGhost({ id: item.id, col, minutes: d.from });
      }, 350);
    }
  }

  function move(e: ReactPointerEvent) {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    const dx = e.clientX - d.x0;
    const dy = e.clientY - d.y0;
    if (!d.active) {
      const far = Math.hypot(dx, dy);
      if (d.mouse && far > 5) d.active = true;
      else if (!d.mouse && far > 8) return cancel(); // el dedo quiere desplazar la pantalla
      else return;
    }
    const col = columnAt(e.clientX);
    const minutes = Math.max(0, Math.min(24 * 60 - d.item.minutes, snap(d.from + (dy / HOUR_PX) * 60)));
    setGhost({ id: d.item.id, col: col < 0 ? d.col : col, minutes });
  }

  function end(e: ReactPointerEvent) {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    clearTimeout(d.timer);
    drag.current = null;
    if (d.active && ghost && ghost.id === d.item.id) {
      justDragged.current = true;
      setTimeout(() => (justDragged.current = false), 0);
      const column = columns[ghost.col]!;
      if (ghost.col !== d.col || ghost.minutes !== d.from) onMove({ item: d.item, column, minutes: ghost.minutes });
    }
    setGhost(null);
  }

  function cancel() {
    const d = drag.current;
    if (d) clearTimeout(d.timer);
    drag.current = null;
    setGhost(null);
  }

  const nowMin = now.getHours() * 60 + now.getMinutes();
  // La semana entera cabe en la pantalla del móvil (sin desplazarse a los lados); 3 días o el equipo, más anchos.
  const minWidth = columns.length >= 7 ? 40 : columns.length > 3 ? 92 : 140;

  return (
    <div
      ref={scroller}
      className="relative max-h-[calc(100dvh-var(--layout-header)-var(--layout-tabbar)-13rem)] min-h-[24rem] touch-pan-x touch-pan-y overflow-auto rounded-lg border border-border bg-bg"
      onTouchStart={(e) => {
        pinch.current = onZoom && e.touches.length === 2 ? fingers(e.touches) : null;
      }}
      onTouchMove={(e) => {
        if (pinch.current === null || e.touches.length !== 2) return;
        const ratio = fingers(e.touches) / pinch.current;
        if (ratio < 0.7 || ratio > 1.4) {
          onZoom?.(ratio < 1 ? 1 : -1);
          pinch.current = null;
        }
      }}
      onTouchEnd={() => {
        pinch.current = null;
      }}
    >
      <div className="grid" style={{ gridTemplateColumns: `3rem repeat(${columns.length}, minmax(${minWidth}px, 1fr))` }}>
        {/* Cabecera: fija arriba al desplazar. */}
        <div className="sticky top-0 left-0 z-30 border-b border-border bg-bg" />
        {columns.map((c) => {
          const h = header(c);
          const inner = (
            <>
              <span className={cx("flex items-center gap-1.5 text-sm leading-tight", h.today ? "font-bold text-brand" : "font-semibold")}>
                {h.color && <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ background: h.color }} />}
                {h.title}
              </span>
              {h.subtitle && <span className={cx("text-xs", h.today ? "font-bold text-brand" : "text-text-muted")}>{h.subtitle}</span>}
            </>
          );
          const cell = "sticky top-0 z-20 flex flex-col items-center justify-center border-b border-l border-border bg-bg px-1 py-1.5 text-center";
          return onHeader ? (
            <button key={c.key} type="button" className={cx(cell, "hover:bg-surface")} onClick={() => onHeader(c)}>
              {inner}
              <span className="sr-only">, ver solo este día</span>
            </button>
          ) : (
            <div key={c.key} className={cell}>
              {inner}
            </div>
          );
        })}

        {/* Horas. */}
        <div className="sticky left-0 z-10 bg-bg" style={{ height }}>
          {Array.from({ length: range.to - range.from }, (_, i) => (
            <span key={i} className="absolute right-1 -translate-y-1/2 text-[11px] text-text-muted" style={{ top: i * HOUR_PX }}>
              {i === 0 ? "" : hourLabel(range.from + i)}
            </span>
          ))}
        </div>

        {columns.map((c, ci) => {
          const colShifts = shifts.filter((s) => inColumn(c, dayOf(s.startsAt), s.staffEmail));
          const colItems = appointments.filter((a) => inColumn(c, dayOf(a.startsAt), a.assignedTo));
          const placed = placeInLanes(colItems, (a) => ({ start: minutesOf(a.startsAt), end: minutesOf(a.startsAt) + Math.max(a.minutes, 15) }));
          const dragged = ghost && ghost.col === ci ? appointments.find((a) => a.id === ghost.id) : undefined;
          // Turnos: con columna de una persona, de fondo; si no, una barra fina de color por persona a la izquierda.
          const bandPeople = [...new Set(colShifts.map((s) => s.staffEmail))];
          return (
            <div
              key={c.key}
              ref={(el) => {
                cols.current[ci] = el;
              }}
              data-day={c.day}
              className="relative border-l border-border"
              style={{ height }}
              onClick={(e) => {
                if (e.target !== e.currentTarget || justDragged.current) return;
                const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
                onSlot(c, snap(range.from * 60 + (y / HOUR_PX) * 60, 30));
              }}
            >
              {Array.from({ length: range.to - range.from }, (_, i) => (
                <div key={i} aria-hidden="true" className="pointer-events-none absolute inset-x-0 border-t border-border/60" style={{ top: i * HOUR_PX }} />
              ))}
              {colShifts.map((s) => {
                const person = staff.find((p) => p.email === s.staffEmail);
                const color = staffColor(person);
                const startM = minutesOf(s.startsAt);
                const endM = dayOf(s.endsAt) === dayOf(s.startsAt) ? minutesOf(s.endsAt) : 24 * 60;
                const label = `Turno de ${person?.name ?? s.staffEmail}, ${clock(startM)}–${clock(endM)}${s.note ? `, ${s.note}` : ""}`;
                const band = c.person !== undefined;
                const style = band
                  ? { top: top(startM), height: top(endM) - top(startM), left: 0, right: 0, background: tint(color, "1a") }
                  : { top: top(startM), height: top(endM) - top(startM), left: bandPeople.indexOf(s.staffEmail) * 5, width: 4, background: color };
                return onShift ? (
                  <button key={s.id} type="button" aria-label={label} title={label} className="absolute rounded-sm" style={style} onClick={() => onShift(s)} />
                ) : (
                  <div key={s.id} role="img" aria-label={label} title={label} className="absolute rounded-sm" style={style} />
                );
              })}
              {c.day === today && nowMin >= range.from * 60 && nowMin <= range.to * 60 && (
                <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-danger" style={{ top: top(nowMin) }} />
              )}
              {placed.map((p) => (
                <EventBlock
                  key={p.item.id}
                  item={p.item}
                  staff={staff}
                  showPerson={showPerson}
                  moving={ghost?.id === p.item.id}
                  style={{
                    top: top(p.start),
                    height: Math.max(top(p.end) - top(p.start) - 2, 18),
                    left: `calc(${(p.lane / p.lanes) * 100}% + ${c.person === undefined && bandPeople.length ? bandPeople.length * 5 + 2 : 2}px)`,
                    width: `calc(${100 / p.lanes}% - ${c.person === undefined && bandPeople.length ? bandPeople.length * 5 + 4 : 4}px)`,
                  }}
                  onPointerDown={(e) => start(e, p.item, ci)}
                  onPointerMove={move}
                  onPointerUp={end}
                  onPointerCancel={cancel}
                  onClick={() => !justDragged.current && onOpen(p.item)}
                />
              ))}
              {dragged && ghost && (
                <EventBlock
                  item={dragged}
                  staff={staff}
                  showPerson={showPerson}
                  ghostTime={`${clock(ghost.minutes)}–${clock(ghost.minutes + dragged.minutes)}`}
                  style={{ top: top(ghost.minutes), height: Math.max(top(ghost.minutes + dragged.minutes) - top(ghost.minutes) - 2, 18), left: 2, right: 2, zIndex: 30 }}
                  onPointerMove={move}
                  onPointerUp={end}
                  onPointerCancel={cancel}
                />
              )}
            </div>
          );
        })}
      </div>
      {/* Lo que se arrastra sigue recibiendo el puntero aunque su bloque haya cambiado de columna. */}
      {ghost && <div className="fixed inset-0 z-40 cursor-grabbing" onPointerMove={move} onPointerUp={end} onPointerCancel={cancel} />}
    </div>
  );
}

function EventBlock({
  item,
  staff,
  showPerson,
  ghostTime,
  moving,
  style,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onClick,
}: {
  item: AgendaItem;
  staff: Staff[];
  showPerson: boolean;
  ghostTime?: string;
  /** Es la cita que se está arrastrando: se queda tenue en su sitio. */
  moving?: boolean;
  style: CSSProperties;
  onPointerDown?: (e: ReactPointerEvent) => void;
  onPointerMove?: (e: ReactPointerEvent) => void;
  onPointerUp?: (e: ReactPointerEvent) => void;
  onPointerCancel?: () => void;
  onClick?: () => void;
}) {
  const person = item.assignedTo ? staff.find((s) => s.email === item.assignedTo) : undefined;
  const color = item.assignedTo && staff.length ? staffColor(person) : "#0f766e";
  const startM = minutesOf(item.startsAt);
  const time = ghostTime ?? `${clock(startM)}–${clock(startM + item.minutes)}`;
  const off = item.status === "cancelled" || item.status === "no_show";
  const who = staff.length ? (item.assignedTo ? (person?.name ?? item.assignedTo) : "Sin asignar") : null;
  const label = `${item.name}, ${time}${who ? `, con ${who}` : ""}, ${STATUS_LABELS[item.status]}`;
  return (
    <button
      type="button"
      title={label}
      className={cx(
        "absolute flex touch-pan-y flex-col overflow-hidden rounded-md border-l-4 px-1.5 py-0.5 text-left text-xs leading-tight select-none",
        ghostTime ? "cursor-grabbing shadow-pop ring-2 ring-accent" : "cursor-grab hover:brightness-95",
        (off || moving) && "opacity-40",
      )}
      style={{ ...style, borderLeftColor: color, background: tint(color, ghostTime ? "40" : "26") }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onClick={onClick}
    >
      <span className={cx("truncate font-semibold", off && "line-through")}>{item.name}</span>
      <span className="truncate text-text-muted">
        <span className="sr-only">, </span>
        {time}
      </span>
      {who && (showPerson ? <span className="truncate text-text-muted">, con {who}</span> : <span className="sr-only">, con {who}</span>)}
      <span className="sr-only">, {STATUS_LABELS[item.status]}</span>
    </button>
  );
}
