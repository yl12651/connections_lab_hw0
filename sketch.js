// --- Globals ---
let humanModel;
let rotY = 0;
let spinVel = 0;
let brownieFont;
let modelScale = -1.5;

const SPIN_MAX  = 0.2;       // top limit
const ACCEL_ON  = 0.0008;    // acceleration
const DECEL_OFF = 0.0008;    // coast/friction
const SPIN_MIN  = 0.008;     // bottom velocity

const STRING_PX = 2;                 // thickness in pixels
const STRING_COLOR = [255, 130, 0];  // orange

let buttonPressed = false;

// --- Web Bluetooth (BLE) ---
const SERVICE_UUID = '19b10000-e8f2-537e-4f6c-d104768a1214';
const CHAR_UUID    = '2A57';

let bleDevice = null;
let bleChar = null;
let bleButton = null;
let bleConnected = false;

function preload() {
  humanModel = loadModel('HUNAN.obj', true); // normalize = true
  brownieFont = loadFont('BrownieStencil-8O8MJ.ttf');
}

function setup() {
  createCanvas(960, 540, WEBGL).parent('stage');
  textFont(brownieFont);
  noStroke();

  // BLE connect button
  makeBleButton();

  // Optional: keyboard fallback for testing (hold space = pressed)
  window.addEventListener('keydown', (e) => { if (e.code === 'Space') buttonPressed = true; });
  window.addEventListener('keyup',   (e) => { if (e.code === 'Space') buttonPressed = false; });
}

function draw() {
  background(240);

  // Spin physics
  if (buttonPressed) {
    spinVel = min(SPIN_MAX, spinVel + ACCEL_ON);
  } else {
    spinVel = max(SPIN_MIN, spinVel - DECEL_OFF);
  }
  rotY += spinVel;

  // Lighting
  ambientLight(90);
  directionalLight(255,255,255,  0.3,  0.7,  0.2);
  directionalLight(140,140,140, -0.6, -0.4,  0.2);
  directionalLight(110,110,110,  0.0,  0.3, -1.0);

  // Model
  push();
  translate(-90, 0, 0);     // move a bit left (adjust to taste)
  rotateZ(-PI / 18);        // ~10° lean to the left
  rotateY(rotY);            // then spin around Y
  scale(modelScale);        // keep your orientation fix
  emissiveMaterial(255);
  model(humanModel);
  pop();

  // "string" wrapping around (stroke style kept from your original)
  noFill();
  stroke(...STRING_COLOR);
  strokeWeight(STRING_PX);

  // Tiny HUD showing BLE state
  push();
  resetMatrix();
  translate(-width/2 + 12, -height/2 + 32, 0);
  noStroke();
  fill(30);
  textSize(14);
  text(`BLE: ${bleConnected ? 'connected' : 'disconnected'} | pressed=${buttonPressed}`, 0, 0);
  pop();
}

/* ----------------- BLE helpers ----------------- */

function makeBleButton() {
  if (bleButton) return;
  bleButton = createButton('connect BLE');
  bleButton.position(10, 190);
  bleButton.style('z-index', '9999');
  bleButton.style('position', 'absolute');
  bleButton.mousePressed(connectBLE);
}

async function connectBLE() {
  if (!('bluetooth' in navigator)) {
    console.error('Web Bluetooth not supported in this browser.');
    return;
  }

  try {
    const device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [SERVICE_UUID] }]
    });

    bleDevice = device;
    bleDevice.addEventListener('gattserverdisconnected', onBleDisconnected);

    const server = await bleDevice.gatt.connect();
    const service = await server.getPrimaryService(SERVICE_UUID);
    bleChar = await service.getCharacteristic(CHAR_UUID);

    // Subscribe to notifications (Arduino sends a single byte 0/1)
    await bleChar.startNotifications();
    bleChar.addEventListener('characteristicvaluechanged', onBleNotify);

    // Read initial value once (single byte)
    try {
      const dv = await bleChar.readValue();     // DataView
      const b0 = dv.getUint8(0);                // 0 or 1
      console.log('[BLE] initial byte:', b0);
      buttonPressed = (b0 === 1);
    } catch (_) { /* some stacks disallow read-before-notify; safe to ignore */ }

    bleConnected = true;
    if (bleButton) {
      bleButton.html('disconnect BLE');
      bleButton.mousePressed(disconnectBLE);
    }
    console.log('BLE connected.');
  } catch (err) {
    console.error('BLE connect error:', err);
  }
}

function onBleNotify(e) {
  const dv = e.target.value;        // DataView
  if (!dv || dv.byteLength === 0) return;
  const b0 = dv.getUint8(0);        // read single byte
  console.log('[BLE] notify byte:', b0);
  buttonPressed = (b0 === 1);
}

function disconnectBLE() {
  try {
    if (bleDevice && bleDevice.gatt && bleDevice.gatt.connected) {
      bleDevice.gatt.disconnect();
    }
  } catch (err) {
    console.error('BLE disconnect error:', err);
  }
}

function onBleDisconnected() {
  bleConnected = false;
  bleChar = null;
  if (bleButton) {
    bleButton.html('connect BLE');
    bleButton.mousePressed(connectBLE);
  }
  console.log('BLE disconnected.');
}
