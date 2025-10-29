// Firmware UART simple para pruebas con WebSerial
// Protocolo (115200 baudios):
//  - 'W <pin> <H|L>'  => digitalWrite(pin, HIGH/LOW)
//  - 'R <A0|A1|...>'  => imprime 'A <pin> <valor>' con analogRead(pin)

void setup() {
  Serial.begin(115200);
  pinMode(13, OUTPUT);
}

void loop() {
  static String line = "";
  while (Serial.available()) {
    char c = (char)Serial.read();
    if (c == '\n' || c == '\r') {
      processLine(line);
      line = "";
    } else {
      line += c;
    }
  }
}

void processLine(String cmd) {
  cmd.trim();
  if (cmd.length() == 0) return;

  if (cmd.startsWith("W ")) {
    int firstSpace = cmd.indexOf(' ');
    int secondSpace = cmd.indexOf(' ', firstSpace + 1);
    if (secondSpace > 0) {
      int pin = cmd.substring(firstSpace + 1, secondSpace).toInt();
      char state = cmd.substring(secondSpace + 1).charAt(0);
      pinMode(pin, OUTPUT);
      if (state == 'H') digitalWrite(pin, HIGH);
      else digitalWrite(pin, LOW);
      Serial.print("OK W "); Serial.print(pin); Serial.print(" ");
      Serial.println(state);
    }
  } else if (cmd.startsWith("R ")) {
    String apin = cmd.substring(2);
    apin.trim();
    int val = analogRead(parseAnalogPin(apin));
    Serial.print("A "); Serial.print(apin); Serial.print(" "); Serial.println(val);
  } else {
    Serial.print("ERR ? "); Serial.println(cmd);
  }
}

int parseAnalogPin(String s){
  s.toUpperCase();
  if (s == "A0") return A0;
  if (s == "A1") return A1;
  if (s == "A2") return A2;
  if (s == "A3") return A3;
  if (s == "A4") return A4;
  if (s == "A5") return A5;
  return A0;
}
