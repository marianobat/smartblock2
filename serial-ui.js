// serial-ui.js — Interfaz básica para controlar Arduino Cloud Agent desde la web
// Funciona junto con agent.js y socket.io v2.4.0

(function () {
  const $ = (id) => document.getElementById(id);
  const logEl = $("log");
  const agentStatus = $("agentStatus");
  const portStatus = $("portStatus");
  const portSelect = $("portSelect");

  let connected = false;

  function extractPortsFromMsg(msg) {
  if (!msg || typeof msg !== "object") return [];
  const keys = ["list", "ports", "serial", "serialPorts", "devices", "P"];
  let out = [];
  for (const k of keys) {
    const v = msg[k];
    if (Array.isArray(v)) out = out.concat(v);
  }
  return out;
}

function populatePortsSelect(ports) {
  const select = document.getElementById("portSelect");
  if (!select) return;
  select.innerHTML = "";
  (ports || []).forEach((p) => {
    let val = "", label = "";
    if (typeof p === "string") { val = label = p; }
    else if (p && typeof p === "object") {
      val =
        p.Address || p.address || p.Path || p.path ||
        p.comName || p.port || p.device || p.name || "";
      label =
        p.Name || p.product || p.FriendlyName || p.manufacturer ||
        p.Description || p.description || val || "Serial Port";
    }
    if (val) {
      const opt = document.createElement("option");
      opt.value = val;
      opt.textContent = label;
      select.appendChild(opt);
    }
  });
  const count = select.options.length;
  log(`Puertos disponibles: ${count}`);
  if (!count) log("No se encontraron puertos. Verifica conexión física y reinicia el Agent.", "warn");
}
  
  // ──────────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────────
  function populatePortsSelect(ports) {
  const select = document.getElementById("portSelect");
  if (!select) {
    console.warn("[UI] #portSelect no existe en el DOM");
    log("No encuentro el selector de puertos (#portSelect).", "err");
    return;
  }
  // Log UI: dimensiones (para saber si está oculto por CSS)
  console.log("[UI] portSelect visible?", select.offsetWidth, select.offsetHeight);

  select.innerHTML = "";
  (ports || []).forEach((p) => {
    let val = "", label = "";
    if (typeof p === "string") { val = label = p; }
    else if (p && typeof p === "object") {
      val =
        p.Address || p.address || p.Path || p.path ||
        p.comName || p.port || p.device || p.name || "";
      label =
        p.Name || p.product || p.FriendlyName || p.manufacturer ||
        p.Description || p.description || val || "Serial Port";
    }
    if (val) {
      const opt = document.createElement("option");
      opt.value = val;
      opt.textContent = label;
      select.appendChild(opt);
    }
  });
  console.log("[UI] options cargadas:", select.options.length, ports);
  const count = select.options.length;
  log(`Puertos disponibles: ${count}`);
  if (!count) {
    log("No se encontraron puertos. Verifica conexión física y reinicia el Agent.", "warn");
  }
}

// AUTOTEST UI: añade dos opciones falsas para probar render
window.__testPopulate = function () {
  populatePortsSelect([
    "/dev/cu.usbserial-TEST",
    { Address: "/dev/cu.usbmodem-TEST", Name: "Arduino (TEST)" }
  ]);
  log("Autotest: opciones dummy agregadas al selector.", "ok");
};

  
  
  function log(line, cls = "") {
    const div = document.createElement("div");
    if (cls) div.className = cls;
    div.textContent = line;
    logEl.appendChild(div);
    logEl.scrollTop = logEl.scrollHeight;
  }

  // Desactiva Web Serial para evitar conflictos
  if ("serial" in navigator) {
    navigator.serial.requestPort = async () => {
      throw new Error("Web Serial desactivado: se usa Arduino Cloud Agent.");
    };
  }

  // ──────────────────────────────────────────────
  // Botón: Conectar Agent
  // ──────────────────────────────────────────────
  $("btnConnect").addEventListener("click", async () => {
    agentStatus.textContent = "Conectando...";
    agentStatus.className = "warn";
    try {
      const info = await ArduinoAgent.connect();
      connected = true;
      agentStatus.textContent = `Conectado ✔ (v${info.version})`;
      agentStatus.className = "ok";
      log(`Agent conectado (${info.version})`, "ok");

      // Una vez conectado, listamos puertos
      ArduinoAgent.listPorts();
    } catch (e) {
      agentStatus.textContent = "No conectado";
      agentStatus.className = "err";
      log(`Error: ${e.message}`, "err");
    }
  });

  // ──────────────────────────────────────────────
  // Botón: Listar puertos
  // ──────────────────────────────────────────────
  document.getElementById("btnList").addEventListener("click", () => {
  console.log("[UI] btnList clickeado");
  log("Listando puertos...", "warn");

  try {
    // Si tenemos canal crudo, disparamos doble comando; si no, el estándar
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
});

  // ──────────────────────────────────────────────
  // Botón: Abrir puerto
  // ──────────────────────────────────────────────
  $("btnOpen").addEventListener("click", () => {
    const p = portSelect.value;
    const b = Number($("baud").value || 115200);
    if (!p) return log("Elegí un puerto.", "warn");
    try {
      ArduinoAgent.openPort(p, b);
      portStatus.textContent = `Abierto: ${p} @ ${b}`;
      portStatus.className = "ok";
      log(`Puerto abierto: ${p} @ ${b}`, "ok");
    } catch (e) {
      log(`Error: ${e.message}`, "err");
    }
  });

  // ──────────────────────────────────────────────
  // Botón: Cerrar puerto
  // ──────────────────────────────────────────────
  $("btnClose").addEventListener("click", () => {
    ArduinoAgent.closePort();
    portStatus.textContent = "Puerto cerrado";
    portStatus.className = "warn";
    log("Puerto cerrado.");
  });

  // ──────────────────────────────────────────────
  // Botón: Enviar texto al Arduino
  // ──────────────────────────────────────────────
  $("btnSend").addEventListener("click", () => {
    const line = $("line").value || "";
    if (!line.trim()) return;
    try {
      ArduinoAgent.sendLine(line);
      log(`→ ${line}`);
      $("line").value = "";
    } catch (e) {
      log(`Error: ${e.message}`, "err");
    }
  });

  // ──────────────────────────────────────────────
  // Eventos del Agent
  // ──────────────────────────────────────────────

  ArduinoAgent.on("agent:connect", (info) => {
    log(`WS conectado: ${info.endpoint}`, "ok");
    ArduinoAgent.listPorts(); // listar automáticamente al conectar
  });

  ArduinoAgent.on("agent:disconnect", () => {
    log("Desconectado del Agent.", "warn");
    connected = false;
  });

  ArduinoAgent.on("agent:error", (msg) => {
    log(`Agent error: ${msg}`, "err");
  });

  ArduinoAgent.on("ports:list", (ports) => {
  populatePortsSelect(Array.isArray(ports) ? ports : []);
});

  ArduinoAgent.on("serial:data", (text) => {
    const clean = String(text).replace(/\r?\n$/, "");
    log(`← ${clean}`);
  });

  ArduinoAgent.on("agent:message", (msg) => {
  console.log("AGENT RAW:", msg);
  const ports = extractPortsFromMsg(msg);
  if (ports.length) populatePortsSelect(ports);
});

  // ──────────────────────────────────────────────
  // Funcionalidad opcional: Upload .hex
  // ──────────────────────────────────────────────
  const hexInput = $("hexFile");
  const fqbnInput = $("fqbn");
  const btnUpload = $("btnUpload");

  if (btnUpload) {
    btnUpload.addEventListener("click", async () => {
      try {
        const file = hexInput.files[0];
        const fqbn = fqbnInput.value.trim();
        const port = portSelect.value;
        if (!file) return log("Elegí un archivo .hex.", "warn");
        if (!fqbn) return log("Indicá FQBN (ej: arduino:avr:uno).", "warn");
        if (!port) return log("Elegí un puerto.", "warn");

        const base64 = await readFileAsBase64(file);
        log("Subiendo firmware...", "warn");
        const resp = await ArduinoAgent.uploadHex({ fqbn, port, base64, filename: file.name });
        log(`Upload completado. Respuesta: ${JSON.stringify(resp)}`, "ok");
      } catch (e) {
        log(`Upload falló: ${e.message}`, "err");
      }
    });
  }

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
})();
