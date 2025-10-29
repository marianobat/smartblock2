# SmartBlock Web — Starter (Vercel-ready)

Frontend 100% web con **Blockly** para generar `.ino` y (opcional) controlar una placa por **WebSerial**. Ideal para publicar en **Vercel**.

## Requisitos (MacBook Air)
- **Google Chrome** (o Microsoft Edge) actualizado — WebSerial solo en Chromium.
- (Opcional) Para modo en vivo: flashear un **firmware** en Arduino (ver `firmware/arduino_firmware.ino`).
- (Opcional) Arduino IDE o `arduino-cli` para flashear el firmware.

## Correr local (testing)
```bash
# En la carpeta del proyecto
python3 -m http.server 5173
# o
npx http-server -p 5173
```
Abrí en Chrome: `http://localhost:5173` (no funciona en `file://`).

## Deploy en Vercel (estático)
1. Sube esta carpeta a un repo de **GitHub**.
2. En **vercel.com** → New Project → Import.
3. Framework: **Other** (Static Site). Build command: *(vacío)*. Output directory: **/**.
4. Deploy y listo.

## Firmware (WebSerial)
- Protocolo 115200 baudios:
  - `W <pin> <H|L>` → `digitalWrite(pin, HIGH|LOW)`
  - `R <A0|A1|...>` → responde `A <pin> <valor>`
- Archivo: `firmware/arduino_firmware.ino`

## Roadmap
- Más bloques (PWM, Servo, tono, I2C).
- Export `.zip` con lib propia.
- Integrar **esptool.js** para ESP32 (flasheo desde navegador).
- Agente local (cuando quieras compilar/subir AVR desde web).
