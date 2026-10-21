-- Formularios enviados al paciente (src/data/patientForms.ts): su parte de la anamnesis o un cuestionario, que rellena
-- desde su móvil con un enlace. «form_key» es la clave con la que se cifran el formulario y sus respuestas (va en el
-- enlace y aquí; el servidor no la ve). Al recoger las respuestas se rellena la ficha y se guarda lo que contestó
-- («answers», JSON) y lo que no se puso porque ya había algo escrito («skipped», JSON). Se sincroniza: cualquiera del
-- equipo puede recogerlas.
create table patient_forms (
  id          text primary key,
  patient_id  text not null references patients (id) on delete cascade,
  episode_id  text not null,
  kind        text not null,
  form_key    text not null,
  sent_at     text not null,
  expires_at  text not null,
  answered_at text,
  imported_at text,
  cancelled_at text,
  answers     text,
  skipped     text not null default '[]',
  updated_at  text not null
);
create index patient_forms_patient on patient_forms (patient_id, sent_at);

create trigger sync_patient_forms_insert after insert on patient_forms
when (select applying from sync_state) = 0
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('patient_forms', new.id, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
create trigger sync_patient_forms_update after update on patient_forms
when (select applying from sync_state) = 0
  and (old.id is not new.id or old.patient_id is not new.patient_id or old.episode_id is not new.episode_id or old.kind is not new.kind or old.form_key is not new.form_key or old.sent_at is not new.sent_at or old.expires_at is not new.expires_at or old.answered_at is not new.answered_at or old.imported_at is not new.imported_at or old.cancelled_at is not new.cancelled_at or old.answers is not new.answers or old.skipped is not new.skipped)
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('patient_forms', new.id, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
create trigger sync_patient_forms_delete after delete on patient_forms
when (select applying from sync_state) = 0
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('patient_forms', old.id, 'delete', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
