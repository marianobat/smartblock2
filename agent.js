// agent.js — integración con Arduino Cloud Agent (v1.7+ compatible con socket.io v2.x)
// Desarrollado para SmartBlock / SmartTEAM

window.ArduinoAgent = (function () {
  let socket = null;
  let selectedPort = null;
  let lastInfo = null;

  // ──────────────────────────────────────────────
  // Helpers de descubrimiento
  // ──────────────────────────────────────────────
  function getAgentHost() {
    const q = new URLSearchParams(location.search);
    const forced = q.get("agentHost");
    if (forced) return forced;
    // En sitios HTTPS, el certificado local suele ser para "localhost"
    return (location.protocol === "https:") ? "localhost" : "127.0.0.1";
  }

  function getPortRange() {
  const q = new URLSearchParams(location.search);
  const forced = q.get("agentPort");
  if (forced) return [Number(forced)];

  // Prioriza los puertos que tu /info mostró
  const preferred = [8991, 8992];

  // Mantén el barrido original como respaldo
  const start = 8985, end = 9010;
  const sweep = [];
  for (let p = start; p <= end; p++) sweep.push(p);

  // Quita duplicados y devuelve
  const seen = new Set();
  return [...preferred, ...sweep].filter(p => !seen.has(p) && seen.add(p));
}
  
  async function findAgent() {
    const host = getAgentHost();
    const ports = getPortRange();

    async function tryInfo(proto, port) {
      const url = `${proto}://${host}:${port}/info`;
      try {
        const r = await fetch(url, { method: "GET" });
        if (!r.ok) return null;
        return await r.json(); // { http, https, ws, wss, version, ... }
      } catch {
        return null;
      }
    }

    if (location.protocol === "https:") {
      for (const p of ports) {
        const info = await tryInfo("https", p);
        if (info && (info.wss || info.ws)) return info;
      }
      return null; // no podemos usar http desde https
    } else {
      for (const p of ports) {
        const info = await tryInfo("https", p);
        if (info && (info.wss || info.ws)) return info;
      }
      for (const p of ports) {
        const info = await tryInfo("http", p);
        if (info && (info.wss || info.ws)) return info;
      }
      return null;
    }
  }

  // ──────────────────────────────────────────────
  // Conexión principal
  // ──────────────────────────────────────────────
  async function connect() {
    lastInfo = await findAgent();
    if (!lastInfo) {
      throw new Error(
        "No pude encontrar el Arduino Cloud Agent en localhost.\n" +
        "Asegúrate de que esté instalado y ejecutándose.\n" +
        "Si tu sitio es HTTPS, el navegador puede pedirte confiar el certificado local del Agent (sólo la primera vez)."
      );
    }

    const endpoint =
      (location.protocol === "https:" && lastInfo.wss) ? lastInfo.wss :
      (lastInfo.ws || lastInfo.wss);

    if (!endpoint) {
      throw new Error("No encontré un endpoint ws/wss válido en /info.");
    }

    // ⚠️ El cliente de socket.io debe ser versión 2.x
    socket = io(endpoint, {
      transports: ["websocket"],
      forceNew: true
    });

    socket.on("connect", () => emit("agent:connect", { endpoint, version: lastInfo.version }));
    socket.on("disconnect", () => emit("agent:disconnect"));
    socket.on("connect_error", (err) => emit("agent:error", err?.message || String(err)));

    socket.on("command", (msg) => {
      // ejemplos de payload: { OK:true }, { D:"texto\r\n" }, { list:[...] }
      if (msg?.D != null) emit("serial:data", msg.D);
      if (msg?.list != null) emit("ports:list", msg.list);
      emit("agent:message", msg);
    });

    // Algunas builds usan estos canales en lugar de "command"
socket.on("message", (msg) => {
  // Intenta propagar lista si viene con otra clave
  if (msg?.list) emit("ports:list", msg.list);
  emit("agent:message", msg);
});

socket.on("notification", (msg) => {
  if (msg?.list) emit("ports:list", msg.list);
  emit("agent:message", msg);
});
   
    socket.on("connect", () => {
  console.log("[AGENT] conectado a", endpoint);
  emit("agent:connect", { endpoint, version: lastInfo.version });
});

    return lastInfo;
  }

  // ──────────────────────────────────────────────
  // Comandos básicos
  // ──────────────────────────────────────────────
  function listPorts() {
    if (!socket) throw new Error("Conéctate al Agent primero.");
    socket.emit("command", "list");
  }

  function openPort(portName, baud = 115200) {
    if (!socket) throw new Error("Conéctate al Agent primero.");
    selectedPort = portName;
    socket.emit("command", `open ${portName} ${baud}`);
  }

  function closePort() {
    if (!socket || !selectedPort) return;
    socket.emit("command", `close ${selectedPort}`);
    selectedPort = null;
  }

  function sendLine(line) {
    if (!socket || !selectedPort) throw new Error("Abre un puerto primero.");
    socket.emit("command", `send ${selectedPort} ${line}`);
  }

  // ──────────────────────────────────────────────
  // API extendida: comandos crudos + uploadHex
  // ──────────────────────────────────────────────
  function emitCommand(cmd) {
    if (!socket) throw new Error("Conéctate al Agent primero.");
    socket.emit("command", cmd);
  }

  async function uploadHex({ fqbn, port, base64, filename = "firmware.hex" }) {
    if (!lastInfo) throw new Error("Conéctate al Agent primero.");
    const endpoint = lastInfo.https || lastInfo.http;
    if (!endpoint) throw new Error("El Agent no expone endpoint HTTP/HTTPS en /info.");

    const payload = {
      fqbn,           // ej: "arduino:avr:uno"
      port,           // ej: "/dev/cu.usbserial-10"
      file: base64,   // contenido base64 del .hex
      filename
    };

    const r = await fetch(`${endpoint}/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      throw new Error(`Upload HTTP ${r.status} ${r.statusText}: ${txt}`);
    }

    return await r.json().catch(() => ({}));
  }

  // ──────────────────────────────────────────────
  // Sistema de eventos interno (pub/sub)
  // ──────────────────────────────────────────────
  const listeners = {};
  function on(evt, fn) {
    (listeners[evt] ||= []).push(fn);
  }
  function emit(evt, payload) {
    (listeners[evt] || []).forEach((fn) => fn(payload));
  }

  // ──────────────────────────────────────────────
  // API pública
  // ──────────────────────────────────────────────
  return {
    connect,
    listPorts,
    openPort,
    closePort,
    sendLine,
    on,
    __emitCommand: emitCommand,
    uploadHex
  };
})();
