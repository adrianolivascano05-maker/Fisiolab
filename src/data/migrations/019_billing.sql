-- Bonos y cobros (src/data/billing.ts). Un bono son sesiones pagadas por adelantado; un cobro, dinero recibido de un
-- paciente (con su forma de pago). Las cantidades, en céntimos. No son facturas. Se sincronizan como el resto.
create table packs (
  id          text primary key,
  patient_id  text not null references patients (id) on delete cascade,
  title       text not null,
  sessions    integer not null check (sessions between 1 and 200),
  price_cents integer check (price_cents is null or price_cents >= 0),
  bought_on   text not null,
  expires_on  text,
  note        text not null default '',
  created_at  text not null,
  updated_at  text not null
);
create index packs_patient on packs (patient_id, bought_on);

create table payments (
  id           text primary key,
  patient_id   text not null references patients (id) on delete cascade,
  amount_cents integer not null check (amount_cents > 0),
  method       text not null check (method in ('efectivo', 'tarjeta', 'bizum', 'transferencia', 'otro')),
  paid_on      text not null,
  concept      text not null default '',
  pack_id      text,
  created_at   text not null,
  updated_at   text not null
);
create index payments_patient on payments (patient_id, paid_on);
create index payments_day on payments (paid_on);

create trigger sync_packs_insert after insert on packs
when (select applying from sync_state) = 0
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('packs', new.id, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
create trigger sync_packs_update after update on packs
when (select applying from sync_state) = 0
  and (old.id is not new.id or old.patient_id is not new.patient_id or old.title is not new.title or old.sessions is not new.sessions or old.price_cents is not new.price_cents or old.bought_on is not new.bought_on or old.expires_on is not new.expires_on or old.note is not new.note or old.created_at is not new.created_at)
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('packs', new.id, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
create trigger sync_packs_delete after delete on packs
when (select applying from sync_state) = 0
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('packs', old.id, 'delete', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
create trigger sync_payments_insert after insert on payments
when (select applying from sync_state) = 0
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('payments', new.id, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
create trigger sync_payments_update after update on payments
when (select applying from sync_state) = 0
  and (old.id is not new.id or old.patient_id is not new.patient_id or old.amount_cents is not new.amount_cents or old.method is not new.method or old.paid_on is not new.paid_on or old.concept is not new.concept or old.pack_id is not new.pack_id or old.created_at is not new.created_at)
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('payments', new.id, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
create trigger sync_payments_delete after delete on payments
when (select applying from sync_state) = 0
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('payments', old.id, 'delete', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
