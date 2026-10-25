-- Lista de espera (src/data/waitlist.ts), más datos para ordenarla y filtrarla: si es preferente (pasa delante al
-- ordenar por prioridad: dolor agudo, postoperatorio…), desde qué día puede venir (AAAA-MM-DD; vacío, ya) y unas horas
-- concretas en las que le viene bien (minutos desde las 0:00, de `from_min` a `to_min`; vacías, la franja de siempre).
alter table waitlist add column priority integer not null default 0 check (priority in (0, 1));
alter table waitlist add column available_from text;
alter table waitlist add column from_min integer check (from_min is null or from_min between 0 and 1439);
alter table waitlist add column to_min integer check (to_min is null or to_min between 1 and 1440);

drop trigger sync_waitlist_update;
create trigger sync_waitlist_update after update on waitlist
when (select applying from sync_state) = 0
  and (old.id is not new.id or old.patient_id is not new.patient_id or old.note is not new.note or old.assigned_to is not new.assigned_to or old.created_at is not new.created_at or old.prefer_time is not new.prefer_time or old.prefer_days is not new.prefer_days or old.offered_at is not new.offered_at or old.priority is not new.priority or old.available_from is not new.available_from or old.from_min is not new.from_min or old.to_min is not new.to_min)
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('waitlist', new.id, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
