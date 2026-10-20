-- Teléfono, email y dirección pasan de la anamnesis (que va por motivo de consulta) a la ficha del paciente: se copian
-- de su anamnesis (o, si no, del último motivo que los tenga) y se quitan de las anamnesis.
alter table patients add column phone text not null default '';
alter table patients add column email text not null default '';
alter table patients add column address text not null default '';

update patients set
  phone = coalesce(
    nullif(trim(coalesce((select answers ->> '$.telefono' from anamnesis where patient_id = patients.id), '')), ''),
    (select trim(answers ->> '$.telefono') from episodes
      where patient_id = patients.id and trim(coalesce(answers ->> '$.telefono', '')) <> ''
      order by started_at desc limit 1),
    ''),
  email = coalesce(
    nullif(trim(coalesce((select answers ->> '$.email' from anamnesis where patient_id = patients.id), '')), ''),
    (select trim(answers ->> '$.email') from episodes
      where patient_id = patients.id and trim(coalesce(answers ->> '$.email', '')) <> ''
      order by started_at desc limit 1),
    ''),
  address = coalesce(
    nullif(trim(coalesce((select answers ->> '$.direccion' from anamnesis where patient_id = patients.id), '')), ''),
    (select trim(answers ->> '$.direccion') from episodes
      where patient_id = patients.id and trim(coalesce(answers ->> '$.direccion', '')) <> ''
      order by started_at desc limit 1),
    '')
where exists (select 1 from anamnesis where patient_id = patients.id and (answers ->> '$.telefono' is not null or answers ->> '$.email' is not null or answers ->> '$.direccion' is not null))
   or exists (select 1 from episodes where patient_id = patients.id and (answers ->> '$.telefono' is not null or answers ->> '$.email' is not null or answers ->> '$.direccion' is not null));

update anamnesis set answers = json_remove(answers, '$.telefono', '$.email', '$.direccion') where answers ->> '$.telefono' is not null or answers ->> '$.email' is not null or answers ->> '$.direccion' is not null;
update episodes set answers = json_remove(answers, '$.telefono', '$.email', '$.direccion') where answers ->> '$.telefono' is not null or answers ->> '$.email' is not null or answers ->> '$.direccion' is not null;

-- Las mediciones libres (src/free) tenían una tabla propia, solo en el dispositivo, que el módulo creaba al usarlo.
-- Pasa a ser una tabla de la app y se sincroniza como las demás: lo que ya hubiera se sube en la próxima copia.
create table if not exists free_measurements (
  id         text primary key,
  patient_id text not null references patients (id) on delete cascade,
  created_at text not null,
  data       text not null check (json_valid(data))
);
create index if not exists free_measurements_patient on free_measurements (patient_id, created_at);

create trigger sync_free_measurements_insert after insert on free_measurements
when (select applying from sync_state) = 0
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('free_measurements', new.id, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
create trigger sync_free_measurements_update after update on free_measurements
when (select applying from sync_state) = 0
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('free_measurements', new.id, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
create trigger sync_free_measurements_delete after delete on free_measurements
when (select applying from sync_state) = 0
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('free_measurements', old.id, 'delete', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
insert into sync_changes (tbl, pk, op, at, device) select 'free_measurements', id, 'upsert', created_at, (select device from sync_state) from free_measurements;
update sync_state set changes = changes + (select count(*) from free_measurements);
