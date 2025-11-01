// === Tema SmartBlock para Blockly ===
const SmartBlockTheme = Blockly.Theme.defineTheme('smartblock', {
  'base': Blockly.Themes.Classic, // podés probar "Zelos" también
  'blockStyles': {
    "loop_blocks":  { "colourPrimary": "#FFB703" },
    "logic_blocks": { "colourPrimary": "#219EBC" },
    "math_blocks":  { "colourPrimary": "#8ECAE6" },
    "io_blocks":    { "colourPrimary": "#FB8500" },
  },
  'categoryStyles': {
    "loop_category":  { "colour": "#FFB703" },
    "logic_category": { "colour": "#219EBC" },
    "math_category":  { "colour": "#8ECAE6" },
    "io_category":    { "colour": "#FB8500" },
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
  // Coloca setup y loop si no están
  ensureSingletonTopBlock('arduino_setup', 50, 30);
  ensureSingletonTopBlock('arduino_loop',  50, 180);
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

  // Semilla de ejemplo (podés quitarla luego)
  const xmlText = `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="controls_repeat_ext" x="50" y="30">
    <value name="TIMES"><shadow type="math_number"><field name="NUM">10</field></shadow></value>
    <statement name="DO">
      <block type="digital_write_pin">
        <field name="PIN">13</field><field name="STATE">HIGH</field>
        <next><block type="delay_ms"><field name="MS">500</field>
          <next><block type="digital_write_pin">
            <field name="PIN">13</field><field name="STATE">LOW</field>
            <next><block type="delay_ms"><field name="MS">500</field></block></next>
          </block></next>
        </block></next>
      </block>
    </statement>
  </block>
</xml>`;
  try {
    const dom = Blockly.utils.xml.textToDom(xmlText);
    Blockly.Xml.domToWorkspace(dom, workspace);
  } catch (e) {
    onError(e);
  }

  // 🔒 Importante: recién ahora que existe workspace, colocamos setup/loop y el listener anti-duplicados
  autoPlaceSetupLoop();
  preventDuplicates();
}

// --- GENERACIÓN DE CÓDIGO ---

function generateSketch() {
  if (!window.Arduino) throw new Error('Generator Arduino no cargó (generator.js).');
  if (!workspace) throw new Error('Workspace no inicializado');
  Arduino.init(workspace);
  const tops = workspace.getTopBlocks(true);
  let body = '';
  for (const b of tops) {
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

  $('btn-generate')?.addEventListener('click', () => {
    try { generateSketch(); } catch (e) { onError(e); }
  });

  $('btn-download')?.addEventListener('click', () => {
    try {
      const s = generateSketch();
      downloadINO('sketch.ino', s);
    } catch (e) { onError(e); }
  });

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
  const $ = (id) => document.getElementById(id);

  async function detectUploader(){
    try{
      const r = await fetch('http://127.0.0.1:8999/', { cache: 'no-store' });
      if(!r.ok) throw new Error('not ok');
      // Mostrar controles de subida por CLI
      $('#btnUploadCli') && $('#btnUploadCli').classList.remove('hidden');
      $('#uploader-status') && $('#uploader-status').classList.remove('hidden');
    }catch(e){
      // Ocultar si el uploader no está
      $('#btnUploadCli') && $('#btnUploadCli').classList.add('hidden');
      $('#uploader-status') && $('#uploader-status').classList.add('hidden');
    }
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
    const port = portSel ? (portSel.value || '').trim() : '';
    const fqbn = fqbnSel ? (fqbnSel.value || 'arduino:avr:nano') : 'arduino:avr:nano';

    if(!port){ alert('Elegí un puerto.'); return; }

    let ino = '';
    try{
      if (typeof window.generateSketch === 'function'){ ino = window.generateSketch(); }
    }catch(_e){}
    if(!ino || typeof ino !== 'string'){
      alert('No hay sketch para subir. Asegúrate de que generateSketch() devuelva el código.');
      return;
    }

    await closePortIfNeeded(port);

    try{
      const resp = await fetch('http://127.0.0.1:8999/upload-ino', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ ino, port, fqbn })
      });
      const data = await resp.json();
      console.log('[upload-ino]', data);
      if(data.ok){
        alert('✅ Subida OK');
      }else{
        alert('❌ Falló la subida. Revisá la consola para ver detalles.');
      }
    }catch(e){
      console.error(e);
      alert('No pude contactar al Uploader local. ¿Está abierto?');
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    detectUploader();
    const btn = document.getElementById('btnUploadCli');
    if (btn) btn.addEventListener('click', doUploadCLI);
  });

  // Reintentos de detección por si el usuario abre el Uploader luego
  setTimeout(detectUploader, 2000);
  setInterval(detectUploader, 15000);
})();
