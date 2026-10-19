-- Sincronización entre dispositivos (src/cloud/README.md). Cada cambio de una fila deja aquí su hora: al juntar
-- la copia de este dispositivo con la de Google Drive gana, fila a fila, el cambio más reciente (también los
-- borrados). Las tablas sync_* no se sincronizan: son de cada dispositivo.

-- device: identifica este dispositivo (desempata dos cambios a la misma hora).
-- applying: 1 mientras se aplica la copia de la nube (esos cambios no cuentan como propios).
-- changes / pushed: cambios hechos aquí y cuántos de ellos ya están en la nube.
create table sync_state (
  id       integer primary key check (id = 1),
  device   text not null,
  applying integer not null default 0,
  changes  integer not null default 0,
  pushed   integer not null default 0
);
insert into sync_state (id, device) values (1, lower(hex(randomblob(16))));

-- El último cambio de cada fila: tabla, clave (json para las claves de dos columnas), alta o borrado y hora.
create table sync_changes (
  tbl    text not null,
  pk     text not null,
  op     text not null check (op in ('upsert', 'delete')),
  at     text not null,
  device text not null,
  primary key (tbl, pk)
);

-- patients
create trigger sync_patients_insert after insert on patients
when (select applying from sync_state) = 0
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('patients', new.id, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
create trigger sync_patients_update after update on patients
when (select applying from sync_state) = 0
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('patients', new.id, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
create trigger sync_patients_delete after delete on patients
when (select applying from sync_state) = 0
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('patients', old.id, 'delete', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
insert into sync_changes (tbl, pk, op, at, device) select 'patients', patients.id, 'upsert', updated_at, (select device from sync_state) from patients;

-- tests
create trigger sync_tests_insert after insert on tests
when (select applying from sync_state) = 0
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('tests', new.id, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
create trigger sync_tests_update after update on tests
when (select applying from sync_state) = 0
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('tests', new.id, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
create trigger sync_tests_delete after delete on tests
when (select applying from sync_state) = 0
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('tests', old.id, 'delete', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
insert into sync_changes (tbl, pk, op, at, device) select 'tests', tests.id, 'upsert', updated_at, (select device from sync_state) from tests;

-- profiles
create trigger sync_profiles_insert after insert on profiles
when (select applying from sync_state) = 0
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('profiles', new.id, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
create trigger sync_profiles_update after update on profiles
when (select applying from sync_state) = 0
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('profiles', new.id, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
create trigger sync_profiles_delete after delete on profiles
when (select applying from sync_state) = 0
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('profiles', old.id, 'delete', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
insert into sync_changes (tbl, pk, op, at, device) select 'profiles', profiles.id, 'upsert', updated_at, (select device from sync_state) from profiles;

-- profile_tests
create trigger sync_profile_tests_insert after insert on profile_tests
when (select applying from sync_state) = 0
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('profile_tests', json_array(new.profile_id, new.test_id), 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
create trigger sync_profile_tests_update after update on profile_tests
when (select applying from sync_state) = 0
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('profile_tests', json_array(new.profile_id, new.test_id), 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
create trigger sync_profile_tests_delete after delete on profile_tests
when (select applying from sync_state) = 0
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('profile_tests', json_array(old.profile_id, old.test_id), 'delete', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
insert into sync_changes (tbl, pk, op, at, device) select 'profile_tests', json_array(profile_tests.profile_id, profile_tests.test_id), 'upsert', '1970-01-01T00:00:00.000Z', (select device from sync_state) from profile_tests;

-- results
create trigger sync_results_insert after insert on results
when (select applying from sync_state) = 0
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('results', new.id, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
create trigger sync_results_update after update on results
when (select applying from sync_state) = 0
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('results', new.id, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
create trigger sync_results_delete after delete on results
when (select applying from sync_state) = 0
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('results', old.id, 'delete', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
insert into sync_changes (tbl, pk, op, at, device) select 'results', results.id, 'upsert', created_at, (select device from sync_state) from results;

-- marks
create trigger sync_marks_insert after insert on marks
when (select applying from sync_state) = 0
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('marks', new.id, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
create trigger sync_marks_update after update on marks
when (select applying from sync_state) = 0
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('marks', new.id, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
create trigger sync_marks_delete after delete on marks
when (select applying from sync_state) = 0
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('marks', old.id, 'delete', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
insert into sync_changes (tbl, pk, op, at, device) select 'marks', marks.id, 'upsert', created_at, (select device from sync_state) from marks;

-- videos
create trigger sync_videos_insert after insert on videos
when (select applying from sync_state) = 0
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('videos', new.id, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
create trigger sync_videos_update after update on videos
when (select applying from sync_state) = 0
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('videos', new.id, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
create trigger sync_videos_delete after delete on videos
when (select applying from sync_state) = 0
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('videos', old.id, 'delete', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
insert into sync_changes (tbl, pk, op, at, device) select 'videos', videos.id, 'upsert', created_at, (select device from sync_state) from videos;

-- wellness
create trigger sync_wellness_insert after insert on wellness
when (select applying from sync_state) = 0
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('wellness', new.id, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
create trigger sync_wellness_update after update on wellness
when (select applying from sync_state) = 0
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('wellness', new.id, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
create trigger sync_wellness_delete after delete on wellness
when (select applying from sync_state) = 0
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('wellness', old.id, 'delete', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
insert into sync_changes (tbl, pk, op, at, device) select 'wellness', wellness.id, 'upsert', created_at, (select device from sync_state) from wellness;

-- anamnesis
create trigger sync_anamnesis_insert after insert on anamnesis
when (select applying from sync_state) = 0
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('anamnesis', new.patient_id, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
create trigger sync_anamnesis_update after update on anamnesis
when (select applying from sync_state) = 0
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('anamnesis', new.patient_id, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
create trigger sync_anamnesis_delete after delete on anamnesis
when (select applying from sync_state) = 0
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('anamnesis', old.patient_id, 'delete', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
insert into sync_changes (tbl, pk, op, at, device) select 'anamnesis', anamnesis.patient_id, 'upsert', updated_at, (select device from sync_state) from anamnesis;

-- findings
create trigger sync_findings_insert after insert on findings
when (select applying from sync_state) = 0
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('findings', new.id, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
create trigger sync_findings_update after update on findings
when (select applying from sync_state) = 0
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('findings', new.id, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
create trigger sync_findings_delete after delete on findings
when (select applying from sync_state) = 0
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('findings', old.id, 'delete', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
insert into sync_changes (tbl, pk, op, at, device) select 'findings', findings.id, 'upsert', updated_at, (select device from sync_state) from findings;

-- sessions
create trigger sync_sessions_insert after insert on sessions
when (select applying from sync_state) = 0
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('sessions', new.id, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
create trigger sync_sessions_update after update on sessions
when (select applying from sync_state) = 0
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('sessions', new.id, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
create trigger sync_sessions_delete after delete on sessions
when (select applying from sync_state) = 0
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('sessions', old.id, 'delete', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
insert into sync_changes (tbl, pk, op, at, device) select 'sessions', sessions.id, 'upsert', updated_at, (select device from sync_state) from sessions;

-- questionnaires
create trigger sync_questionnaires_insert after insert on questionnaires
when (select applying from sync_state) = 0
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('questionnaires', new.id, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
create trigger sync_questionnaires_update after update on questionnaires
when (select applying from sync_state) = 0
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('questionnaires', new.id, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
create trigger sync_questionnaires_delete after delete on questionnaires
when (select applying from sync_state) = 0
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('questionnaires', old.id, 'delete', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
insert into sync_changes (tbl, pk, op, at, device) select 'questionnaires', questionnaires.id, 'upsert', updated_at, (select device from sync_state) from questionnaires;

-- validation_pairs
create trigger sync_validation_pairs_insert after insert on validation_pairs
when (select applying from sync_state) = 0
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('validation_pairs', new.id, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
create trigger sync_validation_pairs_update after update on validation_pairs
when (select applying from sync_state) = 0
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('validation_pairs', new.id, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
create trigger sync_validation_pairs_delete after delete on validation_pairs
when (select applying from sync_state) = 0
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('validation_pairs', old.id, 'delete', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
insert into sync_changes (tbl, pk, op, at, device) select 'validation_pairs', validation_pairs.id, 'upsert', created_at, (select device from sync_state) from validation_pairs;

-- settings
create trigger sync_settings_insert after insert on settings
when (select applying from sync_state) = 0 and new.key not in ('sensor_check', 'last_backup_at')
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('settings', new.key, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
create trigger sync_settings_update after update on settings
when (select applying from sync_state) = 0 and new.key not in ('sensor_check', 'last_backup_at')
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('settings', new.key, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
create trigger sync_settings_delete after delete on settings
when (select applying from sync_state) = 0 and old.key not in ('sensor_check', 'last_backup_at')
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('settings', old.key, 'delete', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
insert into sync_changes (tbl, pk, op, at, device) select 'settings', settings.key, 'upsert', '1970-01-01T00:00:00.000Z', (select device from sync_state) from settings where key not in ('sensor_check', 'last_backup_at');
