-- Facturas (src/data/invoices.ts): numeradas de forma correlativa dentro de cada serie (una por profesional o
-- dispositivo y año: «A2026», y las rectificativas aparte: «RA2026»). Una factura emitida no se cambia ni se borra:
-- si hay un error, se emite una rectificativa. Cada una guarda los datos del emisor y del destinatario tal como
-- estaban al emitirla, y una huella (SHA-256) encadenada con la anterior de su serie para notar si alguien la toca.
-- Sin referencia al paciente que borre o cambie la factura: si se borra el paciente, sus facturas se quedan.
-- Las cantidades, en céntimos. Se sincroniza.
create table invoices (
  id            text primary key,
  series        text not null,
  number        integer not null check (number >= 1),
  code          text not null,
  kind          text not null check (kind in ('completa', 'simplificada', 'rectificativa')),
  issued_on     text not null,
  operation_on  text,
  patient_id    text,
  payment_id    text,
  rectifies_id  text,
  issuer        text not null,
  recipient     text not null,
  lines         text not null,
  base_cents    integer not null,
  vat_rate      real not null default 0,
  vat_cents     integer not null default 0,
  irpf_rate     real not null default 0,
  irpf_cents    integer not null default 0,
  total_cents   integer not null,
  exemption     text not null default '',
  reason        text not null default '',
  prev_hash     text not null default '',
  hash          text not null,
  created_by    text not null default '',
  created_at    text not null,
  updated_at    text not null
);
create index invoices_series on invoices (series, number);
create index invoices_day on invoices (issued_on);
create index invoices_patient on invoices (patient_id);
create index invoices_payment on invoices (payment_id);

create trigger sync_invoices_insert after insert on invoices
when (select applying from sync_state) = 0
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('invoices', new.id, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
create trigger sync_invoices_update after update on invoices
when (select applying from sync_state) = 0
  and (old.id is not new.id or old.series is not new.series or old.number is not new.number or old.code is not new.code or old.kind is not new.kind
    or old.issued_on is not new.issued_on or old.operation_on is not new.operation_on or old.patient_id is not new.patient_id or old.payment_id is not new.payment_id
    or old.rectifies_id is not new.rectifies_id or old.issuer is not new.issuer or old.recipient is not new.recipient or old.lines is not new.lines
    or old.base_cents is not new.base_cents or old.vat_rate is not new.vat_rate or old.vat_cents is not new.vat_cents or old.irpf_rate is not new.irpf_rate
    or old.irpf_cents is not new.irpf_cents or old.total_cents is not new.total_cents or old.exemption is not new.exemption or old.reason is not new.reason
    or old.prev_hash is not new.prev_hash or old.hash is not new.hash or old.created_by is not new.created_by or old.created_at is not new.created_at)
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('invoices', new.id, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
create trigger sync_invoices_delete after delete on invoices
when (select applying from sync_state) = 0
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('invoices', old.id, 'delete', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
