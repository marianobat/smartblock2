// agent.js — Capa de integración con Arduino Cloud Agent (Socket.IO v2.x)
// Requiere que en index.html esté cargado:
//   <script src="https://cdnjs.cloudflare.com/ajax/libs/socket.io/2.4.0/socket.io.js"></script>
//
// Características clave:
// - Descubre el endpoint del Agent local (prioriza 8991/8992, acepta ?agentHost=&agentPort=)
// - Maneja canales "command", "message", "notification"
// - Emite eventos internos tipo Node (on/off) para la UI
// - Interpreta lista de puertos tanto en "list" como en "Ports" (mayúscula)
// - API pública: connect, listPorts, openPort, closePort, sendLine, uploadHex (con advertencia)
//
// NOTA: Algunas builds corporativas ("Create/Stable") pueden ignorar "list" para orígenes externos
// y/o requerir "firma" para upload. El método uploadHex avisará si no está soportado.

(function () {
  // ──────────────────────────────────────────────
  // Pequeño EventEmitter
  // ──────────────────────────────────────────────
  const listeners = {};
  function on(evt, cb) {
    (listeners[evt] = listeners[evt] || []).push(cb);
  }
  function off(evt, cb) {
    const arr = listeners[evt];
    if (!arr) return;
    const i = arr.indexOf(cb);
    if (i >= 0) arr.splice(i, 1);
  }
  function emit(evt, payload) {
    (listeners[evt] || []).forEach((cb) => {
      try { cb(payload); } catch (e) { console.error("[ArduinoAgent listener error]", e); }
    });
  }

  // ──────────────────────────────────────────────
  // Estado interno
  // ──────────────────────────────────────────────
  let socket = null;
  let endpoint = null;
  let connected = false;

  // Info básica (puede llenarse desde /info si lo tienes en otro lado)
  const lastInfo = { version: "unknown" };

  // ──────────────────────────────────────────────
  // Utilidades de descubrimiento
  // ──────────────────────────────────────────────
  function getQueryParams() {
    try { return new URLSearchParams(location.search); } catch { return new URLSearchParams(); }
  }

  function getPreferredHost() {
    const q = getQueryParams();
    return q.get("agentHost") || "localhost";
  }

  function getPortRange() {
    const q = getQueryParams();
    const forced = q.get("agentPort");
    if (forced) return [Number(forced)];

    // Prioriza puertos observados en tu entorno
    const preferred = [8991, 8992];

    // Barrido de respaldo (por si cambia)
    const start = 8985, end = 9010;
    const sweep = [];
    for (let p = start; p <= end; p++) sweep.push(p);

    // Unifica sin duplicados
    const seen = new Set();
    return [...preferred, ...sweep].filter(p => !seen.has(p) && seen.add(p));
  }

  function buildCandidateEndpoints() {
    const host = getPreferredHost(); // normalmente "localhost"
    const ports = getPortRange();
    const list = [];

    // Intentamos primero WSS (localhost) y luego WS (127.0.0.1)
    for (const p of ports) {
      list.push(`wss://${host}:${p}`);          // e.g. wss://localhost:8991
      list.push(`ws://127.0.0.1:${p}`);        // e.g. ws://127.0.0.1:8992
    }
    return list;
  }

  // ──────────────────────────────────────────────
  // Conexión
  // ──────────────────────────────────────────────
  async function connect() {
    if (connected && socket && socket.connected) {
      return { endpoint, version: lastInfo.version };
    }

    const candidates = buildCandidateEndpoints();
    let lastErr = null;

    for (const ep of candidates) {
      try {
        await new Promise((resolve, reject) => {
          const s = io(ep, {
            transports: ["websocket"], // evita polling
            forceNew: true,
            reconnection: false,
            timeout: 2500,
          });

          let resolved = false;

          s.on("connect", () => {
            socket = s;
            endpoint = ep;
            connected = true;

            // Exponer el socket globalmente para otros módulos (serial-ui/app.js)
            try { window.__AGENT_SOCKET = s; } catch (_e) {}

            // Anunciar que el Agent está listo
            emit("agent:ready", { endpoint: ep });

            // Pedir lista de puertos apenas conecta (ambas variantes)
            try { s.emit("command", "list"); } catch {}
            try { s.emit("command", "serial list"); } catch {}

            // Listeners de canal "command"
            s.on("command", (msg) => {
              // Log de depuración útil
              // console.log("[AGENT command evt]", msg);

              // Serial data (D)
              if (msg && Object.prototype.hasOwnProperty.call(msg, "D")) {
                emit("serial:data", msg.D);
              }

              // Listas de puertos
              if (Array.isArray(msg?.Ports)) {        // ✅ build que usa "Ports"
                emit("ports:list", msg.Ports);
              }
              if (Array.isArray(msg?.list)) {         // clásico "list"
                emit("ports:list", msg.list);
              }

              emit("agent:message", msg);
            });

            // Algunas builds emiten por "message" / "notification"
            s.on("message", (msg) => {
              // console.log("[AGENT message evt]", msg);
              if (Array.isArray(msg?.Ports)) emit("ports:list", msg.Ports);
              if (Array.isArray(msg?.list))  emit("ports:list", msg.list);
              emit("agent:message", msg);
            });

            s.on("notification", (msg) => {
              // console.log("[AGENT notification evt]", msg);
              if (Array.isArray(msg?.Ports)) emit("ports:list", msg.Ports);
              if (Array.isArray(msg?.list))  emit("ports:list", msg.list);
              emit("agent:message", msg);
            });

            s.on("disconnect", () => {
              connected = false;
              try { window.__AGENT_SOCKET = null; } catch (_e) {}
              emit("agent:disconnect");
            });

            s.on("error", (e) => {
              emit("agent:error", e?.message || String(e));
            });

            // Anunciar conexión
            emit("agent:connect", { endpoint: ep, version: lastInfo.version });
            resolved = true;
            resolve();
          });

          s.on("connect_error", (e) => {
            if (!resolved) reject(e || new Error("connect_error"));
          });

          s.on("error", (e) => {
            if (!resolved) reject(e || new Error("socket error"));
          });
        });

        // Conectó bien
        return { endpoint, version: lastInfo.version };

      } catch (e) {
        lastErr = e;
        // Intentar siguiente endpoint
      }
    }

    // Si ninguno funcionó:
    connected = false;
    emit("agent:error", lastErr?.message || "No se pudo conectar al Agent local.");
    throw lastErr || new Error("No se pudo conectar al Agent local.");
  }

  // ──────────────────────────────────────────────
  // API: comandos
  // ──────────────────────────────────────────────
  function ensureConnected() {
    if (!socket || !socket.connected) throw new Error("Conéctate al Agent primero.");
  }

  function emitCommand(cmd) {
    ensureConnected();
    socket.emit("command", cmd);
  }

  // Exponemos este helper para la UI (lo usa serial-ui.js)
  function __emitCommand(cmd) {
    try { emitCommand(cmd); } catch (e) { emit("agent:error", e.message); throw e; }
  }

  function listPorts() {
    // Enviamos ambas variantes por si la build sólo entiende una
    try { emitCommand("list"); } catch {}
    try { emitCommand("serial list"); } catch {}
  }

  function openPort(port, baud = 115200, bufferAlgorithm = "default") {
    emitCommand(`open ${port} ${baud} ${bufferAlgorithm}`);
  }

  function closePort(port) {
    // si no se especifica puerto, muchos agents cierran el último abierto;
    // pero es más seguro recibir el valor actual de la UI
    emitCommand(`close ${port || ""}`.trim());
  }

  function sendLine(line, port) {
    // "send" envía y agrega \n; "sendraw" sin \n; acá usamos send
    if (!line || !line.toString) return;
    const cmd = port ? `send ${port} ${line}` : `send ${line}`;
    emitCommand(cmd);
  }

  // Subida de firmware .hex
  // Nota: Muchas builds "Stable" requieren firma y no permiten upload desde orígenes externos.
  // Devolvemos un error explícito y dejamos el gancho para builds "open" o tu propio bridge.
  async function uploadHex({ fqbn, port, base64, filename }) {
    // Si tu Agent "open" soporta un comando tipo:
    //   uploadhex <port> <fqbn> <filename> <base64>
    // podrías implementarlo acá. La build "Stable" normalmente lo rechaza.
    const msg = "Upload vía Agent no disponible en esta build (requiere firma). Usa el Agent 'open' o un bridge con arduino-cli.";
    emit("agent:error", msg);
    throw new Error(msg);
  }

  // ──────────────────────────────────────────────
  // Export público
  // ──────────────────────────────────────────────
  window.ArduinoAgent = {
    // eventos
    on, off,

    // conexión
    connect,

    // comandos de alto nivel
    listPorts,
    openPort,
    closePort,
    sendLine,

    // helpers/debug
    __emitCommand,

    // subida de firmware
    uploadHex,

    // estado/diagnóstico
    isConnected: () => !!(socket && socket.connected),
    getEndpoint: () => endpoint,
    getVersion: () => lastInfo.version,
  };
})();
