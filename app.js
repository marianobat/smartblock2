// === Tema SmartBlock para Blockly ===
const SmartBlockTheme = Blockly.Theme.defineTheme('smartblock', {
  'base': Blockly.Themes.Classic, // podés probar "Zelos" también
  'blockStyles': {
    "loop_blocks":  { "colourPrimary": "#FFB703" },
    "logic_blocks": { "colourPrimary": "#219EBC" },
    "math_blocks":  { "colourPrimary": "#8ECAE6" },
    "io_blocks":    { "colourPrimary": "#FB8500" },
    "sensor_blocks": { "colourPrimary": "#4CC9F0" },
    "display_blocks": { "colourPrimary": "#9B5DE5" },
    "motor_blocks": { "colourPrimary": "#F15BB5" }
  },
  'categoryStyles': {
    "loop_category":  { "colour": "#FFB703" },
    "logic_category": { "colour": "#219EBC" },
    "math_category":  { "colour": "#8ECAE6" },
    "io_category":    { "colour": "#FB8500" },
    "sensor_category": { "colour": "#4CC9F0" },
    "display_category": { "colour": "#9B5DE5" },
    "motor_category": { "colour": "#F15BB5" }
  },
  'componentStyles': {
    'workspaceBackgroundColour': '#f7f8fa',
    'toolboxBackgroundColour':   '#ffffff',
    'flyoutBackgroundColour':    '#f0f0f0',
    'flyoutOpacity': 0.8,
    'scrollbarColour': '#c4c4c4',
    'insertionMarkerColour': '#219EBC',
    'insertionMarkerOpacity': 0.3,
    'cursorColour': '#FFB703',
  }
});

let workspace = null;

const scheduleWorkspaceResize = (() => {
  let raf = null;
  return (options = {}) => {
    if (!window?.Blockly || !workspace) return;
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      raf = null;
      try {
        Blockly.svgResize(workspace);
        if (options.fit) {
          workspace.resizeContents();
        }
      } catch (e) {
        console.warn('[Blockly] resize failed', e);
      }
    });
  };
})();
// (Estos eran para Web Serial; los dejamos por compatibilidad si tenés botones de prueba)
let port = null, writer = null, reader = null;

function onError(e) {
  console.error(e);
  const log = document.getElementById('serial-log');
  if (log) { log.textContent += '[ERROR] ' + (e?.message || e) + '\n'; }
}
function logSerial(msg) {
  const el = document.getElementById('serial-log');
  if (!el) return;
  el.textContent += msg + '\n';
  el.scrollTop = el.scrollHeight;
}

// --- UTILIDADES DE BLOQUES ---

function ensureSingletonTopBlock(type, x, y) {
  if (!workspace) {
    console.warn("Blockly workspace todavía no está disponible (ensureSingletonTopBlock).");
    return null;
  }
  const existing = workspace.getAllBlocks(false).find(b => b.type === type);
  if (existing) return existing;
  const block = workspace.newBlock(type);
  block.initSvg();
  block.render();
  block.moveBy(x, y);
  return block;
}

function autoPlaceSetupLoop() {
  if (!workspace) return;
  const setup = ensureSingletonTopBlock('arduino_setup', 50, 40);
  const loop  = ensureSingletonTopBlock('arduino_loop',  50, 220);
  return { setup, loop };
}

function preventDuplicates() {
  if (!workspace) return;
  workspace.addChangeListener(function (e) {
    if (e.type !== Blockly.Events.BLOCK_CREATE) return;
    const ids = e.ids || [];
    ids.forEach(id => {
      const b = workspace.getBlockById(id);
      if (!b) return;
      if (b.type === 'arduino_setup' || b.type === 'arduino_loop') {
        // Si ya hay otro del mismo tipo, borrar este (el duplicado)
        const others = workspace.getAllBlocks(false).filter(x => x.type === b.type && x.id !== b.id);
        if (others.length) {
          b.dispose(true);
          alert(`Sólo se permite un bloque ${b.type.replace('arduino_', '')}. Ya existe en el lienzo.`);
        }
      }
    });
  });
}

let renderRequest = null;

function updateCodeStatus(text, tone = 'badge-muted') {
  const badge = document.getElementById('code-status');
  if (!badge) return;
  badge.textContent = text;
  badge.classList.remove('badge-muted', 'ok', 'warn', 'err');
  badge.classList.add(tone);
}

function scheduleCodeRefresh(label = 'Actualizando…') {
  updateCodeStatus(label, 'warn');
  if (renderRequest) cancelAnimationFrame(renderRequest);
  renderRequest = requestAnimationFrame(() => {
    renderRequest = null;
    try {
      generateSketch();
      updateCodeStatus('Actualizado', 'ok');
    } catch (e) {
      updateCodeStatus('Error', 'err');
      onError(e);
    }
  });
}

// --- INICIALIZACIÓN DE BLOCKLY ---

function setupBlockly() {
  if (!window.Blockly) throw new Error('Blockly no está disponible.');
  const blocklyDiv = document.getElementById('blocklyDiv');
  const toolboxEl  = document.getElementById('toolbox');
  if (!blocklyDiv || !toolboxEl) throw new Error('Faltan #blocklyDiv o #toolbox en el HTML.');

  workspace = Blockly.inject('blocklyDiv', {
    toolbox: toolboxEl,
    theme: SmartBlockTheme,       // 👈 usa el tema que definiste arriba
    renderer: 'zelos',            // estilo de bloques
    zoom: { controls: true, wheel: true },
    trashcan: true,
    scrollbars: true,
  });

  // 🔒 Importante: recién ahora que existe workspace, colocamos setup/loop y el listener anti-duplicados
  autoPlaceSetupLoop();
  preventDuplicates();

  window.addEventListener('resize', scheduleWorkspaceResize);

  workspace.addChangeListener((event) => {
    if (!event || event.isUiEvent) return;
    scheduleCodeRefresh();
  });

  // Render inicial
  scheduleCodeRefresh('Generando…');
  scheduleWorkspaceResize({ fit: true });
}

// --- GENERACIÓN DE CÓDIGO ---

function generateSketch() {
  if (!window.Arduino) throw new Error('Generator Arduino no cargó (generator.js).');
  if (!workspace) throw new Error('Workspace no inicializado');
  Arduino.init(workspace);
  const tops = workspace.getTopBlocks(true);
  let body = '';
  for (const b of tops) {
    if (b.type !== 'arduino_setup' && b.type !== 'arduino_loop') continue;
    const code = Arduino.blockToCode(b);
    body += Array.isArray(code) ? code[0] : (code || '');
  }
  const final = Arduino.finish(body);
  const out = document.getElementById('code');
  if (out) out.textContent = final;
  return final;
}
try { window.generateSketch = generateSketch; } catch(_e){}

function downloadINO(name, content) {
  const blob = new Blob([content], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

// --- (Opcional) Web Serial de prueba local ---

async function connectSerial() {
  if (!('serial' in navigator)) { alert('Chrome/Edge y HTTPS/localhost son necesarios para WebSerial'); return; }
  try {
    port = await navigator.serial.requestPort();
    await port.open({ baudRate: 115200 });
    writer = port.writable.getWriter();
    reader = port.readable.getReader();
    const pl = document.getElementById('port-label');
    if (pl) pl.textContent = 'conectado';
    (async () => {
      const dec = new TextDecoder();
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          if (value) logSerial(dec.decode(value));
        }
      } catch (e) { onError(e); }
    })();
  } catch (e) { onError(e); }
}
async function sendSerial(cmd) {
  if (!writer) { alert('Conectá primero'); return; }
  const enc = new TextEncoder();
  await writer.write(enc.encode(cmd.trim() + '\n'));
  logSerial('> ' + cmd);
}

// --- Arranque de la app ---

window.addEventListener('DOMContentLoaded', () => {
  try { setupBlockly(); } catch (e) { onError(e); }

  const $ = id => document.getElementById(id);

  const brandMedia = document.querySelector('.brand-media');
  const brandTitle = document.querySelector('.brand-copy h1');
  if (brandMedia && brandTitle) {
    const words = (brandTitle.textContent || '').trim().split(/\s+/).filter(Boolean);
    const initials = words.slice(0, 2).map(word => word[0] || '').join('').toUpperCase() || 'SB';
    brandMedia.dataset.placeholder = initials;
  }

  const brandLogo = $('brandLogo');
  if (brandMedia && brandLogo) {
    const showPlaceholder = () => {
      brandLogo.classList.add('is-hidden');
      brandMedia.classList.add('placeholder');
    };
    const showLogo = () => {
      brandLogo.classList.remove('is-hidden');
      brandMedia.classList.remove('placeholder');
    };
    brandMedia.classList.add('placeholder');
    if (brandLogo.complete) {
      if (brandLogo.naturalWidth > 0) {
        showLogo();
      } else {
        showPlaceholder();
      }
    }
    brandLogo.addEventListener('load', showLogo);
    brandLogo.addEventListener('error', showPlaceholder, { once: true });
  }

  $('btn-generate')?.addEventListener('click', () => {
    try { scheduleCodeRefresh('Actualizando…'); } catch (e) { onError(e); }
  });

  $('btn-download')?.addEventListener('click', () => {
    try {
      const s = generateSketch();
      downloadINO('sketch.ino', s);
    } catch (e) { onError(e); }
  });

  const copyBtn = $('code-copy');
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      try {
        const code = generateSketch();
        await navigator.clipboard.writeText(code);
        const original = copyBtn.textContent;
        copyBtn.textContent = 'Copiado ✔';
        copyBtn.disabled = true;
        setTimeout(() => {
          copyBtn.textContent = original || 'Copiar';
          copyBtn.disabled = false;
        }, 1500);
      } catch (e) {
        copyBtn.textContent = 'No se pudo copiar';
        copyBtn.disabled = true;
        setTimeout(() => {
          copyBtn.textContent = 'Copiar';
          copyBtn.disabled = false;
        }, 1800);
        onError(e);
      }
    });
  }

  const codePane = document.getElementById('right');
  const codeToggle = document.getElementById('codeToggle');
  const codeSplitter = document.getElementById('codeSplitter');
  const mainLayout = document.querySelector('main');
  if (codePane && codeToggle && codeSplitter && mainLayout) {
    const iconEl = codeToggle.querySelector('.icon');
    const labelEl = codeToggle.querySelector('.label');

    const parseWidth = (value, fallback) => {
      const n = parseInt(value, 10);
      if (Number.isFinite(n)) {
        return Math.min(640, Math.max(280, n));
      }
      return fallback;
    };

    const readStorage = (key) => {
      try { return localStorage.getItem(key); } catch (_e) { return null; }
    };
    const writeStorage = (key, value) => {
      try { localStorage.setItem(key, value); } catch (_e) {}
    };

    const storedWidth = parseWidth(readStorage('codePaneWidth'), Math.round(codePane.getBoundingClientRect().width || 360));
    let paneWidth = storedWidth;
    const applyWidth = (width) => {
      paneWidth = parseWidth(width, paneWidth);
      codePane.style.setProperty('--code-pane-width', `${paneWidth}px`);
      scheduleWorkspaceResize();
    };
    applyWidth(paneWidth);

    const updateToggleUi = (collapsed) => {
      codeToggle.setAttribute('aria-expanded', (!collapsed).toString());
      if (iconEl) iconEl.textContent = collapsed ? '▶' : '◀';
      if (labelEl) labelEl.textContent = collapsed ? 'Mostrar' : 'Ocultar';
    };

    const setCollapsed = (collapsed) => {
      codePane.classList.toggle('collapsed', collapsed);
      codeSplitter.classList.toggle('collapsed', collapsed);
      updateToggleUi(collapsed);
      codeSplitter.setAttribute('aria-expanded', (!collapsed).toString());
      writeStorage('codePaneCollapsed', collapsed ? '1' : '0');
      if (!collapsed) {
        applyWidth(paneWidth);
      } else {
        scheduleWorkspaceResize({ fit: true });
      }
    };

    const initialCollapsed = readStorage('codePaneCollapsed') === '1';
    setCollapsed(initialCollapsed);

    codeToggle.addEventListener('click', () => {
      const next = !codePane.classList.contains('collapsed');
      setCollapsed(!next);
      if (!codePane.classList.contains('collapsed')) {
        applyWidth(paneWidth);
      }
    });

    const persistWidth = () => {
      if (codePane.classList.contains('collapsed')) return;
      const width = Math.round(codePane.getBoundingClientRect().width);
      applyWidth(width);
      writeStorage('codePaneWidth', `${width}`);
      scheduleWorkspaceResize();
    };

    if (window.ResizeObserver) {
      const observer = new ResizeObserver(() => {
        if (codePane.classList.contains('collapsed')) return;
        persistWidth();
      });
      observer.observe(codePane);
    } else {
      window.addEventListener('mouseup', persistWidth);
    }

    let dragging = false;
    let pointerId = null;
    let startClientX = 0;
    let startWidth = paneWidth;

    const handlePointerMove = (ev) => {
      if (!dragging) return;
      if (window.matchMedia && window.matchMedia('(max-width: 960px)').matches) {
        stopDragging();
        return;
      }
      const delta = startClientX - ev.clientX;
      const newWidth = startWidth + delta;
      applyWidth(newWidth);
    };

    const stopDragging = () => {
      if (!dragging) return;
      dragging = false;
      if (pointerId !== null) {
        codeSplitter.releasePointerCapture(pointerId);
        pointerId = null;
      }
      codeSplitter.classList.remove('dragging');
      mainLayout.classList.remove('dragging');
      persistWidth();
      scheduleWorkspaceResize();
    };

    codeSplitter.addEventListener('pointerdown', (ev) => {
      if (codePane.classList.contains('collapsed')) return;
      if (window.matchMedia && window.matchMedia('(max-width: 960px)').matches) return;
      if (codeToggle.contains(ev.target)) return;
      dragging = true;
      pointerId = ev.pointerId;
      startClientX = ev.clientX;
      startWidth = codePane.getBoundingClientRect().width;
      codeSplitter.setPointerCapture(pointerId);
      codeSplitter.classList.add('dragging');
      mainLayout.classList.add('dragging');
      handlePointerMove(ev);
    });

    codeSplitter.addEventListener('pointermove', handlePointerMove);
    codeSplitter.addEventListener('pointerup', stopDragging);
    codeSplitter.addEventListener('pointercancel', stopDragging);
  }

  // Estos botones son sólo si estás probando Web Serial local
  $('btn-connect')?.addEventListener('click', () => { connectSerial(); });
  $('serial-send')?.addEventListener('click', () => {
    const cmd = $('serial-input')?.value || '';
    if (cmd) sendSerial(cmd);
  });
  $('btn-test-led')?.addEventListener('click', async () => {
    await sendSerial('W 13 H');
    setTimeout(() => sendSerial('W 13 L'), 600);
  });
});

// ===== Smartblock Uploader (CLI) integration =====
(function (){
  const $ = (selector) => document.querySelector(selector);

  const uploaderEndpoints = (() => {
    const dedupe = new Set();
    const list = [];
    const defaultPorts = [8999, 8998];

    const append = (proto, host, port) => {
      const url = `${proto}://${host}:${port}`;
      if (dedupe.has(url)) return;
      dedupe.add(url);
      list.push(url);
    };

    const resolvePorts = () => {
      const ports = [...defaultPorts];
      if (typeof window !== 'undefined') {
        try {
          const params = new URLSearchParams(window.location.search || '');
          params.getAll('uploaderPort')
            .flatMap(p => `${p}`.split(','))
            .map(p => parseInt(p, 10))
            .filter(p => Number.isFinite(p))
            .forEach(p => ports.push(p));
          const stored = window.localStorage?.getItem('smartblock:uploader:ports');
          if (stored) {
            stored.split(',')
              .map(p => parseInt(p, 10))
              .filter(p => Number.isFinite(p))
              .forEach(p => ports.push(p));
          }
        } catch (_e) {}
      }
      return [...new Set(ports)];
    };

    const chooseProtocols = () => {
      if (typeof window === 'undefined') return ['http', 'https'];
      return (window.location?.protocol === 'https:') ? ['https', 'http'] : ['http', 'https'];
    };

    const hosts = ['127.0.0.1', 'localhost'];
    const protocols = chooseProtocols();
    const ports = resolvePorts();

    protocols.forEach(proto => {
      hosts.forEach(host => {
        ports.forEach(port => append(proto, host, port));
      });
    });
    return list;
  })();
  const uploaderState = {
    base: uploaderEndpoints[0],
    status: 'searching', // searching | probing | ready | unreachable | error
    message: 'Buscando uploader…',
    detail: 'Buscando uploader…',
    probing: false,
    lastResult: null
  };

  const progress = {
    container: document.getElementById('uploadProgress'),
    bar: document.getElementById('uploadProgressBar'),
    text: document.getElementById('uploadProgressText')
  };

  const toastHost = (() => {
    const existing = document.getElementById('toastStack');
    if (existing) return existing;
    const el = document.createElement('div');
    el.id = 'toastStack';
    document.body.appendChild(el);
    return el;
  })();

  function showToast(message, tone = 'info', { timeout = 3200 } = {}) {
    if (!toastHost || !message) return;
    const toast = document.createElement('div');
    toast.className = `toast ${tone}`;
    toast.textContent = message;
    toastHost.appendChild(toast);
    requestAnimationFrame(() => {
      toast.classList.add('visible');
    });
    const remove = () => {
      toast.classList.remove('visible');
      setTimeout(() => {
        toastHost.removeChild(toast);
      }, 300);
    };
    if (timeout > 0) {
      setTimeout(remove, timeout);
    }
    toast.addEventListener('click', remove, { once: true });
  }

  const pushLog = (() => {
    let lastMessage = '';
    return (message, tone = 'warn') => {
      if (!message || message === lastMessage) return;
      lastMessage = message;
      try {
        if (window.SerialUI && typeof window.SerialUI.log === 'function') {
          window.SerialUI.log(message, tone);
        }
      } catch (_e) {}
    };
  })();

  function wireUploadButton() {
    const btn = $('#btnUploadCli');
    if (!btn) return;
    if (btn.dataset && btn.dataset.wired === '1') return;
    btn.addEventListener('click', (ev) => {
      ev.__uploaderHandled = true;
      doUploadCLI(ev);
    });
    btn.dataset.wired = '1';
    console.log('[Uploader] botón cableado');
  }

  function setUploadProgress(message, value) {
    if (!progress.container) return;
    progress.container.classList.remove('hidden');
    if (progress.text) progress.text.textContent = message;
    if (typeof value === 'number' && progress.bar) progress.bar.value = value;
  }

  function hideUploadProgress(delay = 0) {
    if (!progress.container) return;
    setTimeout(() => {
      progress.container.classList.add('hidden');
      if (progress.bar) progress.bar.value = 0;
      if (progress.text) progress.text.textContent = 'Preparando…';
    }, delay);
  }

  function renderUploaderState() {
    const btn = $('#btnUploadCli');
    const status = $('#uploader-status');
    const statusDetail = $('#uploader-status-detail');
    const stepCard = document.getElementById('upload-step-detect');
    const endpointLabel = document.getElementById('uploader-endpoint');
    const retryBtn = $('#btnRetryUploader');
    const tone = (uploaderState.status === 'ready') ? 'ok'
      : (uploaderState.status === 'error' || uploaderState.status === 'unreachable') ? 'err'
      : (uploaderState.status === 'probing') ? 'warn'
      : 'warn';
    if (btn) {
      const enabled = uploaderState.status === 'ready';
      const busy = uploaderState.status === 'probing';
      btn.disabled = !enabled;
      btn.classList.add('primary');
      btn.classList.toggle('is-disabled', !enabled);
      btn.dataset.state = uploaderState.status;
      btn.setAttribute('aria-busy', busy ? 'true' : 'false');
      console.log('[Uploader] button state -> disabledProp:', btn.disabled, 'class is-disabled:', btn.classList.contains('is-disabled'));
    }
    if (status) {
      status.textContent = uploaderState.message;
      status.className = `badge ${tone}`;
    }
    if (statusDetail) {
      let detailMessage = uploaderState.detail || uploaderState.message;
      if (uploaderState.status === 'ready') {
        let host = '';
        try {
          host = uploaderState.base ? new URL(uploaderState.base).host : '';
        } catch (_e) {}
        detailMessage = host ? `Uploader listo · ${host}` : 'Uploader listo';
      } else if (uploaderState.status === 'probing') {
        detailMessage = uploaderState.detail || 'Verificando uploader…';
      }
      statusDetail.textContent = detailMessage;
      statusDetail.className = `step-status-text ${tone}`;
      uploaderState.detail = detailMessage;
    }
    if (stepCard) {
      stepCard.dataset.state = uploaderState.status;
    }
    if (endpointLabel) {
      try {
        endpointLabel.textContent = uploaderState.base ? `@ ${new URL(uploaderState.base).host}` : '—';
      } catch (_e) {
        endpointLabel.textContent = uploaderState.base || '—';
      }
    }
    if (retryBtn) {
      const disableRetry = uploaderState.status === 'probing';
      retryBtn.disabled = disableRetry;
      retryBtn.classList.toggle('is-disabled', disableRetry);
      retryBtn.setAttribute('aria-busy', disableRetry ? 'true' : 'false');
    }
    console.log('[Uploader] UI render →', uploaderState.status, uploaderState.message, 'base:', uploaderState.base);
  }

  function setUploaderState(status, message, base, detail) {
    const sameStatus = uploaderState.status === status;
    const sameMessage = uploaderState.message === message;
    const nextDetail = detail || message;
    const sameDetail = uploaderState.detail === nextDetail;
    const sameBase = !base || uploaderState.base === base;
    if (sameStatus && sameMessage && sameDetail && sameBase) return;
    const previousStatus = uploaderState.status;
    uploaderState.status = status;
    uploaderState.message = message;
    uploaderState.detail = nextDetail;
    if (base) uploaderState.base = base;
    uploaderState.lastResult = { status, message, detail: nextDetail, at: Date.now(), base: uploaderState.base };
    wireUploadButton();
    renderUploaderState();
    const tone = (status === 'ready') ? 'ok' : (status === 'error') ? 'err' : 'warn';
    pushLog(`[Uploader] ${message}`, tone);
    if (status === 'ready' && previousStatus !== 'ready') {
      showToast(message, 'ok', { timeout: 3600 });
    } else if (status === 'error' && previousStatus !== 'error') {
      showToast(message, 'err', { timeout: 4800 });
    }
  }

  async function probeEndpoint(endpoint, { timeout = 1800 } = {}) {
    const url = `${endpoint}/`;
    const opts = { cache: 'no-store' };
    async function fetchWithTimeout(targetUrl, options = {}) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);
      try {
        return await fetch(targetUrl, { ...options, signal: controller.signal });
      } finally {
        clearTimeout(timer);
      }
    }
    try {
      console.log('[Uploader detect] probing', url);
      const resp = await fetchWithTimeout(url, opts);
      console.log('[Uploader detect] status =', resp.status, 'type =', resp.type);
      if (resp.type === 'opaque') {
        return { ok: true, message: 'Uploader detectado (sin CORS)', base: endpoint };
      }
      if (resp.ok) {
        try {
          const body = await resp.clone().text();
          console.log('[Uploader detect] body =', body.slice(0, 200));
        } catch (_ignored) {}
        return { ok: true, message: 'Uploader conectado', base: endpoint };
      }
      return { ok: true, message: `Uploader detectado (HTTP ${resp.status})`, base: endpoint };
    } catch (err) {
      console.warn('[Uploader detect] fail on', endpoint, err?.message || err);
      const reason = (err && err.name === 'AbortError') ? 'Tiempo de espera agotado' : (err?.message || 'Sin respuesta');
      try {
        console.log('[Uploader detect] retry no-cors', url);
        await fetchWithTimeout(url, { ...opts, mode: 'no-cors' });
        return { ok: true, message: 'Uploader detectado (sin CORS)', base: endpoint };
      } catch (retryErr) {
        return { ok: false, message: retryErr?.message || reason, base: endpoint };
      }
    }
  }

  async function detectUploader({ force = false } = {}) {
    if (uploaderState.probing) return uploaderState.status;
    uploaderState.probing = true;
    const previousStatus = uploaderState.status;
    const startStatus = (previousStatus === 'ready' || previousStatus === 'probing') ? 'probing' : 'searching';
    const startMessage = (startStatus === 'probing') ? 'Verificando uploader…' : 'Buscando uploader…';
    if (force || previousStatus !== 'ready') {
      setUploaderState(startStatus, startMessage, undefined, startMessage);
    }
    let result = null;
    for (const endpoint of uploaderEndpoints) {
      result = await probeEndpoint(endpoint);
      if (result.ok) break;
    }
    if (result && result.ok) {
      let hostText = '';
      if (result.base) {
        try { hostText = new URL(result.base).host; } catch (_e) {}
      }
      const detailText = hostText ? `${result.message} · ${hostText}` : result.message;
      setUploaderState('ready', 'Uploader listo', result.base, detailText);
    } else {
      const message = result ? `Uploader inalcanzable (${result.message})` : 'Uploader inalcanzable';
      const shouldNotify = uploaderState.status !== 'unreachable' || uploaderState.message !== message;
      setUploaderState('unreachable', message, undefined, message);
      if (shouldNotify) {
        showToast(message, 'warn', { timeout: 4800 });
      }
    }
    uploaderState.probing = false;
    if (typeof window !== 'undefined') {
      try {
        window.__UPLOADER_STATE = uploaderState;
      } catch (_e) {}
    }
    return uploaderState.status;
  }

  async function closePortIfNeeded(port){
    try{
      if (window.SerialUI && typeof window.SerialUI.closeIfOpen === 'function'){
        await window.SerialUI.closeIfOpen(port);
      } else if (window.ArduinoAgent && typeof window.ArduinoAgent.__emitCommand === 'function'){
        window.ArduinoAgent.__emitCommand(`close ${port}`);
      }
    }catch(_e){}
  }

  async function doUploadCLI(){
    const portSel = $('#portSelect');
    const fqbnSel = $('#fqbnSelect');
    const btn = $('#btnUploadCli');
    console.log('[Upload CLI] click', { status: uploaderState.status, base: uploaderState.base });
    if (uploaderState.status !== 'ready') {
      await detectUploader({ force: true });
      console.log('[Upload CLI] detection after click', { status: uploaderState.status, base: uploaderState.base });
    }
    if (uploaderState.status !== 'ready') {
      const warnMsg = 'El uploader local no responde. Verificá que la app esté corriendo.';
      pushLog('Uploader local inalcanzable. Verificá que la app esté corriendo.', 'warn');
      showToast(warnMsg, 'err', { timeout: 4800 });
      return;
    }
    let port = portSel ? (portSel.value || '').trim() : '';
    if (!port && typeof window !== 'undefined' && window.__SERIAL_SELECTED_PORT) {
      port = window.__SERIAL_SELECTED_PORT.trim();
      if (portSel && port) portSel.value = port;
    }

    if(!port){
      showToast('Elegí un puerto antes de subir.', 'warn');
      return;
    }

    const fqbn = fqbnSel ? (fqbnSel.value || 'arduino:avr:nano') : 'arduino:avr:nano';

    let ino = '';
    try{
      if (typeof window.generateSketch === 'function'){ ino = window.generateSketch(); }
    }catch(_e){}
    if(!ino || typeof ino !== 'string'){
      showToast('No hay sketch para subir. Generá el código e inténtalo otra vez.', 'warn');
      return;
    }

    btn && (btn.disabled = true);
    setUploadProgress('Preparando sketch…', 10);
    await closePortIfNeeded(port);
    setUploadProgress('Liberando puerto…', 30);

    try{
      setUploadProgress('Enviando programa…', 65);
      const resp = await fetch(`${uploaderState.base}/upload-ino`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ ino, port, fqbn })
      });
      setUploadProgress('Validando respuesta…', 85);
      const contentType = resp.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json');
      let data = null;
      let rawBody = '';
      try {
        if (isJson) {
          data = await resp.json();
        } else {
          rawBody = await resp.text();
          try { data = JSON.parse(rawBody); } catch (_e) {}
        }
      } catch (parseErr) {
        console.warn('[upload-ino] parse error', parseErr);
      }
      if (!resp.ok || !data) {
        const detail = data?.error || data?.message || rawBody || `HTTP ${resp.status}`;
        setUploadProgress('Falló la subida', 100);
        const friendly = detail.length > 280 ? `${detail.slice(0, 277)}…` : detail;
        pushLog(`❌ Subida fallida (${resp.status}). ${friendly}`, 'err');
        showToast(`❌ Falló la subida: ${friendly}`, 'err', { timeout: 7000 });
        if (data && data.log) {
          console.error('[upload-ino] build log\n', data.log);
        }
        return;
      }
      console.log('[upload-ino]', data);
      if(data.ok){
        setUploadProgress('Subida completada ✔', 100);
        pushLog('✅ Subida OK', 'ok');
        showToast('✅ Programa subido correctamente', 'ok');
      }else{
        setUploadProgress('Falló la subida', 100);
        pushLog('❌ Falló la subida. Revisá la consola para detalle.', 'err');
        showToast('❌ Falló la subida. Revisá la consola para ver detalles.', 'err', { timeout: 6000 });
      }
    }catch(e){
      console.error(e);
      setUploadProgress('No pude contactar al uploader', 100);
      pushLog('No pude contactar al uploader (ver consola).', 'err');
      showToast('No pude contactar al Uploader local. ¿Está abierto?', 'err', { timeout: 6000 });
    }finally{
      hideUploadProgress(900);
      if (btn) {
        setTimeout(() => {
          btn.disabled = false;
          renderUploaderState();
        }, 650);
      }
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    wireUploadButton();
    $('#btnRetryUploader')?.addEventListener('click', (ev) => {
      ev.preventDefault();
      detectUploader({ force: true });
    });
    document.addEventListener('click', (ev) => {
      if (ev.__uploaderHandled) return;
      const target = ev.target;
      if (!target) return;
      if (target.id === 'btnUploadCli' || target.closest && target.closest('#btnUploadCli')) {
        console.log('[Uploader] delegado click capturado');
        ev.__uploaderHandled = true;
        doUploadCLI(ev);
      }
    }, { passive: true });
    renderUploaderState();
    detectUploader({ force: true });
  });

  try {
    window.detectUploader = detectUploader;
    window.debugUploader = () => ({
      state: { ...uploaderState },
      button: (() => {
        const btn = document.getElementById('btnUploadCli');
        return btn ? {
          disabledProp: btn.disabled,
          className: btn.className,
          dataset: { ...btn.dataset }
        } : null;
      })()
    });
    window.doUploadCLI = doUploadCLI;
  } catch (_e) {}

  // Reintentos de detección por si el usuario abre el Uploader luego
  setTimeout(detectUploader, 2000);
  setInterval(detectUploader, 15000);
})();
