# Voz en off por defecto

Siempre que haga falta locución o voz en off, usa **mi voz fija ("Dani")**, salvo que diga otra cosa:

- Gemini TTS, modelo `gemini-3.8-flash-tts`, voz prebuilt **`Achird`**.
- Chico de 25–30 años de Madrid, acento de España peninsular (distingue z/s), carismático pero relajado, sin sonar a anuncio.
- Genera con `voz-dani/voz_dani.py` (`python3 voz_dani.py "texto" salida.wav`). No cambies el prompt de estilo ni la voz.
- Referencia de cómo debe sonar: `voz-dani/referencia_achird.wav`.
- Las notas de estilo van separadas del texto (sección TRANSCRIPT); si se mezclan, el modelo las lee en voz alta.
- Necesita `GEMINI_API_KEY`. Capa gratuita: ~3 peticiones/min.
