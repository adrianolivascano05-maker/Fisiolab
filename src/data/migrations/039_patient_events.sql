-- El calendario de cada paciente (src/data/patientEvents.ts): lo suyo fuera de la clínica que conviene tener a la vista
-- junto a sus citas: una operación, sus entrenamientos o partidos, una consulta o una prueba médica, un viaje.
-- No ocupan la agenda de la clínica, no se recuerdan por WhatsApp y no cuentan para los cobros ni las estadísticas.
--
-- Los días van como AAAA-MM-DD (el día en Madrid, como lo dice el paciente: «me operan el 12»), no como instante: un
-- cambio de hora o de zona no los mueve de día. La hora, si la tiene, es «HH:MM» de Madrid; sin hora, es de todo el día.
-- kind: surgery, medical, test, training, competition, travel, other. Sin CHECK a propósito: si otra versión añade un
-- tipo, un dispositivo sin actualizar lo recibe igual (y lo enseña como «Otro»).
-- ends_on: el último día, si dura varios (un viaje, unas vacaciones). repeat_days: los días de la semana en que se repite
-- cada semana («2,4»: martes y jueves; 1 es lunes y 7 domingo), hasta repeat_until (incluido) o sin fin.
create table patient_events (
  id           text primary key,
  patient_id   text not null references patients (id) on delete cascade,
  kind         text not null,
  title        text not null default '',
  starts_on    text not null,
  ends_on      text,
  time         text,
  minutes      integer,
  repeat_days  text not null default '',
  repeat_until text,
  notes        text not null default '',
  created_at   text not null,
  updated_at   text not null
);
create index patient_events_patient on patient_events (patient_id, starts_on);

create trigger sync_patient_events_insert after insert on patient_events
when (select applying from sync_state) = 0
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('patient_events', new.id, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
create trigger sync_patient_events_update after update on patient_events
when (select applying from sync_state) = 0
  and (old.id is not new.id or old.patient_id is not new.patient_id or old.kind is not new.kind or old.title is not new.title or old.starts_on is not new.starts_on or old.ends_on is not new.ends_on or old.time is not new.time or old.minutes is not new.minutes or old.repeat_days is not new.repeat_days or old.repeat_until is not new.repeat_until or old.notes is not new.notes or old.created_at is not new.created_at)
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('patient_events', new.id, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
create trigger sync_patient_events_delete after delete on patient_events
when (select applying from sync_state) = 0
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('patient_events', old.id, 'delete', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
create trigger sync_fields_patient_events after update on patient_events
when (select applying from sync_state) = 0
begin
  insert into sync_fields (tbl, pk, field, at, device)
    select 'patient_events', new.id, f, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state) from (
      select 'patient_id' as f where old.patient_id is not new.patient_id
      union all select 'kind' where old.kind is not new.kind
      union all select 'title' where old.title is not new.title
      union all select 'starts_on' where old.starts_on is not new.starts_on
      union all select 'ends_on' where old.ends_on is not new.ends_on
      union all select 'time' where old.time is not new.time
      union all select 'minutes' where old.minutes is not new.minutes
      union all select 'repeat_days' where old.repeat_days is not new.repeat_days
      union all select 'repeat_until' where old.repeat_until is not new.repeat_until
      union all select 'notes' where old.notes is not new.notes
      union all select 'created_at' where old.created_at is not new.created_at
    ) where true
    on conflict (tbl, pk, field) do update set at = excluded.at, device = excluded.device;
end;
