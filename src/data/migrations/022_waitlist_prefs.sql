-- Lista de espera (src/data/waitlist.ts): cuándo le viene bien a cada uno, para ofrecer un hueco libre primero a quien
-- le encaja: por la mañana o por la tarde (vacío: cualquiera) y qué días de la semana (1 lunes … 7 domingo, separados
-- por comas; vacío: cualquiera). Y cuándo se le ofreció el último hueco, para no ofrecérselo dos veces.
alter table waitlist add column prefer_time text not null default '' check (prefer_time in ('', 'manana', 'tarde'));
alter table waitlist add column prefer_days text not null default '';
alter table waitlist add column offered_at text;

drop trigger sync_waitlist_update;
create trigger sync_waitlist_update after update on waitlist
when (select applying from sync_state) = 0
  and (old.id is not new.id or old.patient_id is not new.patient_id or old.note is not new.note or old.assigned_to is not new.assigned_to or old.created_at is not new.created_at or old.prefer_time is not new.prefer_time or old.prefer_days is not new.prefer_days or old.offered_at is not new.offered_at)
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('waitlist', new.id, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
