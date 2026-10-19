-- Protección de datos de cada paciente (src/privacy/README.md): cuándo se le entregó la información del RGPD,
-- quién firmó (el representante legal, si es menor) y qué consentimientos opcionales dio. En JSON, como la
-- anamnesis, para poder añadir consentimientos sin otra migración.
alter table patients add column privacy text not null default '{}' check (json_valid(privacy));
