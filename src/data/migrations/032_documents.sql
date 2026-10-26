-- Archivos del paciente (src/data/documents.ts): informes y pruebas en PDF que añade la clínica o que sube el propio
-- paciente con su enlace. El archivo no está aquí: va cifrado en el almacén de documentos del servidor de la clínica
-- (R2, cloudflare/worker.js) con «doc_key», una clave propia de cada uno que solo está en esta base (que también viaja
-- cifrada). «uploaded_at» vacío: aún no está en el servidor; lo tiene el dispositivo que lo añadió (src/documents/
-- cache.ts) y lo sube en cuanto puede. «form_id»: el enlace con el que lo subió el paciente.
create table documents (
  id          text primary key,
  patient_id  text not null references patients (id) on delete cascade,
  episode_id  text not null,
  name        text not null,
  mime        text not null default 'application/pdf',
  size        integer not null,
  doc_key     text not null,
  source      text not null default 'clinic' check (source in ('clinic', 'patient')),
  form_id     text,
  created_at  text not null,
  uploaded_at text,
  updated_at  text not null
);
create index documents_patient on documents (patient_id, created_at);

-- Lo que este dispositivo tiene que borrar del servidor (al borrar un archivo o su paciente): se apunta antes de
-- borrar la fila y se quita al borrarlo allí. No se sincroniza: lo hace el dispositivo donde se borró.
create table document_trash (
  id text primary key,
  at text not null
);

create trigger sync_documents_insert after insert on documents
when (select applying from sync_state) = 0
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('documents', new.id, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
create trigger sync_documents_update after update on documents
when (select applying from sync_state) = 0
  and (old.id is not new.id or old.patient_id is not new.patient_id or old.episode_id is not new.episode_id or old.name is not new.name or old.mime is not new.mime or old.size is not new.size or old.doc_key is not new.doc_key or old.source is not new.source or old.form_id is not new.form_id or old.created_at is not new.created_at or old.uploaded_at is not new.uploaded_at)
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('documents', new.id, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
create trigger sync_documents_delete after delete on documents
when (select applying from sync_state) = 0
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('documents', old.id, 'delete', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
