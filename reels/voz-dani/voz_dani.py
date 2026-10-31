#!/usr/bin/env python3
"""Voz en off fija: Gemini TTS, voz Achird, chico de ~27 años de Madrid, carismático pero relajado.
Uso:  python3 voz_dani.py "Texto a locutar" salida.wav
      python3 voz_dani.py -f guion.txt salida.wav
Requiere la variable de entorno GEMINI_API_KEY."""
import os, sys, json, base64, wave, time, urllib.request, urllib.error

MODEL = "gemini-3.8-flash-tts"
VOICE = "Achird"
STYLE = ("Lee el siguiente guion como un chico de unos 27 años de Madrid, con acento de España peninsular "
         "(castellano, pronunciando la z y la c como en España). Tono carismático pero relajado y natural, "
         "como si se lo contaras a un colega tomando algo: cercano, con una sonrisa ligera en la voz, "
         "sin sonar a locutor de anuncio, sin énfasis exagerados ni voz de vendedor. Ritmo tranquilo, "
         "con pequeñas pausas naturales.")

def prompt(text):
    # Las notas van separadas del TRANSCRIPT; si se mezclan, el modelo lee también las instrucciones.
    return f"""# AUDIO PROFILE: Dani
Chico de 27 años de Madrid. Español de España peninsular (distingue z/c de s, como en Madrid). Nada de acento latinoamericano.

## THE SCENE
Graba la voz en off de un reel para redes, en su casa, relajado.

### DIRECTOR'S NOTES
{STYLE}
No leas estas notas: lee solo el texto del TRANSCRIPT.

#### TRANSCRIPT
{text}
"""

def synth(text, out):
    body = {"contents": [{"parts": [{"text": prompt(text)}]}],
            "generationConfig": {"responseModalities": ["AUDIO"],
                "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": VOICE}}}}}
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent"
    for attempt in range(6):
        req = urllib.request.Request(url, data=json.dumps(body).encode(),
              headers={"Content-Type": "application/json", "x-goog-api-key": os.environ["GEMINI_API_KEY"]})
        try:
            r = json.load(urllib.request.urlopen(req, timeout=180)); break
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 503) and attempt < 5:
                time.sleep(20 * (attempt + 1)); continue  # capa gratuita: ~3 peticiones/min
            sys.exit(f"Error {e.code}: {e.read()[:300]!r}")
    part = r["candidates"][0]["content"]["parts"][0]["inlineData"]
    data = base64.b64decode(part["data"])
    if data[:4] == b"RIFF":          # gemini-3.8 ya devuelve WAV
        open(out, "wb").write(data)
    else:                            # modelos 2.5 devuelven PCM 16-bit 24 kHz
        with wave.open(out, "wb") as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(24000); w.writeframes(data)
    print("OK", out)

if __name__ == "__main__":
    a = sys.argv[1:]
    if len(a) == 3 and a[0] == "-f": text, out = open(a[1], encoding="utf-8").read(), a[2]
    elif len(a) == 2: text, out = a
    else: sys.exit(__doc__)
    synth(text, out)
