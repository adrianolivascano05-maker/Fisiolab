-- «Editado por» (src/data/editors.ts). Cada cambio ya lleva en sync_changes el dispositivo que lo hizo; aquí, de
-- quién es cada dispositivo de la clínica (su correo y su nombre). Se sincroniza: todos saben quién cambió qué.
create table devices (
  device     text primary key,
  email      text not null,
  name       text not null,
  updated_at text not null
);
create trigger sync_devices_insert after insert on devices
when (select applying from sync_state) = 0
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('devices', new.device, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
create trigger sync_devices_update after update on devices
when (select applying from sync_state) = 0
  and (old.device is not new.device or old.email is not new.email or old.name is not new.name)
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('devices', new.device, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
create trigger sync_devices_delete after delete on devices
when (select applying from sync_state) = 0
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('devices', old.device, 'delete', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;

-- Guardar sin cambiar nada (pulsar «Guardar» con lo mismo) ya no cuenta como cambio: los disparadores de modificación
-- solo apuntan el cambio si cambia alguna columna además de updated_at. OJO: una migración que añada columnas a una
-- de estas tablas tiene que volver a crear su disparador con la columna nueva (lo comprueba sync.test.ts).
drop trigger sync_anamnesis_update;
CREATE TRIGGER sync_anamnesis_update after update on anamnesis
when (select applying from sync_state) = 0
  and (old.patient_id is not new.patient_id or old.answers is not new.answers or old.created_at is not new.created_at)
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('anamnesis', new.patient_id, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;

drop trigger sync_appointments_update;
CREATE TRIGGER sync_appointments_update after update on appointments
when (select applying from sync_state) = 0
  and (old.id is not new.id or old.patient_id is not new.patient_id or old.starts_at is not new.starts_at or old.minutes is not new.minutes or old.status is not new.status or old.created_at is not new.created_at or old.created_by is not new.created_by or old.assigned_to is not new.assigned_to)
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('appointments', new.id, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;

drop trigger sync_consents_update;
CREATE TRIGGER sync_consents_update after update on consents
when (select applying from sync_state) = 0
  and (old.id is not new.id or old.patient_id is not new.patient_id or old.episode_id is not new.episode_id or old.template is not new.template or old.version is not new.version or old.title is not new.title or old.document is not new.document or old.method is not new.method or old.signed_at is not new.signed_at or old.signatures is not new.signatures or old.revoked_at is not new.revoked_at or old.revoke_note is not new.revoke_note or old.created_at is not new.created_at)
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('consents', new.id, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;

drop trigger sync_episodes_update;
CREATE TRIGGER sync_episodes_update after update on episodes
when (select applying from sync_state) = 0
  and (old.id is not new.id or old.patient_id is not new.patient_id or old.title is not new.title or old.started_at is not new.started_at or old.closed_at is not new.closed_at or old.answers is not new.answers or old.created_at is not new.created_at)
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('episodes', new.id, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;

drop trigger sync_findings_update;
CREATE TRIGGER sync_findings_update after update on findings
when (select applying from sync_state) = 0
  and (old.id is not new.id or old.patient_id is not new.patient_id or old.gallery_test is not new.gallery_test or old.test_name is not new.test_name or old.region is not new.region or old.performed_at is not new.performed_at or old.side is not new.side or old.result is not new.result or old.notes is not new.notes or old.created_at is not new.created_at or old.episode_id is not new.episode_id)
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('findings', new.id, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;

drop trigger sync_free_measurements_update;
CREATE TRIGGER sync_free_measurements_update after update on free_measurements
when (select applying from sync_state) = 0
  and (old.id is not new.id or old.patient_id is not new.patient_id or old.created_at is not new.created_at or old.data is not new.data)
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('free_measurements', new.id, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;

drop trigger sync_marks_update;
CREATE TRIGGER sync_marks_update after update on marks
when (select applying from sync_state) = 0
  and (old.id is not new.id or old.test_id is not new.test_id or old.event is not new.event or old.series_index is not new.series_index or old.time_s is not new.time_s or old.frame_index is not new.frame_index or old.created_at is not new.created_at)
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('marks', new.id, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;

drop trigger sync_patients_update;
CREATE TRIGGER sync_patients_update after update on patients
when (select applying from sync_state) = 0
  and (old.id is not new.id or old.name is not new.name or old.birth_date is not new.birth_date or old.sex is not new.sex or old.body_mass_kg is not new.body_mass_kg or old.height_cm is not new.height_cm or old.leg_length_cm is not new.leg_length_cm or old.pushoff_distance_cm is not new.pushoff_distance_cm or old.notes is not new.notes or old.created_at is not new.created_at or old.privacy is not new.privacy or old.phone is not new.phone or old.email is not new.email or old.address is not new.address)
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('patients', new.id, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;

drop trigger sync_profile_tests_update;
CREATE TRIGGER sync_profile_tests_update after update on profile_tests
when (select applying from sync_state) = 0
  and (old.profile_id is not new.profile_id or old.test_id is not new.test_id)
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('profile_tests', json_array(new.profile_id, new.test_id), 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;

drop trigger sync_profiles_update;
CREATE TRIGGER sync_profiles_update after update on profiles
when (select applying from sync_state) = 0
  and (old.id is not new.id or old.patient_id is not new.patient_id or old.kind is not new.kind or old.performed_at is not new.performed_at or old.exercise is not new.exercise or old.f0_n_kg is not new.f0_n_kg or old.v0_m_s is not new.v0_m_s or old.pmax_w_kg is not new.pmax_w_kg or old.slope is not new.slope or old.optimal_slope is not new.optimal_slope or old.imbalance_pct is not new.imbalance_pct or old.min_velocity_threshold_m_s is not new.min_velocity_threshold_m_s or old.one_rm_kg is not new.one_rm_kg or old.r_squared is not new.r_squared or old.created_at is not new.created_at)
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('profiles', new.id, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;

drop trigger sync_questionnaires_update;
CREATE TRIGGER sync_questionnaires_update after update on questionnaires
when (select applying from sync_state) = 0
  and (old.id is not new.id or old.patient_id is not new.patient_id or old.kind is not new.kind or old.performed_at is not new.performed_at or old.score is not new.score or old.details is not new.details or old.notes is not new.notes or old.created_at is not new.created_at or old.episode_id is not new.episode_id)
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('questionnaires', new.id, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;

drop trigger sync_results_update;
CREATE TRIGGER sync_results_update after update on results
when (select applying from sync_state) = 0
  and (old.id is not new.id or old.test_id is not new.test_id or old.metric is not new.metric or old.value is not new.value or old.unit is not new.unit or old.series_index is not new.series_index or old.formula_version is not new.formula_version or old.created_at is not new.created_at)
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('results', new.id, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;

drop trigger sync_sessions_update;
CREATE TRIGGER sync_sessions_update after update on sessions
when (select applying from sync_state) = 0
  and (old.id is not new.id or old.patient_id is not new.patient_id or old.performed_at is not new.performed_at or old.pain is not new.pain or old.subjective is not new.subjective or old.objective is not new.objective or old.treatment is not new.treatment or old.plan is not new.plan or old.review_on is not new.review_on or old.created_at is not new.created_at or old.next_at is not new.next_at or old.next_minutes is not new.next_minutes or old.episode_id is not new.episode_id)
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('sessions', new.id, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;

drop trigger sync_settings_update;
CREATE TRIGGER sync_settings_update after update on settings
when (select applying from sync_state) = 0
  and (old.key is not new.key or old.value is not new.value) and new.key not in ('sensor_check', 'last_backup_at')
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('settings', new.key, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;

drop trigger sync_shifts_update;
CREATE TRIGGER sync_shifts_update after update on shifts
when (select applying from sync_state) = 0
  and (old.id is not new.id or old.staff_email is not new.staff_email or old.starts_at is not new.starts_at or old.ends_at is not new.ends_at or old.note is not new.note or old.created_at is not new.created_at)
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('shifts', new.id, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;

drop trigger sync_staff_update;
CREATE TRIGGER sync_staff_update after update on staff
when (select applying from sync_state) = 0
  and (old.email is not new.email or old.name is not new.name or old.color is not new.color)
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('staff', new.email, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;

drop trigger sync_tests_update;
CREATE TRIGGER sync_tests_update after update on tests
when (select applying from sync_state) = 0
  and (old.id is not new.id or old.patient_id is not new.patient_id or old.category is not new.category or old.type is not new.type or old.side is not new.side or old.performed_at is not new.performed_at or old.extra_load_kg is not new.extra_load_kg or old.drop_height_cm is not new.drop_height_cm or old.details is not new.details or old.notes is not new.notes or old.created_at is not new.created_at or old.episode_id is not new.episode_id)
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('tests', new.id, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;

drop trigger sync_validation_pairs_update;
CREATE TRIGGER sync_validation_pairs_update after update on validation_pairs
when (select applying from sync_state) = 0
  and (old.id is not new.id or old.kind is not new.kind or old.comparison is not new.comparison or old.reference_label is not new.reference_label or old.impulso_value is not new.impulso_value or old.reference_value is not new.reference_value or old.patient_id is not new.patient_id or old.test_id is not new.test_id or old.notes is not new.notes or old.created_at is not new.created_at)
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('validation_pairs', new.id, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;

drop trigger sync_videos_update;
CREATE TRIGGER sync_videos_update after update on videos
when (select applying from sync_state) = 0
  and (old.id is not new.id or old.test_id is not new.test_id or old.file_name is not new.file_name or old.fps is not new.fps or old.container_fps is not new.container_fps or old.frame_count is not new.frame_count or old.duration_s is not new.duration_s or old.fps_source is not new.fps_source or old.stored is not new.stored or old.opfs_path is not new.opfs_path or old.created_at is not new.created_at)
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('videos', new.id, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;

drop trigger sync_wellness_update;
CREATE TRIGGER sync_wellness_update after update on wellness
when (select applying from sync_state) = 0
  and (old.id is not new.id or old.patient_id is not new.patient_id or old.performed_at is not new.performed_at or old.sleep is not new.sleep or old.fatigue is not new.fatigue or old.stress is not new.stress or old.soreness is not new.soreness or old.notes is not new.notes or old.created_at is not new.created_at or old.mood is not new.mood or old.pain is not new.pain)
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('wellness', new.id, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
