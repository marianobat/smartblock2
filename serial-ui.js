// serial-ui.js
(function () {
  const $ = (id) => document.getElementById(id);
  const logEl = $("log");
  const agentStatus = $("agentStatus");
  const portStatus = $("portStatus");
  const portSelect = $("portSelect");

  function log(line, cls = "") {
    const div = document.createElement("div");
    if (cls) div.className = cls;
    div.textContent = line;
    logEl.appendChild(div);
    logEl.scrollTop = logEl.scrollHeight;
  }

  $("btnConnect")?.addEventListener("click", async () => {
    agentStatus.textContent = "Conectando...";
    agentStatus.className = "warn";
    try {
      await ArduinoAgent.connect();
      agentStatus.textContent = "Conectado al Agent ✔";
      agentStatus.className = "ok";
      log("Agent conectado.", "ok");
      // listar puertos automáticamente
      ArduinoAgent.listPorts();
    } catch (e) {
      agentStatus.textContent = "No conectado";
      agentStatus.className = "err";
      log(`Error: ${e.message}`, "err");
    }
  });

  $("btnList")?.addEventListener("click", () => {
    try { ArduinoAgent.listPorts(); } catch (e) { log(`Error: ${e.message}`, "err"); }
  });

  $("btnOpen")?.addEventListener("click", () => {
    const p = portSelect.value;
    const b = Number($("baud").value || 115200);
    if (!p) return log("Elegí un puerto.", "warn");
    try {
      ArduinoAgent.openPort(p, b);
      portStatus.textContent = `Abierto: ${p} @ ${b}`;
      portStatus.className = "ok";
      log(`Puerto abierto: ${p} @ ${b}`, "ok");
    } catch (e) { log(`Error: ${e.message}`, "err"); }
  });

  $("btnClose")?.addEventListener("click", () => {
    ArduinoAgent.closePort();
    portStatus.textContent = "Puerto cerrado";
    portStatus.className = "warn";
    log("Puerto cerrado.");
  });

  $("btnSend")?.addEventListener("click", () => {
    const line = $("line").value || "";
    if (!line.trim()) return;
    try {
      ArduinoAgent.sendLine(line);
      log(`→ ${line}`);
      $("line").value = "";
    } catch (e) { log(`Error: ${e.message}`, "err"); }
  });

  // Eventos del Agent
  ArduinoAgent.on("agent:connect", (info) => log(`WS conectado (${info.endpoint})`, "ok"));
  ArduinoAgent.on("agent:disconnect", () => log("Desconectado del Agent.", "warn"));
  ArduinoAgent.on("agent:error", (msg) => log(`Agent error: ${msg}`, "err"));

  ArduinoAgent.on("ports:list", (ports) => {
    portSelect.innerHTML = "";
    (ports || []).forEach((p) => {
      const val = p.Address || p.address || p;
      const label = p.Name || p.product || p.Address || p;
      const opt = document.createElement("option");
      opt.value = val;
      opt.textContent = label;
      portSelect.appendChild(opt);
    });
    log(`Puertos disponibles: ${(ports || []).length}`);
  });

  ArduinoAgent.on("serial:data", (text) => {
    const clean = String(text).replace(/\r?\n$/, "");
    log(`← ${clean}`);
    // Si tu firmware envía JSON por línea, aquí podrías:
    // try { const obj = JSON.parse(clean); /* actualizar bloques */ } catch {}
  });
})();
