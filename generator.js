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

function ensurePinMode(pin, mode) {
  const key = `pin_${pin}_${mode}`;
  if (!Arduino.setups_) return;
  Arduino.setups_[key] = `  pinMode(${pin}, ${mode});\n`;
}

function addInclude(line) {
  if (!Arduino.includes_) return;
  Arduino.includes_.add(line);
}

function addDefinition(line) {
  if (!Arduino.definitions_) return;
  Arduino.definitions_.add(line);
}

// Se llama antes de traducir el workspace
Arduino.init = function (_workspace) {
  Arduino.setups_ = Object.create(null); // acumula líneas para setup()
  Arduino.includes_ = new Set();
  Arduino.definitions_ = new Set();
};

// Ensambla el sketch final
Arduino.finish = function (codeBody) {
  const setupLines = Object.values(Arduino.setups_).join('') || '';
  const loopBody = codeBody || '  // (vacío)\n';
  const includes = ['#include <Arduino.h>', ...Array.from(Arduino.includes_)];
  const definitions = Array.from(Arduino.definitions_).join('\n');
  const definitionSection = definitions ? `${definitions}\n\n` : '';
  return `${includes.join('\n')}

${definitionSection}void setup() {
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
  ensurePinMode(pin, 'OUTPUT');
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

Arduino['sensor_button_read'] = function (block) {
  const pin = block.getFieldValue('PIN');
  const mode = block.getFieldValue('MODE') === 'PULLUP' ? 'INPUT_PULLUP' : 'INPUT';
  ensurePinMode(pin, mode);
  const expression = (mode === 'INPUT_PULLUP')
    ? `(digitalRead(${pin}) == LOW)`
    : `(digitalRead(${pin}) == HIGH)`;
  return [expression, Arduino.ORDER_ATOMIC];
};

Arduino['sensor_soil_moisture'] = function (block) {
  const apin = block.getFieldValue('APIN') || 'A0';
  return [`analogRead(${apin})`, Arduino.ORDER_ATOMIC];
};

Arduino['sensor_dht11_value'] = function (block) {
  const pin = block.getFieldValue('PIN');
  const prop = block.getFieldValue('PROP');
  const varName = `dht_${pin}`;
  addInclude('#include <DHT.h>');
  addDefinition(`DHT ${varName}(${pin}, DHT11);`);
  Arduino.setups_[`dht_begin_${pin}`] = `  ${varName}.begin();\n`;
  let call = `${varName}.readTemperature()`;
  if (prop === 'HUM') call = `${varName}.readHumidity()`;
  if (prop === 'TEMP_F') call = `${varName}.readTemperature(true)`;
  return [call, Arduino.ORDER_ATOMIC];
};

Arduino['display_lcd_print'] = function (block) {
  const row = block.getFieldValue('ROW') || '0';
  const col = block.getFieldValue('COL') || '0';
  const text = block.getFieldValue('TEXT') || '';
  addInclude('#include <Wire.h>');
  addInclude('#include <LiquidCrystal_I2C.h>');
  addDefinition('LiquidCrystal_I2C lcd(0x27, 16, 2);');
  Arduino.setups_['lcd_init'] = '  lcd.init();\n  lcd.backlight();\n';
  const safeText = JSON.stringify(text);
  return `  lcd.setCursor(${col}, ${row});\n  lcd.print(${safeText});\n`;
};

Arduino['display_lcd_clear'] = function () {
  addInclude('#include <Wire.h>');
  addInclude('#include <LiquidCrystal_I2C.h>');
  addDefinition('LiquidCrystal_I2C lcd(0x27, 16, 2);');
  Arduino.setups_['lcd_init'] = '  lcd.init();\n  lcd.backlight();\n';
  return '  lcd.clear();\n';
};

const MATRIX_PATTERNS = {
  SMILE: ['0b00111100','0b01000010','0b10100101','0b10000001','0b10100101','0b10011001','0b01000010','0b00111100'],
  HEART: ['0b00000000','0b01100110','0b11111111','0b11111111','0b11111111','0b01111110','0b00111100','0b00011000'],
  ARROW_UP: ['0b00011000','0b00111100','0b01111110','0b11011011','0b00011000','0b00011000','0b00011000','0b00011000'],
  CHECK: ['0b00000000','0b00000001','0b00000011','0b01000110','0b11101100','0b01111000','0b00110000','0b00000000'],
  CUSTOM1: ['0b11111111','0b10000001','0b10100101','0b10011001','0b10100101','0b10000001','0b11111111','0b00000000']
};

function ensureMatrixSetup() {
  addInclude('#include <LedControl.h>');
  addDefinition('LedControl matrix = LedControl(12, 11, 10, 1); // DIN, CLK, CS, dispositivos');
  Arduino.setups_['matrix_init'] = '  matrix.shutdown(0, false);\n  matrix.setIntensity(0, 8);\n  matrix.clearDisplay(0);\n';
}

Arduino['display_matrix_pattern'] = function (block) {
  const patternKey = block.getFieldValue('PATTERN') || 'SMILE';
  const pattern = MATRIX_PATTERNS[patternKey] || MATRIX_PATTERNS.SMILE;
  ensureMatrixSetup();
  const rows = pattern.map((value, idx) => `  matrix.setRow(0, ${idx}, ${value});`).join('\n');
  return rows + '\n';
};

Arduino['motor_servo_write'] = function (block) {
  const pin = block.getFieldValue('PIN');
  const angle = Arduino.valueToCode(block, 'ANGLE') || '0';
  const varName = `servo_${pin}`;
  addInclude('#include <Servo.h>');
  addDefinition(`Servo ${varName};`);
  if (!Arduino.setups_[`servo_attach_${pin}`]) {
    Arduino.setups_[`servo_attach_${pin}`] = `  ${varName}.attach(${pin});\n`;
  }
  return `  ${varName}.write(constrain(${angle}, 0, 180));\n`;
};

Arduino['motor_dc_speed'] = function (block) {
  const pin = block.getFieldValue('PIN');
  const speed = Arduino.valueToCode(block, 'SPEED') || '0';
  ensurePinMode(pin, 'OUTPUT');
  return `  analogWrite(${pin}, constrain(${speed}, 0, 255));\n`;
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
