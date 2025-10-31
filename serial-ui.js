// serial-ui.js — Interfaz para Arduino Cloud Agent (Socket.IO v2.x)
// - Solo usa Cloud Agent (Web Serial deshabilitado)
// - Intenta listar puertos por WebSocket; si no llega nada, hace fallback HTTP a /list
// - Compatible con agent.js que expone __emitCommand y uploadHex

(function () {
  const $ = (id) => document.getElementById(id);

  // Elementos UI
  const logEl        = $("log");
  const agentStatus  = $("agentStatus");
  const portStatus   = $("portStatus");
  const portSelect   = $("portSelect");

  const btnConnect   = $("btnConnect");
  const btnList      = $("btnList");
  const btnOpen      = $("btnOpen");
  const btnClose     = $("btnClose");
  const btnSend      = $("btnSend");
  const inputLine    = $("line");
  const inputBaud    = $("baud");

  // Opcional: upload .hex
  const hexInput     = $("hexFile");
  const fqbnInput    = $("fqbn");
  const btnUpload    = $("btnUpload");

  let connected = false;

  // ──────────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────────
  function log(line, cls = "") {
    if (!logEl) { console.log("[LOG]", line); return; }
    const div = document.createElement("div");
    if (cls) div.className = cls;
    div.textContent = line;
    logEl.appendChild(div);
    logEl.scrollTop = logEl.scrollHeight;
  }

  // Extrae puertos desde distintos formatos de mensaje del Agent
  function extractPortsFromMsg(msg) {
    if (!msg || typeof msg !== "object") return [];
    // Algunas builds exponen diferentes claves
    const keys = ["list", "ports", "serial", "serialPorts", "devices", "P"];
    let out = [];
    for (const k of keys) {
      const v = msg[k];
      if (Array.isArray(v)) out = out.concat(v);
    }
    return out;
  }

  // Rellena el <select> de puertos con tolerancia a formatos
  function populatePortsSelect(ports) {
    if (!portSelect) {
      console.warn("[UI] #portSelect no existe en el DOM");
      log("No encuentro el selector de puertos (#portSelect).", "err");
      return;
    }
    // Log de visibilidad (por si está oculto por CSS)
    console.log("[UI] portSelect size:", portSelect.offsetWidth, portSelect.offsetHeight);

    portSelect.innerHTML = "";
    (ports || []).forEach((p) => {
      let val = "", label = "";
      if (typeof p === "string") {
        val = label = p;
      } else if (p && typeof p === "object") {
        val =
          p.Address || p.address || p.Path || p.path ||
          p.comName || p.port || p.device || p.name || p.path || "";
        label =
          p.Name || p.product || p.FriendlyName || p.manufacturer ||
          p.Description || p.description || p.friendlyName || val || "Serial Port";
      }
      if (val) {
        const opt = document.createElement("option");
        opt.value = val;
        opt.textContent = label;
        portSelect.appendChild(opt);
      }
    });

    console.log("[UI] options cargadas:", portSelect.options.length, ports);
    const count = portSelect.options.length;
    log(`Puertos disponibles: ${count}`);
    if (!count) {
      log("No se encontraron puertos. Verifica conexión física y reinicia el Agent.", "warn");
    }
  }

  // Lee un archivo como Base64 (para upload .hex)
  async function readFileAsBase64(file) {
    return new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onload = () => {
        const b64 = btoa(String.fromCharCode(...new Uint8Array(reader.result)));
        res(b64);
      };
      reader.onerror = rej;
      reader.readAsArrayBuffer(file);
    });
  }

  // Desactiva Web Serial para evitar conflictos (solo usamos el Agent)
  if ("serial" in navigator) {
    navigator.serial.requestPort = async () => {
      throw new Error("Web Serial desactivado: se usa Arduino Cloud Agent.");
    };
  }

  // ──────────────────────────────────────────────
  // Fallback HTTP: prueba /list en 8992 y 8991
  // ──────────────────────────────────────────────
  async function fallbackHttpList() {
    const urls = [
      "http://127.0.0.1:8992/list",
      "http://127.0.0.1:8991/list"
    ];
    for (const u of urls) {
      try {
        const r = await fetch(u, { cache: "no-store" });
        if (!r.ok) continue;
        const j = await r.json().catch(() => null);
        if (j && (Array.isArray(j.list) || Array.isArray(j.ports))) {
          const ports = j.list || j.ports;
          console.log("[HTTP] /list →", ports);
          populatePortsSelect(ports);
          log("Puertos recuperados vía HTTP", "ok");
          return true;
        }
      } catch (e) {
        console.warn("[HTTP] fallback /list falló en", u, e?.message || e);
      }
    }
    return false;
  }

  function scheduleWsFallback(delayMs = 600) {
    setTimeout(async () => {
      const hasOptions = (portSelect && portSelect.options && portSelect.options.length > 0);
      if (!hasOptions) {
        console.log("[UI] WS no devolvió lista, intento fallback HTTP /list");
        await fallbackHttpList();
      }
    }, delayMs);
  }

  // ──────────────────────────────────────────────
  // Botones
  // ──────────────────────────────────────────────
  btnConnect && btnConnect.addEventListener("click", async () => {
    if (agentStatus) { agentStatus.textContent = "Conectando..."; agentStatus.className = "warn"; }
    try {
      const info = await ArduinoAgent.connect();
      connected = true;
      if (agentStatus) { agentStatus.textContent = `Conectado ✔ (v${info.version})`; agentStatus.className = "ok"; }
      log(`Agent conectado (${info.version})`, "ok");

      // Intento listar al conectar (WS)
      try {
        if (ArduinoAgent.__emitCommand) {
          console.log("[UI] enviando 'list' y 'serial list' por WS (auto)");
          ArduinoAgent.__emitCommand("list");
          ArduinoAgent.__emitCommand("serial list");
        } else {
          ArduinoAgent.listPorts();
        }
      } catch (e) {
        console.error("[UI] error al listar post-conexión", e);
      }

      // Programa fallback HTTP si WS no trajo puertos
      scheduleWsFallback(700);

    } catch (e) {
      if (agentStatus) { agentStatus.textContent = "No conectado"; agentStatus.className = "err"; }
      log(`Error: ${e.message}`, "err");
    }
  });

  btnList && btnList.addEventListener("click", async () => {
    console.log("[UI] btnList clickeado");
    log("Listando puertos...", "warn");
    try {
      if (ArduinoAgent.__emitCommand) {
        console.log("[UI] enviando 'list' y 'serial list' por WS");
        ArduinoAgent.__emitCommand("list");
        ArduinoAgent.__emitCommand("serial list");
      } else {
        console.log("[UI] usando ArduinoAgent.listPorts()");
        ArduinoAgent.listPorts();
      }
    } catch (e) {
      console.error("[UI] error al listar", e);
      log(`Error: ${e.message}`, "err");
    }

    // Fallback HTTP si no aparece nada por WS
    scheduleWsFallback(700);
  });

  btnOpen && btnOpen.addEventListener("click", () => {
    const p = portSelect ? portSelect.value : "";
    const b = Number((inputBaud && inputBaud.value) || 115200);
    if (!p) return log("Elegí un puerto.", "warn");
    try {
      ArduinoAgent.openPort(p, b);
      if (portStatus) { portStatus.textContent = `Abierto: ${p} @ ${b}`; portStatus.className = "ok"; }
      log(`Puerto abierto: ${p} @ ${b}`, "ok");
    } catch (e) {
      log(`Error: ${e.message}`, "err");
    }
  });

  btnClose && btnClose.addEventListener("click", () => {
    try {
      ArduinoAgent.closePort();
      if (portStatus) { portStatus.textContent = "Puerto cerrado"; portStatus.className = "warn"; }
      log("Puerto cerrado.");
    } catch (e) {
      log(`Error: ${e.message}`, "err");
    }
  });

  btnSend && btnSend.addEventListener("click", () => {
    const line = (inputLine && inputLine.value) || "";
    if (!line.trim()) return;
    try {
      ArduinoAgent.sendLine(line);
      log(`→ ${line}`);
      if (inputLine) inputLine.value = "";
    } catch (e) {
      log(`Error: ${e.message}`, "err");
    }
  });

  // ──────────────────────────────────────────────
  // Eventos del Agent
  // ──────────────────────────────────────────────
  ArduinoAgent.on("agent:connect", (info) => {
    log(`WS conectado: ${info.endpoint}`, "ok");
    // Listar automáticamente al conectar (WS)
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
    // Fallback HTTP si WS no respondió
    scheduleWsFallback(700);
  });

  ArduinoAgent.on("agent:disconnect", () => {
    log("Desconectado del Agent.", "warn");
    connected = false;
  });

  ArduinoAgent.on("agent:error", (msg) => {
    log(`Agent error: ${msg}`, "err");
  });

  // Caso clásico: el Agent emite { list: [...] } por 'command'
  ArduinoAgent.on("ports:list", (ports) => {
    console.log("[WS] ports:list recibido:", ports);
    populatePortsSelect(Array.isArray(ports) ? ports : []);
  });

  // Capturar *cualquier* mensaje que incluya lista en otra clave
  ArduinoAgent.on("agent:message", (msg) => {
    console.log("AGENT RAW:", msg);
    const ports = extractPortsFromMsg(msg);
    if (ports.length) {
      console.log("[WS] detecté puertos en otra clave, actualizo selector");
      populatePortsSelect(ports);
    }
  });

  // Datos serie entrantes
  ArduinoAgent.on("serial:data", (text) => {
    const clean = String(text).replace(/\r?\n$/, "");
    log(`← ${clean}`);
  });

  // ──────────────────────────────────────────────
  // Upload .hex (opcional)
  // ──────────────────────────────────────────────
  if (btnUpload && hexInput && fqbnInput) {
    btnUpload.addEventListener("click", async () => {
      try {
        const file = hexInput.files[0];
        const fqbn = fqbnInput.value.trim();
        const port = portSelect ? portSelect.value : "";
        if (!file) return log("Elegí un archivo .hex.", "warn");
        if (!fqbn) return log("Indicá FQBN (ej: arduino:avr:uno).", "warn");
        if (!port) return log("Elegí un puerto.", "warn");

        const base64 = await readFileAsBase64(file);
        log("Subiendo firmware...", "warn");
        const resp = await ArduinoAgent.uploadHex({ fqbn, port, base64, filename: file.name });
        log(`Upload completado. Respuesta: ${JSON.stringify(resp)}`, "ok");
      } catch (e) {
        log(`Upload falló: ${e.message}`, "err");
        log("Si ves 401/403 o 'signature required', tu Agent requiere firma; conviene Agent 'open' o usar un bridge con arduino-cli.", "warn");
      }
    });
  }

  // ──────────────────────────────────────────────
  // Autotest del selector (ejecutar en consola: __testPopulate())
  // ──────────────────────────────────────────────
  window.__testPopulate = function () {
    populatePortsSelect([
      "/dev/cu.usbserial-TEST",
      { Address: "/dev/cu.usbmodem-TEST", Name: "Arduino (TEST)" }
    ]);
    log("Autotest: opciones dummy agregadas al selector.", "ok");
  };
})();
