// generator.js — Arduino C++ (mínimo funcional con CONTROL/LÓGICA/MATH)

// Crea un generador llamado "Arduino"
const Arduino = new Blockly.Generator('Arduino');

// Prioridad básica de expresiones
Arduino.ORDER_ATOMIC = 0;

// Palabras reservadas típicas
Arduino.addReservedWords(
  'setup,loop,if,while,for,int,float,bool,boolean,' +
  'digitalWrite,digitalRead,analogRead,pinMode,delay,' +
  'OUTPUT,INPUT,INPUT_PULLUP,HIGH,LOW,true,false'
);

// Se llama antes de traducir el workspace
Arduino.init = function (_workspace) {
  Arduino.setups_ = Object.create(null); // acumula líneas para setup()
};

// Ensambla el sketch final
Arduino.finish = function (codeBody) {
  const setupLines = Object.values(Arduino.setups_).join('') || '';
  const loopBody = codeBody || '  // (vacío)\n';
  return `#include <Arduino.h>

void setup() {
${setupLines}}

void loop() {
${loopBody}}`;
};

// Encadenar statements
Arduino.scrub_ = function (block, code) {
  const next = block && block.nextConnection && block.nextConnection.targetBlock();
  const nextCode = Arduino.blockToCode(next);
  return code + (nextCode || '');
};

// Helpers genéricos para leer inputs/values de otros bloques
Arduino.statementToCode = function (block, name) {
  const target = block && block.getInputTargetBlock && block.getInputTargetBlock(name);
  if (!target) return '';
  let code = Arduino.blockToCode(target);
  if (Array.isArray(code)) code = code[0];
  return code || '';
};
Arduino.valueToCode = function (block, name) {
  const target = block && block.getInputTargetBlock && block.getInputTargetBlock(name);
  if (!target) return '';
  let code = Arduino.blockToCode(target);
  if (Array.isArray(code)) code = code[0];
  return code || '';
};

// Guarda contenidos del bloque setup en el "buffer" de setup
Arduino['arduino_setup'] = function (block) {
  const body = Arduino.statementToCode(block, 'DO') || '';
  // Guardar el body como fragmento de setup (llaves y sangría los maneja Arduino.finish)
  const key = 'user_setup_block';
  Arduino.setups_[key] = body.replace(/^/gm, '  ');
  return ''; // no emite nada a loop
};

// Devuelve el cuerpo del loop para que Arduino.finish lo inserte
Arduino['arduino_loop'] = function (block) {
  const body = Arduino.statementToCode(block, 'DO') || '';
  // Devuelve el código; Arduino.scrub_ encadena si hay algo debajo (no debería)
  return body.replace(/^/gm, '  ');
};

/* ===================== TUS BLOQUES ===================== */

// escribir pin (digital)
Arduino['digital_write_pin'] = function (block) {
  const pin = block.getFieldValue('PIN');
  const state = block.getFieldValue('STATE'); // HIGH|LOW
  Arduino.setups_['pin_'+pin+'_out'] = `  pinMode(${pin}, OUTPUT);\n`;
  return `  digitalWrite(${pin}, ${state});\n`;
};

// delay en ms
Arduino['delay_ms'] = function (block) {
  const t = block.getFieldValue('MS') || 0;
  return `  delay(${t});\n`;
};

// leer analógico (expresión)
Arduino['analog_read_pin'] = function (block) {
  const apin = block.getFieldValue('APIN') || 'A0';
  return [`analogRead(${apin})`, Arduino.ORDER_ATOMIC];
};

/* =============== CONTROL / LÓGICA / MATH =============== */

// repetir (N) veces  ←—— ESTA ES LA QUE TE FALTABA
Arduino['controls_repeat_ext'] = function (block) {
  const N = Arduino.valueToCode(block, 'TIMES') || block.getFieldValue('TIMES') || '10';
  const body = Arduino.statementToCode(block, 'DO');
  return `  for (int _i = 0; _i < (${N}); _i++) {\n${body}  }\n`;
};

// if / else if / else
Arduino['controls_if'] = function (block) {
  let n = 0, code = '';
  do {
    const cond = Arduino.valueToCode(block, 'IF' + n) || 'false';
    const body = Arduino.statementToCode(block, 'DO' + n);
    code += (n === 0 ? '  if' : '  else if') + ` (${cond}) {\n${body}  }\n`;
    n++;
  } while (block.getInput('IF' + n));
  if (block.getInput('ELSE')) {
    const elseBody = Arduino.statementToCode(block, 'ELSE');
    code += `  else {\n${elseBody}  }\n`;
  }
  return code;
};

// A == B, >, <, etc.
Arduino['logic_compare'] = function (block) {
  const OPS = { EQ:'==', NEQ:'!=', LT:'<', LTE:'<=', GT:'>', GTE:'>=' };
  const op = OPS[block.getFieldValue('OP')] || '==';
  const A = Arduino.valueToCode(block, 'A') || '0';
  const B = Arduino.valueToCode(block, 'B') || '0';
  return [`(${A} ${op} ${B})`, Arduino.ORDER_ATOMIC];
};

// true / false
Arduino['logic_boolean'] = function (block) {
  return [block.getFieldValue('BOOL') === 'TRUE' ? 'true' : 'false', Arduino.ORDER_ATOMIC];
};

// número
Arduino['math_number'] = function (block) {
  return [block.getFieldValue('NUM') || '0', Arduino.ORDER_ATOMIC];
};

window.Arduino = Arduino; // exportar
