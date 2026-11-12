-- Calendario del paciente (12-11-2026): saltar días sueltos de algo que se repite cada semana («este jueves no
-- entrena»). skip_days: los días que no, «AAAA-MM-DD,AAAA-MM-DD»; vacío en lo que no se repite.
alter table patient_events add column skip_days text not null default '';

drop trigger sync_patient_events_update;
create trigger sync_patient_events_update after update on patient_events
when (select applying from sync_state) = 0
  and (old.id is not new.id or old.patient_id is not new.patient_id or old.kind is not new.kind or old.title is not new.title or old.starts_on is not new.starts_on or old.ends_on is not new.ends_on or old.time is not new.time or old.minutes is not new.minutes or old.repeat_days is not new.repeat_days or old.repeat_until is not new.repeat_until or old.notes is not new.notes or old.created_at is not new.created_at or old.skip_days is not new.skip_days)
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('patient_events', new.id, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;

drop trigger sync_fields_patient_events;
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
      union all select 'skip_days' where old.skip_days is not new.skip_days
    ) where true
    on conflict (tbl, pk, field) do update set at = excluded.at, device = excluded.device;
end;
