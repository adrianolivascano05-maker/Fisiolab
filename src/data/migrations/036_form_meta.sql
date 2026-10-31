-- Qué se mandó en cada formulario (src/data/patientForms.ts, FormMeta): las preguntas de la anamnesis que vio el
-- paciente (al recoger solo se aceptan esas) y, a un paciente nuevo, la versión y el texto de la información de
-- protección de datos y de la casilla de contacto que se le mostraron. JSON; los envíos de antes no lo tienen.
alter table patient_forms add column meta text;

drop trigger sync_patient_forms_update;
create trigger sync_patient_forms_update after update on patient_forms
when (select applying from sync_state) = 0
  and (old.id is not new.id or old.patient_id is not new.patient_id or old.episode_id is not new.episode_id or old.kind is not new.kind or old.form_key is not new.form_key or old.sent_at is not new.sent_at or old.expires_at is not new.expires_at or old.answered_at is not new.answered_at or old.imported_at is not new.imported_at or old.cancelled_at is not new.cancelled_at or old.answers is not new.answers or old.skipped is not new.skipped or old.meta is not new.meta)
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('patient_forms', new.id, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;

drop trigger sync_fields_patient_forms;
create trigger sync_fields_patient_forms after update on patient_forms
when (select applying from sync_state) = 0
begin
  insert into sync_fields (tbl, pk, field, at, device)
    select 'patient_forms', new.id, f, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state) from (
      select 'patient_id' as f where old.patient_id is not new.patient_id
      union all select 'episode_id' where old.episode_id is not new.episode_id
      union all select 'kind' where old.kind is not new.kind
      union all select 'form_key' where old.form_key is not new.form_key
      union all select 'sent_at' where old.sent_at is not new.sent_at
      union all select 'expires_at' where old.expires_at is not new.expires_at
      union all select 'answered_at' where old.answered_at is not new.answered_at
      union all select 'imported_at' where old.imported_at is not new.imported_at
      union all select 'cancelled_at' where old.cancelled_at is not new.cancelled_at
      union all select 'answers' where old.answers is not new.answers
      union all select 'skipped' where old.skipped is not new.skipped
      union all select 'meta' where old.meta is not new.meta
    ) where true
    on conflict (tbl, pk, field) do update set at = excluded.at, device = excluded.device;
end;
