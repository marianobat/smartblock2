// serial-ui.js — UI para Arduino Cloud Agent (Socket.IO v2.x)
// - Solo Cloud Agent (Web Serial deshabilitado)
// - Lee listas de puertos desde msg.Ports (y también msg.list si existiera)
// - Usa "Name" como path (/dev/cu.usbserial-10, COM3, etc.)

(function () {
  const $ = (id) => document.getElementById(id);

  // Elementos UI esperados
  const logEl        = $("log");
  const agentStatus  = $("agentStatus");
  const portSelect   = $("portSelect");

  const btnConnect   = $("btnConnect");
  const btnRefresh   = $("btnRefreshPorts");

  let connected = false;

  // ──────────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────────
  function log(line, cls = "") {
    const timestamp = new Date().toLocaleTimeString();
    const tag = cls ? `[${cls.toUpperCase()}] ` : "";
    const text = `${timestamp} ${tag}${line}`;
    if (!logEl) {
      console.log("[LOG]", text);
      return;
    }
    const prefix = logEl.textContent ? "\n" : "";
    logEl.textContent = `${logEl.textContent || ""}${prefix}${text}`;
    if (logEl.textContent.length > 8000) {
      logEl.textContent = logEl.textContent.slice(-8000);
    }
    logEl.scrollTop = logEl.scrollHeight;
  }

  // Extrae puertos desde distintos formatos de mensaje del Agent
  function extractPortsFromMsg(msg) {
  // 1) Normaliza: si viene como string, intento parsear a JSON
  if (typeof msg === "string") {
    let s = msg.trim();
    // Desescapa comillas &lt; &gt; por si vienen HTML-encoded
    s = s.replace(/&#34;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    try { msg = JSON.parse(s); } catch { /* se queda como string */ }
  }

  // Si sigue sin ser objeto, no hay nada que extraer
  if (!msg || typeof msg !== "object") return [];

  // 2) Algunas builds devuelven la lista en distintas claves
  const keys = ["Ports", "list", "ports", "serial", "serialPorts", "devices", "P"];
  let out = [];
  for (const k of keys) {
    const v = msg[k];
    if (Array.isArray(v)) out = out.concat(v);
  }
  return out;
}

  function setAgentStatus(text, tone = "warn") {
    if (!agentStatus) return;
    agentStatus.textContent = text;
    agentStatus.className = `badge ${tone}`;
  }

  // Rellena el <select> de puertos con tolerancia a formatos
  function populatePortsSelect(ports) {
    if (!portSelect) {
      console.warn("[UI] #portSelect no existe en el DOM");
      log("No encuentro el selector de puertos (#portSelect).", "err");
      return;
    }

    const previous = (typeof window !== "undefined" && window.__SERIAL_SELECTED_PORT) || "";
    portSelect.innerHTML = "";
    const list = Array.isArray(ports) ? ports : [];
    if (!list.length) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "Sin puertos detectados";
      opt.disabled = true;
      opt.selected = true;
      portSelect.appendChild(opt);
    }
    list.forEach((p) => {
      let val = "", label = "";
      if (typeof p === "string") {
        val = label = p;
      } else if (p && typeof p === "object") {
        // ✅ Prioriza "Name" como ruta del puerto (tal como lo envía tu Agent)
        val =
          p.Name || p.Address || p.address || p.Path || p.path ||
          p.comName || p.port || p.device || p.name || "";

        label =
          p.FriendlyName || p.Description || p.description ||
          p.manufacturer || p.product || p.Name || val || "Serial Port";
      }
      if (val) {
        const opt = document.createElement("option");
        opt.value = val;
        opt.textContent = label;
        portSelect.appendChild(opt);
      }
    });

    if (previous) {
      portSelect.value = previous;
    }
    if (!portSelect.value && portSelect.options.length) {
      portSelect.selectedIndex = list.length ? 0 : -1;
    }
    try {
      window.__SERIAL_SELECTED_PORT = portSelect.value || "";
    } catch (_err) {}

    const count = portSelect.options.length;
    log(`Puertos disponibles: ${count}`);
    if (!count) {
      log("No se encontraron puertos. Verifica conexión física y reinicia el Agent.", "warn");
    }
  }

  // Desactiva Web Serial para evitar conflictos (solo usamos el Agent)
  if ("serial" in navigator) {
    navigator.serial.requestPort = async () => {
      throw new Error("Web Serial desactivado: se usa Arduino Cloud Agent.");
    };
  }

  // Persistir selección de puerto
  if (portSelect) {
    portSelect.addEventListener("change", () => {
      const value = portSelect.value || "";
      try { window.__SERIAL_SELECTED_PORT = value; } catch (_e) {}
      if (value) log(`Puerto activo: ${value}`, "ok");
    });
  }

  // ──────────────────────────────────────────────
  // Botones
  // ──────────────────────────────────────────────
  async function attemptAgentConnect(origin = "manual") {
    if (connected) {
      if (origin !== "auto") log("Agent ya conectado.", "warn");
      return;
    }
    setAgentStatus("Conectando…", "warn");
    try {
      const info = await ArduinoAgent.connect();
      connected = true;
      setAgentStatus(`Conectado (v${info.version || "unknown"})`, "ok");
      log(`Agent conectado (${info.version || "unknown"})`, origin === "auto" ? "" : "ok");
      try {
        if (ArduinoAgent.__emitCommand) {
          ArduinoAgent.__emitCommand("list");
          ArduinoAgent.__emitCommand("serial list");
        } else {
          ArduinoAgent.listPorts();
        }
      } catch (e) {
        console.error("[UI] error al listar post-conexión", e);
      }
    } catch (e) {
      setAgentStatus("Sin conexión", "err");
      log(`Error: ${e.message}`, "err");
      throw e;
    }
  }

  btnConnect && btnConnect.addEventListener("click", () => {
    attemptAgentConnect("manual").catch(() => {});
  });

  btnRefresh && btnRefresh.addEventListener("click", async () => {
    log("Listando puertos…", "warn");
    try {
      if (ArduinoAgent.__emitCommand) {
        ArduinoAgent.__emitCommand("list");
        ArduinoAgent.__emitCommand("serial list");
      } else {
        ArduinoAgent.listPorts();
      }
    } catch (e) {
      console.error("[UI] error al listar", e);
      log(`Error: ${e.message}`, "err");
    }
  });

  // ──────────────────────────────────────────────
  // Eventos del Agent
  // ──────────────────────────────────────────────
  ArduinoAgent.on("agent:connect", (info) => {
    connected = true;
    setAgentStatus(`Conectado (ws ${info.endpoint || ""})`, "ok");
    log(`WS conectado: ${info.endpoint}`, "ok");
    // Auto-listar al conectar
    try {
      if (ArduinoAgent.__emitCommand) {
        ArduinoAgent.__emitCommand("list");
        ArduinoAgent.__emitCommand("serial list");
      } else {
        ArduinoAgent.listPorts();
      }
    } catch (e) {
      console.error("[UI] error al listar en agent:connect", e);
    }
  });

  ArduinoAgent.on("agent:disconnect", () => {
    log("Desconectado del Agent.", "warn");
    connected = false;
    setAgentStatus("Sin conexión", "warn");
  });

  ArduinoAgent.on("agent:error", (msg) => {
    log(`Agent error: ${msg}`, "err");
    setAgentStatus("Error con el Agent", "err");
  });

  // Caso clásico / y tu build: recibimos lista via 'command'/'message'/'notification'
  ArduinoAgent.on("ports:list", (ports) => {
    console.log("[WS] ports:list recibido:", ports);
    populatePortsSelect(Array.isArray(ports) ? ports : []);
  });

  ArduinoAgent.on("agent:message", (msg) => {
    // Normaliza y muestra el crudo (para depurar)
    const rawShown = (typeof msg === "string") ? msg : JSON.stringify(msg);
    console.log("AGENT RAW (norm):", rawShown);

    const ports = extractPortsFromMsg(msg);
    if (ports.length) {
      // Guarda la última lista globalmente por si otra parte de la UI la necesita
      try { window.__AGENT_LAST_PORTS = ports; } catch (_e) {}
      console.log("[WS] detecté puertos, actualizo selector");
      populatePortsSelect(ports);
    }
  });

  // Datos serie entrantes
  ArduinoAgent.on("serial:data", (text) => {
    const clean = String(text).replace(/\r?\n$/, "");
    log(`← ${clean}`);
  });

  // Intento de conexión automática poco después de iniciar
  setTimeout(() => {
    attemptAgentConnect("auto").catch(() => {});
  }, 600);

  // Exponer cierre seguro del puerto para que app.js pueda llamarlo antes del upload CLI
  window.SerialUI = window.SerialUI || {};
  window.SerialUI.log = log;
  window.SerialUI.closeIfOpen = async function(portName){
    try{
      if (!portName) return;
      if (window.ArduinoAgent && typeof window.ArduinoAgent.__emitCommand === 'function'){
        // consulta estado (no bloqueante) y luego intenta cerrar
        window.ArduinoAgent.__emitCommand('list');
        await new Promise(r => setTimeout(r, 150));
        window.ArduinoAgent.__emitCommand(`close ${portName}`);
      }
    }catch(e){
      console.warn('[SerialUI.closeIfOpen]', e);
    }
  };

  // ──────────────────────────────────────────────
  // Autotest del selector (ejecutar en consola: __testPopulate())
  // ──────────────────────────────────────────────
  window.__testPopulate = function () {
    populatePortsSelect([
      "/dev/cu.usbserial-TEST",
      { Name: "/dev/cu.usbmodem-TEST", FriendlyName: "Arduino (TEST)" }
    ]);
    log("Autotest: opciones dummy agregadas al selector.", "ok");
  };
})();
