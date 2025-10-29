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
    this.setColour(180);
  }
};

Blockly.Blocks['delay_ms'] = {
  init: function() {
    this.appendDummyInput()
      .appendField("esperar (ms)")
      .appendField(new Blockly.FieldNumber(1000, 0, 600000, 10), "MS");
    this.setPreviousStatement(true);
    this.setNextStatement(true);
    this.setColour(180);
  }
};

Blockly.Blocks['analog_read_pin'] = {
  init: function() {
    this.appendDummyInput()
      .appendField("leer analógico")
      .appendField(new Blockly.FieldDropdown([["A0","A0"],["A1","A1"],["A2","A2"],["A3","A3"]]), "APIN");
    this.setOutput(true, "Number");
    this.setColour(210);
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
