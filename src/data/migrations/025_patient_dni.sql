-- El DNI o NIE del paciente, en su ficha: sale solo en los justificantes de pago y de asistencia y en los
-- consentimientos (antes se escribía cada vez y no se guardaba; al importar iba a las notas).
alter table patients add column dni text not null default '';

drop trigger sync_patients_update;
CREATE TRIGGER sync_patients_update after update on patients
when (select applying from sync_state) = 0
  and (old.id is not new.id or old.name is not new.name or old.birth_date is not new.birth_date or old.sex is not new.sex or old.body_mass_kg is not new.body_mass_kg or old.height_cm is not new.height_cm or old.leg_length_cm is not new.leg_length_cm or old.pushoff_distance_cm is not new.pushoff_distance_cm or old.notes is not new.notes or old.created_at is not new.created_at or old.privacy is not new.privacy or old.phone is not new.phone or old.email is not new.email or old.address is not new.address or old.dni is not new.dni)
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('patients', new.id, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
