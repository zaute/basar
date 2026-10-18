import { runRollingAnimation } from './draw-logic.js';

const displayRoot = document.getElementById('displayRoot');
const numberDisplay = document.getElementById('numberDisplay');

const channel = new BroadcastChannel('loddtrekning');

// The final number is already decided by the control panel; we only delay
// *showing* the rolling animation until the person at this window triggers
// it with a click or the space bar (e.g. for suspense on a projector).
let pendingDraw = null;

function showPrompt() {
  numberDisplay.textContent = 'Klikk eller trykk mellomrom for å trekke';
  numberDisplay.classList.add('prompt');
}

function clearPrompt() {
  numberDisplay.classList.remove('prompt');
}

function startPendingDraw() {
  if (!pendingDraw) {
    return;
  }
  const message = pendingDraw;
  pendingDraw = null;
  clearPrompt();

  runRollingAnimation({
    from: message.from,
    to: message.to,
    finalNumber: message.finalNumber,
    speed: message.speed,
    onTick: (n) => {
      numberDisplay.textContent = String(n);
    },
    onComplete: (n) => {
      numberDisplay.textContent = String(n);
    },
  });
}

channel.onmessage = (event) => {
  const message = event.data;
  if (!message) {
    return;
  }

  if (message.type === 'reset') {
    pendingDraw = null;
    clearPrompt();
    numberDisplay.textContent = '\u00A0';
    return;
  }

  if (message.type !== 'draw') {
    return;
  }

  displayRoot.className = `display theme-${message.theme}`;
  pendingDraw = message;
  showPrompt();
};

document.addEventListener('click', startPendingDraw);
document.addEventListener('keydown', (event) => {
  if (event.code === 'Space' || event.key === ' ') {
    event.preventDefault();
    startPendingDraw();
  }
});
