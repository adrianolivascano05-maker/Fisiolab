-- Agenda cerrada (src/data/closures.ts): ratos en los que no se puede reservar por internet. De una persona
-- (staff_email) o de toda la clínica (staff_email vacío): una tarde, un día, unas vacaciones, un festivo. Lo pone cada
-- fisio para sí y quien administra la clínica para cualquiera. Las citas que ya hay no se tocan. Se sincroniza.
create table closures (
  id          text primary key,
  staff_email text not null default '',
  starts_at   text not null,
  ends_at     text not null,
  note        text not null default '',
  created_by  text not null default '',
  created_at  text not null,
  updated_at  text not null
);
create index closures_range on closures (starts_at, ends_at);

create trigger sync_closures_insert after insert on closures
when (select applying from sync_state) = 0
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('closures', new.id, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
create trigger sync_closures_update after update on closures
when (select applying from sync_state) = 0
  and (old.id is not new.id or old.staff_email is not new.staff_email or old.starts_at is not new.starts_at or old.ends_at is not new.ends_at
    or old.note is not new.note or old.created_by is not new.created_by or old.created_at is not new.created_at)
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('closures', new.id, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
create trigger sync_closures_delete after delete on closures
when (select applying from sync_state) = 0
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('closures', old.id, 'delete', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
