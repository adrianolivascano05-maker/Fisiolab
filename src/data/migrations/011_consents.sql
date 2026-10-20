-- Consentimientos informados firmados (src/consent/README.md). Se guarda el documento entero tal como se firmó
-- (aunque la plantilla cambie después), cómo se firmó (en la pantalla o en papel), las firmas dibujadas y, si se
-- retira, cuándo y por qué. Van al motivo de consulta que se está viendo, como el resto (migración 010).
create table consents (
  id          text primary key,
  patient_id  text not null references patients (id) on delete cascade,
  episode_id  text,
  template    text not null,
  version     text not null,
  title       text not null,
  document    text not null check (json_valid(document)),
  method      text not null check (method in ('screen', 'paper')),
  signed_at   text not null,
  -- { patient?, professional?, revocation? }: imágenes PNG (data URL) de las firmas hechas en la pantalla.
  signatures  text not null default '{}' check (json_valid(signatures)),
  revoked_at  text,
  revoke_note text not null default '',
  created_at  text not null,
  updated_at  text not null
);
create index consents_patient on consents (patient_id, signed_at);

create trigger episode_consents after insert on consents
when new.episode_id is null and (select applying from sync_state) = 0
  and exists (select 1 from episodes where patient_id = new.patient_id)
begin
  update consents set episode_id = coalesce(
    (select episode_id from episode_focus where patient_id = new.patient_id and episode_id <> 'all'),
    (select id from episodes where patient_id = new.patient_id and closed_at is null order by started_at desc, created_at desc limit 1)
  ) where id = new.id;
end;

create trigger sync_consents_insert after insert on consents
when (select applying from sync_state) = 0
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('consents', new.id, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
create trigger sync_consents_update after update on consents
when (select applying from sync_state) = 0
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('consents', new.id, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
create trigger sync_consents_delete after delete on consents
when (select applying from sync_state) = 0
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('consents', old.id, 'delete', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
