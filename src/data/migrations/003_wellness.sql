-- Bienestar (fase 3). Cinco preguntas de 1 a 5, donde 5 es siempre lo mejor: fatiga (5 = muy fresco),
-- sueño, dolor muscular (soreness; 5 = ninguno), estrés (5 = nada) y ánimo, que faltaba.
-- Además, dolor de la lesión en escala visual analógica (0-10, opcional): no entra en el total.
alter table wellness add column mood integer check (mood is null or mood between 1 and 5);
alter table wellness add column pain integer check (pain is null or pain between 0 and 10);
