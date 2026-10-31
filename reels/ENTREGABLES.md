# Reel «Palpamos el nivel correcto la mitad de las veces» · entregables

**Pilar:** Mito vs. evidencia · **Público:** estudiantes y fisios clínicos · **Formato:** 1080×1920, 30 fps, H.264 CRF 18, AAC.

## Portada
Línea 1: **¿Seguro que es L4?**
Dato grande: **47 %**
Subtítulo: ACIERTOS DE VÉRTEBRA EXACTA
(Se renderiza con `npx remotion still Portada out/portada.png`.)

## Descripción del post
Cinco fisioterapeutas de terapia manual con experiencia palparon L1, L3 y L5 en 75 pacientes con lumbalgia. Marcador radiopaco en la piel y radiografía lateral para comprobarlo.

- **47 %** de los marcadores quedaron exactamente sobre la espinosa indicada.
- **72 %** quedaron exactos o, de forma consistente, a un nivel de distancia.
- IMC, edad y sexo no influyeron. **El mayor efecto fue el terapeuta** que palpaba (variabilidad entre terapeutas).

Lo que significa: la palpación te lleva a la zona, no a la vértebra. Mañana en consulta: habla de «zona lumbar baja» y busca el dolor que el paciente reconoce como suyo.

Aviso: estudio pequeño (5 terapeutas, 75 pacientes) y de 2007: tómalo como orientación, no como verdad absoluta.

Referencias:
1. Harlick JC, Milosavljevic S, Milburn PD. Palpation identification of spinous processes in the lumbar spine. Man Ther. 2007;12(1):56-62. doi:10.1016/j.math.2006.02.008
2. Custers P, Van de Kelft E, Eeckhaut B, et al. Clinical Examination, Diagnosis, and Conservative Treatment of Chronic Low Back Pain: A Narrative Review. Life (Basel). 2024;14(9):1090. doi:10.3390/life14091090

¿Tú lo dices en consulta? Comenta «L4».

#fisioterapia #lumbalgia #fisioterapeuta #terapiamanual #evidenciacientifica #estudiantesdefisio #dolorlumbar

## 3 ganchos alternativos (A/B)
1. «¿Seguro que eso que tocas es L4?»
2. «Este estudio debería enseñarse en primero de fisio.»
3. «Lo que más influye en acertar la vértebra no es el paciente. Eres tú.»

## Notas de rigor aplicadas
- No se dice que el estudio midiera L4 (midió L1, L3 y L5). «L4» aparece solo como ejemplo de lo que se dice en consulta.
- No se dice «como lanzar una moneda»: la moneda es solo imagen en el gancho (si prefieres quitarla, borra `<Coin>` en `src/scenes/Gancho.tsx`).
- Custers 2024 atribuye el 47 % a «Nolet et al.» por error; se cita el original (Harlick 2007).
- Fuente en pantalla durante los datos y al final.

---

# Propuesta de guion · Parte 2: el test de Kemp

**Pilar:** Mito vs. evidencia · **Público:** fisios clínicos · Datos solo de Custers et al., Life 2024 (apartado 3.2.5 «Prueba de Kemp» y «Resumen de especificidad y sensibilidad»; apartado 5.2 «Dolor facetario unilateral»).

| Escena | Voz | En pantalla |
|---|---|---|
| Gancho | «Extensión con rotación, dolor… y escribes "facetario". Ese test ni confirma ni descarta.» | «NI CONFIRMA NI DESCARTA» de golpe con temblor; silueta haciendo el Kemp |
| Prueba | «Lo dice una revisión de 2024 que juntó los datos de los estudios que lo midieron.» | Fogonazo; «REVISIÓN 2024» en cian; chip «revisión narrativa» |
| Hallazgo | «Sensibilidad: de 0,23… a 1. Especificidad: de 0,116… a 0,673.» | Dos barras que oscilan entre su mínimo y su máximo; contador que no se decide |
| Giro | «Con esa especificidad, el Kemp sale positivo en mucha gente sin dolor facetario. Y con esa sensibilidad, un negativo tampoco te deja tranquilo.» | Fila de siluetas: muchas se iluminan en rojo «positivo» sin facetas; ✗ sobre «negativo = descartado» |
| Matiz | «La revisión no dice que no sirva. Dice que es una pieza: dolor que aumenta con la extensión, que no suele pasar de la rodilla y exploración neurológica normal.» | Puzle de 4 piezas: Kemp + extensión + «no pasa de la rodilla» + «neuro normal» |
| Qué hacer | «Así que no escribas "facetario" solo por un Kemp. Anota los cuatro datos.» | Ficha clínica con «facetario» tachado → lista de 4 ✓ |
| CTA | «Comenta "Kemp" si lo usas a diario. Y en la parte 3: la sacroilíaca, donde un test no basta y necesitas tres.» | Botón «Comenta Kemp»; tarjeta «PARTE 3 →» |

Duración objetivo: 40–45 s. Limitación obligatoria en la descripción: revisión narrativa (no sistemática) que recoge datos de otros estudios; los rangos tan amplios reflejan estudios heterogéneos.
Sello final sugerido: «VALOR LIMITADO». Teaser verificado en el reel 6 de Custers (Telli 2008: tres o más pruebas de provocación positivas; FABERE el más sensible, 91,4 %).
