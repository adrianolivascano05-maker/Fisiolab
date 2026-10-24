-- Bandeja de envíos (src/schedule/outbox.ts): lo que ya se ha mandado (o se ha decidido no mandar) desde la bandeja,
-- para que no vuelva a salir ni lo mande otra persona del equipo. «id»: la regla y a qué va («anamnesis:<cita>»,
-- «seguimiento:<paciente>:<día>», «recordatorio:<cita>»). Los recordatorios enviados se apuntan además en la cita
-- (appointments.reminded_at). Se sincroniza.
create table outbox (
  id          text primary key,
  patient_id  text not null references patients (id) on delete cascade,
  rule        text not null,
  status      text not null check (status in ('sent', 'skipped')),
  at          text not null,
  by          text not null default '',
  updated_at  text not null
);
create index outbox_patient on outbox (patient_id);

create trigger sync_outbox_insert after insert on outbox
when (select applying from sync_state) = 0
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('outbox', new.id, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
create trigger sync_outbox_update after update on outbox
when (select applying from sync_state) = 0
  and (old.id is not new.id or old.patient_id is not new.patient_id or old.rule is not new.rule or old.status is not new.status or old.at is not new.at or old.by is not new.by)
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('outbox', new.id, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
create trigger sync_outbox_delete after delete on outbox
when (select applying from sync_state) = 0
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('outbox', old.id, 'delete', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
