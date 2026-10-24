-- Facturas fuera de la app (24-10-2026): cada clínica factura con su propio programa (el suyo, el de la gestoría o el
-- de Hacienda) a partir de los cobros que exporta la app (src/data/toBill.ts). «invoice_ref»: el número que le dio
-- ese programa a la factura de este cobro, si la clínica lo apunta; vacío, sin facturar. Se sincroniza con el cobro.
alter table payments add column invoice_ref text not null default '';

drop trigger sync_payments_update;
create trigger sync_payments_update after update on payments
when (select applying from sync_state) = 0
  and (old.id is not new.id or old.patient_id is not new.patient_id or old.amount_cents is not new.amount_cents or old.method is not new.method or old.paid_on is not new.paid_on or old.concept is not new.concept or old.pack_id is not new.pack_id or old.created_at is not new.created_at or old.invoice_ref is not new.invoice_ref)
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('payments', new.id, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
