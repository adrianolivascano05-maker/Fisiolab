-- Horario de la clínica (src/schedule): el equipo en la base, los turnos de cada persona y con quién es cada cita.
-- Todo se sincroniza como el resto: cada compañero lo ve en sus dispositivos.

-- El equipo, por su correo de Google (en minúsculas), con el nombre y el color con que sale en el horario. Lo pone la
-- app: cada persona al entrar en la clínica y quien la administra al añadir a alguien (src/cloud/TeamPage.tsx).
create table staff (
  email      text primary key,
  name       text not null,
  color      integer not null default 0,
  updated_at text not null
);

-- Los turnos: de quién, desde y hasta (instantes ISO) y una nota («recepción», «domicilios»…).
create table shifts (
  id          text primary key,
  staff_email text not null,
  starts_at   text not null,
  ends_at     text not null,
  note        text not null default '',
  created_at  text not null,
  updated_at  text not null,
  check (ends_at > starts_at)
);
create index shifts_starts on shifts (starts_at);

-- Con quién es cada cita (correo del equipo); vacío, con quien la dio.
alter table appointments add column assigned_to text;

create trigger sync_staff_insert after insert on staff
when (select applying from sync_state) = 0
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('staff', new.email, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
create trigger sync_staff_update after update on staff
when (select applying from sync_state) = 0
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('staff', new.email, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
create trigger sync_staff_delete after delete on staff
when (select applying from sync_state) = 0
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('staff', old.email, 'delete', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
create trigger sync_shifts_insert after insert on shifts
when (select applying from sync_state) = 0
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('shifts', new.id, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
create trigger sync_shifts_update after update on shifts
when (select applying from sync_state) = 0
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('shifts', new.id, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
create trigger sync_shifts_delete after delete on shifts
when (select applying from sync_state) = 0
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('shifts', old.id, 'delete', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
