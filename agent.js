// agent.js
window.ArduinoAgent = (function () {
  let socket = null;
  let selectedPort = null;
  let lastInfo = null;

  async function findAgent() {
    const ports = Array.from({ length: 12 }, (_, i) => 8990 + i);

    async function tryInfo(proto, port) {
      const url = `${proto}://127.0.0.1:${port}/info`;
      try {
        const r = await fetch(url, { method: "GET" });
        if (!r.ok) return null;
        const info = await r.json(); // { http, https, ws, wss, version }
        return info;
      } catch {
        return null;
      }
    }

    if (location.protocol === "https:") {
      for (const p of ports) {
        const info = await tryInfo("https", p);
        if (info && (info.wss || info.ws)) return info;
      }
      return null; // no se puede usar http desde https
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

  async function connect() {
    lastInfo = await findAgent();
    if (!lastInfo) {
      throw new Error(
        "No pude encontrar el Arduino Cloud Agent en 127.0.0.1. " +
        "Asegúrate de que está instalado y ejecutándose. " +
        "Si tu sitio es HTTPS, el navegador puede pedirte confiar el certificado local del Agent (sólo la primera vez)."
      );
    }
    const endpoint =
      (location.protocol === "https:" && lastInfo.wss) ? lastInfo.wss
      : (lastInfo.ws || lastInfo.wss);

    if (!endpoint) throw new Error("No encontré un endpoint ws/wss válido.");

    // requiere el cliente de socket.io (lo cargamos en index.html)
    socket = io(endpoint, { transports: ["websocket"] });

    socket.on("connect", () => emit("agent:connect", { endpoint, version: lastInfo.version }));
    socket.on("disconnect", () => emit("agent:disconnect"));
    socket.on("connect_error", (err) => emit("agent:error", err?.message || String(err)));

    socket.on("command", (msg) => {
      if (msg?.D != null) emit("serial:data", msg.D);
      if (msg?.list != null) emit("ports:list", msg.list);
      emit("agent:message", msg);
    });

    return lastInfo;
  }

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

  // Event Emitter simple
  const listeners = {};
  function on(evt, fn) {
    (listeners[evt] ||= []).push(fn);
  }
  function emit(evt, payload) {
    (listeners[evt] || []).forEach((fn) => fn(payload));
  }

  return { connect, listPorts, openPort, closePort, sendLine, on };
})();
