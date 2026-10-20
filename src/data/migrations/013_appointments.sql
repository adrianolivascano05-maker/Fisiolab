-- Citas (src/clinical/README.md, «Agenda»). Hasta ahora la cita era solo la «siguiente cita» que se ponía al guardar
-- una sesión (sessions.next_at, que se sigue guardando como historia). Ahora cada cita es una fila: se puede dar sin
-- sesión, y queda si se atendió, si no vino o si se anuló. La que se da al guardar una sesión lleva el id de esa
-- sesión: así el evento de Google Calendar que ya existía (su id sale del de la cita) sigue siendo el mismo.
-- status: scheduled (pendiente), done (atendida: hay sesión ese día), no_show (no vino), cancelled (anulada).
create table appointments (
  id         text primary key,
  patient_id text not null references patients (id) on delete cascade,
  starts_at  text not null,
  minutes    integer not null check (minutes between 5 and 480),
  status     text not null default 'scheduled' check (status in ('scheduled', 'done', 'no_show', 'cancelled')),
  created_at text not null,
  updated_at text not null
);
create index appointments_starts on appointments (starts_at);
create index appointments_patient on appointments (patient_id, starts_at);

-- La siguiente cita que ya hubiera: la de la última sesión de cada paciente, si aún no ha llegado.
insert into appointments (id, patient_id, starts_at, minutes, status, created_at, updated_at)
select s.id, s.patient_id, s.next_at, coalesce(s.next_minutes, 45), 'scheduled', s.updated_at, s.updated_at
  from sessions s
 where s.next_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
   and s.id = (select s2.id from sessions s2 where s2.patient_id = s.patient_id order by s2.performed_at desc limit 1);

create trigger sync_appointments_insert after insert on appointments
when (select applying from sync_state) = 0
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('appointments', new.id, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
create trigger sync_appointments_update after update on appointments
when (select applying from sync_state) = 0
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('appointments', new.id, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
create trigger sync_appointments_delete after delete on appointments
when (select applying from sync_state) = 0
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('appointments', old.id, 'delete', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
insert into sync_changes (tbl, pk, op, at, device) select 'appointments', id, 'upsert', updated_at, (select device from sync_state) from appointments;
