// Bloques mínimos
if (!window.Blockly) { alert('Blockly not loaded'); }

Blockly.Blocks['digital_write_pin'] = {
  init: function() {
    this.appendDummyInput()
      .appendField("escribir pin")
      .appendField(new Blockly.FieldNumber(13, 0, 100, 1), "PIN")
      .appendField("a")
      .appendField(new Blockly.FieldDropdown([["ALTO","HIGH"],["BAJO","LOW"]]), "STATE");
    this.setPreviousStatement(true);
    this.setNextStatement(true);
    this.setStyle('io_blocks');
  }
};

Blockly.Blocks['delay_ms'] = {
  init: function() {
    this.appendDummyInput()
      .appendField("esperar (ms)")
      .appendField(new Blockly.FieldNumber(1000, 0, 600000, 10), "MS");
    this.setPreviousStatement(true);
    this.setNextStatement(true);
    this.setStyle('loop_blocks');
  }
};

Blockly.Blocks['analog_read_pin'] = {
  init: function() {
    this.appendDummyInput()
      .appendField("leer analógico")
      .appendField(new Blockly.FieldDropdown([["A0","A0"],["A1","A1"],["A2","A2"],["A3","A3"]]), "APIN");
    this.setOutput(true, "Number");
    this.setStyle('sensor_blocks');
  }
};

Blockly.Blocks['sensor_button_read'] = {
  init: function() {
    this.appendDummyInput()
      .appendField("botón en pin")
      .appendField(new Blockly.FieldNumber(2, 0, 100, 1), "PIN")
      .appendField(new Blockly.FieldDropdown([["con pull-up","PULLUP"],["sin pull-up","INPUT"]]), "MODE");
    this.setOutput(true, "Boolean");
    this.setStyle('sensor_blocks');
    this.setTooltip("Devuelve true cuando el botón está presionado.");
  }
};

Blockly.Blocks['sensor_soil_moisture'] = {
  init: function() {
    this.appendDummyInput()
      .appendField("humedad suelo (0-1023) en")
      .appendField(new Blockly.FieldDropdown([["A0","A0"],["A1","A1"],["A2","A2"],["A3","A3"]]), "APIN");
    this.setOutput(true, "Number");
    this.setStyle('sensor_blocks');
    this.setTooltip("Lee un sensor resistivo de humedad de suelo conectado a entrada analógica.");
  }
};

Blockly.Blocks['sensor_dht11_value'] = {
  init: function() {
    this.appendDummyInput()
      .appendField("DHT11 pin")
      .appendField(new Blockly.FieldNumber(3, 0, 100, 1), "PIN")
      .appendField("→")
      .appendField(new Blockly.FieldDropdown([
        ["temperatura °C", "TEMP"],
        ["humedad %", "HUM"],
        ["temperatura °F", "TEMP_F"]
      ]), "PROP");
    this.setOutput(true, "Number");
    this.setStyle('sensor_blocks');
    this.setTooltip("Devuelve la lectura del sensor DHT11 en el formato elegido.");
  }
};

Blockly.Blocks['display_lcd_print'] = {
  init: function() {
    this.appendDummyInput()
      .appendField("LCD 16x2 fila")
      .appendField(new Blockly.FieldDropdown([["0","0"],["1","1"]]), "ROW")
      .appendField("col")
      .appendField(new Blockly.FieldNumber(0, 0, 15, 1), "COL");
    this.appendDummyInput()
      .appendField("texto")
      .appendField(new Blockly.FieldTextInput("abc"), "TEXT");
    this.setPreviousStatement(true);
    this.setNextStatement(true);
    this.setStyle('display_blocks');
    this.setTooltip("Muestra un mensaje en una pantalla LCD I2C (0x27, 16x2).");
  }
};

Blockly.Blocks['display_lcd_clear'] = {
  init: function() {
    this.appendDummyInput()
      .appendField("LCD 16x2: limpiar pantalla");
    this.setPreviousStatement(true);
    this.setNextStatement(true);
    this.setStyle('display_blocks');
  }
};

Blockly.Blocks['display_matrix_pattern'] = {
  init: function() {
    this.appendDummyInput()
      .appendField("matriz 8x8: mostrar")
      .appendField(new Blockly.FieldDropdown([
        ["smiley", "SMILE"],
        ["corazón", "HEART"],
        ["flecha ↑", "ARROW_UP"],
        ["check", "CHECK"],
        ["custom 1", "CUSTOM1"]
      ]), "PATTERN");
    this.setPreviousStatement(true);
    this.setNextStatement(true);
    this.setStyle('display_blocks');
    this.setTooltip("Muestra un patrón simple en una matriz 8x8 con MAX7219.");
  }
};

Blockly.Blocks['motor_servo_write'] = {
  init: function() {
    this.appendDummyInput()
      .appendField("servo en pin")
      .appendField(new Blockly.FieldNumber(9, 0, 100, 1), "PIN");
    this.appendValueInput("ANGLE")
      .setCheck("Number")
      .setAlign(Blockly.ALIGN_RIGHT)
      .appendField("ángulo (0-180)");
    this.setPreviousStatement(true);
    this.setNextStatement(true);
    this.setStyle('motor_blocks');
    this.setTooltip("Mueve un servo a un ángulo determinado (usa la librería Servo).");
  }
};

Blockly.Blocks['motor_dc_speed'] = {
  init: function() {
    this.appendDummyInput()
      .appendField("motor DC PWM pin")
      .appendField(new Blockly.FieldNumber(5, 0, 100, 1), "PIN");
    this.appendValueInput("SPEED")
      .setCheck("Number")
      .setAlign(Blockly.ALIGN_RIGHT)
      .appendField("velocidad 0-255");
    this.setPreviousStatement(true);
    this.setNextStatement(true);
    this.setStyle('motor_blocks');
    this.setTooltip("Controla la velocidad de un motor DC con PWM.");
  }
};

// Bloque "Al iniciar (setup)" — tope, único
Blockly.Blocks['arduino_setup'] = {
  init: function() {
    this.appendDummyInput().appendField("Al iniciar (setup)");
    this.appendStatementInput("DO").setCheck(null);
    this.setColour("#D39D2A");
    this.setTooltip("Código que corre una sola vez al iniciar.");
    this.setHelpUrl("");
    this.setDeletable(true);         // lo podés borrar, pero recomendación es dejarlo
    this.setMovable(true);
    this.setEditable(true);
    // Que sea bloque tope
    this.setPreviousStatement(false);
    this.setNextStatement(false);

    // Evitar múltiples instancias (marcar metadata)
    this.data = "singleton:arduino_setup";
  }
};

// Bloque "Por siempre (loop)" — tope, único
Blockly.Blocks['arduino_loop'] = {
  init: function() {
    this.appendDummyInput().appendField("Por siempre (loop)");
    this.appendStatementInput("DO").setCheck(null);
    this.setColour("#D39D2A");
    this.setTooltip("Código que se repite para siempre.");
    this.setHelpUrl("");
    this.setDeletable(true);
    this.setMovable(true);
    this.setEditable(true);
    this.setPreviousStatement(false);
    this.setNextStatement(false);
    this.data = "singleton:arduino_loop";
  }
};

(function customizeControlsIf(){
  const ifBlock = Blockly?.Blocks?.controls_if;
  if (!ifBlock || typeof ifBlock.init !== 'function') return;
  const originalInit = ifBlock.init;
  Blockly.Blocks.controls_if.init = function(...args) {
    originalInit.apply(this, args);
    if (typeof this.setColour === 'function') {
      this.setColour('#F5D14B');
    }
    const addInputName = 'SMARTBLOCK_IF_ADD';
    if (!this.getInput(addInputName) && typeof Blockly.FieldImage === 'function') {
      const plusIcon = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20"><g fill="none" stroke="%232563EB" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="9" fill="rgba(37,99,235,0.08)"/><path d="M10 6v8M6 10h8"/></g></svg>';
      const addButton = new Blockly.FieldImage(plusIcon, 20, 20, 'Agregar condición "si no" (Shift agrega el bloque final)');
      addButton.setOnClickHandler((_, evt) => {
        const wantsElse = !!(evt && (evt.shiftKey || evt.metaKey));
        if (typeof this.addClause_ !== 'function') return;
        if (wantsElse) {
          if (!this.elseCount_) {
            this.addClause_(true);
          }
        } else {
          this.addClause_(false);
        }
        this.initSvg();
        this.render();
      });
      const LabelCtor = Blockly.FieldLabelSerializable || Blockly.FieldLabel;
      const label = LabelCtor ? new LabelCtor('si no', 'smartblock-if-add-label') : null;
      this.appendDummyInput(addInputName)
        .setAlign(Blockly.ALIGN_RIGHT)
        .appendField(addButton, 'SMARTBLOCK_IF_ADD_BTN')
        .appendField(label || 'si no', 'SMARTBLOCK_IF_ADD_LABEL');
    }
    this.setTooltip("Ejecuta instrucciones si una condición es verdadera. Usá el botón + para sumar ramas \"si no\" (Shift = en otro caso).");
  };
})();
