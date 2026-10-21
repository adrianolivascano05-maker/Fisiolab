-- Lista de espera (src/data/waitlist.ts): quién quiere un hueco antes, cuándo le viene bien y, en un equipo, con quién
-- (vacío: con cualquiera). Una fila por paciente; al darle la cita desde la lista, se quita. Se sincroniza.
create table waitlist (
  id          text primary key,
  patient_id  text not null unique references patients (id) on delete cascade,
  note        text not null default '',
  assigned_to text,
  created_at  text not null,
  updated_at  text not null
);

create trigger sync_waitlist_insert after insert on waitlist
when (select applying from sync_state) = 0
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('waitlist', new.id, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
create trigger sync_waitlist_update after update on waitlist
when (select applying from sync_state) = 0
  and (old.id is not new.id or old.patient_id is not new.patient_id or old.note is not new.note or old.assigned_to is not new.assigned_to or old.created_at is not new.created_at)
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('waitlist', new.id, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
create trigger sync_waitlist_delete after delete on waitlist
when (select applying from sync_state) = 0
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('waitlist', old.id, 'delete', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
