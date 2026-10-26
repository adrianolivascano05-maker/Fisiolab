-- Sincronización campo a campo (src/data/syncMerge.ts). Hasta ahora, si dos dispositivos cambiaban la misma fila (los
-- datos de un paciente, su anamnesis, una cita), ganaba el último cambio entero y se perdía lo del otro aunque fuera
-- otro dato. Ahora cada cambio apunta qué campos toca y cuándo; al juntar, gana el más reciente de cada campo. En la
-- anamnesis y en los motivos de consulta, cada respuesta cuenta como un campo («answers.motivo»).
--
-- sync_changes.born: cuándo nació la fila (su alta). Un campo que no está en sync_fields tiene esa hora. Las filas que
-- ya había, la de su último cambio: así, con lo que llega de dispositivos sin actualizar, se junta como antes.
alter table sync_changes add column born text;
update sync_changes set born = at;

-- El último cambio de cada campo de cada fila: hora y dispositivo. Solo los campos cambiados después del alta.
create table sync_fields (
  tbl    text not null,
  pk     text not null,
  field  text not null,
  at     text not null,
  device text not null,
  primary key (tbl, pk, field)
) without rowid;

-- Lo que este dispositivo había cambiado y otro ha cambiado a la vez con otro valor: se queda lo del otro, pero lo de
-- aquí se guarda para poder recuperarlo (Ajustes, «Cambios sustituidos»). Es de este dispositivo: no se sincroniza.
create table sync_conflicts (
  id        integer primary key,
  tbl       text not null,
  pk        text not null,
  field     text not null,
  mine      text,
  theirs    text,
  by_device text not null,
  mine_at   text not null,
  at        text not null
);
create index sync_conflicts_by_at on sync_conflicts (at);

-- Un alta (o volver a crear algo borrado) nace ahora y sin campos cambiados; un borrado se lleva sus campos.
create trigger sync_born_insert after insert on sync_changes
when (select applying from sync_state) = 0
begin
  update sync_changes set born = new.at where rowid = new.rowid;
end;
create trigger sync_born_update after update of op on sync_changes
when (select applying from sync_state) = 0 and old.op is not new.op
begin
  update sync_changes set born = new.at where rowid = new.rowid and new.op = 'upsert';
  delete from sync_fields where tbl = new.tbl and pk = new.pk;
end;

-- Qué campos cambia cada cambio, tabla a tabla (todas las columnas menos la clave y updated_at).
-- patients
create trigger sync_fields_patients after update on patients
when (select applying from sync_state) = 0
begin
  insert into sync_fields (tbl, pk, field, at, device)
    select 'patients', new.id, f, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state) from (
      select 'name' as f where old.name is not new.name
      union all select 'birth_date' where old.birth_date is not new.birth_date
      union all select 'sex' where old.sex is not new.sex
      union all select 'body_mass_kg' where old.body_mass_kg is not new.body_mass_kg
      union all select 'height_cm' where old.height_cm is not new.height_cm
      union all select 'leg_length_cm' where old.leg_length_cm is not new.leg_length_cm
      union all select 'pushoff_distance_cm' where old.pushoff_distance_cm is not new.pushoff_distance_cm
      union all select 'notes' where old.notes is not new.notes
      union all select 'created_at' where old.created_at is not new.created_at
      union all select 'privacy' where old.privacy is not new.privacy
      union all select 'phone' where old.phone is not new.phone
      union all select 'email' where old.email is not new.email
      union all select 'address' where old.address is not new.address
      union all select 'dni' where old.dni is not new.dni
    ) where true
    on conflict (tbl, pk, field) do update set at = excluded.at, device = excluded.device;
end;

-- free_measurements
create trigger sync_fields_free_measurements after update on free_measurements
when (select applying from sync_state) = 0
begin
  insert into sync_fields (tbl, pk, field, at, device)
    select 'free_measurements', new.id, f, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state) from (
      select 'patient_id' as f where old.patient_id is not new.patient_id
      union all select 'created_at' where old.created_at is not new.created_at
      union all select 'data' where old.data is not new.data
    ) where true
    on conflict (tbl, pk, field) do update set at = excluded.at, device = excluded.device;
end;

-- episodes
create trigger sync_fields_episodes after update on episodes
when (select applying from sync_state) = 0
begin
  insert into sync_fields (tbl, pk, field, at, device)
    select 'episodes', new.id, f, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state) from (
      select 'patient_id' as f where old.patient_id is not new.patient_id
      union all select 'title' where old.title is not new.title
      union all select 'started_at' where old.started_at is not new.started_at
      union all select 'closed_at' where old.closed_at is not new.closed_at
      union all select 'answers' where old.answers is not new.answers
      union all select 'created_at' where old.created_at is not new.created_at
      union all select 'answers.' || n.key from json_each(new.answers) n
        where json_type(old.answers) = 'object' and json_type(new.answers) = 'object'
          and not exists (select 1 from json_each(old.answers) o where o.key = n.key and o.type = n.type and o.value is n.value)
      union all select 'answers.' || o.key from json_each(old.answers) o
        where json_type(old.answers) = 'object' and json_type(new.answers) = 'object'
          and not exists (select 1 from json_each(new.answers) n where n.key = o.key)
    ) where true
    on conflict (tbl, pk, field) do update set at = excluded.at, device = excluded.device;
end;

-- tests
create trigger sync_fields_tests after update on tests
when (select applying from sync_state) = 0
begin
  insert into sync_fields (tbl, pk, field, at, device)
    select 'tests', new.id, f, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state) from (
      select 'patient_id' as f where old.patient_id is not new.patient_id
      union all select 'category' where old.category is not new.category
      union all select 'type' where old.type is not new.type
      union all select 'side' where old.side is not new.side
      union all select 'performed_at' where old.performed_at is not new.performed_at
      union all select 'extra_load_kg' where old.extra_load_kg is not new.extra_load_kg
      union all select 'drop_height_cm' where old.drop_height_cm is not new.drop_height_cm
      union all select 'details' where old.details is not new.details
      union all select 'notes' where old.notes is not new.notes
      union all select 'created_at' where old.created_at is not new.created_at
      union all select 'episode_id' where old.episode_id is not new.episode_id
    ) where true
    on conflict (tbl, pk, field) do update set at = excluded.at, device = excluded.device;
end;

-- profiles
create trigger sync_fields_profiles after update on profiles
when (select applying from sync_state) = 0
begin
  insert into sync_fields (tbl, pk, field, at, device)
    select 'profiles', new.id, f, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state) from (
      select 'patient_id' as f where old.patient_id is not new.patient_id
      union all select 'kind' where old.kind is not new.kind
      union all select 'performed_at' where old.performed_at is not new.performed_at
      union all select 'exercise' where old.exercise is not new.exercise
      union all select 'f0_n_kg' where old.f0_n_kg is not new.f0_n_kg
      union all select 'v0_m_s' where old.v0_m_s is not new.v0_m_s
      union all select 'pmax_w_kg' where old.pmax_w_kg is not new.pmax_w_kg
      union all select 'slope' where old.slope is not new.slope
      union all select 'optimal_slope' where old.optimal_slope is not new.optimal_slope
      union all select 'imbalance_pct' where old.imbalance_pct is not new.imbalance_pct
      union all select 'min_velocity_threshold_m_s' where old.min_velocity_threshold_m_s is not new.min_velocity_threshold_m_s
      union all select 'one_rm_kg' where old.one_rm_kg is not new.one_rm_kg
      union all select 'r_squared' where old.r_squared is not new.r_squared
      union all select 'created_at' where old.created_at is not new.created_at
    ) where true
    on conflict (tbl, pk, field) do update set at = excluded.at, device = excluded.device;
end;

-- results
create trigger sync_fields_results after update on results
when (select applying from sync_state) = 0
begin
  insert into sync_fields (tbl, pk, field, at, device)
    select 'results', new.id, f, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state) from (
      select 'test_id' as f where old.test_id is not new.test_id
      union all select 'metric' where old.metric is not new.metric
      union all select 'value' where old.value is not new.value
      union all select 'unit' where old.unit is not new.unit
      union all select 'series_index' where old.series_index is not new.series_index
      union all select 'formula_version' where old.formula_version is not new.formula_version
      union all select 'created_at' where old.created_at is not new.created_at
    ) where true
    on conflict (tbl, pk, field) do update set at = excluded.at, device = excluded.device;
end;

-- marks
create trigger sync_fields_marks after update on marks
when (select applying from sync_state) = 0
begin
  insert into sync_fields (tbl, pk, field, at, device)
    select 'marks', new.id, f, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state) from (
      select 'test_id' as f where old.test_id is not new.test_id
      union all select 'event' where old.event is not new.event
      union all select 'series_index' where old.series_index is not new.series_index
      union all select 'time_s' where old.time_s is not new.time_s
      union all select 'frame_index' where old.frame_index is not new.frame_index
      union all select 'created_at' where old.created_at is not new.created_at
    ) where true
    on conflict (tbl, pk, field) do update set at = excluded.at, device = excluded.device;
end;

-- videos
create trigger sync_fields_videos after update on videos
when (select applying from sync_state) = 0
begin
  insert into sync_fields (tbl, pk, field, at, device)
    select 'videos', new.id, f, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state) from (
      select 'test_id' as f where old.test_id is not new.test_id
      union all select 'file_name' where old.file_name is not new.file_name
      union all select 'fps' where old.fps is not new.fps
      union all select 'container_fps' where old.container_fps is not new.container_fps
      union all select 'frame_count' where old.frame_count is not new.frame_count
      union all select 'duration_s' where old.duration_s is not new.duration_s
      union all select 'fps_source' where old.fps_source is not new.fps_source
      union all select 'stored' where old.stored is not new.stored
      union all select 'opfs_path' where old.opfs_path is not new.opfs_path
      union all select 'created_at' where old.created_at is not new.created_at
    ) where true
    on conflict (tbl, pk, field) do update set at = excluded.at, device = excluded.device;
end;

-- wellness
create trigger sync_fields_wellness after update on wellness
when (select applying from sync_state) = 0
begin
  insert into sync_fields (tbl, pk, field, at, device)
    select 'wellness', new.id, f, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state) from (
      select 'patient_id' as f where old.patient_id is not new.patient_id
      union all select 'performed_at' where old.performed_at is not new.performed_at
      union all select 'sleep' where old.sleep is not new.sleep
      union all select 'fatigue' where old.fatigue is not new.fatigue
      union all select 'stress' where old.stress is not new.stress
      union all select 'soreness' where old.soreness is not new.soreness
      union all select 'notes' where old.notes is not new.notes
      union all select 'created_at' where old.created_at is not new.created_at
      union all select 'mood' where old.mood is not new.mood
      union all select 'pain' where old.pain is not new.pain
    ) where true
    on conflict (tbl, pk, field) do update set at = excluded.at, device = excluded.device;
end;

-- anamnesis
create trigger sync_fields_anamnesis after update on anamnesis
when (select applying from sync_state) = 0
begin
  insert into sync_fields (tbl, pk, field, at, device)
    select 'anamnesis', new.patient_id, f, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state) from (
      select 'answers' as f where old.answers is not new.answers
      union all select 'created_at' where old.created_at is not new.created_at
      union all select 'answers.' || n.key from json_each(new.answers) n
        where json_type(old.answers) = 'object' and json_type(new.answers) = 'object'
          and not exists (select 1 from json_each(old.answers) o where o.key = n.key and o.type = n.type and o.value is n.value)
      union all select 'answers.' || o.key from json_each(old.answers) o
        where json_type(old.answers) = 'object' and json_type(new.answers) = 'object'
          and not exists (select 1 from json_each(new.answers) n where n.key = o.key)
    ) where true
    on conflict (tbl, pk, field) do update set at = excluded.at, device = excluded.device;
end;

-- findings
create trigger sync_fields_findings after update on findings
when (select applying from sync_state) = 0
begin
  insert into sync_fields (tbl, pk, field, at, device)
    select 'findings', new.id, f, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state) from (
      select 'patient_id' as f where old.patient_id is not new.patient_id
      union all select 'gallery_test' where old.gallery_test is not new.gallery_test
      union all select 'test_name' where old.test_name is not new.test_name
      union all select 'region' where old.region is not new.region
      union all select 'performed_at' where old.performed_at is not new.performed_at
      union all select 'side' where old.side is not new.side
      union all select 'result' where old.result is not new.result
      union all select 'notes' where old.notes is not new.notes
      union all select 'created_at' where old.created_at is not new.created_at
      union all select 'episode_id' where old.episode_id is not new.episode_id
    ) where true
    on conflict (tbl, pk, field) do update set at = excluded.at, device = excluded.device;
end;

-- sessions
create trigger sync_fields_sessions after update on sessions
when (select applying from sync_state) = 0
begin
  insert into sync_fields (tbl, pk, field, at, device)
    select 'sessions', new.id, f, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state) from (
      select 'patient_id' as f where old.patient_id is not new.patient_id
      union all select 'performed_at' where old.performed_at is not new.performed_at
      union all select 'pain' where old.pain is not new.pain
      union all select 'subjective' where old.subjective is not new.subjective
      union all select 'objective' where old.objective is not new.objective
      union all select 'treatment' where old.treatment is not new.treatment
      union all select 'plan' where old.plan is not new.plan
      union all select 'review_on' where old.review_on is not new.review_on
      union all select 'created_at' where old.created_at is not new.created_at
      union all select 'next_at' where old.next_at is not new.next_at
      union all select 'next_minutes' where old.next_minutes is not new.next_minutes
      union all select 'episode_id' where old.episode_id is not new.episode_id
    ) where true
    on conflict (tbl, pk, field) do update set at = excluded.at, device = excluded.device;
end;

-- appointments
create trigger sync_fields_appointments after update on appointments
when (select applying from sync_state) = 0
begin
  insert into sync_fields (tbl, pk, field, at, device)
    select 'appointments', new.id, f, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state) from (
      select 'patient_id' as f where old.patient_id is not new.patient_id
      union all select 'starts_at' where old.starts_at is not new.starts_at
      union all select 'minutes' where old.minutes is not new.minutes
      union all select 'status' where old.status is not new.status
      union all select 'created_at' where old.created_at is not new.created_at
      union all select 'created_by' where old.created_by is not new.created_by
      union all select 'assigned_to' where old.assigned_to is not new.assigned_to
      union all select 'reminded_at' where old.reminded_at is not new.reminded_at
      union all select 'confirmed_at' where old.confirmed_at is not new.confirmed_at
      union all select 'source' where old.source is not new.source
      union all select 'cancel_token' where old.cancel_token is not new.cancel_token
    ) where true
    on conflict (tbl, pk, field) do update set at = excluded.at, device = excluded.device;
end;

-- staff
create trigger sync_fields_staff after update on staff
when (select applying from sync_state) = 0
begin
  insert into sync_fields (tbl, pk, field, at, device)
    select 'staff', new.email, f, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state) from (
      select 'name' as f where old.name is not new.name
      union all select 'color' where old.color is not new.color
    ) where true
    on conflict (tbl, pk, field) do update set at = excluded.at, device = excluded.device;
end;

-- shifts
create trigger sync_fields_shifts after update on shifts
when (select applying from sync_state) = 0
begin
  insert into sync_fields (tbl, pk, field, at, device)
    select 'shifts', new.id, f, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state) from (
      select 'staff_email' as f where old.staff_email is not new.staff_email
      union all select 'starts_at' where old.starts_at is not new.starts_at
      union all select 'ends_at' where old.ends_at is not new.ends_at
      union all select 'note' where old.note is not new.note
      union all select 'created_at' where old.created_at is not new.created_at
    ) where true
    on conflict (tbl, pk, field) do update set at = excluded.at, device = excluded.device;
end;

-- closures
create trigger sync_fields_closures after update on closures
when (select applying from sync_state) = 0
begin
  insert into sync_fields (tbl, pk, field, at, device)
    select 'closures', new.id, f, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state) from (
      select 'staff_email' as f where old.staff_email is not new.staff_email
      union all select 'starts_at' where old.starts_at is not new.starts_at
      union all select 'ends_at' where old.ends_at is not new.ends_at
      union all select 'note' where old.note is not new.note
      union all select 'created_by' where old.created_by is not new.created_by
      union all select 'created_at' where old.created_at is not new.created_at
    ) where true
    on conflict (tbl, pk, field) do update set at = excluded.at, device = excluded.device;
end;

-- questionnaires
create trigger sync_fields_questionnaires after update on questionnaires
when (select applying from sync_state) = 0
begin
  insert into sync_fields (tbl, pk, field, at, device)
    select 'questionnaires', new.id, f, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state) from (
      select 'patient_id' as f where old.patient_id is not new.patient_id
      union all select 'kind' where old.kind is not new.kind
      union all select 'performed_at' where old.performed_at is not new.performed_at
      union all select 'score' where old.score is not new.score
      union all select 'details' where old.details is not new.details
      union all select 'notes' where old.notes is not new.notes
      union all select 'created_at' where old.created_at is not new.created_at
      union all select 'episode_id' where old.episode_id is not new.episode_id
    ) where true
    on conflict (tbl, pk, field) do update set at = excluded.at, device = excluded.device;
end;

-- consents
create trigger sync_fields_consents after update on consents
when (select applying from sync_state) = 0
begin
  insert into sync_fields (tbl, pk, field, at, device)
    select 'consents', new.id, f, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state) from (
      select 'patient_id' as f where old.patient_id is not new.patient_id
      union all select 'episode_id' where old.episode_id is not new.episode_id
      union all select 'template' where old.template is not new.template
      union all select 'version' where old.version is not new.version
      union all select 'title' where old.title is not new.title
      union all select 'document' where old.document is not new.document
      union all select 'method' where old.method is not new.method
      union all select 'signed_at' where old.signed_at is not new.signed_at
      union all select 'signatures' where old.signatures is not new.signatures
      union all select 'revoked_at' where old.revoked_at is not new.revoked_at
      union all select 'revoke_note' where old.revoke_note is not new.revoke_note
      union all select 'created_at' where old.created_at is not new.created_at
    ) where true
    on conflict (tbl, pk, field) do update set at = excluded.at, device = excluded.device;
end;

-- packs
create trigger sync_fields_packs after update on packs
when (select applying from sync_state) = 0
begin
  insert into sync_fields (tbl, pk, field, at, device)
    select 'packs', new.id, f, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state) from (
      select 'patient_id' as f where old.patient_id is not new.patient_id
      union all select 'title' where old.title is not new.title
      union all select 'sessions' where old.sessions is not new.sessions
      union all select 'price_cents' where old.price_cents is not new.price_cents
      union all select 'bought_on' where old.bought_on is not new.bought_on
      union all select 'expires_on' where old.expires_on is not new.expires_on
      union all select 'note' where old.note is not new.note
      union all select 'created_at' where old.created_at is not new.created_at
    ) where true
    on conflict (tbl, pk, field) do update set at = excluded.at, device = excluded.device;
end;

-- payments
create trigger sync_fields_payments after update on payments
when (select applying from sync_state) = 0
begin
  insert into sync_fields (tbl, pk, field, at, device)
    select 'payments', new.id, f, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state) from (
      select 'patient_id' as f where old.patient_id is not new.patient_id
      union all select 'amount_cents' where old.amount_cents is not new.amount_cents
      union all select 'method' where old.method is not new.method
      union all select 'paid_on' where old.paid_on is not new.paid_on
      union all select 'concept' where old.concept is not new.concept
      union all select 'pack_id' where old.pack_id is not new.pack_id
      union all select 'created_at' where old.created_at is not new.created_at
      union all select 'invoice_ref' where old.invoice_ref is not new.invoice_ref
    ) where true
    on conflict (tbl, pk, field) do update set at = excluded.at, device = excluded.device;
end;

-- invoices
create trigger sync_fields_invoices after update on invoices
when (select applying from sync_state) = 0
begin
  insert into sync_fields (tbl, pk, field, at, device)
    select 'invoices', new.id, f, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state) from (
      select 'series' as f where old.series is not new.series
      union all select 'number' where old.number is not new.number
      union all select 'code' where old.code is not new.code
      union all select 'kind' where old.kind is not new.kind
      union all select 'issued_on' where old.issued_on is not new.issued_on
      union all select 'operation_on' where old.operation_on is not new.operation_on
      union all select 'patient_id' where old.patient_id is not new.patient_id
      union all select 'payment_id' where old.payment_id is not new.payment_id
      union all select 'rectifies_id' where old.rectifies_id is not new.rectifies_id
      union all select 'issuer' where old.issuer is not new.issuer
      union all select 'recipient' where old.recipient is not new.recipient
      union all select 'lines' where old.lines is not new.lines
      union all select 'base_cents' where old.base_cents is not new.base_cents
      union all select 'vat_rate' where old.vat_rate is not new.vat_rate
      union all select 'vat_cents' where old.vat_cents is not new.vat_cents
      union all select 'irpf_rate' where old.irpf_rate is not new.irpf_rate
      union all select 'irpf_cents' where old.irpf_cents is not new.irpf_cents
      union all select 'total_cents' where old.total_cents is not new.total_cents
      union all select 'exemption' where old.exemption is not new.exemption
      union all select 'reason' where old.reason is not new.reason
      union all select 'prev_hash' where old.prev_hash is not new.prev_hash
      union all select 'hash' where old.hash is not new.hash
      union all select 'created_by' where old.created_by is not new.created_by
      union all select 'created_at' where old.created_at is not new.created_at
    ) where true
    on conflict (tbl, pk, field) do update set at = excluded.at, device = excluded.device;
end;

-- waitlist
create trigger sync_fields_waitlist after update on waitlist
when (select applying from sync_state) = 0
begin
  insert into sync_fields (tbl, pk, field, at, device)
    select 'waitlist', new.id, f, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state) from (
      select 'patient_id' as f where old.patient_id is not new.patient_id
      union all select 'note' where old.note is not new.note
      union all select 'assigned_to' where old.assigned_to is not new.assigned_to
      union all select 'created_at' where old.created_at is not new.created_at
      union all select 'prefer_time' where old.prefer_time is not new.prefer_time
      union all select 'prefer_days' where old.prefer_days is not new.prefer_days
      union all select 'offered_at' where old.offered_at is not new.offered_at
      union all select 'priority' where old.priority is not new.priority
      union all select 'available_from' where old.available_from is not new.available_from
      union all select 'from_min' where old.from_min is not new.from_min
      union all select 'to_min' where old.to_min is not new.to_min
    ) where true
    on conflict (tbl, pk, field) do update set at = excluded.at, device = excluded.device;
end;

-- exercises
create trigger sync_fields_exercises after update on exercises
when (select applying from sync_state) = 0
begin
  insert into sync_fields (tbl, pk, field, at, device)
    select 'exercises', new.id, f, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state) from (
      select 'title' as f where old.title is not new.title
      union all select 'region' where old.region is not new.region
      union all select 'dose' where old.dose is not new.dose
      union all select 'instructions' where old.instructions is not new.instructions
      union all select 'created_at' where old.created_at is not new.created_at
      union all select 'video' where old.video is not new.video
    ) where true
    on conflict (tbl, pk, field) do update set at = excluded.at, device = excluded.device;
end;

-- exercise_plans
create trigger sync_fields_exercise_plans after update on exercise_plans
when (select applying from sync_state) = 0
begin
  insert into sync_fields (tbl, pk, field, at, device)
    select 'exercise_plans', new.id, f, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state) from (
      select 'patient_id' as f where old.patient_id is not new.patient_id
      union all select 'items' where old.items is not new.items
      union all select 'note' where old.note is not new.note
      union all select 'created_at' where old.created_at is not new.created_at
    ) where true
    on conflict (tbl, pk, field) do update set at = excluded.at, device = excluded.device;
end;

-- patient_forms
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
    ) where true
    on conflict (tbl, pk, field) do update set at = excluded.at, device = excluded.device;
end;

-- documents
create trigger sync_fields_documents after update on documents
when (select applying from sync_state) = 0
begin
  insert into sync_fields (tbl, pk, field, at, device)
    select 'documents', new.id, f, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state) from (
      select 'patient_id' as f where old.patient_id is not new.patient_id
      union all select 'episode_id' where old.episode_id is not new.episode_id
      union all select 'name' where old.name is not new.name
      union all select 'mime' where old.mime is not new.mime
      union all select 'size' where old.size is not new.size
      union all select 'doc_key' where old.doc_key is not new.doc_key
      union all select 'source' where old.source is not new.source
      union all select 'form_id' where old.form_id is not new.form_id
      union all select 'created_at' where old.created_at is not new.created_at
      union all select 'uploaded_at' where old.uploaded_at is not new.uploaded_at
    ) where true
    on conflict (tbl, pk, field) do update set at = excluded.at, device = excluded.device;
end;

-- outbox
create trigger sync_fields_outbox after update on outbox
when (select applying from sync_state) = 0
begin
  insert into sync_fields (tbl, pk, field, at, device)
    select 'outbox', new.id, f, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state) from (
      select 'patient_id' as f where old.patient_id is not new.patient_id
      union all select 'rule' where old.rule is not new.rule
      union all select 'status' where old.status is not new.status
      union all select 'at' where old.at is not new.at
      union all select 'by' where old.by is not new.by
    ) where true
    on conflict (tbl, pk, field) do update set at = excluded.at, device = excluded.device;
end;

-- validation_pairs
create trigger sync_fields_validation_pairs after update on validation_pairs
when (select applying from sync_state) = 0
begin
  insert into sync_fields (tbl, pk, field, at, device)
    select 'validation_pairs', new.id, f, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state) from (
      select 'kind' as f where old.kind is not new.kind
      union all select 'comparison' where old.comparison is not new.comparison
      union all select 'reference_label' where old.reference_label is not new.reference_label
      union all select 'impulso_value' where old.impulso_value is not new.impulso_value
      union all select 'reference_value' where old.reference_value is not new.reference_value
      union all select 'patient_id' where old.patient_id is not new.patient_id
      union all select 'test_id' where old.test_id is not new.test_id
      union all select 'notes' where old.notes is not new.notes
      union all select 'created_at' where old.created_at is not new.created_at
    ) where true
    on conflict (tbl, pk, field) do update set at = excluded.at, device = excluded.device;
end;

-- settings
create trigger sync_fields_settings after update on settings
when (select applying from sync_state) = 0
begin
  insert into sync_fields (tbl, pk, field, at, device)
    select 'settings', new.key, f, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state) from (
      select 'value' as f where old.value is not new.value
    ) where true
    on conflict (tbl, pk, field) do update set at = excluded.at, device = excluded.device;
end;

-- devices
create trigger sync_fields_devices after update on devices
when (select applying from sync_state) = 0
begin
  insert into sync_fields (tbl, pk, field, at, device)
    select 'devices', new.device, f, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state) from (
      select 'email' as f where old.email is not new.email
      union all select 'name' where old.name is not new.name
    ) where true
    on conflict (tbl, pk, field) do update set at = excluded.at, device = excluded.device;
end;
