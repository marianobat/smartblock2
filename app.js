// === Tema SmartBlock para Blockly ===
const SmartBlockTheme = Blockly.Theme.defineTheme('smartblock', {
  'base': Blockly.Themes.Classic, // podés probar "Zelos" también
  'blockStyles': {
    "loop_blocks": { "colourPrimary": "#FFB703" },
    "logic_blocks": { "colourPrimary": "#219EBC" },
    "math_blocks": { "colourPrimary": "#8ECAE6" },
    "io_blocks": { "colourPrimary": "#FB8500" },
  },
  'categoryStyles': {
    "loop_category": { "colour": "#FFB703" },
    "logic_category": { "colour": "#219EBC" },
    "math_category": { "colour": "#8ECAE6" },
    "io_category": { "colour": "#FB8500" },
  },
  'componentStyles': {
    'workspaceBackgroundColour': '#f7f8fa',
    'toolboxBackgroundColour': '#ffffff',
    'flyoutBackgroundColour': '#f0f0f0',
    'flyoutOpacity': 0.8,
    'scrollbarColour': '#c4c4c4',
    'insertionMarkerColour': '#219EBC',
    'insertionMarkerOpacity': 0.3,
    'cursorColour': '#FFB703',
  }
});


let workspace=null, port=null, writer=null, reader=null;
function onError(e){ console.error(e); const log=document.getElementById('serial-log'); if(log){ log.textContent += '[ERROR] ' + (e?.message||e) + '\n'; } }
function logSerial(msg){ const el=document.getElementById('serial-log'); if(!el) return; el.textContent += msg + '\n'; el.scrollTop = el.scrollHeight; }

function setupBlockly(){
  if(!window.Blockly) throw new Error('Blockly no está disponible.');
  workspace = Blockly.inject('blocklyDiv', {
    toolbox: document.getElementById('toolbox'),
    theme: SmartBlockTheme,   // 👈 usa el tema que definiste arriba
    renderer: 'zelos',        // (opcional) estilo de bloques redondeado
    zoom: { controls: true, wheel: true },
    trashcan: true,
    scrollbars: true,
  });
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
const dom = Blockly.utils.xml.textToDom(xmlText);
  Blockly.Xml.domToWorkspace(dom, workspace);
}

function generateSketch(){
  if(!window.Arduino) throw new Error('Generator Arduino no cargó (generator.js).');
  if(!workspace) throw new Error('Workspace no inicializado');
  Arduino.init(workspace);
  const tops = workspace.getTopBlocks(true);
  let body=''; for(const b of tops){ const code=Arduino.blockToCode(b); body += Array.isArray(code)?code[0]:(code||''); }
  const final = Arduino.finish(body);
  document.getElementById('code').textContent = final;
  return final;
}

function downloadINO(name, content){
  const blob = new Blob([content], {type:'text/plain'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); URL.revokeObjectURL(a.href);
}

async function connectSerial(){
  if(!('serial' in navigator)){ alert('Chrome/Edge y HTTPS/localhost son necesarios para WebSerial'); return; }
  try{
    port = await navigator.serial.requestPort();
    await port.open({ baudRate: 115200 });
    writer = port.writable.getWriter(); reader = port.readable.getReader();
    document.getElementById('port-label').textContent = 'conectado';
    (async()=>{ const dec = new TextDecoder(); try{ while(true){ const {value,done}=await reader.read(); if(done) break; if(value) logSerial(dec.decode(value)); } } catch(e){ onError(e); } })();
  }catch(e){ onError(e); }
}
async function sendSerial(cmd){ if(!writer){ alert('Conectá primero'); return; } const enc=new TextEncoder(); await writer.write(enc.encode(cmd.trim() + '\n')); logSerial('> '+cmd); }

window.addEventListener('DOMContentLoaded', ()=>{
  try{ setupBlockly(); }catch(e){ onError(e); }
  const $=id=>document.getElementById(id);
  $('btn-generate')?.addEventListener('click', ()=>{ try{ generateSketch(); }catch(e){ onError(e); } });
  $('btn-download')?.addEventListener('click', ()=>{ try{ const s=generateSketch(); downloadINO('sketch.ino', s); }catch(e){ onError(e); } });
  $('btn-connect')?.addEventListener('click', ()=>{ connectSerial(); });
  $('serial-send')?.addEventListener('click', ()=>{ const cmd=$('serial-input')?.value||''; if(cmd) sendSerial(cmd); });
  $('btn-test-led')?.addEventListener('click', async ()=>{ await sendSerial('W 13 H'); setTimeout(()=>sendSerial('W 13 L'), 600); });
});

function ensureSingletonTopBlock(type, x, y) {
  const existing = workspace.getAllBlocks(false).find(b => b.type === type);
  if (existing) return existing;
  const block = workspace.newBlock(type);
  block.initSvg();
  block.render();
  block.moveBy(x, y);
  return block;
}

function autoPlaceSetupLoop() {
  // Coloca setup y loop si no están
  ensureSingletonTopBlock('arduino_setup', 50, 30);
  ensureSingletonTopBlock('arduino_loop', 50, 180);
}

function preventDuplicates() {
  workspace.addChangeListener(function(e) {
    if (e.type !== Blockly.Events.BLOCK_CREATE) return;
    const ids = e.ids || [];
    ids.forEach(id => {
      const b = workspace.getBlockById(id);
      if (!b) return;
      if (b.type === 'arduino_setup' || b.type === 'arduino_loop') {
        // Si ya hay otro del mismo tipo, borrar este
        const others = workspace.getAllBlocks(false).filter(x => x.type === b.type && x.id !== b.id);
        if (others.length) {
          // Borrar el más nuevo
          b.dispose(true);
          alert(`Sólo se permite un bloque ${b.type.replace('arduino_','')}. Ya existe en el lienzo.`);
        }
      }
    });
  });
}

// Dentro de setupBlockly() DESPUÉS del inject(...):
autoPlaceSetupLoop();
preventDuplicates();
