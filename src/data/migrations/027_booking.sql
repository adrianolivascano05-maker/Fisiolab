-- Reserva online y enlaces para anular (src/booking): de dónde viene la cita («online» si la reservó el paciente por
-- internet) y el código de su enlace para anular (el servidor solo guarda su huella). Se sincronizan con la cita.
alter table appointments add column source text not null default '';
alter table appointments add column cancel_token text;

drop trigger sync_appointments_update;
create trigger sync_appointments_update after update on appointments
when (select applying from sync_state) = 0
  and (old.id is not new.id or old.patient_id is not new.patient_id or old.starts_at is not new.starts_at or old.minutes is not new.minutes or old.status is not new.status or old.created_at is not new.created_at or old.created_by is not new.created_by or old.assigned_to is not new.assigned_to or old.reminded_at is not new.reminded_at or old.confirmed_at is not new.confirmed_at or old.source is not new.source or old.cancel_token is not new.cancel_token)
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('appointments', new.id, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
